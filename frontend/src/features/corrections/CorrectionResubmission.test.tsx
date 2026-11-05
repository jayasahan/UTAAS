import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { SessionContext } from '../../auth/session';
import { createApiClient } from '../../services/apiClient';
import type { RequestDetail } from '../requests/contracts';
import { PaperMarkingClaimPage } from '../paper-marking/PaperMarkingClaimPage';
import { academicOptionsFixture } from '../../test/academicOptionsFixture';

const requestId = '7b5b9f20-8d1d-4d3c-8e59-17e252c81401';
const apiBase = 'https://api.example.test/api/v1';

function originalFormData() {
  return {
    personal: {
      fullName: 'Lecturer Name',
      designation: 'Senior Lecturer',
      department: 'Engineering',
      staffId: 'ENG-100',
      referenceTitle: 'Semester 1 claim',
    },
    metadata: {
      academicYear: '2026',
      semester: '1',
      degreeProgramme: 'BSc Engineering',
      courseCode: 'EC5060',
      courseTitle: 'Software Engineering',
      examType: 'Final',
      examinerRole: 'Chief Examiner',
    },
    papers: [
      {
        id: 'row-one',
        title: 'Paper One',
        durationHours: 3,
        settingCount: 1,
        moderationCount: 1,
        translationCount: 0,
        scriptCount: 40,
        secondMarkingCount: 2,
        assessmentUnit: 'hours',
        assessmentQuantity: 1.5,
      },
      {
        id: 'row-two',
        title: 'Paper Two',
        durationHours: 2,
        settingCount: 1,
        moderationCount: 0,
        translationCount: 1,
        scriptCount: 25,
        secondMarkingCount: 0,
        assessmentUnit: 'candidates',
        assessmentQuantity: 10,
      },
    ],
    supportingDocuments: [
      {
        name: 'appointment.pdf',
        url: '/api/v1/requests/documents/lecturer__appointment.pdf',
        documentType: 'APPOINTMENT_LETTER',
        size: 1024,
      },
    ],
    selectedDocumentCategory: 'EXAM_TIMETABLE',
    comments: 'Original application note',
    declaration: true,
  };
}

const baseDetail: RequestDetail = {
  id: requestId,
  trackingNumber: 'UT-2026-0042',
  status: 'RETURNED_FOR_CORRECTION',
  currentStageKey: 'LECTURER_CORRECTION',
  totalAmount: 24500,
  formData: originalFormData(),
  applicant: {
    fullName: 'Lecturer Name',
    department: { name: 'Engineering', code: 'ENG' },
  },
  createdAt: '2026-10-20T10:00:00.000Z',
};

const tracking = {
  trackingNumber: 'UT-2026-0042',
  requestType: 'Paper Setting & Marking Claim',
  status: 'RETURNED_FOR_CORRECTION',
  totalAmount: 24500,
  returningOfficerId: 'officer-1',
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
      actorName: 'Reviewer',
      enteredAt: '2026-10-20T10:00:00.000Z',
      completedAt: '2026-10-21T10:00:00.000Z',
      comments: 'Please verify the assessment quantity.',
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
      actorName: 'Reviewer',
      actorRole: 'HOD',
      previousStatus: 'UNDER_REVIEW',
      newStatus: 'RETURNED_FOR_CORRECTION',
      comment: 'Please verify the assessment quantity.',
      fieldDiff: null,
      createdAt: '2026-10-21T10:00:00.000Z',
    },
  ],
};

function response(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function backend(
  options: {
    role?: string;
    formData?: Record<string, unknown>;
    detailStatus?: number;
    initialStatus?: RequestDetail['status'];
    staleOnPreflight?: boolean;
    actionStatus?: number;
    actionGate?: Promise<void>;
    commitThenDropResponse?: boolean;
  } = {},
) {
  let current: RequestDetail = {
    ...baseDetail,
    ...(options.formData ? { formData: options.formData } : {}),
    ...(options.initialStatus ? { status: options.initialStatus } : {}),
  };
  let commitsThenDrops = options.commitThenDropResponse ?? false;
  let detailReads = 0;
  const fetcher = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      const method = init?.method ?? 'GET';
      if (url.pathname.endsWith('/auth/me'))
        return response({
          id: 'lecturer-1',
          email: 'lecturer@example.test',
          fullName: 'Lecturer Name',
          role: options.role ?? 'LECTURER',
          departmentCode: 'ENG',
          departmentId: 'department-1',
        });
      if (url.pathname.endsWith('/requests/paper-marking/rates/circular'))
        return response({ circularReference: 'MERGED-CIRCULAR', rates: {} });
      if (
        url.pathname.endsWith('/requests/paper-marking/options/form-dropdowns')
      )
        return response({
          ...academicOptionsFixture,
          courseModules: [
            {
              code: 'EC5060',
              title: 'Software Engineering',
              departmentCode: 'ENG',
              semester: 1,
            },
          ],
        });
      if (url.pathname.endsWith('/requests/paper-marking/paper-structure'))
        return response({
          exists: false,
          message: 'No registered structure yet.',
        });
      if (url.pathname === `/api/v1/requests/paper-marking/${requestId}`) {
        if (options.detailStatus)
          return response({ message: 'private' }, options.detailStatus);
        detailReads += 1;
        if (options.staleOnPreflight && detailReads > 1)
          current = {
            ...current,
            status: 'UNDER_REVIEW',
            currentStageKey: 'HEAD_OF_DEPARTMENT',
          };
        return response(current);
      }
      if (url.pathname === `/api/v1/requests/${requestId}/tracking`)
        return response(tracking);
      if (url.pathname === `/api/v1/requests/${requestId}/history`)
        return response(history);
      if (
        method === 'POST' &&
        url.pathname === '/api/v1/requests/paper-marking/draft'
      ) {
        expect(url.searchParams.get('draftId')).toBe(requestId);
        const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
        current = { ...current, formData: body };
        return response(current);
      }
      if (
        method === 'POST' &&
        url.pathname === `/api/v1/requests/${requestId}/actions`
      ) {
        const body = JSON.parse(String(init?.body)) as {
          action: string;
          updatedFormData: Record<string, unknown>;
        };
        if (body.action !== 'RESUBMIT')
          return response({ message: 'invalid action' }, 400);
        if (options.actionStatus)
          return response(
            { message: 'Workflow action rejected' },
            options.actionStatus,
          );
        if (options.actionGate) await options.actionGate;
        current = {
          ...current,
          status: 'UNDER_REVIEW',
          currentStageKey: 'HEAD_OF_DEPARTMENT',
          totalAmount: 27900,
          formData: body.updatedFormData,
        };
        if (commitsThenDrops) {
          commitsThenDrops = false;
          throw new TypeError('connection closed after response was committed');
        }
        return response(current);
      }
      return response({ message: 'unexpected request' }, 500);
    },
  );
  vi.stubGlobal('fetch', fetcher);
  const client = createApiClient(
    apiBase,
    () => 'memory-only-test-token',
    vi.fn(),
  );
  return { client, fetcher };
}

function RequestDestination() {
  const { requestId: id = '' } = useParams();
  return <p role="status">Request destination: {id}</p>;
}

function renderCorrection(client: ReturnType<typeof backend>['client']) {
  return render(
    <SessionContext.Provider
      value={{ status: 'authenticated', message: '', client, version: 1 }}
    >
      <MemoryRouter
        initialEntries={[`/requests/new?correctionId=${requestId}`]}
      >
        <Routes>
          <Route path="/requests/new" element={<PaperMarkingClaimPage />} />
          <Route path="/requests/:requestId" element={<RequestDestination />} />
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  );
}

async function openReview(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('button', { name: 'Continue →' }));
  await user.click(screen.getByRole('button', { name: 'Continue →' }));
  await screen.findByRole('heading', {
    name: 'Uploaded supporting documents (1)',
  });
  await user.click(
    screen.getByRole('button', { name: 'Review application →' }),
  );
  await screen.findByText(/appointment\.pdf/);
  expect(
    await screen.findByRole('heading', {
      name: 'Review corrections & resubmit',
    }),
  ).toBeVisible();
}

afterEach(() => vi.unstubAllGlobals());

describe('lecturer correction and resubmission workflow', () => {
  it('refreshes paper quotas after correction saves and server-rejected resubmissions', async () => {
    const user = userEvent.setup({ delay: null });
    const { client, fetcher } = backend({ actionStatus: 400 });
    renderCorrection(client);
    await screen.findByDisplayValue('Lecturer Name');
    const queries = () =>
      fetcher.mock.calls.filter(([input]) =>
        new URL(String(input)).pathname.endsWith('/paper-structure'),
      ).length;
    await waitFor(() => expect(queries()).toBe(1));
    await user.click(screen.getByRole('button', { name: 'Save corrections' }));
    await screen.findByText(/Corrections saved to UT-2026-0042/);
    await waitFor(() => expect(queries()).toBe(2));
    await openReview(user);
    await user.click(screen.getByRole('button', { name: 'Review & Resubmit' }));
    await user.click(
      screen.getByRole('button', { name: 'Confirm resubmission' }),
    );
    expect(await screen.findByText('Workflow action rejected')).toBeVisible();
    await waitFor(() => expect(queries()).toBe(3));
    expect(
      screen.queryByText(`Request destination: ${requestId}`),
    ).not.toBeInTheDocument();
  });
  it('loads the returned lecturer-owned snapshot only after profile verification', async () => {
    const user = userEvent.setup({ delay: null });
    const { fetcher, client } = backend();
    renderCorrection(client);

    expect(
      await screen.findByRole('heading', {
        name: 'Application Detail & Correction',
      }),
    ).toBeVisible();
    expect(screen.getByDisplayValue('Lecturer Name')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Continue →' }));
    expect(screen.getByDisplayValue('Paper One')).toBeVisible();
    expect(screen.getByDisplayValue('Paper Two')).toBeVisible();
    expect(
      screen.getByText('Please verify the assessment quantity.'),
    ).toBeVisible();
    expect(
      fetcher.mock.calls.some(([input]) =>
        String(input).endsWith(`/requests/paper-marking/${requestId}`),
      ),
    ).toBe(true);
    for (const [, init] of fetcher.mock.calls) {
      expect(new Headers(init?.headers).get('Authorization')).toBe(
        'Bearer memory-only-test-token',
      );
      expect(init?.credentials).toBe('omit');
    }
  });

  it('blocks non-lecturer roles before request-specific detail is fetched', async () => {
    const { fetcher, client } = backend({ role: 'HOD' });
    renderCorrection(client);

    expect(
      await screen.findByText(
        'Only the authenticated lecturer can edit this returned application.',
      ),
    ).toBeVisible();
    expect(
      fetcher.mock.calls.some(([input]) =>
        String(input).endsWith(`/requests/paper-marking/${requestId}`),
      ),
    ).toBe(false);
    expect(screen.queryByDisplayValue('Paper One')).not.toBeInTheDocument();
  });

  it.each([401, 403, 404])(
    'does not expose correction fields when the detail endpoint returns %i',
    async (detailStatus) => {
      const { fetcher, client } = backend({ detailStatus });
      renderCorrection(client);

      expect(
        await screen.findByRole('heading', { name: 'Correction unavailable' }),
      ).toBeVisible();
      expect(screen.queryByDisplayValue('Paper One')).not.toBeInTheDocument();
      expect(
        fetcher.mock.calls.some(([, init]) => init?.method === 'POST'),
      ).toBe(false);
    },
  );

  it('does not open editing for a request that is no longer returned', async () => {
    const { fetcher, client } = backend({ initialStatus: 'APPROVED' });
    renderCorrection(client);

    expect(
      await screen.findByText(/no longer awaiting lecturer corrections/i),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Save corrections' }),
    ).not.toBeInTheDocument();
    expect(fetcher.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(
      false,
    );
  });

  it('saves a full correction snapshot to the same request without creating a new draft', async () => {
    const user = userEvent.setup({ delay: null });
    const { fetcher, client } = backend();
    renderCorrection(client);
    await screen.findByDisplayValue('Lecturer Name');

    await user.click(screen.getByRole('button', { name: 'Save corrections' }));
    expect(
      await screen.findByText(/Corrections saved to UT-2026-0042/),
    ).toBeVisible();

    const saveCall = fetcher.mock.calls.find(
      ([input, init]) =>
        String(input).includes('/requests/paper-marking/draft') &&
        init?.method === 'POST',
    );
    expect(saveCall).toBeDefined();
    const saveUrl = new URL(String(saveCall?.[0]));
    expect(saveUrl.searchParams.get('draftId')).toBe(requestId);
    const payload = JSON.parse(String(saveCall?.[1]?.body)) as Record<
      string,
      unknown
    >;
    expect(payload.papers).toHaveLength(2);
    expect(payload.supportingDocuments).toHaveLength(1);
    expect(payload.selectedDocumentCategory).toBe('EXAM_TIMETABLE');
    expect(payload.comments).toBe('Original application note');
    expect(payload).not.toHaveProperty('items');
    expect(
      fetcher.mock.calls.some(
        ([, init]) =>
          init?.method === 'POST' && String(init.body).includes('RESUBMIT'),
      ),
    ).toBe(false);
    expect(
      fetcher.mock.calls.some(([input]) =>
        String(input).endsWith('/requests/paper-marking/submit'),
      ),
    ).toBe(false);
  });

  it('confirms and resubmits the same request with all paper rows and server-confirmed totals', async () => {
    const user = userEvent.setup({ delay: null });
    const { fetcher, client } = backend();
    renderCorrection(client);
    await screen.findByDisplayValue('Lecturer Name');
    await openReview(user);
    await user.click(screen.getByRole('button', { name: 'Review & Resubmit' }));
    expect(
      screen.getByRole('dialog', {
        name: 'Confirm correction and resubmission',
      }),
    ).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Confirm resubmission' }),
    );

    expect(
      await screen.findByText(`Request destination: ${requestId}`),
    ).toBeVisible();
    const actionCall = fetcher.mock.calls.find(
      ([input, init]) =>
        String(input).endsWith(`/requests/${requestId}/actions`) &&
        init?.method === 'POST',
    );
    expect(actionCall).toBeDefined();
    const payload = JSON.parse(String(actionCall?.[1]?.body)) as {
      action: string;
      updatedFormData: { papers: unknown[]; supportingDocuments: unknown[] };
    };
    expect(payload.action).toBe('RESUBMIT');
    expect(payload.updatedFormData.papers).toHaveLength(2);
    expect(payload.updatedFormData.supportingDocuments).toHaveLength(1);
    expect(
      fetcher.mock.calls.some(([input]) =>
        String(input).endsWith('/requests/paper-marking/submit'),
      ),
    ).toBe(false);
  });

  it('checks server status after an ambiguous response instead of repeating resubmission', async () => {
    const user = userEvent.setup({ delay: null });
    const { fetcher, client } = backend({ commitThenDropResponse: true });
    renderCorrection(client);
    await screen.findByDisplayValue('Lecturer Name');
    await openReview(user);
    await user.click(screen.getByRole('button', { name: 'Review & Resubmit' }));
    await user.click(
      screen.getByRole('button', { name: 'Confirm resubmission' }),
    );

    expect(
      await screen.findByText(/outcome could not be confirmed/i),
    ).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Check request status' }),
    );
    expect(
      await screen.findByText(`Request destination: ${requestId}`),
    ).toBeVisible();
    expect(
      fetcher.mock.calls.filter(
        ([input, init]) =>
          String(input).endsWith(`/requests/${requestId}/actions`) &&
          init?.method === 'POST',
      ),
    ).toHaveLength(1);
  });

  it('blocks a stale request before sending the workflow action', async () => {
    const user = userEvent.setup({ delay: null });
    const { fetcher, client } = backend({ staleOnPreflight: true });
    renderCorrection(client);
    await screen.findByDisplayValue('Lecturer Name');
    await openReview(user);
    await user.click(screen.getByRole('button', { name: 'Review & Resubmit' }));
    await user.click(
      screen.getByRole('button', { name: 'Confirm resubmission' }),
    );

    expect(
      await screen.findByText(
        /did not confirm the expected request, status, and workflow stage/i,
      ),
    ).toBeVisible();
    expect(
      fetcher.mock.calls.some(
        ([input, init]) =>
          String(input).endsWith(`/requests/${requestId}/actions`) &&
          init?.method === 'POST',
      ),
    ).toBe(false);
  });

  it.each([401, 403, 404, 409])(
    'does not claim success or auto-retry when resubmission returns %i',
    async (actionStatus) => {
      const user = userEvent.setup({ delay: null });
      const { fetcher, client } = backend({ actionStatus });
      renderCorrection(client);
      await screen.findByDisplayValue('Lecturer Name');
      await openReview(user);
      await user.click(
        screen.getByRole('button', { name: 'Review & Resubmit' }),
      );
      await user.click(
        screen.getByRole('button', { name: 'Confirm resubmission' }),
      );

      const expectedError: Record<number, RegExp> = {
        401: /Authentication is required or the session is no longer valid/i,
        403: /This account is not permitted to access this resource/i,
        404: /The requested information is unavailable/i,
        409: /outcome could not be confirmed/i,
      };
      expect(
        await screen.findByText(expectedError[actionStatus]!),
      ).toBeVisible();
      expect(
        screen.queryByText(`Request destination: ${requestId}`),
      ).not.toBeInTheDocument();
      expect(
        fetcher.mock.calls.filter(
          ([input, init]) =>
            String(input).endsWith(`/requests/${requestId}/actions`) &&
            init?.method === 'POST',
        ),
      ).toHaveLength(1);
    },
  );

  it('prevents a second action while resubmission is pending', async () => {
    const user = userEvent.setup({ delay: null });
    let releaseAction: () => void = () => {};
    const actionGate = new Promise<void>((resolve) => {
      releaseAction = resolve;
    });
    const { fetcher, client } = backend({ actionGate });
    renderCorrection(client);
    await screen.findByDisplayValue('Lecturer Name');
    await openReview(user);
    await user.click(screen.getByRole('button', { name: 'Review & Resubmit' }));
    const confirm = screen.getByRole('button', {
      name: 'Confirm resubmission',
    });
    await user.click(confirm);
    await user.click(confirm);

    expect(
      fetcher.mock.calls.filter(
        ([input, init]) =>
          String(input).endsWith(`/requests/${requestId}/actions`) &&
          init?.method === 'POST',
      ),
    ).toHaveLength(1);
    releaseAction();
    expect(
      await screen.findByText(`Request destination: ${requestId}`),
    ).toBeVisible();
  });

  it('keeps aggregate-only correction data unavailable', async () => {
    const aggregateOnly = originalFormData() as Record<string, unknown>;
    delete aggregateOnly.papers;
    aggregateOnly.items = { scriptMarkingCount: 65 };
    const aggregateBackend = backend({ formData: aggregateOnly });
    renderCorrection(aggregateBackend.client);
    expect(
      await screen.findByText(
        /Aggregate quantities cannot be reconstructed safely/i,
      ),
    ).toBeVisible();
    expect(screen.queryByDisplayValue('Lecturer Name')).not.toBeInTheDocument();
  });
});
