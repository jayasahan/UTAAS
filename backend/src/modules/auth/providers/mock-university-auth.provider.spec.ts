import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { MockUniversityAuthProvider } from './mock-university-auth.provider';
import { User, UserRole } from '../../../database/entities/user.entity';
import { Department } from '../../../database/entities/department.entity';

describe('MockUniversityAuthProvider', () => {
  let provider: MockUniversityAuthProvider;
  let mockUserRepo: any;
  let mockDeptRepo: any;
  const originalEnv = process.env.NODE_ENV;

  const defaultHash = bcrypt.hashSync('Utaas@2026', 10);

  beforeEach(async () => {
    process.env.NODE_ENV = 'development';

    const createQb = (returnedUser: any) => ({
      addSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(returnedUser),
    });

    mockUserRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: 'new-id', ...entity })),
      createQueryBuilder: jest.fn().mockImplementation(() => createQb(null)),
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

  it('should authenticate existing active university user without password in development', async () => {
    const existingUser = {
      id: 'uuid-1',
      email: 'lecturer@eng.ruh.ac.lk',
      isActive: true,
      role: UserRole.LECTURER,
      passwordHash: defaultHash,
    };
    mockUserRepo.createQueryBuilder.mockReturnValue({
      addSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(existingUser),
    });

    const user = await provider.authenticate('lecturer@eng.ruh.ac.lk');
    expect(user.id).toBe(existingUser.id);
  });

  it('should authenticate existing active university user with valid password', async () => {
    const existingUser = {
      id: 'uuid-1',
      email: 'lecturer@eng.ruh.ac.lk',
      isActive: true,
      role: UserRole.LECTURER,
      passwordHash: defaultHash,
    };
    mockUserRepo.createQueryBuilder.mockReturnValue({
      addSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(existingUser),
    });

    const user = await provider.authenticate('lecturer@eng.ruh.ac.lk', 'Utaas@2026');
    expect(user.id).toBe(existingUser.id);
  });

  it('should reject existing user when wrong password is provided', async () => {
    const existingUser = {
      id: 'uuid-1',
      email: 'lecturer@eng.ruh.ac.lk',
      isActive: true,
      role: UserRole.LECTURER,
      passwordHash: defaultHash,
    };
    mockUserRepo.createQueryBuilder.mockReturnValue({
      addSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(existingUser),
    });

    await expect(provider.authenticate('lecturer@eng.ruh.ac.lk', 'WrongPassword123')).rejects.toThrow(
      /Invalid credentials: password does not match/,
    );
  });

  it('should reject password authentication in production if account has no password hash (P0 prevention)', async () => {
    process.env.NODE_ENV = 'production';
    const googleOnlyUser = {
      id: 'uuid-google-only',
      email: 'google.lecturer@eng.ruh.ac.lk',
      isActive: true,
      role: UserRole.LECTURER,
      passwordHash: null,
    };
    mockUserRepo.createQueryBuilder.mockReturnValue({
      addSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(googleOnlyUser),
    });

    await expect(
      provider.authenticate('google.lecturer@eng.ruh.ac.lk', 'AnyNonEmptyPassword'),
    ).rejects.toThrow(/This account does not have password authentication enabled/);
  });

  it('should reject password authentication in development if account has no password hash and password is sent', async () => {
    const googleOnlyUser = {
      id: 'uuid-google-only',
      email: 'google.lecturer@eng.ruh.ac.lk',
      isActive: true,
      role: UserRole.LECTURER,
      passwordHash: null,
    };
    mockUserRepo.createQueryBuilder.mockReturnValue({
      addSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(googleOnlyUser),
    });

    await expect(
      provider.authenticate('google.lecturer@eng.ruh.ac.lk', 'SomePassword'),
    ).rejects.toThrow(/This account does not have password authentication enabled/);
  });

  it('should require password in production environment', async () => {
    process.env.NODE_ENV = 'production';
    const existingUser = {
      id: 'uuid-1',
      email: 'lecturer@eng.ruh.ac.lk',
      isActive: true,
      role: UserRole.LECTURER,
      passwordHash: defaultHash,
    };
    mockUserRepo.createQueryBuilder.mockReturnValue({
      addSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(existingUser),
    });

    await expect(provider.authenticate('lecturer@eng.ruh.ac.lk')).rejects.toThrow(
      /Password is required for production authentication/,
    );
  });

  it('should throw UnauthorizedException if user is deactivated', async () => {
    const disabledUser = {
      id: 'uuid-2',
      email: 'disabled@eng.ruh.ac.lk',
      isActive: false,
    };
    mockUserRepo.createQueryBuilder.mockReturnValue({
      addSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(disabledUser),
    });

    await expect(provider.authenticate('disabled@eng.ruh.ac.lk')).rejects.toThrow(
      /University account has been deactivated/,
    );
  });

  it('should auto-provision new lecturer if email ends with @eng.ruh.ac.lk in development', async () => {
    mockUserRepo.createQueryBuilder.mockReturnValue({
      addSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    });

    const user = await provider.authenticate('new.lecturer@eng.ruh.ac.lk');
    expect(user.email).toBe('new.lecturer@eng.ruh.ac.lk');
    expect(user.role).toBe(UserRole.LECTURER);
    expect(mockUserRepo.save).toHaveBeenCalled();
  });

  it('should disallow auto-provisioning in production environment', async () => {
    process.env.NODE_ENV = 'production';
    mockUserRepo.createQueryBuilder.mockReturnValue({
      addSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    });

    await expect(provider.authenticate('unregistered@eng.ruh.ac.lk', 'somePassword')).rejects.toThrow(
      UnauthorizedException,
    );
    expect(mockUserRepo.save).not.toHaveBeenCalled();
  });

  it('should reject non-university emails', async () => {
    mockUserRepo.createQueryBuilder.mockReturnValue({
      addSelect: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(null),
    });

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
