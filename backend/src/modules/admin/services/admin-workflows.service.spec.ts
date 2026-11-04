import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { AdminWorkflowsService } from './admin-workflows.service';
import { RequestType } from '../../../database/entities/request-type.entity';
import {
  WorkflowStageConfig,
  WorkflowTemplate,
} from '../../../database/entities/workflow-template.entity';
import { Request } from '../../../database/entities/request.entity';
import { UserRole } from '../../../database/entities/user.entity';

describe('AdminWorkflowsService', () => {
  let service: AdminWorkflowsService;
  let requestTypeRepoMock: any;
  let templateRepoMock: any;
  let requestRepoMock: any;

  const mockStages: WorkflowStageConfig[] = [
    {
      order: 0,
      stageKey: 'SUBMISSION',
      stageName: 'Lecturer Submission',
      requiredRole: UserRole.LECTURER,
    },
    {
      order: 1,
      stageKey: 'HEAD_OF_DEPARTMENT',
      stageName: 'HOD Recommendation',
      requiredRole: UserRole.HOD,
      isDepartmentScoped: true,
    },
    {
      order: 2,
      stageKey: 'DEAN',
      stageName: 'Dean Approval',
      requiredRole: UserRole.DEAN,
    },
  ];

  const mockTemplate: WorkflowTemplate = {
    id: 'template-uuid-1',
    requestTypeId: 'rt-uuid-1',
    requestType: {
      id: 'rt-uuid-1',
      code: 'PAPER_MARKING',
      name: 'Paper Setting & Marking Claim',
      description: 'Exam claim',
      isActive: true,
      workflowTemplates: [],
      requests: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    version: 1,
    stages: mockStages,
    isActive: true,
    requests: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRequestType: RequestType = {
    id: 'rt-uuid-1',
    code: 'PAPER_MARKING',
    name: 'Paper Setting & Marking Claim',
    description: 'Exam claim',
    isActive: true,
    workflowTemplates: [mockTemplate],
    requests: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    requestTypeRepoMock = {
      find: jest.fn().mockResolvedValue([mockRequestType]),
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ ...dto, id: 'rt-new-id', createdAt: new Date(), updatedAt: new Date() })),
      save: jest.fn((entity) => Promise.resolve({ ...entity })),
    };

    templateRepoMock = {
      find: jest.fn().mockResolvedValue([mockTemplate]),
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      create: jest.fn((dto) => ({ ...dto, id: 'template-new-id', createdAt: new Date(), updatedAt: new Date() })),
      save: jest.fn((entity) => Promise.resolve({ ...entity })),
    };

    requestRepoMock = {
      count: jest.fn().mockResolvedValue(7),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminWorkflowsService,
        {
          provide: getRepositoryToken(RequestType),
          useValue: requestTypeRepoMock,
        },
        {
          provide: getRepositoryToken(WorkflowTemplate),
          useValue: templateRepoMock,
        },
        {
          provide: getRepositoryToken(Request),
          useValue: requestRepoMock,
        },
      ],
    }).compile();

    service = module.get<AdminWorkflowsService>(AdminWorkflowsService);
  });

  describe('getRequestTypes', () => {
    it('should list all request types with active template metadata', async () => {
      const result = await service.getRequestTypes();

      expect(result).toHaveLength(1);
      expect(result[0].code).toBe('PAPER_MARKING');
      expect(result[0].activeTemplateVersion).toBe(1);
      expect(result[0].totalTemplatesCount).toBe(1);
    });
  });

  describe('getRequestTypeById', () => {
    it('should return request type by ID', async () => {
      requestTypeRepoMock.findOne.mockResolvedValueOnce(mockRequestType);

      const result = await service.getRequestTypeById('rt-uuid-1');

      expect(result.id).toBe('rt-uuid-1');
      expect(result.code).toBe('PAPER_MARKING');
    });

    it('should throw NotFoundException if request type not found', async () => {
      requestTypeRepoMock.findOne.mockResolvedValueOnce(null);

      await expect(service.getRequestTypeById('missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createRequestType', () => {
    it('should create new request type with uppercase code', async () => {
      requestTypeRepoMock.findOne.mockResolvedValueOnce(null);

      const result = await service.createRequestType({
        code: 'travel_grant',
        name: 'Academic Travel Grant',
        description: 'Overseas conference travel assistance',
      });

      expect(requestTypeRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'TRAVEL_GRANT',
          name: 'Academic Travel Grant',
        }),
      );
      expect(requestTypeRepoMock.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if code already exists', async () => {
      requestTypeRepoMock.findOne.mockResolvedValueOnce(mockRequestType);

      await expect(
        service.createRequestType({
          code: 'PAPER_MARKING',
          name: 'Duplicate Type',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getTemplates', () => {
    it('should list templates with active and total claim metrics', async () => {
      const result = await service.getTemplates('rt-uuid-1');

      expect(result).toHaveLength(1);
      expect(result[0].version).toBe(1);
      expect(result[0].stagesCount).toBe(3);
      expect(result[0].activeRequestsCount).toBe(7);
      expect(result[0].totalRequestsCount).toBe(7);
    });
  });

  describe('createTemplate', () => {
    it('should create a new template version and deactivate previous versions', async () => {
      requestTypeRepoMock.findOne.mockResolvedValueOnce(mockRequestType);
      templateRepoMock.findOne
        .mockResolvedValueOnce({ version: 1 }) // latest version query
        .mockResolvedValueOnce({ ...mockTemplate, id: 'template-new-id', version: 2 }); // getTemplateById

      const newStages = [
        { order: 0, stageKey: 'SUBMISSION', stageName: 'Lecturer Submission', requiredRole: UserRole.LECTURER },
        { order: 1, stageKey: 'DEAN', stageName: 'Direct Dean Review', requiredRole: UserRole.DEAN },
      ];

      const result = await service.createTemplate({
        requestTypeId: 'rt-uuid-1',
        stages: newStages,
        isActive: true,
      });

      expect(templateRepoMock.update).toHaveBeenCalledWith(
        { requestTypeId: 'rt-uuid-1' },
        { isActive: false },
      );
      expect(templateRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          requestTypeId: 'rt-uuid-1',
          version: 2,
          isActive: true,
        }),
      );
      expect(result.version).toBe(2);
    });

    it('should reject non-contiguous stage ordering with BadRequestException', async () => {
      requestTypeRepoMock.findOne.mockResolvedValueOnce(mockRequestType);

      const invalidStages = [
        { order: 0, stageKey: 'SUBMISSION', stageName: 'Start', requiredRole: UserRole.LECTURER },
        { order: 2, stageKey: 'FINAL', stageName: 'Jumped Order', requiredRole: UserRole.DEAN }, // missing order 1
      ];

      await expect(
        service.createTemplate({
          requestTypeId: 'rt-uuid-1',
          stages: invalidStages,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject duplicate stageKey with ConflictException', async () => {
      requestTypeRepoMock.findOne.mockResolvedValueOnce(mockRequestType);

      const duplicateKeyStages = [
        { order: 0, stageKey: 'SUBMISSION', stageName: 'Start', requiredRole: UserRole.LECTURER },
        { order: 1, stageKey: 'SUBMISSION', stageName: 'Duplicate Key', requiredRole: UserRole.HOD },
      ];

      await expect(
        service.createTemplate({
          requestTypeId: 'rt-uuid-1',
          stages: duplicateKeyStages,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should reject workflow with fewer than 2 stages', async () => {
      requestTypeRepoMock.findOne.mockResolvedValueOnce(mockRequestType);

      const singleStage = [
        { order: 0, stageKey: 'SUBMISSION', stageName: 'Start', requiredRole: UserRole.LECTURER },
      ];

      await expect(
        service.createTemplate({
          requestTypeId: 'rt-uuid-1',
          stages: singleStage,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateTemplate', () => {
    it('should update stages and toggle active status', async () => {
      templateRepoMock.findOne
        .mockResolvedValueOnce({ ...mockTemplate })
        .mockResolvedValueOnce({ ...mockTemplate, isActive: false });

      const result = await service.updateTemplate(mockTemplate.id, {
        isActive: false,
      });

      expect(templateRepoMock.save).toHaveBeenCalled();
      expect(result.id).toBe(mockTemplate.id);
    });

    it('should throw NotFoundException if template to update does not exist', async () => {
      templateRepoMock.findOne.mockResolvedValueOnce(null);

      await expect(
        service.updateTemplate('unknown-id', { isActive: true }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
