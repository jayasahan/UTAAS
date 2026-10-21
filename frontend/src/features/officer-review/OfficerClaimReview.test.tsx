import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { StaffProfile } from '../../auth/contracts';
import { SessionContext } from '../../auth/session';
import type { ApiClient } from '../../services/apiClient';
import { ApiError } from '../../services/apiClient';
import { OfficerPortalLayout } from '../officer-queue/OfficerPortalLayout';
import { OfficerClaimReviewView } from './OfficerClaimReviewView';
import { OfficerClaimReviewPage } from './OfficerClaimReviewPage';
import { syntheticOfficerReview } from './developmentFixture';

const requestId = 'b6a51b21-71e2-47d0-b5cb-965b8c4af922';
const hod: StaffProfile = {
  id: 'f37bb8b1-275c-4b68-bad5-c666bd4a13ac',
  email: 'hod@example.test',
  fullName: 'Dr. Head of Department',
  role: 'HOD',
  departmentCode: 'CSE',
  departmentId: '2fb9cd70-83af-463e-8656-1c53e2cf4e36',
};

function renderReviewPage(
  profile: StaffProfile = hod,
  get = vi.fn(async (path: string) => {
    if (path !== '/auth/me') throw new Error('Unexpected API request');
    return profile;
  }),
) {
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
              element={<OfficerClaimReviewPage />}
            />
          </Route>
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  );
  return get;
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Officer Claim Review', () => {
  it('renders synthetic multi-row claim, server totals, workflow and metadata read-only', () => {
    render(
      <MemoryRouter>
        <OfficerClaimReviewView review={syntheticOfficerReview} />
      </MemoryRouter>,
    );

    expect(
      screen.getByRole('heading', { name: 'Application review' }),
    ).toBeVisible();
    expect(screen.getByText('Dr. Asha Example')).toBeVisible();
    expect(
      screen.getByRole('table', {
        name: 'Paper Setting and Marking claim rows',
      }),
    ).toBeVisible();
    expect(screen.getByText('Paper I')).toBeVisible();
    expect(screen.getByText('Paper II')).toBeVisible();
    expect(screen.getByText(/Server-confirmed total:/)).toHaveTextContent(
      '18,750',
    );
    expect(screen.getByText('sample-marking-schedule.pdf')).toBeVisible();
    expect(
      screen.getByText(/Document previews and downloads are disabled/),
    ).toBeVisible();
    expect(
      screen.queryByRole('navigation', { name: 'Application form progress' }),
    ).toBeNull();
    expect(
      screen.getByRole('region', { name: 'Approval workflow' }),
    ).toBeVisible();
    expect(screen.getByText('Approval & Activity History')).toBeVisible();
    expect(
      screen.queryByRole('link', { name: /sample-marking-schedule/ }),
    ).toBeNull();
    expect(
      screen.queryByRole('button', { name: /approve|reject|return/i }),
    ).toBeNull();
  });

  it('renders safe empty and missing-field states without throwing', () => {
    const review = {
      ...syntheticOfficerReview,
      personal: { ...syntheticOfficerReview.personal, fullName: null },
      academic: { ...syntheticOfficerReview.academic, courseCode: null },
      papers: [],
      feeLines: [],
      documents: [],
      tracking: { ...syntheticOfficerReview.tracking, stages: [] },
      history: { ...syntheticOfficerReview.history, events: [] },
    };
    render(
      <MemoryRouter>
        <OfficerClaimReviewView review={review} />
      </MemoryRouter>,
    );
    expect(screen.getAllByText('Not provided').length).toBeGreaterThan(0);
    expect(screen.getByText('No paper rows were returned')).toBeVisible();
    expect(screen.getByText('Server fee breakdown unavailable.')).toBeVisible();
    expect(
      screen.getByText('No supporting documents were returned'),
    ).toBeVisible();
    expect(screen.getByText('No review history was returned')).toBeVisible();
  });

  it('explains the remaining reviewer stage and document access blockers', async () => {
    const get = renderReviewPage();
    expect(
      await screen.findByText('Live claim details are unavailable'),
    ).toBeVisible();
    expect(screen.getByRole('status')).toHaveTextContent(
      "do not enforce each reviewer's assigned workflow stage",
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Document retrieval also lacks request-level authorization',
    );
    expect(screen.getByRole('status')).toHaveTextContent(
      'Issue #19 is marked closed upstream',
    );
    expect(
      screen.getByRole('link', { name: '← Back to Queue' }),
    ).toHaveAttribute('href', '/officer/queue');
    expect(screen.getByRole('link', { name: 'issue #19' })).toHaveAttribute(
      'href',
      'https://github.com/jayasahan/UTAAS/issues/19',
    );
    expect(get).toHaveBeenCalledTimes(1);
    expect(get.mock.calls[0]?.[0]).toBe('/auth/me');
  });

  it.each([
    ['HOD', hod.departmentId],
    ['DEAN', null],
    ['EXAMINATION_OFFICER', null],
    ['FINANCIAL_OFFICER', null],
    ['ASSISTANT_BURSAR', null],
    ['ADMIN', null],
  ] as const)(
    'keeps request-specific calls disabled for %s after the backend source re-check',
    async (role, departmentId) => {
      const get = renderReviewPage({ ...hod, role, departmentId });
      expect(
        await screen.findByText('Live claim details are unavailable'),
      ).toBeVisible();
      expect(get.mock.calls.map(([path]) => path)).toEqual(['/auth/me']);
    },
  );

  it('does not request details for lecturer or HOD without a department boundary', async () => {
    const lecturerGet = renderReviewPage({ ...hod, role: 'LECTURER' });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This account does not have an officer queue role.',
    );
    expect(lecturerGet).toHaveBeenCalledTimes(1);

    cleanup();
    const hodGet = renderReviewPage({ ...hod, departmentId: null });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Your department assignment is unavailable.',
    );
    expect(hodGet).toHaveBeenCalledTimes(1);
    expect(hodGet.mock.calls[0]?.[0]).toBe('/auth/me');
  });

  it('shows profile network error and allows retry without requesting claim data', async () => {
    let fail = true;
    const get = vi.fn(async (path: string) => {
      if (path !== '/auth/me') throw new Error('Unexpected API request');
      if (fail) throw new ApiError('network');
      return hod;
    });
    renderReviewPage(hod, get);
    expect(
      await screen.findByText('Officer access is unavailable'),
    ).toBeVisible();
    fail = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(
      await screen.findByText('Live claim details are unavailable'),
    ).toBeVisible();
    expect(get).toHaveBeenCalledTimes(2);
    expect(get.mock.calls.every((call) => call[0] === '/auth/me')).toBe(true);
  });
});
