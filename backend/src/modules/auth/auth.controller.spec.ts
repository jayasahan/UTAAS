import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserRole } from '../../database/entities/user.entity';

describe('AuthController', () => {
  let controller: AuthController;
  let mockAuthService: any;

  beforeEach(async () => {
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

  describe('mockLoginRole', () => {
    it('should call authService.login with mapped role email', async () => {
      const res = await controller.mockLoginRole(UserRole.HOD);
      expect(mockAuthService.login).toHaveBeenCalledWith({ email: 'hod.computer@eng.ruh.ac.lk' });
      expect(res.accessToken).toBe('mock-jwt-token');
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
    it('should return list of test actors', () => {
      const actors = controller.getTestActors();
      expect(actors).toHaveLength(1);
      expect(actors[0].email).toBe('lecturer@eng.ruh.ac.lk');
    });
  });
});
