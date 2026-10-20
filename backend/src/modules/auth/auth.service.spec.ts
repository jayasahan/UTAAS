import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AuthService } from './auth.service';
import { AUTH_PROVIDER } from './interfaces/auth-provider.interface';
import { User, UserRole } from '../../database/entities/user.entity';
import { NotFoundException } from '@nestjs/common';

describe('AuthService', () => {
  let service: AuthService;
  let mockJwtService: Partial<JwtService>;
  let mockAuthProvider: any;
  let mockUserRepository: any;

  const mockUser = {
    id: 'user-uuid-1',
    email: 'lecturer@eng.ruh.ac.lk',
    fullName: 'Dr. Kamal Perera',
    role: UserRole.LECTURER,
    departmentId: 'dept-uuid-com',
    department: { id: 'dept-uuid-com', code: 'COM', name: 'Computer Engineering' } as any,
    isActive: true,
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

    mockUserRepository = {
      findOne: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: mockJwtService },
        { provide: AUTH_PROVIDER, useValue: mockAuthProvider },
        { provide: getRepositoryToken(User), useValue: mockUserRepository },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should authenticate user and return access token and profile', async () => {
      const result = await service.login({ email: 'lecturer@eng.ruh.ac.lk' });

      expect(mockAuthProvider.authenticate).toHaveBeenCalledWith('lecturer@eng.ruh.ac.lk', undefined);
      expect(mockJwtService.signAsync).toHaveBeenCalledWith({
        sub: mockUser.id,
        email: mockUser.email,
        role: mockUser.role,
        departmentId: 'dept-uuid-com',
        departmentCode: 'COM',
      });
      expect(result).toEqual({
        accessToken: 'signed-jwt-token',
        user: {
          id: mockUser.id,
          email: mockUser.email,
          fullName: mockUser.fullName,
          role: mockUser.role,
          departmentCode: 'COM',
          departmentId: 'dept-uuid-com',
        },
      });
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
