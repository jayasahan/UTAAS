import { record, text } from '../../auth/contracts';
import type { ClaimForm, PaperRow } from './model';
import { academicLabels, personalLabels } from './model';
import {
  decodeClaimItems,
  decodeComments,
  decodePaperExtensions,
  preservedItems,
} from './supportedFields';

export interface PersistedDocument {
  name: string;
  url: string;
  documentType: string;
  size?: number;
  attachedToClaim?: boolean;
}

export interface PersistedClaim {
  id: string;
  trackingNumber: string;
  status: string;
  totalAmount: number;
  formData: Record<string, unknown>;
}

export interface UploadedDocument extends PersistedDocument {
  mimetype: string;
}

function decodeDocumentReference(
  value: unknown,
  allowStoredHttps = true,
): PersistedDocument {
  const data = record(value);
  const url = text(data.url);
  const filename = url.slice('/api/v1/requests/documents/'.length);
  // Historical DTO records can contain HTTPS storage references. Preserve them
  // as opaque metadata; this form never follows or downloads those URLs.
  let storedHttps = false;
  if (allowStoredHttps) {
    try {
      const parsed = new URL(url);
      storedHttps =
        parsed.protocol === 'https:' && !parsed.username && !parsed.password;
    } catch {
      /* Relative upload references are validated below. */
    }
  }
  if (
    !storedHttps &&
    (!url.startsWith('/api/v1/requests/documents/') ||
      !filename ||
      filename.includes('/') ||
      filename.includes('..') ||
      filename.includes('?') ||
      filename.includes('#'))
  )
    throw new Error('Invalid uploaded document reference');
  const documentType = text(data.documentType);
  const size = data.size;
  if (
    size !== undefined &&
    (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0)
  )
    throw new Error('Invalid uploaded document size');
  return {
    name: text(data.name),
    url,
    documentType,
    ...(typeof size === 'number' ? { size } : {}),
  };
}

export function decodePersistedClaim(value: unknown): PersistedClaim {
  const data = record(value);
  const amount = Number(data.totalAmount);
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Invalid amount');
  return {
    id: text(data.id),
    trackingNumber: text(data.trackingNumber),
    status: text(data.status),
    totalAmount: amount,
    formData: record(data.formData),
  };
}

export function decodeUploadedDocument(value: unknown): UploadedDocument {
  const data = record(value);
  const reference = decodeDocumentReference(data, false);
  const size = data.size;
  if (typeof size !== 'number' || !Number.isSafeInteger(size) || size < 1)
    throw new Error('Invalid uploaded document size');
  const mimetype = text(data.mimetype);
  if (!['application/pdf', 'image/png', 'image/jpeg'].includes(mimetype))
    throw new Error('Invalid uploaded document type');
  return {
    ...reference,
    mimetype,
  };
}

export function decodeSubmittedClaim(value: unknown): PersistedClaim {
  const claim = decodePersistedClaim(value);
  if (claim.status !== 'UNDER_REVIEW')
    throw new Error('The server did not confirm claim submission.');
  return claim;
}

function numberValue(value: string, label: string): number {
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0)
    throw new Error(`${label} must be a non-negative number.`);
  return result;
}

/** Maps editable UI state to the verified Nest DTO without aggregating paper rows. */
export function toDraftPayload(
  form: ClaimForm,
  supportingDocuments: PersistedDocument[] = [],
) {
  if (form.documents.length)
    throw new Error(
      'Remove locally selected files before saving. They have not been uploaded and cannot be included in this draft.',
    );
  const papers = form.papers
    .filter((paper) => paper.title.trim())
    .map((paper) => ({
      id: paper.id,
      title: paper.title.trim(),
      durationHours: numberValue(paper.durationHours || '0', 'Duration'),
      settingCount: numberValue(paper.settingCount, 'Papers set'),
      moderationCount: numberValue(paper.moderationCount, 'Papers moderated'),
      translationCount: numberValue(
        paper.translationCount,
        'Papers translated',
      ),
      scriptCount: numberValue(paper.scriptCount, 'Scripts marked'),
      secondMarkingCount: numberValue(
        paper.secondMarkingCount,
        'Scripts second-marked',
      ),
      assessmentUnit: paper.assessmentUnit,
      assessmentQuantity: numberValue(
        paper.assessmentQuantity || '0',
        'Assessment quantity',
      ),
      ...decodePaperExtensions(paper),
    }));
  const partialRows = form.papers.some(
    (paper) =>
      !paper.title.trim() &&
      (paper.durationHours ||
        Number(paper.settingCount) ||
        Number(paper.moderationCount) ||
        Number(paper.translationCount) ||
        Number(paper.scriptCount) ||
        Number(paper.secondMarkingCount) ||
        Number(paper.assessmentQuantity) ||
        paper.typedPageCount !== undefined ||
        paper.settingShare !== undefined ||
        paper.markingShare !== undefined ||
        paper.combinedPaperConfig !== undefined),
  );
  if (partialRows)
    throw new Error(
      'Complete the title of each started paper row, or remove that row, before saving.',
    );
  return {
    personal: Object.fromEntries(
      Object.keys(personalLabels).map((key) => [
        key,
        form.personal[key as keyof typeof personalLabels],
      ]),
    ),
    metadata: Object.fromEntries(
      Object.keys(academicLabels).map((key) => [
        key,
        form.academic[key as keyof typeof academicLabels],
      ]),
    ),
    papers,
    supportingDocuments: supportingDocuments.map((document) =>
      decodeDocumentReference(document),
    ),
    declaration: form.declaration,
    selectedDocumentCategory: form.selectedDocumentCategory,
    ...(form.items === undefined ? {} : { items: preservedItems(form) }),
    ...(form.comments === undefined
      ? {}
      : { comments: decodeComments(form.comments) }),
  };
}

/** Only DTO-supported fields; all rates and monetary totals remain server-owned. */
export function toSubmissionPayload(
  form: ClaimForm,
  supportingDocuments: PersistedDocument[],
) {
  if (!form.declaration)
    throw new Error('Accept the declaration before submitting.');
  if (!supportingDocuments.length)
    throw new Error(
      'Upload at least one supporting document before submitting.',
    );
  const draft = toDraftPayload(form, supportingDocuments);
  return {
    personal: draft.personal,
    metadata: draft.metadata,
    papers: draft.papers,
    supportingDocuments: draft.supportingDocuments,
    declaration: draft.declaration,
    ...(draft.items === undefined ? {} : { items: draft.items }),
    ...(draft.comments === undefined ? {} : { comments: draft.comments }),
  };
}

function stringOrEmpty(value: unknown): string {
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : '';
}
function decodePaper(value: unknown, index: number): PaperRow {
  const item = record(value);
  const unit = item.assessmentUnit === 'hours' ? 'hours' : 'candidates';
  return {
    id: stringOrEmpty(item.id) || `paper-${index + 1}`,
    title: stringOrEmpty(item.title),
    durationHours: stringOrEmpty(item.durationHours),
    settingCount: stringOrEmpty(item.settingCount ?? 0),
    moderationCount: stringOrEmpty(item.moderationCount ?? 0),
    translationCount: stringOrEmpty(item.translationCount ?? 0),
    scriptCount: stringOrEmpty(item.scriptCount ?? 0),
    secondMarkingCount: stringOrEmpty(item.secondMarkingCount ?? 0),
    assessmentUnit: unit,
    assessmentQuantity: stringOrEmpty(item.assessmentQuantity ?? 0),
    ...decodePaperExtensions(item),
  };
}

export function restoreFormData(
  value: Record<string, unknown>,
): Omit<ClaimForm, 'documents'> & { persistedDocuments: PersistedDocument[] } {
  const personal = value.personal == null ? {} : record(value.personal);
  const academicValue = value.metadata ?? value.academic ?? {};
  const academic = record(academicValue);
  const rows = Array.isArray(value.papers) ? value.papers.map(decodePaper) : [];
  const documents = Array.isArray(value.supportingDocuments)
    ? value.supportingDocuments.map((entry) => ({
        ...decodeDocumentReference(entry),
        attachedToClaim: true,
      }))
    : [];
  const category = value.selectedDocumentCategory;
  return {
    personal: {
      fullName: stringOrEmpty(personal.fullName),
      designation: stringOrEmpty(personal.designation),
      department: stringOrEmpty(personal.department),
      staffId: stringOrEmpty(personal.staffId),
      referenceTitle: stringOrEmpty(personal.referenceTitle),
    },
    academic: {
      academicYear: stringOrEmpty(academic.academicYear),
      semester: stringOrEmpty(academic.semester),
      degreeProgramme: stringOrEmpty(academic.degreeProgramme),
      courseCode: stringOrEmpty(academic.courseCode),
      courseTitle: stringOrEmpty(academic.courseTitle),
      examType: stringOrEmpty(academic.examType),
      examinerRole: stringOrEmpty(academic.examinerRole),
    },
    papers: rows.length
      ? rows
      : [
          {
            id: 'paper-1',
            title: '',
            durationHours: '',
            settingCount: '0',
            moderationCount: '0',
            translationCount: '0',
            scriptCount: '0',
            secondMarkingCount: '0',
            assessmentUnit: 'candidates',
            assessmentQuantity: '0',
          },
        ],
    persistedDocuments: documents,
    selectedDocumentCategory:
      typeof category === 'string' && category.trim()
        ? category
        : 'APPOINTMENT_LETTER',
    declaration: value.declaration === true,
    ...(value.items == null ? {} : { items: decodeClaimItems(value.items) }),
    ...(value.comments == null
      ? {}
      : { comments: decodeComments(value.comments) }),
    originalPapers: structuredClone(rows),
  };
}
