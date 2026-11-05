import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Dialog } from '../../components/common/Dialog';
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
import { useAcademicOptions } from './useAcademicOptions';
import { validateAcademicChoices } from './academicOptions';
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
import {
  decodeRequestDetail,
  decodeRequestHistory,
} from '../requests/contracts';
import { useCorrectionRequest } from '../corrections/useCorrectionRequest';
import {
  expectedCorrectionStage,
  toCorrectionDraftPayload,
  toCorrectionPayload,
  verifyCorrectionResponse,
} from '../corrections/correctionPersistence';
import { usePaperStructure } from './structure/usePaperStructure';
import { PaperStructurePanel } from './structure/PaperStructurePanel';
import { settingAvailability, settingQuotaErrors } from './structure/quotas';

function apiFailureMessage(error: unknown, fallback: string): string {
  if (error instanceof ApiError)
    return error.validationMessages.join(' ') || error.message;
  return error instanceof Error ? error.message : fallback;
}

function SubmissionNavigation({
  claim,
  correction = false,
}: {
  claim: Pick<PersistedClaim, 'id' | 'trackingNumber' | 'totalAmount'>;
  correction?: boolean;
}) {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(`/requests/${encodeURIComponent(claim.id)}`, {
      state: {
        [correction ? 'resubmissionConfirmed' : 'submissionConfirmed']: {
          trackingNumber: claim.trackingNumber,
          totalAmount: claim.totalAmount,
        },
      },
    });
  }, [claim, correction, navigate]);
  return (
    <p role="status">
      {correction
        ? 'Opening the resubmitted request details…'
        : 'Opening the submitted request details…'}
    </p>
  );
}

export function PaperMarkingClaimPage() {
  const claim = useClaimForm();
  const integration = useReadOnlyData();
  const location = useLocation();
  const search = new URLSearchParams(location.search);
  const correctionMode = search.has('correctionId');
  const conflictingIds = correctionMode && search.has('draftId');
  const correctionId = correctionMode
    ? conflictingIds
      ? ''
      : search.get('correctionId')
    : null;
  const draftId = correctionMode ? null : search.get('draftId');
  const correctionRequest = useCorrectionRequest(
    correctionId,
    integration.session.client,
    integration.profile,
    claim.restore,
  );
  const correction = correctionRequest.resource;
  const [draftBusy, setDraftBusy] = useState(Boolean(draftId));
  const [draftLoaded, setDraftLoaded] = useState(false);
  const [draftError, setDraftError] = useState('');
  const [draftMessage, setDraftMessage] = useState('');
  const [persistedDocuments, setPersistedDocuments] = useState<
    PersistedDocument[]
  >([]);
  const [correctionDocumentOverride, setCorrectionDocumentOverride] = useState<{
    requestId: string;
    documents: PersistedDocument[];
  } | null>(null);
  const [uploadStatus, setUploadStatus] = useState<
    Record<string, 'uploading' | 'error'>
  >({});
  const [uploadErrors, setUploadErrors] = useState<Record<string, string>>({});
  const [submitBusy, setSubmitBusy] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [resubmitDialogOpen, setResubmitDialogOpen] = useState(false);
  const [resubmitUnknown, setResubmitUnknown] = useState(false);
  const [statusCheckBusy, setStatusCheckBusy] = useState(false);
  const [submittedAsCorrection, setSubmittedAsCorrection] = useState(false);
  const [submittedClaim, setSubmittedClaim] = useState<Pick<
    PersistedClaim,
    'id' | 'trackingNumber' | 'totalAmount'
  > | null>(null);
  const uploadLocks = useRef(new Set<string>());
  const submitLock = useRef(false);
  const resubmitLock = useRef(false);
  const [savedClaim, setSavedClaim] = useState<{
    id: string;
    trackingNumber: string;
    totalAmount: number;
  } | null>(null);
  const loadedDraft = useRef('');
  const { applyProfile, restore } = claim;
  const loadedProfile = integration.profile.data;
  const academicChoices = useAcademicOptions(
    loadedProfile,
    claim.form.academic.semester,
  );
  const { selectCourse } = claim;
  const departmentScope = loadedProfile
    ? JSON.stringify([
        loadedProfile.id,
        loadedProfile.departmentId,
        loadedProfile.departmentCode,
      ])
    : null;
  const previousDepartment = useRef<string | null>(null);
  useEffect(() => {
    if (departmentScope === null) return;
    if (
      previousDepartment.current !== null &&
      previousDepartment.current !== departmentScope
    )
      selectCourse('', '');
    previousDepartment.current = departmentScope;
  }, [departmentScope, selectCourse]);
  const hasSession = Boolean(integration.session.client);
  const lecturerSession =
    hasSession && integration.profile.data?.role === 'LECTURER';
  const paperStructure = usePaperStructure(
    lecturerSession ? integration.session.client : null,
    claim.form.academic,
  );
  const quotaErrors = settingQuotaErrors(
    claim.form.papers,
    paperStructure.data,
    loadedProfile?.id,
  );
  const settingUnavailable =
    settingAvailability(paperStructure.data, loadedProfile?.id)
      ?.wholePaperAvailable === false;
  const verifiedRates = verifiedRatesFromCircular(integration.circular.data);
  const correctionContext = correction.status === 'ready' ? correction : null;
  const currentDocuments = correctionContext
    ? correctionDocumentOverride?.requestId === correctionContext.request.id
      ? correctionDocumentOverride.documents
      : correctionContext.restored.persistedDocuments
    : persistedDocuments;
  const currentSavedClaim =
    correctionContext && savedClaim?.id !== correctionContext.request.id
      ? {
          id: correctionContext.request.id,
          trackingNumber: correctionContext.request.trackingNumber,
          totalAmount: correctionContext.request.totalAmount,
        }
      : savedClaim;
  function updateCurrentDocuments(
    update: (documents: PersistedDocument[]) => PersistedDocument[],
  ) {
    if (correctionContext) {
      const requestId = correctionContext.request.id;
      setCorrectionDocumentOverride((current) => ({
        requestId,
        documents: update(
          current?.requestId === requestId
            ? current.documents
            : correctionContext.restored.persistedDocuments,
        ),
      }));
      return;
    }
    setPersistedDocuments(update);
  }
  const academicErrors = () =>
    validateAcademicChoices(claim.form, academicChoices);
  const reviewErrors = () => [
    ...validateReview(claim.form, currentDocuments.length),
    ...academicErrors(),
    ...quotaErrors,
  ];
  const navigateClaim = (target: number) => {
    if (target > 1 && target > claim.step && quotaErrors.length) {
      if (claim.navigate(1, currentDocuments.length, academicErrors()))
        claim.setErrors([...academicErrors(), ...quotaErrors]);
      return false;
    }
    return claim.navigate(target, currentDocuments.length, academicErrors());
  };
  const actionHelp = correctionMode
    ? claim.form.documents.length > 0
      ? 'Upload locally selected documents before saving or resubmitting; uploaded references remain separate from the request until saved.'
      : claim.step === 3 && currentDocuments.length === 0
        ? 'Attach at least one supporting document before resubmitting.'
        : claim.step === 3 && !claim.form.declaration
          ? 'Accept the declaration before resubmitting.'
          : 'Saving updates this returned request. Resubmission returns the same request to the backend-defined review stage.'
    : !hasSession
      ? 'Sign in with the development lecturer account to upload documents, save drafts, or submit.'
      : !integration.profile.data
        ? 'Actions remain unavailable until the backend confirms the authenticated lecturer profile.'
        : !lecturerSession
          ? 'This claim workflow is available to an authenticated lecturer account only.'
          : claim.form.documents.length > 0
            ? 'Upload every locally selected document before saving or submitting.'
            : claim.step === 3 && currentDocuments.length === 0
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
    if (correctionMode) return;
    if (!hasSession) applyProfile(null);
    else if (loadedProfile) applyProfile(loadedProfile);
  }, [correctionMode, hasSession, loadedProfile, applyProfile]);
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
    if (!client || draftBusy || (correctionMode && correctionContext === null))
      return;
    setDraftBusy(true);
    setDraftError('');
    setDraftMessage('');
    try {
      if (correctionMode && correctionContext && correctionId) {
        const saved = await client.post(
          '/requests/paper-marking/draft',
          toCorrectionDraftPayload(
            claim.form,
            currentDocuments,
            correctionContext.request.formData.comments,
          ),
          decodeRequestDetail,
          { draftId: correctionId },
        );
        verifyCorrectionResponse(
          saved,
          correctionId,
          'RETURNED_FOR_CORRECTION',
          'LECTURER_CORRECTION',
        );
        setSavedClaim({
          id: saved.id,
          trackingNumber: saved.trackingNumber,
          totalAmount: saved.totalAmount,
        });
        updateCurrentDocuments((documents) =>
          documents.map((document) => ({ ...document, attachedToClaim: true })),
        );
        setDraftMessage(
          `Corrections saved to ${saved.trackingNumber}. The backend-confirmed total is ${new Intl.NumberFormat('en-LK', { style: 'currency', currency: 'LKR' }).format(saved.totalAmount)}.`,
        );
        return;
      }
      const saved = await client.post(
        '/requests/paper-marking/draft',
        toDraftPayload(claim.form, currentDocuments),
        decodePersistedClaim,
        savedClaim ? { draftId: savedClaim.id } : undefined,
      );
      setSavedClaim({
        id: saved.id,
        trackingNumber: saved.trackingNumber,
        totalAmount: saved.totalAmount,
      });
      updateCurrentDocuments((documents) =>
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
      paperStructure.refresh();
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
        correctionMode ? (correctionId ?? undefined) : undefined,
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
      updateCurrentDocuments((old) => [
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
    updateCurrentDocuments((old) =>
      old.filter((document) => document.url !== url),
    );
    setDraftMessage(
      correctionMode
        ? 'Document reference removed from this correction. Save corrections to persist this change.'
        : 'Document reference removed from this form. Save the draft to persist this change.',
    );
  }
  async function submitClaim() {
    const client = integration.session.client;
    if (
      correctionMode ||
      !client ||
      !lecturerSession ||
      submitLock.current ||
      submitBusy
    )
      return;
    const errors = reviewErrors();
    if (errors.length) {
      const firstStep = Math.min(...errors.map((error) => error.step));
      claim.navigate(firstStep, currentDocuments.length);
      claim.setErrors(errors.filter((error) => error.step === firstStep));
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
        toSubmissionPayload(claim.form, currentDocuments),
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
      paperStructure.refresh();
      submitLock.current = false;
      setSubmitBusy(false);
    }
  }
  function openResubmissionConfirmation() {
    if (!correctionMode || !correctionContext || submitBusy || draftBusy)
      return;
    const errors = reviewErrors();
    if (errors.length) {
      const firstStep = Math.min(...errors.map((error) => error.step));
      claim.navigate(firstStep, currentDocuments.length);
      claim.setErrors(errors.filter((error) => error.step === firstStep));
      return;
    }
    if (claim.form.documents.length || uploadLocks.current.size > 0) {
      setSubmitError(
        'Upload every selected document before reviewing and resubmitting corrections.',
      );
      return;
    }
    setSubmitError('');
    setResubmitDialogOpen(true);
  }
  async function resubmitCorrection() {
    const client = integration.session.client;
    const current = correctionContext;
    if (
      !client ||
      !lecturerSession ||
      !current ||
      resubmitLock.current ||
      submitBusy ||
      resubmitUnknown ||
      claim.form.documents.length ||
      uploadLocks.current.size > 0
    )
      return;
    const errors = reviewErrors();
    if (errors.length) {
      setResubmitDialogOpen(false);
      const firstStep = Math.min(...errors.map((error) => error.step));
      claim.navigate(firstStep, currentDocuments.length);
      claim.setErrors(errors.filter((error) => error.step === firstStep));
      return;
    }
    resubmitLock.current = true;
    setSubmitBusy(true);
    setSubmitError('');
    setDraftMessage('');
    let mutationStarted = false;
    const detailPath = `/requests/paper-marking/${encodeURIComponent(current.request.id)}`;
    try {
      const latest = await client.get(detailPath, decodeRequestDetail);
      verifyCorrectionResponse(
        latest,
        current.request.id,
        'RETURNED_FOR_CORRECTION',
        'LECTURER_CORRECTION',
      );
      const latestHistory = await client.get(
        `/requests/${encodeURIComponent(current.request.id)}/history`,
        decodeRequestHistory,
      );
      if (latestHistory.requestId !== current.request.id)
        throw new Error(
          'The backend returned history for a different request.',
        );
      const expectedStage = expectedCorrectionStage(latestHistory);
      const updatedFormData = toCorrectionPayload(claim.form, currentDocuments);
      mutationStarted = true;
      const resubmitted = await client.post(
        `/requests/${encodeURIComponent(current.request.id)}/actions`,
        { action: 'RESUBMIT', updatedFormData },
        decodeRequestDetail,
      );
      verifyCorrectionResponse(
        resubmitted,
        current.request.id,
        'UNDER_REVIEW',
        expectedStage,
      );
      setSubmittedAsCorrection(true);
      setSubmittedClaim({
        id: resubmitted.id,
        trackingNumber: resubmitted.trackingNumber,
        totalAmount: resubmitted.totalAmount,
      });
      setResubmitDialogOpen(false);
    } catch (error) {
      const uncertain =
        mutationStarted &&
        (!(error instanceof ApiError) ||
          error.kind === 'network' ||
          error.kind === 'invalid-response' ||
          (error.status !== undefined &&
            error.status !== 400 &&
            error.status !== 401 &&
            error.status !== 403 &&
            error.status !== 404));
      setResubmitUnknown(uncertain);
      setSubmitError(
        uncertain
          ? 'The resubmission outcome could not be confirmed. Check the request status before trying again.'
          : apiFailureMessage(
              error,
              'The corrections were not confirmed as resubmitted.',
            ),
      );
      setResubmitDialogOpen(false);
    } finally {
      paperStructure.refresh();
      resubmitLock.current = false;
      setSubmitBusy(false);
    }
  }
  async function checkResubmissionStatus() {
    const client = integration.session.client;
    const current = correctionContext;
    if (!client || !current || statusCheckBusy) return;
    setStatusCheckBusy(true);
    setSubmitError('');
    try {
      const id = current.request.id;
      const [latest, latestHistory] = await Promise.all([
        client.get(
          `/requests/paper-marking/${encodeURIComponent(id)}`,
          decodeRequestDetail,
        ),
        client.get(
          `/requests/${encodeURIComponent(id)}/history`,
          decodeRequestHistory,
        ),
      ]);
      if (latestHistory.requestId !== id)
        throw new Error(
          'The backend returned history for a different request.',
        );
      const expectedStage = expectedCorrectionStage(latestHistory);
      if (
        latest.id === id &&
        latest.status === 'UNDER_REVIEW' &&
        latest.currentStageKey === expectedStage
      ) {
        setResubmitUnknown(false);
        setSubmittedAsCorrection(true);
        setSubmittedClaim({
          id: latest.id,
          trackingNumber: latest.trackingNumber,
          totalAmount: latest.totalAmount,
        });
        return;
      }
      if (
        latest.id === id &&
        latest.status === 'RETURNED_FOR_CORRECTION' &&
        latest.currentStageKey === 'LECTURER_CORRECTION'
      ) {
        setResubmitUnknown(false);
        setSubmitError(
          'The backend confirms this request is still awaiting your corrections. Review the current form and resubmit when ready.',
        );
        return;
      }
      setSubmitError(
        'The request has a different status or workflow stage. It remains unavailable for another resubmission attempt.',
      );
    } catch (error) {
      setSubmitError(
        `The request status could not be verified. Do not retry yet. ${apiFailureMessage(error, 'Try checking again.')}`,
      );
    } finally {
      setStatusCheckBusy(false);
    }
  }
  if (submittedClaim)
    return (
      <SubmissionNavigation
        claim={submittedClaim}
        correction={submittedAsCorrection}
      />
    );
  if (correctionMode && conflictingIds)
    return (
      <section aria-labelledby="correction-error-title" className="space-y-4">
        <h1
          id="correction-error-title"
          className="text-3xl font-bold text-brand"
        >
          Correction unavailable
        </h1>
        <p role="alert" className="rounded-control border border-danger p-4">
          The URL contains both a correction request and a draft identifier.
          Open the returned application again from My Applications.
        </p>
        <Link className="underline text-action" to="/requests">
          Return to My Applications
        </Link>
      </section>
    );
  if (correctionMode && correction.status !== 'ready')
    return (
      <section aria-labelledby="correction-loading-title" className="space-y-4">
        <h1
          id="correction-loading-title"
          className="text-3xl font-bold text-brand"
        >
          {correction.status === 'loading'
            ? 'Loading returned application'
            : 'Correction unavailable'}
        </h1>
        <p
          role={correction.status === 'loading' ? 'status' : 'alert'}
          className="rounded-control border border-border p-4"
        >
          {correction.message}
        </p>
        {(correction.status === 'error' ||
          correction.status === 'unavailable') && (
          <Button variant="secondary" onClick={correctionRequest.retry}>
            Retry
          </Button>
        )}
        <Link className="block underline text-action" to="/requests">
          Return to My Applications
        </Link>
      </section>
    );
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
          {correctionMode
            ? 'Application Detail & Correction'
            : 'Paper setting & marking payment'}
        </h1>
        <p className="mt-2 text-muted">
          {correctionContext
            ? `${correctionContext.request.trackingNumber} · Step ${claim.step + 1} of 4`
            : `Step ${claim.step + 1} of 4 · ${savedClaim ? `Draft saved as ${savedClaim.trackingNumber}` : 'Local preparation · Not saved'}`}
        </p>
      </header>
      {correctionContext && (
        <section
          aria-labelledby="correction-instructions-title"
          className="rounded-control border border-warning bg-amber-50 p-4 text-ink"
        >
          <h2
            id="correction-instructions-title"
            className="font-bold text-brand"
          >
            Returned for correction
          </h2>
          <p className="mt-2">{correctionContext.correctionComment}</p>
          <p className="mt-2 text-sm text-muted">
            Corrected changes will update this request. Its next review stage is
            determined by the backend from the returning officer’s role.
          </p>
        </section>
      )}
      {correctionContext && correctionContext.restored.warnings.length > 0 && (
        <div
          role="status"
          className="rounded-control border border-warning bg-amber-50 p-4 text-ink"
        >
          <h2 className="font-semibold text-brand">
            Verify information not present in the returned record
          </h2>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm">
            {correctionContext.restored.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </div>
      )}
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
            {resubmitUnknown
              ? 'Do not resubmit until the server status has been checked.'
              : 'No successful submission is shown unless the backend confirms it.'}
          </p>
          {resubmitUnknown && (
            <Button
              className="mt-3"
              variant="secondary"
              pending={statusCheckBusy}
              onClick={() => void checkResubmissionStatus()}
            >
              Check request status
            </Button>
          )}
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
      {currentSavedClaim && (
        <p className="text-sm text-muted">
          {correctionMode ? 'Returned request' : 'Draft reference'}:{' '}
          {currentSavedClaim.trackingNumber} · Server-calculated total:{' '}
          {new Intl.NumberFormat('en-LK', {
            style: 'currency',
            currency: 'LKR',
          }).format(currentSavedClaim.totalAmount)}
        </p>
      )}
      <div className="rounded-control border border-warning bg-amber-50 p-4 text-sm text-brand">
        <p>
          {correctionMode
            ? 'Correction updates use the verified returned-request draft and resubmission contracts. The backend recalculates payment totals.'
            : persistenceUnavailable}
        </p>
        <p className="mt-2">
          {correctionMode
            ? 'The original request identifier and paper rows are preserved. No new claim is created by this correction form.'
            : savedClaim
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
          else claim.setErrors(reviewErrors());
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
                onCourseChange={claim.selectCourse}
                choices={academicChoices}
              />
              <PaperStructurePanel
                resource={paperStructure}
                onRefresh={paperStructure.refresh}
                examinerId={loadedProfile?.id}
              />
              <PaymentTable
                papers={claim.form.papers}
                durations={academicChoices.data?.paperDurations ?? []}
                durationsReady={academicChoices.status === 'ready'}
                settingUnavailable={settingUnavailable}
                totalQuestions={
                  paperStructure.data?.exists
                    ? paperStructure.data.paperStructure.totalQuestions
                    : undefined
                }
                onShareChange={claim.updatePaperShare}
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
                correctionMode={correctionMode}
                documents={claim.form.documents}
                errors={claim.errors}
                fileErrors={claim.fileErrors}
                onSelect={(files, category) =>
                  claim.selectDocuments(
                    files,
                    category,
                    currentDocuments.length,
                  )
                }
                category={claim.form.selectedDocumentCategory}
                onCategoryChange={claim.setDocumentCategory}
                uploadedDocuments={currentDocuments}
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
            <>
              <PaperStructurePanel
                resource={paperStructure}
                onRefresh={paperStructure.refresh}
                examinerId={loadedProfile?.id}
              />
              <ReviewStep
                form={claim.form}
                {...(verifiedRates ? { rates: verifiedRates } : {})}
                uploadedDocuments={currentDocuments}
                errors={claim.errors}
                onEdit={navigateClaim}
                onDeclaration={claim.setDeclaration}
                correctionMode={correctionMode}
              />
            </>
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
              (correctionMode && correctionContext === null) ||
              claim.form.documents.length > 0 ||
              Boolean(draftId && draftBusy)
            }
            aria-describedby="persistence-reason"
            onClick={() => void saveDraft()}
          >
            {correctionMode ? 'Save corrections' : 'Save draft'}
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
                {correctionMode ? 'Validate corrections' : 'Validate review'}
              </Button>
              <Button
                variant="success"
                pending={submitBusy}
                disabled={
                  !lecturerSession ||
                  (correctionMode &&
                    (correctionContext === null || resubmitUnknown)) ||
                  claim.form.documents.length > 0 ||
                  Object.values(uploadStatus).some(
                    (status) => status === 'uploading',
                  ) ||
                  currentDocuments.length === 0
                }
                aria-describedby="persistence-reason"
                className="sm:ml-auto"
                onClick={() =>
                  correctionMode
                    ? openResubmissionConfirmation()
                    : void submitClaim()
                }
              >
                {correctionMode ? 'Review & Resubmit' : 'Submit Application'}
              </Button>
            </>
          )}
        </footer>
        <p id="persistence-reason" className="mt-4 text-sm text-muted">
          {actionHelp} Local files are not sent with claim data.
        </p>
      </form>
      {correctionMode && correctionContext && (
        <Dialog
          open={resubmitDialogOpen}
          onClose={() => setResubmitDialogOpen(false)}
          title="Confirm correction and resubmission"
          description="This updates the existing returned application and sends it back to the backend-defined review stage."
        >
          <div className="space-y-4">
            <p>
              Request {correctionContext.request.trackingNumber} will keep the
              same request reference. The backend will recalculate the payment
              amount from the corrected paper rows.
            </p>
            <p className="text-sm text-muted">
              Current server-confirmed amount:{' '}
              {new Intl.NumberFormat('en-LK', {
                style: 'currency',
                currency: 'LKR',
              }).format(correctionContext.request.totalAmount)}
              . The corrected amount is confirmed only in the resubmission
              response.
            </p>
            <div className="flex flex-wrap justify-end gap-3">
              <Button
                variant="ghost"
                disabled={submitBusy}
                onClick={() => setResubmitDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                variant="success"
                pending={submitBusy}
                disabled={resubmitUnknown}
                onClick={() => void resubmitCorrection()}
              >
                Confirm resubmission
              </Button>
            </div>
          </div>
        </Dialog>
      )}
    </div>
  );
}
