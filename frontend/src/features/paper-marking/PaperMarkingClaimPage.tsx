import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { useReadOnlyData } from './useReadOnlyData';
import { ReadOnlyInformation } from './components/ReadOnlyInformation';
import {
  decodeSubmittedClaim,
  decodeUploadedDocument,
  decodePersistedClaim,
  restoreFormData,
  toDraftPayload,
  toSubmissionPayload,
} from './persistence';
import type { PersistedDocument } from './persistence';
import { ApiError } from '../../services/apiClient';
import { verifiedRatesFromCircular } from './estimates';
import type { PersistedClaim } from './persistence';

function apiFailureMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError)
    return error.validationMessages.join(' ') || error.message;
  return error instanceof Error ? error.message : fallback;
}

function SubmissionNavigation({
  claim,
}: {
  claim: Pick<PersistedClaim, 'id' | 'trackingNumber' | 'totalAmount'>;
}) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(`/requests/${encodeURIComponent(claim.id)}`, {
      state: {
        submissionConfirmed: {
          trackingNumber: claim.trackingNumber,
          totalAmount: claim.totalAmount,
        },
      },
    });
  }, [claim, navigate]);
  return <p role="status">Opening the submitted request details…</p>;
}

export function PaperMarkingClaimPage() {
  const claim = useClaimForm();
  const integration = useReadOnlyData();
  const draftId = new URLSearchParams(window.location.search).get('draftId');
  const [draftBusy, setDraftBusy] = useState(Boolean(draftId));
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftError, setDraftError] = useState('');
  const [draftMessage, setDraftMessage] = useState('');
  const [persistedDocuments, setPersistedDocuments] = useState<
    PersistedDocument[]
  >([]);
  const [uploadStatus, setUploadStatus] = useState<
    Record<string, 'uploading' | 'error'>
  >({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submittedClaim, setSubmittedClaim] = useState<Pick<
    PersistedClaim,
    'id' | 'trackingNumber' | 'totalAmount'
  > | null>(null);
  const uploadLocks = useRef(new Set<string>());
  const submitLock = useRef(false);
  const [savedClaim, setSavedClaim] = useState<{
    id: string;
    trackingNumber: string;
    totalAmount: number;
  } | null>(null);
  const loadedDraft = useRef('');
  const { applyProfile, restore } = claim;
  const loadedProfile = integration.profile.data;
  const hasSession = Boolean(integration.session.client);
  const lecturerSession =
    hasSession && integration.profile.data?.role === 'LECTURER';
  const verifiedRates = verifiedRatesFromCircular(integration.circular.data);
  const navigateClaim = (target: number) =>
    claim.navigate(target, persistedDocuments.length);
  const actionHelp = !hasSession
    ? 'Sign in with the development lecturer account to upload documents, save drafts, or submit.'
    : !integration.profile.data
      ? 'Actions remain unavailable until the backend confirms the authenticated lecturer profile.'
      : !lecturerSession
        ? 'This claim workflow is available to an authenticated lecturer account only.'
        : claim.form.documents.length > 0
          ? 'Upload every locally selected document before saving or submitting.'
          : claim.step === 3 && persistedDocuments.length === 0
            ? 'Upload at least one supporting document before submission.'
            : claim.step === 3 && !claim.form.declaration
              ? 'Accept the declaration before submission.'
              : persistenceUnavailable;
  useEffect(() => {
    const client = integration.session.client;
    if (!draftId || loadedDraft.current === draftId) return;
    if (!client) return;
    const controller = new AbortController();
    void client
      .get(
        `/requests/paper-marking/${encodeURIComponent(draftId)}`,
        decodePersistedClaim,
        controller.signal,
      )
      .then((saved) => {
        if (controller.signal.aborted) return;
        if (saved.status !== 'DRAFT')
          throw new Error('This request is no longer an editable draft.');
        const restored = restoreFormData(saved.formData);
        restore(restored);
        setPersistedDocuments(restored.persistedDocuments);
        setSavedClaim({
          id: saved.id,
          trackingNumber: saved.trackingNumber,
          totalAmount: saved.totalAmount,
        });
        loadedDraft.current = draftId;
        setDraftLoaded(true);
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          setDraftError(
            apiFailureMessage(error, 'Draft could not be restored.'),
          );
          setDraftLoaded(true);
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setDraftBusy(false);
      });
    return () => controller.abort();
  }, [draftId, integration.session.client, restore]);
  useEffect(() => {
    if (!hasSession) applyProfile(null);
    else if (loadedProfile) applyProfile(loadedProfile);
  }, [hasSession, loadedProfile, applyProfile]);
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
  async function saveDraft() {
    const client = integration.session.client;
    if (!client || draftBusy) return;
    setDraftBusy(true);
    setDraftError('');
    setDraftMessage('');
    try {
      const saved = await client.post(
        '/requests/paper-marking/draft',
        toDraftPayload(claim.form, persistedDocuments),
        decodePersistedClaim,
        savedClaim ? { draftId: savedClaim.id } : undefined,
      );
      setSavedClaim({
        id: saved.id,
        trackingNumber: saved.trackingNumber,
        totalAmount: saved.totalAmount,
      });
      setPersistedDocuments((documents) =>
        documents.map((document) => ({ ...document, attachedToClaim: true })),
      );
      setDraftMessage(`Draft saved on the server (${saved.trackingNumber}).`);
      loadedDraft.current = saved.id;
      if (!savedClaim)
        window.history.replaceState(
          {},
          '',
          `${window.location.pathname}?draftId=${encodeURIComponent(saved.id)}`,
        );
    } catch (error) {
      setDraftError(apiFailureMessage(error, 'Draft could not be saved.'));
    } finally {
      setDraftBusy(false);
    }
  }
  async function uploadDocument(
    document: (typeof claim.form.documents)[number],
  ) {
    const client = integration.session.client;
    if (!client || !lecturerSession || uploadLocks.current.has(document.id))
      return;
    uploadLocks.current.add(document.id);
    setUploadStatus((old) => ({ ...old, [document.id]: 'uploading' }));
    setUploadErrors((old) => ({ ...old, [document.id]: '' }));
    try {
      const uploaded = await client.upload(
        '/requests/upload',
        document.file,
        document.category,
        decodeUploadedDocument,
      );
      if (
        uploaded.name !== document.file.name ||
        uploaded.mimetype !== document.file.type ||
        uploaded.size !== document.file.size ||
        uploaded.documentType !== document.category
      )
        throw new Error(
          'The server upload response did not match the selected file.',
        );
      setPersistedDocuments((old) => [
        ...old.filter((item) => item.url !== uploaded.url),
        { ...uploaded, attachedToClaim: false },
      ]);
      setUploadStatus((old) => {
        const next = { ...old };
        delete next[document.id];
        return next;
      });
      setUploadErrors((old) => {
        const next = { ...old };
        delete next[document.id];
        return next;
      });
      claim.removeDocument(document.id);
    } catch (error) {
      const message = apiFailureMessage(
        error,
        'The document could not be uploaded.',
      );
      setUploadStatus((old) => ({ ...old, [document.id]: 'error' }));
      setUploadErrors((old) => ({ ...old, [document.id]: message }));
    } finally {
      uploadLocks.current.delete(document.id);
    }
  }
  function removeUploadedDocument(url: string) {
    setPersistedDocuments((old) =>
      old.filter((document) => document.url !== url),
    );
    setDraftMessage(
      'Document reference removed from this form. Save the draft to persist this change.',
    );
  }
  async function submitClaim() {
    const client = integration.session.client;
    if (!client || !lecturerSession || submitLock.current || submitBusy) return;
    const errors = validateReview(claim.form, persistedDocuments.length);
    if (errors.length) {
      claim.setErrors(errors);
      const firstStep = Math.min(...errors.map((error) => error.step));
      claim.navigate(firstStep, persistedDocuments.length);
      return;
    }
    if (uploadLocks.current.size > 0) return;
    submitLock.current = true;
    setSubmitBusy(true);
    setSubmitError('');
    setDraftMessage('');
    try {
      const submitted = await client.post(
        '/requests/paper-marking/submit',
        toSubmissionPayload(claim.form, persistedDocuments),
        decodeSubmittedClaim,
        savedClaim ? { draftId: savedClaim.id } : undefined,
      );
      setSubmittedClaim(submitted);
    } catch (error) {
      setSubmitError(
        apiFailureMessage(
          error,
          'The claim was not confirmed as submitted. Try again after checking its status.',
        ),
      );
    } finally {
      submitLock.current = false;
      setSubmitBusy(false);
    }
  }
  if (submittedClaim) return <SubmissionNavigation claim={submittedClaim} />;
  if (draftId && integration.session.client && draftBusy && !draftLoaded)
    return (
      <section aria-live="polite">
        <h1 className="text-3xl font-bold text-brand">Resume draft</h1>
        <p role="status" className="mt-4">
          Loading saved draft…
        </p>
      </section>
    );
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
          Step {claim.step + 1} of 4 ·{' '}
          {savedClaim
            ? `Draft saved as ${savedClaim.trackingNumber}`
            : 'Local preparation · Not saved'}
        </p>
      </header>
      <ReadOnlyInformation integration={integration} />
      {draftId && !integration.session.client && (
        <div
          role="alert"
          className="rounded-control border border-warning bg-amber-50 p-4"
        >
          Sign in to the authenticated development backend to resume this draft.
        </div>
      )}
      {draftBusy && draftId && !draftLoaded && (
        <p role="status">Loading saved draft…</p>
      )}
      {draftError && (
        <div
          role="alert"
          className="rounded-control border border-danger bg-red-50 p-4 text-danger"
        >
          {draftError}
        </div>
      )}
      {draftMessage && (
        <p
          role="status"
          className="rounded-control border border-success bg-teal-50 p-4 text-brand"
        >
          {draftMessage}
        </p>
      )}
      {submitError && (
        <div
          role="alert"
          className="rounded-control border border-danger bg-red-50 p-4 text-danger"
        >
          <p>{submitError}</p>
          <p className="mt-1 text-sm">
            No successful submission is shown unless the backend confirms it.
          </p>
        </div>
      )}
      {hasSession && integration.profile.data && !lecturerSession && (
        <div
          role="alert"
          className="rounded-control border border-warning bg-amber-50 p-4"
        >
          This claim workflow is available to an authenticated lecturer account
          only.
        </div>
      )}
      {savedClaim && (
        <p className="text-sm text-muted">
          Draft reference: {savedClaim.trackingNumber} · Server-calculated
          total:{' '}
          {new Intl.NumberFormat('en-LK', {
            style: 'currency',
            currency: 'LKR',
          }).format(savedClaim.totalAmount)}
        </p>
      )}
      <div className="rounded-control border border-warning bg-amber-50 p-4 text-sm text-brand">
        <p>{persistenceUnavailable}</p>
        <p className="mt-2">
          {savedClaim
            ? 'Form data in the last successful server save can be resumed from My Requests. Changes made since that save remain local.'
            : 'Entries and files remain in this page only until the first successful draft save. No claim is submitted.'}
        </p>
      </div>
      {claim.step === 3 ? (
        <ReviewProgress onEdit={navigateClaim} />
      ) : (
        <FormStepper
          steps={steps}
          currentStepId={steps[claim.step]!.id}
          onStepChange={(id) => {
            const index = steps.findIndex((step) => step.id === id);
            if (index >= 0) navigateClaim(index);
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
                      navigateClaim(error.step);
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
          if (claim.step < 3) navigateClaim(claim.step + 1);
          else
            claim.setErrors(
              validateReview(claim.form, persistedDocuments.length),
            );
        }}
      >
        <Card className="space-y-8">
          {claim.step === 0 && (
            <PersonalStep
              value={claim.form.personal}
              errors={claim.errors}
              onChange={claim.updatePersonal}
              profileAvailable={Boolean(integration.profile.data)}
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
                {...(verifiedRates ? { rates: verifiedRates } : {})}
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
            <>
              <DocumentsStep
                documents={claim.form.documents}
                errors={claim.errors}
                fileErrors={claim.fileErrors}
                onSelect={(files, category) =>
                  claim.selectDocuments(
                    files,
                    category,
                    persistedDocuments.length,
                  )
                }
                category={claim.form.selectedDocumentCategory}
                onCategoryChange={claim.setDocumentCategory}
                uploadedDocuments={persistedDocuments}
                uploadStatus={uploadStatus}
                uploadErrors={uploadErrors}
                onUpload={(document) => void uploadDocument(document)}
                onRemoveUploaded={removeUploadedDocument}
                uploadsEnabled={Boolean(lecturerSession)}
                onRemove={(id) => {
                  pendingFocus.current = 'documents';
                  claim.removeDocument(id);
                }}
              />
            </>
          )}
          {claim.step === 3 && (
            <ReviewStep
              form={claim.form}
              {...(verifiedRates ? { rates: verifiedRates } : {})}
              uploadedDocuments={persistedDocuments}
              errors={claim.errors}
              onEdit={navigateClaim}
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
              onClick={() => navigateClaim(claim.step - 1)}
            >
              ← Previous
            </Button>
          )}
          <Button
            variant="secondary"
            pending={draftBusy}
            disabled={
              !lecturerSession ||
              claim.form.documents.length > 0 ||
              Boolean(draftId && draftBusy)
            }
            aria-describedby="persistence-reason"
            onClick={() => void saveDraft()}
          >
            Save draft
          </Button>
          {claim.step < 3 ? (
            <Button
              type="submit"
              className="sm:ml-auto"
              disabled={
                submitBusy ||
                Object.values(uploadStatus).some(
                  (status) => status === 'uploading',
                )
              }
            >
              {claim.step === 2 ? 'Review application →' : 'Continue →'}
            </Button>
          ) : (
            <>
              <Button type="submit" disabled={submitBusy}>
                Validate review
              </Button>
              <Button
                variant="success"
                pending={submitBusy}
                disabled={
                  !lecturerSession ||
                  claim.form.documents.length > 0 ||
                  Object.values(uploadStatus).some(
                    (status) => status === 'uploading',
                  ) ||
                  persistedDocuments.length === 0
                }
                aria-describedby="persistence-reason"
                className="sm:ml-auto"
                onClick={() => void submitClaim()}
              >
                Submit Application
              </Button>
            </>
          )}
        </footer>
        <p id="persistence-reason" className="mt-4 text-sm text-muted">
          {actionHelp} Local files are not sent with claim data.
        </p>
      </form>
    </div>
  );
}
