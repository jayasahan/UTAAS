import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { User, UserRole } from '../../../database/entities/user.entity';

describe('JwtStrategy', () => {
  let strategy: JwtStrategy;
  let mockUserRepo: any;
  let mockConfigService: any;

  const activeUser = {
    id: 'user-id-1',
    email: 'lecturer@eng.ruh.ac.lk',
    role: UserRole.LECTURER,
    isActive: true,
    tokenVersion: 1,
    department: { id: 'dept-com', code: 'COM' },
  } as User;

  beforeEach(async () => {
    mockUserRepo = {
      findOne: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'NODE_ENV') return 'development';
        if (key === 'JWT_SECRET') return 'utaas-secure-jwt-secret-key-2026';
        return defaultValue;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JwtStrategy,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
      ],
    }).compile();

    strategy = module.get<JwtStrategy>(JwtStrategy);
  });

  it('should be defined', () => {
    expect(strategy).toBeDefined();
  });

  it('should validate and return active user when tokenVersion matches', async () => {
    mockUserRepo.findOne.mockResolvedValue(activeUser);

    const payload = {
      sub: activeUser.id,
      email: activeUser.email,
      role: activeUser.role,
      tokenVersion: 1,
    };

    const result = await strategy.validate(payload as any);
    expect(result).toEqual(activeUser);
  });

  it('should reject token when tokenVersion does not match (session was revoked)', async () => {
    mockUserRepo.findOne.mockResolvedValue(activeUser); // user.tokenVersion is 1

    const oldPayload = {
      sub: activeUser.id,
      email: activeUser.email,
      role: activeUser.role,
      tokenVersion: 0, // Old revoked token
    };

    await expect(strategy.validate(oldPayload as any)).rejects.toThrow(
      /Token has been revoked upon logout/,
    );
  });

  it('should reject when user is deactivated', async () => {
    mockUserRepo.findOne.mockResolvedValue({
      ...activeUser,
      isActive: false,
    });

    const payload = {
      sub: activeUser.id,
      email: activeUser.email,
      role: activeUser.role,
      tokenVersion: 1,
    };

    await expect(strategy.validate(payload as any)).rejects.toThrow(
      /User account is invalid or deactivated/,
    );
  });

  it('should reject when user does not exist in database', async () => {
    mockUserRepo.findOne.mockResolvedValue(null);

    const payload = {
      sub: 'non-existent-user-id',
      email: 'ghost@eng.ruh.ac.lk',
      role: UserRole.LECTURER,
    };

    await expect(strategy.validate(payload as any)).rejects.toThrow(
      /User account is invalid or deactivated/,
    );
  });
});
