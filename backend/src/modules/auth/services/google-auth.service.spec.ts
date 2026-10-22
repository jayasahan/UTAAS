import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { getRepositoryToken } from '@nestjs/typeorm';
import { UnauthorizedException } from '@nestjs/common';
import { GoogleAuthService } from './google-auth.service';
import { User, UserRole } from '../../../database/entities/user.entity';

describe('GoogleAuthService', () => {
  let service: GoogleAuthService;
  let mockUserRepo: any;
  let mockConfigService: any;
  let mockOAuthClient: any;

  beforeEach(async () => {
    mockUserRepo = {
      findOne: jest.fn(),
    };

    mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        if (key === 'GOOGLE_CLIENT_ID') return 'mock-google-client-id.apps.googleusercontent.com';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoogleAuthService,
        { provide: ConfigService, useValue: mockConfigService },
        { provide: getRepositoryToken(User), useValue: mockUserRepo },
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

  it('should throw if GOOGLE_CLIENT_ID is missing from configuration (P1 prevention)', async () => {
    mockConfigService.get.mockReturnValue(undefined);

    await expect(service.verifyAndAuthenticate('any-token')).rejects.toThrow(
      /Google OAuth authentication is not configured on the server/,
    );
  });

  it('should throw if verifyIdToken fails', async () => {
    mockOAuthClient.verifyIdToken.mockRejectedValue(new Error('Invalid token signature'));

    await expect(service.verifyAndAuthenticate('invalid-token')).rejects.toThrow(
      /Invalid Google ID token/,
    );
  });

  it('should enforce audience parameter matching configured client ID', async () => {
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
      }),
    });

    await service.verifyAndAuthenticate('valid-token');
    expect(mockOAuthClient.verifyIdToken).toHaveBeenCalledWith({
      idToken: 'valid-token',
      audience: 'mock-google-client-id.apps.googleusercontent.com',
    });
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

  it('should authenticate pre-registered university user', async () => {
    const existingUser = {
      id: 'existing-uuid',
      email: 'lecturer@eng.ruh.ac.lk',
      role: UserRole.LECTURER,
      isActive: true,
      department: { code: 'COM' },
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
  });

  it('should reject unseeded / unregistered university Google accounts (P1 restriction)', async () => {
    mockUserRepo.findOne.mockResolvedValue(null);

    mockOAuthClient.verifyIdToken.mockResolvedValue({
      getPayload: () => ({
        email: 'unregistered.prof@eng.ruh.ac.lk',
        email_verified: true,
        name: 'Unregistered Professor',
      }),
    });

    await expect(service.verifyAndAuthenticate('valid-token')).rejects.toThrow(
      /User account 'unregistered.prof@eng.ruh.ac.lk' is not registered in UTAAS/,
    );
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
});
