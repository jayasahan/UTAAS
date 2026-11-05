import { useSession } from '../../auth/session';
import { Alert, EmptyState, Skeleton } from '../../components/common/Feedback';
import { Card } from '../../components/common/Card';
import { Table, TableCell, TableHead } from '../../components/common/Table';
import { useRequestResource } from '../requests/useRequestResource';
import {
  decodeAdminDashboardMetrics,
  type AdminDashboardMetrics,
} from './contracts';

const currency = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
  maximumFractionDigits: 2,
});
const dateTime = new Intl.DateTimeFormat('en-LK', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <Card className="min-h-32 p-5">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <p className="mt-2 text-3xl font-bold tabular-nums text-brand">{value}</p>
      <p className="mt-1 text-xs text-muted">{detail}</p>
    </Card>
  );
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div>
      <h2 className="text-lg font-bold text-brand">{title}</h2>
      <p className="mt-1 text-sm text-muted">{description}</p>
    </div>
  );
}

function stageLabel(key: string): string {
  return key
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function StageBottlenecks({ metrics }: { metrics: AdminDashboardMetrics }) {
  const largest = Math.max(
    1,
    ...metrics.stageBottlenecks.map((s) => s.activeCount),
  );
  return (
    <Card className="space-y-5">
      <SectionHeading
        title="Requests by review stage"
        description="In-flight requests at each workflow stage."
      />
      {metrics.stageBottlenecks.length === 0 ? (
        <EmptyState title="No requests in progress" />
      ) : (
        <ul className="space-y-4">
          {metrics.stageBottlenecks.map((stage) => (
            <li key={stage.stageKey}>
              <div className="flex items-baseline justify-between gap-4 text-sm">
                <span className="font-medium text-brand">
                  {stageLabel(stage.stageKey)}
                </span>
                <span className="font-semibold tabular-nums text-brand">
                  {stage.activeCount}
                </span>
              </div>
              <div
                className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"
                role="img"
                aria-label={`${stage.activeCount} requests at ${stageLabel(stage.stageKey)}`}
              >
                <div
                  className="h-full rounded-full bg-action"
                  style={{ width: `${(stage.activeCount / largest) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function UserRoles({ metrics }: { metrics: AdminDashboardMetrics }) {
  const labels: Record<string, string> = {
    LECTURER: 'Lecturers',
    HOD: 'Heads of department',
    DEAN: 'Deans',
    EXAMINATION_OFFICER: 'Examination officers',
    FINANCIAL_OFFICER: 'Financial officers',
    ASSISTANT_BURSAR: 'Assistant bursars',
    ADMIN: 'Administrators',
  };
  return (
    <Card className="space-y-5">
      <SectionHeading
        title="User accounts"
        description={`${metrics.usersSummary.activeUsers} of ${metrics.usersSummary.totalUsers} accounts are active.`}
      />
      <ul className="grid gap-3 sm:grid-cols-2">
        {Object.entries(metrics.usersSummary.roleBreakdown).map(
          ([role, count]) => (
            <li
              key={role}
              className="flex items-center justify-between gap-3 rounded-control border border-slate-100 px-3 py-2 text-sm"
            >
              <span className="text-muted">
                {labels[role] ?? stageLabel(role)}
              </span>
              <span className="font-semibold tabular-nums text-brand">
                {count}
              </span>
            </li>
          ),
        )}
      </ul>
    </Card>
  );
}

function DashboardSections({ metrics }: { metrics: AdminDashboardMetrics }) {
  const claims = metrics.claimsSummary;
  const finance = metrics.financialSummary;
  return (
    <div className="space-y-8">
      <section aria-label="Claim overview" className="space-y-3">
        <SectionHeading
          title="Claim overview"
          description="System-wide request totals from the administrative API."
        />
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Metric
            label="All claims"
            value={claims.totalClaims}
            detail="Including drafts"
          />
          <Metric
            label="Under review"
            value={claims.underReview + claims.submitted}
            detail="Submitted or with a reviewer"
          />
          <Metric
            label="Returned"
            value={claims.returnedForCorrection}
            detail="Waiting for correction"
          />
          <Metric
            label="Settled"
            value={claims.settled}
            detail={`${claims.approved} approved · ${claims.rejected} rejected`}
          />
        </div>
      </section>

      <section aria-label="Financial summary" className="space-y-3">
        <SectionHeading
          title="Financial summary"
          description="Amounts are read from server totals; drafts are excluded from total claimed."
        />
        <div className="grid gap-4 sm:grid-cols-3">
          <Metric
            label="Claimed"
            value={currency.format(finance.totalClaimedAmount)}
            detail="Submitted and later claims"
          />
          <Metric
            label="Awaiting settlement"
            value={currency.format(finance.totalPendingAmount)}
            detail="Submitted or under review"
          />
          <Metric
            label="Settled"
            value={currency.format(finance.totalSettledAmount)}
            detail="Marked settled by the backend"
          />
        </div>
      </section>

      <section
        aria-label="Workflow and user metrics"
        className="grid gap-4 xl:grid-cols-2"
      >
        <StageBottlenecks metrics={metrics} />
        <UserRoles metrics={metrics} />
      </section>

      <section aria-label="Department activity" className="space-y-3">
        <SectionHeading
          title="Department activity"
          description="Claim volume, submitted amounts, and requests in progress by department."
        />
        <Card className="p-0">
          {metrics.departmentMetrics.length === 0 ? (
            <div className="p-5">
              <EmptyState title="No departments found" />
            </div>
          ) : (
            <Table caption="Department claim metrics" variant="officer">
              <thead>
                <tr>
                  <TableHead>Department</TableHead>
                  <TableHead>Claims</TableHead>
                  <TableHead>In progress</TableHead>
                  <TableHead>Claimed amount</TableHead>
                </tr>
              </thead>
              <tbody>
                {metrics.departmentMetrics.map((department) => (
                  <tr key={department.id}>
                    <TableCell>
                      <span className="font-semibold text-brand">
                        {department.code}
                      </span>
                      <span className="block text-xs text-muted">
                        {department.name}
                      </span>
                    </TableCell>
                    <TableCell>{department.totalClaims}</TableCell>
                    <TableCell>{department.pendingClaims}</TableCell>
                    <TableCell>
                      {currency.format(department.totalAmount)}
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </section>

      <section aria-label="Recent system activity" className="space-y-3">
        <SectionHeading
          title="Recent system activity"
          description="Latest audit events returned by the admin dashboard."
        />
        {metrics.recentAuditActivity.length === 0 ? (
          <EmptyState title="No recent audit activity" />
        ) : (
          <ol className="space-y-3">
            {metrics.recentAuditActivity.map((event) => (
              <li key={event.id}>
                <Card className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div>
                    <p className="font-semibold text-brand">
                      {event.actionType.replaceAll('_', ' ')}
                      {event.trackingNumber && ` · ${event.trackingNumber}`}
                    </p>
                    <p className="mt-1 text-sm text-muted">
                      {event.actorName} · {stageLabel(event.actorRole)} ·{' '}
                      {stageLabel(event.newStatus)}
                    </p>
                  </div>
                  <time
                    className="text-xs text-muted"
                    dateTime={event.createdAt}
                  >
                    {dateTime.format(new Date(event.createdAt))}
                  </time>
                </Card>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}

export function AdminDashboardPage() {
  const session = useSession();
  const dashboard = useRequestResource(
    session.user?.role === 'ADMIN' ? '/admin/dashboard/metrics' : null,
    decodeAdminDashboardMetrics,
  );

  return (
    <section aria-labelledby="admin-dashboard-title" className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-action">
          Administration
        </p>
        <h1
          id="admin-dashboard-title"
          className="mt-1 text-display font-bold text-brand"
        >
          System overview
        </h1>
        <p className="mt-2 text-muted">
          Claims, finances, users, department activity, and workflow health.
        </p>
      </header>

      {dashboard.status === 'loading' && (
        <Card>
          <Skeleton label="Loading administrative metrics" />
        </Card>
      )}
      {(dashboard.status === 'error' || dashboard.status === 'unavailable') && (
        <Alert
          title={
            dashboard.errorKind === 'forbidden'
              ? 'Administrator dashboard access denied'
              : dashboard.errorKind === 'unauthorized'
                ? 'Administrator session expired'
                : 'Dashboard metrics are unavailable'
          }
          tone={dashboard.status === 'error' ? 'danger' : 'info'}
          urgent={dashboard.status === 'error'}
        >
          <p>{dashboard.message}</p>
          {dashboard.status === 'error' &&
            dashboard.errorKind !== 'unauthorized' &&
            dashboard.errorKind !== 'forbidden' && (
              <button
                type="button"
                onClick={dashboard.retry}
                className="mt-3 min-h-11 rounded-control border border-current px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
              >
                Retry
              </button>
            )}
        </Alert>
      )}
      {dashboard.data && <DashboardSections metrics={dashboard.data} />}
    </section>
  );
}
