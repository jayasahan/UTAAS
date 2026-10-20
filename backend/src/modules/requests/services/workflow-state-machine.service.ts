import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Request, RequestStatus } from '../../../database/entities/request.entity';
import {
  RequestStageHistory,
  StageAction,
} from '../../../database/entities/request-stage-history.entity';
import { AuditEvent } from '../../../database/entities/audit-event.entity';
import { User, UserRole } from '../../../database/entities/user.entity';
import { TransitionActionDto, WorkflowActionType } from '../dto/transition-action.dto';

@Injectable()
export class WorkflowStateMachineService {
  private readonly logger = new Logger(WorkflowStateMachineService.name);

  constructor(
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
    @InjectRepository(RequestStageHistory)
    private readonly stageHistoryRepo: Repository<RequestStageHistory>,
    @InjectRepository(AuditEvent)
    private readonly auditEventRepo: Repository<AuditEvent>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Atomically executes a workflow state machine transition action.
   */
  async executeTransition(
    requestId: string,
    actor: User,
    dto: TransitionActionDto,
  ): Promise<Request> {
    return await this.dataSource.transaction(async (manager) => {
      const request = await manager.findOne(Request, {
        where: { id: requestId },
        relations: ['applicant', 'applicant.department', 'workflowTemplate', 'stageHistory'],
        order: {
          stageHistory: {
            stageOrder: 'ASC',
          },
        },
      });

      if (!request) {
        throw new NotFoundException(`Request with ID ${requestId} not found`);
      }

      switch (dto.action) {
        case WorkflowActionType.APPROVE:
          return await this.handleApprove(manager, request, actor, dto);

        case WorkflowActionType.APPROVE_PAYOUT:
          return await this.handleApprovePayout(manager, request, actor, dto);

        case WorkflowActionType.SETTLE:
          return await this.handleSettle(manager, request, actor, dto);

        case WorkflowActionType.REJECT_RETURN:
          return await this.handleRejectReturn(manager, request, actor, dto);

        case WorkflowActionType.RESUBMIT:
          return await this.handleResubmit(manager, request, actor, dto);

        case WorkflowActionType.DIRECT_QUERY:
          return await this.handleDirectQuery(manager, request, actor, dto);

        default:
          throw new BadRequestException(`Unsupported transition action: ${dto.action}`);
      }
    });
  }

  /**
   * Handle APPROVE action.
   */
  private async handleApprove(
    manager: any,
    request: Request,
    actor: User,
    dto: TransitionActionDto,
  ): Promise<Request> {
    if (request.status !== RequestStatus.UNDER_REVIEW) {
      throw new BadRequestException(
        `Cannot approve request in status '${request.status}'. Expected 'UNDER_REVIEW'`,
      );
    }

    const currentStage = this.findActiveStage(request);
    this.verifyActorRole(actor, currentStage.requiredRole);
    this.verifyDepartmentScope(actor, request);

    // Close current stage
    currentStage.actorId = actor.id;
    currentStage.action = StageAction.APPROVED;
    currentStage.completedAt = new Date();
    currentStage.comments = dto.comments || 'Approved by reviewing officer';
    await manager.save(RequestStageHistory, currentStage);

    // Determine next stage
    const nextOrder = currentStage.stageOrder + 1;
    const nextStage = request.stageHistory.find((s) => s.stageOrder === nextOrder);

    if (!nextStage) {
      throw new BadRequestException('No further approval stages defined in workflow template');
    }

    // Open next stage
    nextStage.enteredAt = new Date();
    request.currentStageKey = nextStage.stageKey;
    const savedRequest = await manager.save(Request, request);
    await manager.save(RequestStageHistory, nextStage);

    // Record Audit Event
    await this.recordAuditEvent(manager, request, actor, 'APPROVE', 'UNDER_REVIEW', 'UNDER_REVIEW', {
      approvedStage: currentStage.stageKey,
      nextStage: nextStage.stageKey,
    }, dto.comments);

    this.logger.log(`Request ${request.trackingNumber} advanced from ${currentStage.stageKey} to ${nextStage.stageKey}`);
    return savedRequest;
  }

  /**
   * Handle APPROVE_PAYOUT action (Financial Office -> Assistant Bursar).
   */
  private async handleApprovePayout(
    manager: any,
    request: Request,
    actor: User,
    dto: TransitionActionDto,
  ): Promise<Request> {
    if (request.status !== RequestStatus.UNDER_REVIEW) {
      throw new BadRequestException(`Cannot authorize payout in status '${request.status}'`);
    }

    const currentStage = this.findActiveStage(request);
    if (currentStage.stageKey !== 'FINANCIAL_OFFICE' && actor.role !== UserRole.ADMIN) {
      throw new BadRequestException('Approve Payout action is only valid from the Financial Office stage');
    }

    this.verifyActorRole(actor, UserRole.FINANCIAL_OFFICER);

    currentStage.actorId = actor.id;
    currentStage.action = StageAction.APPROVE_PAYOUT;
    currentStage.completedAt = new Date();
    currentStage.comments = dto.comments || 'Vote allowances verified. Payout authorized to Assistant Bursar.';
    await manager.save(RequestStageHistory, currentStage);

    const nextStage = request.stageHistory.find((s) => s.stageKey === 'ASSISTANT_BURSAR');
    if (!nextStage) {
      throw new BadRequestException('Assistant Bursar settlement stage not found in workflow template');
    }

    nextStage.enteredAt = new Date();
    request.currentStageKey = nextStage.stageKey;
    const savedRequest = await manager.save(Request, request);
    await manager.save(RequestStageHistory, nextStage);

    await this.recordAuditEvent(manager, request, actor, 'APPROVE_PAYOUT', 'UNDER_REVIEW', 'UNDER_REVIEW', {
      fromStage: 'FINANCIAL_OFFICE',
      toStage: 'ASSISTANT_BURSAR',
    }, dto.comments);

    return savedRequest;
  }

  /**
   * Handle SETTLE action (Assistant Bursar final payout).
   */
  private async handleSettle(
    manager: any,
    request: Request,
    actor: User,
    dto: TransitionActionDto,
  ): Promise<Request> {
    const currentStage = this.findActiveStage(request);
    if (currentStage.stageKey !== 'ASSISTANT_BURSAR' && actor.role !== UserRole.ADMIN) {
      throw new BadRequestException('Settle action is only valid from the Assistant Bursar stage');
    }

    this.verifyActorRole(actor, UserRole.ASSISTANT_BURSAR);

    currentStage.actorId = actor.id;
    currentStage.action = StageAction.APPROVED;
    currentStage.completedAt = new Date();
    currentStage.comments = dto.comments || 'Final payment voucher disbursed and settled.';
    await manager.save(RequestStageHistory, currentStage);

    request.status = RequestStatus.SETTLED;
    request.currentStageKey = 'SETTLED';
    const savedRequest = await manager.save(Request, request);

    await this.recordAuditEvent(manager, request, actor, 'SETTLE', 'UNDER_REVIEW', 'SETTLED', {
      totalDisbursed: request.totalAmount,
    }, dto.comments);

    return savedRequest;
  }

  /**
   * Handle REJECT_RETURN action.
   */
  private async handleRejectReturn(
    manager: any,
    request: Request,
    actor: User,
    dto: TransitionActionDto,
  ): Promise<Request> {
    if (request.status !== RequestStatus.UNDER_REVIEW) {
      throw new BadRequestException(`Cannot return request in status '${request.status}'`);
    }

    const currentStage = this.findActiveStage(request);
    this.verifyActorRole(actor, currentStage.requiredRole);
    this.verifyDepartmentScope(actor, request);

    currentStage.actorId = actor.id;
    currentStage.action = StageAction.REJECT_RETURN;
    currentStage.completedAt = new Date();
    currentStage.comments = dto.comments || 'Returned for clarification or correction';
    await manager.save(RequestStageHistory, currentStage);

    request.status = RequestStatus.RETURNED_FOR_CORRECTION;
    request.returningOfficerId = actor.id;

    // Routing destination per SVG specification:
    // HOD returns to Lecturer.
    // Exam Office / Finance Office returns to HOD (or directly to Lecturer if targeted).
    if (currentStage.stageKey === 'HEAD_OF_DEPARTMENT' || dto.targetReturnRole === UserRole.LECTURER) {
      request.currentStageKey = 'LECTURER_CORRECTION';
    } else {
      request.currentStageKey = 'HEAD_OF_DEPARTMENT';
    }

    const savedRequest = await manager.save(Request, request);

    await this.recordAuditEvent(manager, request, actor, 'RETURN', 'UNDER_REVIEW', 'RETURNED_FOR_CORRECTION', {
      returnedFromStage: currentStage.stageKey,
      returnTarget: request.currentStageKey,
      returningOfficerId: actor.id,
    }, dto.comments);

    return savedRequest;
  }

  /**
   * Handle RESUBMIT action (Lecturer resubmits after correction).
   */
  private async handleResubmit(
    manager: any,
    request: Request,
    actor: User,
    dto: TransitionActionDto,
  ): Promise<Request> {
    if (request.applicantId !== actor.id && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException('Only the original applicant can resubmit a returned claim');
    }

    if (request.status !== RequestStatus.RETURNED_FOR_CORRECTION) {
      throw new BadRequestException(`Cannot resubmit request in status '${request.status}'`);
    }

    // Apply corrected form data if provided
    if (dto.updatedFormData) {
      request.formData = {
        ...request.formData,
        ...dto.updatedFormData,
      };
    }

    // Determine routing: route directly back to returning office if set, or HOD
    let targetStageKey = 'HEAD_OF_DEPARTMENT';
    if (request.returningOfficerId) {
      const returningOfficer = await manager.findOne(User, {
        where: { id: request.returningOfficerId },
      });

      if (returningOfficer) {
        if (returningOfficer.role === UserRole.EXAMINATION_OFFICER) {
          targetStageKey = 'EXAMINATION_OFFICE';
        } else if (returningOfficer.role === UserRole.FINANCIAL_OFFICER) {
          targetStageKey = 'FINANCIAL_OFFICE';
        }
      }
    }

    request.status = RequestStatus.UNDER_REVIEW;
    request.currentStageKey = targetStageKey;
    const previousReturningOfficerId = request.returningOfficerId;
    request.returningOfficerId = null;

    // Update the stage in stage history to mark resubmitted
    const targetStage = request.stageHistory.find((s) => s.stageKey === targetStageKey);
    if (targetStage) {
      targetStage.enteredAt = new Date();
      targetStage.action = StageAction.PENDING;
      targetStage.completedAt = null;
      await manager.save(RequestStageHistory, targetStage);
    }

    const savedRequest = await manager.save(Request, request);

    await this.recordAuditEvent(manager, request, actor, 'RESUBMIT', 'RETURNED_FOR_CORRECTION', 'UNDER_REVIEW', {
      resubmittedToStage: targetStageKey,
      previousReturningOfficerId,
    }, dto.comments || 'Corrections applied and claim resubmitted');

    return savedRequest;
  }

  /**
   * Handle DIRECT_QUERY action (direct bi-directional message channel).
   */
  private async handleDirectQuery(
    manager: any,
    request: Request,
    actor: User,
    dto: TransitionActionDto,
  ): Promise<Request> {
    // Record direct communication channel without disrupting active stage
    await this.recordAuditEvent(
      manager,
      request,
      actor,
      'DIRECT_QUERY',
      String(request.status),
      String(request.status),
      {
        channel: `${actor.role} -> ${request.currentStageKey}`,
      },
      dto.comments || 'Direct inquiry recorded',
    );

    return request;
  }

  private findActiveStage(request: Request): RequestStageHistory {
    const stage = request.stageHistory.find((s) => s.stageKey === request.currentStageKey);
    if (!stage) {
      throw new BadRequestException(
        `Current stage '${request.currentStageKey}' does not match any registered workflow stages`,
      );
    }
    return stage;
  }

  private verifyActorRole(actor: User, requiredRole: UserRole) {
    if (actor.role === UserRole.ADMIN) {
      return;
    }
    if (actor.role !== requiredRole) {
      throw new ForbiddenException(
        `Action denied: Required role is '${requiredRole}', but actor has role '${actor.role}'`,
      );
    }
  }

  private verifyDepartmentScope(actor: User, request: Request) {
    if (actor.role === UserRole.HOD) {
      const applicantDeptId = request.applicant?.departmentId;
      const actorDeptId = actor.departmentId;

      if (applicantDeptId && actorDeptId && applicantDeptId !== actorDeptId) {
        throw new ForbiddenException(
          'Department restriction: HOD can only review claims submitted by faculty within their department',
        );
      }
    }
  }

  private async recordAuditEvent(
    manager: any,
    request: Request,
    actor: User,
    actionType: string,
    previousStatus: string,
    newStatus: string,
    fieldDiff: Record<string, any>,
    comment?: string,
  ) {
    const audit = manager.create(AuditEvent, {
      requestId: request.id,
      actorId: actor.id,
      actorName: actor.fullName,
      actorRole: actor.role,
      actionType,
      previousStatus,
      newStatus,
      fieldDiff,
      comment: comment || '',
    });
    await manager.save(AuditEvent, audit);
  }
}
