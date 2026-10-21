import { Link, useParams } from 'react-router-dom';
import { Alert } from '../../components/common/Feedback';
import { OfficerAccessFeedback } from '../officer-queue/OfficerPortalLayout';

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function UnavailableReview({ validRequestId }: { validRequestId: boolean }) {
  return (
    <section
      className="max-w-3xl space-y-5"
      aria-labelledby="review-blocked-title"
    >
      <Link
        to="/officer/queue"
        className="inline-flex min-h-10 items-center rounded-control font-semibold text-action underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
      >
        ← Back to Queue
      </Link>
      <h1
        id="review-blocked-title"
        className="text-display font-bold text-brand"
      >
        Claim review unavailable
      </h1>
      <Alert
        title={
          validRequestId
            ? 'Live claim details are unavailable'
            : 'Invalid request reference'
        }
        tone="warning"
      >
        {validRequestId ? (
          <>
            <p>
              This page does not request or display claim details. The backend
              now fails closed for HOD queue department scope and checks HOD
              department boundaries for request reads, but detail, tracking, and
              history still do not enforce each reviewer&apos;s assigned
              workflow stage. Document retrieval also lacks request-level
              authorization. Frontend role checks cannot secure those records.
            </p>
            <p className="mt-2">
              Issue #19 is marked closed upstream, but the source still needs a
              follow-up for reviewer stage scope:{' '}
              <a
                className="font-semibold underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
                href="https://github.com/jayasahan/UTAAS/issues/19"
                target="_blank"
                rel="noreferrer"
              >
                issue #19
              </a>
              .
            </p>
          </>
        ) : (
          <p>The request reference is not a valid identifier.</p>
        )}
      </Alert>
    </section>
  );
}

export function OfficerClaimReviewPage() {
  const { requestId } = useParams();
  const validRequestId = Boolean(requestId && uuidPattern.test(requestId));

  return (
    <OfficerAccessFeedback>
      <UnavailableReview validRequestId={validRequestId} />
    </OfficerAccessFeedback>
  );
}
