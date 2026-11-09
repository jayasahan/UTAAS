import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
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
const paperStructurePath = '/requests/paper-marking/paper-structure';
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
    [paperStructurePath]: {
      exists: false,
      message: 'No registered structure.',
    },
  };
}

function renderReviewPage(
  profile: StaffProfile = hod,
  options: {
    requestId?: string;
    failPath?: string;
    holdDetail?: boolean;
    mismatchHistory?: boolean;
    mismatchStage?: boolean;
  } = {},
) {
  let failedOnce = false;
  const payloads: Record<string, unknown> = JSON.parse(
    JSON.stringify(responses()),
  ) as Record<string, unknown>;
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
      if (path === detailPath && options.mismatchStage && value) {
        value = { ...(value as object), currentStageKey: 'DEAN' };
      }
      if (!value) throw new Error(`Unexpected API request: ${path}`);
      return decode(value);
    },
  );
  const post = vi.fn(
    async (
      _path: string,
      body: unknown,
      decode: (value: unknown) => unknown,
    ) => {
      const action = (body as { action?: string }).action;
      const targetReturnRole = (body as { targetReturnRole?: string })
        .targetReturnRole;
      const targetStage =
        action === 'SETTLE'
          ? 'SETTLED'
          : action === 'APPROVE_PAYOUT'
            ? 'ASSISTANT_BURSAR'
            : action === 'REJECT_RETURN'
              ? targetReturnRole === 'HOD'
                ? 'HEAD_OF_DEPARTMENT'
                : 'LECTURER_CORRECTION'
              : 'DEAN';
      const status =
        action === 'SETTLE'
          ? 'SETTLED'
          : action === 'REJECT_RETURN'
            ? 'RETURNED_FOR_CORRECTION'
            : 'UNDER_REVIEW';
      const result = decode({
        id: syntheticOfficerReview.id,
        trackingNumber: syntheticOfficerReview.trackingNumber,
        status,
        currentStageKey: targetStage,
      });
      const detail = payloads[detailPath] as Record<string, unknown>;
      detail.currentStageKey = targetStage;
      detail.status = status;
      const tracking = payloads[trackingPath] as Record<string, unknown>;
      tracking.status = status;
      if (action === 'APPROVE' || action === 'REJECT_RETURN') {
        const returned = action === 'REJECT_RETURN';
        tracking.currentStage = {
          key: targetStage,
          name:
            targetStage === 'DEAN'
              ? 'Dean approval'
              : targetStage === 'HEAD_OF_DEPARTMENT'
                ? 'Head of Department review'
                : 'Lecturer correction',
          order: targetStage === 'DEAN' ? 2 : 1,
          assignedRole:
            targetStage === 'DEAN'
              ? 'DEAN'
              : targetStage === 'HEAD_OF_DEPARTMENT'
                ? 'HOD'
                : 'LECTURER',
        };
        tracking.stages = (
          tracking.stages as Array<Record<string, unknown>>
        ).map((stage) => ({
          ...stage,
          status: returned
            ? stage.key === 'HEAD_OF_DEPARTMENT'
              ? 'RETURNED'
              : stage.status
            : stage.key === 'HEAD_OF_DEPARTMENT'
              ? 'APPROVED'
              : stage.key === 'DEAN'
                ? 'IN_PROGRESS'
                : stage.status,
        }));
      }
      return result;
    },
  );
  const client = {
    get,
    post,
    downloadDocument: vi.fn(),
  } as unknown as ApiClient;
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
  return Object.assign(get, { post });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('Officer Claim Review', () => {
  it('posts an authenticated approval only after confirmation and refreshes server state', async () => {
    const get = renderReviewPage();
    expect(await screen.findByText('Dr. Asha Example')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Approve' }));
    expect(get.post).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Confirm approval' }));
    await waitFor(() =>
      expect(get.post).toHaveBeenCalledWith(
        '/requests/' + requestId + '/actions',
        { action: 'APPROVE' },
        expect.any(Function),
      ),
    );
    expect(
      await screen.findByText(
        'Approval was recorded by the server. Review data is refreshing.',
      ),
    ).toBeVisible();
    expect(
      await screen.findByText(
        'No decision action is available for this role, request status, and active workflow stage.',
      ),
    ).toBeVisible();
  });
  it('posts a return with required comments and confirms the backend correction route', async () => {
    const user = userEvent.setup();
    const get = renderReviewPage();
    expect(await screen.findByText('Dr. Asha Example')).toBeVisible();

    await user.click(
      screen.getByRole('button', { name: 'Return for correction' }),
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: /Section requiring correction/ }),
      'PAPER_DETAILS',
    );
    await user.type(
      screen.getByRole('textbox', { name: /Required correction/ }),
      'Confirm the script marking quantity.',
    );
    await user.click(screen.getByRole('button', { name: 'Confirm Return' }));

    await waitFor(() =>
      expect(get.post).toHaveBeenCalledWith(
        '/requests/' + requestId + '/actions',
        {
          action: 'REJECT_RETURN',
          comments:
            'Paper setting & marking details: Confirm the script marking quantity.',
          targetReturnRole: 'LECTURER',
        },
        expect.any(Function),
      ),
    );
    expect(
      await screen.findByText(
        'The claim was returned for correction to the lecturer.',
      ),
    ).toBeVisible();
    expect(
      await screen.findByText(
        'No decision action is available for this role, request status, and active workflow stage.',
      ),
    ).toBeVisible();
  });
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
      [
        '/auth/me',
        detailPath,
        trackingPath,
        historyPath,
        paperStructurePath,
      ].sort(),
    );
    expect(screen.getByRole('button', { name: 'Approve' })).toBeVisible();
    expect(screen.queryByRole('button', { name: /reject/i })).toBeNull();
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

  it('rejects detail data whose active stage differs from tracking', async () => {
    renderReviewPage(hod, { mismatchStage: true });
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
