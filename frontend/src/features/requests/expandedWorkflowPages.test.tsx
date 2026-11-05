import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionContext } from '../../auth/session';
import { createApiClient } from '../../services/apiClient';
import { RequestDetailPage } from '../../pages/RequestDetailPage';
import { OfficerPortalLayout } from '../officer-queue/OfficerPortalLayout';
import { OfficerClaimReviewPage } from '../officer-review/OfficerClaimReviewPage';
import { syntheticOfficerReview } from '../officer-review/developmentFixture';
import type { AuditEvent } from './contracts';

const sample = syntheticOfficerReview;
const consensusStage = 'LECTURER_PROPORTION_CONSENSUS';
function proposal() {
  return {
    status: 'AWAITING_LECTURER_CONSENSUS',
    essayWeightPercent: 60,
    mcqWeightPercent: 40,
    setByHodName: 'Recorded HOD',
    setAt: '2026-11-01T09:00:00.000Z',
    comments: 'Proposal remarks',
    responses: [
      {
        lecturerId: 'lecturer-me',
        lecturerName: 'Own Response Name',
        agreed: true,
        comments: 'My agreement note',
        respondedAt: '2026-11-01T10:00:00.000Z',
      },
      {
        lecturerId: 'other-lecturer',
        lecturerName: 'Other Response Name',
        agreed: false,
        comments: 'Other confidential note',
        respondedAt: '2026-11-01T11:00:00.000Z',
      },
    ],
  };
}
const proposalEvent: AuditEvent = {
  id: 'proposal',
  actionType: 'HOD_PROPORTION_DIVIDED',
  actorName: 'Audit HOD',
  actorRole: 'HOD',
  previousStatus: 'UNDER_REVIEW',
  newStatus: 'UNDER_REVIEW',
  comment: 'Recorded proposal comment',
  fieldDiff: {
    essayWeightPercent: 60,
    mcqWeightPercent: 40,
    status: 'AWAITING_LECTURER_CONSENSUS',
  },
  createdAt: '2026-11-01T09:00:00.000Z',
};
function backend(
  options: {
    officer?: boolean;
    old?: boolean;
    snapshot?: unknown;
    historyStatus?: number;
    profileStatus?: number;
    detailStatus?: number;
    foreignHistory?: boolean;
    foreignDetail?: boolean;
    trackingMismatch?: boolean;
    emptyHistory?: boolean;
  } = {},
) {
  let historyFailure = options.historyStatus;
  const detail = {
    id: options.foreignDetail
      ? '7b5b9f20-8d1d-4d3c-8e59-17e252c81401'
      : sample.id,
    trackingNumber: sample.trackingNumber,
    status: 'UNDER_REVIEW',
    currentStageKey: options.old ? 'HEAD_OF_DEPARTMENT' : consensusStage,
    totalAmount: sample.totalAmount,
    createdAt: sample.submittedAt,
    formData: {
      personal: sample.personal,
      metadata: sample.academic,
      papers: [],
      supportingDocuments: [],
      ...(options.old
        ? {}
        : {
            hodProportionDivision:
              options.snapshot === undefined ? proposal() : options.snapshot,
          }),
    },
  };
  const tracking = {
    ...sample.tracking,
    status: options.trackingMismatch ? 'APPROVED' : detail.status,
    currentStage: options.old
      ? sample.tracking.currentStage
      : {
          key: consensusStage,
          name: 'Misleading historical stage name',
          order: 0,
          assignedRole: 'DEAN',
        },
  };
  const fetcher = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      expect(init?.method ?? 'GET').toBe('GET');
      const path = new URL(String(input)).pathname;
      const ok = (body: unknown, status = 200) =>
        new Response(JSON.stringify(body), { status });
      if (path.endsWith('/auth/me')) {
        if (options.profileStatus)
          return ok({ message: 'private account data' }, options.profileStatus);
        return ok({
          id: options.officer ? 'hod-me' : 'lecturer-me',
          fullName: 'Viewer',
          email: 'viewer@example.test',
          role: options.officer ? 'HOD' : 'LECTURER',
          departmentId: 'dept-1',
          departmentCode: 'ENG',
        });
      }
      if (path.endsWith(`/requests/paper-marking/${sample.id}`))
        return options.detailStatus
          ? ok({ message: 'private request data' }, options.detailStatus)
          : ok(detail);
      if (path.endsWith('/paper-structure'))
        return ok({
          exists: true,
          paperStructure: {
            ...sample.academic,
            courseCode: sample.academic.courseCode?.trim().toUpperCase(),
          },
          hodProportionDivision:
            options.snapshot === undefined ? proposal() : options.snapshot,
        });
      if (path.endsWith(`/requests/${sample.id}/tracking`)) return ok(tracking);
      if (path.endsWith(`/requests/${sample.id}/history`)) {
        if (historyFailure) {
          const status = historyFailure;
          historyFailure = undefined;
          return ok({ message: 'private audit error' }, status);
        }
        return ok({
          requestId: options.foreignHistory ? 'foreign-request' : sample.id,
          trackingNumber: sample.trackingNumber,
          events: options.emptyHistory ? [] : [proposalEvent],
        });
      }
      throw new Error(`Unexpected tracking request ${path}`);
    },
  );
  vi.stubGlobal('fetch', fetcher);
  const session = {
    status: 'authenticated' as const,
    message: '',
    version: 1,
    client: createApiClient(
      'https://api.example.test/api/v1',
      () => 'test-token',
      vi.fn(),
    ),
  };
  return { session, fetcher };
}
function page(options: Parameters<typeof backend>[0] = {}) {
  const setup = backend(options);
  render(
    <SessionContext.Provider value={setup.session}>
      <MemoryRouter
        initialEntries={[
          options.officer
            ? `/officer/queue/${sample.id}`
            : `/requests/${sample.id}`,
        ]}
      >
        <Routes>
          <Route path="/requests/:requestId" element={<RequestDetailPage />} />
          <Route path="/officer" element={<OfficerPortalLayout />}>
            <Route
              path="queue/:requestId"
              element={<OfficerClaimReviewPage />}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  );
  return setup;
}
afterEach(() => vi.unstubAllGlobals());

describe('expanded tracking through authorized lecturer and officer endpoints', () => {
  it.each([false, true])(
    'rejects details for a different request in the officer=%s view',
    async (officer) => {
      page({ officer, foreignDetail: true });
      expect(
        await screen.findByText(
          officer
            ? 'Review data could not be verified'
            : 'Request details could not be loaded',
        ),
      ).toBeVisible();
      expect(screen.queryByText('Proposal remarks')).not.toBeInTheDocument();
      expect(screen.queryByText(/Current stage:/)).not.toBeInTheDocument();
    },
  );
  it('uses confirmed consensus stage despite misleading tracking metadata and renders only the lecturer own snapshot response', async () => {
    const { fetcher } = page();
    expect(
      await screen.findByText('Current stage: Lecturer proportion agreement'),
    ).toBeVisible();
    expect(
      await screen.findByText(/Agreement received · Own Response Name/),
    ).toBeVisible();
    expect(
      screen.queryByText(/Other Response Name|Other confidential note/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Misleading historical stage name/),
    ).not.toBeInTheDocument();
    expect(screen.getByText('HOD proportion proposed')).toBeVisible();
    expect(screen.getByText('Pending lecturer agreement')).toBeVisible();
    expect(screen.getByText('Under review')).toBeVisible();
    expect(screen.getByText(/Server-confirmed total:/)).toHaveTextContent(
      '18,750',
    );
    for (const [, init] of fetcher.mock.calls)
      expect(new Headers(init?.headers).get('Authorization')).toBe(
        'Bearer test-token',
      );
    expect(
      fetcher.mock.calls
        .map(([input]) => String(input))
        .some((url) => /form-dropdowns|rates\/circular/.test(url)),
    ).toBe(false);
  });
  it('uses the same presentation in authorized officer review without offering an ordinary approval at consensus stage', async () => {
    page({ officer: true });
    expect(
      await screen.findByText('Current stage: Lecturer proportion agreement'),
    ).toBeVisible();
    expect(
      await screen.findByText(/Disagreement received · Other Response Name/),
    ).toBeVisible();
    expect(screen.getByText('HOD proportion proposed')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Approve' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Agree|Disagree|Set proportions/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/No decision action is available/)).toBeVisible();
  });
  it('keeps current lifecycle and stage visible when tracking status disagrees', async () => {
    page({ trackingMismatch: true });
    expect(
      await screen.findByText(/Tracking and request details do not match/),
    ).toBeVisible();
    expect(
      screen.getByText('Current stage: Lecturer proportion agreement'),
    ).toBeVisible();
    expect(screen.getByText('Under review')).toBeVisible();
    expect(
      screen.queryByRole('region', { name: 'Approval workflow' }),
    ).not.toBeInTheDocument();
  });
  it('rejects a foreign history record without showing its actor, comment or event', async () => {
    page({ foreignHistory: true });
    expect(
      await screen.findByText('History could not be verified'),
    ).toBeVisible();
    expect(screen.queryByText('Audit HOD')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Recorded proposal comment'),
    ).not.toBeInTheDocument();
  });
  it('shows no individual response details when viewing identity cannot be verified, and offers retry', async () => {
    page({ profileStatus: 403 });
    expect(
      await screen.findByText('Consensus viewing account could not be loaded'),
    ).toBeVisible();
    expect(
      screen.queryByText(
        /Own Response Name|Other Response Name|My agreement note/,
      ),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Pending lecturer agreement')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeVisible();
  });
  it.each([401, 403])(
    'does not render protected consensus data after detail access returns %s',
    async (detailStatus) => {
      page({ detailStatus });
      await screen.findByText('Request details could not be loaded');
      expect(screen.queryByText('Recorded HOD')).not.toBeInTheDocument();
      expect(screen.queryByText('Proposal remarks')).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Own Response Name|Other Response Name/),
      ).not.toBeInTheDocument();
    },
  );
  it('does not show snapshots or audit data in a forbidden officer review', async () => {
    page({ officer: true, detailStatus: 403 });
    expect(
      await screen.findByText('You are not authorized to review this request'),
    ).toBeVisible();
    expect(screen.queryByText('Proposal remarks')).not.toBeInTheDocument();
    expect(
      screen.queryByText('HOD proportion proposed'),
    ).not.toBeInTheDocument();
  });
  it('retains supported detail presentation when history fails and retries history independently', async () => {
    const { fetcher } = page({ historyStatus: 500 });
    expect(
      await screen.findByText('Approval history could not be loaded'),
    ).toBeVisible();
    expect(
      screen.getByText('Current stage: Lecturer proportion agreement'),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('HOD proportion proposed')).toBeVisible();
    expect(
      fetcher.mock.calls.filter(([input]) =>
        String(input).endsWith('/history'),
      ),
    ).toHaveLength(2);
    expect(
      fetcher.mock.calls.filter(([input]) =>
        String(input).endsWith(`/paper-marking/${sample.id}`),
      ),
    ).toHaveLength(1);
  });
  it('handles empty history and no response records without inventing individual pending agreements', async () => {
    page({
      emptyHistory: true,
      snapshot: { status: 'AWAITING_LECTURER_CONSENSUS', responses: [] },
    });
    expect(
      await screen.findByText('No history is available yet'),
    ).toBeVisible();
    expect(
      await screen.findByText(/No individual response is available/),
    ).toBeVisible();
    expect(screen.queryByText('Agreement received')).not.toBeInTheDocument();
    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });
  it('continues showing the ordinary workflow when optional consensus data is malformed', async () => {
    page({
      snapshot: {
        status: 'CONSENSUS_REACHED',
        responses: [{ agreed: 'true' }],
      },
    });
    expect(
      await screen.findByText('Consensus details could not be verified'),
    ).toBeVisible();
    expect(
      screen.getByText('Current stage: Lecturer proportion agreement'),
    ).toBeVisible();
    expect(await screen.findByText('HOD proportion proposed')).toBeVisible();
    expect(screen.queryByText('Consensus completed')).not.toBeInTheDocument();
  });
  it('keeps older claims compatible and does not make an unnecessary identity or structure request', async () => {
    const { fetcher } = page({ old: true });
    await screen.findByText('HOD proportion proposed');
    expect(
      screen.queryByRole('region', { name: 'Proportion consensus snapshot' }),
    ).not.toBeInTheDocument();
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    expect(
      fetcher.mock.calls.some(([input]) => String(input).endsWith('/auth/me')),
    ).toBe(false);
    expect(
      screen.getByRole('region', { name: 'Approval workflow' }),
    ).toBeVisible();
  });
});
