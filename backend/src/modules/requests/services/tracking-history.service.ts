import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request, RequestStatus } from '../../../database/entities/request.entity';
import { RequestStageHistory, StageAction } from '../../../database/entities/request-stage-history.entity';
import { AuditEvent } from '../../../database/entities/audit-event.entity';
import { User, UserRole } from '../../../database/entities/user.entity';
import { enforceRequestAccessControl } from '../utils/access-control.util';
import {
  TrackingResponseDto,
  StageStepperItemDto,
  CurrentStageInfoDto,
} from '../dto/tracking-response.dto';
import { HistoryResponseDto, AuditEventItemDto } from '../dto/history-response.dto';
import {
  ReviewHistoryResponseDto,
  ReviewHistoryEntryDto,
  ReviewHistoryEventDto,
  ReviewHistorySummaryCountsDto,
} from '../dto/review-history-response.dto';

@Injectable()
export class TrackingHistoryService {
  private readonly logger = new Logger(TrackingHistoryService.name);

  constructor(
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
    @InjectRepository(AuditEvent)
    private readonly auditEventRepo: Repository<AuditEvent>,
  ) {}

  /**
   * Retrieves full stage stepper and tracking status for a request.
   */
  async getTrackingInfo(requestId: string, user: User): Promise<TrackingResponseDto> {
    const request = await this.requestRepo.findOne({
      where: { id: requestId },
      relations: [
        'requestType',
        'workflowTemplate',
        'stageHistory',
        'applicant',
        'applicant.department',
      ],
      order: {
        stageHistory: {
          stageOrder: 'ASC',
        },
      },
    });

    if (!request) {
      throw new NotFoundException(`Request with ID ${requestId} not found`);
    }

    this.enforceAccessControl(request, user);

    const stages = request.stageHistory || [];
    const activeStage = stages.find((s) => s.stageKey === request.currentStageKey) || stages[0];

    const currentStageInfo: CurrentStageInfoDto = {
      key: request.currentStageKey,
      name: activeStage ? activeStage.stageName : request.currentStageKey,
      order: activeStage ? activeStage.stageOrder : 0,
      assignedRole: activeStage ? activeStage.requiredRole : UserRole.LECTURER,
    };

    const stepperItems: StageStepperItemDto[] = stages.map((stg) => {
      let status: 'PENDING' | 'IN_PROGRESS' | 'APPROVED' | 'RETURNED' = 'PENDING';

      if (request.status === RequestStatus.SETTLED) {
        status = 'APPROVED';
      } else if (stg.action === StageAction.APPROVED || stg.action === StageAction.APPROVE_PAYOUT) {
        status = 'APPROVED';
      } else if (stg.action === StageAction.REJECT_RETURN) {
        status = 'RETURNED';
      } else if (stg.stageKey === request.currentStageKey) {
        status = request.status === RequestStatus.RETURNED_FOR_CORRECTION ? 'RETURNED' : 'IN_PROGRESS';
      } else if (activeStage && stg.stageOrder < activeStage.stageOrder) {
        status = 'APPROVED';
      }

      return {
        key: stg.stageKey,
        name: stg.stageName,
        order: stg.stageOrder,
        requiredRole: stg.requiredRole,
        status,
        actorId: stg.actorId,
        actorName: stg.actor ? stg.actor.fullName : null,
        enteredAt: stg.enteredAt ? stg.enteredAt.toISOString() : null,
        completedAt: stg.completedAt ? stg.completedAt.toISOString() : null,
        comments: stg.comments,
      };
    });

    return {
      trackingNumber: request.trackingNumber,
      requestType: request.requestType?.name || 'Examination Payment Claim',
      status: request.status,
      totalAmount: Number(request.totalAmount),
      returningOfficerId: request.returningOfficerId,
      currentStage: currentStageInfo,
      stages: stepperItems,
    };
  }

  /**
   * Retrieves immutable audit trail with actor details, timestamps, and field diffs.
   */
  async getAuditHistory(requestId: string, user: User): Promise<HistoryResponseDto> {
    const request = await this.requestRepo.findOne({
      where: { id: requestId },
      relations: ['auditEvents', 'stageHistory', 'applicant', 'applicant.department'],
      order: {
        auditEvents: {
          createdAt: 'ASC',
        },
      },
    });

    if (!request) {
      throw new NotFoundException(`Request with ID ${requestId} not found`);
    }

    this.enforceAccessControl(request, user);

    const eventDtos: AuditEventItemDto[] = (request.auditEvents || []).map((evt) => ({
      id: evt.id,
      actionType: evt.actionType,
      actorName: evt.actorName || 'System',
      actorRole: evt.actorRole || 'System',
      previousStatus: evt.previousStatus,
      newStatus: evt.newStatus,
      fieldDiff: evt.fieldDiff,
      comment: evt.comment,
      createdAt: evt.createdAt.toISOString(),
    }));

    return {
      requestId: request.id,
      trackingNumber: request.trackingNumber,
      events: eventDtos,
    };
  }

  /**
   * Paginated list of claims submitted by the logged-in applicant.
   */
  async getMyRequests(user: User, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [requests, total] = await this.requestRepo.findAndCount({
      where: { applicantId: user.id },
      relations: ['requestType'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return {
      data: requests.map((r) => ({
        id: r.id,
        trackingNumber: r.trackingNumber,
        requestType: r.requestType?.name || 'Paper Setting & Marking Claim',
        status: r.status,
        currentStageKey: r.currentStageKey,
        totalAmount: Number(r.totalAmount),
        metadata: r.formData?.metadata || {},
        createdAt: r.createdAt.toISOString(),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Work queue for the logged-in reviewer role (scoped by department for HOD).
   */
  async getPendingQueue(user: User, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const queryBuilder = this.requestRepo
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.applicant', 'applicant')
      .leftJoinAndSelect('applicant.department', 'department')
      .leftJoinAndSelect('request.requestType', 'requestType')
      .where('request.status = :status', { status: RequestStatus.UNDER_REVIEW })
      .orderBy('request.createdAt', 'ASC')
      .skip(skip)
      .take(limit);

    // Filter by stage corresponding to reviewer role
    switch (user.role) {
      case UserRole.HOD:
        // Enforce strict department boundary: if HOD does not have a confirmed departmentId, return empty list (fail-closed)
        if (!user.departmentId) {
          return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
        }
        queryBuilder.andWhere('request.currentStageKey = :stageKey', {
          stageKey: 'HEAD_OF_DEPARTMENT',
        });
        queryBuilder.andWhere('applicant.departmentId = :deptId', {
          deptId: user.departmentId,
        });
        break;

      case UserRole.DEAN:
        queryBuilder.andWhere('request.currentStageKey = :stageKey', {
          stageKey: 'DEAN',
        });
        break;

      case UserRole.EXAMINATION_OFFICER:
        queryBuilder.andWhere('request.currentStageKey = :stageKey', {
          stageKey: 'EXAMINATION_OFFICE',
        });
        break;

      case UserRole.FINANCIAL_OFFICER:
        queryBuilder.andWhere('request.currentStageKey = :stageKey', {
          stageKey: 'FINANCIAL_OFFICE',
        });
        break;

      case UserRole.ASSISTANT_BURSAR:
        queryBuilder.andWhere('request.currentStageKey = :stageKey', {
          stageKey: 'ASSISTANT_BURSAR',
        });
        break;

      case UserRole.ADMIN:
        // Admin sees entire pending queue across all stages
        break;

      default:
        // Lecturers don't have a review queue
        return { data: [], meta: { total: 0, page, limit, totalPages: 0 } };
    }

    const [requests, total] = await queryBuilder.getManyAndCount();

    return {
      data: requests.map((r) => ({
        id: r.id,
        trackingNumber: r.trackingNumber,
        requestType: r.requestType?.name,
        applicantName: r.applicant?.fullName,
        applicantEmail: r.applicant?.email,
        departmentCode: r.applicant?.department?.code || null,
        status: r.status,
        currentStageKey: r.currentStageKey,
        totalAmount: Number(r.totalAmount),
        metadata: r.formData?.metadata || {},
        submittedAt: r.createdAt.toISOString(),
      })),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Retrieves paginated review history for the logged-in reviewer.
   * Supports 'personal' scope (default, claims personally acted upon by user.id)
   * and 'role' scope (all claims acted upon within the role/department).
   */
  async getReviewHistory(
    user: User,
    page = 1,
    limit = 10,
    decisionFilter?: string,
    search?: string,
    scope: 'personal' | 'role' = 'personal',
  ): Promise<ReviewHistoryResponseDto> {
    const emptyResponse: ReviewHistoryResponseDto = {
      data: [],
      meta: {
        total: 0,
        page,
        limit,
        totalPages: 0,
        summaryCounts: { approved: 0, returned: 0, rejected: 0 },
      },
    };

    // Lecturers don't have an officer review history
    if (user.role === UserRole.LECTURER) {
      return emptyResponse;
    }

    // Fail closed if HOD lacks departmentId
    if (user.role === UserRole.HOD && !user.departmentId) {
      return emptyResponse;
    }

    const stageKeyMap: Record<string, string> = {
      [UserRole.HOD]: 'HEAD_OF_DEPARTMENT',
      [UserRole.DEAN]: 'DEAN',
      [UserRole.EXAMINATION_OFFICER]: 'EXAMINATION_OFFICE',
      [UserRole.FINANCIAL_OFFICER]: 'FINANCIAL_OFFICE',
      [UserRole.ASSISTANT_BURSAR]: 'ASSISTANT_BURSAR',
    };

    const targetStageKey = stageKeyMap[user.role];
    if (!targetStageKey && user.role !== UserRole.ADMIN) {
      return emptyResponse;
    }

    const qb = this.requestRepo
      .createQueryBuilder('request')
      .leftJoinAndSelect('request.applicant', 'applicant')
      .leftJoinAndSelect('applicant.department', 'department')
      .leftJoinAndSelect('request.requestType', 'requestType')
      .leftJoinAndSelect('request.stageHistory', 'stageHistory')
      .leftJoinAndSelect('request.auditEvents', 'auditEvents');

    // Subquery to find requests where this reviewer role/actor completed an action
    if (scope === 'role') {
      if (user.role === UserRole.ADMIN) {
        qb.where((subQb) => {
          const subQuery = subQb
            .subQuery()
            .select('sh.requestId')
            .from(RequestStageHistory, 'sh')
            .where('sh.completedAt IS NOT NULL');
          return `request.id IN ${subQuery.getQuery()}`;
        });
      } else {
        qb.where((subQb) => {
          const subQuery = subQb
            .subQuery()
            .select('sh.requestId')
            .from(RequestStageHistory, 'sh')
            .where('sh.stageKey = :targetStageKey')
            .andWhere('sh.completedAt IS NOT NULL');
          return `request.id IN ${subQuery.getQuery()}`;
        }).setParameter('targetStageKey', targetStageKey);
      }
    } else {
      // Default: 'personal' scope (matching actorId)
      if (user.role === UserRole.ADMIN) {
        qb.where((subQb) => {
          const subQuery = subQb
            .subQuery()
            .select('sh.requestId')
            .from(RequestStageHistory, 'sh')
            .where('sh.actorId = :userId')
            .andWhere('sh.completedAt IS NOT NULL');
          return `request.id IN ${subQuery.getQuery()}`;
        }).setParameter('userId', user.id);
      } else {
        qb.where((subQb) => {
          const subQuery = subQb
            .subQuery()
            .select('sh.requestId')
            .from(RequestStageHistory, 'sh')
            .where('sh.stageKey = :targetStageKey')
            .andWhere('sh.actorId = :userId')
            .andWhere('sh.completedAt IS NOT NULL');
          return `request.id IN ${subQuery.getQuery()}`;
        })
          .setParameter('targetStageKey', targetStageKey)
          .setParameter('userId', user.id);
      }
    }

    // Department boundary isolation for HOD
    if (user.role === UserRole.HOD) {
      qb.andWhere('applicant.departmentId = :deptId', { deptId: user.departmentId });
    }

    // Optional search filter
    if (search && search.trim()) {
      qb.andWhere(
        '(request.trackingNumber ILIKE :search OR applicant.fullName ILIKE :search)',
        { search: `%${search.trim()}%` },
      );
    }

    qb.orderBy('request.updatedAt', 'DESC');

    const allReviewedRequests = await qb.getMany();

    // Map each request to ReviewHistoryEntry
    const mappedEntries: ReviewHistoryEntryDto[] = allReviewedRequests.map((req) => {
      const completedStages = (req.stageHistory || []).filter(
        (s) => s.completedAt !== null && (user.role === UserRole.ADMIN || s.stageKey === targetStageKey),
      );

      const personalStages = completedStages
        .filter((s) => s.actorId === user.id)
        .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

      const myStage =
        scope === 'personal'
          ? personalStages[0] || completedStages[0]
          : completedStages.sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())[0] ||
            (req.stageHistory || []).find((s) => s.stageKey === targetStageKey);

      // QA-04 Fix: Determine decision strictly from myStage action, independent of subsequent request status
      let decision: 'APPROVED' | 'RETURNED_FOR_CORRECTION' | 'REJECTED' = 'APPROVED';
      if (myStage?.action === StageAction.REJECT_RETURN) {
        decision = 'RETURNED_FOR_CORRECTION';
      } else if (myStage?.action === ('REJECT' as any)) {
        decision = 'REJECTED';
      } else if (
        myStage?.action === StageAction.APPROVED ||
        myStage?.action === StageAction.APPROVE_PAYOUT
      ) {
        decision = 'APPROVED';
      } else if (req.status === RequestStatus.REJECTED) {
        decision = 'REJECTED';
      } else if (req.status === RequestStatus.RETURNED_FOR_CORRECTION) {
        decision = 'RETURNED_FOR_CORRECTION';
      } else {
        decision = 'APPROVED';
      }

      const decisionDate = myStage?.completedAt
        ? new Date(myStage.completedAt).toISOString()
        : new Date(req.updatedAt).toISOString();

      const events: ReviewHistoryEventDto[] = (req.auditEvents || [])
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map((evt) => ({
          id: evt.id,
          action: evt.actionType,
          actor: evt.actorName || 'System',
          role: evt.actorRole || 'System',
          occurredAt: new Date(evt.createdAt).toISOString(),
          summary: evt.comment || evt.actionType,
        }));

      return {
        id: req.id,
        trackingNumber: req.trackingNumber,
        applicant: req.applicant?.fullName || 'Unknown Applicant',
        claimType: req.requestType?.name || 'Paper Setting & Marking Claim',
        department: req.applicant?.department?.name || 'Engineering Faculty',
        departmentCode: req.applicant?.department?.code || null,
        decision,
        decisionDate,
        totalAmount: Number(req.totalAmount) || 0,
        events,
      };
    });

    // Summary counts before decision filtering
    const summaryCounts: ReviewHistorySummaryCountsDto = {
      approved: mappedEntries.filter((e) => e.decision === 'APPROVED').length,
      returned: mappedEntries.filter((e) => e.decision === 'RETURNED_FOR_CORRECTION').length,
      rejected: mappedEntries.filter((e) => e.decision === 'REJECTED').length,
    };

    // Filter by decision if specified
    const filteredEntries = decisionFilter && decisionFilter !== 'all'
      ? mappedEntries.filter((e) => e.decision === decisionFilter)
      : mappedEntries;

    const total = filteredEntries.length;
    const skip = (page - 1) * limit;
    const paginatedEntries = filteredEntries.slice(skip, skip + limit);

    return {
      data: paginatedEntries,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || (total === 0 ? 0 : 1),
        summaryCounts,
      },
    };
  }

  private enforceAccessControl(request: Request, user: User) {
    enforceRequestAccessControl(request, user);
  }
}
