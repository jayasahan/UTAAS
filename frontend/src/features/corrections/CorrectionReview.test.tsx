import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionContext } from '../../auth/session';
import { RequestDetailPage } from '../../pages/RequestDetailPage';
import { createApiClient } from '../../services/apiClient';

const requestId = '7b5b9f20-8d1d-4d3c-8e59-17e252c81401';
const base = 'https://api.example.test/api/v1';
const detail = {
  id: requestId,
  trackingNumber: 'UT-2026-0042',
  status: 'RETURNED_FOR_CORRECTION',
  currentStageKey: 'LECTURER_CORRECTION',
  totalAmount: 2400,
  createdAt: '2026-10-20T10:00:00.000Z',
  applicant: {
    fullName: 'Dr. Lecturer',
    department: { name: 'Computer Engineering', code: 'COM' },
  },
  formData: {
    personal: {
      designation: 'Senior Lecturer',
      staffId: 'ENG/COM/042',
      referenceTitle: 'Semester claim',
    },
    metadata: {
      academicYear: '2026',
      courseCode: 'EC5060',
      courseTitle: 'Software Engineering',
    },
    items: { paperSettingCount: 1, scriptMarkingCount: 20 },
    feeCalculation: {
      currency: 'LKR',
      totalAmount: 2400,
      items: [
        {
          key: 'SCRIPT_MARKING',
          label: 'Marking of Answer Scripts',
          unit: 'per script',
          rate: 120,
          count: 20,
          subtotal: 2400,
        },
      ],
    },
    supportingDocuments: [
      {
        name: 'attendance-marks.pdf',
        documentType: 'ATTENDANCE_MARKS_SHEET',
        url: 'https://private.example/request-document',
      },
    ],
  },
};
const tracking = {
  trackingNumber: 'UT-2026-0042',
  requestType: 'Paper Setting & Marking Claim',
  status: 'RETURNED_FOR_CORRECTION',
  totalAmount: 2400,
  returningOfficerId: 'private-officer-id',
  currentStage: {
    key: 'LECTURER_CORRECTION',
    name: 'Lecturer Correction',
    order: 0,
    assignedRole: 'LECTURER',
  },
  stages: [
    {
      key: 'HEAD_OF_DEPARTMENT',
      name: 'Head of Department',
      order: 1,
      requiredRole: 'HOD',
      status: 'RETURNED',
      actorName: 'Officer name',
      enteredAt: '2026-10-20T10:00:00.000Z',
      completedAt: '2026-10-21T10:00:00.000Z',
      comments: 'Please confirm the script count.',
    },
  ],
};
const history = {
  requestId,
  trackingNumber: 'UT-2026-0042',
  events: [
    {
      id: 'return-event',
      actionType: 'RETURN',
      actorName: 'Dr. Reviewer',
      actorRole: 'HOD',
      previousStatus: 'UNDER_REVIEW',
      newStatus: 'RETURNED_FOR_CORRECTION',
      fieldDiff: null,
      comment: 'Please confirm the script count.',
      createdAt: '2026-10-21T10:00:00.000Z',
    },
  ],
};

function renderPage(ui: ReactNode) {
  const client = createApiClient(base, () => 'memory-only-test-token', vi.fn());
  return render(
    <SessionContext.Provider
      value={{
        status: 'authenticated',
        message: '',
        version: 1,
        client,
      }}
    >
      <MemoryRouter initialEntries={[`/requests/${requestId}`]}>
        <Routes>
          <Route path="/requests/:requestId" element={ui} />
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  );
}
function response(value: unknown, status = 200) {
  return new Response(status === 204 ? null : JSON.stringify(value), {
    status,
  });
}

afterEach(() => vi.unstubAllGlobals());

describe('returned Paper Marking request review', () => {
  it('shows verified correction details and keeps edit/resubmit unavailable', async () => {
    const fetcher = vi.fn(
      (input: string | URL | Request, init?: RequestInit) => {
        void init;
        const url = String(input);
        if (url.endsWith(`/requests/paper-marking/${requestId}`))
          return Promise.resolve(response(detail));
        if (url.endsWith(`/requests/${requestId}/tracking`))
          return Promise.resolve(response(tracking));
        if (url.endsWith(`/requests/${requestId}/history`))
          return Promise.resolve(response(history));
        if (new URL(url).pathname.endsWith('/auth/me'))
          return Promise.resolve(
            response({
              id: 'lecturer-1',
              email: 'lecturer@example.test',
              fullName: 'Dr. Lecturer',
              role: 'LECTURER',
              departmentCode: 'COM',
              departmentId: 'department-1',
            }),
          );
        return Promise.reject(new Error('Unexpected request'));
      },
    );
    vi.stubGlobal('fetch', fetcher);

    renderPage(<RequestDetailPage />);

    expect(await screen.findByText('Correction required')).toBeInTheDocument();
    expect(
      await screen.findByText('Returned for correction by Head of Department'),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText('Please confirm the script count.').length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Dr. Lecturer')).toBeInTheDocument();
    expect(screen.getByText('Senior Lecturer')).toBeInTheDocument();
    expect(screen.getByText('ENG/COM/042')).toBeInTheDocument();
    expect(screen.getByText('Semester claim')).toBeInTheDocument();
    expect(screen.getByText('EC5060')).toBeInTheDocument();
    expect(screen.getByText('20 scripts')).toBeInTheDocument();
    expect(screen.getByText('attendance-marks.pdf')).toBeInTheDocument();
    expect(screen.getAllByText('LKR 2,400.00').length).toBeGreaterThan(0);
    expect(
      screen.getByText('Not specified by the backend.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Edit corrections' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Review & Resubmit' }),
    ).toBeDisabled();
    expect(
      screen.queryByText(/private\.example|private-officer-id/),
    ).not.toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(
      fetcher.mock.calls.some(([input]) =>
        new URL(String(input)).pathname.endsWith('/auth/me'),
      ),
    ).toBe(true);
    expect(
      fetcher.mock.calls.filter(([input]) =>
        new URL(String(input)).pathname.endsWith('/auth/me'),
      ),
    ).toHaveLength(2);
    for (const [, init] of fetcher.mock.calls) {
      expect(init?.method ?? 'GET').toBe('GET');
    }
  });

  it('shows the returned stage note when audit history is unavailable', async () => {
    const fetcher = vi.fn(
      (input: string | URL | Request, init?: RequestInit) => {
        void init;
        const url = String(input);
        if (url.endsWith(`/requests/paper-marking/${requestId}`))
          return Promise.resolve(response(detail));
        if (url.endsWith(`/requests/${requestId}/tracking`))
          return Promise.resolve(response(tracking));
        if (url.endsWith(`/requests/${requestId}/history`))
          return Promise.resolve(new Response('unavailable', { status: 503 }));
        return Promise.reject(new Error('Unexpected request'));
      },
    );
    vi.stubGlobal('fetch', fetcher);

    renderPage(<RequestDetailPage />);

    expect(
      (await screen.findAllByText('Please confirm the script count.')).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText('Current workflow stage')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('does not render request-specific information after an unauthorized detail response', async () => {
    const fetcher = vi.fn(
      (input: string | URL | Request, init?: RequestInit) => {
        void init;
        const url = String(input);
        if (url.endsWith(`/requests/paper-marking/${requestId}`))
          return Promise.resolve(
            new Response('private detail', { status: 403 }),
          );
        if (url.endsWith(`/requests/${requestId}/tracking`))
          return Promise.resolve(response(tracking));
        if (url.endsWith(`/requests/${requestId}/history`))
          return Promise.resolve(response(history));
        return Promise.reject(new Error('Unexpected request'));
      },
    );
    vi.stubGlobal('fetch', fetcher);

    renderPage(<RequestDetailPage />);

    expect(
      await screen.findByText('Request details could not be loaded'),
    ).toBeInTheDocument();
    expect(screen.queryByText('Dr. Lecturer')).not.toBeInTheDocument();
    expect(
      screen.queryByText('Please confirm the script count.'),
    ).not.toBeInTheDocument();
  });
});
