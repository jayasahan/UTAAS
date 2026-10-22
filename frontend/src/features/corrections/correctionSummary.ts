import type {
  RequestDetail,
  RequestHistory,
  RequestTracking,
} from '../requests/contracts';

export interface DisplayField {
  label: string;
  value: string;
}

export interface FeeLine {
  label: string;
  unit: string;
  rate: number;
  quantity: number;
  subtotal: number;
}

export interface CorrectionSummary {
  applicantFields: DisplayField[];
  academicFields: DisplayField[];
  claimFields: DisplayField[];
  feeLines: FeeLine[];
  feeTotal: number | null;
  documents: DisplayField[];
  returningRole: string | null;
  returningName: string | null;
  returnedAt: string | null;
  comment: string | null;
  currentStage: string;
  hasLecturerCorrectionStage: boolean;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function displayText(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function nonNegativeNumber(value: unknown): number | null {
  const candidate =
    typeof value === 'number'
      ? value
      : typeof value === 'string' && value.trim()
        ? Number(value)
        : Number.NaN;
  return Number.isFinite(candidate) && candidate >= 0 ? candidate : null;
}

function displayNumber(value: number): string {
  return new Intl.NumberFormat('en-LK', { maximumFractionDigits: 2 }).format(
    value,
  );
}

function roleLabel(value: string | null): string | null {
  if (!value) return null;
  const labels: Record<string, string> = {
    HOD: 'Head of Department',
    HEAD_OF_DEPARTMENT: 'Head of Department',
    DEAN: 'Dean',
    EXAMINATION_OFFICER: 'Examination Officer',
    FINANCIAL_OFFICER: 'Financial Officer',
    ASSISTANT_BURSAR: 'Assistant Bursar',
  };
  return labels[value] ?? value.replaceAll('_', ' ').toLowerCase();
}

function latestReturn(history: RequestHistory | null) {
  const events = history?.events
    .filter(
      (event) =>
        event.actionType === 'RETURN' ||
        event.newStatus === 'RETURNED_FOR_CORRECTION',
    )
    .sort(
      (left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt),
    );
  return events?.[0] ?? null;
}

function returnedStage(tracking: RequestTracking | null) {
  return (
    tracking?.stages
      .filter((stage) => stage.status === 'RETURNED')
      .sort((left, right) => right.order - left.order)[0] ?? null
  );
}

export function summarizeCorrection(
  request: RequestDetail,
  tracking: RequestTracking | null,
  history: RequestHistory | null,
): CorrectionSummary {
  const formData = request.formData;
  const personal = asRecord(formData.personal);
  const metadata = asRecord(formData.metadata);
  const items = asRecord(formData.items);
  const applicantFields: DisplayField[] = [];
  const academicFields: DisplayField[] = [];
  const claimFields: DisplayField[] = [];
  const documents: DisplayField[] = [];

  const applicantName =
    request.applicant?.fullName ?? displayText(personal?.fullName);
  if (applicantName)
    applicantFields.push({ label: 'Full name', value: applicantName });
  const department = request.applicant?.department;
  const departmentValue = [department?.name, department?.code]
    .filter((value): value is string => Boolean(value))
    .join(' · ');
  const formDepartment = displayText(personal?.department);
  if (departmentValue || formDepartment)
    applicantFields.push({
      label: 'Department',
      value: departmentValue || formDepartment || '',
    });
  for (const [key, label] of [
    ['designation', 'Designation'],
    ['staffId', 'Staff ID'],
    ['referenceTitle', 'Private reference title'],
  ] as const) {
    const value = displayText(personal?.[key]);
    if (value) applicantFields.push({ label, value });
  }

  for (const [key, label] of [
    ['academicYear', 'Academic year'],
    ['semester', 'Semester'],
    ['degreeProgramme', 'Degree programme'],
    ['courseCode', 'Course code'],
    ['courseTitle', 'Course title'],
    ['examType', 'Examination type'],
    ['examinerRole', 'Examiner role'],
  ] as const) {
    const value = displayText(metadata?.[key]);
    if (value) academicFields.push({ label, value });
  }

  for (const [key, label, unit] of [
    ['paperSettingCount', 'Paper setting', 'papers'],
    ['paperModerationCount', 'Paper moderation', 'papers'],
    ['scriptMarkingCount', 'Script marking', 'scripts'],
    ['practicalAssessmentHours', 'Practical / oral assessment', 'hours'],
    ['secondMarkingCount', 'Second marking', 'scripts'],
  ] as const) {
    const value = nonNegativeNumber(items?.[key]);
    if (value !== null)
      claimFields.push({ label, value: `${displayNumber(value)} ${unit}` });
  }

  const feeCalculation = asRecord(formData.feeCalculation);
  const isLkrFeeCalculation = feeCalculation?.currency === 'LKR';
  const feeTotal = isLkrFeeCalculation
    ? nonNegativeNumber(feeCalculation?.totalAmount)
    : null;
  const feeLines =
    isLkrFeeCalculation && Array.isArray(feeCalculation?.items)
      ? feeCalculation.items.flatMap((value): FeeLine[] => {
          const line = asRecord(value);
          const label = displayText(line?.label);
          const unit = displayText(line?.unit);
          const rate = nonNegativeNumber(line?.rate);
          const quantity = nonNegativeNumber(line?.count);
          const subtotal = nonNegativeNumber(line?.subtotal);
          if (
            !label ||
            !unit ||
            rate === null ||
            quantity === null ||
            subtotal === null
          )
            return [];
          return [{ label, unit, rate, quantity, subtotal }];
        })
      : [];

  const supportingDocuments = Array.isArray(formData.supportingDocuments)
    ? formData.supportingDocuments
    : [];
  supportingDocuments.forEach((value, index) => {
    const document = asRecord(value);
    const name = displayText(document?.name);
    if (!name) return;
    const category = displayText(document?.documentType);
    documents.push({
      label: category ? category.replaceAll('_', ' ') : `Document ${index + 1}`,
      value: name,
    });
  });

  const event = latestReturn(history);
  const stage = returnedStage(tracking);
  const role = event?.actorRole ?? stage?.requiredRole ?? null;
  const comment = displayText(event?.comment) ?? displayText(stage?.comments);
  const returnedAt = event?.createdAt ?? stage?.completedAt ?? null;
  const currentStage =
    tracking?.currentStage.name ??
    request.currentStageKey.replaceAll('_', ' ').toLowerCase();

  return {
    applicantFields,
    academicFields,
    claimFields,
    feeLines,
    feeTotal,
    documents,
    returningRole: roleLabel(role),
    returningName: event?.actorName ?? stage?.actorName ?? null,
    returnedAt,
    comment,
    currentStage,
    hasLecturerCorrectionStage:
      tracking?.currentStage.key === 'LECTURER_CORRECTION' ||
      request.currentStageKey === 'LECTURER_CORRECTION',
  };
}
