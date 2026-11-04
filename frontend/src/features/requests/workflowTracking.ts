import { record } from '../../auth/contracts';
import type { WorkflowDisplayStage } from '../../components/tracking/Steppers';
import type {
  AuditEvent,
  RequestHistory,
  RequestStatus,
  RequestTracking,
} from './contracts';

export const workflowStageNames: Readonly<Record<string, string>> = {
  DRAFT: 'Draft',
  LECTURER: 'Lecturer submission',
  LECTURER_SUBMISSION: 'Lecturer submission',
  LECTURER_CORRECTION: 'Lecturer correction',
  LECTURER_PROPORTION_CONSENSUS: 'Lecturer proportion agreement',
  HEAD_OF_DEPARTMENT: 'Head of Department',
  DEAN: 'Dean',
  EXAMINATION_OFFICE: 'Examination Office',
  FINANCIAL_OFFICE: 'Financial Office',
  ASSISTANT_BURSAR: 'Assistant Bursar',
};
export function readableCode(value: string): string {
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase());
}
export function stageLabel(key: string): string {
  return workflowStageNames[key] ?? readableCode(key);
}

export interface ConfirmedWorkflow {
  currentStageKey: string;
  status: RequestStatus;
  trackingNumber: string;
}
export function workflowProgress(
  detail: ConfirmedWorkflow,
  tracking: RequestTracking | null,
) {
  const sameRequest = tracking?.trackingNumber === detail.trackingNumber;
  const consistent =
    sameRequest &&
    tracking.status === detail.status &&
    tracking.currentStage.key === detail.currentStageKey;
  const matching = consistent
    ? tracking.stages.find((stage) => stage.key === detail.currentStageKey)
    : undefined;
  const warnings: string[] = [];
  if (!tracking)
    warnings.push(
      'Stage history is not available. The current stage below comes from the request details.',
    );
  else if (!consistent)
    warnings.push(
      'Tracking and request details do not match. The current stage below comes from the request details; refresh to load a consistent stage history.',
    );
  else if (!matching)
    warnings.push(
      'No stage-history record matches the current stage. Its assignee and position are unconfirmed; an older stage name has not been substituted.',
    );
  const stages: WorkflowDisplayStage[] = consistent
    ? [...tracking.stages]
        .sort((a, b) => a.order - b.order)
        .map((stage) => ({
          id: stage.key,
          label: stage.name,
          state:
            stage.key === detail.currentStageKey &&
            detail.status === 'UNDER_REVIEW'
              ? 'active'
              : stage.key === detail.currentStageKey &&
                  detail.status === 'RETURNED_FOR_CORRECTION'
                ? 'returned'
                : stage.status === 'APPROVED' && stage.completedAt
                  ? 'completed'
                  : stage.status === 'RETURNED'
                    ? 'returned'
                    : 'pending',
          detail: [
            stage.actorName,
            stage.completedAt
              ? `Recorded completion: ${new Intl.DateTimeFormat('en-LK', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(stage.completedAt))}`
              : null,
            stage.comments,
            stage.status === 'APPROVED' && !stage.completedAt
              ? 'Reported approved; completion time not returned.'
              : null,
          ]
            .filter(Boolean)
            .join(' · '),
        }))
    : [];
  return {
    label: matching?.name ?? stageLabel(detail.currentStageKey),
    assignedRole: matching?.requiredRole ?? null,
    warnings,
    stages,
  };
}

export interface ConsensusResponse {
  lecturerId: string;
  lecturerName?: string | undefined;
  agreed: boolean;
  comments?: string | undefined;
  respondedAt?: string | undefined;
}
export interface ConsensusSnapshot {
  status?: string | undefined;
  essayWeightPercent?: number | undefined;
  mcqWeightPercent?: number | undefined;
  comments?: string | undefined;
  setByHodName?: string | undefined;
  setAt?: string | undefined;
  responses?: ConsensusResponse[] | undefined;
}
export type ConsensusRecord =
  | { state: 'missing' }
  | { state: 'invalid' }
  | { state: 'available'; snapshot: ConsensusSnapshot };
function optionalText(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'string') throw new Error('Invalid snapshot text');
  return value;
}
function optionalTimestamp(value: unknown): string | undefined {
  const candidate = optionalText(value);
  if (candidate !== undefined && !Number.isFinite(Date.parse(candidate)))
    throw new Error('Invalid snapshot date');
  return candidate;
}
function optionalPercent(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    value < 0 ||
    value > 100
  )
    throw new Error('Invalid snapshot percentage');
  return value;
}
/** Decode only the authorized request-detail snapshot. Do not query global paper/lecturer data. */
export function decodeConsensusRecord(value: unknown): ConsensusRecord {
  if (value == null) return { state: 'missing' };
  try {
    const data = record(value);
    if (data.responses != null && !Array.isArray(data.responses))
      throw new Error('Invalid snapshot responses');
    const responses =
      data.responses == null
        ? undefined
        : (data.responses as unknown[]).map((value): ConsensusResponse => {
            const response = record(value);
            if (
              typeof response.lecturerId !== 'string' ||
              !response.lecturerId.trim() ||
              typeof response.agreed !== 'boolean'
            )
              throw new Error('Invalid snapshot response');
            return {
              lecturerId: response.lecturerId,
              lecturerName: optionalText(response.lecturerName),
              agreed: response.agreed,
              comments: optionalText(response.comments),
              respondedAt: optionalTimestamp(response.respondedAt),
            };
          });
    return {
      state: 'available',
      snapshot: {
        status: optionalText(data.status),
        essayWeightPercent: optionalPercent(data.essayWeightPercent),
        mcqWeightPercent: optionalPercent(data.mcqWeightPercent),
        comments: optionalText(data.comments),
        setByHodName: optionalText(data.setByHodName),
        setAt: optionalTimestamp(data.setAt),
        responses,
      },
    };
  } catch {
    return { state: 'invalid' };
  }
}
export function consensusLabel(status: string | undefined): string {
  switch (status) {
    case 'AWAITING_LECTURER_CONSENSUS':
      return 'Pending lecturer agreement';
    case 'DISAGREED_RETURNED_TO_HOD':
      return 'Disagreement recorded — HOD adjustment required';
    case 'CONSENSUS_REACHED':
      return 'Consensus completed';
    default:
      return status
        ? `Recorded status: ${readableCode(status)}`
        : 'Consensus status not returned';
  }
}
const eventTitles: Readonly<Record<string, string>> = {
  SUBMIT: 'Claim submitted',
  SUBMITTED: 'Claim submitted',
  APPROVE: 'Approval recorded',
  APPROVE_PAYOUT: 'Payout authorized',
  SETTLE: 'Settlement recorded',
  RETURN: 'Claim returned for correction',
  REJECT: 'Claim rejected',
  RESUBMIT: 'Corrected claim resubmitted',
  HOD_DIRECT_EDIT: 'HOD corrected claim details',
  DIRECT_QUERY: 'Direct query recorded',
  HOD_PROPORTION_DIVIDED: 'HOD proportion proposed',
  LECTURER_PROPORTION_DISAGREED: 'Lecturer disagreement recorded',
  PROPORTION_CONSENSUS_REACHED: 'Proportion consensus completed',
  PAPER_STRUCTURE_CORRECTED_RESET:
    'Paper structure corrected — approvals reset',
};
export function eventTitle(event: AuditEvent): string {
  return eventTitles[event.actionType] ?? readableCode(event.actionType);
}
export function chronologicalEvents(history: RequestHistory): AuditEvent[] {
  return [...history.events].sort(
    (a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt),
  );
}
export function proposalSuperseded(
  event: AuditEvent,
  events: readonly AuditEvent[],
): boolean {
  return (
    event.actionType === 'HOD_PROPORTION_DIVIDED' &&
    events.some(
      (candidate) =>
        candidate.actionType === event.actionType &&
        Date.parse(candidate.createdAt) > Date.parse(event.createdAt),
    )
  );
}
export function eventFacts(
  event: AuditEvent,
): { label: string; value: string }[] {
  const fields = event.fieldDiff ?? {};
  const facts: { label: string; value: string }[] = [];
  const add = (key: string, label: string, stage = false) => {
    const value = fields[key];
    if (
      typeof value === 'string' ||
      (typeof value === 'number' && Number.isFinite(value))
    )
      facts.push({
        label,
        value:
          stage && typeof value === 'string'
            ? stageLabel(value)
            : String(value),
      });
  };
  if (event.actionType === 'HOD_PROPORTION_DIVIDED') {
    add('essayWeightPercent', 'Proposed essay weight (%)');
    add('mcqWeightPercent', 'Proposed MCQ weight (%)');
  }
  if (event.actionType === 'PROPORTION_CONSENSUS_REACHED') {
    const weights = fields.agreedWeights;
    if (weights && typeof weights === 'object' && !Array.isArray(weights))
      for (const [key, label] of [
        ['essay', 'Agreed essay weight (%)'],
        ['mcq', 'Agreed MCQ weight (%)'],
      ] as const) {
        const value = (weights as Record<string, unknown>)[key];
        if (typeof value === 'number' && Number.isFinite(value))
          facts.push({ label, value: String(value) });
      }
  }
  if (event.actionType === 'PAPER_STRUCTURE_CORRECTED_RESET') {
    add('previousTotalQuestions', 'Previous question count');
    add('newTotalQuestions', 'New question count');
    add('correctionReason', 'Correction reason');
    add('resetToStage', 'Reset destination', true);
  }
  if (event.actionType === 'LECTURER_PROPORTION_DISAGREED')
    add('returnedTo', 'Adjustment destination', true);
  if (
    event.actionType === 'RETURN' &&
    typeof fields.targetReturnRole === 'string'
  )
    facts.push({
      label: 'Correction requested from',
      value:
        fields.targetReturnRole === 'HOD'
          ? 'Head of Department'
          : readableCode(fields.targetReturnRole),
    });
  if (event.actionType === 'RESUBMIT')
    add('resubmittedToStage', 'Resubmitted to', true);
  if (event.actionType === 'APPROVE') {
    add('approvedStage', 'Approved stage', true);
    add('nextStage', 'Next stage', true);
  }
  return facts;
}
