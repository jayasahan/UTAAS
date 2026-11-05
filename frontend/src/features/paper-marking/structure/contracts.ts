import { record, text } from '../../../auth/contracts';

export interface StructureSelection {
  courseCode: string;
  academicYear: string;
  semester: string;
  examType: string;
}
export interface SettingClaimant {
  examinerId: string;
  examinerName: string;
  questionsClaimed: number;
  proportion: number;
  trackingNumber: string;
  status: string;
}
export interface MarkingClaimant {
  examinerName: string;
  scriptsMarked: number;
  questionsMarked: number;
  trackingNumber: string;
}
export interface RegisteredStructure extends StructureSelection {
  id: string;
  courseTitle: string | null;
  paperType: string;
  paperDurationHours: number;
  totalQuestions: number;
  totalMcqQuestions: number;
  totalCandidates: number;
  essayWeightPercent: number;
  mcqWeightPercent: number;
  hodProportionDivision?: ProportionDivision;
}
export interface ProportionResponse {
  lecturerId: string;
  lecturerName: string;
  agreed: boolean;
  comments: string;
  respondedAt: string;
}
export interface ProportionDivision {
  essayWeightPercent: number;
  mcqWeightPercent: number;
  comments: string;
  setByHodId: string;
  setByHodName: string;
  setAt: string;
  status:
    | 'AWAITING_LECTURER_CONSENSUS'
    | 'DISAGREED_RETURNED_TO_HOD'
    | 'CONSENSUS_REACHED';
  responses: ProportionResponse[];
}
export interface StructureQuotas {
  setting: {
    totalQuestions: number;
    claimedQuestions: number;
    remainingQuestions: number;
    isFullPaperClaimed: boolean;
    claimants: SettingClaimant[];
  };
  mcqSetting: {
    totalMcqQuestions: number;
    claimedMcqQuestions: number;
    remainingMcqQuestions: number;
  };
  moderation: { isClaimed: boolean; claimedBy?: string };
  typing: { isClaimed: boolean; typedPagesClaimed: number; claimedBy?: string };
  scriptMarking: {
    totalCandidates: number;
    totalScriptsClaimed: number;
    totalQuestionsMarked: number;
    remainingQuestionsPerScript: number;
    claimants: MarkingClaimant[];
  };
  continuousAssessment: {
    maxAssessmentsPerStudent: number;
    totalStudentAssessmentsClaimed: number;
    maxTotalAssessmentsAllowed: number;
  };
}
export type PaperStructureResponse =
  | { exists: false; message: string }
  | {
      exists: true;
      paperStructure: RegisteredStructure;
      claimsBreakdown: StructureQuotas;
      registeredBy: { name: string; registeredAt: string };
    };

export function structureSelection(value: unknown): StructureSelection | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const data = value as Record<string, unknown>;
  const keys = ['courseCode', 'academicYear', 'semester', 'examType'] as const;
  if (keys.some((key) => typeof data[key] !== 'string' || !data[key].trim()))
    return null;
  return {
    courseCode: (data.courseCode as string).trim().toUpperCase(),
    academicYear: (data.academicYear as string).trim(),
    semester: (data.semester as string).trim(),
    examType: (data.examType as string).trim(),
  };
}
export function selectionKey(selection: StructureSelection | null): string {
  return selection
    ? JSON.stringify([
        selection.courseCode,
        selection.academicYear,
        selection.semester,
        selection.examType,
      ])
    : '';
}
function quantity(value: unknown, decimalString = false): number {
  const parsed =
    decimalString && typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value)
      ? Number(value)
      : value;
  if (typeof parsed !== 'number' || !Number.isFinite(parsed) || parsed < 0)
    throw new Error('Invalid paper structure quantity');
  return parsed;
}
function flag(value: unknown): boolean {
  if (typeof value !== 'boolean')
    throw new Error('Invalid paper structure flag');
  return value;
}
function list(value: unknown): unknown[] {
  if (!Array.isArray(value))
    throw new Error('Invalid paper structure claimants');
  return value;
}
function optionalName(value: unknown): { claimedBy?: string } {
  return value == null ? {} : { claimedBy: text(value) };
}
export function decodePaperStructure(value: unknown): PaperStructureResponse {
  const data = record(value);
  if (data.exists === false)
    return { exists: false, message: text(data.message) };
  if (data.exists !== true)
    throw new Error('Invalid structure registration state');
  const raw = record(data.paperStructure);
  const selected = structureSelection(raw);
  if (!selected) throw new Error('Invalid structure identity');
  let hodProportionDivision: ProportionDivision | undefined;
  if (raw.hodProportionDivision != null) {
    const division = record(raw.hodProportionDivision);
    const divisionStatus = text(division.status);
    if (
      ![
        'AWAITING_LECTURER_CONSENSUS',
        'DISAGREED_RETURNED_TO_HOD',
        'CONSENSUS_REACHED',
      ].includes(divisionStatus)
    )
      throw new Error('Invalid proportion division status');
    if (!Array.isArray(division.responses))
      throw new Error('Invalid proportion responses');
    const setAt = text(division.setAt);
    if (!Number.isFinite(Date.parse(setAt)))
      throw new Error('Invalid proportion division timestamp');
    hodProportionDivision = {
      essayWeightPercent: quantity(division.essayWeightPercent),
      mcqWeightPercent: quantity(division.mcqWeightPercent),
      comments:
        division.comments == null
          ? ''
          : typeof division.comments === 'string'
            ? division.comments
            : (() => {
                throw new Error('Invalid proportion division comment');
              })(),
      setByHodId: text(division.setByHodId),
      setByHodName: text(division.setByHodName),
      setAt,
      status: divisionStatus as ProportionDivision['status'],
      responses: division.responses.map((entry) => {
        const response = record(entry);
        const respondedAt = text(response.respondedAt);
        if (!Number.isFinite(Date.parse(respondedAt)))
          throw new Error('Invalid proportion response timestamp');
        if (typeof response.agreed !== 'boolean')
          throw new Error('Invalid proportion response');
        return {
          lecturerId: text(response.lecturerId),
          lecturerName: text(response.lecturerName),
          agreed: response.agreed,
          comments:
            response.comments == null
              ? ''
              : typeof response.comments === 'string'
                ? response.comments
                : (() => {
                    throw new Error('Invalid proportion response comment');
                  })(),
          respondedAt,
        };
      }),
    };
  }
  const paperStructure: RegisteredStructure = {
    ...selected,
    id: text(raw.id),
    courseTitle: raw.courseTitle == null ? null : text(raw.courseTitle),
    paperType: text(raw.paperType),
    paperDurationHours: quantity(raw.paperDurationHours),
    totalQuestions: quantity(raw.totalQuestions),
    totalMcqQuestions: quantity(raw.totalMcqQuestions),
    totalCandidates: quantity(raw.totalCandidates),
    // PostgreSQL decimal columns are serialized as strings by TypeORM.
    essayWeightPercent: quantity(raw.essayWeightPercent, true),
    mcqWeightPercent: quantity(raw.mcqWeightPercent, true),
    ...(hodProportionDivision ? { hodProportionDivision } : {}),
  };
  const breakdown = record(data.claimsBreakdown);
  const setting = record(breakdown.setting);
  const marking = record(breakdown.scriptMarking);
  const mcq = record(breakdown.mcqSetting);
  const moderation = record(breakdown.moderation);
  const typing = record(breakdown.typing);
  const assessment = record(breakdown.continuousAssessment);
  const claimsBreakdown: StructureQuotas = {
    setting: {
      totalQuestions: quantity(setting.totalQuestions),
      claimedQuestions: quantity(setting.claimedQuestions),
      remainingQuestions: quantity(setting.remainingQuestions),
      isFullPaperClaimed: flag(setting.isFullPaperClaimed),
      claimants: list(setting.claimants).map((value) => {
        const row = record(value);
        return {
          examinerId: text(row.examinerId),
          examinerName: text(row.examinerName),
          questionsClaimed: quantity(row.questionsClaimed),
          proportion: quantity(row.proportion),
          trackingNumber: text(row.trackingNumber),
          status: text(row.status),
        };
      }),
    },
    scriptMarking: {
      totalCandidates: quantity(marking.totalCandidates),
      totalScriptsClaimed: quantity(marking.totalScriptsClaimed),
      totalQuestionsMarked: quantity(marking.totalQuestionsMarked),
      remainingQuestionsPerScript: quantity(
        marking.remainingQuestionsPerScript,
      ),
      claimants: list(marking.claimants).map((value) => {
        const row = record(value);
        return {
          examinerName: text(row.examinerName),
          scriptsMarked: quantity(row.scriptsMarked),
          questionsMarked: quantity(row.questionsMarked),
          trackingNumber: text(row.trackingNumber),
        };
      }),
    },
    mcqSetting: {
      totalMcqQuestions: quantity(mcq.totalMcqQuestions),
      claimedMcqQuestions: quantity(mcq.claimedMcqQuestions),
      remainingMcqQuestions: quantity(mcq.remainingMcqQuestions),
    },
    moderation: {
      isClaimed: flag(moderation.isClaimed),
      ...optionalName(moderation.claimedBy),
    },
    typing: {
      isClaimed: flag(typing.isClaimed),
      typedPagesClaimed: quantity(typing.typedPagesClaimed),
      ...optionalName(typing.claimedBy),
    },
    continuousAssessment: {
      maxAssessmentsPerStudent: quantity(assessment.maxAssessmentsPerStudent),
      totalStudentAssessmentsClaimed: quantity(
        assessment.totalStudentAssessmentsClaimed,
      ),
      maxTotalAssessmentsAllowed: quantity(
        assessment.maxTotalAssessmentsAllowed,
      ),
    },
  };
  const total = paperStructure.totalQuestions;
  const claimed = claimsBreakdown.setting.claimedQuestions;
  const sum = claimsBreakdown.setting.claimants.reduce(
    (amount, claimant) => amount + claimant.questionsClaimed,
    0,
  );
  if (
    total < 1 ||
    claimsBreakdown.setting.totalQuestions !== total ||
    Math.abs(sum - claimed) > 0.000001 ||
    claimsBreakdown.setting.remainingQuestions !==
      Math.max(0, total - claimed) ||
    claimsBreakdown.setting.isFullPaperClaimed !== claimed >= total ||
    claimsBreakdown.scriptMarking.totalCandidates !==
      paperStructure.totalCandidates
  )
    throw new Error('Inconsistent paper structure quotas');
  const registrant = record(data.registeredBy);
  const registeredAt = text(registrant.registeredAt);
  if (!Number.isFinite(Date.parse(registeredAt)))
    throw new Error('Invalid registration date');
  return {
    exists: true,
    paperStructure,
    claimsBreakdown,
    registeredBy: { name: text(registrant.name), registeredAt },
  };
}
