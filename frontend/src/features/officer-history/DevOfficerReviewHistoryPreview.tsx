import { Fragment, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Alert, EmptyState } from '../../components/common/Feedback';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Table, TableCell, TableHead } from '../../components/common/Table';
import { RequestStatusBadge } from '../../components/tracking/RequestStatusBadge';
import { reviewHistoryFixtures } from './reviewHistoryFixtures';
import { filterReviewHistory } from './reviewHistoryModel';
import type {
  ReviewDecisionStatus,
  ReviewHistoryDateRange,
} from './reviewHistoryModel';

const dateFormat = new Intl.DateTimeFormat('en-LK', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});
const dateTimeFormat = new Intl.DateTimeFormat('en-LK', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function DemoAuditHistory({ entryId }: { entryId: string }) {
  const entry = reviewHistoryFixtures.find((item) => item.id === entryId);
  if (!entry) return null;

  return (
    <section aria-label="Fictional audit history" className="space-y-4">
      <h3 className="font-semibold text-brand">Fictional audit history</h3>
      <ol className="space-y-3 border-l-2 border-slate-200 pl-4">
        {entry.events.map((event) => (
          <li key={event.id} className="relative space-y-1">
            <span
              aria-hidden="true"
              className="absolute -left-[1.35rem] top-1 h-2 w-2 rounded-full bg-success"
            />
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <p className="font-semibold text-brand">{event.action}</p>
              <time dateTime={event.occurredAt} className="text-xs text-muted">
                {dateTimeFormat.format(new Date(event.occurredAt))}
              </time>
            </div>
            <p className="text-sm text-muted">
              {event.actor} · {event.role}
            </p>
            <p className="text-sm text-ink">{event.summary}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

export function DevOfficerReviewHistoryPreview() {
  const [search, setSearch] = useState('');
  const [decision, setDecision] = useState<ReviewDecisionStatus | 'all'>('all');
  const [department, setDepartment] = useState<string | 'all'>('all');
  const [dateRange, setDateRange] = useState<ReviewHistoryDateRange>('all');
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  const filteredEntries = useMemo(
    () =>
      filterReviewHistory(reviewHistoryFixtures, {
        search,
        decision,
        department,
        dateRange,
      }),
    [search, decision, department, dateRange],
  );
  const returnedCount = reviewHistoryFixtures.filter(
    (entry) => entry.decision === 'RETURNED_FOR_CORRECTION',
  ).length;
  const departments = [
    ...new Set(reviewHistoryFixtures.map((entry) => entry.department)),
  ];

  return (
    <section
      aria-labelledby="review-history-preview-title"
      className="space-y-6"
    >
      <Alert title="Development preview — fictional data only" tone="warning">
        <p>
          These sample applications and audit events are stored in the frontend
          source for visual checks. Filters operate only on these fixtures. No
          backend requests are made, and this preview is excluded from
          production routes.
        </p>
      </Alert>

      <header>
        <h1
          id="review-history-preview-title"
          className="text-display font-bold text-brand"
        >
          Review History
        </h1>
        <p className="mt-2 text-muted">
          Fictional completed reviews · sample officer activity only
        </p>
      </header>

      <Card className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 sm:items-center xl:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)_minmax(0,2fr)]">
        <div className="min-w-0">
          <p className="text-sm text-muted">Sample completed decisions</p>
          <p className="mt-1 text-2xl font-bold text-brand">
            {reviewHistoryFixtures.length}
          </p>
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted">Returned for correction (sample)</p>
          <p className="mt-1 text-2xl font-bold text-brand">
            {String(returnedCount).padStart(2, '0')}
          </p>
        </div>
        <p className="min-w-0 break-words text-sm text-muted sm:col-span-2 xl:col-span-1 sm:text-left xl:text-right">
          View scope: fictional sample actions and sample audit events only
        </p>
      </Card>

      <Card className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(13rem,1.4fr)_repeat(3,minmax(10rem,1fr))]">
        <div className="min-w-0">
          <label
            htmlFor="review-history-search"
            className="mb-1 block text-xs font-semibold text-muted"
          >
            Search reference or applicant
          </label>
          <input
            id="review-history-search"
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search reference / applicant…"
            className="min-h-11 w-full rounded-control border border-border bg-slate-100 px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
          />
        </div>

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
              setDecision(event.target.value as ReviewDecisionStatus | 'all')
            }
            className="min-h-11 w-full rounded-control border border-border bg-slate-100 px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
          >
            <option value="all">All decisions</option>
            <option value="APPROVED">Approved</option>
            <option value="RETURNED_FOR_CORRECTION">
              Returned for correction
            </option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>

        <div className="min-w-0">
          <label
            htmlFor="review-history-department"
            className="mb-1 block text-xs font-semibold text-muted"
          >
            Department
          </label>
          <select
            id="review-history-department"
            value={department}
            onChange={(event) => setDepartment(event.target.value)}
            className="min-h-11 w-full rounded-control border border-border bg-slate-100 px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
          >
            <option value="all">All sample departments</option>
            {departments.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-0">
          <label
            htmlFor="review-history-date-range"
            className="mb-1 block text-xs font-semibold text-muted"
          >
            Date range
          </label>
          <select
            id="review-history-date-range"
            value={dateRange}
            onChange={(event) =>
              setDateRange(event.target.value as ReviewHistoryDateRange)
            }
            className="min-h-11 w-full rounded-control border border-border bg-slate-100 px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
          >
            <option value="all">All dates</option>
            <option value="this-month">This month</option>
            <option value="last-month">Last month</option>
          </select>
        </div>
      </Card>

      <div aria-live="polite" className="sr-only">
        {filteredEntries.length} sample decisions shown
      </div>

      {filteredEntries.length === 0 ? (
        <EmptyState title="No sample decisions match these filters">
          <p>Change the search or select a different filter.</p>
        </EmptyState>
      ) : (
        <Card className="space-y-4">
          <Table
            caption="Development-only sample officer review history"
            variant="officer"
          >
            <thead>
              <tr className="bg-[#e4edf1]">
                <TableHead>Reference</TableHead>
                <TableHead>Applicant / Type</TableHead>
                <TableHead>Sample decision</TableHead>
                <TableHead>Decision date</TableHead>
                <TableHead>Details</TableHead>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry, index) => {
                const isExpanded = expandedEntry === entry.id;
                const historyPanelId = `sample-history-${entry.id}`;
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
                      <TableCell>
                        <p className="font-semibold text-brand">
                          {entry.applicant}
                        </p>
                        <p className="mt-1 text-xs text-muted">
                          {entry.claimType}
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
                          aria-expanded={isExpanded}
                          aria-controls={historyPanelId}
                          onClick={() =>
                            setExpandedEntry(isExpanded ? null : entry.id)
                          }
                        >
                          View history
                          <span aria-hidden="true">→</span>
                        </Button>
                      </TableCell>
                    </tr>
                    <tr
                      id={historyPanelId}
                      hidden={!isExpanded}
                      className="bg-white"
                    >
                      <td
                        colSpan={5}
                        className="border-b border-border px-5 py-5"
                      >
                        <DemoAuditHistory entryId={entry.id} />
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </Table>

          <p className="text-xs text-muted">
            Search, filters, and history details on this screen operate against
            fictional preview records only. There is no pagination contract for
            officer review history.
          </p>
        </Card>
      )}

      <Card className="space-y-2">
        <h2 className="font-semibold text-brand">
          Review history versus full audit trail
        </h2>
        <p className="text-sm text-muted">
          This demonstration lists sample officer decisions. A production list
          must be scoped by the backend. Opening a live application requires
          verified request-level authorization, including the reviewer&apos;s
          role, department, and current workflow stage.
        </p>
        <Link
          to="/officer/queue"
          className="inline-flex min-h-10 items-center font-semibold text-action underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
        >
          Return to the Approval Queue
        </Link>
      </Card>
    </section>
  );
}
