import { Button } from '../../../components/common/Button';
import { Checkbox } from '../../../components/common/FormControls';
import { academicLabels, personalLabels } from '../model';
import type { ClaimForm, FieldError } from '../model';
import { estimatePaper, estimateTotal, formatEstimate } from '../estimates';
import { quantityLabels } from '../validation';
import { documentLabels } from '../model';

function SectionHeading({
  number,
  children,
}: {
  number: number;
  children: string;
}) {
  return (
    <h3 className="flex min-w-0 items-start gap-3 font-bold text-brand">
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-control bg-success-subtle text-success"
      >
        {number}
      </span>
      <span className="min-w-0 self-center">{children}</span>
    </h3>
  );
}

export function ReviewStep({
  form,
  errors,
  onEdit,
  onDeclaration,
}: {
  form: ClaimForm;
  errors: FieldError[];
  onEdit: (step: number) => void;
  onDeclaration: (value: boolean) => void;
}) {
  return (
    <section
      aria-labelledby="review-heading"
      className="min-w-0 space-y-6 [overflow-wrap:anywhere]"
    >
      <h2 id="review-heading" className="text-2xl font-bold text-brand">
        Review & Submit
      </h2>
      <div className="space-y-4 rounded-control border border-border p-4">
        <SectionHeading number={1}>
          Personal & Application Information
        </SectionHeading>
        <dl className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          {(Object.keys(personalLabels) as (keyof typeof personalLabels)[]).map(
            (key) => (
              <div key={key} className="min-w-0">
                <dt className="text-sm text-muted">{personalLabels[key]}</dt>
                <dd className="break-words">
                  {form.personal[key] || 'Not provided'}
                </dd>
              </div>
            ),
          )}
        </dl>
        <p className="text-sm text-muted">
          User-entered details; university identity is not verified.
        </p>
        <Button variant="ghost" onClick={() => onEdit(0)}>
          Edit personal information
        </Button>
      </div>
      <div className="space-y-4 rounded-control border border-border p-4">
        <SectionHeading number={2}>Claim / Payment Details</SectionHeading>
        <dl className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
          {(Object.keys(academicLabels) as (keyof typeof academicLabels)[]).map(
            (key) => (
              <div key={key} className="min-w-0">
                <dt className="text-sm text-muted">{academicLabels[key]}</dt>
                <dd className="break-words">{form.academic[key]}</dd>
              </div>
            ),
          )}
        </dl>
        <ol className="space-y-3">
          {form.papers.map((paper, index) => (
            <li
              key={paper.id}
              className="min-w-0 space-y-2 border-t border-border pt-3"
            >
              <h4 className="break-words font-semibold">
                Paper {index + 1}: {paper.title}
              </h4>
              <p>Duration: {paper.durationHours} hours</p>
              <dl className="grid min-w-0 grid-cols-1 gap-2 sm:grid-cols-2">
                {(
                  Object.keys(quantityLabels) as (keyof typeof quantityLabels)[]
                ).map((key) => (
                  <div key={key} className="min-w-0">
                    <dt className="text-sm text-muted">
                      {quantityLabels[key]}
                    </dt>
                    <dd>{paper[key]}</dd>
                  </div>
                ))}
                <div className="min-w-0">
                  <dt className="text-sm text-muted">
                    Assessment ({paper.assessmentUnit})
                  </dt>
                  <dd>{paper.assessmentQuantity}</dd>
                </div>
              </dl>
              <p>Row estimate: {formatEstimate(estimatePaper(paper))}</p>
            </li>
          ))}
        </ol>
        <p className="font-semibold">
          Total estimate: {formatEstimate(estimateTotal(form.papers))}
        </p>
        <p className="text-sm text-muted">
          Verified rates are unavailable. No payable total has been established.
        </p>
        <Button variant="ghost" onClick={() => onEdit(1)}>
          Edit payment details
        </Button>
      </div>
      <div className="space-y-4 rounded-control border border-border p-4">
        <SectionHeading number={3}>Supporting Documents</SectionHeading>
        <ul className="space-y-2">
          {form.documents.map((doc) => (
            <li key={doc.id} className="break-all">
              {doc.file.name} · {documentLabels[doc.category]} · Locally
              selected, not uploaded
            </li>
          ))}
        </ul>
        <Button variant="ghost" onClick={() => onEdit(2)}>
          Edit supporting documents
        </Button>
      </div>
      <div className="space-y-4 rounded-control border border-border p-4">
        <h3 className="font-bold text-brand">Declaration</h3>
        <Checkbox
          id="declaration"
          label="I declare that the information provided is accurate and supported by valid documents."
          checked={form.declaration}
          onChange={(event) => onDeclaration(event.target.checked)}
          {...(errors.find((error) => error.field === 'declaration')
            ? {
                error: errors.find((error) => error.field === 'declaration')!
                  .message,
              }
            : {})}
          hint="Acceptance applies to this local review only. Editing any application details resets the declaration. It does not enable submission while persistence is unavailable."
        />
      </div>
    </section>
  );
}
