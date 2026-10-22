import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { GoogleAuthService } from './google-auth.service';
import { User, UserRole } from '../../../database/entities/user.entity';
import { Department } from '../../../database/entities/department.entity';

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;
  let mockUserRepo: any;
  let mockDeptRepo: any;
  let mockConfigService: any;
  let mockOAuthClient: any;

  beforeEach(async () => {
    mockUserRepo = {
      findOne: jest.fn(),
      create: jest.fn().mockImplementation((dto) => dto),
      save: jest.fn().mockImplementation((entity) => Promise.resolve({ id: 'user-google-1', ...entity })),
    };

    mockDeptRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'dept-com', code: 'COM', name: 'Computer Engineering' }),
    };

    mockConfigService = {
      get: jest.fn().mockReturnValue('mock-google-client-id.apps.googleusercontent.com'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleAuthService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
        { provide: getRepositoryToken(Department), useValue: mockDeptRepo },
      ],
    }).compile();

    service = module.get<GoogleAuthService>(GoogleAuthService);

    mockOAuthClient = {
      verifyIdToken: jest.fn(),
    };
    (service as any).oauthClient = mockOAuthClient;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should throw if idToken is empty or invalid string', async () => {
    await expect(service.verifyAndAuthenticate('')).rejects.toThrow(UnauthorizedException);
  });

  it('should throw if verifyIdToken fails', async () => {
    mockOAuthClient.verifyIdToken.mockRejectedValue(new Error('Invalid token signature'));

    await expect(service.verifyAndAuthenticate('invalid-token')).rejects.toThrow(
      /Invalid Google ID token/,
    );
  });

  it('should throw if email is not verified by Google', async () => {
    mockOAuthClient.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'lecturer@eng.ruh.ac.lk',
        email_verified: false,
      }),
    });

    await expect(service.verifyAndAuthenticate('valid-token')).rejects.toThrow(
      /Google account email is not verified/,
    );
  });

  it('should throw if email is not an authorized university domain', async () => {
    mockOAuthClient.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'someone@gmail.com',
        email_verified: true,
      }),
    });

    await expect(service.verifyAndAuthenticate('valid-token')).rejects.toThrow(
      /Access restricted to University of Ruhuna accounts/,
    );
  });

  it('should authenticate existing registered university user', async () => {
    const existingUser = {
      id: 'existing-uuid',
      email: 'lecturer@eng.ruh.ac.lk',
      role: UserRole.LECTURER,
      isActive: true,
    };
    mockUserRepo.findOne.mockResolvedValue(existingUser);

    mockOAuthClient.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'lecturer@eng.ruh.ac.lk',
        email_verified: true,
        name: 'Dr. Kamal Perera',
      }),
    });

    const result = await service.verifyAndAuthenticate('valid-token');
    expect(result).toEqual(existingUser);
    expect(mockUserRepo.save).not.toHaveBeenCalled();
  });

  it('should throw if existing user account is deactivated', async () => {
    mockUserRepo.findOne.mockResolvedValue({
      id: 'existing-uuid',
      email: 'lecturer@eng.ruh.ac.lk',
      isActive: false,
    });

    mockOAuthClient.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'lecturer@eng.ruh.ac.lk',
        email_verified: true,
      }),
    });

    await expect(service.verifyAndAuthenticate('valid-token')).rejects.toThrow(
      /University account has been deactivated/,
    );
  });

  it('should auto-provision new verified university lecturer', async () => {
    mockUserRepo.findOne.mockResolvedValue(null);

    mockOAuthClient.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'new.staff@eng.ruh.ac.lk',
        email_verified: true,
        name: 'Sunil Wickrama',
      }),
    });

    const result = await service.verifyAndAuthenticate('valid-token');
    expect(result.email).toBe('new.staff@eng.ruh.ac.lk');
    expect(result.role).toBe(UserRole.LECTURER);
    expect(mockUserRepo.save).toHaveBeenCalled();
  });
});
