import { useRef, useState } from 'react';
import type { StaffProfile } from '../../auth/contracts';
import { Button } from '../../components/common/Button';
import { Textarea } from '../../components/common/FormControls';
import { Alert, EmptyState, Skeleton } from '../../components/common/Feedback';
import { ConsensusTracking } from '../../components/tracking/ConsensusTracking';
import type { RequestDetail } from '../requests/contracts';
import { decodeConsensusRecord } from '../requests/workflowTracking';
import { disagreementError, responseKey } from './contracts';
import { useLecturerConsensus } from './useLecturerConsensus';

function ResponseForm({
  busy,
  revision,
  submit,
}: {
  busy: boolean;
  revision: string | null;
  submit: (
    agreed: boolean,
    comments: string,
    revision: string | null,
  ) => Promise<void>;
}) {
  const [disagree, setDisagree] = useState(false);
  const [comments, setComments] = useState('');
  const [error, setError] = useState('');
  const field = useRef<HTMLTextAreaElement>(null);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3">
        <Button
          variant="success"
          disabled={busy}
          onClick={() => void submit(true, '', revision)}
        >
          Agree
        </Button>
        <Button
          variant="warning"
          disabled={busy}
          onClick={() => {
            setDisagree(true);
          }}
        >
          Disagree
        </Button>
      </div>
      {disagree && (
        <form
          noValidate
          className="space-y-3"
          onSubmit={(event) => {
            event.preventDefault();
            const message = disagreementError(comments);
            setError(message);
            if (message) {
              field.current?.focus();
              return;
            }
            void submit(false, comments, revision);
          }}
        >
          <Textarea
            ref={field}
            id="proportion-disagreement-comment"
            label="Reason for disagreement"
            required
            maxLength={2000}
            disabled={busy}
            value={comments}
            hint="Explain the requested adjustment using at least 3 letters or numbers. Your comment will be sent to the HOD."
            {...(error ? { error } : {})}
            onChange={(event) => {
              setComments(event.target.value);
              setError('');
            }}
          />
          <Button type="submit" variant="warning" pending={busy}>
            Submit disagreement
          </Button>
          <Button
            variant="ghost"
            disabled={busy}
            onClick={() => setDisagree(false)}
          >
            Cancel disagreement
          </Button>
        </form>
      )}
    </div>
  );
}

/** Remains mounted during parent resource refreshes so confirmed/unknown outcomes are retained in memory. */
export function LecturerProportionAgreement({
  detail,
  viewer,
  onRefresh,
}: {
  detail: RequestDetail | null;
  viewer: StaffProfile | null;
  onRefresh: () => void;
}) {
  const consensus = useLecturerConsensus(detail, viewer, onRefresh);
  const [revision, setRevision] = useState<{
    key: string;
    receipt: typeof consensus.confirmed;
  } | null>(null);
  if (!detail) return null;
  const fallback = decodeConsensusRecord(detail.formData.hodProportionDivision);
  const record = consensus.proposal?.record ?? fallback;
  const previous = responseKey(consensus.own);
  const changing =
    !!previous &&
    revision?.key === `${consensus.key}|${previous}` &&
    revision.receipt === consensus.confirmed;
  const controls = consensus.canRespond && (!consensus.own || changing);
  return (
    <div id="proportion-agreement" className="space-y-4">
      <ConsensusTracking
        record={record}
        viewer={viewer ?? undefined}
        current={!!consensus.proposal}
      />
      {consensus.missingExam && (
        <Alert title="Examination details are incomplete" tone="warning">
          <p>
            A course, academic year, semester and examination type are required
            to verify this proposal. Refresh the request before responding.
          </p>
        </Alert>
      )}
      {consensus.enabled && (
        <section
          aria-label="Lecturer proportion agreement"
          className="space-y-4 rounded-control border border-border bg-surface p-4 [overflow-wrap:anywhere]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-brand">
              Respond to the HOD proposal
            </h2>
            <Button
              variant="ghost"
              disabled={consensus.busy || consensus.status === 'loading'}
              onClick={consensus.refresh}
            >
              Refresh proposal
            </Button>
          </div>
          {consensus.proposal?.exam && (
            <p className="text-sm text-muted">
              {consensus.proposal.exam.courseCode} ·{' '}
              {consensus.proposal.exam.academicYear} ·{' '}
              {consensus.proposal.exam.semester} ·{' '}
              {consensus.proposal.exam.examType}
            </p>
          )}
          {consensus.status === 'loading' && (
            <Skeleton label="Loading current proposal and your recorded response" />
          )}
          {(consensus.status === 'error' ||
            consensus.status === 'unavailable') && (
            <Alert title="Current proposal could not be loaded" tone="warning">
              <p>{consensus.message}</p>
              <p>
                The recorded snapshot may be outdated. Responses are unavailable
                until the current proposal can be verified.
              </p>
            </Alert>
          )}
          {consensus.proposal &&
            (!consensus.proposal.exists || record.state === 'missing') && (
              <EmptyState title="No current HOD proposal">
                <p>
                  No response is required until the HOD records a proposal for
                  this examination.
                </p>
              </EmptyState>
            )}
          {consensus.isOpen && consensus.snapshot?.responses === undefined && (
            <Alert title="Recorded responses are unavailable" tone="warning">
              <p>
                Your previous response cannot be verified, so another response
                cannot be submitted safely.
              </p>
            </Alert>
          )}
          {consensus.reset && (
            <Alert title="Proposal changed or reset" tone="warning">
              <p>
                A different proposal is now current. Earlier responses do not
                confirm agreement with these proportions. Review the current
                proposal before responding.
              </p>
            </Alert>
          )}
          {consensus.confirmed && (
            <Alert
              title={
                consensus.confirmed.agreed
                  ? 'Agreement submitted'
                  : 'Disagreement submitted'
              }
              tone="success"
            >
              <p>{consensus.confirmed.message}</p>
              {consensus.confirmed.status === 'AWAITING_OTHER_EXAMINERS' && (
                <p>
                  Waiting for other lecturers. Consensus is not yet confirmed as
                  completed.
                </p>
              )}
            </Alert>
          )}
          {consensus.error && (
            <Alert
              title={
                consensus.uncertain
                  ? 'Response confirmation required'
                  : 'Response could not be submitted'
              }
              tone="warning"
              urgent
            >
              <p>{consensus.error}</p>
            </Alert>
          )}
          {consensus.busy && (
            <p role="status">Checking and recording your response…</p>
          )}
          {consensus.uncertain && (
            <Button
              variant="ghost"
              pending={consensus.busy}
              onClick={() => void consensus.checkOutcome()}
            >
              Check recorded response
            </Button>
          )}
          {consensus.own && (
            <p className="font-semibold">
              {consensus.own.agreed
                ? 'Your agreement is already recorded.'
                : 'Your disagreement is already recorded.'}
            </p>
          )}
          {consensus.snapshot?.status === 'CONSENSUS_REACHED' && (
            <p className="font-semibold text-success">
              Consensus is completed. Further responses are unavailable.
            </p>
          )}
          {consensus.own && consensus.canRespond && !changing && (
            <Button
              variant="ghost"
              disabled={consensus.busy}
              onClick={() =>
                setRevision({
                  key: `${consensus.key}|${previous}`,
                  receipt: consensus.confirmed,
                })
              }
            >
              Change response
            </Button>
          )}
          {changing && consensus.canRespond && (
            <p className="text-sm text-muted">
              You are changing your recorded response while this proposal is
              open.
            </p>
          )}
          {controls && (
            <ResponseForm
              key={`${consensus.key}|${previous}`}
              busy={consensus.busy}
              revision={changing ? previous : null}
              submit={consensus.perform}
            />
          )}
          {consensus.proposal?.exists &&
            record.state === 'available' &&
            !consensus.canRespond &&
            !consensus.uncertain &&
            consensus.snapshot?.status !== 'CONSENSUS_REACHED' && (
              <p className="text-sm text-muted">
                Response controls are unavailable for the current request stage,
                permissions, or proposal information. Refresh the request if its
                assignment has changed.
              </p>
            )}
        </section>
      )}
    </div>
  );
}
