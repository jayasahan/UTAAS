import { Link } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Alert, EmptyState, Skeleton } from '../../components/common/Feedback';
import { Table, TableCell, TableHead } from '../../components/common/Table';
import { RequestStatusBadge } from '../../components/tracking/RequestStatusBadge';
import { useRequestResource } from '../requests/useRequestResource';
import { decodePendingQueue } from '../officer-queue/contracts';
import { OfficerAccessFeedback } from '../officer-queue/OfficerPortalLayout';
import { useOfficerAccess } from '../officer-queue/officerAccess';

const dashboardRoles = {
  HOD: [
    'Head of Department',
    'Department approval queue',
    'Requests at the Head of Department stage in your assigned department',
  ],
  DEAN: [
    'Dean',
    'Dean review queue',
    'Requests at the Dean stage returned for your role',
  ],
  EXAMINATION_OFFICER: [
    'Examination Officer',
    'Examination review queue',
    'Requests at the Examination Office stage',
  ],
  FINANCIAL_OFFICER: [
    'Financial Officer',
    'Payout authorization queue',
    'Requests at the Financial Office stage',
  ],
  ASSISTANT_BURSAR: [
    'Assistant Bursar',
    'Final settlement queue',
    'Requests at the Assistant Bursar stage',
  ],
} as const;

function isDashboardRole(role: string): role is keyof typeof dashboardRoles {
  return Object.hasOwn(dashboardRoles, role);
}

const date = new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium' });

function SummaryCard({
  label,
  value,
  explanation,
}: {
  label: string;
  value: number | string;
  explanation: string;
}) {
  return (
    <Card className="min-w-0">
      <h2 className="text-sm font-medium text-muted">{label}</h2>
      <p className="mt-2 text-3xl font-bold tabular-nums text-brand">{value}</p>
      <p className="mt-2 text-xs text-muted">{explanation}</p>
    </Card>
  );
}

function DashboardContent() {
  const { profile, allowed } = useOfficerAccess();
  const currentProfile = profile.data;
  const role =
    currentProfile && isDashboardRole(currentProfile.role)
      ? dashboardRoles[currentProfile.role]
      : null;
  const queue = useRequestResource(
    allowed && role ? '/requests/pending-queue' : null,
    decodePendingQueue,
    { page: '1', limit: '5' },
  );

  if (!allowed || !currentProfile || !role)
    return (
      <Alert title="Officer dashboard is unavailable" tone="danger" urgent>
        This dashboard is available to the five workflow reviewer roles. The
        approval queue remains available to authorized administrators.
      </Alert>
    );

  return (
    <section aria-labelledby="officer-dashboard-title" className="space-y-6">
      <header>
        <h1
          id="officer-dashboard-title"
          className="text-display font-bold text-brand"
        >
          Officer Dashboard
        </h1>
        <p className="mt-2 text-muted">
          Requests awaiting action in your verified workflow role
        </p>
      </header>

      <Card className="grid min-w-0 gap-4 bg-blue-50 sm:grid-cols-[minmax(14rem,18rem)_1fr] sm:items-center">
        <div className="min-w-0">
          <p className="text-xs text-muted">Current role</p>
          <p className="mt-2 font-bold text-brand">{role[0]}</p>
          {currentProfile.role === 'HOD' && currentProfile.departmentCode && (
            <p className="mt-1 text-sm text-muted">
              Department: {currentProfile.departmentCode}
            </p>
          )}
        </div>
        <p className="min-w-0 text-sm text-muted">Scope: {role[2]}</p>
      </Card>

      <section
        aria-label="Officer dashboard summary"
        className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
      >
        <SummaryCard
          label="Pending Reviews"
          value={
            queue.status === 'loading'
              ? 'Loading…'
              : (queue.data?.meta.total ?? 'Unavailable')
          }
          explanation="Total requests in the authenticated role and stage queue"
        />
        <SummaryCard
          label="Completed Reviews"
          value="Unavailable"
          explanation="An authorized completed-review total is not verified"
        />
        <SummaryCard
          label="Returned for Correction"
          value="Unavailable"
          explanation="A scoped correction total is not available"
        />
        <SummaryCard
          label="Recent Activity"
          value="Unavailable"
          explanation="Reviewer activity scope awaits backend clarification"
        />
      </section>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold text-brand">{role[1]}</h2>
            <p className="mt-1 text-sm text-muted">
              The next five pending requests in backend queue order
            </p>
          </div>
          <Link
            to="/officer/queue"
            className="inline-flex min-h-10 items-center rounded-control bg-action px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
          >
            View Approval Queue
          </Link>
        </div>
        {queue.status === 'loading' && (
          <Skeleton label="Loading pending requests" />
        )}
        {(queue.status === 'error' || queue.status === 'unavailable') && (
          <Alert
            title={
              queue.errorKind === 'unauthorized'
                ? 'Officer session expired'
                : queue.errorKind === 'forbidden'
                  ? 'Approval queue access denied'
                  : 'Pending requests are unavailable'
            }
            tone={queue.status === 'error' ? 'danger' : 'info'}
          >
            <p>{queue.message}</p>
            {queue.status === 'error' &&
              queue.errorKind !== 'unauthorized' &&
              queue.errorKind !== 'forbidden' && (
                <Button className="mt-3" variant="ghost" onClick={queue.retry}>
                  Retry
                </Button>
              )}
          </Alert>
        )}
        {queue.data &&
          (queue.data.data.length === 0 ? (
            <EmptyState title="No requests awaiting action">
              The backend returned no requests for this role and stage.
            </EmptyState>
          ) : (
            <Table caption="Pending requests preview" variant="officer">
              <thead>
                <tr>
                  <TableHead>Reference</TableHead>
                  <TableHead>Applicant / Department</TableHead>
                  <TableHead>Claim type</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Request date</TableHead>
                  <TableHead>Details</TableHead>
                </tr>
              </thead>
              <tbody>
                {queue.data.data.map((item) => (
                  <tr key={item.id}>
                    <TableCell className="font-semibold text-brand">
                      {item.trackingNumber}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-brand">
                        {item.applicantName}
                      </span>
                      <span className="block text-xs text-muted">
                        {item.departmentCode ?? 'Department unavailable'}
                      </span>
                    </TableCell>
                    <TableCell>{item.requestType}</TableCell>
                    <TableCell>
                      <RequestStatusBadge status={item.status} />
                    </TableCell>
                    <TableCell>
                      <time dateTime={item.submittedAt}>
                        {date.format(new Date(item.submittedAt))}
                      </time>
                    </TableCell>
                    <TableCell>
                      <Link
                        to={'/officer/queue/' + encodeURIComponent(item.id)}
                        className="inline-flex min-h-10 items-center rounded-control px-2 font-semibold text-action underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
                        aria-label={'Open request ' + item.trackingNumber}
                      >
                        Open
                      </Link>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </Table>
          ))}
      </Card>

      <Card className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-brand">Review History</h2>
          <p className="mt-1 text-sm text-muted">
            Completed-review data is unavailable pending authorization scope
            clarification.
          </p>
        </div>
        <Link
          to="/officer/review-history"
          className="inline-flex min-h-10 items-center rounded-control px-3 py-2 text-sm font-semibold text-action underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
        >
          View Review History
        </Link>
      </Card>
    </section>
  );
}

export function OfficerDashboardPage() {
  return (
    <OfficerAccessFeedback>
      <DashboardContent />
    </OfficerAccessFeedback>
  );
}
