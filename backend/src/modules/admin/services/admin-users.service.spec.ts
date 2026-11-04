import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AdminUsersService } from './admin-users.service';
import { User, UserRole } from '../../../database/entities/user.entity';
import { Department } from '../../../database/entities/department.entity';
import { Request } from '../../../database/entities/request.entity';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let userRepoMock: any;
  let departmentRepoMock: any;
  let requestRepoMock: any;

  const mockDepartment: Department = {
    id: 'dept-uuid-1',
    code: 'COM',
    name: 'Department of Computer Engineering',
    users: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockUser: User = {
    id: 'user-uuid-1',
    email: 'lecturer@eng.ruh.ac.lk',
    fullName: 'Dr. Hansana H.A.J.',
    role: UserRole.LECTURER,
    designation: 'Senior Lecturer',
    departmentId: 'dept-uuid-1',
    department: mockDepartment,
    isActive: true,
    tokenVersion: 0,
    passwordHash: '$2a$10$hashedstring',
    requests: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAdmin: User = {
    id: 'admin-uuid-1',
    email: 'admin@eng.ruh.ac.lk',
    fullName: 'System Administrator',
    role: UserRole.ADMIN,
    departmentId: null as any,
    department: null as any,
    isActive: true,
    tokenVersion: 0,
    passwordHash: '$2a$10$hashedadmin',
    requests: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const qbMock: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockUser], 1]),
    };

    userRepoMock = {
      createQueryBuilder: jest.fn().mockReturnValue(qbMock),
      findOne: jest.fn(),
      count: jest.fn(),
      create: jest.fn((dto) => ({ ...dto, id: 'new-uuid', createdAt: new Date(), updatedAt: new Date() })),
      save: jest.fn((entity) => Promise.resolve({ ...entity })),
    };

    departmentRepoMock = {
      findOne: jest.fn(),
    };

    requestRepoMock = {
      count: jest.fn().mockResolvedValue(3),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        {
          provide: getRepositoryToken(User),
          useValue: userRepoMock,
        },
        {
          provide: getRepositoryToken(Department),
          useValue: departmentRepoMock,
        },
        {
          provide: getRepositoryToken(Request),
          useValue: requestRepoMock,
        },
      ],
    }).compile();

    service = module.get<AdminUsersService>(AdminUsersService);
  });

  describe('getUsers', () => {
    it('should return paginated and sanitized user list', async () => {
      const result = await service.getUsers({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(mockUser.id);
      expect(result.data[0].passwordHash).toBeUndefined();
      expect(result.meta.total).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should apply search, role, department, and active filters', async () => {
      const qb = userRepoMock.createQueryBuilder();
      await service.getUsers({
        search: 'hansana',
        role: UserRole.LECTURER,
        departmentId: 'dept-uuid-1',
        isActive: true,
      });

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(LOWER(user.fullName) LIKE :term OR LOWER(user.email) LIKE :term)',
        { term: '%hansana%' },
      );
      expect(qb.andWhere).toHaveBeenCalledWith('user.role = :role', { role: UserRole.LECTURER });
      expect(qb.andWhere).toHaveBeenCalledWith('user.departmentId = :departmentId', {
        departmentId: 'dept-uuid-1',
      });
      expect(qb.andWhere).toHaveBeenCalledWith('user.isActive = :isActive', { isActive: true });
    });
  });

  describe('getUserById', () => {
    it('should return user with request count and without password hash', async () => {
      userRepoMock.findOne.mockResolvedValueOnce(mockUser);

      const result = await service.getUserById(mockUser.id);

      expect(result.id).toBe(mockUser.id);
      expect(result.passwordHash).toBeUndefined();
      expect(result.requestsCount).toBe(3);
    });

    it('should throw NotFoundException if user not found', async () => {
      userRepoMock.findOne.mockResolvedValueOnce(null);

      await expect(service.getUserById('missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createUser', () => {
    it('should register a new lecturer with valid department and hashed password', async () => {
      userRepoMock.findOne
        .mockResolvedValueOnce(null) // uniqueness check
        .mockResolvedValueOnce({ ...mockUser, id: 'new-uuid' }); // getUserById re-fetch
      departmentRepoMock.findOne.mockResolvedValueOnce(mockDepartment);

      const result = await service.createUser({
        email: 'new.lecturer@eng.ruh.ac.lk',
        fullName: 'Dr. New Academic',
        role: UserRole.LECTURER,
        departmentId: 'dept-uuid-1',
        designation: 'Senior Lecturer',
      });

      expect(result.id).toBe('new-uuid');
      expect(userRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'new.lecturer@eng.ruh.ac.lk',
          role: UserRole.LECTURER,
          departmentId: 'dept-uuid-1',
        }),
      );
      expect(userRepoMock.save).toHaveBeenCalled();
    });

    it('should throw ConflictException if email is already taken', async () => {
      userRepoMock.findOne.mockResolvedValueOnce(mockUser);

      await expect(
        service.createUser({
          email: mockUser.email,
          fullName: 'Duplicate Lecturer',
          role: UserRole.LECTURER,
          departmentId: 'dept-uuid-1',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if department is missing for LECTURER', async () => {
      userRepoMock.findOne.mockResolvedValueOnce(null);

      await expect(
        service.createUser({
          email: 'no.dept@eng.ruh.ac.lk',
          fullName: 'No Department Lecturer',
          role: UserRole.LECTURER,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if department does not exist', async () => {
      userRepoMock.findOne.mockResolvedValueOnce(null);
      departmentRepoMock.findOne.mockResolvedValueOnce(null);

      await expect(
        service.createUser({
          email: 'bad.dept@eng.ruh.ac.lk',
          fullName: 'Bad Dept User',
          role: UserRole.LECTURER,
          departmentId: 'invalid-dept-uuid',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateUser', () => {
    it('should update user fields and invalidate tokenVersion when role changes', async () => {
      const existingUser = { ...mockUser, tokenVersion: 2 };
      userRepoMock.findOne
        .mockResolvedValueOnce(existingUser) // initial find
        .mockResolvedValueOnce({ ...existingUser, role: UserRole.HOD, tokenVersion: 3 }); // getUserById
      departmentRepoMock.findOne.mockResolvedValueOnce(mockDepartment);

      const result = await service.updateUser(mockUser.id, {
        role: UserRole.HOD,
        fullName: 'Prof. Hansana H.A.J.',
      });

      expect(result.role).toBe(UserRole.HOD);
      expect(userRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          role: UserRole.HOD,
          fullName: 'Prof. Hansana H.A.J.',
          tokenVersion: 3,
        }),
      );
    });

    it('should throw ConflictException if updated email belongs to another user', async () => {
      userRepoMock.findOne
        .mockResolvedValueOnce({ ...mockUser, id: 'user-1' })
        .mockResolvedValueOnce({ ...mockUser, id: 'user-2', email: 'taken@eng.ruh.ac.lk' });

      await expect(
        service.updateUser('user-1', {
          email: 'taken@eng.ruh.ac.lk',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if user does not exist', async () => {
      userRepoMock.findOne.mockResolvedValueOnce(null);

      await expect(service.updateUser('unknown-id', { fullName: 'Nobody' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('toggleUserStatus', () => {
    it('should deactivate user and increment tokenVersion to revoke active sessions', async () => {
      const targetUser = { ...mockUser, isActive: true, tokenVersion: 1 };
      userRepoMock.findOne
        .mockResolvedValueOnce(targetUser)
        .mockResolvedValueOnce({ ...targetUser, isActive: false, tokenVersion: 2 });

      const response = await service.toggleUserStatus(
        mockUser.id,
        { isActive: false },
        mockAdmin,
      );

      expect(response.message).toContain('deactivated');
      expect(userRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          isActive: false,
          tokenVersion: 2,
        }),
      );
    });

    it('should prevent an administrator from deactivating their own account', async () => {
      userRepoMock.findOne.mockResolvedValueOnce(mockAdmin);

      await expect(
        service.toggleUserStatus(mockAdmin.id, { isActive: false }, mockAdmin),
      ).rejects.toThrow(BadRequestException);
    });

    it('should prevent deactivation of the last active Administrator account', async () => {
      const otherAdmin: User = { ...mockAdmin, id: 'admin-uuid-2' };
      userRepoMock.findOne.mockResolvedValueOnce(otherAdmin);
      userRepoMock.count.mockResolvedValueOnce(1); // only 1 active admin

      await expect(
        service.toggleUserStatus(otherAdmin.id, { isActive: false }, mockAdmin),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
