import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { AdminModulesService } from './admin-modules.service';
import { CourseModule } from '../../../database/entities/course-module.entity';
import { Department } from '../../../database/entities/department.entity';

describe('AdminModulesService', () => {
  let service: AdminModulesService;
  let moduleRepoMock: any;
  let departmentRepoMock: any;

  const mockDepartment: Department = {
    id: 'dept-eie-id',
    code: 'EIE',
    name: 'Department of Electrical and Information Engineering',
    users: [],
    courseModules: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCourseModule: CourseModule = {
    id: 'mod-uuid-1',
    code: 'EC5060',
    name: 'Software Engineering Project',
    prefix: 'EC',
    semester: 5,
    credits: 3,
    departmentId: 'dept-eie-id',
    department: mockDepartment,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockIsModule: CourseModule = {
    id: 'mod-uuid-is',
    code: 'IS5302',
    name: 'Operations Research & Quantitative Methods',
    prefix: 'IS',
    semester: 5,
    credits: 3,
    departmentId: 'dept-is-id',
    department: { id: 'dept-is-id', code: 'IS' } as any,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const qbMock: any = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getManyAndCount: jest.fn().mockResolvedValue([[mockCourseModule], 1]),
      getMany: jest.fn().mockResolvedValue([mockCourseModule, mockIsModule]),
    };

    moduleRepoMock = {
      createQueryBuilder: jest.fn().mockReturnValue(qbMock),
      findOne: jest.fn(),
      create: jest.fn((dto) => ({ ...dto, id: 'new-mod-id', createdAt: new Date(), updatedAt: new Date() })),
      save: jest.fn((entity) => Promise.resolve({ ...entity })),
    };

    departmentRepoMock = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminModulesService,
        {
          provide: getRepositoryToken(CourseModule),
          useValue: moduleRepoMock,
        },
        {
          provide: getRepositoryToken(Department),
          useValue: departmentRepoMock,
        },
      ],
    }).compile();

    service = module.get<AdminModulesService>(AdminModulesService);
  });

  describe('getModules', () => {
    it('should return paginated course modules list', async () => {
      const result = await service.getModules({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].code).toBe('EC5060');
      expect(result.meta.total).toBe(1);
    });

    it('should filter by semester and departmentCode', async () => {
      const qb = moduleRepoMock.createQueryBuilder();
      await service.getModules({ semester: 5, departmentCode: 'EIE', search: 'software' });

      expect(qb.andWhere).toHaveBeenCalledWith('mod.semester = :semester', { semester: 5 });
      expect(qb.andWhere).toHaveBeenCalledWith('LOWER(dept.code) = :deptCode', { deptCode: 'eie' });
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(LOWER(mod.code) LIKE :term OR LOWER(mod.name) LIKE :term)',
        { term: '%software%' },
      );
    });
  });

  describe('getFilteredModulesForClaim', () => {
    it('should filter modules for EIE department including both EE, EC, and IS prefixes for Semester 5', async () => {
      const qb = moduleRepoMock.createQueryBuilder();
      departmentRepoMock.findOne.mockResolvedValueOnce(mockDepartment);

      const result = await service.getFilteredModulesForClaim(5, undefined, 'EIE');

      expect(qb.andWhere).toHaveBeenCalledWith('mod.semester = :semester', { semester: 5 });
      expect(qb.andWhere).toHaveBeenCalledWith(
        '(mod.prefix IN (:...prefixes) OR mod.prefix = :isPrefix)',
        { prefixes: ['EE', 'EC'], isPrefix: 'IS' },
      );
      expect(result).toHaveLength(2);
      expect(result[0].code).toBe('EC5060');
    });

    it('should exclude MENA (MN) modules in common first year semesters (Sem 1 & 2)', async () => {
      const qb = moduleRepoMock.createQueryBuilder();

      await service.getFilteredModulesForClaim(1);

      expect(qb.andWhere).toHaveBeenCalledWith('mod.semester = :semester', { semester: 1 });
      expect(qb.andWhere).toHaveBeenCalledWith('mod.prefix != :menaPrefix', { menaPrefix: 'MN' });
    });
  });

  describe('getModuleById', () => {
    it('should return module by ID', async () => {
      moduleRepoMock.findOne.mockResolvedValueOnce(mockCourseModule);

      const result = await service.getModuleById('mod-uuid-1');

      expect(result.id).toBe('mod-uuid-1');
      expect(result.code).toBe('EC5060');
    });

    it('should throw NotFoundException if module not found', async () => {
      moduleRepoMock.findOne.mockResolvedValueOnce(null);

      await expect(service.getModuleById('missing-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('createModule', () => {
    it('should create course module with auto-parsed semester and credits from code', async () => {
      moduleRepoMock.findOne
        .mockResolvedValueOnce(null) // uniqueness check
        .mockResolvedValueOnce({ ...mockCourseModule, code: 'IS5302', name: 'Operations Research' }); // getModuleById
      departmentRepoMock.findOne.mockResolvedValueOnce(mockDepartment);

      const result = await service.createModule({
        code: 'IS5302',
        name: 'Operations Research',
        departmentId: mockDepartment.id,
      });

      expect(moduleRepoMock.create).toHaveBeenCalledWith(
        expect.objectContaining({
          code: 'IS5302',
          prefix: 'IS',
          semester: 5,
          credits: 3,
        }),
      );
      expect(result.code).toBe('IS5302');
    });

    it('should throw ConflictException if code already exists', async () => {
      moduleRepoMock.findOne.mockResolvedValueOnce(mockCourseModule);

      await expect(
        service.createModule({
          code: 'EC5060',
          name: 'Duplicate Module',
          departmentId: mockDepartment.id,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if department does not exist', async () => {
      moduleRepoMock.findOne.mockResolvedValueOnce(null);
      departmentRepoMock.findOne.mockResolvedValueOnce(null);

      await expect(
        service.createModule({
          code: 'IS5302',
          name: 'Invalid Dept Module',
          departmentId: 'invalid-dept-uuid',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('updateModule', () => {
    it('should update module name and credits', async () => {
      moduleRepoMock.findOne
        .mockResolvedValueOnce({ ...mockCourseModule }) // getModuleById
        .mockResolvedValueOnce({ ...mockCourseModule, credits: 4, name: 'Updated Software Engineering' }); // return

      const result = await service.updateModule(mockCourseModule.id, {
        credits: 4,
        name: 'Updated Software Engineering',
      });

      expect(moduleRepoMock.save).toHaveBeenCalled();
      expect(result.id).toBe(mockCourseModule.id);
    });
  });

  describe('deleteModule', () => {
    it('should deactivate course module', async () => {
      moduleRepoMock.findOne
        .mockResolvedValueOnce({ ...mockCourseModule, isActive: true })
        .mockResolvedValueOnce({ ...mockCourseModule, isActive: false });

      const result = await service.deleteModule(mockCourseModule.id);

      expect(moduleRepoMock.save).toHaveBeenCalledWith(
        expect.objectContaining({ isActive: false }),
      );
      expect(result.message).toContain('deactivated');
    });
  });
});
