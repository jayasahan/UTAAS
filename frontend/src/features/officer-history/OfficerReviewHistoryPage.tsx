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
          The backend currently provides history for a known request ID, but it
          does not provide a secure officer-specific list of applications you
          have handled. This page has not requested any request history or
          application details.
        </p>
        <p className="mt-2">
          GitHub issue #19 is closed, but source review at the current MVP
          revision still shows reviewer-stage authorization gaps on
          request-specific history reads. The list remains unavailable until a
          scoped backend contract is provided.
        </p>
        <a
          className="mt-2 inline-block font-semibold underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
          href="https://github.com/jayasahan/UTAAS/issues/19"
          target="_blank"
          rel="noreferrer"
        >
          Review backend issue #19
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
