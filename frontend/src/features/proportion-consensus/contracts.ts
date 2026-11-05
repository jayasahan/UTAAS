import { record, text } from '../../auth/contracts';
import type { StaffProfile } from '../../auth/contracts';
import type { RequestDetail } from '../requests/contracts';
import {
  decodeConsensusRecord,
  type ConsensusRecord,
  type ConsensusSnapshot,
  type ConsensusResponse,
} from '../requests/workflowTracking';

export interface ConsensusExam {
  courseCode: string;
  academicYear: string;
  semester: string;
  examType: string;
}
export interface CurrentProposal {
  exists: boolean;
  exam: ConsensusExam | null;
  record: ConsensusRecord;
}
export interface ConsensusPayload extends ConsensusExam {
  agreed: boolean;
  comments?: string;
}
export type ConsensusOutcome =
  | 'AWAITING_OTHER_EXAMINERS'
  | 'DISAGREED_RETURNED_TO_HOD'
  | 'CONSENSUS_REACHED';
export interface ConsensusResult {
  status: ConsensusOutcome;
  message: string;
  proposal: CurrentProposal;
}
export function examFrom(value: unknown): ConsensusExam | null {
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
export function examKey(exam: ConsensusExam | null): string {
  return exam
    ? JSON.stringify([
        exam.courseCode,
        exam.academicYear,
        exam.semester,
        exam.examType,
      ])
    : '';
}
export function decodeCurrentProposal(value: unknown): CurrentProposal {
  const data = record(value);
  if (data.exists === false)
    return { exists: false, exam: null, record: { state: 'missing' } };
  if (data.exists !== true)
    throw new Error('Invalid proposal registration state');
  const exam = examFrom(data.paperStructure);
  if (!exam) throw new Error('Invalid proposal examination identity');
  const consensus = decodeConsensusRecord(data.hodProportionDivision);
  if (consensus.state === 'invalid')
    throw new Error('Invalid current consensus proposal');
  if (consensus.state === 'available' && consensus.snapshot.responses) {
    const ids = consensus.snapshot.responses.map(
      (response) => response.lecturerId,
    );
    if (new Set(ids).size !== ids.length)
      throw new Error('Duplicate consensus responses');
  }
  return { exists: true, exam, record: consensus };
}
export function proposalSnapshot(
  proposal: CurrentProposal | null,
): ConsensusSnapshot | null {
  return proposal?.record.state === 'available'
    ? proposal.record.snapshot
    : null;
}
export function proposalKey(proposal: CurrentProposal | null): string {
  const snapshot = proposalSnapshot(proposal);
  return proposal?.exam &&
    snapshot?.setAt &&
    snapshot.essayWeightPercent !== undefined &&
    snapshot.mcqWeightPercent !== undefined
    ? JSON.stringify([
        examKey(proposal.exam),
        snapshot.setAt,
        snapshot.essayWeightPercent,
        snapshot.mcqWeightPercent,
      ])
    : '';
}
export function openProposal(snapshot: ConsensusSnapshot | null): boolean {
  return (
    snapshot?.status === 'AWAITING_LECTURER_CONSENSUS' ||
    snapshot?.status === 'DISAGREED_RETURNED_TO_HOD'
  );
}
export function ownResponse(
  proposal: CurrentProposal | null,
  id: string,
): ConsensusResponse | undefined {
  return proposalSnapshot(proposal)?.responses?.find(
    (response) => response.lecturerId === id,
  );
}
export function responseKey(response: ConsensusResponse | undefined): string {
  return response
    ? JSON.stringify([
        response.agreed,
        response.comments ?? '',
        response.respondedAt ?? '',
      ])
    : '';
}
export function eligibleRequest(
  detail: RequestDetail | null,
  profile: StaffProfile | null,
): boolean {
  return (
    !!detail &&
    profile?.role === 'LECTURER' &&
    ['UNDER_REVIEW', 'RETURNED_FOR_CORRECTION'].includes(detail.status) &&
    (detail.currentStageKey === 'LECTURER_PROPORTION_CONSENSUS' ||
      detail.formData.hodProportionDivision != null)
  );
}
export function responseAllowed(
  detail: RequestDetail,
  proposal: CurrentProposal,
): boolean {
  const snapshot = proposalSnapshot(proposal);
  return (
    !!proposalKey(proposal) &&
    !!snapshot?.responses &&
    openProposal(snapshot) &&
    (detail.currentStageKey === 'LECTURER_PROPORTION_CONSENSUS' ||
      (detail.currentStageKey === 'HEAD_OF_DEPARTMENT' &&
        snapshot.status === 'DISAGREED_RETURNED_TO_HOD'))
  );
}
export function disagreementError(comment: string): string {
  return (comment.trim().match(/[\p{L}\p{N}]/gu) ?? []).length < 3
    ? 'Explain your disagreement using at least 3 letters or numbers.'
    : '';
}
export function decodeConsensusResult(value: unknown): ConsensusResult {
  const data = record(value);
  if (
    typeof data.status !== 'string' ||
    ![
      'AWAITING_OTHER_EXAMINERS',
      'DISAGREED_RETURNED_TO_HOD',
      'CONSENSUS_REACHED',
    ].includes(data.status)
  )
    throw new Error('Unsupported consensus outcome');
  const structure = record(data.paperStructure);
  return {
    status: data.status as ConsensusOutcome,
    message: text(data.message),
    proposal: decodeCurrentProposal({
      exists: true,
      paperStructure: structure,
      hodProportionDivision: structure.hodProportionDivision,
    }),
  };
}
export function verifyResult(
  result: ConsensusResult,
  payload: ConsensusPayload,
  key: string,
  lecturerId: string,
): void {
  const snapshot = proposalSnapshot(result.proposal);
  const own = ownResponse(result.proposal, lecturerId);
  if (
    examKey(result.proposal.exam) !== examKey(payload) ||
    proposalKey(result.proposal) !== key ||
    !own?.respondedAt ||
    own.agreed !== payload.agreed ||
    (own.comments ?? '') !== (payload.comments ?? '') ||
    (!payload.agreed && result.status !== 'DISAGREED_RETURNED_TO_HOD') ||
    (payload.agreed && result.status === 'DISAGREED_RETURNED_TO_HOD') ||
    (result.status === 'CONSENSUS_REACHED' &&
      snapshot?.status !== 'CONSENSUS_REACHED') ||
    (result.status === 'DISAGREED_RETURNED_TO_HOD' &&
      snapshot?.status !== 'DISAGREED_RETURNED_TO_HOD') ||
    (result.status === 'AWAITING_OTHER_EXAMINERS' && !openProposal(snapshot))
  )
    throw new Error(
      'The server did not confirm this response to the reviewed proposal.',
    );
}
