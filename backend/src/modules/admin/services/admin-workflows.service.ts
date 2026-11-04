import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { RequestType } from '../../../database/entities/request-type.entity';
import {
  WorkflowStageConfig,
  WorkflowTemplate,
} from '../../../database/entities/workflow-template.entity';
import { Request, RequestStatus } from '../../../database/entities/request.entity';
import { CreateRequestTypeDto } from '../dto/create-request-type.dto';
import { UpdateRequestTypeDto } from '../dto/update-request-type.dto';
import { CreateWorkflowTemplateDto } from '../dto/create-workflow-template.dto';
import { UpdateWorkflowTemplateDto } from '../dto/update-workflow-template.dto';
import { WorkflowStageConfigDto } from '../dto/workflow-stage-config.dto';

export interface RequestTypeListItem {
  id: string;
  code: string;
  name: string;
  description: string;
  isActive: boolean;
  activeTemplateVersion: number | null;
  totalTemplatesCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowTemplateListItem {
  id: string;
  requestTypeId: string;
  requestTypeName: string;
  requestTypeCode: string;
  version: number;
  stagesCount: number;
  stages: WorkflowStageConfig[];
  isActive: boolean;
  activeRequestsCount: number;
  totalRequestsCount: number;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class AdminWorkflowsService {
  constructor(
    @InjectRepository(RequestType)
    private readonly requestTypeRepo: Repository<RequestType>,
    @InjectRepository(WorkflowTemplate)
    private readonly templateRepo: Repository<WorkflowTemplate>,
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
  ) {}

  /**
   * List all request types with active template metadata.
   */
  async getRequestTypes(): Promise<RequestTypeListItem[]> {
    const types = await this.requestTypeRepo.find({
      relations: ['workflowTemplates'],
      order: { code: 'ASC' },
    });

    return types.map((rt) => {
      const activeTemplate = rt.workflowTemplates?.find((wt) => wt.isActive);
      return {
        id: rt.id,
        code: rt.code,
        name: rt.name,
        description: rt.description,
        isActive: rt.isActive,
        activeTemplateVersion: activeTemplate ? activeTemplate.version : null,
        totalTemplatesCount: rt.workflowTemplates?.length || 0,
        createdAt: rt.createdAt,
        updatedAt: rt.updatedAt,
      };
    });
  }

  /**
   * Get request type by ID with its workflow templates.
   */
  async getRequestTypeById(id: string): Promise<RequestType> {
    const requestType = await this.requestTypeRepo.findOne({
      where: { id },
      relations: ['workflowTemplates'],
    });

    if (!requestType) {
      throw new NotFoundException(`RequestType with ID "${id}" not found`);
    }

    return requestType;
  }

  /**
   * Create a new request type definition.
   */
  async createRequestType(dto: CreateRequestTypeDto): Promise<RequestType> {
    const code = dto.code.trim().toUpperCase();

    const existing = await this.requestTypeRepo.findOne({ where: { code } });
    if (existing) {
      throw new ConflictException(`RequestType with code "${code}" already exists`);
    }

    const newType = this.requestTypeRepo.create({
      code,
      name: dto.name.trim(),
      description: dto.description?.trim() || '',
      isActive: dto.isActive !== undefined ? dto.isActive : true,
    });

    return this.requestTypeRepo.save(newType);
  }

  /**
   * Update request type details.
   */
  async updateRequestType(id: string, dto: UpdateRequestTypeDto): Promise<RequestType> {
    const requestType = await this.getRequestTypeById(id);

    if (dto.name) {
      requestType.name = dto.name.trim();
    }
    if (dto.description !== undefined) {
      requestType.description = dto.description.trim();
    }
    if (dto.isActive !== undefined) {
      requestType.isActive = dto.isActive;
    }

    return this.requestTypeRepo.save(requestType);
  }

  /**
   * List workflow templates with stage counts and active claim metrics.
   */
  async getTemplates(requestTypeId?: string): Promise<WorkflowTemplateListItem[]> {
    const where: any = {};
    if (requestTypeId) {
      where.requestTypeId = requestTypeId;
    }

    const templates = await this.templateRepo.find({
      where,
      relations: ['requestType'],
      order: { createdAt: 'DESC' },
    });

    return Promise.all(templates.map((tpl) => this.enrichTemplate(tpl)));
  }

  /**
   * Get single workflow template by ID.
   */
  async getTemplateById(id: string): Promise<WorkflowTemplateListItem> {
    const template = await this.templateRepo.findOne({
      where: { id },
      relations: ['requestType'],
    });

    if (!template) {
      throw new NotFoundException(`WorkflowTemplate with ID "${id}" not found`);
    }

    return this.enrichTemplate(template);
  }

  /**
   * Create a new workflow template version with verified stages.
   */
  async createTemplate(dto: CreateWorkflowTemplateDto): Promise<WorkflowTemplateListItem> {
    const requestType = await this.requestTypeRepo.findOne({ where: { id: dto.requestTypeId } });
    if (!requestType) {
      throw new NotFoundException(`RequestType with ID "${dto.requestTypeId}" not found`);
    }

    this.validateStages(dto.stages);

    // Calculate next version number for this request type
    const latestTemplate = await this.templateRepo.findOne({
      where: { requestTypeId: dto.requestTypeId },
      order: { version: 'DESC' },
    });
    const nextVersion = (latestTemplate?.version || 0) + 1;

    const isActive = dto.isActive !== undefined ? dto.isActive : true;

    // If activating new template, deactivate prior versions
    if (isActive) {
      await this.templateRepo.update({ requestTypeId: dto.requestTypeId }, { isActive: false });
    }

    const newTemplate = this.templateRepo.create({
      requestTypeId: dto.requestTypeId,
      version: nextVersion,
      stages: dto.stages,
      isActive,
    });

    const saved = await this.templateRepo.save(newTemplate);
    return this.getTemplateById(saved.id);
  }

  /**
   * Update stages or active status of a workflow template.
   */
  async updateTemplate(id: string, dto: UpdateWorkflowTemplateDto): Promise<WorkflowTemplateListItem> {
    const template = await this.templateRepo.findOne({
      where: { id },
      relations: ['requestType'],
    });

    if (!template) {
      throw new NotFoundException(`WorkflowTemplate with ID "${id}" not found`);
    }

    if (dto.stages) {
      this.validateStages(dto.stages);
      template.stages = dto.stages;
    }

    if (dto.isActive !== undefined) {
      if (dto.isActive && !template.isActive) {
        // Deactivate other templates for the same request type
        await this.templateRepo.update(
          { requestTypeId: template.requestTypeId },
          { isActive: false },
        );
      }
      template.isActive = dto.isActive;
    }

    await this.templateRepo.save(template);
    return this.getTemplateById(id);
  }

  /**
   * Validates contiguous sequential stage ordering, non-empty and unique stage keys.
   */
  validateStages(stages: WorkflowStageConfigDto[]): void {
    if (!stages || stages.length < 2) {
      throw new BadRequestException('A workflow must have at least 2 stages');
    }

    // Sort stages by order
    const sorted = [...stages].sort((a, b) => a.order - b.order);

    if (sorted[0].order !== 0) {
      throw new BadRequestException('Workflow stages must start with order 0');
    }

    const seenKeys = new Set<string>();

    for (let i = 0; i < sorted.length; i++) {
      const stage = sorted[i];

      if (stage.order !== i) {
        throw new BadRequestException(
          `Workflow stage ordering must be contiguous. Expected order ${i}, found ${stage.order}`,
        );
      }

      if (!stage.stageKey || !stage.stageKey.trim()) {
        throw new BadRequestException(`Stage at order ${i} has an empty stageKey`);
      }

      const key = stage.stageKey.trim();
      if (seenKeys.has(key)) {
        throw new ConflictException(`Duplicate stageKey "${key}" found in workflow stages`);
      }
      seenKeys.add(key);

      if (!stage.requiredRole) {
        throw new BadRequestException(`Stage "${key}" must specify a valid requiredRole`);
      }
    }
  }

  private async enrichTemplate(template: WorkflowTemplate): Promise<WorkflowTemplateListItem> {
    const inFlightStatuses = [
      RequestStatus.SUBMITTED,
      RequestStatus.UNDER_REVIEW,
      RequestStatus.RETURNED_FOR_CORRECTION,
    ];

    const [activeRequestsCount, totalRequestsCount] = await Promise.all([
      this.requestRepo.count({
        where: {
          workflowTemplateId: template.id,
          status: In(inFlightStatuses),
        },
      }),
      this.requestRepo.count({
        where: { workflowTemplateId: template.id },
      }),
    ]);

    return {
      id: template.id,
      requestTypeId: template.requestTypeId,
      requestTypeName: template.requestType?.name || '',
      requestTypeCode: template.requestType?.code || '',
      version: template.version,
      stagesCount: template.stages?.length || 0,
      stages: template.stages || [],
      isActive: template.isActive,
      activeRequestsCount,
      totalRequestsCount,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    };
  }
}
