import { useRef, useState } from 'react';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Alert } from '../../components/common/Feedback';
import { Dialog } from '../../components/common/Dialog';
import { Select, Textarea } from '../../components/common/FormControls';
import { ApiError } from '../../services/apiClient';
import type { OfficerClaimReview } from './contracts';
import {
  canReturnForCorrection,
  correctionComments,
  correctionItemErrors,
  correctionSections,
  resolveOfficerDecision,
  returnTargetLabel,
} from './workflowActions';
import type {
  CorrectionItem,
  ReturnTarget,
  WorkflowActionRequest,
} from './workflowActions';

function decisionError(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === 'unauthorized')
      return 'Your session expired. Sign in again before retrying this decision.';
    if (error.kind === 'forbidden')
      return 'The server did not authorize this decision for your account.';
    if (error.kind === 'not-found')
      return 'This request is no longer available for review.';
    if (error.kind === 'network')
      return 'The decision could not reach the server. Check your connection and try again.';
    if (error.status === 400 && error.validationMessages.length > 0)
      return error.validationMessages.join(' ');
    if (error.status === 400)
      return 'The server rejected the decision details. Review the request and try again.';
    return error.message;
  }
  return 'The decision could not be confirmed by the server. Try again.';
}

function initialCorrection(): CorrectionItem {
  return { id: 'correction-0', section: '', explanation: '' };
}

export function OfficerDecisionSection({
  review,
  onExecute,
  actionsEnabled = true,
}: {
  review: OfficerClaimReview;
  onExecute: (request: WorkflowActionRequest) => Promise<void>;
  actionsEnabled?: boolean;
}) {
  const decision = resolveOfficerDecision(review);
  const [comment, setComment] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [returnOpen, setReturnOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const counter = useRef(1);
  const [correctionItems, setCorrectionItems] = useState([initialCorrection()]);
  const [returnTouched, setReturnTouched] = useState(false);
  const [returnTarget, setReturnTarget] = useState<ReturnTarget | ''>('');
  const role = review.reviewerRole;
  const canReturn = canReturnForCorrection(review);
  const canShowHodEdit = role === 'HOD' && decision !== null;
  const itemErrors = correctionItems.map(correctionItemErrors);
  const returnTargetError =
    returnTouched && role !== 'HOD' && !returnTarget
      ? 'Choose who should receive the correction.'
      : '';
  const hasCorrectionErrors = itemErrors.some(
    (errors) => errors.section || errors.explanation,
  );

  const updateCorrection = (
    id: string,
    field: 'section' | 'explanation',
    value: string,
  ) =>
    setCorrectionItems((items) =>
      items.map((item) =>
        item.id === id ? { ...item, [field]: value } : item,
      ),
    );

  const confirmDecision = async () => {
    if (!decision || pending || !actionsEnabled) return;
    setPending(true);
    setActionError(null);
    const request: WorkflowActionRequest = {
      action: decision.action,
      ...(comment.trim() ? { comments: comment.trim() } : {}),
    };
    try {
      await onExecute(request);
      setConfirmOpen(false);
      setComment('');
    } catch (error) {
      setActionError(decisionError(error));
    } finally {
      setPending(false);
    }
  };

  const confirmReturn = async () => {
    if (!canReturn || pending || !actionsEnabled) return;
    setReturnTouched(true);
    const selectedTarget: ReturnTarget | '' =
      role === 'HOD' ? 'LECTURER' : returnTarget;
    if (hasCorrectionErrors || !selectedTarget || correctionItems.length === 0)
      return;

    setPending(true);
    setActionError(null);
    const request: WorkflowActionRequest = {
      action: 'REJECT_RETURN',
      comments: correctionComments(correctionItems),
      targetReturnRole: selectedTarget,
    };
    try {
      await onExecute(request);
      setReturnOpen(false);
      setCorrectionItems([initialCorrection()]);
      counter.current = 1;
      setReturnTouched(false);
      setReturnTarget('');
    } catch (error) {
      setActionError(decisionError(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <>
      <section aria-labelledby="review-decision-title">
        <Card className="space-y-5 border-t-4 border-t-teal-700">
          <div className="flex items-start gap-3">
            <span
              aria-hidden="true"
              className="flex size-8 shrink-0 items-center justify-center rounded-full bg-teal-700 text-sm font-bold text-white"
            >
              5
            </span>
            <div className="min-w-0">
              <h2
                id="review-decision-title"
                className="text-lg font-bold text-brand"
              >
                Review decision
              </h2>
              <p className="mt-1 text-sm text-muted">
                Actions are available only for the authenticated role and
                current workflow stage.
              </p>
            </div>
          </div>

          {!actionsEnabled && (
            <Alert title="Preview only" tone="warning">
              <p>
                Decisions are disabled for this fictional preview. No workflow
                action can be sent from this screen.
              </p>
            </Alert>
          )}

          {decision ? (
            <>
              <Textarea
                id="decision-comments"
                label="Decision comments (optional)"
                hint="Comments are recorded with the server-side decision."
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                disabled={pending || !actionsEnabled}
              />
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="success"
                  onClick={() => {
                    setActionError(null);
                    setConfirmOpen(true);
                  }}
                  disabled={pending || !actionsEnabled}
                >
                  {decision.buttonLabel}
                </Button>
                {canReturn && (
                  <Button
                    variant="warning"
                    onClick={() => {
                      setActionError(null);
                      setReturnOpen(true);
                    }}
                    disabled={pending || !actionsEnabled}
                  >
                    Return for correction
                  </Button>
                )}
              </div>
            </>
          ) : (
            <p className="text-sm text-muted">
              No decision action is available for this role, request status, and
              active workflow stage.
            </p>
          )}

          {canShowHodEdit && (
            <div className="space-y-2 border-t border-border pt-4">
              <Button
                variant="ghost"
                disabled
                aria-describedby="hod-edit-unavailable"
              >
                Edit permitted fields
              </Button>
              <p id="hod-edit-unavailable" className="text-sm text-muted">
                The backend accepts updated claim data during HOD approval, but
                its DTO does not define a field-level allowlist. Editing stays
                unavailable until the permitted fields are verified.
              </p>
            </div>
          )}

          {actionError && !confirmOpen && !returnOpen && (
            <Alert title="Decision not confirmed" tone="danger" urgent>
              <p>{actionError}</p>
            </Alert>
          )}
        </Card>
      </section>

      {decision && (
        <Dialog
          open={confirmOpen}
          onClose={() => setConfirmOpen(false)}
          title={decision.confirmationTitle}
          description={decision.confirmationMessage}
        >
          <div className="space-y-5">
            <p className="text-sm text-muted">
              Request:{' '}
              <span className="font-semibold text-ink">
                {review.trackingNumber}
              </span>
            </p>
            {actionError && (
              <Alert title="Decision not confirmed" tone="danger" urgent>
                <p>{actionError}</p>
              </Alert>
            )}
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                variant="ghost"
                onClick={() => setConfirmOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                variant="success"
                onClick={() => void confirmDecision()}
                pending={pending}
              >
                {decision.confirmationLabel}
              </Button>
            </div>
          </div>
        </Dialog>
      )}

      {canReturn && (
        <Dialog
          open={returnOpen}
          onClose={() => setReturnOpen(false)}
          title="Return for correction"
          description="Identify each section that needs a correction and explain what must change."
        >
          <div className="space-y-5">
            <Alert title="Return target" tone="info">
              <p>
                {role === 'HOD'
                  ? 'HOD returns are routed to the lecturer for correction.'
                  : 'Select the verified workflow target for this return.'}
              </p>
            </Alert>

            {role === 'HOD' ? (
              <p className="rounded-control bg-surface-muted p-3 text-sm font-semibold text-brand">
                Return to: {returnTargetLabel('LECTURER')}
              </p>
            ) : (
              <Select
                id="return-target"
                label="Return to"
                value={returnTarget}
                required
                error={returnTargetError}
                hint="Choose either the Head of Department or the lecturer for correction."
                disabled={pending}
                onChange={(event) =>
                  setReturnTarget(event.target.value as ReturnTarget | '')
                }
              >
                <option value="">Select a return target</option>
                <option value="HOD">{returnTargetLabel('HOD')}</option>
                <option value="LECTURER">
                  {returnTargetLabel('LECTURER')}
                </option>
              </Select>
            )}

            <div className="space-y-4">
              {correctionItems.map((item, index) => {
                const errors = correctionItemErrors(item);
                const showErrors = returnTouched;
                const sectionError = showErrors ? errors.section : '';
                const explanationError = showErrors ? errors.explanation : '';
                const sectionId = 'correction-section-' + item.id;
                const explanationId = 'correction-explanation-' + item.id;
                return (
                  <fieldset
                    key={item.id}
                    className="space-y-4 rounded-control border border-border p-4"
                  >
                    <legend className="px-1 font-semibold text-brand">
                      Correction {index + 1}
                    </legend>
                    <Select
                      id={sectionId}
                      label="Section requiring correction"
                      value={item.section}
                      required
                      error={sectionError}
                      disabled={pending}
                      onBlur={() => setReturnTouched(true)}
                      onChange={(event) =>
                        updateCorrection(item.id, 'section', event.target.value)
                      }
                    >
                      <option value="">Select a section</option>
                      {correctionSections.map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
                    <Textarea
                      id={explanationId}
                      label="Required correction"
                      value={item.explanation}
                      required
                      error={explanationError}
                      hint="Explain the specific change the applicant should make."
                      disabled={pending}
                      onBlur={() => setReturnTouched(true)}
                      onChange={(event) =>
                        updateCorrection(
                          item.id,
                          'explanation',
                          event.target.value,
                        )
                      }
                    />
                    {correctionItems.length > 1 && (
                      <Button
                        variant="ghost"
                        onClick={() => {
                          setCorrectionItems((items) =>
                            items.filter(
                              (candidate) => candidate.id !== item.id,
                            ),
                          );
                          setReturnTouched(true);
                        }}
                        disabled={pending}
                      >
                        Remove correction
                      </Button>
                    )}
                  </fieldset>
                );
              })}
            </div>

            <Button
              variant="ghost"
              onClick={() => {
                const id = 'correction-' + counter.current++;
                setCorrectionItems((items) => [
                  ...items,
                  { id, section: '', explanation: '' },
                ]);
              }}
              disabled={pending}
            >
              Add another issue
            </Button>

            {actionError && (
              <Alert title="Return not confirmed" tone="danger" urgent>
                <p>{actionError}</p>
              </Alert>
            )}

            <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
              <Button
                variant="ghost"
                onClick={() => setReturnOpen(false)}
                disabled={pending}
              >
                Cancel
              </Button>
              <Button
                variant="warning"
                onClick={() => void confirmReturn()}
                pending={pending}
              >
                Confirm Return
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </>
  );
}
