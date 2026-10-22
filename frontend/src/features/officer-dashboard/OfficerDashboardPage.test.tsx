import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StaffProfile } from '../../auth/contracts';
import { SessionContext } from '../../auth/session';
import { ApiError } from '../../services/apiClient';
import type { ApiClient } from '../../services/apiClient';
import { OfficerPortalLayout } from '../officer-queue/OfficerPortalLayout';
import { OfficerDashboardPage } from './OfficerDashboardPage';

const requestId = 'b6a51b21-71e2-47d0-b5cb-965b8c4af922';
const hod: StaffProfile = {
  id: 'f37bb8b1-275c-4b68-bad5-c666bd4a13ac',
  email: 'hod@example.test',
  fullName: 'Dr. Example',
  role: 'HOD',
  departmentCode: 'CSE',
  departmentId: '2fb9cd70-83af-463e-8656-1c53e2cf4e36',
};
const item = {
  id: requestId,
  trackingNumber: 'UTAAS-2026-0042',
  requestType: 'Paper Marking Payment',
  applicantName: 'Dr. Sample',
  applicantEmail: 'sample@example.test',
  departmentCode: 'CSE',
  status: 'UNDER_REVIEW',
  currentStageKey: 'HEAD_OF_DEPARTMENT',
  totalAmount: 1250,
  metadata: {},
  submittedAt: '2026-10-21T08:30:00.000Z',
};
function page(data: unknown[] = [item], total = data.length) {
  return {
    data,
    meta: {
      total,
      page: 1,
      limit: 5,
      totalPages: total ? Math.ceil(total / 5) : 0,
    },
  };
}
function setup(
  profile: StaffProfile = hod,
  queueGet: () => Promise<unknown> = async () => page(),
  signedIn = true,
) {
  const get = vi.fn(async (path: string, decode: (value: unknown) => unknown) =>
    decode(path === '/auth/me' ? profile : await queueGet()),
  );
  const client = { get } as unknown as ApiClient;
  render(
    <SessionContext.Provider
      value={{
        status: signedIn ? 'authenticated' : 'signed-out',
        message: '',
        client: signedIn ? client : null,
        version: 1,
      }}
    >
      <MemoryRouter initialEntries={['/officer']}>
        <Routes>
          <Route element={<OfficerPortalLayout />}>
            <Route path="/officer" element={<OfficerDashboardPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  );
  return get;
}

afterEach(() => vi.restoreAllMocks());

describe('officer dashboard', () => {
  it('loads only the scoped pending queue and uses server total rather than page length', async () => {
    const get = setup(hod, async () => page([item], 26));
    expect(await screen.findByText('Dr. Sample')).toBeVisible();
    expect(screen.getByText('26')).toBeVisible();
    expect(screen.getByText('Department: CSE')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Open request UTAAS-2026-0042' }),
    ).toHaveAttribute('href', '/officer/queue/' + requestId);
    expect(
      screen.getByRole('link', { name: 'View Approval Queue' }),
    ).toHaveAttribute('href', '/officer/queue');
    expect(
      screen.getByRole('link', { name: 'View Review History' }),
    ).toHaveAttribute('href', '/officer/review-history');
    expect(get).toHaveBeenCalledWith(
      '/requests/pending-queue',
      expect.any(Function),
      expect.any(AbortSignal),
      { page: '1', limit: '5' },
    );
    expect(get.mock.calls.map((call) => call[0])).toEqual([
      '/auth/me',
      '/requests/pending-queue',
    ]);
    expect(
      screen.queryByRole('button', { name: /approve|return for correction/i }),
    ).toBeNull();
  });

  it.each([
    ['DEAN', 'Dean review queue'],
    ['EXAMINATION_OFFICER', 'Examination review queue'],
    ['FINANCIAL_OFFICER', 'Payout authorization queue'],
    ['ASSISTANT_BURSAR', 'Final settlement queue'],
  ] as const)('shows verified %s wording', async (role, heading) => {
    setup({ ...hod, role, departmentCode: null, departmentId: null });
    expect(await screen.findByRole('heading', { name: heading })).toBeVisible();
    expect(screen.queryByText(/faculty-level|my decisions/i)).toBeNull();
  });

  it('keeps unsupported totals explicitly unavailable even for a nonempty page', async () => {
    setup();
    await screen.findByText('Dr. Sample');
    expect(screen.getAllByText('Unavailable')).toHaveLength(3);
    expect(screen.queryByText('Recent decisions')).toBeNull();
  });

  it('shows a genuine empty queue with zero pending requests', async () => {
    setup(hod, async () => page([], 0));
    expect(
      await screen.findByText('No requests awaiting action'),
    ).toBeVisible();
    expect(screen.getByText('0')).toBeVisible();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows loading while the queue response is pending', async () => {
    let resolveQueue: ((value: unknown) => void) | undefined;
    setup(
      hod,
      () =>
        new Promise((resolve) => {
          resolveQueue = resolve;
        }),
    );
    expect(
      await screen.findByText('Loading pending requests'),
    ).toBeInTheDocument();
    expect(screen.getByText('Loading…')).toBeVisible();
    expect(screen.queryByText('Dr. Sample')).toBeNull();
    resolveQueue?.(page());
    expect(await screen.findByText('Dr. Sample')).toBeVisible();
  });

  it('handles network failure and retries without leaking stale rows', async () => {
    let fail = true;
    const get = setup(hod, async () => {
      if (fail) throw new ApiError('network');
      return page();
    });
    expect(
      await screen.findByText('Pending requests are unavailable'),
    ).toBeVisible();
    expect(screen.queryByText('Dr. Sample')).toBeNull();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Dr. Sample')).toBeVisible();
    expect(get).toHaveBeenCalledTimes(3);
  });

  it.each([
    ['unauthorized', 'Officer session expired'],
    ['forbidden', 'Approval queue access denied'],
  ] as const)(
    'handles %s without a retry action or data leak',
    async (kind, title) => {
      setup(hod, async () => {
        throw new ApiError(kind);
      });
      expect(await screen.findByText(title)).toBeVisible();
      expect(screen.queryByRole('table')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    },
  );

  it('rejects malformed queue responses', async () => {
    setup(hod, async () => ({
      data: [item],
      meta: { total: '1', page: 1, limit: 5, totalPages: 1 },
    }));
    expect(
      await screen.findByText('Pending requests are unavailable'),
    ).toBeVisible();
    expect(screen.queryByText('Dr. Sample')).toBeNull();
  });

  it.each([
    ['LECTURER', 'This account does not have an officer queue role.'],
    ['ADMIN', 'Officer dashboard is unavailable'],
  ] as const)('does not fetch dashboard data for %s', async (role, message) => {
    const get = setup({ ...hod, role });
    expect(await screen.findByText(message)).toBeVisible();
    expect(get).toHaveBeenCalledTimes(1);
    expect(screen.queryByText('Dr. Sample')).toBeNull();
  });

  it('does not fetch when HOD department scope is absent or no session exists', async () => {
    const get = setup({ ...hod, departmentId: null });
    expect(
      await screen.findByText('Your department assignment is unavailable.'),
    ).toBeVisible();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('keeps signed-out content unavailable', () => {
    const get = setup(hod, async () => page(), false);
    expect(screen.getByText('Officer access is unavailable')).toBeVisible();
    expect(get).not.toHaveBeenCalled();
    expect(screen.queryByText('Dr. Sample')).toBeNull();
  });
});
