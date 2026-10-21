import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Alert, EmptyState, Skeleton } from '../../components/common/Feedback';
import { Table, TableCell, TableHead } from '../../components/common/Table';
import { RequestStatusBadge } from '../../components/tracking/RequestStatusBadge';
import { RequestDetailPage } from '../../pages/RequestDetailPage';
import { useRequestResource } from '../requests/useRequestResource';
import { decodePendingQueue } from './contracts';
import { OfficerAccessFeedback } from './OfficerPortalLayout';
import { useOfficerAccess } from './officerAccess';

const pageSize = 10;
const amount = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
});
const date = new Intl.DateTimeFormat('en-LK', {
  dateStyle: 'medium',
});
const roleLabels: Record<string, string> = {
  HOD: 'Head of Department',
  DEAN: 'Dean',
  EXAMINATION_OFFICER: 'Examination Officer',
  FINANCIAL_OFFICER: 'Financial Officer',
  ASSISTANT_BURSAR: 'Assistant Bursar',
  ADMIN: 'Administrator',
};

function AuthorizedQueue() {
  const { profile } = useOfficerAccess();
  const [page, setPage] = useState(1);
  const queue = useRequestResource(
    '/requests/pending-queue',
    decodePendingQueue,
    { page: String(page), limit: String(pageSize) },
  );
  const currentProfile = profile.data!;
  const scope =
    currentProfile.role === 'HOD'
      ? `Assigned department${currentProfile.departmentCode ? `: ${currentProfile.departmentCode}` : ''}`
      : currentProfile.role === 'ADMIN'
        ? 'All requests awaiting action across workflow stages'
        : 'Requests assigned to your role at the active workflow stage';

  return (
    <section aria-labelledby="officer-queue-title" className="space-y-6">
      <header>
        <h1
          id="officer-queue-title"
          className="text-display font-bold text-brand"
        >
          Approval Queue
        </h1>
        <p className="mt-2 text-muted">
          Assigned applications awaiting action • one shared page for all
          officer roles
        </p>
      </header>

      <Card className="grid gap-4 sm:grid-cols-[minmax(14rem,18rem)_1fr] sm:items-center">
        <div>
          <p className="text-xs text-muted">Current role</p>
          <p className="mt-2 rounded-control bg-blue-50 px-4 py-3 font-bold text-brand">
            {roleLabels[currentProfile.role]} · signed-in role
          </p>
        </div>
        <p className="text-sm text-muted">
          Scope: {scope} · role is determined by the authenticated account
        </p>
      </Card>

      {queue.status === 'loading' && (
        <Card>
          <Skeleton label="Loading approval queue" />
        </Card>
      )}
      {(queue.status === 'error' || queue.status === 'unavailable') && (
        <Alert
          title={
            queue.status === 'unavailable'
              ? 'Approval queue is unavailable'
              : 'Could not load the approval queue'
          }
          tone={queue.status === 'error' ? 'danger' : 'info'}
        >
          <p>{queue.message}</p>
          {queue.status === 'error' && (
            <Button className="mt-3" variant="ghost" onClick={queue.retry}>
              Retry
            </Button>
          )}
        </Alert>
      )}
      {queue.data && (
        <>
          <Card className="max-w-sm">
            <p className="text-sm text-muted">Pending at your role</p>
            <p className="mt-1 text-3xl font-bold text-brand">
              {queue.data.meta.total}
            </p>
          </Card>

          {queue.data.data.length === 0 ? (
            <EmptyState title="No requests awaiting action">
              <p>
                The backend returned no applications assigned to this role and
                stage.
              </p>
            </EmptyState>
          ) : (
            <Card className="space-y-4">
              <Table
                caption="Applications awaiting officer action"
                variant="officer"
              >
                <thead>
                  <tr>
                    <TableHead>Reference</TableHead>
                    <TableHead>Applicant / Department</TableHead>
                    <TableHead>Application type</TableHead>
                    <TableHead>Current stage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Claim amount</TableHead>
                    <TableHead>Submitted</TableHead>
                    <TableHead>Action</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {queue.data.data.map((item) => (
                    <tr key={item.id}>
                      <TableCell>
                        <span className="font-bold text-brand">
                          {item.trackingNumber}
                        </span>
                      </TableCell>
                      <TableCell>
                        <p className="font-semibold text-brand">
                          {item.applicantName}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {item.departmentCode ?? 'Department unavailable'}
                        </p>
                      </TableCell>
                      <TableCell>{item.requestType}</TableCell>
                      <TableCell>
                        {item.currentStageKey.replaceAll('_', ' ')}
                      </TableCell>
                      <TableCell>
                        <RequestStatusBadge status={item.status} />
                      </TableCell>
                      <TableCell className="text-right font-medium tabular-nums">
                        {amount.format(item.totalAmount)}
                      </TableCell>
                      <TableCell>
                        <time dateTime={item.submittedAt}>
                          {date.format(new Date(item.submittedAt))}
                        </time>
                      </TableCell>
                      <TableCell>
                        <Link
                          to={`/officer/queue/${encodeURIComponent(item.id)}`}
                          className="inline-flex min-h-10 items-center justify-center rounded-control bg-success px-3 py-2 text-xs font-bold text-white hover:bg-teal-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
                        >
                          Review →
                        </Link>
                      </TableCell>
                    </tr>
                  ))}
                </tbody>
              </Table>
              <nav
                aria-label="Approval queue pages"
                className="flex flex-wrap items-center justify-between gap-3"
              >
                <p className="text-sm text-muted">
                  Page {queue.data.meta.page} of {queue.data.meta.totalPages} ·{' '}
                  {queue.data.meta.total} requests
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    disabled={page <= 1 || queue.status === 'loading'}
                    onClick={() => setPage((value) => Math.max(1, value - 1))}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="ghost"
                    disabled={
                      page >= queue.data.meta.totalPages ||
                      queue.status === 'loading'
                    }
                    onClick={() => setPage((value) => value + 1)}
                  >
                    Next
                  </Button>
                </div>
              </nav>
            </Card>
          )}
        </>
      )}

      <p className="text-sm text-muted">
        Queue contents are returned by the backend for the authenticated role
        and active workflow stage.
      </p>
    </section>
  );
}

export function OfficerQueuePage() {
  const { profile, allowed } = useOfficerAccess();
  return (
    <OfficerAccessFeedback>
      {allowed && profile.data ? <AuthorizedQueue /> : null}
    </OfficerAccessFeedback>
  );
}

export function OfficerRequestDetailPage() {
  return (
    <OfficerAccessFeedback>
      <RequestDetailPage />
    </OfficerAccessFeedback>
  );
}
