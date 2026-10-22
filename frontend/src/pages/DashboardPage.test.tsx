import type { ReactNode } from 'react';
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionContext } from '../auth/session';
import { DashboardPage } from './DashboardPage';
import { createApiClient } from '../services/apiClient';

const base = 'https://api.example.test/api/v1';
const lecturer = {
  id: 'staff-1',
  email: 'lecturer@example.test',
  fullName: 'Nadeesha Perera',
  role: 'LECTURER',
  departmentCode: 'ICT',
  departmentId: 'department-1',
};
const profile = (role = 'LECTURER') => ({ ...lecturer, role });
const item = (
  id: string,
  status: string,
  overrides: Record<string, unknown> = {},
) => ({
  id,
  trackingNumber: 'UT-2026-' + id,
  requestType: 'Paper Setting & Marking Claim',
  status,
  currentStageKey: 'HEAD_OF_DEPARTMENT',
  totalAmount: 0,
  metadata: {},
  createdAt: '2026-10-20T10:00:00.000Z',
  ...overrides,
});
const requestPage = (
  data: Record<string, unknown>[] = [],
  total = data.length,
) => ({
  data,
  meta: {
    total,
    page: 1,
    limit: 5,
    totalPages: Math.ceil(total / 5),
  },
});
const ok = (value: unknown) =>
  new Response(JSON.stringify(value), { status: 200 });

function renderDashboard(onUnauthorized = vi.fn(), children?: ReactNode) {
  const client = createApiClient(
    base,
    () => 'memory-only-test-token',
    onUnauthorized,
  );
  return render(
    <SessionContext.Provider
      value={{
        status: 'authenticated',
        message: '',
        client,
        version: 1,
      }}
    >
      <MemoryRouter>{children ?? <DashboardPage />}</MemoryRouter>
    </SessionContext.Provider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe('lecturer dashboard', () => {
  it('fails closed when the app has no authenticated session', () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);

    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'Lecturer Dashboard' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Dashboard sign-in is not configured'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Production sign-in is not configured/),
    ).toBeInTheDocument();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('loads verified lecturer-owned requests and scopes status counts to the returned page', async () => {
    const fetcher = vi.fn(
      (input: string | URL | Request, _options?: RequestInit) => {
        void _options;
        const url = String(input);
        if (url.endsWith('/auth/me')) return Promise.resolve(ok(profile()));
        if (url.includes('/requests/my-requests'))
          return Promise.resolve(
            ok(
              requestPage(
                [
                  item('1', 'UNDER_REVIEW', {
                    trackingNumber: 'UT-2026-001',
                    metadata: {
                      courseCode: 'CS101',
                      courseTitle: 'Programming',
                    },
                  }),
                  item('2', 'RETURNED_FOR_CORRECTION'),
                  item('3', 'SETTLED'),
                  item('4', 'DRAFT'),
                ],
                28,
              ),
            ),
          );
        return Promise.reject(new Error('Unexpected request'));
      },
    );
    vi.stubGlobal('fetch', fetcher);

    renderDashboard();

    expect(
      await screen.findByRole('heading', { name: 'Welcome, Nadeesha Perera' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('CS101 · Programming')).toBeInTheDocument();
    expect(screen.getByText(/UT-2026-001/)).toBeInTheDocument();

    expect(
      within(screen.getByRole('group', { name: 'Total requests' })).getByText(
        '28',
      ),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole('group', { name: 'Pending / Under Review' }),
      ).getByText('1'),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole('group', { name: 'Returned for Correction' }),
      ).getByText('1'),
    ).toBeInTheDocument();
    expect(
      within(
        screen.getByRole('group', { name: 'Approved / Completed' }),
      ).getByText('1'),
    ).toBeInTheDocument();
    expect(screen.getAllByText('Of these 4 recent requests')).toHaveLength(3);
    expect(
      screen.getByText(/the API does not provide per-status totals/i),
    ).toBeInTheDocument();

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls[0]?.[0]).toBe(base + '/auth/me');
    expect(fetcher.mock.calls[0]?.[1]?.headers).toEqual({
      Authorization: 'Bearer memory-only-test-token',
    });
    expect(fetcher.mock.calls[1]?.[0]).toBe(
      base + '/requests/my-requests?page=1&limit=5',
    );
    expect(fetcher.mock.calls[1]?.[1]?.headers).toEqual({
      Authorization: 'Bearer memory-only-test-token',
    });
  });

  it('does not request or expose lecturer applications for another verified role', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(ok(profile('HOD')));
    vi.stubGlobal('fetch', fetcher);

    renderDashboard();

    expect(
      await screen.findByText(
        'Lecturer dashboard is not available for this account',
      ),
    ).toBeInTheDocument();
    expect(screen.queryByText('Nadeesha Perera')).not.toBeInTheDocument();
    expect(screen.queryByText('UT-2026-private')).not.toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('shows loading while the authenticated lecturer profile is being verified', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>(() => undefined)),
    );

    renderDashboard();

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Lecturer Dashboard' }),
    ).toBeInTheDocument();
  });

  it('shows an accurate empty state when the authenticated account has no requests', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(ok(profile()))
      .mockResolvedValueOnce(ok(requestPage([], 0)));
    vi.stubGlobal('fetch', fetcher);

    renderDashboard();

    expect(await screen.findByText('No applications yet')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Start a new application' }),
    ).toHaveAttribute('href', '/requests/new');
    expect(
      within(screen.getByRole('group', { name: 'Total requests' })).getByText(
        '0',
      ),
    ).toBeInTheDocument();
  });

  it('retries a transient request-list error and then displays the returned requests', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(ok(profile()))
      .mockResolvedValueOnce(
        new Response('private backend detail', { status: 503 }),
      )
      .mockResolvedValueOnce(ok(requestPage([item('5', 'SUBMITTED')], 1)));
    vi.stubGlobal('fetch', fetcher);

    renderDashboard();

    expect(
      await screen.findByText('Could not load your applications'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('private backend detail'),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText(/UT-2026-5/)).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('keeps request data hidden when the profile endpoint rejects the session', async () => {
    const onUnauthorized = vi.fn();
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response('private identity response', { status: 401 }),
      );
    vi.stubGlobal('fetch', fetcher);

    renderDashboard(onUnauthorized);

    expect(
      await screen.findByText('Your session has expired'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('private identity response'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Nadeesha Perera')).not.toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('hides request records after a list authorization failure and does not expose the response body', async () => {
    const onUnauthorized = vi.fn();
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(ok(profile()))
      .mockResolvedValueOnce(
        new Response('private request details', { status: 403 }),
      );
    vi.stubGlobal('fetch', fetcher);

    renderDashboard(onUnauthorized);

    expect(
      await screen.findByText('You are not authorized to view these requests'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText('private request details'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('UT-2026-private')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Retry' }),
    ).not.toBeInTheDocument();
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it('uses existing routes for new applications, drafts, requests, and tracking', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(ok(profile()))
      .mockResolvedValueOnce(
        ok(
          requestPage(
            [
              item('draft-1', 'DRAFT'),
              item('tracked-1', 'UNDER_REVIEW', {
                trackingNumber: 'UT-TRACK-1',
              }),
            ],
            2,
          ),
        ),
      );
    vi.stubGlobal('fetch', fetcher);

    renderDashboard();

    expect(
      await screen.findByRole('link', { name: /Continue Draft/ }),
    ).toHaveAttribute('href', '/requests/new?draftId=draft-1');
    expect(
      screen.getByRole('link', { name: /Track Applications/ }),
    ).toHaveAttribute('href', '/requests/tracked-1');
    expect(screen.getByRole('link', { name: /My Requests/ })).toHaveAttribute(
      'href',
      '/requests',
    );
    const newApplicationLinks = screen.getAllByRole('link', {
      name: /New Application/,
    });
    expect(newApplicationLinks).toHaveLength(2);
    for (const link of newApplicationLinks)
      expect(link).toHaveAttribute('href', '/requests/new');
    expect(screen.getByRole('link', { name: /UT-TRACK-1/ })).toHaveAttribute(
      'href',
      '/requests/tracked-1',
    );
    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(2));
  });
});
