import { Button } from '../../../components/common/Button';
import { Skeleton } from '../../../components/common/Feedback';
import type { useReadOnlyData } from '../useReadOnlyData';

export function ReadOnlyInformation({
  integration,
}: {
  integration: ReturnType<typeof useReadOnlyData>;
}) {
  const { session, profile, circular } = integration;
  return (
    <section
      aria-label="Backend identity and circular rates"
      className="min-w-0 space-y-4 rounded-card border border-border bg-surface p-6 [overflow-wrap:anywhere]"
    >
      <h2 className="text-lg font-bold text-brand">
        Staff profile & circular rates
      </h2>
      {!session.client ? (
        <p role="status" className="text-sm text-muted">
          {session.message}
        </p>
      ) : (
        <>
          {profile.status === 'loading' && (
            <Skeleton label="Loading authenticated staff profile" />
          )}
          {profile.data && (
            <div className="space-y-2 text-sm">
              <p className="font-semibold">
                Backend profile retrieved (development persona)
              </p>
              <p>
                {profile.data.fullName} · Department code:{' '}
                {profile.data.departmentCode ?? 'Unavailable'}
              </p>
              <p>
                Only untouched matching fields are populated. Designation and
                staff ID are not supplied by this endpoint. User edits remain
                local and are not reverified.
              </p>
            </div>
          )}
          {(profile.status === 'error' || profile.status === 'unavailable') && (
            <div role="status">
              <p>Staff profile unavailable: {profile.message}</p>
              <Button variant="ghost" onClick={profile.retry}>
                Retry staff profile
              </Button>
            </div>
          )}
          {circular.status === 'loading' && (
            <Skeleton label="Loading circular payment rates" />
          )}
          {circular.data && (
            <div className="space-y-3">
              <h3 className="font-semibold text-brand">
                Backend circular: {circular.data.circularReference}
              </h3>
              {Object.keys(circular.data.rates).length ? (
                <dl className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
                  {Object.entries(circular.data.rates).map(([key, item]) => (
                    <div
                      key={key}
                      className="min-w-0 rounded-control bg-slate-50 p-3"
                    >
                      <dt className="text-sm font-semibold">{item.label}</dt>
                      <dd>
                        {new Intl.NumberFormat('en-LK', {
                          maximumFractionDigits: 20,
                        }).format(item.rate)}{' '}
                        · {item.unit}
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p>No rates are available in this circular.</p>
              )}
              <p className="text-sm text-muted">
                These are LKR reference rates with their returned units. Only
                supported units are used for estimates; no hourly rate is
                inferred from a candidate rate. Server-confirmed payment
                breakdowns and totals remain authoritative. The endpoint does
                not return an effective date.
              </p>
            </div>
          )}
          {(circular.status === 'error' ||
            circular.status === 'unavailable') && (
            <div role="status">
              <p>Circular rates unavailable: {circular.message}</p>
              <Button variant="ghost" onClick={circular.retry}>
                Retry circular rates
              </Button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
