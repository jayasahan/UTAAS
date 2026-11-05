import { useCallback, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Alert } from '../../components/common/Feedback';
import { useSession } from '../../auth/session';
import type { StaffProfile } from '../../auth/contracts';
import { ApiError } from '../../services/apiClient';
import { decodeRequestDetail } from '../requests/contracts';
import { useRequestResource } from '../requests/useRequestResource';
import { OfficerAccessFeedback } from '../officer-queue/OfficerPortalLayout';
import { useOfficerAccess } from '../officer-queue/officerAccess';
import {
  decodeOfficerClaimReview,
  type ReviewDocumentMetadata,
} from './contracts';
import { OfficerClaimReviewView } from './OfficerClaimReviewView';
import {
  decodeWorkflowActionResult,
  resolveWorkflowExpectation,
} from './workflowActions';
import type { WorkflowActionRequest } from './workflowActions';
import { RequestPaperStructure } from '../paper-marking/structure/RequestPaperStructure';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const decodeIdentity = (value: unknown) => value;

function LoadingReview() {
  return (
    <div
      role="status"
      className="space-y-4 rounded-card border border-border bg-surface p-6"
    >
      <span className="sr-only">Loading claim review</span>
      <div
        aria-hidden="true"
        className="h-6 w-2/3 animate-pulse rounded bg-slate-200"
      />
      <div
        aria-hidden="true"
        className="h-24 animate-pulse rounded bg-slate-100"
      />
      <div
        aria-hidden="true"
        className="h-48 animate-pulse rounded bg-slate-100"
      />
    </div>
  );
}

function ReviewUnavailable({
  requestId,
  title,
  message,
  onRetry,
}: {
  requestId: string | undefined;
  title: string;
  message: string;
  onRetry: () => void;
}) {
  return (
    <section
      className="max-w-3xl space-y-5"
      aria-labelledby="review-unavailable-title"
    >
      <Link
        to="/officer/queue"
        className="inline-flex min-h-10 items-center rounded-control font-semibold text-action underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
      >
        ← Back to Queue
      </Link>
      <h1
        id="review-unavailable-title"
        className="text-display font-bold text-brand"
      >
        Claim review unavailable
      </h1>
      <Alert title={title} tone="warning">
        <p>{message}</p>
        {requestId && (
          <button
            type="button"
            onClick={onRetry}
            className="mt-3 min-h-10 rounded-control border border-current px-4 py-2 font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
          >
            Retry
          </button>
        )}
      </Alert>
    </section>
  );
}

function safeDownloadName(name: string): string {
  return (
    [...name]
      .map((character) => {
        const code = character.charCodeAt(0);
        return code < 32 || code === 127 ? '_' : character;
      })
      .join('')
      .replace(/[\\/:*?"<>|]/g, '_')
      .trim()
      .slice(0, 180) || 'supporting-document'
  );
}

export function OfficerClaimReviewPage() {
  const { requestId } = useParams();
  const validRequestId = Boolean(requestId && uuidPattern.test(requestId));
  const access = useOfficerAccess();
  const { client } = useSession();
  const profile = access.profile.data;
  const role = profile?.role;
  const reviewerRole: Exclude<StaffProfile['role'], 'LECTURER'> | null =
    role && role !== 'LECTURER' ? role : null;
  const canLoad = Boolean(
    access.allowed &&
    access.profile.status === 'ready' &&
    validRequestId &&
    reviewerRole,
  );
  const detail = useRequestResource(
    canLoad ? `/requests/paper-marking/${requestId}` : null,
    decodeRequestDetail,
  );
  const tracking = useRequestResource(
    canLoad ? `/requests/${requestId}/tracking` : null,
    decodeIdentity,
  );
  const history = useRequestResource(
    canLoad ? `/requests/${requestId}/history` : null,
    decodeIdentity,
  );
  const [downloadingFilename, setDownloadingFilename] = useState<string | null>(
    null,
  );
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [decisionNotice, setDecisionNotice] = useState<{
    requestId: string;
    message: string;
  } | null>(null);
  const visibleDecisionNotice =
    decisionNotice !== null && decisionNotice.requestId === requestId
      ? decisionNotice.message
      : null;

  const resources = [detail, tracking, history] as const;
  const retry = useCallback(() => {
    detail.retry();
    tracking.retry();
    history.retry();
  }, [detail, history, tracking]);
  const reviewResult = useMemo(() => {
    if (
      !reviewerRole ||
      detail.status !== 'ready' ||
      tracking.status !== 'ready' ||
      history.status !== 'ready' ||
      !detail.data ||
      !tracking.data ||
      !history.data
    )
      return { review: null, invalid: false };
    try {
      return {
        review: decodeOfficerClaimReview(
          detail.data,
          tracking.data,
          history.data,
          reviewerRole,
        ),
        invalid: false,
      };
    } catch {
      return { review: null, invalid: true };
    }
  }, [detail, history, reviewerRole, tracking]);

  const onDownload = useCallback(
    async (document: ReviewDocumentMetadata) => {
      const filename = document.downloadFilename;
      if (
        !client ||
        !client.downloadDocument ||
        !filename ||
        !reviewResult.review?.documents.some(
          (candidate) => candidate.downloadFilename === filename,
        )
      )
        return;
      setDownloadingFilename(filename);
      setDownloadError(null);
      try {
        const blob = await client.downloadDocument(filename);
        const objectUrl = URL.createObjectURL(blob);
        const anchor = window.document.createElement('a');
        anchor.href = objectUrl;
        anchor.download = safeDownloadName(document.name);
        anchor.rel = 'noopener noreferrer';
        anchor.tabIndex = -1;
        anchor.style.position = 'fixed';
        anchor.style.left = '-10000px';
        window.document.body.append(anchor);
        anchor.click();
        anchor.remove();
        window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
      } catch (error) {
        setDownloadError(
          error instanceof ApiError
            ? error.message
            : 'The document could not be downloaded. Try again.',
        );
      } finally {
        setDownloadingFilename(null);
      }
    },
    [client, reviewResult.review],
  );

  const executeDecision = useCallback(
    async (request: WorkflowActionRequest) => {
      const review = reviewResult.review;
      if (!client || !requestId || !review)
        throw new Error('The verified review data is no longer available.');
      const expectation = resolveWorkflowExpectation(review, request);
      if (!expectation)
        throw new Error(
          'This action is not available for the current workflow stage.',
        );
      const result = await client.post(
        '/requests/' + requestId + '/actions',
        request,
        (value) => decodeWorkflowActionResult(value, review, request),
      );
      const message =
        result.status === 'SETTLED'
          ? 'Final settlement was recorded by the server.'
          : result.status === 'RETURNED_FOR_CORRECTION'
            ? 'The claim was returned for correction to ' +
              (result.currentStageKey === 'HEAD_OF_DEPARTMENT'
                ? 'the Head of Department.'
                : 'the lecturer.')
            : 'Approval was recorded by the server. Review data is refreshing.';
      setDecisionNotice({ requestId, message });
      retry();
    },
    [client, requestId, reviewResult.review, retry],
  );
  if (!validRequestId)
    return (
      <OfficerAccessFeedback>
        <ReviewUnavailable
          requestId={undefined}
          title="Invalid request reference"
          message="The request reference is not a valid identifier."
          onRetry={retry}
        />
      </OfficerAccessFeedback>
    );

  const failure = resources.find((resource) => resource.status === 'error');
  const missing = resources.find(
    (resource) => resource.status === 'unavailable',
  );
  const isLoading = resources.some((resource) => resource.status === 'loading');
  const errorKind = failure?.errorKind;
  const errorTitle =
    errorKind === 'unauthorized'
      ? 'Your session has expired'
      : errorKind === 'forbidden'
        ? 'You are not authorized to review this request'
        : errorKind === 'network'
          ? 'The review could not be loaded'
          : errorKind === 'invalid-response'
            ? 'Review response unavailable'
            : 'The request could not be loaded';
  const errorMessage = reviewResult.invalid
    ? 'The request, tracking, and history responses do not match the verified contract.'
    : (failure?.message ??
      (missing
        ? 'The request or one of its review records could not be found.'
        : 'The review could not be loaded.'));

  return (
    <OfficerAccessFeedback>
      {isLoading ? (
        <div className="space-y-4">
          {visibleDecisionNotice && (
            <Alert title="Decision recorded" tone="success">
              <p>{visibleDecisionNotice}</p>
            </Alert>
          )}
          <LoadingReview />
        </div>
      ) : reviewResult.review ? (
        <div className="space-y-6">
          <OfficerClaimReviewView
            review={reviewResult.review}
            onExecuteDecision={executeDecision}
            decisionNotice={visibleDecisionNotice}
            onDownload={onDownload}
            downloadingFilename={downloadingFilename}
            downloadError={downloadError}
          />
          {reviewerRole === 'HOD' && detail.data && (
            <RequestPaperStructure
              formData={detail.data.formData}
              status={detail.data.status}
              currentStageKey={detail.data.currentStageKey}
              applicantDepartmentCode={
                detail.data.applicant?.department?.code ?? null
              }
              viewerProfile={profile ?? null}
              onUpdated={retry}
            />
          )}
        </div>
      ) : (
        <>
          {visibleDecisionNotice && (
            <Alert title="Decision recorded" tone="success">
              <p>{visibleDecisionNotice}</p>
            </Alert>
          )}
          <ReviewUnavailable
            requestId={requestId}
            title={
              reviewResult.invalid
                ? 'Review data could not be verified'
                : missing && !failure
                  ? 'Request not found'
                  : errorTitle
            }
            message={errorMessage}
            onRetry={retry}
          />
        </>
      )}
    </OfficerAccessFeedback>
  );
}
