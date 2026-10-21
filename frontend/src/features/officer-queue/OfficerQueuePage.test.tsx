import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ApiClient } from '../../services/apiClient';
import { ApiError } from '../../services/apiClient';
import { SessionContext } from '../../auth/session';
import type { StaffProfile } from '../../auth/contracts';
import { OfficerPortalLayout } from './OfficerPortalLayout';
import { OfficerQueuePage } from './OfficerQueuePage';

const requestId = 'b6a51b21-71e2-47d0-b5cb-965b8c4af922';
const hod: StaffProfile = {
  id: 'f37bb8b1-275c-4b68-bad5-c666bd4a13ac',
  email: 'hod@example.test',
  fullName: 'Dr. Head of Department',
  role: 'HOD',
  departmentCode: 'CSE',
  departmentId: '2fb9cd70-83af-463e-8656-1c53e2cf4e36',
};
function queueEntry(id = requestId) {
  return {
    id,
    trackingNumber: 'UTAAS-2026-0042',
    requestType: 'Paper Marking Payment',
    applicantName: 'Dr. Sample',
    applicantEmail: 'sample@example.test',
    departmentCode: 'CSE',
    status: 'UNDER_REVIEW',
    currentStageKey: 'HEAD_OF_DEPARTMENT',
    totalAmount: 1250,
    metadata: { courseCode: 'EC5406' },
    submittedAt: '2026-10-21T08:30:00.000Z',
  };
}
function response(data: unknown, page = 1, total = 1, totalPages = 1) {
  return {
    data: Array.isArray(data) ? data : [data],
    meta: { total, page, limit: 10, totalPages },
  };
}
function setup(
  profile: StaffProfile = hod,
  queueGet: (
    query?: Readonly<Record<string, string>>,
  ) => Promise<unknown> = async () => response(queueEntry()),
) {
  const get = vi.fn(
    async (
      path: string,
      decode: (value: unknown) => unknown,
      _signal?: AbortSignal,
      query?: Readonly<Record<string, string>>,
    ) => {
      const value = path === '/auth/me' ? profile : await queueGet(query);
      return decode(value);
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
      <MemoryRouter initialEntries={['/officer/queue']}>
        <Routes>
          <Route element={<OfficerPortalLayout />}>
            <Route path="/officer/queue" element={<OfficerQueuePage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  );
  return get;
}

afterEach(() => vi.restoreAllMocks());

describe('officer approval queue', () => {
  it('renders backend queue data, scope, status and detail navigation', async () => {
    setup();
    expect(
      await screen.findByRole('heading', { name: 'Approval Queue' }),
    ).toBeVisible();
    expect(
      screen.getByText('Head of Department · signed-in role'),
    ).toBeVisible();
    expect(
      screen.getByText('Assigned department: CSE', { exact: false }),
    ).toBeVisible();
    expect(await screen.findByText('Dr. Sample')).toBeVisible();
    expect(
      screen.getByRole('table', {
        name: 'Applications awaiting officer action',
      }),
    ).toBeVisible();
    expect(screen.getByText('Paper Marking Payment')).toBeVisible();
    expect(screen.getByText('Under review')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Review →' })).toHaveAttribute(
      'href',
      `/officer/queue/${requestId}`,
    );
    expect(
      screen.getByRole('navigation', { name: 'Main navigation' }),
    ).toHaveTextContent('Approval Queue');
  });

  it('requests only supported page and limit query parameters', async () => {
    const get = setup(hod, async (query) =>
      response(queueEntry(), Number(query?.page ?? 1), 11, 2),
    );
    expect(await screen.findByText(/Page\s+1\s+of\s+2/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() =>
      expect(get).toHaveBeenCalledWith(
        '/requests/pending-queue',
        expect.any(Function),
        expect.any(AbortSignal),
        { page: '2', limit: '10' },
      ),
    );
    expect(await screen.findByText(/Page\s+2\s+of\s+2/)).toBeVisible();
  });

  it('does not call the queue for a lecturer and hides officer navigation', async () => {
    const lecturer = { ...hod, role: 'LECTURER' as const };
    const get = setup(lecturer);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This account does not have an officer queue role.',
    );
    expect(get).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('link', { name: 'Approval Queue' })).toBeNull();
  });

  it('blocks HOD queue requests when the profile has no department boundary', async () => {
    const get = setup({ ...hod, departmentId: null, departmentCode: null });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your department assignment is unavailable.',
    );
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0]?.[0]).toBe('/auth/me');
  });

  it('renders an empty state from the verified empty response', async () => {
    setup(hod, async () => response([], 1, 0, 0));
    expect(
      await screen.findByText('No requests awaiting action'),
    ).toBeVisible();
    expect(screen.queryByRole('table')).toBeNull();
  });

  it('shows queue loading state while the response is pending', async () => {
    let resolveQueue: ((value: unknown) => void) | undefined;
    setup(hod, () => new Promise((resolve) => (resolveQueue = resolve)));
    expect(
      await screen.findByText('Loading approval queue'),
    ).toBeInTheDocument();
    resolveQueue?.(response(queueEntry()));
    expect(await screen.findByText('Dr. Sample')).toBeVisible();
  });

  it('shows a safe network error and retries the queue request', async () => {
    let shouldFail = true;
    const get = setup(hod, async () => {
      if (shouldFail) throw new ApiError('network');
      return response(queueEntry());
    });
    expect(
      await screen.findByText('Could not load the approval queue'),
    ).toBeVisible();
    expect(
      screen.getByText(
        'The backend could not be reached. Check the connection and try again.',
      ),
    ).toBeVisible();
    shouldFail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Dr. Sample')).toBeVisible();
    expect(get).toHaveBeenCalledTimes(3);
  });

  it('keeps the detail page on the officer route with officer navigation context', async () => {
    const get = vi.fn(
      async (path: string, decode: (value: unknown) => unknown) =>
        decode(path === '/auth/me' ? hod : response(queueEntry())),
    );
    const client = { get } as unknown as ApiClient;
    render(
      <SessionContext.Provider
        value={{ status: 'authenticated', message: '', client, version: 1 }}
      >
        <MemoryRouter initialEntries={[`/officer/queue/${requestId}`]}>
          <Routes>
            <Route element={<OfficerPortalLayout />}>
              <Route
                path="/officer/queue/:requestId"
                element={<div>Officer request detail</div>}
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </SessionContext.Provider>,
    );
    expect(await screen.findByText('Officer request detail')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Approval Queue' }),
    ).toHaveAttribute('href', '/officer/queue');
  });
});
