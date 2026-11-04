import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Not, Repository } from 'typeorm';
import { Request, RequestStatus } from '../../../database/entities/request.entity';
import { User, UserRole } from '../../../database/entities/user.entity';
import { Department } from '../../../database/entities/department.entity';
import { AuditEvent } from '../../../database/entities/audit-event.entity';

export interface ClaimsSummary {
  totalClaims: number;
  draft: number;
  submitted: number;
  underReview: number;
  returnedForCorrection: number;
  approved: number;
  settled: number;
  rejected: number;
}

export interface FinancialSummary {
  totalClaimedAmount: number;
  totalSettledAmount: number;
  totalPendingAmount: number;
}

export interface UsersSummary {
  totalUsers: number;
  activeUsers: number;
  roleBreakdown: Record<string, number>;
}

export interface StageBottleneckItem {
  stageKey: string;
  activeCount: number;
}

export interface DepartmentMetricItem {
  id: string;
  code: string;
  name: string;
  totalClaims: number;
  totalAmount: number;
  pendingClaims: number;
}

export interface RecentAuditItem {
  id: string;
  actionType: string;
  actorName: string;
  actorRole: string;
  trackingNumber: string;
  newStatus: string;
  createdAt: Date;
}

export interface DashboardMetricsResponse {
  claimsSummary: ClaimsSummary;
  financialSummary: FinancialSummary;
  usersSummary: UsersSummary;
  stageBottlenecks: StageBottleneckItem[];
  departmentMetrics: DepartmentMetricItem[];
  recentAuditActivity: RecentAuditItem[];
}

@Injectable()
export class AdminDashboardService {
  constructor(
    @InjectRepository(Request)
    private readonly requestRepo: Repository<Request>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
    @InjectRepository(AuditEvent)
    private readonly auditRepo: Repository<AuditEvent>,
  ) {}

  /**
   * Aggregates administrative dashboard metrics across claims, finances, bottlenecks, and departments.
   */
  async getMetrics(): Promise<DashboardMetricsResponse> {
    const [
      claimsSummary,
      financialSummary,
      usersSummary,
      stageBottlenecks,
      departmentMetrics,
      recentAuditActivity,
    ] = await Promise.all([
      this.getClaimsSummary(),
      this.getFinancialSummary(),
      this.getUsersSummary(),
      this.getStageBottlenecks(),
      this.getDepartmentMetrics(),
      this.getRecentAuditActivity(),
    ]);

    return {
      claimsSummary,
      financialSummary,
      usersSummary,
      stageBottlenecks,
      departmentMetrics,
      recentAuditActivity,
    };
  }

  private async getClaimsSummary(): Promise<ClaimsSummary> {
    const rawCounts = await this.requestRepo
      .createQueryBuilder('req')
      .select('req.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('req.status')
      .getRawMany();

    const countsMap: Record<string, number> = {};
    let totalClaims = 0;

    for (const row of rawCounts) {
      const count = Number(row.count) || 0;
      countsMap[row.status] = count;
      totalClaims += count;
    }

    return {
      totalClaims,
      draft: countsMap[RequestStatus.DRAFT] || 0,
      submitted: countsMap[RequestStatus.SUBMITTED] || 0,
      underReview: countsMap[RequestStatus.UNDER_REVIEW] || 0,
      returnedForCorrection: countsMap[RequestStatus.RETURNED_FOR_CORRECTION] || 0,
      approved: countsMap[RequestStatus.APPROVED] || 0,
      settled: countsMap[RequestStatus.SETTLED] || 0,
      rejected: countsMap[RequestStatus.REJECTED] || 0,
    };
  }

  private async getFinancialSummary(): Promise<FinancialSummary> {
    const totalClaimedRaw = await this.requestRepo
      .createQueryBuilder('req')
      .select('SUM(req.totalAmount)', 'total')
      .where('req.status != :draftStatus', { draftStatus: RequestStatus.DRAFT })
      .getRawOne();

    const totalSettledRaw = await this.requestRepo
      .createQueryBuilder('req')
      .select('SUM(req.totalAmount)', 'total')
      .where('req.status = :settledStatus', { settledStatus: RequestStatus.SETTLED })
      .getRawOne();

    const totalPendingRaw = await this.requestRepo
      .createQueryBuilder('req')
      .select('SUM(req.totalAmount)', 'total')
      .where('req.status IN (:...pendingStatuses)', {
        pendingStatuses: [RequestStatus.SUBMITTED, RequestStatus.UNDER_REVIEW],
      })
      .getRawOne();

    return {
      totalClaimedAmount: Number(totalClaimedRaw?.total) || 0,
      totalSettledAmount: Number(totalSettledRaw?.total) || 0,
      totalPendingAmount: Number(totalPendingRaw?.total) || 0,
    };
  }

  private async getUsersSummary(): Promise<UsersSummary> {
    const [totalUsers, activeUsers, roleRows] = await Promise.all([
      this.userRepo.count(),
      this.userRepo.count({ where: { isActive: true } }),
      this.userRepo
        .createQueryBuilder('u')
        .select('u.role', 'role')
        .addSelect('COUNT(*)', 'count')
        .where('u.isActive = :isActive', { isActive: true })
        .groupBy('u.role')
        .getRawMany(),
    ]);

    const roleBreakdown: Record<string, number> = {};
    for (const role of Object.values(UserRole)) {
      roleBreakdown[role] = 0;
    }
    for (const row of roleRows) {
      roleBreakdown[row.role] = Number(row.count) || 0;
    }

    return {
      totalUsers,
      activeUsers,
      roleBreakdown,
    };
  }

  private async getStageBottlenecks(): Promise<StageBottleneckItem[]> {
    const inFlightStatuses = [
      RequestStatus.SUBMITTED,
      RequestStatus.UNDER_REVIEW,
      RequestStatus.RETURNED_FOR_CORRECTION,
    ];

    const rawStages = await this.requestRepo
      .createQueryBuilder('req')
      .select('req.currentStageKey', 'stageKey')
      .addSelect('COUNT(*)', 'count')
      .where('req.status IN (:...statuses)', { statuses: inFlightStatuses })
      .groupBy('req.currentStageKey')
      .orderBy('count', 'DESC')
      .getRawMany();

    return rawStages.map((r) => ({
      stageKey: r.stageKey,
      activeCount: Number(r.count) || 0,
    }));
  }

  private async getDepartmentMetrics(): Promise<DepartmentMetricItem[]> {
    const departments = await this.departmentRepo.find({ order: { code: 'ASC' } });
    const inFlightStatuses = [
      RequestStatus.SUBMITTED,
      RequestStatus.UNDER_REVIEW,
      RequestStatus.RETURNED_FOR_CORRECTION,
    ];

    return Promise.all(
      departments.map(async (dept) => {
        const totalClaims = await this.requestRepo
          .createQueryBuilder('req')
          .innerJoin('req.applicant', 'applicant')
          .where('applicant.departmentId = :deptId', { deptId: dept.id })
          .getCount();

        const amountRaw = await this.requestRepo
          .createQueryBuilder('req')
          .innerJoin('req.applicant', 'applicant')
          .select('SUM(req.totalAmount)', 'total')
          .where('applicant.departmentId = :deptId', { deptId: dept.id })
          .andWhere('req.status != :draft', { draft: RequestStatus.DRAFT })
          .getRawOne();

        const pendingClaims = await this.requestRepo
          .createQueryBuilder('req')
          .innerJoin('req.applicant', 'applicant')
          .where('applicant.departmentId = :deptId', { deptId: dept.id })
          .andWhere('req.status IN (:...statuses)', { statuses: inFlightStatuses })
          .getCount();

        return {
          id: dept.id,
          code: dept.code,
          name: dept.name,
          totalClaims,
          totalAmount: Number(amountRaw?.total) || 0,
          pendingClaims,
        };
      }),
    );
  }

  private async getRecentAuditActivity(): Promise<RecentAuditItem[]> {
    const events = await this.auditRepo.find({
      relations: ['request'],
      order: { createdAt: 'DESC' },
      take: 5,
    });

    return events.map((e) => ({
      id: e.id,
      actionType: e.actionType,
      actorName: e.actorName,
      actorRole: e.actorRole,
      trackingNumber: e.request?.trackingNumber || '',
      newStatus: e.newStatus,
      createdAt: e.createdAt,
    }));
  }
}
