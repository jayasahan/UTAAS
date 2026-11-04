import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AdminWorkflowsController } from './admin-workflows.controller';
import {
  AdminWorkflowsService,
  RequestTypeListItem,
  WorkflowTemplateListItem,
} from '../services/admin-workflows.service';
import { UserRole } from '../../../database/entities/user.entity';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';

describe('AdminWorkflowsController', () => {
  let controller: AdminWorkflowsController;
  let service: jest.Mocked<AdminWorkflowsService>;

  const mockRequestTypeItem: RequestTypeListItem = {
    id: 'rt-uuid-1',
    code: 'PAPER_MARKING',
    name: 'Paper Setting & Marking Claim',
    description: 'Exam claim',
    isActive: true,
    activeTemplateVersion: 1,
    totalTemplatesCount: 1,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockTemplateItem: WorkflowTemplateListItem = {
    id: 'tpl-uuid-1',
    requestTypeId: 'rt-uuid-1',
    requestTypeName: 'Paper Setting & Marking Claim',
    requestTypeCode: 'PAPER_MARKING',
    version: 1,
    stagesCount: 2,
    stages: [
      { order: 0, stageKey: 'SUBMISSION', stageName: 'Submit', requiredRole: UserRole.LECTURER },
      { order: 1, stageKey: 'DEAN', stageName: 'Dean', requiredRole: UserRole.DEAN },
    ],
    isActive: true,
    activeRequestsCount: 3,
    totalRequestsCount: 8,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const serviceMock = {
      getRequestTypes: jest.fn().mockResolvedValue([mockRequestTypeItem]),
      getRequestTypeById: jest.fn().mockResolvedValue(mockRequestTypeItem),
      createRequestType: jest.fn().mockResolvedValue(mockRequestTypeItem),
      updateRequestType: jest.fn().mockResolvedValue(mockRequestTypeItem),
      getTemplates: jest.fn().mockResolvedValue([mockTemplateItem]),
      getTemplateById: jest.fn().mockResolvedValue(mockTemplateItem),
      createTemplate: jest.fn().mockResolvedValue(mockTemplateItem),
      updateTemplate: jest.fn().mockResolvedValue(mockTemplateItem),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminWorkflowsController],
      providers: [
        {
          provide: AdminWorkflowsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<AdminWorkflowsController>(AdminWorkflowsController);
    service = module.get(AdminWorkflowsService);
  });

  it('should enforce ADMIN role restriction on the controller class', () => {
    const reflector = new Reflector();
    const roles = reflector.get<UserRole[]>(ROLES_KEY, AdminWorkflowsController);
    expect(roles).toBeDefined();
    expect(roles).toContain(UserRole.ADMIN);
  });

  it('should delegate getRequestTypes to service', async () => {
    const result = await controller.getRequestTypes();

    expect(service.getRequestTypes).toHaveBeenCalled();
    expect(result).toHaveLength(1);
    expect(result[0].code).toBe('PAPER_MARKING');
  });

  it('should delegate getRequestTypeById to service', async () => {
    const result = await controller.getRequestTypeById('rt-uuid-1');

    expect(service.getRequestTypeById).toHaveBeenCalledWith('rt-uuid-1');
    expect(result.id).toBe('rt-uuid-1');
  });

  it('should delegate createRequestType to service', async () => {
    const dto = { code: 'NEW_TYPE', name: 'New Request Type' };
    const result = await controller.createRequestType(dto);

    expect(service.createRequestType).toHaveBeenCalledWith(dto);
    expect(result.id).toBe('rt-uuid-1');
  });

  it('should delegate updateRequestType to service', async () => {
    const dto = { name: 'Updated Type Name' };
    const result = await controller.updateRequestType('rt-uuid-1', dto);

    expect(service.updateRequestType).toHaveBeenCalledWith('rt-uuid-1', dto);
    expect(result.id).toBe('rt-uuid-1');
  });

  it('should delegate getTemplates to service', async () => {
    const result = await controller.getTemplates('rt-uuid-1');

    expect(service.getTemplates).toHaveBeenCalledWith('rt-uuid-1');
    expect(result).toHaveLength(1);
    expect(result[0].version).toBe(1);
  });

  it('should delegate getTemplateById to service', async () => {
    const result = await controller.getTemplateById('tpl-uuid-1');

    expect(service.getTemplateById).toHaveBeenCalledWith('tpl-uuid-1');
    expect(result.id).toBe('tpl-uuid-1');
  });

  it('should delegate createTemplate to service', async () => {
    const dto = {
      requestTypeId: 'rt-uuid-1',
      stages: mockTemplateItem.stages,
    };
    const result = await controller.createTemplate(dto);

    expect(service.createTemplate).toHaveBeenCalledWith(dto);
    expect(result.id).toBe('tpl-uuid-1');
  });

  it('should delegate updateTemplate to service', async () => {
    const dto = { isActive: false };
    const result = await controller.updateTemplate('tpl-uuid-1', dto);

    expect(service.updateTemplate).toHaveBeenCalledWith('tpl-uuid-1', dto);
    expect(result.id).toBe('tpl-uuid-1');
  });
});
