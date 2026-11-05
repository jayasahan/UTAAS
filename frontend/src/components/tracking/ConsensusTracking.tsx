import { Alert } from '../common/Feedback';
import {
  consensusLabel,
  type ConsensusRecord,
} from '../../features/requests/workflowTracking';

export interface TrackingViewer {
  role: string;
  id?: string | undefined;
}
const officerRoles = [
  'HOD',
  'DEAN',
  'EXAMINATION_OFFICER',
  'FINANCIAL_OFFICER',
  'ASSISTANT_BURSAR',
  'ADMIN',
];
const date = new Intl.DateTimeFormat('en-LK', {
  dateStyle: 'medium',
  timeStyle: 'short',
});
export function ConsensusTracking({
  record,
  viewer,
  current = false,
}: {
  record: ConsensusRecord;
  viewer?: TrackingViewer | undefined;
  current?: boolean;
}) {
  if (record.state === 'missing') return null;
  if (record.state === 'invalid')
    return (
      <Alert title="Consensus details could not be verified" tone="warning">
        <p>
          The returned consensus snapshot is incomplete or malformed. Request
          status and audit history remain separate.
        </p>
      </Alert>
    );
  const snapshot = record.snapshot;
  const canReadResponses =
    viewer &&
    (officerRoles.includes(viewer.role) ||
      (viewer.role === 'LECTURER' && !!viewer.id));
  const responses = canReadResponses
    ? snapshot.responses?.filter(
        (response) =>
          viewer.role !== 'LECTURER' || response.lecturerId === viewer.id,
      )
    : undefined;
  return (
    <section
      aria-label="Proportion consensus snapshot"
      className="space-y-3 rounded-control border border-border bg-surface p-4 [overflow-wrap:anywhere]"
    >
      <h2 className="text-lg font-bold text-brand">
        Proportion consensus — recorded snapshot
      </h2>
      <p className="font-semibold">{consensusLabel(snapshot.status)}</p>
      <dl className="grid gap-3 sm:grid-cols-2">
        {snapshot.essayWeightPercent !== undefined && (
          <div>
            <dt className="text-sm text-muted">Proposed essay weight (%)</dt>
            <dd>{snapshot.essayWeightPercent}</dd>
          </div>
        )}
        {snapshot.mcqWeightPercent !== undefined && (
          <div>
            <dt className="text-sm text-muted">Proposed MCQ weight (%)</dt>
            <dd>{snapshot.mcqWeightPercent}</dd>
          </div>
        )}
        {snapshot.setByHodName && (
          <div>
            <dt className="text-sm text-muted">Proposed by</dt>
            <dd>{snapshot.setByHodName}</dd>
          </div>
        )}
        {snapshot.setAt && (
          <div>
            <dt className="text-sm text-muted">Proposal recorded at</dt>
            <dd>
              <time dateTime={snapshot.setAt}>
                {date.format(new Date(snapshot.setAt))}
              </time>
            </dd>
          </div>
        )}
      </dl>
      {snapshot.comments && (
        <p className="whitespace-pre-wrap">{snapshot.comments}</p>
      )}
      {responses?.length ? (
        <ul className="space-y-3">
          {responses.map((response, index) => (
            <li
              key={`${response.lecturerId}-${index}`}
              className="rounded-control border border-border p-3"
            >
              <p className="font-semibold">
                {response.agreed
                  ? 'Agreement received'
                  : 'Disagreement received'}{' '}
                · {response.lecturerName || 'Lecturer name not returned'}
              </p>
              {response.respondedAt && (
                <time
                  dateTime={response.respondedAt}
                  className="text-sm text-muted"
                >
                  {date.format(new Date(response.respondedAt))}
                </time>
              )}
              {response.comments && (
                <p className="mt-2 whitespace-pre-wrap">{response.comments}</p>
              )}
              {!response.agreed && (
                <p className="mt-2 text-sm">
                  This records disagreement with the proportions, not rejection
                  of the claim.
                </p>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted">
          {canReadResponses
            ? 'No individual response is available for this view in the returned snapshot.'
            : 'Individual response details are unavailable until your viewing role is verified.'}
        </p>
      )}
      <p className="text-sm text-muted">
        {current
          ? 'This proposal and its recorded responses were verified against the current examination record. No expected examiner total was returned; completion is shown only when confirmed by the server status.'
          : "This is the request's last recorded consensus snapshot. Partial agreements may not yet appear here. No expected examiner total was returned, so completion is not inferred from response counts."}
      </p>
    </section>
  );
}
