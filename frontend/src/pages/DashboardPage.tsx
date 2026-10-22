import { Link } from 'react-router-dom';
import { useSession } from '../auth/session';
import { decodeProfile } from '../auth/contracts';
import { Alert, EmptyState, Skeleton } from '../components/common/Feedback';
import { Card } from '../components/common/Card';
import { RequestStatusBadge } from '../components/tracking/RequestStatusBadge';
import {
  countRecentRequestStatuses,
  latestDraftHref,
  latestTrackableRequestHref,
  recentRequestTitle,
  requestHref,
} from '../features/lecturer-dashboard/dashboardData';
import {
  decodeRequestPage,
  type RequestListItem,
} from '../features/requests/contracts';
import { useRequestResource } from '../features/requests/useRequestResource';

const pageSize = 5;
const dateFormat = new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium' });

function ActionLink({
  to,
  title,
  description,
  emphasis = false,
}: {
  to: string;
  title: string;
  description: string;
  emphasis?: boolean;
}) {
  return (
    <Link
      to={to}
      className={
        'group flex min-h-20 items-center justify-between gap-4 rounded-card border p-4 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action ' +
        (emphasis
          ? 'border-action bg-action text-white hover:bg-blue-700'
          : 'border-slate-200 bg-white text-brand hover:border-action hover:bg-blue-50')
      }
    >
      <span className="min-w-0">
        <span className="block font-semibold">{title}</span>
        <span
          className={
            'mt-1 block text-sm ' + (emphasis ? 'text-blue-100' : 'text-muted')
          }
        >
          {description}
        </span>
      </span>
      <span aria-hidden="true" className="shrink-0 text-xl">
        →
      </span>
    </Link>
  );
}

function MetricCard({
  title,
  value,
  description,
  marker,
}: {
  title: string;
  value: number;
  description: string;
  marker: string;
}) {
  return (
    <Card
      role="group"
      aria-label={title}
      className="flex min-h-36 items-start gap-4 p-5"
    >
      <span
        aria-hidden="true"
        className="grid size-11 shrink-0 place-items-center rounded-control bg-blue-50 font-bold text-action"
      >
        {marker}
      </span>
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-muted">{title}</h2>
        <p className="mt-2 text-3xl font-bold tabular-nums text-brand">
          {value}
        </p>
        <p className="mt-1 text-xs text-muted">{description}</p>
      </div>
    </Card>
  );
}

function RequestError({
  title,
  message,
  retry,
  canRetry,
}: {
  title: string;
  message: string;
  retry?: () => void;
  canRetry: boolean;
}) {
  return (
    <Alert title={title} tone={canRetry ? 'danger' : 'info'} urgent={canRetry}>
      <p>{message}</p>
      {canRetry && retry && (
        <button
          type="button"
          onClick={retry}
          className="mt-3 min-h-11 rounded-control border border-current px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
        >
          Retry
        </button>
      )}
    </Alert>
  );
}

function ApplicationRow({ item }: { item: RequestListItem }) {
  return (
    <li className="min-w-0">
      <Link
        to={requestHref(item)}
        className="flex min-h-20 min-w-0 flex-col justify-between gap-3 rounded-control border border-slate-200 p-4 transition-colors hover:border-action hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action sm:flex-row sm:items-center"
      >
        <span className="min-w-0">
          <span className="block break-words font-semibold text-brand">
            {recentRequestTitle(item)}
          </span>
          <span className="mt-1 block break-words text-sm text-muted">
            {item.requestType} · {dateFormat.format(new Date(item.createdAt))}
          </span>
          <span className="mt-1 block text-xs text-muted">
            Tracking {item.trackingNumber}
          </span>
        </span>
        <span className="flex shrink-0 items-center justify-between gap-3 sm:justify-end">
          <RequestStatusBadge status={item.status} />
          <span aria-hidden="true" className="text-action">
            →
          </span>
        </span>
      </Link>
    </li>
  );
}

export function DashboardPage() {
  const session = useSession();
  const profile = useRequestResource(
    session.status === 'authenticated' ? '/auth/me' : null,
    decodeProfile,
  );
  const lecturer =
    profile.status === 'ready' && profile.data?.role === 'LECTURER';
  const requests = useRequestResource(
    lecturer ? '/requests/my-requests' : null,
    decodeRequestPage,
    { page: '1', limit: String(pageSize) },
  );

  if (session.status === 'signing-in')
    return (
      <Card>
        <Skeleton label="Signing in to your account" />
      </Card>
    );

  if (session.status !== 'authenticated') {
    const title =
      session.status === 'expired' || session.status === 'unauthorized'
        ? 'Your session is no longer available'
        : session.status === 'error'
          ? 'Your account could not be verified'
          : session.status === 'unavailable'
            ? 'Dashboard sign-in is not configured'
            : 'Sign in to view your dashboard';
    return (
      <section aria-labelledby="dashboard-title" className="space-y-6">
        <header>
          <h1
            id="dashboard-title"
            className="text-display font-bold text-brand"
          >
            Lecturer Dashboard
          </h1>
        </header>
        <Alert
          title={title}
          tone={
            session.status === 'expired' || session.status === 'unauthorized'
              ? 'warning'
              : 'info'
          }
        >
          <p>
            {session.status === 'unavailable'
              ? 'Production sign-in is not configured, so authenticated lecturer requests cannot be loaded.'
              : session.message ||
                'Authenticated lecturer information is not available in this environment.'}
          </p>
        </Alert>
      </section>
    );
  }

  if (profile.status === 'loading')
    return (
      <section aria-labelledby="dashboard-title" className="space-y-6">
        <h1 id="dashboard-title" className="text-display font-bold text-brand">
          Lecturer Dashboard
        </h1>
        <Card>
          <Skeleton label="Loading your verified lecturer profile" />
        </Card>
      </section>
    );

  if (profile.status === 'error' || profile.status === 'unavailable') {
    const unauthorized = profile.errorKind === 'unauthorized';
    return (
      <section aria-labelledby="dashboard-title" className="space-y-6">
        <h1 id="dashboard-title" className="text-display font-bold text-brand">
          Lecturer Dashboard
        </h1>
        <RequestError
          title={
            unauthorized
              ? 'Your session has expired'
              : profile.status === 'unavailable'
                ? 'Lecturer information is unavailable'
                : profile.errorKind === 'forbidden'
                  ? 'This account cannot access lecturer information'
                  : 'Could not verify your lecturer account'
          }
          message={profile.message}
          retry={profile.retry}
          canRetry={
            profile.status === 'error' &&
            profile.errorKind !== 'unauthorized' &&
            profile.errorKind !== 'forbidden'
          }
        />
      </section>
    );
  }

  if (profile.data?.role !== 'LECTURER') {
    return (
      <section aria-labelledby="dashboard-title" className="space-y-6">
        <h1 id="dashboard-title" className="text-display font-bold text-brand">
          Lecturer Dashboard
        </h1>
        <Alert title="Lecturer dashboard is not available for this account">
          <p>
            This dashboard only displays data for a verified lecturer account.
          </p>
        </Alert>
      </section>
    );
  }

  const items = requests.data?.data ?? [];
  const counts = countRecentRequestStatuses(items);
  const draftHref = latestDraftHref(items) ?? '/requests';
  const trackHref = latestTrackableRequestHref(items) ?? '/requests';
  const countScope = 'Of these ' + items.length + ' recent requests';

  return (
    <section aria-labelledby="dashboard-title" className="space-y-7">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-action">Lecturer portal</p>
          <h1
            id="dashboard-title"
            className="mt-1 break-words text-display font-bold text-brand"
          >
            Welcome, {profile.data.fullName}
          </h1>
          <p className="mt-2 text-muted">
            View your applications and continue where you left off.
          </p>
        </div>
        <ActionLink
          to="/requests/new"
          title="New Application"
          description="Start a Paper Setting & Marking claim"
          emphasis
        />
      </header>

      {requests.status === 'loading' && (
        <Card>
          <Skeleton label="Loading your applications" />
        </Card>
      )}

      {(requests.status === 'error' || requests.status === 'unavailable') && (
        <RequestError
          title={
            requests.errorKind === 'unauthorized'
              ? 'Your session has expired'
              : requests.errorKind === 'forbidden'
                ? 'You are not authorized to view these requests'
                : requests.status === 'unavailable'
                  ? 'Your applications are unavailable'
                  : 'Could not load your applications'
          }
          message={requests.message}
          retry={requests.retry}
          canRetry={
            requests.status === 'error' &&
            requests.errorKind !== 'unauthorized' &&
            requests.errorKind !== 'forbidden'
          }
        />
      )}

      {requests.data && (
        <>
          <section aria-labelledby="summary-title" className="space-y-3">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
              <h2 id="summary-title" className="text-lg font-bold text-brand">
                Request overview
              </h2>
              <p className="text-xs text-muted">
                Status counts use only the latest {items.length} requests; the
                API does not provide per-status totals.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                title="Total requests"
                value={requests.data.meta.total}
                description="All pages, including drafts"
                marker="Σ"
              />
              <MetricCard
                title="Pending / Under Review"
                value={counts.pending}
                description={countScope}
                marker="…"
              />
              <MetricCard
                title="Returned for Correction"
                value={counts.returned}
                description={countScope}
                marker="↩"
              />
              <MetricCard
                title="Approved / Completed"
                value={counts.completed}
                description={countScope}
                marker="✓"
              />
            </div>
          </section>

          <section aria-labelledby="quick-actions-title" className="space-y-3">
            <h2
              id="quick-actions-title"
              className="text-lg font-bold text-brand"
            >
              Quick actions
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <ActionLink
                to="/requests/new"
                title="New Application"
                description="Prepare a new claim"
              />
              <ActionLink
                to={draftHref}
                title="Continue Draft"
                description={
                  latestDraftHref(items)
                    ? 'Resume your most recent draft'
                    : 'View your requests to find a saved draft'
                }
              />
              <ActionLink
                to="/requests"
                title="My Requests"
                description="Browse your applications"
              />
              <ActionLink
                to={trackHref}
                title="Track Applications"
                description={
                  latestTrackableRequestHref(items)
                    ? 'Open your latest submitted application'
                    : 'View your requests and tracking details'
                }
              />
            </div>
          </section>

          <section aria-labelledby="recent-applications-title">
            <Card className="space-y-4">
              <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2
                    id="recent-applications-title"
                    className="text-lg font-bold text-brand"
                  >
                    Recent applications
                  </h2>
                  <p className="mt-1 text-sm text-muted">
                    Your latest {items.length} requests, newest first.
                  </p>
                </div>
                <Link
                  to="/requests"
                  className="min-h-11 rounded-control px-3 py-2 font-semibold text-action underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
                >
                  View all requests
                </Link>
              </div>

              {requests.data.data.length === 0 ? (
                <EmptyState title="No applications yet">
                  <p>Your account has no saved or submitted requests.</p>
                  <Link
                    to="/requests/new"
                    className="mt-3 inline-block rounded-control font-semibold text-action underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
                  >
                    Start a new application
                  </Link>
                </EmptyState>
              ) : (
                <ul className="space-y-3">
                  {requests.data.data.map((item) => (
                    <ApplicationRow key={item.id} item={item} />
                  ))}
                </ul>
              )}
            </Card>
          </section>
        </>
      )}
    </section>
  );
}
