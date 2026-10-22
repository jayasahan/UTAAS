import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { SeedService } from './seed.service';
import { Department } from '../entities/department.entity';
import { User } from '../entities/user.entity';
import { RequestType } from '../entities/request-type.entity';
import { WorkflowTemplate } from '../entities/workflow-template.entity';

describe('SeedService', () => {
  let service: SeedService;
  let mockUserRepo: any;
  let mockDeptRepo: any;
  let mockRequestTypeRepo: any;
  let mockWorkflowTemplateRepo: any;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(async () => {
    process.env.NODE_ENV = 'development';

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
      findOne: jest.fn().mockResolvedValue({ id: 'dept-com', code: 'COM', name: 'Computer' }),
      save: jest.fn(),
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

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SeedService,
        { provide: getRepositoryToken(Department), useValue: mockDeptRepo },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(RequestType), useValue: mockRequestTypeRepo },
        { provide: getRepositoryToken(WorkflowTemplate), useValue: mockWorkflowTemplateRepo },
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

    // In production, userRepo save/create should not be called
    expect(mockUserRepo.save).not.toHaveBeenCalled();
    expect(mockUserRepo.create).not.toHaveBeenCalled();
  });

  it('should seed default users in development mode', async () => {
    process.env.NODE_ENV = 'development';

    await service.seedAll();

    expect(mockUserRepo.save).toHaveBeenCalled();
  });
});
