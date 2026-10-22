import { fireEvent, render, screen, within } from '@testing-library/react';
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

function renderProductionPage(profile = hod) {
  const get = vi.fn(
    async (_path: string, decode: (value: unknown) => unknown) =>
      decode(profile),
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
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('Officer Review History page', () => {
  it('shows expired authentication and retries the officer profile request', async () => {
    const get = vi
      .fn()
      .mockRejectedValueOnce(new ApiError('unauthorized'))
      .mockResolvedValueOnce(hod);
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
    expect(
      await screen.findByText('Officer review history is unavailable'),
    ).toBeVisible();
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls.map(([path]) => path)).toEqual([
      '/auth/me',
      '/auth/me',
    ]);
  });
  it('shows a loading state until the authenticated profile resolves', async () => {
    let resolveProfile: (profile: StaffProfile) => void = () => {};
    const pendingProfile = new Promise<StaffProfile>((resolve) => {
      resolveProfile = resolve;
    });
    const get = vi.fn(() => pendingProfile);
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
  it('keeps production history unavailable and makes only the profile request', async () => {
    const get = renderProductionPage();
    expect(
      await screen.findByRole('heading', { name: 'Review History' }),
    ).toBeVisible();
    expect(
      screen.getByText('Officer review history is unavailable'),
    ).toBeVisible();
    expect(
      screen.getByText(
        /scopes records by reviewer role and completed stage, not by the signed-in officer/,
      ),
    ).toBeVisible();
    expect(
      screen.getByRole('link', { name: '← Back to Approval Queue' }),
    ).toHaveAttribute('href', '/officer/queue');
    expect(get.mock.calls.map(([path]) => path)).toEqual(['/auth/me']);
    expect(
      screen.queryByText(/UTAAS-DEMO|Example Fernando|Sample Lecturer/),
    ).not.toBeInTheDocument();
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
