import { Card } from '../common/Card';
import { EmptyState } from '../common/Feedback';
import type { RequestHistory } from '../../features/requests/contracts';
import {
  chronologicalEvents,
  eventFacts,
  eventTitle,
  proposalSuperseded,
} from '../../features/requests/workflowTracking';

const date = new Intl.DateTimeFormat('en-LK', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
export function WorkflowHistory({
  history,
  emptyTitle = 'No history is available yet',
}: {
  history: RequestHistory;
  emptyTitle?: string;
}) {
  const events = chronologicalEvents(history);
  if (!events.length)
    return (
      <EmptyState title={emptyTitle}>
        <p>The backend has not returned any audit events.</p>
      </EmptyState>
    );
  return (
    <ol aria-label="Chronological workflow events" className="space-y-3">
      {events.map((event) => (
        <li key={event.id}>
          <Card className="space-y-3 [overflow-wrap:anywhere]">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h3 className="font-semibold text-brand">
                  {eventTitle(event)}
                </h3>
                <p className="text-sm text-muted">
                  {event.actorName} · {event.actorRole.replaceAll('_', ' ')}
                </p>
              </div>
              <time dateTime={event.createdAt} className="text-sm text-muted">
                {date.format(new Date(event.createdAt))}
              </time>
            </div>
            <p className="text-sm">
              {event.previousStatus?.replaceAll('_', ' ') ?? 'Initial state'} →{' '}
              {event.newStatus.replaceAll('_', ' ')}
            </p>
            {event.actionType === 'LECTURER_PROPORTION_DISAGREED' && (
              <p className="text-sm font-semibold text-warning-ink">
                Disagreement with the proportions is distinct from claim
                rejection.
              </p>
            )}
            {proposalSuperseded(event, events) && (
              <p className="text-sm font-semibold text-warning-ink">
                Earlier proposal — superseded by a later recorded proposal.
              </p>
            )}
            {event.actionType === 'PAPER_STRUCTURE_CORRECTED_RESET' && (
              <p className="text-sm font-semibold text-warning-ink">
                The approval workflow was reset. Fresh approval may be required;
                earlier audit events are retained.
              </p>
            )}
            {event.fieldDiff?.officerApprovalsRevoked === true && (
              <p className="text-sm">
                Officer approvals were recorded as revoked. Individual reset
                stages were not supplied.
              </p>
            )}
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              {eventFacts(event).map((fact) => (
                <div key={fact.label}>
                  <dt className="text-muted">{fact.label}</dt>
                  <dd>{fact.value}</dd>
                </div>
              ))}
            </dl>
            {event.comment && (
              <p className="whitespace-pre-wrap text-sm">{event.comment}</p>
            )}
            {event.fieldDiff && Object.keys(event.fieldDiff).length > 0 && (
              <details className="rounded-control border border-border p-3">
                <summary className="cursor-pointer font-semibold text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action">
                  Changed fields
                </summary>
                <dl className="mt-3 grid min-w-0 gap-3 sm:grid-cols-2">
                  {Object.entries(event.fieldDiff).map(([field, value]) => (
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
                  ))}
                </dl>
              </details>
            )}
          </Card>
        </li>
      ))}
    </ol>
  );
}
