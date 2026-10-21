import { ForbiddenException } from '@nestjs/common';
import { Request, RequestStatus } from '../../../database/entities/request.entity';
import { User, UserRole } from '../../../database/entities/user.entity';
import { StageAction } from '../../../database/entities/request-stage-history.entity';

export const REVIEWER_ROLE_STAGE_MAP: Partial<Record<UserRole, string>> = {
  [UserRole.HOD]: 'HEAD_OF_DEPARTMENT',
  [UserRole.DEAN]: 'DEAN',
  [UserRole.EXAMINATION_OFFICER]: 'EXAMINATION_OFFICE',
  [UserRole.FINANCIAL_OFFICER]: 'FINANCIAL_OFFICE',
  [UserRole.ASSISTANT_BURSAR]: 'ASSISTANT_BURSAR',
};

/**
 * Checks whether a user has authorization to access a given request based on:
 * 1. Admin bypass
 * 2. Applicant ownership for lecturers
 * 3. Draft privacy
 * 4. Department boundary isolation for HOD (fail-closed)
 * 5. Reviewer workflow stage enforcement (active or previously reviewed stage)
 */
export function enforceRequestAccessControl(request: Request, user: User): void {
  if (user.role === UserRole.ADMIN) {
    return;
  }

  // IDOR protection for lecturers
  if (user.role === UserRole.LECTURER) {
    if (request.applicantId !== user.id) {
      throw new ForbiddenException('Access denied: You can only view your own claims');
    }
    return;
  }

  // Draft claims are strictly private to the applicant
  if (request.status === RequestStatus.DRAFT && request.applicantId !== user.id) {
    throw new ForbiddenException('Access denied: Draft claims can only be viewed by the applicant');
  }

  // Department boundary isolation for HODs (fail-closed)
  if (user.role === UserRole.HOD) {
    const applicantDeptId = request.applicant?.departmentId;
    const userDeptId = user.departmentId;

    if (!userDeptId || !applicantDeptId || applicantDeptId !== userDeptId) {
      throw new ForbiddenException(
        'Department access restriction: You can only inspect claims from your department',
      );
    }
  }

  // Workflow stage enforcement for all reviewer roles
  const targetStageKey = REVIEWER_ROLE_STAGE_MAP[user.role];
  if (!targetStageKey) {
    throw new ForbiddenException('Access denied: Unrecognized reviewer role');
  }

  // 1. Is request currently at reviewer's assigned stage?
  if (request.currentStageKey === targetStageKey) {
    return;
  }

  // 2. Has the request reached, passed, or been reviewed by this reviewer's stage?
  const stages = request.stageHistory || [];
  const roleStage = stages.find(
    (s) => s.stageKey === targetStageKey || s.requiredRole === user.role,
  );

  if (roleStage) {
    const hasEntered = roleStage.enteredAt !== null && roleStage.enteredAt !== undefined;
    const hasCompleted = roleStage.completedAt !== null && roleStage.completedAt !== undefined;
    const isApprovedOrCompleted =
      roleStage.action === StageAction.APPROVED ||
      roleStage.action === StageAction.APPROVE_PAYOUT ||
      roleStage.action === StageAction.REJECT_RETURN;

    if (hasEntered || hasCompleted || isApprovedOrCompleted) {
      return;
    }
  }

  // 3. If request is settled, every stage defined in the template workflow was completed
  if (request.status === RequestStatus.SETTLED && roleStage) {
    return;
  }

  throw new ForbiddenException(
    `Access denied: Request is at stage '${request.currentStageKey}' and has not reached your review stage`,
  );
}
