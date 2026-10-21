import { record, text } from '../../auth/contracts';
import type { ClaimForm, PaperRow } from './model';

export interface PersistedDocument {
  name: string;
  url: string;
  documentType: string;
  size?: number;
}

export interface PersistedClaim {
  id: string;
  trackingNumber: string;
  status: string;
  totalAmount: number;
  formData: Record<string, unknown>;
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
        Number(paper.assessmentQuantity)),
  );
  if (partialRows)
    throw new Error(
      'Complete the title of each started paper row, or remove that row, before saving.',
    );
  return {
    personal: { ...form.personal },
    metadata: { ...form.academic },
    papers,
    supportingDocuments,
    declaration: form.declaration,
    selectedDocumentCategory: form.selectedDocumentCategory,
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
    ? value.supportingDocuments.map((entry) => {
        const document = record(entry);
        return {
          name: text(document.name),
          url: text(document.url),
          documentType: text(document.documentType),
          ...(typeof document.size === 'number' ? { size: document.size } : {}),
        };
      })
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
      category === 'EXAM_TIMETABLE' || category === 'ATTENDANCE_MARKS_SHEET'
        ? category
        : 'APPOINTMENT_LETTER',
    declaration: value.declaration === true,
  };
}
