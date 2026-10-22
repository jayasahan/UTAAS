import type { StaffProfile } from '../../auth/contracts';
import type { OfficerClaimReview, ReviewTrackingStage } from './contracts';

export type ReturnTarget = 'HOD' | 'LECTURER';
export type WorkflowAction =
  'APPROVE' | 'APPROVE_PAYOUT' | 'SETTLE' | 'REJECT_RETURN';

type ApprovalAction = Exclude<WorkflowAction, 'REJECT_RETURN'>;

export type WorkflowActionRequest =
  | {
      action: ApprovalAction;
      comments?: string;
    }
  | {
      action: 'REJECT_RETURN';
      comments: string;
      targetReturnRole: ReturnTarget;
    };

export interface WorkflowActionResult {
  id: string;
  trackingNumber: string;
  status: 'UNDER_REVIEW' | 'SETTLED' | 'RETURNED_FOR_CORRECTION';
  currentStageKey: string;
}

export interface WorkflowExpectation {
  status: WorkflowActionResult['status'];
  currentStageKey: string;
}

export interface OfficerDecision {
  action: ApprovalAction;
  buttonLabel: string;
  confirmationTitle: string;
  confirmationMessage: string;
  confirmationLabel: string;
  nextStage: ReviewTrackingStage | null;
}

const approverLabels: Partial<Record<StaffProfile['role'], string>> = {
  HOD: 'Approve',
  DEAN: 'Approve',
  EXAMINATION_OFFICER: 'Verify & Approve',
};

const returnRoles: readonly StaffProfile['role'][] = [
  'HOD',
  'DEAN',
  'EXAMINATION_OFFICER',
  'FINANCIAL_OFFICER',
];

const returnTargetLabels: Record<ReturnTarget, string> = {
  HOD: 'Head of Department',
  LECTURER: 'Lecturer for correction',
};

/**
 * Offer only actions that match the authenticated reviewer and active stage.
 * This is presentation logic; the backend remains responsible for authorization.
 */
export function resolveOfficerDecision(
  review: OfficerClaimReview,
): OfficerDecision | null {
  const { tracking, reviewerRole } = review;
  if (
    review.status !== 'UNDER_REVIEW' ||
    tracking.status !== 'UNDER_REVIEW' ||
    review.currentStageKey !== tracking.currentStage.key ||
    tracking.currentStage.assignedRole !== reviewerRole
  )
    return null;

  const activeStage = tracking.stages.find(
    (stage) => stage.key === tracking.currentStage.key,
  );
  if (
    !activeStage ||
    activeStage.status !== 'IN_PROGRESS' ||
    activeStage.requiredRole !== reviewerRole
  )
    return null;

  const roleLabel = reviewerRole.replaceAll('_', ' ');
  if (reviewerRole === 'ASSISTANT_BURSAR') {
    if (activeStage.key !== 'ASSISTANT_BURSAR') return null;
    return {
      action: 'SETTLE',
      buttonLabel: 'Final Approve (settlement)',
      confirmationTitle: 'Confirm final settlement',
      confirmationMessage:
        'This records the final settlement and changes the request status to Settled.',
      confirmationLabel: 'Confirm settlement',
      nextStage: null,
    };
  }

  if (reviewerRole === 'FINANCIAL_OFFICER') {
    const nextStage = tracking.stages.find(
      (stage) => stage.key === 'ASSISTANT_BURSAR',
    );
    if (
      activeStage.key !== 'FINANCIAL_OFFICE' ||
      !nextStage ||
      nextStage.order !== activeStage.order + 1 ||
      nextStage.status !== 'PENDING'
    )
      return null;
    return {
      action: 'APPROVE_PAYOUT',
      buttonLabel: 'Authorize payout',
      confirmationTitle: 'Confirm payout authorization',
      confirmationMessage:
        'This authorizes the verified claim to proceed to the Assistant Bursar.',
      confirmationLabel: 'Confirm authorization',
      nextStage,
    };
  }

  const buttonLabel = approverLabels[reviewerRole];
  if (!buttonLabel) return null;
  const nextStage = tracking.stages.find(
    (stage) => stage.order === activeStage.order + 1,
  );
  if (!nextStage || nextStage.status !== 'PENDING') return null;

  return {
    action: 'APPROVE',
    buttonLabel,
    confirmationTitle: 'Confirm ' + roleLabel.toLowerCase() + ' approval',
    confirmationMessage: 'This advances the request to ' + nextStage.name + '.',
    confirmationLabel: 'Confirm approval',
    nextStage,
  };
}

export function canReturnForCorrection(review: OfficerClaimReview): boolean {
  return (
    resolveOfficerDecision(review) !== null &&
    returnRoles.includes(review.reviewerRole)
  );
}

export function resolveWorkflowExpectation(
  review: OfficerClaimReview,
  request: WorkflowActionRequest,
): WorkflowExpectation | null {
  if (request.action === 'REJECT_RETURN') {
    if (
      !canReturnForCorrection(review) ||
      !request.comments.trim() ||
      (request.targetReturnRole !== 'HOD' &&
        request.targetReturnRole !== 'LECTURER') ||
      (review.reviewerRole === 'HOD' && request.targetReturnRole !== 'LECTURER')
    )
      return null;
    return {
      status: 'RETURNED_FOR_CORRECTION',
      currentStageKey:
        request.targetReturnRole === 'HOD'
          ? 'HEAD_OF_DEPARTMENT'
          : 'LECTURER_CORRECTION',
    };
  }

  const decision = resolveOfficerDecision(review);
  if (!decision || decision.action !== request.action) return null;
  return {
    status: decision.action === 'SETTLE' ? 'SETTLED' : 'UNDER_REVIEW',
    currentStageKey: decision.nextStage?.key ?? 'SETTLED',
  };
}

export function decodeWorkflowActionResult(
  value: unknown,
  review: OfficerClaimReview,
  request: WorkflowActionRequest,
): WorkflowActionResult {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid workflow response');
  const expectation = resolveWorkflowExpectation(review, request);
  if (!expectation) throw new Error('Workflow action is not available');
  const response = value as Record<string, unknown>;
  if (
    response.id !== review.id ||
    response.trackingNumber !== review.trackingNumber ||
    response.status !== expectation.status ||
    response.currentStageKey !== expectation.currentStageKey
  )
    throw new Error(
      'Workflow response did not confirm the expected transition',
    );
  return {
    id: review.id,
    trackingNumber: review.trackingNumber,
    ...expectation,
  };
}

export const correctionSections = [
  ['PERSONAL_INFORMATION', 'Personal & application information'],
  ['ACADEMIC_INFORMATION', 'Academic information'],
  ['PAPER_DETAILS', 'Paper setting & marking details'],
  ['SUPPORTING_DOCUMENTS', 'Supporting documents'],
  ['OTHER', 'Other'],
] as const;

export interface CorrectionItem {
  id: string;
  section: string;
  explanation: string;
}

export function correctionItemErrors(item: CorrectionItem) {
  const knownSection = correctionSections.some(
    ([value]) => value === item.section,
  );
  return {
    section: knownSection ? '' : 'Choose the section that needs correction.',
    explanation: item.explanation.trim()
      ? ''
      : 'Enter the correction required for this section.',
  };
}

export function correctionComments(items: readonly CorrectionItem[]): string {
  const labels = new Map<string, string>(correctionSections);
  return items
    .map((item) => labels.get(item.section) + ': ' + item.explanation.trim())
    .join('\n');
}

export function returnTargetLabel(target: ReturnTarget): string {
  return returnTargetLabels[target];
}
