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
import { RequestType } from '../../../database/entities/request-type.entity';
import { WorkflowTemplate } from '../../../database/entities/workflow-template.entity';
import {
  RequestStageHistory,
  StageAction,
} from '../../../database/entities/request-stage-history.entity';
import { AuditEvent } from '../../../database/entities/audit-event.entity';
import { User, UserRole } from '../../../database/entities/user.entity';
import { FeeCalculationService } from './fee-calculation.service';
import { TrackingNumberService } from './tracking-number.service';
import { CreatePaperMarkingClaimDto } from '../dto/create-paper-marking-claim.dto';
import { SaveDraftClaimDto } from '../dto/save-draft-claim.dto';

@Injectable()
export class PaperMarkingClaimService {
  private readonly logger = new Logger(PaperMarkingClaimService.name);

  constructor(
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
    @InjectRepository(RequestType)
    private readonly requestTypeRepo: Repository<RequestType>,
    @InjectRepository(WorkflowTemplate)
    private readonly workflowTemplateRepo: Repository<WorkflowTemplate>,
    @InjectRepository(RequestStageHistory)
    private readonly stageHistoryRepo: Repository<RequestStageHistory>,
    @InjectRepository(AuditEvent)
    private readonly auditEventRepo: Repository<AuditEvent>,
    private readonly feeCalculationService: FeeCalculationService,
    private readonly trackingNumberService: TrackingNumberService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Save paper setting and marking claim as a draft without triggering the workflow.
   * Supports partial drafts and multi-paper rows.
   */
  async saveDraft(
    user: User,
    dto: SaveDraftClaimDto,
    draftId?: string,
  ): Promise<Request> {
    const feeCalculation = this.feeCalculationService.calculateClaimFees(dto.items, dto.papers);
    const resolvedMetadata = dto.metadata || dto.academic || {};
    const computedItems = dto.items || this.feeCalculationService.aggregateFromPaperRows(dto.papers);

    const formData = {
      personal: dto.personal || {},
      metadata: resolvedMetadata,
      academic: resolvedMetadata,
      papers: dto.papers || [],
      items: computedItems,
      feeCalculation,
      supportingDocuments: dto.supportingDocuments || [],
      declaration: dto.declaration ?? false,
      selectedDocumentCategory: dto.selectedDocumentCategory || 'APPOINTMENT_LETTER',
      comments: dto.comments || '',
    };

    if (draftId) {
      const existing = await this.requestRepo.findOne({
        where: { id: draftId, applicantId: user.id },
      });

      if (!existing) {
        throw new NotFoundException(`Draft claim with ID ${draftId} not found`);
      }

      if (existing.status !== RequestStatus.DRAFT) {
        throw new BadRequestException('Cannot edit a claim that has already been submitted');
      }

      existing.formData = formData;
      existing.totalAmount = feeCalculation.totalAmount;

      return await this.requestRepo.save(existing);
    }

    const { requestType, template } = await this.getPaperMarkingWorkflowContext();
    const trackingNumber = await this.trackingNumberService.generateTrackingNumber();

    const request = this.requestRepo.create({
      trackingNumber,
      requestTypeId: requestType.id,
      workflowTemplateId: template.id,
      applicantId: user.id,
      status: RequestStatus.DRAFT,
      currentStageKey: 'DRAFT',
      totalAmount: feeCalculation.totalAmount,
      formData,
    });

    return await this.requestRepo.save(request);
  }

  /**
   * Validate, calculate, and submit a paper marking claim into the 6-stage review workflow.
   * Accepts structured multiple paper rows and preserves row details in formData.
   */
  async submitClaim(
    user: User,
    dto: CreatePaperMarkingClaimDto,
    draftId?: string,
  ): Promise<Request> {
    const feeCalculation = this.feeCalculationService.calculateClaimFees(dto.items, dto.papers);

    if (feeCalculation.totalAmount <= 0) {
      throw new BadRequestException(
        'Invalid claim: Total claim amount must be greater than zero. Please provide at least one claim item or paper row with positive counts.',
      );
    }

    const resolvedMetadata = dto.metadata || dto.academic;
    if (!resolvedMetadata) {
      throw new BadRequestException('Missing examination metadata or academic information');
    }

    const computedItems = dto.items || this.feeCalculationService.aggregateFromPaperRows(dto.papers);
    const { requestType, template } = await this.getPaperMarkingWorkflowContext();

    return await this.dataSource.transaction(async (manager) => {
      let request: Request;

      if (draftId) {
        request = await manager.findOne(Request, {
          where: { id: draftId, applicantId: user.id },
        });

        if (!request) {
          throw new NotFoundException(`Draft claim with ID ${draftId} not found`);
        }

        if (request.status !== RequestStatus.DRAFT) {
          throw new BadRequestException('This claim has already been submitted to the workflow');
        }
      } else {
        const trackingNumber = await this.trackingNumberService.generateTrackingNumber();
        request = manager.create(Request, {
          trackingNumber,
          requestTypeId: requestType.id,
          workflowTemplateId: template.id,
          applicantId: user.id,
        });
      }

      // Transition to UNDER_REVIEW at Stage 1: HEAD_OF_DEPARTMENT
      const previousStatus = request.status || RequestStatus.DRAFT;
      request.status = RequestStatus.UNDER_REVIEW;
      request.currentStageKey = 'HEAD_OF_DEPARTMENT';
      request.totalAmount = feeCalculation.totalAmount;
      request.formData = {
        personal: dto.personal || {},
        metadata: resolvedMetadata,
        academic: resolvedMetadata,
        papers: dto.papers || [],
        items: computedItems,
        feeCalculation,
        supportingDocuments: dto.supportingDocuments || [],
        declaration: dto.declaration ?? true,
        comments: dto.comments || '',
      };

      const savedRequest = await manager.save(Request, request);

      // Initialize all stages from the template
      const stages = template.stages || [];
      const stageHistories: RequestStageHistory[] = [];

      for (const stg of stages) {
        const isStage0 = stg.order === 0;
        const isStage1 = stg.order === 1;

        const stageRow = manager.create(RequestStageHistory, {
          requestId: savedRequest.id,
          stageKey: stg.stageKey,
          stageName: stg.stageName,
          requiredRole: stg.requiredRole,
          stageOrder: stg.order,
          actorId: isStage0 ? user.id : null,
          action: isStage0 ? StageAction.APPROVED : StageAction.PENDING,
          comments: isStage0 ? dto.comments || 'Claim submitted by applicant' : null,
          enteredAt: isStage0 || isStage1 ? new Date() : null,
          completedAt: isStage0 ? new Date() : null,
        });

        stageHistories.push(stageRow);
      }

      await manager.save(RequestStageHistory, stageHistories);

      // Record immutable Audit Event
      const auditEvent = manager.create(AuditEvent, {
        requestId: savedRequest.id,
        actorId: user.id,
        actorName: user.fullName,
        actorRole: user.role,
        actionType: 'SUBMIT',
        previousStatus: String(previousStatus),
        newStatus: String(savedRequest.status),
        fieldDiff: {
          totalAmount: feeCalculation.totalAmount,
          courseCode: resolvedMetadata.courseCode || 'N/A',
          courseTitle: resolvedMetadata.courseTitle || (dto.papers?.[0]?.title) || 'N/A',
          itemsCount: feeCalculation.items.filter((i) => i.count > 0).length,
          papersCount: dto.papers?.length || 1,
        },
        comment: dto.comments || 'Claim submitted and routed to Head of Department',
      });

      await manager.save(AuditEvent, auditEvent);

      this.logger.log(
        `Claim ${savedRequest.trackingNumber} submitted successfully by ${user.email}. Routed to HOD.`,
      );

      return await manager.findOne(Request, {
        where: { id: savedRequest.id },
        relations: ['applicant', 'stageHistory', 'auditEvents'],
      });
    });
  }

  /**
   * Retrieve claim by ID with access control (IDOR prevention & department scoping).
   */
  async getClaimById(id: string, user: User): Promise<Request> {
    const request = await this.requestRepo.findOne({
      where: { id },
      relations: ['applicant', 'stageHistory', 'auditEvents', 'applicant.department'],
    });

    if (!request) {
      throw new NotFoundException(`Claim with ID ${id} not found`);
    }

    // Role-based access validation
    if (user.role === UserRole.LECTURER && request.applicantId !== user.id) {
      throw new ForbiddenException('Access denied: You can only view your own claims');
    }

    if (user.role === UserRole.HOD) {
      const applicantDeptId = request.applicant?.departmentId;
      const userDeptId = user.departmentId;

      if (applicantDeptId && userDeptId && applicantDeptId !== userDeptId) {
        throw new ForbiddenException(
          'Department access restriction: You can only inspect claims from your department',
        );
      }
    }

    return request;
  }

  /**
   * Helper to retrieve request type and active workflow template.
   */
  private async getPaperMarkingWorkflowContext(): Promise<{
    requestType: RequestType;
    template: WorkflowTemplate;
  }> {
    const requestType = await this.requestTypeRepo.findOne({
      where: { code: 'PAPER_MARKING' },
    });

    if (!requestType) {
      throw new NotFoundException(
        'Paper marking request type not found. Please ensure database seed has completed.',
      );
    }

    const template = await this.workflowTemplateRepo.findOne({
      where: { requestTypeId: requestType.id, isActive: true },
      order: { version: 'DESC' },
    });

    if (!template) {
      throw new NotFoundException(
        'Active workflow template for paper marking not found. Please verify seeding.',
      );
    }

    return { requestType, template };
  }
}
