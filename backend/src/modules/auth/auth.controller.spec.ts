import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserRole } from '../../database/entities/user.entity';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: any;
  const originalEnv = process.env.NODE_ENV;

  beforeEach(async () => {
    process.env.NODE_ENV = 'development';
    mockAuthService = {
      login: jest.fn().mockResolvedValue({
        accessToken: 'mock-jwt-token',
        user: {
          id: 'mock-user-id',
          email: 'lecturer@eng.ruh.ac.lk',
          fullName: 'Dr. Kamal Perera',
          role: UserRole.LECTURER,
          departmentCode: 'COM',
        },
      }),
      logout: jest.fn().mockResolvedValue({
        success: true,
        message: 'User lecturer@eng.ruh.ac.lk logged out successfully',
      }),
      getProfile: jest.fn().mockResolvedValue({
        id: 'mock-user-id',
        email: 'lecturer@eng.ruh.ac.lk',
        fullName: 'Dr. Kamal Perera',
        role: UserRole.LECTURER,
      }),
      getTestActors: jest.fn().mockReturnValue([
        { email: 'lecturer@eng.ruh.ac.lk', role: UserRole.LECTURER },
      ]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should call authService.login and return response', async () => {
      const res = await controller.login({ email: 'lecturer@eng.ruh.ac.lk' });
      expect(mockAuthService.login).toHaveBeenCalledWith({ email: 'lecturer@eng.ruh.ac.lk' });
      expect(res.accessToken).toBe('mock-jwt-token');
    });
  });

  describe('logout', () => {
    it('should call authService.logout and return response', async () => {
      const user = { id: 'mock-user-id', email: 'lecturer@eng.ruh.ac.lk' } as any;
      const res = await controller.logout(user);
      expect(mockAuthService.logout).toHaveBeenCalledWith(user);
      expect(res.success).toBe(true);
      expect(res.message).toContain('logged out successfully');
    });
  });

  describe('mockLoginRole', () => {
    it('should call authService.login with mapped role email in development', async () => {
      const res = await controller.mockLoginRole(UserRole.HOD);
      expect(mockAuthService.login).toHaveBeenCalledWith({ email: 'hod.computer@eng.ruh.ac.lk' });
      expect(res.accessToken).toBe('mock-jwt-token');
    });

    it('should throw NotFoundException in production environment', async () => {
      process.env.NODE_ENV = 'production';
      await expect(controller.mockLoginRole(UserRole.HOD)).rejects.toThrow(NotFoundException);
      expect(mockAuthService.login).not.toHaveBeenCalled();
    });
  });

  describe('getProfile', () => {
    it('should return profile of current user', async () => {
      const user = { id: 'mock-user-id' } as any;
      const res = await controller.getProfile(user);
      expect(mockAuthService.getProfile).toHaveBeenCalledWith('mock-user-id');
      expect(res.email).toBe('lecturer@eng.ruh.ac.lk');
    });
  });

  describe('getTestActors', () => {
    it('should return list of test actors in development', () => {
      const actors = controller.getTestActors();
      expect(actors).toHaveLength(1);
      expect(actors[0].email).toBe('lecturer@eng.ruh.ac.lk');
    });

    it('should throw NotFoundException in production environment', () => {
      process.env.NODE_ENV = 'production';
      expect(() => controller.getTestActors()).toThrow(NotFoundException);
    });
  });
});
