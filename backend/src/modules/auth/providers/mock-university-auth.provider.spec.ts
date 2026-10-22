import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { MockUniversityAuthProvider } from './mock-university-auth.provider';
import { User, UserRole } from '../../../database/entities/user.entity';
import { Department } from '../../../database/entities/department.entity';

describe('MockUniversityAuthProvider', () => {
  let provider: MockUniversityAuthProvider;
  let mockUserRepo: any;
  let mockDeptRepo: any;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(async () => {
    process.env.NODE_ENV = 'development';
    mockUserRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: 'new-id', ...entity })),
    };

    mockDeptRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'dept-com', code: 'COM', name: 'Computer Engineering' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MockUniversityAuthProvider,
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Department), useValue: mockDeptRepo },
      ],
    }).compile();

    provider = module.get<MockUniversityAuthProvider>(MockUniversityAuthProvider);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should authenticate existing active university user', async () => {
    const existingUser = {
      id: 'uuid-1',
      email: 'lecturer@eng.ruh.ac.lk',
      isActive: true,
      role: UserRole.LECTURER,
    };
    mockUserRepo.findOne.mockResolvedValue(existingUser);

    const user = await provider.authenticate('lecturer@eng.ruh.ac.lk');
    expect(user).toEqual(existingUser);
  });

  it('should throw UnauthorizedException if user is deactivated', async () => {
    mockUserRepo.findOne.mockResolvedValue({
      id: 'uuid-2',
      email: 'disabled@eng.ruh.ac.lk',
      isActive: false,
    });

    await expect(provider.authenticate('disabled@eng.ruh.ac.lk')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should auto-provision new lecturer if email ends with @eng.ruh.ac.lk in development', async () => {
    mockUserRepo.findOne.mockResolvedValue(null);

    const user = await provider.authenticate('new.lecturer@eng.ruh.ac.lk');
    expect(user.email).toBe('new.lecturer@eng.ruh.ac.lk');
    expect(user.role).toBe(UserRole.LECTURER);
    expect(mockUserRepo.save).toHaveBeenCalled();
  });

  it('should disallow auto-provisioning in production environment', async () => {
    process.env.NODE_ENV = 'production';
    mockUserRepo.findOne.mockResolvedValue(null);

    await expect(provider.authenticate('unregistered@eng.ruh.ac.lk')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockUserRepo.save).not.toHaveBeenCalled();
  });

  it('should reject non-university emails', async () => {
    mockUserRepo.findOne.mockResolvedValue(null);

    await expect(provider.authenticate('outsider@gmail.com')).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('should return seeded test actors list', () => {
    const actors = provider.getTestActors();
    expect(actors.length).toBe(7);
    expect(actors.map((a) => a.role)).toContain(UserRole.LECTURER);
    expect(actors.map((a) => a.role)).toContain(UserRole.HOD);
    expect(actors.map((a) => a.role)).toContain(UserRole.DEAN);
  });
});
