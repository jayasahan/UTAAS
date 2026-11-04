import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AdminModulesController } from './admin-modules.controller';
import { AdminModulesService, PaginatedModulesResponse } from '../services/admin-modules.service';
import { UserRole } from '../../../database/entities/user.entity';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';

describe('AdminModulesController', () => {
  let controller: AdminModulesController;
  let service: jest.Mocked<AdminModulesService>;

  const mockModule: any = {
    id: 'mod-uuid-1',
    code: 'EC5060',
    name: 'Software Engineering Project',
    prefix: 'EC',
    semester: 5,
    credits: 3,
    isActive: true,
  };

  beforeEach(async () => {
    const serviceMock = {
      getModules: jest.fn().mockResolvedValue({
        data: [mockModule],
        meta: { total: 1, page: 1, limit: 50, totalPages: 1 },
      } as PaginatedModulesResponse),
      getModuleById: jest.fn().mockResolvedValue(mockModule),
      createModule: jest.fn().mockResolvedValue(mockModule),
      updateModule: jest.fn().mockResolvedValue(mockModule),
      deleteModule: jest.fn().mockResolvedValue({ message: 'Course module deactivated successfully' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminModulesController],
      providers: [
        {
          provide: AdminModulesService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<AdminModulesController>(AdminModulesController);
    service = module.get(AdminModulesService);
  });

  it('should enforce ADMIN role restriction on the controller class', () => {
    const reflector = new Reflector();
    const roles = reflector.get<UserRole[]>(ROLES_KEY, AdminModulesController);
    expect(roles).toBeDefined();
    expect(roles).toContain(UserRole.ADMIN);
  });

  it('should delegate getModules to service', async () => {
    const query = { semester: 5, search: 'software' };
    const result = await controller.getModules(query);

    expect(service.getModules).toHaveBeenCalledWith(query);
    expect(result.data).toHaveLength(1);
  });

  it('should delegate getModuleById to service', async () => {
    const result = await controller.getModuleById('mod-uuid-1');

    expect(service.getModuleById).toHaveBeenCalledWith('mod-uuid-1');
    expect(result.id).toBe('mod-uuid-1');
  });

  it('should delegate createModule to service', async () => {
    const dto = {
      code: 'IS5302',
      name: 'Operations Research',
      departmentId: 'dept-is-id',
    };
    const result = await controller.createModule(dto);

    expect(service.createModule).toHaveBeenCalledWith(dto);
    expect(result.id).toBe('mod-uuid-1');
  });

  it('should delegate updateModule to service', async () => {
    const dto = { name: 'Updated Title' };
    const result = await controller.updateModule('mod-uuid-1', dto);

    expect(service.updateModule).toHaveBeenCalledWith('mod-uuid-1', dto);
    expect(result.id).toBe('mod-uuid-1');
  });

  it('should delegate deleteModule to service', async () => {
    const result = await controller.deleteModule('mod-uuid-1');

    expect(service.deleteModule).toHaveBeenCalledWith('mod-uuid-1');
    expect(result.message).toContain('deactivated');
  });
});
