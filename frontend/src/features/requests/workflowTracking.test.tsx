import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ConsensusTracking } from '../../components/tracking/ConsensusTracking';
import { RequestWorkflowProgress } from '../../components/tracking/RequestWorkflowProgress';
import { WorkflowHistory } from '../../components/audit/WorkflowHistory';
import { syntheticOfficerReview } from '../officer-review/developmentFixture';
import type { AuditEvent, RequestHistory } from './contracts';
import {
  chronologicalEvents,
  consensusLabel,
  decodeConsensusRecord,
  eventFacts,
  eventTitle,
  proposalSuperseded,
  workflowProgress,
} from './workflowTracking';

const sample = syntheticOfficerReview;
const confirmed = {
  trackingNumber: sample.trackingNumber,
  status: sample.status,
  currentStageKey: sample.currentStageKey,
};
const proposalAt = '2026-11-01T09:00:00.000Z';
function event(
  actionType: string,
  overrides: Partial<AuditEvent> = {},
): AuditEvent {
  return {
    id: actionType,
    actionType,
    actorName: 'Recorded Actor',
    actorRole: 'HOD',
    previousStatus: 'UNDER_REVIEW',
    newStatus: 'UNDER_REVIEW',
    comment: '',
    fieldDiff: null,
    createdAt: proposalAt,
    ...overrides,
  };
}
function history(events: AuditEvent[]): RequestHistory {
  return {
    requestId: sample.id,
    trackingNumber: sample.trackingNumber,
    events,
  };
}
function snapshot() {
  return {
    status: 'AWAITING_LECTURER_CONSENSUS',
    essayWeightPercent: 60,
    mcqWeightPercent: 40,
    setByHodName: 'Verified HOD',
    setAt: proposalAt,
    comments: 'Recorded proposal remarks',
    responses: [
      {
        lecturerId: 'me',
        lecturerName: 'Own Lecturer',
        agreed: true,
        comments: 'Own response note',
        respondedAt: '2026-11-01T10:00:00.000Z',
      },
      {
        lecturerId: 'other',
        lecturerName: 'Other Lecturer',
        agreed: false,
        comments: 'Other private response note',
        respondedAt: '2026-11-01T11:00:00.000Z',
      },
    ],
  };
}

describe('confirmed workflow progress', () => {
  it('keeps the reused workflow stepper vertical in the narrow officer column', () => {
    render(
      <RequestWorkflowProgress
        detail={confirmed}
        tracking={sample.tracking}
        compact
      />,
    );
    const region = screen.getByRole('region', { name: 'Approval workflow' });
    expect(region).toHaveClass('workflow-vertical');
    expect(within(region).getByRole('list')).not.toHaveClass('xl:flex-row');
  });
  it('reuses ordinary stage records and keeps the server-confirmed current stage', () => {
    const progress = workflowProgress(confirmed, sample.tracking);
    expect(progress.label).toBe(
      sample.tracking.stages.find(
        (row) => row.key === confirmed.currentStageKey,
      )!.name,
    );
    expect(
      progress.stages.some(
        (stage) =>
          stage.id === confirmed.currentStageKey && stage.state === 'active',
      ),
    ).toBe(true);
    expect(progress.warnings).toEqual([]);
  });
  it('does not borrow historical name, order or role for missing consensus stage records', () => {
    const detail = {
      ...confirmed,
      currentStageKey: 'LECTURER_PROPORTION_CONSENSUS',
    };
    const tracking = {
      ...sample.tracking,
      currentStage: {
        key: detail.currentStageKey,
        name: 'Old lecturer submission name',
        assignedRole: 'DEAN',
        order: 0,
      },
    };
    const progress = workflowProgress(detail, tracking);
    expect(progress.label).toBe('Lecturer proportion agreement');
    expect(progress.assignedRole).toBeNull();
    expect(progress.stages).toHaveLength(tracking.stages.length);
    expect(progress.stages.some((stage) => stage.state === 'active')).toBe(
      false,
    );
    render(<RequestWorkflowProgress detail={detail} tracking={tracking} />);
    expect(
      screen.getByText('Current stage: Lecturer proportion agreement'),
    ).toBeVisible();
    expect(
      screen.queryByText(/Old lecturer submission name/),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/No stage-history record matches/)).toBeVisible();
  });
  it.each(['currentStageKey', 'status', 'trackingNumber'] as const)(
    'does not display a potentially stale/foreign timeline when %s differs',
    (field) => {
      const detail = {
        ...confirmed,
        [field]:
          field === 'status'
            ? ('RETURNED_FOR_CORRECTION' as const)
            : 'Different value',
      };
      const progress = workflowProgress(detail, sample.tracking);
      expect(progress.stages).toEqual([]);
      expect(progress.assignedRole).toBeNull();
      expect(progress.warnings[0]).toContain('do not match');
    },
  );
  it('shows the current stage without manufacturing empty stage rows or approvals', () => {
    const detail = {
      ...confirmed,
      currentStageKey: 'LECTURER_PROPORTION_CONSENSUS',
    };
    const progress = workflowProgress(detail, null);
    expect(progress.stages).toEqual([]);
    render(<RequestWorkflowProgress detail={detail} tracking={null} />);
    expect(
      screen.getByText('No confirmed stage timeline is available'),
    ).toBeVisible();
    expect(
      screen.queryByRole('region', { name: 'Approval workflow' }),
    ).not.toBeInTheDocument();
  });
  it('does not convert undated historical approval flags into confirmed completions', () => {
    const stages = sample.tracking.stages.map((stage) => ({
      ...stage,
      status: 'APPROVED' as const,
      completedAt: null,
    }));
    const progress = workflowProgress(confirmed, {
      ...sample.tracking,
      stages,
    });
    expect(
      progress.stages.filter((stage) => stage.state === 'completed'),
    ).toHaveLength(0);
  });
  it('marks a current lecturer correction as returned without calling it a rejected claim', () => {
    const detail = {
      ...confirmed,
      status: 'RETURNED_FOR_CORRECTION' as const,
      currentStageKey: 'LECTURER_CORRECTION',
    };
    const progress = workflowProgress(detail, {
      ...sample.tracking,
      status: detail.status,
      currentStage: {
        key: detail.currentStageKey,
        name: 'Historical HOD',
        order: 0,
        assignedRole: 'HOD',
      },
    });
    expect(progress.label).toBe('Lecturer correction');
    expect(progress.stages.some((stage) => stage.state === 'rejected')).toBe(
      false,
    );
  });
});

describe('consensus snapshot decoding and visibility', () => {
  it('preserves the actual proposal, remarks, timestamps and individual response records', () => {
    expect(decodeConsensusRecord(snapshot())).toEqual({
      state: 'available',
      snapshot: snapshot(),
    });
  });
  it('supports older claims with no consensus object and incomplete optional snapshots', () => {
    expect(decodeConsensusRecord(undefined)).toEqual({ state: 'missing' });
    expect(
      decodeConsensusRecord({ status: 'AWAITING_LECTURER_CONSENSUS' }).state,
    ).toBe('available');
  });
  it.each([
    [],
    'bad',
    { essayWeightPercent: '60' },
    { essayWeightPercent: -1 },
    { mcqWeightPercent: Infinity },
    { responses: {} },
    { responses: [{ lecturerId: 'one', agreed: 'false' }] },
    { setAt: 'not-a-date' },
  ])(
    'keeps malformed snapshots separate from lifecycle/tracking data: %j',
    (value) => {
      expect(decodeConsensusRecord(value)).toEqual({ state: 'invalid' });
    },
  );
  it.each([
    ['AWAITING_LECTURER_CONSENSUS', 'Pending lecturer agreement'],
    [
      'DISAGREED_RETURNED_TO_HOD',
      'Disagreement recorded — HOD adjustment required',
    ],
    ['CONSENSUS_REACHED', 'Consensus completed'],
  ])(
    'renders recorded consensus state %s separately from request lifecycle',
    (status, label) => {
      render(
        <ConsensusTracking
          record={decodeConsensusRecord({ ...snapshot(), status })}
          viewer={{ role: 'HOD' }}
        />,
      );
      expect(screen.getByText(label)).toBeVisible();
      expect(
        screen.getByRole('region', { name: 'Proportion consensus snapshot' }),
      ).not.toHaveTextContent('Rejected');
      expect(consensusLabel(status)).toBe(label);
    },
  );
  it('shows only the verified lecturer own response and does not infer a total or missing outcomes', () => {
    render(
      <ConsensusTracking
        record={decodeConsensusRecord(snapshot())}
        viewer={{ role: 'LECTURER', id: 'me' }}
      />,
    );
    expect(screen.getByText(/Agreement received · Own Lecturer/)).toBeVisible();
    expect(
      screen.queryByText(/Other Lecturer|Other private response note/),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/No expected examiner total was returned/),
    ).toBeVisible();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
  it('uses only returned response records in an authorized officer view', () => {
    render(
      <ConsensusTracking
        record={decodeConsensusRecord(snapshot())}
        viewer={{ role: 'HOD' }}
      />,
    );
    expect(screen.getByText(/Agreement received · Own Lecturer/)).toBeVisible();
    expect(
      screen.getByText(/Disagreement received · Other Lecturer/),
    ).toBeVisible();
    expect(screen.getByText(/not rejection of the claim/)).toBeVisible();
    expect(
      screen.queryByText(/Awaiting response from/),
    ).not.toBeInTheDocument();
  });
  it.each([undefined, { role: 'LECTURER' }, { role: 'UNKNOWN', id: 'me' }])(
    'hides individual details for an unverified viewer %j',
    (viewer) => {
      render(
        <ConsensusTracking
          record={decodeConsensusRecord(snapshot())}
          viewer={viewer}
        />,
      );
      expect(
        screen.queryByText(/Own Lecturer|Other Lecturer|Own response note/),
      ).not.toBeInTheDocument();
      expect(screen.getByText('Verified HOD')).toBeVisible();
    },
  );
  it('does not claim pending individuals or completed consensus from absent/empty responses', () => {
    render(
      <ConsensusTracking
        record={decodeConsensusRecord({
          status: 'AWAITING_LECTURER_CONSENSUS',
          responses: [],
        })}
        viewer={{ role: 'HOD' }}
      />,
    );
    expect(
      screen.getByText(/No individual response is available/),
    ).toBeVisible();
    expect(screen.queryByText('Consensus completed')).not.toBeInTheDocument();
  });
  it('renders unknown recorded statuses without assigning an agreement outcome', () => {
    expect(consensusLabel('FUTURE_STATUS')).toBe(
      'Recorded status: Future status',
    );
  });
});

describe('expanded chronological audit history', () => {
  it('shows HOD proposal fields, authorized actor/time and remarks without extracting fabricated percentages', () => {
    render(
      <WorkflowHistory
        history={history([
          event('HOD_PROPORTION_DIVIDED', {
            fieldDiff: { essayWeightPercent: 60, mcqWeightPercent: 40 },
            comment: 'Proposed weights for review.',
          }),
        ])}
      />,
    );
    expect(
      screen.getByRole('heading', { name: 'HOD proportion proposed' }),
    ).toBeVisible();
    expect(screen.getByText('Proposed essay weight (%)')).toBeVisible();
    expect(screen.getByText('Proposed MCQ weight (%)')).toBeVisible();
    expect(screen.getByText('Proposed weights for review.')).toBeVisible();
    expect(screen.getByText(/Recorded Actor/)).toBeVisible();
    expect(document.querySelector('time')).toHaveAttribute(
      'datetime',
      proposalAt,
    );
  });
  it('sorts events chronologically without changing the original array or removing earlier approvals', () => {
    const later = event('RESUBMIT', { createdAt: '2026-11-03T10:00:00.000Z' });
    const earlier = event('APPROVE');
    const source = history([later, earlier]);
    expect(chronologicalEvents(source).map((row) => row.actionType)).toEqual([
      'APPROVE',
      'RESUBMIT',
    ]);
    expect(source.events[0]).toBe(later);
    render(<WorkflowHistory history={source} />);
    const items = within(
      screen.getByRole('list', { name: 'Chronological workflow events' }),
    ).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Approval recorded');
    expect(items[1]).toHaveTextContent('Corrected claim resubmitted');
  });
  it('marks only earlier recorded proposals as superseded and does not manufacture reset events', () => {
    const old = event('HOD_PROPORTION_DIVIDED');
    const next = event('HOD_PROPORTION_DIVIDED', {
      id: 'next',
      createdAt: '2026-11-02T10:00:00.000Z',
    });
    expect(proposalSuperseded(old, [old, next])).toBe(true);
    expect(proposalSuperseded(next, [old, next])).toBe(false);
    expect(proposalSuperseded(old, [old, { ...old, id: 'same-time' }])).toBe(
      false,
    );
    render(<WorkflowHistory history={history([old, next])} />);
    expect(screen.getAllByText(/Earlier proposal — superseded/)).toHaveLength(
      1,
    );
    expect(screen.queryByText(/Consensus reset/)).not.toBeInTheDocument();
  });
  it('shows disagreement as a proportion event rather than a claim rejection', () => {
    render(
      <WorkflowHistory
        history={history([
          event('LECTURER_PROPORTION_DISAGREED', {
            comment: 'Please reconsider',
            fieldDiff: { returnedTo: 'HEAD_OF_DEPARTMENT' },
          }),
        ])}
      />,
    );
    expect(screen.getByText('Lecturer disagreement recorded')).toBeVisible();
    expect(screen.getByText(/distinct from claim rejection/)).toBeVisible();
    expect(screen.getByText('Head of Department')).toBeVisible();
    expect(screen.queryByText('Claim rejected')).not.toBeInTheDocument();
  });
  it('shows actual question corrections and reset metadata without inventing candidate/duration changes or stage lists', () => {
    const row = event('PAPER_STRUCTURE_CORRECTED_RESET', {
      fieldDiff: {
        previousTotalQuestions: 5,
        newTotalQuestions: 4,
        correctionReason: 'Four questions',
        resetToStage: 'HEAD_OF_DEPARTMENT',
        officerApprovalsRevoked: true,
      },
    });
    render(<WorkflowHistory history={history([event('APPROVE'), row])} />);
    expect(screen.getByText('Previous question count')).toBeVisible();
    expect(screen.getByText('New question count')).toBeVisible();
    expect(
      screen.getByText('Correction reason').parentElement,
    ).toHaveTextContent('Four questions');
    expect(
      screen.getByText(/Individual reset stages were not supplied/),
    ).toBeVisible();
    expect(screen.getByText(/earlier audit events are retained/)).toBeVisible();
    expect(
      screen.queryByText('Previous candidate count'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Previous duration')).not.toBeInTheDocument();
    expect(screen.getByText('Approval recorded')).toBeVisible();
  });
  it.each(['HOD', 'LECTURER'])(
    'labels a recorded return target %s',
    (targetReturnRole) => {
      expect(
        eventFacts(event('RETURN', { fieldDiff: { targetReturnRole } }))[0]
          ?.value,
      ).toBe(targetReturnRole === 'HOD' ? 'Head of Department' : 'Lecturer');
    },
  );
  it.each(['EXAMINATION_OFFICE', 'FINANCIAL_OFFICE'])(
    'shows recorded resubmission destination %s',
    (stage) => {
      expect(
        eventFacts(
          event('RESUBMIT', { fieldDiff: { resubmittedToStage: stage } }),
        )[0]?.value,
      ).toContain('Office');
    },
  );
  it('renders empty history and unknown legacy actions safely', () => {
    const { rerender } = render(<WorkflowHistory history={history([])} />);
    expect(screen.getByText('No history is available yet')).toBeVisible();
    rerender(
      <WorkflowHistory history={history([event('LEGACY_CUSTOM_ACTION')])} />,
    );
    expect(screen.getByText('Legacy custom action')).toBeVisible();
    expect(eventTitle(event('REJECT'))).toBe('Claim rejected');
  });
});
