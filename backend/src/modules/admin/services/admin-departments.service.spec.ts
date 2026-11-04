import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { AdminDepartmentsService } from './admin-departments.service';
import { Department } from '../../../database/entities/department.entity';
import { User, UserRole } from '../../../database/entities/user.entity';
import { Request } from '../../../database/entities/request.entity';

describe('AdminDepartmentsService', () => {
  let service: AdminDepartmentsService;
  let departmentRepoMock: any;
  let userRepoMock: any;
  let requestRepoMock: any;

  const mockDept: Department = {
    id: 'dept-uuid-1',
    code: 'COM',
    name: 'Department of Computer Engineering',
    users: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockHod: User = {
    id: 'hod-uuid-1',
    email: 'hod.computer@eng.ruh.ac.lk',
    fullName: 'Prof. K.U. Herath',
    role: UserRole.HOD,
    departmentId: 'dept-uuid-1',
    department: mockDept,
    isActive: true,
    tokenVersion: 1,
    passwordHash: '$2a$10$hashedstring',
    requests: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockLecturer: User = {
    id: 'lecturer-uuid-1',
    email: 'lecturer@eng.ruh.ac.lk',
    fullName: 'Dr. Hansana H.A.J.',
    role: UserRole.LECTURER,
    departmentId: 'dept-uuid-1',
    department: mockDept,
    isActive: true,
    tokenVersion: 0,
    passwordHash: '$2a$10$hashedstring2',
    requests: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const deptQbMock: any = {
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockDept], 1]),
    };

    const reqQbMock: any = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(5),
    };

    departmentRepoMock = {
      createQueryBuilder: jest.fn().mockReturnValue(deptQbMock),
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ ...dto, id: 'new-dept-id', createdAt: new Date(), updatedAt: new Date() })),
      save: jest.fn((entity) => Promise.resolve({ ...entity })),
    };

    userRepoMock = {
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([mockHod, mockLecturer]),
      count: jest.fn().mockResolvedValue(12),
      save: jest.fn((entity) => Promise.resolve({ ...entity })),
    };

    requestRepoMock = {
      createQueryBuilder: jest.fn().mockReturnValue(reqQbMock),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminDepartmentsService,
        {
          provide: getRepositoryToken(Department),
          useValue: departmentRepoMock,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepoMock,
        },
        {
          provide: getRepositoryToken(Request),
          useValue: requestRepoMock,
        },
      ],
    }).compile();

    service = module.get<AdminDepartmentsService>(AdminDepartmentsService);
  });

  describe('getDepartments', () => {
    it('should return enriched department list with HOD, staff count, and pending requests', async () => {
      userRepoMock.findOne.mockResolvedValueOnce(mockHod);

      const result = await service.getDepartments({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].code).toBe('COM');
      expect(result.data[0].hod?.id).toBe(mockHod.id);
      expect(result.data[0].hod?.passwordHash).toBeUndefined();
      expect(result.data[0].staffCount).toBe(12);
      expect(result.data[0].pendingRequestsCount).toBe(5);
    });

    it('should filter departments by search term', async () => {
      const qb = departmentRepoMock.createQueryBuilder();
      await service.getDepartments({ search: 'computer' });

      expect(qb.andWhere).toHaveBeenCalledWith(
        '(LOWER(dept.code) LIKE :term OR LOWER(dept.name) LIKE :term)',
        { term: '%computer%' },
      );
    });
  });

  describe('getDepartmentById', () => {
    it('should return department profile with total and pending requests count', async () => {
      departmentRepoMock.findOne.mockResolvedValueOnce(mockDept);
      userRepoMock.findOne.mockResolvedValueOnce(mockHod);

      const result = await service.getDepartmentById('dept-uuid-1');

      expect(result.code).toBe('COM');
      expect(result.totalRequestsCount).toBe(5);
      expect(result.staffCount).toBe(12);
    });

    it('should throw NotFoundException if department does not exist', async () => {
      departmentRepoMock.findOne.mockResolvedValueOnce(null);

      await expect(service.getDepartmentById('unknown-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createDepartment', () => {
    it('should create new department and appoint initial HOD if hodUserId provided', async () => {
      departmentRepoMock.findOne
        .mockResolvedValueOnce(null) // uniqueness check
        .mockResolvedValueOnce({ ...mockDept, id: 'new-dept-id', code: 'DIS' }); // getDepartmentById
      userRepoMock.findOne
        .mockResolvedValueOnce(mockLecturer) // find candidate user
        .mockResolvedValueOnce({ ...mockLecturer, role: UserRole.HOD, departmentId: 'new-dept-id' }); // enrich HOD

      const result = await service.createDepartment({
        code: 'DIS',
        name: 'Department of Interdisciplinary Studies',
        hodUserId: mockLecturer.id,
      });

      expect(departmentRepoMock.save).toHaveBeenCalled();
      expect(userRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          role: UserRole.HOD,
          departmentId: 'new-dept-id',
          tokenVersion: 1,
        }),
      );
      expect(result.id).toBe('new-dept-id');
    });

    it('should throw ConflictException if department code already exists', async () => {
      departmentRepoMock.findOne.mockResolvedValueOnce(mockDept);

      await expect(
        service.createDepartment({
          code: 'COM',
          name: 'Duplicate Computer Dept',
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if initial hodUserId does not exist', async () => {
      departmentRepoMock.findOne.mockResolvedValueOnce(null);
      userRepoMock.findOne.mockResolvedValueOnce(null);

      await expect(
        service.createDepartment({
          code: 'DIS',
          name: 'Interdisciplinary',
          hodUserId: 'missing-user-id',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateDepartment', () => {
    it('should update department details and reassign HOD, demoting former HOD', async () => {
      const formerHod = { ...mockHod, tokenVersion: 2 };
      const newHodCandidate = { ...mockLecturer, tokenVersion: 0 };

      departmentRepoMock.findOne
        .mockResolvedValueOnce(mockDept) // initial find
        .mockResolvedValueOnce({ ...mockDept, name: 'Renamed Department' }); // getDepartmentById
      userRepoMock.find.mockResolvedValueOnce([formerHod]); // current HODs
      userRepoMock.findOne.mockResolvedValueOnce(newHodCandidate); // candidate user

      await service.updateDepartment(mockDept.id, {
        name: 'Renamed Department',
        hodUserId: newHodCandidate.id,
      });

      // Former HOD demoted to LECTURER with invalidated token
      expect(userRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: formerHod.id,
          role: UserRole.LECTURER,
          tokenVersion: 3,
        }),
      );

      // New candidate appointed as HOD with invalidated token
      expect(userRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: newHodCandidate.id,
          role: UserRole.HOD,
          tokenVersion: 1,
        }),
      );
    });

    it('should unassign HOD when hodUserId is null', async () => {
      const activeHod = { ...mockHod, tokenVersion: 4 };

      departmentRepoMock.findOne
        .mockResolvedValueOnce(mockDept)
        .mockResolvedValueOnce(mockDept);
      userRepoMock.find.mockResolvedValueOnce([activeHod]);

      await service.updateDepartment(mockDept.id, { hodUserId: null });

      expect(userRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({
          id: activeHod.id,
          role: UserRole.LECTURER,
          tokenVersion: 5,
        }),
      );
    });

    it('should throw ConflictException if new code belongs to another department', async () => {
      departmentRepoMock.findOne
        .mockResolvedValueOnce(mockDept)
        .mockResolvedValueOnce({ ...mockDept, id: 'different-dept-id', code: 'CIV' });

      await expect(
        service.updateDepartment(mockDept.id, { code: 'CIV' }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('getDepartmentStaff', () => {
    it('should return sanitized staff members affiliated with the department', async () => {
      departmentRepoMock.findOne.mockResolvedValueOnce(mockDept);

      const staff = await service.getDepartmentStaff(mockDept.id);

      expect(staff).toHaveLength(2);
      expect(staff[0].passwordHash).toBeUndefined();
      expect(staff[1].passwordHash).toBeUndefined();
    });

    it('should throw NotFoundException if department does not exist', async () => {
      departmentRepoMock.findOne.mockResolvedValueOnce(null);

      await expect(service.getDepartmentStaff('missing-id')).rejects.toThrow(NotFoundException);
    });
  });
});
