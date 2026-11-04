import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { AdminDashboardController } from './admin-dashboard.controller';
import {
  AdminDashboardService,
  DashboardMetricsResponse,
} from '../services/admin-dashboard.service';
import { UserRole } from '../../../database/entities/user.entity';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';

describe('AdminDashboardController', () => {
  let controller: AdminDashboardController;
  let service: jest.Mocked<AdminDashboardService>;

  const mockMetrics: DashboardMetricsResponse = {
    claimsSummary: {
      totalClaims: 10,
      draft: 1,
      submitted: 2,
      underReview: 3,
      returnedForCorrection: 0,
      approved: 1,
      settled: 3,
      rejected: 0,
    },
    financialSummary: {
      totalClaimedAmount: 50000,
      totalSettledAmount: 30000,
      totalPendingAmount: 20000,
    },
    usersSummary: {
      totalUsers: 25,
      activeUsers: 22,
      roleBreakdown: { LECTURER: 15, HOD: 4, ADMIN: 1 },
    },
    stageBottlenecks: [{ stageKey: 'HEAD_OF_DEPARTMENT', activeCount: 3 }],
    departmentMetrics: [
      {
        id: 'dept-1',
        code: 'COM',
        name: 'Computer',
        totalClaims: 5,
        totalAmount: 25000,
        pendingClaims: 2,
      },
    ],
    recentAuditActivity: [
      {
        id: 'audit-1',
        actionType: 'APPROVE',
        actorName: 'Prof. Herath',
        actorRole: 'HOD',
        trackingNumber: 'UTR-2026-0001',
        newStatus: 'UNDER_REVIEW',
        createdAt: new Date(),
      },
    ],
  };

  beforeEach(async () => {
    const serviceMock = {
      getMetrics: jest.fn().mockResolvedValue(mockMetrics),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AdminDashboardController],
      providers: [
        {
          provide: AdminDashboardService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = module.get<AdminDashboardController>(AdminDashboardController);
    service = module.get(AdminDashboardService);
  });

  it('should enforce ADMIN role restriction on the controller class', () => {
    const reflector = new Reflector();
    const roles = reflector.get<UserRole[]>(ROLES_KEY, AdminDashboardController);
    expect(roles).toBeDefined();
    expect(roles).toContain(UserRole.ADMIN);
  });

  it('should delegate getMetrics to service', async () => {
    const result = await controller.getMetrics();

    expect(service.getMetrics).toHaveBeenCalled();
    expect(result.claimsSummary.totalClaims).toBe(10);
    expect(result.financialSummary.totalSettledAmount).toBe(30000);
  });
});
