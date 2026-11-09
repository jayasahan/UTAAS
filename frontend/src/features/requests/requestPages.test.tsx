import type { ReactNode } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionContext } from '../../auth/session';
import { ApplicationsPage } from '../../pages/ApplicationsPage';
import { RequestDetailPage } from '../../pages/RequestDetailPage';
import { createApiClient } from '../../services/apiClient';

const requestId = '7b5b9f20-8d1d-4d3c-8e59-17e252c81401';
const base = 'https://api.example.test/api/v1';
const listResponse = {
  data: [
    {
      id: requestId,
      trackingNumber: 'UT-2026-001',
      requestType: 'Paper Setting & Marking Claim',
      status: 'UNDER_REVIEW',
      currentStageKey: 'HEAD_OF_DEPARTMENT',
      totalAmount: 1250,
      metadata: { courseCode: 'CS101', courseTitle: 'Programming' },
      createdAt: '2026-10-20T10:00:00.000Z',
    },
  ],
  meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
};

function session(onUnauthorized = vi.fn()) {
  return {
    status: 'authenticated' as const,
    message: '',
    version: 1,
    client: createApiClient(
      base,
      () => 'memory-only-test-token',
      onUnauthorized,
    ),
  };
}

function renderWithSession(ui: ReactNode, initialEntry: string) {
  return render(
    <SessionContext.Provider value={session()}>
      <MemoryRouter initialEntries={[initialEntry]}>{ui}</MemoryRouter>
    </SessionContext.Provider>,
  );
}

function ok(value: unknown) {
  return new Response(JSON.stringify(value), { status: 200 });
}

afterEach(() => vi.unstubAllGlobals());

describe('authenticated request pages', () => {
  it('loads the authenticated request page with pagination and bearer auth', async () => {
    const fetcher = vi.fn().mockResolvedValue(ok(listResponse));
    vi.stubGlobal('fetch', fetcher);

    renderWithSession(<ApplicationsPage />, '/requests');

    expect(await screen.findByText('CS101 · Programming')).toBeInTheDocument();
    expect(screen.getByText('UT-2026-001')).toBeInTheDocument();
    expect(
      screen.getByText(
        (content) => content.replaceAll('\u00a0', ' ') === 'LKR 1,250.00',
      ),
    ).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${base}/requests/my-requests?page=1&limit=10`);
    expect(options.headers).toEqual({
      Authorization: 'Bearer memory-only-test-token',
    });
  });

  it('loads detail, tracking and history as independent authenticated reads', async () => {
    const detail = {
      id: requestId,
      trackingNumber: 'UT-2026-001',
      status: 'UNDER_REVIEW',
      currentStageKey: 'HEAD_OF_DEPARTMENT',
      totalAmount: 1250,
      formData: {
        metadata: { academicYear: '2026', courseTitle: 'Programming' },
      },
      createdAt: '2026-10-20T10:00:00.000Z',
    };
    const tracking = {
      trackingNumber: 'UT-2026-001',
      requestType: 'Paper Marking Request',
      status: 'UNDER_REVIEW',
      totalAmount: 1250,
      returningOfficerId: null,
      currentStage: {
        key: 'HEAD_OF_DEPARTMENT',
        name: 'Head of Department',
        order: 1,
        assignedRole: 'HOD',
      },
      stages: [
        {
          key: 'HEAD_OF_DEPARTMENT',
          name: 'Head of Department',
          order: 1,
          requiredRole: 'HOD',
          status: 'IN_PROGRESS',
          actorName: null,
          enteredAt: '2026-10-20T10:00:00.000Z',
          completedAt: null,
          comments: '',
        },
      ],
    };
    const history = {
      requestId,
      trackingNumber: 'UT-2026-001',
      events: [
        {
          id: 'event-1',
          actionType: 'SUBMITTED',
          actorName: 'Lecturer',
          actorRole: 'LECTURER',
          previousStatus: null,
          newStatus: 'UNDER_REVIEW',
          comment: '',
          fieldDiff: { totalAmount: 1250, courseCode: 'CS101' },
          createdAt: '2026-10-20T10:00:00.000Z',
        },
      ],
    };
    const fetcher = vi.fn(
      (input: string | URL | Request, _options?: RequestInit) => {
        void _options;
        const url = String(input);
        if (url.endsWith(`/requests/paper-marking/${requestId}`))
          return Promise.resolve(ok(detail));
        if (url.endsWith(`/requests/${requestId}/tracking`))
          return Promise.resolve(ok(tracking));
        if (url.endsWith(`/requests/${requestId}/history`))
          return Promise.resolve(ok(history));
        if (new URL(url).pathname.endsWith('/auth/me'))
          return Promise.resolve(
            ok({
              id: 'lecturer-1',
              email: 'lecturer@example.test',
              fullName: 'Lecturer',
              role: 'LECTURER',
              departmentCode: 'ENG',
              departmentId: 'department-1',
            }),
          );
        return Promise.reject(new Error('Unexpected request'));
      },
    );
    vi.stubGlobal('fetch', fetcher);

    renderWithSession(
      <Routes>
        <Route path="/requests/:requestId" element={<RequestDetailPage />} />
      </Routes>,
      `/requests/${requestId}`,
    );

    expect(await screen.findByText('Course title')).toBeInTheDocument();
    expect(screen.getByText('Approval progress')).toBeInTheDocument();
    expect(
      await screen.findByText('Current stage: Head of Department'),
    ).toBeInTheDocument();
    expect(screen.getByText('Paper Marking Request')).toBeInTheDocument();
    expect(screen.getByText('SUBMITTED')).toBeInTheDocument();
    expect(
      screen.getByText('Initial state → UNDER REVIEW'),
    ).toBeInTheDocument();
    await screen.getByText('Changed fields').click();
    expect(screen.getByText('courseCode')).toBeInTheDocument();
    expect(screen.getByText('CS101')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(4);
    expect(
      fetcher.mock.calls.some(([input]) =>
        new URL(String(input)).pathname.endsWith('/auth/me'),
      ),
    ).toBe(true);
    expect(
      fetcher.mock.calls.filter(([input]) =>
        new URL(String(input)).pathname.endsWith('/auth/me'),
      ),
    ).toHaveLength(1);
    for (const [, options] of fetcher.mock.calls) {
      expect(options?.headers).toEqual({
        Authorization: 'Bearer memory-only-test-token',
      });
    }
  });

  it('does not make API calls for an invalid request identifier', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);

    renderWithSession(
      <Routes>
        <Route path="/requests/:requestId" element={<RequestDetailPage />} />
      </Routes>,
      '/requests/not-a-uuid',
    );

    expect(screen.getByText('Invalid request identifier')).toBeInTheDocument();
    await waitFor(() => expect(fetcher).not.toHaveBeenCalled());
  });

  it('shows a safe error state when the list endpoint is unauthorized', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response('private error detail', { status: 401 }));
    vi.stubGlobal('fetch', fetcher);

    renderWithSession(<ApplicationsPage />, '/requests');

    expect(
      await screen.findByText(/session is no longer valid/i),
    ).toBeInTheDocument();
    expect(screen.queryByText('private error detail')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('shows an empty state for an empty verified response', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        ok({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } }),
      );
    vi.stubGlobal('fetch', fetcher);

    renderWithSession(<ApplicationsPage />, '/requests');

    expect(await screen.findByText('No requests found')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Prepare a new application' }),
    ).toHaveAttribute('href', '/requests/new');
  });

  it('moves between backend pages without mixing request results', async () => {
    const fetcher = vi.fn((input: string | URL | Request) => {
      const url = new URL(String(input));
      const page = Number(url.searchParams.get('page'));
      return Promise.resolve(
        ok({
          data: [
            {
              ...listResponse.data[0],
              trackingNumber: `UT-2026-00${page}`,
            },
          ],
          meta: { total: 2, page, limit: 10, totalPages: 2 },
        }),
      );
    });
    vi.stubGlobal('fetch', fetcher);

    renderWithSession(<ApplicationsPage />, '/requests');
    expect(await screen.findByText('UT-2026-001')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(await screen.findByText('UT-2026-002')).toBeInTheDocument();
    expect(screen.queryByText('UT-2026-001')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Next' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Previous' }));
    expect(await screen.findByText('UT-2026-001')).toBeInTheDocument();
    expect(
      fetcher.mock.calls.map(([url]) =>
        new URL(String(url)).searchParams.get('page'),
      ),
    ).toEqual(['1', '2', '1']);
  });
});
