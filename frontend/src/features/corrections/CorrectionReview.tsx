import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Alert } from '../../components/common/Feedback';
import { CorrectionBanner } from '../../components/tracking/CorrectionBanner';
import type {
  RequestDetail,
  RequestHistory,
  RequestTracking,
} from '../requests/contracts';
import { summarizeCorrection } from './correctionSummary';

const lkr = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
});
const dateTime = new Intl.DateTimeFormat('en-LK', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

function NumberedSection({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: ReactNode;
}) {
  const titleId = `correction-section-${number}`;
  return (
    <Card>
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-8 shrink-0 items-center justify-center rounded-full bg-success font-bold text-white"
        >
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={titleId} className="text-lg font-bold text-brand">
            {title}
          </h2>
          <div className="mt-4">{children}</div>
        </div>
      </div>
    </Card>
  );
}

function FieldList({ fields }: { fields: { label: string; value: string }[] }) {
  if (fields.length === 0)
    return (
      <p className="text-sm text-muted">
        No information was returned for this section.
      </p>
    );
  return (
    <dl className="grid min-w-0 gap-4 sm:grid-cols-2">
      {fields.map((field) => (
        <div key={field.label} className="min-w-0 [overflow-wrap:anywhere]">
          <dt className="text-sm text-muted">{field.label}</dt>
          <dd className="font-semibold text-ink">{field.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function CorrectionReview({
  request,
  tracking,
  history,
}: {
  request: RequestDetail;
  tracking: RequestTracking | null;
  history: RequestHistory | null;
}) {
  const summary = summarizeCorrection(request, tracking, history);
  const returnedBy = summary.returningRole ?? 'reviewing officer';
  const reason =
    summary.comment ??
    'No correction comment was included in the available return record.';

  return (
    <div className="space-y-5" aria-labelledby="correction-review-title">
      <div>
        <h2
          id="correction-review-title"
          className="text-2xl font-bold text-brand"
        >
          Correction required
        </h2>
        <p className="mt-1 text-sm text-muted">
          Review the returned application and the officer’s note below.
        </p>
      </div>

      <CorrectionBanner reviewer={returnedBy} reason={reason} />

      <Card>
        <dl className="grid min-w-0 gap-4 sm:grid-cols-3">
          <div className="min-w-0 [overflow-wrap:anywhere]">
            <dt className="text-sm text-muted">Returning officer</dt>
            <dd className="font-semibold text-ink">
              {summary.returningRole ?? 'Not provided'}
              {summary.returningName ? ` · ${summary.returningName}` : ''}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Return date</dt>
            <dd className="font-semibold text-ink">
              {summary.returnedAt &&
              Number.isFinite(Date.parse(summary.returnedAt))
                ? dateTime.format(new Date(summary.returnedAt))
                : 'Not provided'}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Current workflow stage</dt>
            <dd className="font-semibold text-ink">{summary.currentStage}</dd>
          </div>
        </dl>
        <p className="mt-4 border-t border-border pt-4 text-sm text-ink">
          <span className="font-semibold">Section to correct: </span>
          Not specified by the backend.
        </p>
      </Card>

      <NumberedSection number={1} title="Personal & Application Information">
        <FieldList fields={summary.applicantFields} />
        <p className="mt-4 text-sm text-muted">
          Applicant name and department come from the returned account relation.
          Designation and staff ID are not included in the verified request
          response.
        </p>
        <div className="mt-5 border-t border-border pt-4">
          <h3 className="mb-3 font-semibold text-brand">
            Academic information
          </h3>
          <FieldList fields={summary.academicFields} />
        </div>
      </NumberedSection>

      <NumberedSection number={2} title="Paper Setting & Marking Details">
        <FieldList fields={summary.claimFields} />
        <p className="mt-4 text-sm text-muted">
          The current backend response stores aggregate quantities. It does not
          return the original per-paper rows or indicate a specific field to
          correct.
        </p>
        <div className="mt-5 border-t border-border pt-4">
          <h3 className="font-semibold text-brand">Server-confirmed amount</h3>
          <p className="mt-1 text-xl font-bold text-brand">
            {lkr.format(request.totalAmount)}
          </p>
          {summary.feeLines.length > 0 ? (
            <ul className="mt-3 divide-y divide-border">
              {summary.feeLines.map((line) => (
                <li
                  key={`${line.label}-${line.unit}`}
                  className="flex flex-wrap justify-between gap-2 py-2 text-sm"
                >
                  <span>
                    {line.label} · {line.quantity} {line.unit} ×{' '}
                    {lkr.format(line.rate)}
                  </span>
                  <span className="font-semibold">
                    {lkr.format(line.subtotal)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-muted">
              A fee breakdown was not included in the returned form data.
            </p>
          )}
          {summary.feeTotal !== null &&
            summary.feeTotal !== request.totalAmount && (
              <p className="mt-2 text-sm text-warning-ink">
                The form breakdown and request total differ. The request total
                is shown as the server-confirmed amount.
              </p>
            )}
        </div>
      </NumberedSection>

      <NumberedSection number={3} title="Supporting Documents">
        {summary.documents.length > 0 ? (
          <ul className="space-y-3">
            {summary.documents.map((document, index) => (
              <li
                key={`${document.value}-${index}`}
                className="flex min-w-0 flex-wrap justify-between gap-2 rounded-control border border-border p-3"
              >
                <span className="min-w-0 [overflow-wrap:anywhere] font-semibold text-ink">
                  {document.value}
                </span>
                <span className="text-sm text-muted">{document.label}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted">
            No supporting document metadata was returned.
          </p>
        )}
        <p className="mt-3 text-sm text-muted">
          Document names and categories are shown without private storage URLs
          or download actions.
        </p>
      </NumberedSection>

      <NumberedSection number={4} title="Correction & Resubmission">
        <Alert title="Editing and resubmission are unavailable" tone="info">
          <p>
            The backend has no correction-specific save operation or validated
            editable-field schema. Its resubmission payload accepts generic form
            data without field-level validation. This page therefore remains
            read-only until that contract is defined.
          </p>
          {!summary.hasLecturerCorrectionStage && (
            <p className="mt-2">
              The request is not currently assigned to the lecturer correction
              stage.
            </p>
          )}
        </Alert>
        <p id="correction-action-help" className="mt-4 text-sm text-muted">
          You can return to My Applications to check this request’s status and
          approval history.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            to="/requests"
            className="inline-flex min-h-11 items-center rounded-control border border-border bg-white px-4 py-3 text-sm font-semibold text-brand hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
          >
            My Applications
          </Link>
          <Button
            variant="warning"
            disabled
            aria-describedby="correction-action-help"
          >
            Edit corrections
          </Button>
          <Button
            variant="primary"
            disabled
            aria-describedby="correction-action-help"
          >
            Review &amp; Resubmit
          </Button>
        </div>
      </NumberedSection>
    </div>
  );
}
