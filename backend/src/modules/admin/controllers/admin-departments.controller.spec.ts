import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AdminDepartmentsController } from './admin-departments.controller';
import {
  AdminDepartmentsService,
  DepartmentDetailItem,
  PaginatedDepartmentsResponse,
} from '../services/admin-departments.service';
import { User, UserRole } from '../../../database/entities/user.entity';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';

describe('AdminDepartmentsController', () => {
  let controller: AdminDepartmentsController;
  let service: jest.Mocked<AdminDepartmentsService>;

  const mockDepartmentDetail: DepartmentDetailItem = {
    id: 'dept-uuid-1',
    code: 'COM',
    name: 'Department of Computer Engineering',
    hod: {
      id: 'hod-uuid-1',
      fullName: 'Prof. K.U. Herath',
      email: 'hod.computer@eng.ruh.ac.lk',
      role: UserRole.HOD,
    } as User,
    staffCount: 15,
    pendingRequestsCount: 4,
    totalRequestsCount: 22,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const serviceMock = {
      getDepartments: jest.fn().mockResolvedValue({
        data: [mockDepartmentDetail],
        meta: { total: 1, page: 1, limit: 20, totalPages: 1 },
      } as PaginatedDepartmentsResponse),
      getDepartmentById: jest.fn().mockResolvedValue(mockDepartmentDetail),
      createDepartment: jest.fn().mockResolvedValue(mockDepartmentDetail),
      updateDepartment: jest.fn().mockResolvedValue(mockDepartmentDetail),
      getDepartmentStaff: jest.fn().mockResolvedValue([mockDepartmentDetail.hod]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminDepartmentsController],
      providers: [
        {
          provide: AdminDepartmentsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<AdminDepartmentsController>(AdminDepartmentsController);
    service = module.get(AdminDepartmentsService);
  });

  it('should enforce ADMIN role restriction on the controller class', () => {
    const reflector = new Reflector();
    const roles = reflector.get<UserRole[]>(ROLES_KEY, AdminDepartmentsController);
    expect(roles).toBeDefined();
    expect(roles).toContain(UserRole.ADMIN);
  });

  it('should delegate getDepartments to service', async () => {
    const query = { page: 1, limit: 10, search: 'computer' };
    const result = await controller.getDepartments(query);

    expect(service.getDepartments).toHaveBeenCalledWith(query);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].code).toBe('COM');
  });

  it('should delegate getDepartmentById to service', async () => {
    const result = await controller.getDepartmentById('dept-uuid-1');

    expect(service.getDepartmentById).toHaveBeenCalledWith('dept-uuid-1');
    expect(result.id).toBe('dept-uuid-1');
    expect(result.totalRequestsCount).toBe(22);
  });

  it('should delegate createDepartment to service', async () => {
    const dto = {
      code: 'DIS',
      name: 'Department of Interdisciplinary Studies',
      hodUserId: 'hod-user-id',
    };
    const result = await controller.createDepartment(dto);

    expect(service.createDepartment).toHaveBeenCalledWith(dto);
    expect(result.id).toBe('dept-uuid-1');
  });

  it('should delegate updateDepartment to service', async () => {
    const dto = { name: 'New Department Name' };
    const result = await controller.updateDepartment('dept-uuid-1', dto);

    expect(service.updateDepartment).toHaveBeenCalledWith('dept-uuid-1', dto);
    expect(result.id).toBe('dept-uuid-1');
  });

  it('should delegate getDepartmentStaff to service', async () => {
    const result = await controller.getDepartmentStaff('dept-uuid-1');

    expect(service.getDepartmentStaff).toHaveBeenCalledWith('dept-uuid-1');
    expect(result).toHaveLength(1);
  });
});
