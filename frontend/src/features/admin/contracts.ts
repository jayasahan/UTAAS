import { record, text } from '../../auth/contracts';

export interface AdminDashboardMetrics {
  claimsSummary: {
    totalClaims: number;
    draft: number;
    submitted: number;
    underReview: number;
    returnedForCorrection: number;
    approved: number;
    settled: number;
    rejected: number;
  };
  financialSummary: {
    totalClaimedAmount: number;
    totalSettledAmount: number;
    totalPendingAmount: number;
  };
  usersSummary: {
    totalUsers: number;
    activeUsers: number;
    roleBreakdown: Record<string, number>;
  };
  stageBottlenecks: { stageKey: string; activeCount: number }[];
  departmentMetrics: {
    id: string;
    code: string;
    name: string;
    totalClaims: number;
    totalAmount: number;
    pendingClaims: number;
  }[];
  recentAuditActivity: {
    id: string;
    actionType: string;
    actorName: string;
    actorRole: string;
    trackingNumber: string;
    newStatus: string;
    createdAt: string;
  }[];
}

function number(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new Error('Invalid admin dashboard response');
  return value;
}

function countGroup(value: unknown): Record<string, number> {
  return Object.fromEntries(
    Object.entries(record(value)).map(([key, count]) => [key, number(count)]),
  );
}

export function decodeAdminDashboardMetrics(
  value: unknown,
): AdminDashboardMetrics {
  const data = record(value);
  const claims = record(data.claimsSummary);
  const finances = record(data.financialSummary);
  const users = record(data.usersSummary);

  if (
    !Array.isArray(data.stageBottlenecks) ||
    !Array.isArray(data.departmentMetrics) ||
    !Array.isArray(data.recentAuditActivity)
  )
    throw new Error('Invalid admin dashboard response');

  return {
    claimsSummary: {
      totalClaims: number(claims.totalClaims),
      draft: number(claims.draft),
      submitted: number(claims.submitted),
      underReview: number(claims.underReview),
      returnedForCorrection: number(claims.returnedForCorrection),
      approved: number(claims.approved),
      settled: number(claims.settled),
      rejected: number(claims.rejected),
    },
    financialSummary: {
      totalClaimedAmount: number(finances.totalClaimedAmount),
      totalSettledAmount: number(finances.totalSettledAmount),
      totalPendingAmount: number(finances.totalPendingAmount),
    },
    usersSummary: {
      totalUsers: number(users.totalUsers),
      activeUsers: number(users.activeUsers),
      roleBreakdown: countGroup(users.roleBreakdown),
    },
    stageBottlenecks: data.stageBottlenecks.map((entry) => {
      const stage = record(entry);
      return {
        stageKey: text(stage.stageKey),
        activeCount: number(stage.activeCount),
      };
    }),
    departmentMetrics: data.departmentMetrics.map((entry) => {
      const department = record(entry);
      return {
        id: text(department.id),
        code: text(department.code),
        name: text(department.name),
        totalClaims: number(department.totalClaims),
        totalAmount: number(department.totalAmount),
        pendingClaims: number(department.pendingClaims),
      };
    }),
    recentAuditActivity: data.recentAuditActivity.map((entry) => {
      const event = record(entry);
      return {
        id: text(event.id),
        actionType: text(event.actionType),
        actorName: text(event.actorName),
        actorRole: text(event.actorRole),
        trackingNumber:
          typeof event.trackingNumber === 'string' ? event.trackingNumber : '',
        newStatus: text(event.newStatus),
        createdAt: text(event.createdAt),
      };
    }),
  };
}
