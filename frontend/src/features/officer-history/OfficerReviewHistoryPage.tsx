import { Link } from 'react-router-dom';
import { Alert } from '../../components/common/Feedback';
import { OfficerAccessFeedback } from '../officer-queue/OfficerPortalLayout';

function UnavailableOfficerReviewHistory() {
  return (
    <section aria-labelledby="review-history-title" className="space-y-6">
      <header>
        <h1
          id="review-history-title"
          className="text-display font-bold text-brand"
        >
          Review History
        </h1>
        <p className="mt-2 text-muted">
          Previously handled applications and authorized audit history
        </p>
      </header>

      <Alert title="Officer review history is unavailable" tone="info">
        <p>
          The backend exposes a completed-review history endpoint, but its
          current query scopes records by reviewer role and completed stage, not
          by the signed-in officer. Its response can infer a past decision from
          the request&apos;s current status, so a later return can mislabel an
          earlier approval. This page does not request that list or any
          request-specific history.
        </p>
        <p className="mt-2">
          GitHub issue #26 is closed, but source verification shows its
          individual-reviewer scope and historical-decision requirements are not
          met by the merged endpoint. The list remains unavailable until those
          contracts are clarified and corrected.
        </p>
        <a
          className="mt-2 inline-block font-semibold underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
          href="https://github.com/jayasahan/UTAAS/issues/26"
          target="_blank"
          rel="noreferrer"
        >
          Review backend issue #26
        </a>
      </Alert>

      <Link
        to="/officer/queue"
        className="inline-flex min-h-11 items-center rounded-control border border-border bg-white px-4 py-2 font-semibold text-brand hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
      >
        ← Back to Approval Queue
      </Link>
    </section>
  );
}

export function OfficerReviewHistoryPage() {
  return (
    <OfficerAccessFeedback>
      <UnavailableOfficerReviewHistory />
    </OfficerAccessFeedback>
  );
}
