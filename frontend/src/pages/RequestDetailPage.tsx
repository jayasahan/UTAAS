import { Link, useLocation, useParams } from 'react-router-dom';
import { Card } from '../components/common/Card';
import { Alert, EmptyState, Skeleton } from '../components/common/Feedback';
import { RequestStatusBadge } from '../components/tracking/RequestStatusBadge';
import { WorkflowStepper } from '../components/tracking/Steppers';
import {
  decodeRequestDetail,
  decodeRequestHistory,
  decodeRequestTracking,
  displayMetadata,
} from '../features/requests/contracts';
import { useRequestResource } from '../features/requests/useRequestResource';
import type { RequestResource } from '../features/requests/useRequestResource';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const amount = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
});
const date = new Intl.DateTimeFormat('en-LK', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function submissionConfirmation(value: unknown): {
  trackingNumber: string;
  totalAmount: number;
} | null {
  if (!value || typeof value !== 'object') return null;
  const data = value as Record<string, unknown>;
  if (
    typeof data.trackingNumber !== 'string' ||
    !data.trackingNumber.trim() ||
    typeof data.totalAmount !== 'number' ||
    !Number.isFinite(data.totalAmount) ||
    data.totalAmount < 0
  )
    return null;
  return { trackingNumber: data.trackingNumber, totalAmount: data.totalAmount };
}

function RequestLoadState({
  title,
  resource,
}: {
  title: string;
  resource: RequestResource<unknown>;
}) {
  if (resource.status === 'loading')
    return (
      <Card>
        <Skeleton label={`Loading ${title}`} />
      </Card>
    );
  if (resource.status === 'error' || resource.status === 'unavailable')
    return (
      <Alert
        title={`${title} ${resource.status === 'error' ? 'could not be loaded' : 'is unavailable'}`}
        tone={resource.status === 'error' ? 'danger' : 'info'}
      >
        <p>{resource.message}</p>
        {resource.status === 'error' && (
          <button
            type="button"
            onClick={resource.retry}
            className="mt-3 rounded-control border border-border px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
          >
            Retry
          </button>
        )}
      </Alert>
    );
  return null;
}

export function RequestDetailPage() {
  const { requestId = '' } = useParams();
  const location = useLocation();
  const routeState = location.state as { submissionConfirmed?: unknown } | null;
  const confirmation = submissionConfirmation(routeState?.submissionConfirmed);
  const validId = uuidPattern.test(requestId);
  const pathId = validId ? encodeURIComponent(requestId) : null;
  const detail = useRequestResource(
    pathId ? `/requests/paper-marking/${pathId}` : null,
    decodeRequestDetail,
  );
  const tracking = useRequestResource(
    pathId ? `/requests/${pathId}/tracking` : null,
    decodeRequestTracking,
  );
  const history = useRequestResource(
    pathId ? `/requests/${pathId}/history` : null,
    decodeRequestHistory,
  );

  if (!validId)
    return (
      <section aria-labelledby="request-title" className="space-y-6">
        <h1 id="request-title" className="text-display font-bold text-brand">
          Application details
        </h1>
        <EmptyState title="Invalid request identifier">
          <Link className="underline" to="/requests">
            Return to My Requests
          </Link>
        </EmptyState>
      </section>
    );

  return (
    <section aria-labelledby="request-title" className="space-y-6">
      {confirmation && (
        <div
          role="status"
          className="rounded-control border border-success bg-teal-50 p-4 text-brand"
        >
          <h2 className="font-bold">Claim submitted successfully</h2>
          <p>
            Reference {confirmation.trackingNumber} · Server-confirmed total:{' '}
            {amount.format(confirmation.totalAmount)}
          </p>
        </div>
      )}
      <Link
        to="/requests"
        className="inline-block font-semibold text-action underline"
      >
        ← My Requests
      </Link>
      {detail.data ? (
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1
              id="request-title"
              className="text-display font-bold text-brand"
            >
              Application details
            </h1>
            <p className="mt-2 text-muted">
              {detail.data.trackingNumber} · Created{' '}
              {date.format(new Date(detail.data.createdAt))}
            </p>
          </div>
          <RequestStatusBadge status={detail.data.status} />
        </header>
      ) : (
        <header>
          <h1 id="request-title" className="text-display font-bold text-brand">
            Application details
          </h1>
        </header>
      )}

      {!detail.data && (
        <RequestLoadState title="Request details" resource={detail} />
      )}
      {detail.data && (
        <Card>
          <h2 className="text-lg font-bold text-brand">Claim information</h2>
          <dl className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
            {displayMetadata(detail.data.formData).map((field) => (
              <div
                key={field.label}
                className="min-w-0 [overflow-wrap:anywhere]"
              >
                <dt className="text-sm text-muted">{field.label}</dt>
                <dd className="font-semibold text-ink">{field.value}</dd>
              </div>
            ))}
            <div>
              <dt className="text-sm text-muted">Request type</dt>
              <dd className="font-semibold text-ink">
                {tracking.data?.requestType ?? 'Request type unavailable'}
              </dd>
            </div>
          </dl>
        </Card>
      )}

      <section aria-labelledby="tracking-title" className="space-y-3">
        <h2 id="tracking-title" className="text-xl font-bold text-brand">
          Approval progress
        </h2>
        {!tracking.data && (
          <RequestLoadState title="Approval progress" resource={tracking} />
        )}
        {tracking.data && (
          <>
            <Card className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold text-brand">
                  Current stage: {tracking.data.currentStage.name}
                </p>
                <p className="text-sm text-muted">
                  Assigned role:{' '}
                  {tracking.data.currentStage.assignedRole.replaceAll('_', ' ')}
                </p>
              </div>
              <p className="font-bold text-brand">
                Server amount: {amount.format(tracking.data.totalAmount)}
              </p>
            </Card>
            <WorkflowStepper
              stages={tracking.data.stages.map((stage) => ({
                id: stage.key,
                label: stage.name,
                state:
                  stage.status === 'APPROVED'
                    ? 'completed'
                    : stage.status === 'IN_PROGRESS'
                      ? 'active'
                      : stage.status === 'RETURNED'
                        ? 'returned'
                        : 'pending',
                detail: [
                  stage.actorName,
                  stage.completedAt
                    ? date.format(new Date(stage.completedAt))
                    : null,
                  stage.comments,
                ]
                  .filter(Boolean)
                  .join(' · '),
              }))}
            />
          </>
        )}
      </section>

      <section aria-labelledby="history-title" className="space-y-3">
        <h2 id="history-title" className="text-xl font-bold text-brand">
          Approval history
        </h2>
        {!history.data && (
          <RequestLoadState title="Approval history" resource={history} />
        )}
        {history.data && history.data.events.length === 0 && (
          <EmptyState title="No history is available yet">
            <p>The backend has not returned any audit events.</p>
          </EmptyState>
        )}
        {history.data && history.data.events.length > 0 && (
          <ol className="space-y-3">
            {history.data.events.map((event) => (
              <li key={event.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-brand">
                        {event.actionType.replaceAll('_', ' ')}
                      </p>
                      <p className="text-sm text-muted">
                        {event.actorName} ·{' '}
                        {event.actorRole.replaceAll('_', ' ')}
                      </p>
                    </div>
                    <time
                      dateTime={event.createdAt}
                      className="text-sm text-muted"
                    >
                      {date.format(new Date(event.createdAt))}
                    </time>
                  </div>
                  <p className="mt-3 text-sm text-ink">
                    {event.previousStatus?.replaceAll('_', ' ') ??
                      'Initial state'}{' '}
                    → {event.newStatus.replaceAll('_', ' ')}
                  </p>
                  {event.comment && (
                    <p className="mt-2 text-sm">{event.comment}</p>
                  )}
                  {event.fieldDiff &&
                    Object.keys(event.fieldDiff).length > 0 && (
                      <details className="mt-3 rounded-control border border-border p-3">
                        <summary className="cursor-pointer font-semibold text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action">
                          Changed fields
                        </summary>
                        <dl className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
                          {Object.entries(event.fieldDiff).map(
                            ([field, value]) => (
                              <div
                                key={field}
                                className="min-w-0 [overflow-wrap:anywhere]"
                              >
                                <dt className="text-sm text-muted">{field}</dt>
                                <dd className="font-medium text-ink">
                                  {typeof value === 'string'
                                    ? value
                                    : (JSON.stringify(value) ?? '—')}
                                </dd>
                              </div>
                            ),
                          )}
                        </dl>
                      </details>
                    )}
                </Card>
              </li>
            ))}
          </ol>
        )}
      </section>
    </section>
  );
}
