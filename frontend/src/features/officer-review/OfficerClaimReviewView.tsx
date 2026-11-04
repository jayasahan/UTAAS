import { Link } from 'react-router-dom';
import { Card } from '../../components/common/Card';
import { Alert, EmptyState } from '../../components/common/Feedback';
import { Table, TableCell, TableHead } from '../../components/common/Table';
import { RequestStatusBadge } from '../../components/tracking/RequestStatusBadge';
import { RequestWorkflowProgress } from '../../components/tracking/RequestWorkflowProgress';
import { ConsensusTracking } from '../../components/tracking/ConsensusTracking';
import { WorkflowHistory } from '../../components/audit/WorkflowHistory';
import type { OfficerClaimReview } from './contracts';
import { OfficerDecisionSection } from './OfficerDecisionSection';
import type { WorkflowActionRequest } from './workflowActions';

const amount = new Intl.NumberFormat('en-LK', {
  style: 'currency',
  currency: 'LKR',
});
const quantity = new Intl.NumberFormat('en-LK', {
  maximumFractionDigits: 2,
});
const date = new Intl.DateTimeFormat('en-LK', {
  dateStyle: 'medium',
  timeStyle: 'short',
});

const reviewerHeadings: Record<string, string> = {
  HOD: 'Department review',
  DEAN: 'Faculty approval',
  EXAMINATION_OFFICER: 'Examination verification',
  FINANCIAL_OFFICER: 'Financial verification',
  ASSISTANT_BURSAR: 'Final authorization',
  ADMIN: 'Officer review',
};

const personalFields = [
  ['Full name', 'fullName'],
  ['Designation', 'designation'],
  ['Department', 'department'],
  ['Staff ID', 'staffId'],
  ['Private reference title', 'referenceTitle'],
] as const;
const academicFields = [
  ['Academic year', 'academicYear'],
  ['Semester', 'semester'],
  ['Degree programme', 'degreeProgramme'],
  ['Course code', 'courseCode'],
  ['Course title', 'courseTitle'],
  ['Examination type', 'examType'],
  ['Examiner role', 'examinerRole'],
] as const;

function SectionHeading({
  number: sectionNumber,
  title,
  description,
}: {
  number: number;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-control bg-brand text-sm font-bold text-white"
      >
        {sectionNumber}
      </span>
      <div className="min-w-0">
        <h2 className="text-lg font-bold text-brand">{title}</h2>
        {description && (
          <p className="mt-1 text-xs text-muted">{description}</p>
        )}
      </div>
    </div>
  );
}

function FieldList({
  values,
  fields,
}: {
  values: object;
  fields: readonly (readonly [string, string])[];
}) {
  return (
    <dl className="grid min-w-0 gap-x-6 gap-y-4 sm:grid-cols-2">
      {fields.map(([label, key]) => (
        <div key={key} className="min-w-0 [overflow-wrap:anywhere]">
          <dt className="text-xs text-muted">{label}</dt>
          <dd className="mt-1 font-semibold text-ink">
            {(values as Record<string, string | null>)[key] ?? 'Not provided'}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function OfficerClaimReviewView({
  review,
  onDownload,
  downloadingFilename,
  downloadError,
  decisionNotice,
  onExecuteDecision,
  actionsEnabled = true,
}: {
  review: OfficerClaimReview;
  onDownload?: (document: OfficerClaimReview['documents'][number]) => void;
  downloadingFilename?: string | null;
  downloadError?: string | null;
  decisionNotice?: string | null;
  onExecuteDecision?: (request: WorkflowActionRequest) => Promise<void>;
  actionsEnabled?: boolean;
}) {
  return (
    <div className="space-y-6">
      <Link
        to="/officer/queue"
        className="inline-flex min-h-10 items-center rounded-control font-semibold text-action underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action"
      >
        ← Back to Queue
      </Link>

      <header className="space-y-2">
        <p className="text-sm font-semibold text-muted">
          {reviewerHeadings[review.reviewerRole]} · Application review
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-display font-bold text-brand">
              Application review
            </h1>
            <p className="mt-2 [overflow-wrap:anywhere] text-sm text-muted">
              {review.trackingNumber} · {review.requestType} ·{' '}
              {review.applicantName ?? 'Applicant name unavailable'}
            </p>
          </div>
          <RequestStatusBadge status={review.status} />
        </div>
        <p className="text-sm text-muted">
          Submitted{' '}
          <time dateTime={review.submittedAt}>
            {date.format(new Date(review.submittedAt))}
          </time>
        </p>
      </header>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,2.15fr)_minmax(19rem,1fr)]">
        <div className="min-w-0">
          <Card className="space-y-6">
            <section
              aria-labelledby="review-personal-title"
              className="space-y-5"
            >
              <div id="review-personal-title">
                <SectionHeading
                  number={1}
                  title="Personal & Application Information"
                  description="Read-only values persisted with the submitted claim."
                />
              </div>
              <FieldList values={review.personal} fields={personalFields} />
              <div className="border-t border-border pt-5">
                <h3 className="mb-4 font-semibold text-brand">
                  Academic information
                </h3>
                <FieldList values={review.academic} fields={academicFields} />
              </div>
            </section>

            <section
              aria-labelledby="review-claim-title"
              className="space-y-5 border-t border-border pt-6"
            >
              <div id="review-claim-title">
                <SectionHeading
                  number={2}
                  title="Paper Setting & Marking Details"
                  description="Paper rows remain separate; the total and fee lines are returned by the server."
                />
              </div>
              {review.papers.length === 0 ? (
                <EmptyState title="No paper rows were returned">
                  <p>Paper details are unavailable in the persisted claim.</p>
                </EmptyState>
              ) : (
                <Table
                  caption="Paper Setting and Marking claim rows"
                  variant="claim"
                >
                  <thead>
                    <tr>
                      <TableHead>Paper</TableHead>
                      <TableHead>Duration (hours)</TableHead>
                      <TableHead>Setting</TableHead>
                      <TableHead>Moderation</TableHead>
                      <TableHead>Translation</TableHead>
                      <TableHead>Scripts marked</TableHead>
                      <TableHead>Second-marked</TableHead>
                      <TableHead>Assessment unit</TableHead>
                      <TableHead>Assessment quantity</TableHead>
                    </tr>
                  </thead>
                  <tbody>
                    {review.papers.map((paper, index) => (
                      <tr key={`${review.id}-paper-${index + 1}`}>
                        <TableCell className="font-semibold text-brand">
                          {paper.title ??
                            `Paper ${index + 1} — title unavailable`}
                        </TableCell>
                        <TableCell>{paper.durationHours ?? '—'}</TableCell>
                        <TableCell>{paper.settingCount ?? '—'}</TableCell>
                        <TableCell>{paper.moderationCount ?? '—'}</TableCell>
                        <TableCell>{paper.translationCount ?? '—'}</TableCell>
                        <TableCell>{paper.scriptCount ?? '—'}</TableCell>
                        <TableCell>{paper.secondMarkingCount ?? '—'}</TableCell>
                        <TableCell>
                          {paper.assessmentUnit ?? 'Not provided'}
                        </TableCell>
                        <TableCell>{paper.assessmentQuantity ?? '—'}</TableCell>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              )}

              {review.feeLines.length > 0 ? (
                <div className="space-y-3">
                  <h3 className="font-semibold text-brand">
                    Server fee breakdown (LKR)
                  </h3>
                  <Table caption="Server-confirmed fee lines" variant="claim">
                    <thead>
                      <tr>
                        <TableHead>Fee item</TableHead>
                        <TableHead>Rate</TableHead>
                        <TableHead>Quantity</TableHead>
                        <TableHead>Server subtotal</TableHead>
                      </tr>
                    </thead>
                    <tbody>
                      {review.feeLines.map((line) => (
                        <tr key={line.key}>
                          <TableCell>{line.label}</TableCell>
                          <TableCell>
                            {amount.format(line.rate)} {line.unit}
                          </TableCell>
                          <TableCell>{quantity.format(line.count)}</TableCell>
                          <TableCell className="font-semibold tabular-nums">
                            {amount.format(line.subtotal)}
                          </TableCell>
                        </tr>
                      ))}
                    </tbody>
                  </Table>
                </div>
              ) : (
                <p className="text-sm text-muted">
                  Server fee breakdown unavailable.
                </p>
              )}

              <p className="ml-auto w-fit rounded-control bg-teal-50 px-5 py-3 font-bold text-success">
                Server-confirmed total: {amount.format(review.totalAmount)}
              </p>
            </section>

            <section
              aria-labelledby="review-documents-title"
              className="space-y-5 border-t border-border pt-6"
            >
              <div id="review-documents-title">
                <SectionHeading
                  number={3}
                  title="Supporting Documents"
                  description="Read-only document metadata from the submitted claim."
                />
              </div>
              <p className="text-sm text-muted">
                Documents are retrieved through the authenticated request-scoped
                backend authorization check.
              </p>
              {downloadError && (
                <p role="alert" className="text-sm font-semibold text-danger">
                  {downloadError}
                </p>
              )}
              {review.documents.length === 0 ? (
                <EmptyState title="No supporting documents were returned" />
              ) : (
                <ul className="divide-y divide-border">
                  {review.documents.map((document, index) => (
                    <li
                      key={`${document.name}-${index}`}
                      className="flex min-w-0 flex-wrap items-center justify-between gap-3 py-3"
                    >
                      <div className="min-w-0 [overflow-wrap:anywhere]">
                        <p className="font-semibold text-brand">
                          {document.name}
                        </p>
                        <p className="mt-1 text-sm text-muted">
                          {document.documentType}
                          {document.mimeType ? ` · ${document.mimeType}` : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-3">
                        <p className="text-sm text-muted">
                          {document.size == null
                            ? 'Size unavailable'
                            : `${quantity.format(document.size / 1024)} KB`}
                        </p>
                        {onDownload && document.downloadFilename && (
                          <button
                            type="button"
                            disabled={
                              downloadingFilename === document.downloadFilename
                            }
                            onClick={() => onDownload(document)}
                            aria-label={`Download ${document.name}`}
                            className="min-h-10 rounded-control border border-action px-3 py-2 text-sm font-semibold text-action hover:bg-info-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-action disabled:cursor-wait disabled:opacity-60"
                          >
                            {downloadingFilename === document.downloadFilename
                              ? 'Downloading…'
                              : 'Download'}
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </Card>
        </div>

        <aside className="min-w-0 space-y-6">
          <section
            aria-labelledby="review-progress-title"
            className="space-y-4"
          >
            <div id="review-progress-title">
              <SectionHeading number={4} title="Approval Progress" />
            </div>
            <RequestWorkflowProgress
              detail={review}
              tracking={review.tracking}
              compact
            />
            <ConsensusTracking
              record={review.consensusSnapshot ?? { state: 'missing' }}
              viewer={{ role: review.reviewerRole }}
            />
          </section>

          <section aria-labelledby="review-history-title" className="space-y-4">
            <h2
              id="review-history-title"
              className="text-lg font-bold text-brand"
            >
              Approval & Activity History
            </h2>
            <WorkflowHistory
              history={review.history}
              emptyTitle="No review history was returned"
            />
          </section>
          {decisionNotice && (
            <Alert title="Decision recorded" tone="success">
              <p>{decisionNotice}</p>
            </Alert>
          )}
          {onExecuteDecision && (
            <OfficerDecisionSection
              review={review}
              onExecute={onExecuteDecision}
              actionsEnabled={actionsEnabled}
            />
          )}
        </aside>
      </div>
    </div>
  );
}
