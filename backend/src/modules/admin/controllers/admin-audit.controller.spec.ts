import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AdminAuditController } from './admin-audit.controller';
import { AdminAuditService, PaginatedAuditLogsResponse } from '../services/admin-audit.service';
import { UserRole } from '../../../database/entities/user.entity';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';

describe('AdminAuditController', () => {
  let controller: AdminAuditController;
  let service: jest.Mocked<AdminAuditService>;

  const mockEvent: any = {
    id: 'audit-uuid-1',
    requestId: 'req-uuid-1',
    actorName: 'Dr. Hansana H.A.J.',
    actionType: 'SUBMIT',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    const serviceMock = {
      getAuditLogs: jest.fn().mockResolvedValue({
        data: [mockEvent],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      } as PaginatedAuditLogsResponse),
      getAuditLogById: jest.fn().mockResolvedValue(mockEvent),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminAuditController],
      providers: [
        {
          provide: AdminAuditService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<AdminAuditController>(AdminAuditController);
    service = module.get(AdminAuditService);
  });

  it('should enforce ADMIN role restriction on the controller class', () => {
    const reflector = new Reflector();
    const roles = reflector.get<UserRole[]>(ROLES_KEY, AdminAuditController);
    expect(roles).toBeDefined();
    expect(roles).toContain(UserRole.ADMIN);
  });

  it('should delegate getAuditLogs to service', async () => {
    const query = { page: 1, limit: 10, actionType: 'SUBMIT' };
    const result = await controller.getAuditLogs(query);

    expect(service.getAuditLogs).toHaveBeenCalledWith(query);
    expect(result.data).toHaveLength(1);
  });

  it('should delegate getAuditLogById to service', async () => {
    const result = await controller.getAuditLogById('audit-uuid-1');

    expect(service.getAuditLogById).toHaveBeenCalledWith('audit-uuid-1');
    expect(result.id).toBe('audit-uuid-1');
  });
});
