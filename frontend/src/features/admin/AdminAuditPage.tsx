import { useState, type FormEvent } from 'react';
import { userRoles } from '../../auth/contracts';
import { Alert, EmptyState, Skeleton } from '../../components/common/Feedback';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Table, TableCell, TableHead } from '../../components/common/Table';
import { useRequestResource } from '../requests/useRequestResource';
import { decodeAdminUserPage, decodeAuditPage } from './resourceContracts';

const dateTime = new Intl.DateTimeFormat('en-LK', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
const actions = [
  'SUBMIT',
  'APPROVE',
  'REJECT_RETURN',
  'APPROVE_PAYOUT',
  'DIRECT_QUERY',
  'RESUBMIT',
  'EDIT',
];

function dateBoundary(value: string, end: boolean): string | undefined {
  if (!value) return undefined;
  const date = new Date(`${value}T${end ? '23:59:59.999' : '00:00:00'}`);
  return date.toISOString();
}

export function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [trackingInput, setTrackingInput] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [requestIdInput, setRequestIdInput] = useState('');
  const [requestId, setRequestId] = useState('');
  const [actorIdInput, setActorIdInput] = useState('');
  const [actorId, setActorId] = useState('');
  const [actorRoleInput, setActorRoleInput] = useState('');
  const [actorRole, setActorRole] = useState('');
  const [actionInput, setActionInput] = useState('');
  const [actionType, setActionType] = useState('');
  const [startInput, setStartInput] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endInput, setEndInput] = useState('');
  const [endDate, setEndDate] = useState('');
  const actors = useRequestResource('/admin/users', decodeAdminUserPage, {
    page: '1',
    limit: '100',
  });
  const query: Record<string, string> = { page: String(page), limit: '20' };
  if (trackingNumber) query.trackingNumber = trackingNumber;
  if (requestId) query.requestId = requestId;
  if (actorId) query.actorId = actorId;
  if (actorRole) query.actorRole = actorRole;
  if (actionType) query.actionType = actionType;
  if (startDate) query.startDate = dateBoundary(startDate, false)!;
  if (endDate) query.endDate = dateBoundary(endDate, true)!;
  const audit = useRequestResource('/admin/audit-logs', decodeAuditPage, query);

  function applyFilters(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (startInput && endInput && startInput > endInput) return;
    setPage(1);
    setTrackingNumber(trackingInput.trim());
    setRequestId(requestIdInput.trim());
    setActorId(actorIdInput);
    setActorRole(actorRoleInput);
    setActionType(actionInput);
    setStartDate(startInput);
    setEndDate(endInput);
  }

  return (
    <section aria-labelledby="admin-audit-title" className="space-y-6">
      <header>
        <p className="text-sm font-semibold uppercase tracking-wide text-action">
          Administration
        </p>
        <h1
          id="admin-audit-title"
          className="mt-1 text-display font-bold text-brand"
        >
          Audit trail
        </h1>
        <p className="mt-2 max-w-3xl text-muted">
          Search immutable system events by claim, request, actor, role, action,
          and date. Event details are read-only.
        </p>
      </header>
      <Card className="space-y-4">
        <form
          onSubmit={applyFilters}
          className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
        >
          <label className="grid gap-1 text-sm font-semibold text-brand">
            Tracking number
            <input
              value={trackingInput}
              onChange={(e) => setTrackingInput(e.target.value)}
              className="min-h-11 rounded-control border border-border px-3 font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-brand">
            Request ID
            <input
              value={requestIdInput}
              onChange={(e) => setRequestIdInput(e.target.value)}
              placeholder="Request UUID"
              pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89aAbB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}"
              title="Enter a valid version 4 request UUID."
              className="min-h-11 rounded-control border border-border px-3 font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-brand">
            Actor
            <select
              value={actorIdInput}
              onChange={(e) => setActorIdInput(e.target.value)}
              className="min-h-11 rounded-control border border-border bg-white px-3 font-normal"
            >
              <option value="">All actors</option>
              {actors.data?.data.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.fullName} · {actor.role.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-brand">
            Actor role
            <select
              value={actorRoleInput}
              onChange={(e) => setActorRoleInput(e.target.value)}
              className="min-h-11 rounded-control border border-border bg-white px-3 font-normal"
            >
              <option value="">All roles</option>
              {userRoles.map((role) => (
                <option key={role} value={role}>
                  {role.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-brand">
            Action
            <select
              value={actionInput}
              onChange={(e) => setActionInput(e.target.value)}
              className="min-h-11 rounded-control border border-border bg-white px-3 font-normal"
            >
              <option value="">All actions</option>
              {actions.map((action) => (
                <option key={action} value={action}>
                  {action.replaceAll('_', ' ')}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-sm font-semibold text-brand">
            From
            <input
              type="date"
              value={startInput}
              onChange={(e) => setStartInput(e.target.value)}
              className="min-h-11 rounded-control border border-border px-3 font-normal"
            />
          </label>
          <label className="grid gap-1 text-sm font-semibold text-brand">
            To
            <input
              type="date"
              value={endInput}
              onChange={(e) => setEndInput(e.target.value)}
              className="min-h-11 rounded-control border border-border px-3 font-normal"
            />
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit">Apply filters</Button>
            {(trackingNumber ||
              requestId ||
              actorId ||
              actorRole ||
              actionType ||
              startDate ||
              endDate) && (
              <Button
                variant="ghost"
                onClick={() => {
                  setTrackingInput('');
                  setTrackingNumber('');
                  setRequestIdInput('');
                  setRequestId('');
                  setActorIdInput('');
                  setActorId('');
                  setActorRoleInput('');
                  setActorRole('');
                  setActionInput('');
                  setActionType('');
                  setStartInput('');
                  setStartDate('');
                  setEndInput('');
                  setEndDate('');
                  setPage(1);
                }}
              >
                Clear
              </Button>
            )}
          </div>
        </form>
        {startInput && endInput && startInput > endInput && (
          <p role="alert" className="text-sm text-danger">
            The start date must be before or equal to the end date.
          </p>
        )}

        {audit.status === 'loading' && (
          <Skeleton label="Loading audit events" />
        )}
        {(audit.status === 'error' || audit.status === 'unavailable') && (
          <Alert
            title={
              audit.errorKind === 'forbidden'
                ? 'Audit trail access denied'
                : 'Audit events unavailable'
            }
            tone={audit.status === 'error' ? 'danger' : 'info'}
          >
            <p>{audit.message}</p>
            {audit.status === 'error' &&
              audit.errorKind !== 'forbidden' &&
              audit.errorKind !== 'unauthorized' && (
                <Button className="mt-3" variant="ghost" onClick={audit.retry}>
                  Retry
                </Button>
              )}
          </Alert>
        )}
        {audit.data && audit.data.data.length === 0 && (
          <EmptyState title="No events match these filters">
            <p>Try a different date range or clear one of the filters.</p>
          </EmptyState>
        )}
        {audit.data && audit.data.data.length > 0 && (
          <>
            <Table caption="System audit events" variant="officer">
              <thead>
                <tr>
                  <TableHead>Time</TableHead>
                  <TableHead>Claim</TableHead>
                  <TableHead>Actor</TableHead>
                  <TableHead>Action</TableHead>
                  <TableHead>Status change</TableHead>
                  <TableHead>Details</TableHead>
                </tr>
              </thead>
              <tbody>
                {audit.data.data.map((event) => (
                  <tr key={event.id}>
                    <TableCell>
                      <time dateTime={event.createdAt}>
                        {dateTime.format(new Date(event.createdAt))}
                      </time>
                    </TableCell>
                    <TableCell>
                      {event.trackingNumber || 'Claim record'}
                    </TableCell>
                    <TableCell>
                      <span className="font-medium text-brand">
                        {event.actorName}
                      </span>
                      <span className="block text-xs text-muted">
                        {event.actorRole.replaceAll('_', ' ')}
                      </span>
                    </TableCell>
                    <TableCell>
                      {event.actionType.replaceAll('_', ' ')}
                    </TableCell>
                    <TableCell>
                      {event.previousStatus
                        ? `${event.previousStatus} → ${event.newStatus}`
                        : event.newStatus}
                    </TableCell>
                    <TableCell>
                      <details className="max-w-sm">
                        <summary className="min-h-10 cursor-pointer font-semibold text-action underline">
                          View details
                        </summary>
                        <div className="mt-2 space-y-2 break-words text-xs text-muted">
                          {event.comment && (
                            <p>
                              <span className="font-semibold text-brand">
                                Comment:
                              </span>{' '}
                              {event.comment}
                            </p>
                          )}
                          {event.fieldDiff && (
                            <pre className="max-h-56 overflow-auto whitespace-pre-wrap rounded-control bg-slate-50 p-2">
                              {JSON.stringify(event.fieldDiff, null, 2)}
                            </pre>
                          )}
                          <p className="font-mono">Event {event.id}</p>
                        </div>
                      </details>
                    </TableCell>
                  </tr>
                ))}
              </tbody>
            </Table>
            <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-muted">
              <p>
                Page {audit.data.meta.page} of{' '}
                {Math.max(audit.data.meta.totalPages, 1)} ·{' '}
                {audit.data.meta.total} events
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  disabled={page <= 1}
                  onClick={() => setPage((value) => value - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  disabled={page >= audit.data.meta.totalPages}
                  onClick={() => setPage((value) => value + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </section>
  );
}
