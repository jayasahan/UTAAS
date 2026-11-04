import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AdminUsersController } from './admin-users.controller';
import { AdminUsersService } from '../services/admin-users.service';
import { User, UserRole } from '../../../database/entities/user.entity';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';

describe('AdminUsersController', () => {
  let controller: AdminUsersController;
  let service: jest.Mocked<AdminUsersService>;

  const mockAdmin: User = {
    id: 'admin-uuid-1',
    email: 'admin@eng.ruh.ac.lk',
    fullName: 'System Administrator',
    role: UserRole.ADMIN,
    departmentId: null as any,
    department: null as any,
    isActive: true,
    tokenVersion: 0,
    requests: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser: User & { requestsCount: number } = {
    id: 'user-uuid-1',
    email: 'lecturer@eng.ruh.ac.lk',
    fullName: 'Dr. Hansana H.A.J.',
    role: UserRole.LECTURER,
    departmentId: 'dept-uuid-1',
    department: null as any,
    isActive: true,
    tokenVersion: 0,
    requestsCount: 2,
    requests: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const serviceMock = {
      getUsers: jest.fn().mockResolvedValue({
        data: [mockUser],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      }),
      getUserById: jest.fn().mockResolvedValue(mockUser),
      createUser: jest.fn().mockResolvedValue(mockUser),
      updateUser: jest.fn().mockResolvedValue(mockUser),
      toggleUserStatus: jest.fn().mockResolvedValue({
        message: 'User account has been successfully deactivated',
        user: { ...mockUser, isActive: false },
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminUsersController],
      providers: [
        {
          provide: AdminUsersService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<AdminUsersController>(AdminUsersController);
    service = module.get(AdminUsersService);
  });

  it('should have ADMIN role restriction on controller class', () => {
    const reflector = new Reflector();
    const roles = reflector.get<UserRole[]>(ROLES_KEY, AdminUsersController);
    expect(roles).toBeDefined();
    expect(roles).toContain(UserRole.ADMIN);
  });

  it('should delegate getUsers to service', async () => {
    const query = { page: 1, limit: 10, search: 'hansana' };
    const result = await controller.getUsers(query);

    expect(service.getUsers).toHaveBeenCalledWith(query);
    expect(result.data).toHaveLength(1);
  });

  it('should delegate getUserById to service', async () => {
    const result = await controller.getUserById('user-uuid-1');

    expect(service.getUserById).toHaveBeenCalledWith('user-uuid-1');
    expect(result.id).toBe('user-uuid-1');
    expect(result.requestsCount).toBe(2);
  });

  it('should delegate createUser to service', async () => {
    const dto = {
      email: 'new@eng.ruh.ac.lk',
      fullName: 'New Academic',
      role: UserRole.LECTURER,
      departmentId: 'dept-uuid-1',
    };
    const result = await controller.createUser(dto);

    expect(service.createUser).toHaveBeenCalledWith(dto);
    expect(result.id).toBe(mockUser.id);
  });

  it('should delegate updateUser to service', async () => {
    const dto = { fullName: 'Updated Academic' };
    const result = await controller.updateUser('user-uuid-1', dto);

    expect(service.updateUser).toHaveBeenCalledWith('user-uuid-1', dto);
    expect(result.id).toBe(mockUser.id);
  });

  it('should delegate toggleStatus to service with current authenticated admin', async () => {
    const dto = { isActive: false };
    const result = await controller.toggleStatus('user-uuid-1', dto, mockAdmin);

    expect(service.toggleUserStatus).toHaveBeenCalledWith('user-uuid-1', dto, mockAdmin);
    expect(result.message).toContain('deactivated');
  });
});
