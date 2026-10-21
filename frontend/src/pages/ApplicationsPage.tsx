import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../components/common/Button';
import { Card } from '../components/common/Card';
import { Alert, EmptyState, Skeleton } from '../components/common/Feedback';
import { Table, TableCell, TableHead } from '../components/common/Table';
import { RequestStatusBadge } from '../components/tracking/RequestStatusBadge';
import {
  decodeRequestPage,
  type RequestListItem,
} from '../features/requests/contracts';
import { useRequestResource } from '../features/requests/useRequestResource';

const pageSize = 10;
const amount = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
});
const date = new Intl.DateTimeFormat('en-LK', {
  dateStyle: 'medium',
});
function title(item: RequestListItem): string {
  const code = item.metadata.courseCode;
  const name = item.metadata.courseTitle;
  if (typeof code === 'string' && typeof name === 'string')
    return `${code} · ${name}`;
  if (typeof name === 'string') return name;
  return item.requestType;
}

export function ApplicationsPage() {
  const [page, setPage] = useState(1);
  const requests = useRequestResource(
    '/requests/my-requests',
    decodeRequestPage,
    {
      page: String(page),
      limit: String(pageSize),
    },
  );
  return (
    <section aria-labelledby="applications-title" className="space-y-6">
      <header>
        <h1
          id="applications-title"
          className="text-display font-bold text-brand"
        >
          My Requests
        </h1>
        <p className="mt-2 text-muted">
          Applications returned by the authenticated backend account.
        </p>
      </header>
      {requests.status === 'loading' && (
        <Card>
          <Skeleton label="Loading your requests" />
        </Card>
      )}
      {(requests.status === 'error' || requests.status === 'unavailable') && (
        <Alert
          title={
            requests.status === 'unavailable'
              ? 'Requests are unavailable'
              : 'Could not load your requests'
          }
          tone={requests.status === 'error' ? 'danger' : 'info'}
        >
          <p>{requests.message}</p>
          {requests.status === 'error' && (
            <Button className="mt-3" variant="ghost" onClick={requests.retry}>
              Retry
            </Button>
          )}
        </Alert>
      )}
      {requests.data && requests.data.data.length === 0 && (
        <EmptyState title="No requests found">
          <p>The backend has no requests for this account.</p>
          <Link className="mt-3 inline-block underline" to="/requests/new">
            Prepare a new application
          </Link>
        </EmptyState>
      )}
      {requests.data && requests.data.data.length > 0 && (
        <Card className="space-y-4">
          <Table caption="Your requests">
            <thead>
              <tr>
                <TableHead>Request</TableHead>
                <TableHead>Tracking number</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Current stage</TableHead>
                <TableHead>Server amount</TableHead>
                <TableHead>Created</TableHead>
              </tr>
            </thead>
            <tbody>
              {requests.data.data.map((item) => (
                <tr key={item.id}>
                  <TableCell>
                    <Link
                      to={`/requests/${encodeURIComponent(item.id)}`}
                      className="font-semibold text-action underline"
                    >
                      {title(item)}
                    </Link>
                  </TableCell>
                  <TableCell>{item.trackingNumber}</TableCell>
                  <TableCell>
                    <RequestStatusBadge status={item.status} />
                  </TableCell>
                  <TableCell>
                    {item.currentStageKey.replaceAll('_', ' ')}
                  </TableCell>
                  <TableCell>{amount.format(item.totalAmount)}</TableCell>
                  <TableCell>{date.format(new Date(item.createdAt))}</TableCell>
                </tr>
              ))}
            </tbody>
          </Table>
          <nav
            aria-label="Request pages"
            className="flex flex-wrap items-center justify-between gap-3"
          >
            <p className="text-sm text-muted">
              Page {requests.data.meta.page} of{' '}
              {Math.max(1, requests.data.meta.totalPages)} ·{' '}
              {requests.data.meta.total} requests
            </p>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                disabled={page <= 1 || requests.status === 'loading'}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
              >
                Previous
              </Button>
              <Button
                variant="ghost"
                disabled={
                  page >= requests.data.meta.totalPages ||
                  requests.status === 'loading'
                }
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </nav>
        </Card>
      )}
    </section>
  );
}
