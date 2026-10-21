import { record, text } from '../../auth/contracts';
import type { StaffProfile } from '../../auth/contracts';
import {
  decodeRequestDetail,
  decodeRequestHistory,
  decodeRequestTracking,
} from '../requests/contracts';
import type {
  RequestHistory,
  RequestStatus,
  RequestTracking,
} from '../requests/contracts';

export interface ReviewPersonalInfo {
  fullName: string | null;
  designation: string | null;
  department: string | null;
  staffId: string | null;
  referenceTitle: string | null;
}

export interface ReviewAcademicInfo {
  academicYear: string | null;
  semester: string | null;
  degreeProgramme: string | null;
  courseCode: string | null;
  courseTitle: string | null;
  examType: string | null;
  examinerRole: string | null;
}

export interface ReviewPaperRow {
  title: string | null;
  durationHours: number | null;
  settingCount: number | null;
  moderationCount: number | null;
  translationCount: number | null;
  scriptCount: number | null;
  secondMarkingCount: number | null;
  assessmentUnit: 'hours' | 'candidates' | null;
  assessmentQuantity: number | null;
}

export interface ReviewFeeLine {
  key: string;
  label: string;
  unit: string;
  rate: number;
  count: number;
  subtotal: number;
}

export interface ReviewDocumentMetadata {
  name: string;
  documentType: string;
  size: number | null;
  mimeType: string | null;
  downloadFilename: string | null;
}

export interface OfficerClaimReview {
  id: string;
  trackingNumber: string;
  applicantName: string | null;
  requestType: string;
  status: RequestStatus;
  submittedAt: string;
  totalAmount: number;
  personal: ReviewPersonalInfo;
  academic: ReviewAcademicInfo;
  papers: ReviewPaperRow[];
  feeLines: ReviewFeeLine[];
  documents: ReviewDocumentMetadata[];
  tracking: RequestTracking;
  history: RequestHistory;
  reviewerRole: Exclude<StaffProfile['role'], 'LECTURER'>;
}

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const personalKeys = [
  'fullName',
  'designation',
  'department',
  'staffId',
  'referenceTitle',
] as const;
const academicKeys = [
  'academicYear',
  'semester',
  'degreeProgramme',
  'courseCode',
  'courseTitle',
  'examType',
  'examinerRole',
] as const;

function optionalText(value: unknown): string | null {
  if (value == null || value === '') return null;
  if (typeof value !== 'string') throw new Error('Invalid claim review text');
  return value;
}

function optionalNumber(value: unknown): number | null {
  if (value == null) return null;
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0)
    throw new Error('Invalid claim review quantity');
  return value;
}

function optionalRecord(value: unknown): Record<string, unknown> {
  return value == null ? {} : record(value);
}

function mapStrings<T extends readonly string[]>(
  value: Record<string, unknown>,
  keys: T,
): { [K in T[number]]: string | null } {
  return Object.fromEntries(
    keys.map((key) => [key, optionalText(value[key])]),
  ) as { [K in T[number]]: string | null };
}

function decodePaper(value: unknown): ReviewPaperRow {
  const row = record(value);
  const assessmentUnit = row.assessmentUnit;
  if (
    assessmentUnit != null &&
    assessmentUnit !== 'hours' &&
    assessmentUnit !== 'candidates'
  )
    throw new Error('Invalid assessment unit');
  return {
    title: optionalText(row.title),
    durationHours: optionalNumber(row.durationHours),
    settingCount: optionalNumber(row.settingCount),
    moderationCount: optionalNumber(row.moderationCount),
    translationCount: optionalNumber(row.translationCount),
    scriptCount: optionalNumber(row.scriptCount),
    secondMarkingCount: optionalNumber(row.secondMarkingCount),
    assessmentUnit: assessmentUnit ?? null,
    assessmentQuantity: optionalNumber(row.assessmentQuantity),
  };
}

function decodeFeeLines(value: unknown): ReviewFeeLine[] {
  if (value == null) return [];
  const calculation = record(value);
  if (calculation.items == null) return [];
  if (!Array.isArray(calculation.items))
    throw new Error('Invalid server fee breakdown');
  return calculation.items.map((value) => {
    const line = record(value);
    const rate = optionalNumber(line.rate);
    const count = optionalNumber(line.count);
    const subtotal = optionalNumber(line.subtotal);
    if (rate == null || count == null || subtotal == null)
      throw new Error('Incomplete server fee breakdown');
    return {
      key: text(line.key),
      label: text(line.label),
      unit: text(line.unit),
      rate,
      count,
      subtotal,
    };
  });
}

function decodeDocuments(value: unknown): ReviewDocumentMetadata[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error('Invalid supporting documents');
  return value.map((value) => {
    const document = record(value);
    const url = optionalText(document.url);
    const prefix = '/api/v1/requests/documents/';
    const candidate = url?.startsWith(prefix) ? url.slice(prefix.length) : '';
    const downloadFilename =
      /^[A-Za-z0-9][A-Za-z0-9._-]{0,254}$/.test(candidate) &&
      !candidate.includes('..') &&
      candidate !== '.' &&
      candidate !== '..'
        ? candidate
        : null;
    return {
      name: text(document.name),
      documentType: text(document.documentType),
      size: optionalNumber(document.size),
      mimeType: optionalText(document.mimetype ?? document.mimeType),
      downloadFilename,
    };
  });
}

export function decodeOfficerClaimReview(
  detailValue: unknown,
  trackingValue: unknown,
  historyValue: unknown,
  reviewerRole: Exclude<StaffProfile['role'], 'LECTURER'>,
): OfficerClaimReview {
  const rawDetail = record(detailValue);
  const detail = decodeRequestDetail(rawDetail);
  const tracking = decodeRequestTracking(trackingValue);
  const history = decodeRequestHistory(historyValue);
  if (
    !uuidPattern.test(detail.id) ||
    tracking.trackingNumber !== detail.trackingNumber ||
    history.trackingNumber !== detail.trackingNumber ||
    history.requestId !== detail.id ||
    tracking.status !== detail.status
  )
    throw new Error('Mismatched claim review responses');

  const formData = record(detail.formData);
  const personal = optionalRecord(formData.personal);
  const academic = optionalRecord(formData.metadata ?? formData.academic);
  const paperValues = formData.papers == null ? [] : formData.papers;
  if (!Array.isArray(paperValues)) throw new Error('Invalid paper rows');
  const applicant = optionalRecord(rawDetail.applicant);
  const applicantName =
    optionalText(personal.fullName) ?? optionalText(applicant.fullName);

  return {
    id: detail.id,
    trackingNumber: detail.trackingNumber,
    applicantName,
    requestType: tracking.requestType,
    status: detail.status,
    submittedAt: detail.createdAt,
    totalAmount: detail.totalAmount,
    personal: mapStrings(personal, personalKeys),
    academic: mapStrings(academic, academicKeys),
    papers: paperValues.map(decodePaper),
    feeLines: decodeFeeLines(formData.feeCalculation),
    documents: decodeDocuments(formData.supportingDocuments),
    tracking,
    history,
    reviewerRole,
  };
}
