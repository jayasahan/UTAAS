import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SeedService, DEFAULT_SEED_PASSWORD } from './seed.service';
import { Department } from '../entities/department.entity';
import { User, UserRole } from '../entities/user.entity';
import { RequestType } from '../entities/request-type.entity';
import { WorkflowTemplate } from '../entities/workflow-template.entity';
import { CourseModule } from '../entities/course-module.entity';

describe('SeedService', () => {
  let service: SeedService;
  let mockDeptRepo: any;
  let mockUserRepo: any;
  let mockRequestTypeRepo: any;
  let mockWorkflowTemplateRepo: any;
  let mockCourseModuleRepo: any;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(async () => {
    mockUserRepo = {
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto),
      createQueryBuilder: jest.fn().mockReturnValue({
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getOne: jest.fn().mockResolvedValue(null),
      }),
    };

    mockDeptRepo = {
      findOne: jest.fn().mockImplementation((query) => {
        const code = query?.where?.code || 'IS';
        return Promise.resolve({ id: `dept-${code}`, code, name: `Dept ${code}` });
      }),
      save: jest.fn().mockImplementation((dto) => Promise.resolve({ id: `dept-${dto.code}`, ...dto })),
      create: jest.fn().mockImplementation((dto) => dto),
    };

    mockRequestTypeRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'req-type-1', code: 'PAPER_MARKING' }),
      save: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto),
    };

    mockWorkflowTemplateRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'wf-1', version: 1 }),
      save: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto),
    };

    mockCourseModuleRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeedService,
        { provide: getRepositoryToken(Department), useValue: mockDeptRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(RequestType), useValue: mockRequestTypeRepo },
        { provide: getRepositoryToken(WorkflowTemplate), useValue: mockWorkflowTemplateRepo },
        { provide: getRepositoryToken(CourseModule), useValue: mockCourseModuleRepo },
      ],
    }).compile();

    service = module.get<SeedService>(SeedService);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should skip seeding default test persona users in production mode (P0 guard)', async () => {
    process.env.NODE_ENV = 'production';
    await service.seedAll();
    expect(mockUserRepo.save).not.toHaveBeenCalled();
  });

  it('should seed default users in development mode', async () => {
    process.env.NODE_ENV = 'development';
    await service.seedAll();
    expect(mockUserRepo.save).toHaveBeenCalled();
    expect(mockCourseModuleRepo.save).toHaveBeenCalled();
  });
});
