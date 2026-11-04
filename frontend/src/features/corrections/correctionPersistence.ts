import { record } from '../../auth/contracts';
import type { RequestDetail, RequestHistory } from '../requests/contracts';
import type { ClaimForm } from '../paper-marking/model';
import {
  restoreFormData,
  toDraftPayload,
  type PersistedDocument,
} from '../paper-marking/persistence';

export interface RestoredCorrectionForm {
  form: Omit<ClaimForm, 'documents'>;
  persistedDocuments: PersistedDocument[];
  warnings: string[];
}

const requiredMetadata = [
  'academicYear',
  'semester',
  'degreeProgramme',
  'examType',
  'examinerRole',
] as const;
const optionalMetadata = ['courseCode', 'courseTitle'] as const;
const personalFields = [
  'fullName',
  'designation',
  'department',
  'staffId',
  'referenceTitle',
] as const;
const numericPaperFields = [
  'durationHours',
  'settingCount',
  'moderationCount',
  'translationCount',
  'scriptCount',
  'secondMarkingCount',
  'assessmentQuantity',
] as const;
const numericPaperLabels: Record<(typeof numericPaperFields)[number], string> =
  {
    durationHours: 'duration hours',
    settingCount: 'paper setting count',
    moderationCount: 'moderation count',
    translationCount: 'translation count',
    scriptCount: 'script marking count',
    secondMarkingCount: 'second marking count',
    assessmentQuantity: 'assessment quantity',
  };

function validNumber(value: unknown): boolean {
  if (typeof value === 'string' && !value.trim()) return false;
  const number = typeof value === 'string' ? Number(value) : value;
  return (
    typeof number === 'number' &&
    Number.isFinite(number) &&
    number >= 0 &&
    number <= Number.MAX_SAFE_INTEGER
  );
}

function hasOwn(value: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

/**
 * Correcting a claim requires its original row-level snapshot. Aggregate-only
 * claims cannot be safely reconstructed into the multi-paper editor.
 */
export function restoreCorrectionForm(
  formData: Record<string, unknown>,
): RestoredCorrectionForm {
  const warnings = new Set<string>();
  if (!formData.personal || (!formData.metadata && !formData.academic))
    throw new Error(
      'The original applicant and course information is incomplete. Editing is unavailable to prevent replacing unavailable values.',
    );

  const personal = record(formData.personal);
  const metadata = record(formData.metadata ?? formData.academic);
  for (const field of requiredMetadata) {
    if (typeof metadata[field] !== 'string')
      throw new Error(
        'The original required course information is incomplete. Editing is unavailable to prevent replacing unavailable values.',
      );
  }
  for (const field of optionalMetadata) {
    if (!hasOwn(metadata, field))
      warnings.add(
        'The original course code or title was not stored. Confirm these fields before resubmitting.',
      );
  }
  for (const field of personalFields) {
    if (!hasOwn(personal, field))
      warnings.add(
        'Some optional personal fields were not stored and appear blank. Confirm them before resubmitting.',
      );
    else if (typeof personal[field] !== 'string')
      throw new Error(
        'The original personal information is malformed. Editing is unavailable to prevent replacing it.',
      );
  }

  if (!Array.isArray(formData.papers) || formData.papers.length === 0)
    throw new Error(
      'This claim does not include its original paper rows. Aggregate quantities cannot be reconstructed safely, so editing is unavailable.',
    );
  const ids = new Set<string>();
  formData.papers.forEach((value, index) => {
    const paper = record(value);
    if (typeof paper.title !== 'string' || !paper.title.trim())
      throw new Error(
        `The original paper row ${index + 1} is incomplete. Editing is unavailable to prevent losing claim details.`,
      );
    for (const field of numericPaperFields) {
      if (!hasOwn(paper, field)) {
        if (field === 'durationHours')
          warnings.add(
            'An original duration was not stored. The field appears blank and must be verified before resubmitting.',
          );
        else
          warnings.add(
            'Some optional original quantities were not stored and appear as zero. Verify them before resubmitting.',
          );
      } else if (!validNumber(paper[field])) {
        throw new Error(
          `The original paper row ${index + 1} has an invalid quantity. Editing is unavailable until the data is corrected.`,
        );
      }
    }
    if (
      paper.assessmentUnit !== 'hours' &&
      paper.assessmentUnit !== 'candidates'
    ) {
      if (
        validNumber(paper.assessmentQuantity) &&
        Number(paper.assessmentQuantity) > 0
      )
        throw new Error(
          `The original assessment unit for paper ${index + 1} is unavailable. The quantity cannot be safely interpreted.`,
        );
      warnings.add(
        'An unused assessment unit was not stored. Verify the unit if you add an assessment quantity.',
      );
    }
    if (paper.id !== undefined) {
      if (typeof paper.id !== 'string' || !paper.id.trim() || ids.has(paper.id))
        throw new Error(
          'The original paper rows have invalid or duplicate identifiers. Editing is unavailable to prevent row mix-ups.',
        );
      ids.add(paper.id);
    }
  });

  if (!Array.isArray(formData.supportingDocuments))
    throw new Error(
      'The original supporting-document references are unavailable. Editing is disabled so a correction cannot detach unknown documents.',
    );
  if (
    formData.declaration !== undefined &&
    typeof formData.declaration !== 'boolean'
  )
    throw new Error('The original declaration value is malformed.');
  if (formData.declaration === undefined)
    warnings.add(
      'The original declaration was not returned. Review and accept the declaration before resubmitting.',
    );

  const restored = restoreFormData(formData);
  return {
    form: {
      personal: restored.personal,
      academic: restored.academic,
      papers: restored.papers.map((paper, index) => ({
        ...paper,
        id: paper.id || `correction-paper-${index + 1}`,
      })),
      selectedDocumentCategory: restored.selectedDocumentCategory,
      declaration: restored.declaration,
      items: restored.items,
      comments: restored.comments,
      originalPapers: restored.originalPapers,
    },
    persistedDocuments: restored.persistedDocuments,
    warnings: [...warnings],
  };
}

/** Full writable snapshot; independent items survive and the server owns all fees. */
export function toCorrectionPayload(
  form: ClaimForm,
  documents: PersistedDocument[],
) {
  form.papers.forEach((paper, index) => {
    if (!paper.title.trim())
      throw new Error(
        `Complete or remove paper ${index + 1} before saving corrections. An untitled row cannot be omitted from a correction snapshot.`,
      );
    for (const field of numericPaperFields) {
      if (!paper[field].trim())
        throw new Error(
          `Enter ${numericPaperLabels[field]} (or 0) for paper ${index + 1} before saving corrections.`,
        );
    }
  });
  const snapshot = toDraftPayload(form, documents);
  return {
    personal: snapshot.personal,
    metadata: snapshot.metadata,
    papers: snapshot.papers,
    supportingDocuments: snapshot.supportingDocuments,
    declaration: snapshot.declaration,
    ...(snapshot.items === undefined ? {} : { items: snapshot.items }),
    ...(snapshot.comments === undefined ? {} : { comments: snapshot.comments }),
  };
}

/** SaveDraftClaimDto stores these extra values; omitted fields would default on update. */
export function toCorrectionDraftPayload(
  form: ClaimForm,
  documents: PersistedDocument[],
  existingComments: unknown,
) {
  return {
    ...toCorrectionPayload(form, documents),
    selectedDocumentCategory: form.selectedDocumentCategory,
    ...(form.comments === undefined && typeof existingComments === 'string'
      ? { comments: existingComments }
      : {}),
  };
}

const stageForRole: Readonly<Record<string, string>> = {
  HOD: 'HEAD_OF_DEPARTMENT',
  DEAN: 'DEAN',
  EXAMINATION_OFFICER: 'EXAMINATION_OFFICE',
  FINANCIAL_OFFICER: 'FINANCIAL_OFFICE',
  ASSISTANT_BURSAR: 'ASSISTANT_BURSAR',
};

export function expectedCorrectionStage(history: RequestHistory): string {
  const returned = history.events
    .filter(
      (event) =>
        event.actionType === 'RETURN' ||
        event.newStatus === 'RETURNED_FOR_CORRECTION',
    )
    .sort(
      (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
    )[0];
  const stage = returned ? stageForRole[returned.actorRole] : undefined;
  if (!stage)
    throw new Error(
      'The returning officer role could not be verified. Resubmission is unavailable.',
    );
  return stage;
}

export function verifyCorrectionResponse(
  request: RequestDetail,
  expectedId: string,
  expectedStatus: 'RETURNED_FOR_CORRECTION' | 'UNDER_REVIEW',
  expectedStage?: string,
): RequestDetail {
  if (
    request.id !== expectedId ||
    request.status !== expectedStatus ||
    (expectedStage !== undefined && request.currentStageKey !== expectedStage)
  )
    throw new Error(
      'The backend response did not confirm the expected request, status, and workflow stage.',
    );
  return request;
}
