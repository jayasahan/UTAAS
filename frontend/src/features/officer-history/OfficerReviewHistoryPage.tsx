import { Fragment, type FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { useOfficerAccess } from '../officer-queue/officerAccess';
import { OfficerAccessFeedback } from '../officer-queue/OfficerPortalLayout';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Alert, EmptyState, Skeleton } from '../../components/common/Feedback';
import { Table, TableCell, TableHead } from '../../components/common/Table';
import { RequestStatusBadge } from '../../components/tracking/RequestStatusBadge';
import { useRequestResource } from '../requests/useRequestResource';
import {
  buildReviewHistoryQuery,
  decodeReviewHistoryPage,
} from './reviewHistoryModel';
import type {
  ReviewDecisionStatus,
  ReviewHistoryScope,
} from './reviewHistoryModel';

const pageSize = 10;
const decisionOptions: {
  value: ReviewDecisionStatus | 'all';
  label: string;
}[] = [
  { value: 'all', label: 'All decisions' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'RETURNED_FOR_CORRECTION', label: 'Returned for correction' },
  { value: 'REJECTED', label: 'Rejected' },
];

const dateFormat = new Intl.DateTimeFormat('en-LK', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});
const dateTimeFormat = new Intl.DateTimeFormat('en-LK', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const roleNames: Record<string, string> = {
  DEAN: 'Dean',
  EXAMINATION_OFFICER: 'Examination Officer',
  FINANCIAL_OFFICER: 'Financial Officer',
  ASSISTANT_BURSAR: 'Assistant Bursar',
};

function roleScopeLabel(role: string): string {
  if (role === 'HOD') return 'All HOD decisions in my department';
  if (role === 'ADMIN') return 'All completed decisions';
  return `All ${roleNames[role] ?? role} decisions`;
}

function roleScopeDescription(role: string): string {
  if (role === 'HOD')
    return 'Role-wide results remain restricted to your verified department by the backend.';
  if (role === 'ADMIN')
    return 'The backend returns completed reviews available to administrators.';
  return 'The backend returns completed decisions for your authenticated reviewer role.';
}

function SummaryCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 text-2xl font-bold text-brand">{value}</p>
    </Card>
  );
}

function ReviewHistoryContent() {
  const { profile } = useOfficerAccess();
  const role = profile.data!.role;
  const [scope, setScope] = useState<ReviewHistoryScope>('personal');
  const [decision, setDecision] = useState<ReviewDecisionStatus | 'all'>('all');
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);
  const query = buildReviewHistoryQuery({
    page,
    limit: pageSize,
    decision,
    search,
    scope,
  });
  const resource = useRequestResource(
    '/requests/review-history',
    decodeReviewHistoryPage,
    query,
  );

  function applySearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPage(1);
    setExpandedEntry(null);
    setSearch(searchDraft.trim());
  }

  function changeDecision(value: ReviewDecisionStatus | 'all') {
    setPage(1);
    setExpandedEntry(null);
    setDecision(value);
  }

  function changeScope(value: ReviewHistoryScope) {
    setPage(1);
    setExpandedEntry(null);
    setScope(value);
  }

  const data = resource.status === 'ready' ? resource.data : null;
  const summary = data?.meta.summaryCounts;
  const totalReviewed = summary
    ? summary.approved + summary.returned + summary.rejected
    : null;

  return (
    <section
      aria-labelledby="review-history-title"
      className="min-w-0 space-y-6"
    >
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1
            id="review-history-title"
            className="text-display font-bold text-brand"
          >
            Review History
          </h1>
          <p className="mt-2 text-muted">
            Completed Paper Setting &amp; Marking reviews
          </p>
        </div>
        <Link
          to="/officer/queue"
          className="inline-flex min-h-11 shrink-0 items-center rounded-control border border-border bg-white px-4 py-2 font-semibold text-brand hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
        >
          ← Back to Approval Queue
        </Link>
      </header>

      <Card className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="min-w-0">
          <label
            htmlFor="review-history-scope"
            className="mb-1 block text-xs font-semibold text-muted"
          >
            History scope
          </label>
          <select
            id="review-history-scope"
            value={scope}
            onChange={(event) =>
              changeScope(event.target.value as ReviewHistoryScope)
            }
            className="min-h-11 w-full rounded-control border border-border bg-slate-100 px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
          >
            <option value="personal">My decisions (default)</option>
            <option value="role">{roleScopeLabel(role)}</option>
          </select>
          <p className="mt-2 text-xs text-muted">
            {scope === 'personal'
              ? 'Only completed decisions recorded against your officer account.'
              : roleScopeDescription(role)}
          </p>
        </div>

        <form
          role="search"
          onSubmit={applySearch}
          className="min-w-0 sm:col-span-2 xl:col-span-1"
        >
          <label
            htmlFor="review-history-search"
            className="mb-1 block text-xs font-semibold text-muted"
          >
            Search tracking number or applicant
          </label>
          <div className="flex gap-2">
            <input
              id="review-history-search"
              type="search"
              value={searchDraft}
              onChange={(event) => setSearchDraft(event.target.value)}
              placeholder="Search reviews…"
              className="min-h-11 min-w-0 flex-1 rounded-control border border-border bg-slate-100 px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
            />
            <Button type="submit" className="shrink-0 px-3">
              Search
            </Button>
          </div>
        </form>

        <div className="min-w-0">
          <label
            htmlFor="review-history-decision"
            className="mb-1 block text-xs font-semibold text-muted"
          >
            Decision
          </label>
          <select
            id="review-history-decision"
            value={decision}
            onChange={(event) =>
              changeDecision(event.target.value as ReviewDecisionStatus | 'all')
            }
            className="min-h-11 w-full rounded-control border border-border bg-slate-100 px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
          >
            {decisionOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </Card>

      {resource.status === 'loading' && (
        <Card aria-label="Loading review history">
          <Skeleton label="Loading officer review history" />
        </Card>
      )}

      {(resource.status === 'error' || resource.status === 'unavailable') && (
        <Alert
          title={
            resource.errorKind === 'unauthorized'
              ? 'Your session has expired'
              : resource.errorKind === 'forbidden'
                ? 'Review history access is denied'
                : resource.status === 'unavailable'
                  ? 'Review history is unavailable'
                  : 'Could not load review history'
          }
          tone={resource.errorKind === 'forbidden' ? 'danger' : 'warning'}
          urgent={
            resource.errorKind === 'unauthorized' ||
            resource.errorKind === 'forbidden'
          }
        >
          <p>{resource.message}</p>
          {resource.errorKind === 'unauthorized' ? (
            <Link
              to="/login"
              className="mt-3 inline-flex min-h-10 items-center font-semibold underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
            >
              Sign in again
            </Link>
          ) : (
            <Button variant="ghost" className="mt-3" onClick={resource.retry}>
              Retry
            </Button>
          )}
        </Alert>
      )}

      {data && (
        <>
          <div
            aria-label="Review history summary"
            className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            <SummaryCard
              label="Completed reviews in scope"
              value={totalReviewed!}
            />
            <SummaryCard label="Approved" value={summary!.approved} />
            <SummaryCard
              label="Returned for correction"
              value={summary!.returned}
            />
            <SummaryCard label="Rejected" value={summary!.rejected} />
          </div>

          <p className="text-sm text-muted">
            Summary totals come from the backend for the selected scope and
            search. Decision filtering and pagination affect the table results.
          </p>

          <div aria-live="polite" className="sr-only">
            {data.meta.total} matching reviews on page {data.meta.page} of{' '}
            {data.meta.totalPages}.
          </div>

          {data.data.length === 0 ? (
            <EmptyState title="No completed reviews found">
              <p>Try a different search, decision, or history scope.</p>
            </EmptyState>
          ) : (
            <Card className="min-w-0 space-y-4">
              <Table
                caption="Officer completed review history"
                variant="officer"
              >
                <thead>
                  <tr className="bg-[#e4edf1]">
                    <TableHead>Reference</TableHead>
                    <TableHead>Applicant / Claim / Department</TableHead>
                    <TableHead>Decision</TableHead>
                    <TableHead>Decision date</TableHead>
                    <TableHead>Activity</TableHead>
                  </tr>
                </thead>
                <tbody>
                  {data.data.map((entry, index) => {
                    const expanded = expandedEntry === entry.id;
                    const historyId = `review-activity-${entry.id}`;
                    return (
                      <Fragment key={entry.id}>
                        <tr
                          className={
                            index % 2 === 0 ? 'bg-slate-50/70' : 'bg-white'
                          }
                        >
                          <TableCell className="whitespace-nowrap font-bold text-brand">
                            {entry.trackingNumber}
                          </TableCell>
                          <TableCell className="min-w-48">
                            <p className="font-semibold text-brand">
                              {entry.applicant}
                            </p>
                            <p className="mt-1 text-xs text-muted">
                              {entry.claimType}
                            </p>
                            <p className="mt-1 text-xs text-muted">
                              {entry.department}
                              {entry.departmentCode
                                ? ` · ${entry.departmentCode}`
                                : ''}
                            </p>
                          </TableCell>
                          <TableCell>
                            <RequestStatusBadge status={entry.decision} />
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <time dateTime={entry.decisionDate}>
                              {dateFormat.format(new Date(entry.decisionDate))}
                            </time>
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              className="min-h-10 whitespace-nowrap px-3 py-2 text-xs text-action"
                              aria-expanded={expanded}
                              aria-controls={historyId}
                              onClick={() =>
                                setExpandedEntry(expanded ? null : entry.id)
                              }
                            >
                              {expanded ? 'Hide activity' : 'View activity'}
                            </Button>
                          </TableCell>
                        </tr>
                        <tr
                          id={historyId}
                          hidden={!expanded}
                          className="bg-white"
                        >
                          <td
                            colSpan={5}
                            className="border-b border-border px-5 py-5"
                          >
                            <section
                              aria-label={`Activity for ${entry.trackingNumber}`}
                              className="space-y-3"
                            >
                              <h2 className="font-semibold text-brand">
                                Request activity
                              </h2>
                              {entry.events.length === 0 ? (
                                <p className="text-sm text-muted">
                                  No activity details were returned for this
                                  review.
                                </p>
                              ) : (
                                <ol className="space-y-3 border-l-2 border-slate-200 pl-4">
                                  {entry.events.map((event) => (
                                    <li
                                      key={event.id}
                                      className="relative space-y-1"
                                    >
                                      <span
                                        aria-hidden="true"
                                        className="absolute -left-[1.35rem] top-1 h-2 w-2 rounded-full bg-success"
                                      />
                                      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                                        <p className="font-semibold text-brand">
                                          {event.action}
                                        </p>
                                        <time
                                          dateTime={event.occurredAt}
                                          className="text-xs text-muted"
                                        >
                                          {dateTimeFormat.format(
                                            new Date(event.occurredAt),
                                          )}
                                        </time>
                                      </div>
                                      <p className="text-sm text-muted">
                                        {event.actor} · {event.role}
                                      </p>
                                      <p className="text-sm text-ink">
                                        {event.summary}
                                      </p>
                                    </li>
                                  ))}
                                </ol>
                              )}
                              <p className="text-xs text-muted">
                                Activity is shown as returned by the authorized
                                review-history endpoint; it is not a claim that
                                every event was performed by the selected
                                reviewer.
                              </p>
                            </section>
                          </td>
                        </tr>
                      </Fragment>
                    );
                  })}
                </tbody>
              </Table>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-muted">
                  {data.meta.total} matching review
                  {data.meta.total === 1 ? '' : 's'}
                </p>
                {data.meta.totalPages > 0 && (
                  <nav
                    aria-label="Review history pages"
                    className="flex items-center gap-2"
                  >
                    <Button
                      variant="ghost"
                      disabled={data.meta.page <= 1}
                      onClick={() => {
                        setExpandedEntry(null);
                        setPage((value) => Math.max(1, value - 1));
                      }}
                    >
                      Previous
                    </Button>
                    <span aria-current="page" className="text-sm text-muted">
                      Page {data.meta.page} of {data.meta.totalPages}
                    </span>
                    <Button
                      variant="ghost"
                      disabled={data.meta.page >= data.meta.totalPages}
                      onClick={() => {
                        setExpandedEntry(null);
                        setPage((value) => value + 1);
                      }}
                    >
                      Next
                    </Button>
                  </nav>
                )}
              </div>
            </Card>
          )}
        </>
      )}

      <Link
        to="/officer/queue"
        className="inline-flex min-h-10 items-center font-semibold text-action underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
      >
        Return to the Approval Queue
      </Link>
    </section>
  );
}

export function OfficerReviewHistoryPage() {
  return (
    <OfficerAccessFeedback>
      <ReviewHistoryContent />
    </OfficerAccessFeedback>
  );
}
