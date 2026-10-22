import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/apiClient';
import { syntheticOfficerReview } from './developmentFixture';
import { OfficerDecisionSection } from './OfficerDecisionSection';
import type { OfficerClaimReview, ReviewTrackingStage } from './contracts';
import {
  correctionComments,
  correctionItemErrors,
  decodeWorkflowActionResult,
  resolveOfficerDecision,
  resolveWorkflowExpectation,
} from './workflowActions';

const roleStages = {
  HOD: ['HEAD_OF_DEPARTMENT', 'DEAN', 'DEAN'],
  DEAN: ['DEAN', 'EXAMINATION_OFFICE', 'EXAMINATION_OFFICER'],
  EXAMINATION_OFFICER: [
    'EXAMINATION_OFFICE',
    'FINANCIAL_OFFICE',
    'FINANCIAL_OFFICER',
  ],
  FINANCIAL_OFFICER: [
    'FINANCIAL_OFFICE',
    'ASSISTANT_BURSAR',
    'ASSISTANT_BURSAR',
  ],
  ASSISTANT_BURSAR: ['ASSISTANT_BURSAR', null, null],
  ADMIN: ['HEAD_OF_DEPARTMENT', 'DEAN', 'DEAN'],
} as const;

type TestRole = keyof typeof roleStages;

function reviewFor(role: TestRole): OfficerClaimReview {
  const [activeKey, nextKey, nextRole] = roleStages[role];
  const base = syntheticOfficerReview.tracking.stages[0]!;
  const active = {
    ...base,
    key: activeKey,
    name: activeKey.replaceAll('_', ' '),
    order:
      role === 'FINANCIAL_OFFICER' ? 4 : role === 'ASSISTANT_BURSAR' ? 5 : 1,
    requiredRole: role,
    status: 'IN_PROGRESS' as const,
  };
  const stages: ReviewTrackingStage[] = [active];
  if (nextKey && nextRole) {
    stages.push({
      ...base,
      key: nextKey,
      name: nextKey.replaceAll('_', ' '),
      order: active.order + 1,
      requiredRole: nextRole,
      status: 'PENDING' as const,
      enteredAt: null,
      completedAt: null,
    });
  }
  return {
    ...syntheticOfficerReview,
    reviewerRole: role,
    status: 'UNDER_REVIEW',
    currentStageKey: activeKey,
    tracking: {
      ...syntheticOfficerReview.tracking,
      status: 'UNDER_REVIEW',
      currentStage: {
        key: activeKey,
        name: active.name,
        order: active.order,
        assignedRole: role,
      },
      stages,
    },
  } as OfficerClaimReview;
}

describe('officer workflow action contracts', () => {
  it.each([
    ['HOD', 'APPROVE', 'Approve'],
    ['DEAN', 'APPROVE', 'Approve'],
    ['EXAMINATION_OFFICER', 'APPROVE', 'Verify & Approve'],
    ['FINANCIAL_OFFICER', 'APPROVE_PAYOUT', 'Authorize payout'],
    ['ASSISTANT_BURSAR', 'SETTLE', 'Final Approve (settlement)'],
  ] as const)('maps %s to %s with the label %s', (role, action, label) => {
    const decision = resolveOfficerDecision(reviewFor(role));
    expect(decision?.action).toBe(action);
    expect(decision?.buttonLabel).toBe(label);
  });

  it('does not offer actions to administrators or stale/mismatched stages', () => {
    expect(resolveOfficerDecision(reviewFor('ADMIN'))).toBeNull();
    expect(
      resolveOfficerDecision({
        ...reviewFor('HOD'),
        currentStageKey: 'DEAN',
      }),
    ).toBeNull();
    expect(
      resolveOfficerDecision({
        ...reviewFor('HOD'),
        status: 'RETURNED_FOR_CORRECTION',
      }),
    ).toBeNull();
    const wrongNextStage = reviewFor('FINANCIAL_OFFICER');
    wrongNextStage.tracking.stages[1]!.status = 'IN_PROGRESS';
    expect(resolveOfficerDecision(wrongNextStage)).toBeNull();
  });

  it('restricts return targets to the verified role and stage contract', () => {
    const hod = reviewFor('HOD');
    expect(
      resolveWorkflowExpectation(hod, {
        action: 'REJECT_RETURN',
        comments: 'Correct the paper details.',
        targetReturnRole: 'LECTURER',
      }),
    ).toEqual({
      status: 'RETURNED_FOR_CORRECTION',
      currentStageKey: 'LECTURER_CORRECTION',
    });
    expect(
      resolveWorkflowExpectation(hod, {
        action: 'REJECT_RETURN',
        comments: 'Correct the paper details.',
        targetReturnRole: 'HOD',
      }),
    ).toBeNull();

    const dean = reviewFor('DEAN');
    expect(
      resolveWorkflowExpectation(dean, {
        action: 'REJECT_RETURN',
        comments: 'Please review with the HOD.',
        targetReturnRole: 'HOD',
      })?.currentStageKey,
    ).toBe('HEAD_OF_DEPARTMENT');
    expect(
      resolveWorkflowExpectation(dean, {
        action: 'REJECT_RETURN',
        comments: 'Please correct the records.',
        targetReturnRole: 'LECTURER',
      })?.currentStageKey,
    ).toBe('LECTURER_CORRECTION');
    expect(
      resolveWorkflowExpectation(dean, {
        action: 'REJECT_RETURN',
        comments: '   ',
        targetReturnRole: 'HOD',
      }),
    ).toBeNull();
    expect(
      resolveWorkflowExpectation(reviewFor('ASSISTANT_BURSAR'), {
        action: 'REJECT_RETURN',
        comments: 'Unsupported return.',
        targetReturnRole: 'HOD',
      }),
    ).toBeNull();
  });

  it('requires a matching server response before confirming an action', () => {
    const review = reviewFor('FINANCIAL_OFFICER');
    const request = { action: 'APPROVE_PAYOUT' as const };
    expect(
      decodeWorkflowActionResult(
        {
          id: review.id,
          trackingNumber: review.trackingNumber,
          status: 'UNDER_REVIEW',
          currentStageKey: 'ASSISTANT_BURSAR',
        },
        review,
        request,
      ).currentStageKey,
    ).toBe('ASSISTANT_BURSAR');
    expect(() =>
      decodeWorkflowActionResult(
        {
          id: review.id,
          trackingNumber: review.trackingNumber,
          status: 'UNDER_REVIEW',
          currentStageKey: 'DEAN',
        },
        review,
        request,
      ),
    ).toThrow('did not confirm the expected transition');

    const returnRequest = {
      action: 'REJECT_RETURN' as const,
      comments: 'Correct the form.',
      targetReturnRole: 'LECTURER' as const,
    };
    expect(
      decodeWorkflowActionResult(
        {
          id: review.id,
          trackingNumber: review.trackingNumber,
          status: 'RETURNED_FOR_CORRECTION',
          currentStageKey: 'LECTURER_CORRECTION',
        },
        review,
        returnRequest,
      ).status,
    ).toBe('RETURNED_FOR_CORRECTION');
  });

  it('requires a known correction section and nonblank explanation', () => {
    expect(
      correctionItemErrors({ id: 'one', section: '', explanation: '  ' }),
    ).toEqual({
      section: 'Choose the section that needs correction.',
      explanation: 'Enter the correction required for this section.',
    });
    expect(
      correctionItemErrors({
        id: 'bad',
        section: 'UNSUPPORTED',
        explanation: 'Explain the problem.',
      }).section,
    ).toBe('Choose the section that needs correction.');
    expect(
      correctionItemErrors({
        id: 'two',
        section: 'PAPER_DETAILS',
        explanation: 'Correct the script count.',
      }),
    ).toEqual({ section: '', explanation: '' });
    expect(
      correctionComments([
        {
          id: 'two',
          section: 'PAPER_DETAILS',
          explanation: '  Correct the script count.  ',
        },
      ]),
    ).toBe('Paper setting & marking details: Correct the script count.');
  });
});

describe('OfficerDecisionSection', () => {
  it('requires confirmation and sends only the verified approval action', async () => {
    const user = userEvent.setup();
    const onExecute = vi.fn().mockResolvedValue(undefined);
    render(
      <OfficerDecisionSection
        review={reviewFor('HOD')}
        onExecute={onExecute}
      />,
    );

    await user.click(screen.getByRole('button', { name: 'Approve' }));
    expect(screen.getByRole('dialog')).toHaveAccessibleName(
      'Confirm hod approval',
    );
    expect(onExecute).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onExecute).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Approve' }));
    await user.type(
      screen.getByLabelText('Decision comments (optional)'),
      'Reviewed source documents.',
    );
    await user.click(screen.getByRole('button', { name: 'Confirm approval' }));
    await waitFor(() =>
      expect(onExecute).toHaveBeenCalledWith({
        action: 'APPROVE',
        comments: 'Reviewed source documents.',
      }),
    );
  });

  it('validates correction details and sends HOD returns to the lecturer', async () => {
    const user = userEvent.setup();
    const onExecute = vi.fn().mockResolvedValue(undefined);
    render(
      <OfficerDecisionSection
        review={reviewFor('HOD')}
        onExecute={onExecute}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Return for correction' }),
    );
    expect(
      screen.getByText('Return to: Lecturer for correction'),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Confirm Return' }));
    expect(
      await screen.findByText('Choose the section that needs correction.'),
    ).toBeVisible();
    expect(
      screen.getByText('Enter the correction required for this section.'),
    ).toBeVisible();
    expect(onExecute).not.toHaveBeenCalled();

    await user.selectOptions(
      screen.getByRole('combobox', {
        name: /Section requiring correction/,
      }),
      'PAPER_DETAILS',
    );
    await user.type(
      screen.getByRole('textbox', { name: /Required correction/ }),
      'Correct the candidate count.',
    );
    await user.click(screen.getByRole('button', { name: 'Confirm Return' }));
    await waitFor(() =>
      expect(onExecute).toHaveBeenCalledWith({
        action: 'REJECT_RETURN',
        comments:
          'Paper setting & marking details: Correct the candidate count.',
        targetReturnRole: 'LECTURER',
      }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('requires a verified return target for later-stage officers', async () => {
    const user = userEvent.setup();
    const onExecute = vi.fn().mockResolvedValue(undefined);
    render(
      <OfficerDecisionSection
        review={reviewFor('EXAMINATION_OFFICER')}
        onExecute={onExecute}
      />,
    );

    await user.click(
      screen.getByRole('button', { name: 'Return for correction' }),
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Section requiring correction/ }),
      'ACADEMIC_INFORMATION',
    );
    await user.type(
      screen.getByRole('textbox', { name: /Required correction/ }),
      'Update the academic year.',
    );
    await user.click(screen.getByRole('button', { name: 'Confirm Return' }));
    expect(
      await screen.findByText('Choose who should receive the correction.'),
    ).toBeVisible();
    expect(onExecute).not.toHaveBeenCalled();

    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Return to' }),
      'HOD',
    );
    await user.click(screen.getByRole('button', { name: 'Confirm Return' }));
    await waitFor(() =>
      expect(onExecute).toHaveBeenCalledWith({
        action: 'REJECT_RETURN',
        comments: 'Academic information: Update the academic year.',
        targetReturnRole: 'HOD',
      }),
    );
  });

  it('keeps HOD editing unavailable until the backend defines editable fields', () => {
    render(
      <OfficerDecisionSection review={reviewFor('HOD')} onExecute={vi.fn()} />,
    );
    expect(
      screen.getByRole('button', { name: 'Edit permitted fields' }),
    ).toBeDisabled();
    expect(
      screen.getByText(/does not define a field-level allowlist/i),
    ).toBeVisible();
  });

  it('does not send preview actions and reports authenticated API errors safely', () => {
    const previewAction = vi.fn();
    render(
      <OfficerDecisionSection
        review={reviewFor('ASSISTANT_BURSAR')}
        onExecute={previewAction}
        actionsEnabled={false}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Final Approve (settlement)' }),
    ).toBeDisabled();
    expect(screen.getByText(/fictional preview/i)).toBeVisible();
    expect(previewAction).not.toHaveBeenCalled();
  });

  it('shows session errors without reporting success and hides return for the Bursar', async () => {
    const user = userEvent.setup();
    const onExecute = vi
      .fn()
      .mockRejectedValue(new ApiError('unauthorized', 401));
    render(
      <OfficerDecisionSection
        review={reviewFor('ASSISTANT_BURSAR')}
        onExecute={onExecute}
      />,
    );
    expect(
      screen.getByRole('button', { name: 'Final Approve (settlement)' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Return for correction' }),
    ).toBeNull();
    await user.click(
      screen.getByRole('button', { name: 'Final Approve (settlement)' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Confirm settlement' }),
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your session expired',
    );
    expect(onExecute).toHaveBeenCalledWith({ action: 'SETTLE' });
  });

  it('shows sanitized backend validation feedback when a return is rejected', async () => {
    const user = userEvent.setup();
    const onExecute = vi
      .fn()
      .mockRejectedValue(
        new ApiError('server', 400, ['The return target is not valid.']),
      );
    render(
      <OfficerDecisionSection
        review={reviewFor('HOD')}
        onExecute={onExecute}
      />,
    );
    await user.click(
      screen.getByRole('button', { name: 'Return for correction' }),
    );
    await user.selectOptions(
      screen.getByRole('combobox', {
        name: /Section requiring correction/,
      }),
      'PAPER_DETAILS',
    );
    await user.type(
      screen.getByRole('textbox', { name: /Required correction/ }),
      'Correct the paper count.',
    );
    await user.click(screen.getByRole('button', { name: 'Confirm Return' }));
    expect(
      await screen.findAllByText('The return target is not valid.'),
    ).toHaveLength(2);
    expect(screen.getByRole('dialog')).toBeVisible();
  });
});
