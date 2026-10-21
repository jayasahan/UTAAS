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
const detailPath = `/requests/paper-marking/${requestId}`;
const trackingPath = `/requests/${requestId}/tracking`;
const historyPath = `/requests/${requestId}/history`;
const hod: StaffProfile = {
  id: 'f37bb8b1-275c-4b68-bad5-c666bd4a13ac',
  email: 'hod@example.test',
  fullName: 'Dr. Head of Department',
  role: 'HOD',
  departmentCode: 'CSE',
  departmentId: '2fb9cd70-83af-463e-8656-1c53e2cf4e36',
};

function responses() {
  return {
    [detailPath]: {
      id: syntheticOfficerReview.id,
      trackingNumber: syntheticOfficerReview.trackingNumber,
      status: syntheticOfficerReview.status,
      currentStageKey: 'HEAD_OF_DEPARTMENT',
      totalAmount: syntheticOfficerReview.totalAmount,
      createdAt: syntheticOfficerReview.submittedAt,
      applicant: { fullName: syntheticOfficerReview.applicantName },
      formData: {
        personal: syntheticOfficerReview.personal,
        metadata: syntheticOfficerReview.academic,
        papers: syntheticOfficerReview.papers,
        feeCalculation: { items: syntheticOfficerReview.feeLines },
        supportingDocuments: [
          {
            name: 'sample-marking-schedule.pdf',
            url: '/api/v1/requests/documents/uploader__c9fe8b42-0a12-4f54-8760-4bb1a6d9a700-sample.pdf',
            documentType: 'Marking schedule',
            size: 245760,
            mimetype: 'application/pdf',
          },
        ],
      },
    },
    [trackingPath]: syntheticOfficerReview.tracking,
    [historyPath]: syntheticOfficerReview.history,
  };
}

function renderReviewPage(
  profile: StaffProfile = hod,
  options: {
    requestId?: string;
    failPath?: string;
    holdDetail?: boolean;
    mismatchHistory?: boolean;
  } = {},
) {
  let failedOnce = false;
  const payloads: Record<string, unknown> = responses();
  const get = vi.fn(
    async (path: string, decode: (value: unknown) => unknown) => {
      if (path === detailPath && options.holdDetail)
        await new Promise<void>((resolve) => window.setTimeout(resolve, 50));
      if (path === options.failPath && !failedOnce) {
        failedOnce = true;
        throw new ApiError(path === detailPath ? 'network' : 'forbidden');
      }
      let value = path === '/auth/me' ? profile : payloads[path];
      if (path === historyPath && options.mismatchHistory && value) {
        value = {
          ...(value as object),
          requestId: 'c6a51b21-71e2-47d0-b5cb-965b8c4af922',
        };
      }
      if (!value) throw new Error(`Unexpected API request: ${path}`);
      return decode(value);
    },
  );
  const client = { get, downloadDocument: vi.fn() } as unknown as ApiClient;
  render(
    <SessionContext.Provider
      value={{ status: 'authenticated', message: '', client, version: 1 }}
    >
      <MemoryRouter
        initialEntries={[`/officer/queue/${options.requestId ?? requestId}`]}
      >
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
  it('renders the authenticated detail, tracking and history responses together', async () => {
    const get = renderReviewPage();
    expect(await screen.findByText('Dr. Asha Example')).toBeVisible();
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
      screen.getByRole('region', { name: 'Approval workflow' }),
    ).toBeVisible();
    expect(screen.getByText('Approval & Activity History')).toBeVisible();
    expect(
      screen.getByRole('link', { name: '← Back to Queue' }),
    ).toHaveAttribute('href', '/officer/queue');
    expect(get.mock.calls.map(([path]) => path).sort()).toEqual(
      ['/auth/me', detailPath, trackingPath, historyPath].sort(),
    );
    expect(
      screen.queryByRole('button', { name: /approve|reject|return/i }),
    ).toBeNull();
  });

  it('shows loading before all review responses are available', async () => {
    renderReviewPage(hod, { holdDetail: true });
    expect(await screen.findByText('Loading claim review')).toBeVisible();
    expect(await screen.findByText('Dr. Asha Example')).toBeVisible();
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

  it.each([
    ['unauthorized', 401, 'Your session has expired'],
    ['forbidden', 403, 'You are not authorized to review this request'],
    ['not-found', 404, 'Request not found'],
    ['network', 503, 'The review could not be loaded'],
  ] as const)('handles %s response safely', async (kind, status, title) => {
    const get = renderReviewPage(hod, { failPath: detailPath });
    // Replace the first request's default network failure with the requested contract error.
    if (kind !== 'network') {
      get.mockImplementation(
        async (path: string, decode: (value: unknown) => unknown) => {
          if (path === detailPath) throw new ApiError(kind, status);
          const value =
            path === '/auth/me'
              ? hod
              : responses()[path as keyof ReturnType<typeof responses>];
          if (!value) throw new Error(`Unexpected API request: ${path}`);
          return decode(value);
        },
      );
      fireEvent.click(await screen.findByRole('button', { name: 'Retry' }));
    }
    expect(await screen.findByText(title)).toBeVisible();
    expect(screen.getByRole('link', { name: '← Back to Queue' })).toBeVisible();
  });

  it('retries failed requests and shows the review after recovery', async () => {
    renderReviewPage(hod, { failPath: detailPath });
    expect(
      await screen.findByText('The review could not be loaded'),
    ).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Dr. Asha Example')).toBeVisible();
  });

  it('does not request claim resources for an invalid ID or unauthorized role', async () => {
    const invalidGet = renderReviewPage(hod, { requestId: 'not-a-uuid' });
    expect(await screen.findByText('Invalid request reference')).toBeVisible();
    expect(invalidGet.mock.calls.map(([path]) => path)).toEqual(['/auth/me']);

    cleanup();
    const lecturerGet = renderReviewPage({ ...hod, role: 'LECTURER' });
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'This account does not have an officer queue role.',
    );
    expect(lecturerGet.mock.calls.map(([path]) => path)).toEqual(['/auth/me']);
  });

  it('shows an error if the three request responses do not belong together', async () => {
    renderReviewPage(hod, { mismatchHistory: true });
    expect(
      await screen.findByText('Review data could not be verified'),
    ).toBeVisible();
    expect(screen.getByText(/responses do not match/)).toBeVisible();
  });

  it('renders the development fixture as read-only and without a download action', () => {
    render(
      <MemoryRouter>
        <OfficerClaimReviewView review={syntheticOfficerReview} />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { name: 'Application review' }),
    ).toBeVisible();
    expect(screen.getByText('Dr. Asha Example')).toBeVisible();
    expect(screen.queryByRole('button', { name: /download/i })).toBeNull();
    expect(
      screen.queryByRole('navigation', { name: 'Application form progress' }),
    ).toBeNull();
  });

  it('offers document download only for a filename validated from the request response', () => {
    const document = {
      ...syntheticOfficerReview.documents[0]!,
      downloadFilename:
        'uploader__c9fe8b42-0a12-4f54-8760-4bb1a6d9a700-review.pdf',
    };
    const onDownload = vi.fn();
    render(
      <MemoryRouter>
        <OfficerClaimReviewView
          review={{ ...syntheticOfficerReview, documents: [document] }}
          onDownload={onDownload}
        />
      </MemoryRouter>,
    );
    fireEvent.click(
      screen.getByRole('button', {
        name: 'Download sample-marking-schedule.pdf',
      }),
    );
    expect(onDownload).toHaveBeenCalledWith(document);
  });
});
