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
import {
  TrackingResponseDto,
  StageStepperItemDto,
  CurrentStageInfoDto,
} from '../dto/tracking-response.dto';
import { HistoryResponseDto, AuditEventItemDto } from '../dto/history-response.dto';

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
      relations: ['auditEvents', 'applicant', 'applicant.department'],
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
        queryBuilder.andWhere('request.currentStageKey = :stageKey', {
          stageKey: 'HEAD_OF_DEPARTMENT',
        });
        if (user.departmentId) {
          queryBuilder.andWhere('applicant.departmentId = :deptId', {
            deptId: user.departmentId,
          });
        }
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

  private enforceAccessControl(request: Request, user: User) {
    if (user.role === UserRole.ADMIN) {
      return;
    }

    // IDOR protection for lecturers
    if (user.role === UserRole.LECTURER && request.applicantId !== user.id) {
      throw new ForbiddenException('Access denied: You can only view tracking and history for your own requests');
    }

    // Department boundary isolation for HODs
    if (user.role === UserRole.HOD) {
      const applicantDeptId = request.applicant?.departmentId;
      const userDeptId = user.departmentId;

      if (applicantDeptId && userDeptId && applicantDeptId !== userDeptId) {
        throw new ForbiddenException(
          'Department boundary violation: You can only inspect requests submitted within your department',
        );
      }
    }
  }
}
