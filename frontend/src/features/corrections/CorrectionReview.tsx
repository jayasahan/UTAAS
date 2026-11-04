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
import { restoreCorrectionForm } from './correctionPersistence';
import { ClaimFieldSummary } from '../paper-marking/components/ClaimFieldSummary';
import type { ClaimForm } from '../paper-marking/model';

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

function paperRows(formData: Record<string, unknown>) {
  if (!Array.isArray(formData.papers)) return [];
  return formData.papers.map((value, index) => {
    const row =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    const display = (key: string) => {
      const cell = row[key];
      return typeof cell === 'string' ||
        (typeof cell === 'number' && Number.isFinite(cell))
        ? String(cell)
        : 'Not returned';
    };
    const unit =
      row.assessmentUnit === 'hours' || row.assessmentUnit === 'candidates'
        ? row.assessmentUnit
        : 'unit unavailable';
    return {
      key: `${typeof row.id === 'string' ? row.id : 'paper'}-${index}`,
      title:
        typeof row.title === 'string' && row.title.trim()
          ? row.title
          : `Paper ${index + 1}`,
      duration: display('durationHours'),
      setting: display('settingCount'),
      moderation: display('moderationCount'),
      translation: display('translationCount'),
      marking: display('scriptCount'),
      secondMarking: display('secondMarkingCount'),
      assessment: `${display('assessmentQuantity')} ${unit}`,
    };
  });
}

export function CorrectionReview({
  request,
  tracking,
  history,
  canEdit,
  editReason,
}: {
  request: RequestDetail;
  tracking: RequestTracking | null;
  history: RequestHistory | null;
  canEdit: boolean;
  editReason?: string;
}) {
  const summary = summarizeCorrection(request, tracking, history);
  const returnedBy = summary.returningRole ?? 'reviewing officer';
  const reason =
    summary.comment ??
    'No correction comment was included in the available return record.';
  const rows = paperRows(request.formData);
  let snapshotError: string | null = null;
  let storedDetails: Omit<ClaimForm, 'documents'> | undefined;
  try {
    storedDetails = restoreCorrectionForm(request.formData).form;
  } catch (error) {
    snapshotError =
      error instanceof Error
        ? error.message
        : 'The original form data is incomplete.';
  }
  const editEnabled = canEdit && !snapshotError;
  const editExplanation = canEdit ? (snapshotError ?? editReason) : editReason;

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
          Applicant name and department use the verified account relation when
          available. Other details appear only when they were stored in the
          submitted form.
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
        {storedDetails && (
          <ClaimFieldSummary
            papers={storedDetails.papers}
            items={storedDetails.items}
            comments={storedDetails.comments}
          />
        )}
        {rows.length > 0 && (
          <div
            className="mt-4 overflow-x-auto rounded-control border border-border"
            tabIndex={0}
            aria-label="Submitted paper rows; scroll horizontally to view all columns"
          >
            <table className="min-w-[60rem] w-full border-collapse text-left text-sm">
              <caption className="sr-only">
                Original Paper Setting & Marking rows
              </caption>
              <thead className="bg-action text-white">
                <tr>
                  <th scope="col" className="p-3">
                    Paper
                  </th>
                  <th scope="col" className="p-3">
                    Duration (hours)
                  </th>
                  <th scope="col" className="p-3">
                    Setting
                  </th>
                  <th scope="col" className="p-3">
                    Moderation
                  </th>
                  <th scope="col" className="p-3">
                    Translation
                  </th>
                  <th scope="col" className="p-3">
                    Marking
                  </th>
                  <th scope="col" className="p-3">
                    Second marking
                  </th>
                  <th scope="col" className="p-3">
                    Assessment
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.key}>
                    <th
                      scope="row"
                      className="max-w-64 p-3 font-semibold [overflow-wrap:anywhere]"
                    >
                      {row.title}
                    </th>
                    <td className="p-3">{row.duration}</td>
                    <td className="p-3">{row.setting}</td>
                    <td className="p-3">{row.moderation}</td>
                    <td className="p-3">{row.translation}</td>
                    <td className="p-3">{row.marking}</td>
                    <td className="p-3">{row.secondMarking}</td>
                    <td className="p-3">{row.assessment}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {Array.isArray(request.formData.papers) ? (
          <p className="mt-4 text-sm text-muted">
            The returned claim includes its original paper rows. Review and
            update those rows in the correction form; the backend recalculates
            the authoritative amount when the request is saved or resubmitted.
          </p>
        ) : (
          <p className="mt-4 text-sm text-muted">
            This returned record contains aggregate quantities only. The
            correction editor stays unavailable because individual paper rows
            cannot be reconstructed safely.
          </p>
        )}
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
        <Alert
          title={
            editEnabled
              ? 'Correction editing is available'
              : 'Correction editing is unavailable'
          }
          tone={editEnabled ? 'info' : 'warning'}
        >
          {editEnabled ? (
            <p>
              Save corrected details to this returned request, then review and
              resubmit it. The backend preserves the request and routes it back
              to the returning officer’s workflow stage.
            </p>
          ) : (
            <p>
              {editExplanation ??
                'Editing is available only to the original lecturer while the request is assigned to lecturer correction.'}
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
          {editEnabled ? (
            <Link
              to={`/requests/new?correctionId=${encodeURIComponent(request.id)}`}
              className="inline-flex min-h-11 items-center justify-center rounded-control border border-action bg-blue-50 px-4 py-3 text-sm font-semibold text-action hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
            >
              Edit corrections
            </Link>
          ) : (
            <Button
              variant="warning"
              disabled
              aria-describedby="correction-action-help"
            >
              Edit corrections
            </Button>
          )}
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
