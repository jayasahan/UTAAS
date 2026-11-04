import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AdminDashboardService } from './admin-dashboard.service';
import { Request, RequestStatus } from '../../../database/entities/request.entity';
import { User, UserRole } from '../../../database/entities/user.entity';
import { Department } from '../../../database/entities/department.entity';
import { AuditEvent } from '../../../database/entities/audit-event.entity';

describe('AdminDashboardService', () => {
  let service: AdminDashboardService;
  let requestRepoMock: any;
  let userRepoMock: any;
  let departmentRepoMock: any;
  let auditRepoMock: any;

  const mockDepartment: Department = {
    id: 'dept-uuid-1',
    code: 'COM',
    name: 'Department of Computer Engineering',
    users: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockAuditEvent: AuditEvent = {
    id: 'audit-uuid-1',
    requestId: 'req-uuid-1',
    request: { trackingNumber: 'UTR-2026-0001' } as any,
    actorId: 'user-uuid-1',
    actorName: 'Dr. Hansana H.A.J.',
    actorRole: 'LECTURER',
    actionType: 'SUBMIT',
    previousStatus: 'DRAFT',
    newStatus: 'UNDER_REVIEW',
    fieldDiff: {},
    comment: 'Submitting',
    ipAddress: '127.0.0.1',
    createdAt: new Date(),
  };

  beforeEach(async () => {
    // Request query builder mocks
    const reqQbMock: any = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockImplementation(() => {
        return Promise.resolve([
          { status: RequestStatus.SUBMITTED, count: '3' },
          { status: RequestStatus.UNDER_REVIEW, count: '5' },
          { status: RequestStatus.APPROVED, count: '2' },
          { status: RequestStatus.SETTLED, count: '10' },
        ]);
      }),
      getRawOne: jest.fn().mockResolvedValue({ total: '75000' }),
      getCount: jest.fn().mockResolvedValue(15),
    };

    // User query builder mock
    const userQbMock: any = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      groupBy: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([
        { role: UserRole.LECTURER, count: '20' },
        { role: UserRole.HOD, count: '4' },
        { role: UserRole.ADMIN, count: '2' },
      ]),
    };

    requestRepoMock = {
      createQueryBuilder: jest.fn().mockReturnValue(reqQbMock),
    };

    userRepoMock = {
      count: jest.fn().mockImplementation((opts) => {
        if (opts?.where?.isActive) return Promise.resolve(26);
        return Promise.resolve(30);
      }),
      createQueryBuilder: jest.fn().mockReturnValue(userQbMock),
    };

    departmentRepoMock = {
      find: jest.fn().mockResolvedValue([mockDepartment]),
    };

    auditRepoMock = {
      find: jest.fn().mockResolvedValue([mockAuditEvent]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminDashboardService,
        {
          provide: getRepositoryToken(Request),
          useValue: requestRepoMock,
        },
        {
          provide: getRepositoryToken(User),
          useValue: userRepoMock,
        },
        {
          provide: getRepositoryToken(Department),
          useValue: departmentRepoMock,
        },
        {
          provide: getRepositoryToken(AuditEvent),
          useValue: auditRepoMock,
        },
      ],
    }).compile();

    service = module.get<AdminDashboardService>(AdminDashboardService);
  });

  describe('getMetrics', () => {
    it('should aggregate comprehensive dashboard statistics across claims, finances, and users', async () => {
      const metrics = await service.getMetrics();

      // Claims summary verification
      expect(metrics.claimsSummary).toBeDefined();
      expect(metrics.claimsSummary.totalClaims).toBe(20);
      expect(metrics.claimsSummary.submitted).toBe(3);
      expect(metrics.claimsSummary.underReview).toBe(5);
      expect(metrics.claimsSummary.settled).toBe(10);

      // Financial summary verification
      expect(metrics.financialSummary).toBeDefined();
      expect(metrics.financialSummary.totalClaimedAmount).toBe(75000);
      expect(metrics.financialSummary.totalSettledAmount).toBe(75000);

      // Users summary verification
      expect(metrics.usersSummary).toBeDefined();
      expect(metrics.usersSummary.totalUsers).toBe(30);
      expect(metrics.usersSummary.activeUsers).toBe(26);
      expect(metrics.usersSummary.roleBreakdown[UserRole.LECTURER]).toBe(20);
      expect(metrics.usersSummary.roleBreakdown[UserRole.HOD]).toBe(4);

      // Department metrics verification
      expect(metrics.departmentMetrics).toHaveLength(1);
      expect(metrics.departmentMetrics[0].code).toBe('COM');
      expect(metrics.departmentMetrics[0].totalClaims).toBe(15);

      // Recent audit events verification
      expect(metrics.recentAuditActivity).toHaveLength(1);
      expect(metrics.recentAuditActivity[0].actionType).toBe('SUBMIT');
      expect(metrics.recentAuditActivity[0].trackingNumber).toBe('UTR-2026-0001');
    });
  });
});
