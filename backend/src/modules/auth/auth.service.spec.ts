import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AUTH_PROVIDER } from './interfaces/auth-provider.interface';
import { GoogleAuthService } from './services/google-auth.service';
import { User, UserRole } from '../../database/entities/user.entity';
import { NotFoundException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let mockJwtService: Partial<JwtService>;
  let mockAuthProvider: any;
  let mockGoogleAuthService: any;
  let mockUserRepository: any;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'lecturer@eng.ruh.ac.lk',
    fullName: 'Dr. Kamal Perera',
    role: UserRole.LECTURER,
    departmentId: 'dept-uuid-com',
    department: { id: 'dept-uuid-com', code: 'COM', name: 'Computer Engineering' } as any,
    isActive: true,
    tokenVersion: 0,
    requests: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  } as User;

  beforeEach(async () => {
    mockJwtService = {
      signAsync: jest.fn().mockResolvedValue('signed-jwt-token'),
    };

    mockAuthProvider = {
      authenticate: jest.fn().mockResolvedValue(mockUser),
      getTestActors: jest.fn().mockReturnValue([
        { email: 'lecturer@eng.ruh.ac.lk', role: UserRole.LECTURER },
      ]),
    };

    mockGoogleAuthService = {
      verifyAndAuthenticate: jest.fn().mockResolvedValue(mockUser),
    };

    mockUserRepository = {
      findOne: jest.fn(),
      increment: jest.fn().mockResolvedValue({ generatedMaps: [], raw: [], affected: 1 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: AUTH_PROVIDER, useValue: mockAuthProvider },
        { provide: GoogleAuthService, useValue: mockGoogleAuthService },
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should authenticate user and return access token with tokenVersion in payload', async () => {
      const result = await service.login({ email: 'lecturer@eng.ruh.ac.lk', password: 'password123' });

      expect(mockAuthProvider.authenticate).toHaveBeenCalledWith('lecturer@eng.ruh.ac.lk', 'password123');
      expect(mockJwtService.signAsync).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        departmentId: 'dept-uuid-com',
        departmentCode: 'COM',
        tokenVersion: 0,
      });
      expect(result).toEqual({
        accessToken: 'signed-jwt-token',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          fullName: mockUser.fullName,
          role: mockUser.role,
          departmentCode: 'COM',
          departmentName: 'Computer Engineering',
          departmentId: 'dept-uuid-com',
          designation: null,
          staffId: null,
        },
      });
    });
  });

  describe('googleLogin', () => {
    it('should verify google token and return access token with tokenVersion in payload', async () => {
      const result = await service.googleLogin({ idToken: 'valid-google-id-token' });

      expect(mockGoogleAuthService.verifyAndAuthenticate).toHaveBeenCalledWith('valid-google-id-token');
      expect(mockJwtService.signAsync).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        departmentId: 'dept-uuid-com',
        departmentCode: 'COM',
        tokenVersion: 0,
      });
      expect(result.accessToken).toBe('signed-jwt-token');
      expect(result.user.email).toBe(mockUser.email);
    });
  });

  describe('logout', () => {
    it('should increment tokenVersion in database to revoke active sessions and return success', async () => {
      const result = await service.logout(mockUser);
      expect(mockUserRepository.increment).toHaveBeenCalledWith({ id: mockUser.id }, 'tokenVersion', 1);
      expect(result.success).toBe(true);
      expect(result.message).toContain('logged out successfully and session was revoked');
    });
  });

  describe('getProfile', () => {
    it('should return user profile if found', async () => {
      mockUserRepository.findOne.mockResolvedValue(mockUser);

      const profile = await service.getProfile(mockUser.id);
      expect(profile.id).toBe(mockUser.id);
      expect(profile.email).toBe(mockUser.email);
      expect(profile.departmentCode).toBe('COM');
    });

    it('should throw NotFoundException if user not found', async () => {
      mockUserRepository.findOne.mockResolvedValue(null);

      await expect(service.getProfile('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getTestActors', () => {
    it('should return seeded test actors', () => {
      const actors = service.getTestActors();
      expect(actors).toBeDefined();
    });
  });
});
