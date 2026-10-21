import { useEffect, useRef } from 'react';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { FormStepper } from '../../components/tracking/Steppers';
import { persistenceUnavailable, steps } from './model';
import { useClaimForm } from './useClaimForm';
import { validateReview } from './validation';
import { AcademicFields, PersonalStep } from './components/InformationStep';
import { PaymentTable } from './components/PaymentTable';
import { DocumentsStep } from './components/DocumentsStep';
import { ReviewStep } from './components/ReviewStep';
import { ReviewProgress } from './components/ReviewProgress';
import './paper-marking.css';

export function PaperMarkingClaimPage() {
  const claim = useClaimForm();
  const heading = useRef<HTMLHeadingElement>(null);
  const summary = useRef<HTMLDivElement>(null);
  const pendingFocus = useRef<string | null>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    heading.current?.focus();
  }, [claim.step]);
  useEffect(() => {
    if (claim.errors.length) summary.current?.focus();
  }, [claim.errors]);
  useEffect(() => {
    if (pendingFocus.current) {
      document.getElementById(pendingFocus.current)?.focus();
      pendingFocus.current = null;
    }
  });
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    // Entries/files are deliberately memory-only. Warn before a full page exit.
    const dirty =
      Object.values(claim.form.personal).some(Boolean) ||
      Object.values(claim.form.academic).some(Boolean) ||
      claim.form.documents.length > 0 ||
      claim.form.papers.some(
        (row) =>
          row.title ||
          row.durationHours ||
          [
            row.settingCount,
            row.moderationCount,
            row.translationCount,
            row.scriptCount,
            row.secondMarkingCount,
            row.assessmentQuantity,
          ].some((value) => value !== '0'),
      );
    if (dirty) window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [claim.form]);
  return (
    <div className="space-y-6">
      <header>
        <h1
          ref={heading}
          tabIndex={-1}
          className="text-3xl font-bold text-brand"
        >
          Paper setting & marking payment
        </h1>
        <p className="mt-2 text-muted">
          Step {claim.step + 1} of 4 · Local preparation · Not saved
        </p>
      </header>
      <div className="rounded-control border border-warning bg-amber-50 p-4 text-sm text-brand">
        <p>{persistenceUnavailable}</p>
        <p className="mt-2">
          Entries and files remain in this page only. Leaving this route or
          refreshing loses them. No claim is submitted.
        </p>
      </div>
      {claim.step === 3 ? (
        <ReviewProgress onEdit={claim.navigate} />
      ) : (
        <FormStepper
          steps={steps}
          currentStepId={steps[claim.step]!.id}
          onStepChange={(id) => {
            const index = steps.findIndex((step) => step.id === id);
            if (index >= 0) claim.navigate(index);
          }}
        />
      )}
      <p role="status" className="sr-only">
        {claim.announcement}
      </p>
      {claim.errors.length > 0 && (
        <div
          ref={summary}
          tabIndex={-1}
          role="alert"
          className="rounded-control border-2 border-danger bg-red-50 p-4"
        >
          <h2 className="font-bold text-danger">
            Check the following information
          </h2>
          <ul className="mt-2 list-inside list-disc space-y-2">
            {claim.errors.map((error) => (
              <li key={error.field}>
                <a
                  className="underline"
                  href={`#${error.field}`}
                  onClick={(event) => {
                    event.preventDefault();
                    if (claim.step !== error.step) {
                      pendingFocus.current = error.field;
                      claim.navigate(error.step);
                    } else document.getElementById(error.field)?.focus();
                  }}
                >
                  {error.message}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (claim.step < 3) claim.navigate(claim.step + 1);
          else claim.setErrors(validateReview(claim.form));
        }}
      >
        <Card className="space-y-8">
          {claim.step === 0 && (
            <PersonalStep
              value={claim.form.personal}
              errors={claim.errors}
              onChange={claim.updatePersonal}
            />
          )}
          {claim.step === 1 && (
            <>
              <AcademicFields
                value={claim.form.academic}
                errors={claim.errors}
                onChange={claim.updateAcademic}
              />
              <PaymentTable
                papers={claim.form.papers}
                errors={[...claim.errors, ...claim.quantityErrors]}
                onChange={claim.updatePaper}
                onAdd={() => {
                  pendingFocus.current = claim.addPaper();
                }}
                onRemove={(id) => {
                  pendingFocus.current = 'add-paper';
                  claim.removePaper(id);
                }}
              />
            </>
          )}
          {claim.step === 2 && (
            <DocumentsStep
              documents={claim.form.documents}
              errors={claim.errors}
              fileErrors={claim.fileErrors}
              onSelect={claim.selectDocuments}
              category={claim.form.selectedDocumentCategory}
              onCategoryChange={claim.setDocumentCategory}
              onRemove={(id) => {
                pendingFocus.current = 'documents';
                claim.removeDocument(id);
              }}
            />
          )}
          {claim.step === 3 && (
            <ReviewStep
              form={claim.form}
              errors={claim.errors}
              onEdit={claim.navigate}
              onDeclaration={claim.setDeclaration}
            />
          )}
        </Card>
        {claim.step === 0 && (
          <Card className="mt-6">
            <section aria-labelledby="next-steps-heading" className="space-y-3">
              <h2
                id="next-steps-heading"
                className="text-lg font-bold text-brand"
              >
                Next steps
              </h2>
              <p className="text-sm text-ink">
                Step 2: Examination & Payment Details · Step 3: Evidence and
                local document selection · Step 4: Review and declaration
              </p>
            </section>
          </Card>
        )}
        <footer className="mt-6 flex flex-wrap items-center gap-3">
          {claim.step > 0 && (
            <Button
              variant="ghost"
              onClick={() => claim.navigate(claim.step - 1)}
            >
              ← Previous
            </Button>
          )}
          <Button
            variant="secondary"
            disabled
            aria-describedby="persistence-reason"
          >
            Save draft
          </Button>
          {claim.step < 3 ? (
            <Button type="submit" className="sm:ml-auto">
              {claim.step === 2 ? 'Review application →' : 'Continue →'}
            </Button>
          ) : (
            <>
              <Button type="submit">Validate local review</Button>
              <Button
                variant="success"
                disabled
                aria-describedby="persistence-reason"
                className="sm:ml-auto"
              >
                Submit Application
              </Button>
            </>
          )}
        </footer>
        <p id="persistence-reason" className="mt-4 text-sm text-muted">
          {persistenceUnavailable}
          {claim.step === 3 && !claim.form.declaration
            ? ' The declaration must also be accepted.'
            : ''}
        </p>
      </form>
    </div>
  );
}
