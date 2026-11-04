import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../services/apiClient';
import type { ApiClient } from '../../services/apiClient';
import { SessionContext } from '../../auth/session';
import type { StaffProfile } from '../../auth/contracts';
import { DevOfficerReviewHistoryPreview } from './DevOfficerReviewHistoryPreview';
import { OfficerPortalLayout } from '../officer-queue/OfficerPortalLayout';
import { OfficerReviewHistoryPage } from './OfficerReviewHistoryPage';

const hod: StaffProfile = {
  id: 'f37bb8b1-275c-4b68-bad5-c666bd4a13ac',
  email: 'hod@example.test',
  fullName: 'Dr. Head of Department',
  role: 'HOD',
  departmentCode: 'CSE',
  departmentId: '2fb9cd70-83af-463e-8656-1c53e2cf4e36',
};

const historyEntry = {
  id: '59ca45ea-b576-4e81-8524-7bf48e747275',
  trackingNumber: 'UTR-2026-0001',
  applicant: 'Dr. Kamal Perera',
  claimType: 'Paper Setting & Marking Claim',
  department: 'Computer Engineering',
  departmentCode: 'COM',
  decision: 'APPROVED',
  decisionDate: '2026-10-21T14:30:00.000Z',
  totalAmount: 29900,
  events: [
    {
      id: 'b8e9f5e1-8f0a-4c5b-b9d1-8f0a4c5bb9d1',
      action: 'APPROVE',
      actor: 'Dr. Jane Smith',
      role: 'HOD',
      occurredAt: '2026-10-21T14:30:00.000Z',
      summary: 'Approved and recommended for faculty review',
    },
  ],
};

function historyResponse(
  options: {
    data?: unknown[];
    page?: number;
    total?: number;
    totalPages?: number;
    summaryCounts?: { approved: number; returned: number; rejected: number };
  } = {},
) {
  const data = options.data ?? [historyEntry];
  const page = options.page ?? 1;
  const total = options.total ?? data.length;
  const totalPages = options.totalPages ?? (total === 0 ? 0 : 1);
  const summaryCounts = options.summaryCounts ?? {
    approved: 4,
    returned: 1,
    rejected: 0,
  };
  return {
    data,
    meta: { total, page, limit: 10, totalPages, summaryCounts },
  };
}

type HistoryResolver = (
  query?: Readonly<Record<string, string>>,
) => unknown | Promise<unknown>;

function renderProductionPage(
  profile = hod,
  history: unknown | HistoryResolver = historyResponse(),
) {
  const get = vi.fn(
    async (
      path: string,
      decode: (value: unknown) => unknown,
      _signal?: AbortSignal,
      query?: Readonly<Record<string, string>>,
    ) => {
      if (path === '/auth/me') return decode(profile);
      const response =
        typeof history === 'function'
          ? await (history as HistoryResolver)(query)
          : history;
      return decode(response);
    },
  );
  const client = { get } as unknown as ApiClient;
  render(
    <SessionContext.Provider
      value={{
        status: 'authenticated',
        message: 'test session',
        client,
        version: 1,
      }}
    >
      <MemoryRouter initialEntries={['/officer/review-history']}>
        <Routes>
          <Route element={<OfficerPortalLayout />}>
            <Route
              path="/officer/review-history"
              element={<OfficerReviewHistoryPage />}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  );
  return get;
}

function renderDevelopmentPreview() {
  return render(
    <MemoryRouter>
      <DevOfficerReviewHistoryPreview />
    </MemoryRouter>,
  );
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Officer Review History page', () => {
  it('shows expired authentication and retries the officer profile request', async () => {
    let profileAttempts = 0;
    const get = vi.fn(
      async (path: string, decode: (value: unknown) => unknown) => {
        if (path === '/auth/me') {
          profileAttempts += 1;
          if (profileAttempts === 1) throw new ApiError('unauthorized', 401);
          return decode(hod);
        }
        return decode(historyResponse());
      },
    );
    const client = { get } as unknown as ApiClient;
    render(
      <SessionContext.Provider
        value={{
          status: 'authenticated',
          message: 'test session',
          client,
          version: 1,
        }}
      >
        <MemoryRouter initialEntries={['/officer/review-history']}>
          <Routes>
            <Route element={<OfficerPortalLayout />}>
              <Route
                path="/officer/review-history"
                element={<OfficerReviewHistoryPage />}
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </SessionContext.Provider>,
    );

    expect(
      await screen.findByText('Officer access is unavailable'),
    ).toBeVisible();
    expect(
      screen.getByText(
        'Authentication is required or the session is no longer valid.',
      ),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('UTR-2026-0001')).toBeVisible();
    expect(get).toHaveBeenCalledTimes(3);
    expect(get.mock.calls.map(([path]) => path)).toEqual([
      '/auth/me',
      '/auth/me',
      '/requests/review-history',
    ]);
  });
  it('shows a loading state until the authenticated profile resolves', async () => {
    let resolveProfile: (profile: StaffProfile) => void = () => {};
    const pendingProfile = new Promise<StaffProfile>((resolve) => {
      resolveProfile = resolve;
    });
    const get = vi.fn((path: string, decode: (value: unknown) => unknown) =>
      path === '/auth/me'
        ? pendingProfile.then((value) => decode(value))
        : Promise.resolve(decode(historyResponse())),
    );
    const client = { get } as unknown as ApiClient;
    render(
      <SessionContext.Provider
        value={{
          status: 'authenticated',
          message: 'test session',
          client,
          version: 1,
        }}
      >
        <MemoryRouter initialEntries={['/officer/review-history']}>
          <Routes>
            <Route element={<OfficerPortalLayout />}>
              <Route
                path="/officer/review-history"
                element={<OfficerReviewHistoryPage />}
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </SessionContext.Provider>,
    );

    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading authenticated officer profile',
    );
    expect(
      screen.queryByRole('heading', { name: 'Review History' }),
    ).not.toBeInTheDocument();
    resolveProfile(hod);
    expect(
      await screen.findByRole('heading', { name: 'Review History' }),
    ).toBeVisible();
  });
  it('loads authenticated personal history by default and renders API summary counts', async () => {
    const get = renderProductionPage();
    expect(await screen.findByText('UTR-2026-0001')).toBeVisible();
    expect(
      screen.getByRole('heading', { name: 'Review History' }),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: '← Back to Approval Queue' }),
    ).toHaveAttribute('href', '/officer/queue');
    expect(get.mock.calls.map(([path]) => path)).toEqual([
      '/auth/me',
      '/requests/review-history',
    ]);
    expect(get.mock.calls[1]?.[3]).toMatchObject({
      page: '1',
      limit: '10',
      decision: 'all',
      scope: 'personal',
    });
    expect(screen.getByLabelText('History scope')).toHaveValue('personal');
    expect(screen.getByText('4')).toBeVisible();
    expect(screen.getByText('1')).toBeVisible();
    expect(screen.getByText('Computer Engineering · COM')).toBeVisible();
    expect(
      screen.queryByText(/UTAAS-DEMO|Example Fernando|Sample Lecturer/),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'View activity' }));
    expect(
      screen.getByRole('region', { name: 'Activity for UTR-2026-0001' }),
    ).toBeVisible();
    expect(
      screen.getByText('Approved and recommended for faculty review'),
    ).toBeVisible();
    expect(
      screen.getByText(
        /not a claim that every event was performed by the selected reviewer/,
      ),
    ).toBeVisible();
  });

  it('renders approved, returned, and rejected decisions from the backend mapping', async () => {
    renderProductionPage(
      hod,
      historyResponse({
        data: [
          historyEntry,
          {
            ...historyEntry,
            id: '659d8c7d-1c4c-4ac6-97d4-c75d6fd6881b',
            trackingNumber: 'UTR-2026-0002',
            decision: 'RETURNED_FOR_CORRECTION',
          },
          {
            ...historyEntry,
            id: '0dc99655-22b5-41de-9e68-2eea1042becb',
            trackingNumber: 'UTR-2026-0003',
            decision: 'REJECTED',
          },
        ],
        total: 3,
        totalPages: 1,
        summaryCounts: { approved: 1, returned: 1, rejected: 1 },
      }),
    );
    expect(await screen.findByText('UTR-2026-0001')).toBeVisible();
    const table = screen.getByRole('table', {
      name: 'Officer completed review history',
    });
    expect(within(table).getByText('Approved')).toBeVisible();
    expect(within(table).getByText('Returned for correction')).toBeVisible();
    expect(within(table).getByText('Rejected')).toBeVisible();
  });

  it('uses explicit role scope and leaves HOD department enforcement to the backend', async () => {
    const get = renderProductionPage();
    await screen.findByText('UTR-2026-0001');
    fireEvent.change(screen.getByLabelText('History scope'), {
      target: { value: 'role' },
    });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(3));
    expect(get.mock.calls[2]?.[3]).toMatchObject({ scope: 'role', page: '1' });
    expect(get.mock.calls[2]?.[3]).not.toHaveProperty('departmentId');
    expect(
      screen.getByText(
        'Role-wide results remain restricted to your verified department by the backend.',
      ),
    ).toBeVisible();
  });

  it('sends supported search and decision filters to the backend and omits unsupported filters', async () => {
    const get = renderProductionPage();
    await screen.findByText('UTR-2026-0001');
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: ' UTR-2026 ' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Search' }));
    await waitFor(() => expect(get).toHaveBeenCalledTimes(3));
    expect(get.mock.calls[2]?.[3]).toMatchObject({
      page: '1',
      scope: 'personal',
      search: 'UTR-2026',
    });

    fireEvent.change(screen.getByLabelText('Decision'), {
      target: { value: 'APPROVED' },
    });
    await waitFor(() => expect(get).toHaveBeenCalledTimes(4));
    expect(get.mock.calls[3]?.[3]).toMatchObject({
      decision: 'APPROVED',
      search: 'UTR-2026',
      page: '1',
    });
    expect(screen.queryByLabelText('Department')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Date range')).not.toBeInTheDocument();
  });

  it('uses API pagination rather than slicing the current page locally', async () => {
    const get = renderProductionPage(
      hod,
      (query: Readonly<Record<string, string>> | undefined) =>
        historyResponse({
          data: [
            {
              ...historyEntry,
              trackingNumber: `UTR-2026-PAGE-${query?.page}`,
            },
          ],
          page: Number(query?.page ?? 1),
          total: 11,
          totalPages: 2,
          summaryCounts: { approved: 9, returned: 2, rejected: 0 },
        }),
    );
    expect(await screen.findByText('UTR-2026-PAGE-1')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('UTR-2026-PAGE-2')).toBeVisible();
    await waitFor(() => expect(get).toHaveBeenCalledTimes(3));
    expect(get.mock.calls[2]?.[3]).toMatchObject({ page: '2', limit: '10' });
    expect(screen.getByText('Page 2 of 2')).toBeVisible();
  });

  it('shows backend empty results without substituting preview fixtures', async () => {
    renderProductionPage(
      hod,
      historyResponse({
        data: [],
        total: 0,
        totalPages: 0,
        summaryCounts: { approved: 0, returned: 0, rejected: 0 },
      }),
    );
    expect(await screen.findByText('No completed reviews found')).toBeVisible();
    expect(
      screen.queryByText(/UTAAS-DEMO|Example Fernando/),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Review history pages' }),
    ).not.toBeInTheDocument();
  });

  it('handles expired sessions with a sign-in link and no record data', async () => {
    let historyCalls = 0;
    renderProductionPage(hod, () => {
      historyCalls += 1;
      throw new ApiError('unauthorized', 401);
    });
    expect(await screen.findByText('Your session has expired')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Sign in again' })).toHaveAttribute(
      'href',
      '/login',
    );
    expect(screen.queryByText('UTR-2026-0001')).not.toBeInTheDocument();
    expect(historyCalls).toBe(1);
  });

  it('shows forbidden access without displaying history records', async () => {
    renderProductionPage(hod, () => {
      throw new ApiError('forbidden', 403);
    });
    expect(
      await screen.findByText('Review history access is denied'),
    ).toBeVisible();
    expect(screen.queryByText('UTR-2026-0001')).not.toBeInTheDocument();
  });

  it('retries a network failure and then renders the verified response', async () => {
    let historyCalls = 0;
    renderProductionPage(hod, () => {
      historyCalls += 1;
      if (historyCalls === 1) throw new ApiError('network');
      return historyResponse();
    });
    expect(
      await screen.findByText('Could not load review history'),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('UTR-2026-0001')).toBeVisible();
    expect(historyCalls).toBe(2);
  });

  it('shows a loading state while the authenticated history request is pending', async () => {
    let resolveHistory: (value: unknown) => void = () => {};
    const pendingHistory = new Promise<unknown>((resolve) => {
      resolveHistory = resolve;
    });
    renderProductionPage(hod, () => pendingHistory);
    expect(
      await screen.findByText('Completed Paper Setting & Marking reviews'),
    ).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading officer review history',
    );
    resolveHistory(historyResponse());
    expect(await screen.findByText('UTR-2026-0001')).toBeVisible();
  });

  it('blocks lecturer access before showing the history page', async () => {
    const lecturer = { ...hod, role: 'LECTURER' as const };
    const get = renderProductionPage(lecturer);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'does not have an officer queue role',
    );
    expect(
      screen.queryByRole('heading', { name: 'Review History' }),
    ).not.toBeInTheDocument();
    expect(get.mock.calls.map(([path]) => path)).toEqual(['/auth/me']);
  });

  it('fails closed for an HOD without a verified department', async () => {
    const unassignedHod = { ...hod, departmentId: null };
    const get = renderProductionPage(unassignedHod);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'department assignment is unavailable',
    );
    expect(
      screen.queryByRole('heading', { name: 'Review History' }),
    ).not.toBeInTheDocument();
    expect(get.mock.calls.map(([path]) => path)).toEqual(['/auth/me']);
  });

  it('renders only clearly labeled fictional preview data', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    renderDevelopmentPreview();

    expect(
      screen.getByText('Development preview — fictional data only'),
    ).toBeVisible();
    expect(screen.getByText(/No backend requests are made/)).toBeVisible();
    const table = screen.getByRole('table', {
      name: 'Development-only sample officer review history',
    });
    expect(within(table).getAllByRole('row')).toHaveLength(5);
    expect(within(table).getByText('UTAAS-DEMO-021')).toBeVisible();
    expect(within(table).getByText('Dr. Example Fernando')).toBeVisible();
    expect(
      within(table).getAllByText('Paper Setting & Marking Payment'),
    ).toHaveLength(4);
    expect(
      within(table).queryByText(/General Reimbursement|Examination Duty/),
    ).not.toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('keeps the summary card wrap-safe across tablet breakpoints', () => {
    renderDevelopmentPreview();

    const scope = screen.getByText(/View scope:/);
    expect(scope).toHaveClass(
      'min-w-0',
      'break-words',
      'sm:col-span-2',
      'xl:col-span-1',
    );
    expect(scope.parentElement).toHaveClass(
      'grid-cols-1',
      'sm:grid-cols-2',
      'xl:grid-cols-[minmax(12rem,1fr)_minmax(12rem,1fr)_minmax(0,2fr)]',
    );
  });

  it('applies accessible search, decision, department, and date controls locally', () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-22T12:00:00.000Z'));
    renderDevelopmentPreview();
    const table = screen.getByRole('table', {
      name: 'Development-only sample officer review history',
    });

    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'Example Perera' },
    });
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByText('UTAAS-DEMO-022')).toBeVisible();

    fireEvent.change(screen.getByLabelText('Search reference or applicant'), {
      target: { value: '' },
    });
    fireEvent.change(screen.getByLabelText('Decision'), {
      target: { value: 'RETURNED_FOR_CORRECTION' },
    });
    expect(within(table).getAllByRole('row')).toHaveLength(2);

    fireEvent.change(screen.getByLabelText('Decision'), {
      target: { value: 'all' },
    });
    fireEvent.change(screen.getByLabelText('Department'), {
      target: { value: 'Computer Engineering' },
    });
    expect(within(table).getAllByRole('row')).toHaveLength(3);

    fireEvent.change(screen.getByLabelText('Department'), {
      target: { value: 'all' },
    });
    fireEvent.change(screen.getByLabelText('Date range'), {
      target: { value: 'last-month' },
    });
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(within(table).getByText('UTAAS-DEMO-025')).toBeVisible();
    expect(
      screen.queryByRole('navigation', { name: /history pages/i }),
    ).not.toBeInTheDocument();
  });

  it('shows an empty state and expands a fictional audit history', () => {
    renderDevelopmentPreview();
    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: 'no sample record' },
    });
    expect(
      screen.getByText('No sample decisions match these filters'),
    ).toBeVisible();

    fireEvent.change(screen.getByRole('searchbox'), {
      target: { value: '' },
    });
    fireEvent.click(
      screen.getAllByRole('button', { name: /View history/ })[0]!,
    );
    expect(
      screen.getByRole('region', { name: 'Fictional audit history' }),
    ).toBeVisible();
    expect(
      screen.getByText('Fictional department review completed.'),
    ).toBeVisible();
  });
});
