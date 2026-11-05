import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SessionContext } from '../../auth/session';
import { createApiClient } from '../../services/apiClient';
import { RequestDetailPage } from '../../pages/RequestDetailPage';
import { DashboardPage } from '../../pages/DashboardPage';
import { consensusFixture } from '../../test/consensusFixture';
import { LecturerProportionAgreement } from './LecturerProportionAgreement';

function backend(
  options: {
    existing?: boolean;
    completed?: boolean;
    completeOnAgree?: boolean;
    lookupStatus?: number;
    postStatus?: number;
    message?: unknown;
    dropAfterCommit?: boolean;
    dropBeforeCommit?: boolean;
    malformedResult?: boolean;
    postGate?: Promise<void>;
    preflightGate?: Promise<void>;
    noProposal?: boolean;
    foreignLookup?: boolean;
    actorRole?: 'HOD';
  } = {},
) {
  const fixture = consensusFixture();
  if (options.existing || options.completed)
    fixture.structure.hodProportionDivision.responses.push({
      lecturerId: fixture.viewer.id,
      lecturerName: fixture.viewer.fullName,
      agreed: true,
      comments: '',
      respondedAt: '2026-11-01T10:00:00.000Z',
    });
  if (options.completed)
    fixture.structure.hodProportionDivision.status = 'CONSENSUS_REACHED';
  const refresh = vi.fn();
  let detailReads = 0;
  const fetcher = vi.fn(
    async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      const path = url.pathname;
      const ok = (data: unknown, status = 200) =>
        new Response(JSON.stringify(data), { status });
      if (path.endsWith('/auth/me'))
        return ok({
          ...fixture.viewer,
          role: options.actorRole ?? fixture.viewer.role,
        });
      if (path.endsWith('/paper-structure')) {
        if (options.lookupStatus)
          return ok({ message: 'Lookup denied' }, options.lookupStatus);
        expect(Object.fromEntries(url.searchParams)).toEqual(fixture.exam);
        if (options.noProposal)
          return ok({ exists: false, message: 'Not registered' });
        return ok({
          exists: true,
          paperStructure: options.foreignLookup
            ? { ...fixture.structure, courseCode: 'EC5070' }
            : fixture.structure,
          hodProportionDivision: fixture.structure.hodProportionDivision,
        });
      }
      if (path.endsWith(`/paper-marking/${fixture.detail.id}`)) {
        detailReads += 1;
        if (options.preflightGate) await options.preflightGate;
        return ok(fixture.detail);
      }
      if (path.endsWith('/my-requests'))
        return ok({
          data: [
            {
              ...fixture.detail,
              requestType: 'Paper Marking',
              metadata: fixture.exam,
            },
          ],
          meta: { total: 1, page: 1, limit: 5, totalPages: 1 },
        });
      if (path.endsWith('/tracking'))
        return ok({
          trackingNumber: fixture.detail.trackingNumber,
          requestType: 'Paper Marking',
          status: fixture.detail.status,
          totalAmount: fixture.detail.totalAmount,
          returningOfficerId: null,
          currentStage: {
            key: fixture.detail.currentStageKey,
            name: 'Old submission stage',
            order: 0,
            assignedRole: 'LECTURER',
          },
          stages: [],
        });
      if (path.endsWith('/history'))
        return ok({
          requestId: fixture.detail.id,
          trackingNumber: fixture.detail.trackingNumber,
          events:
            fixture.structure.hodProportionDivision.status ===
            'CONSENSUS_REACHED'
              ? [
                  {
                    id: 'completed',
                    actionType: 'PROPORTION_CONSENSUS_REACHED',
                    actorName: fixture.viewer.fullName,
                    actorRole: 'LECTURER',
                    previousStatus: 'UNDER_REVIEW',
                    newStatus: 'UNDER_REVIEW',
                    comment: 'Consensus recorded by the server',
                    fieldDiff: { agreedWeights: { essay: 60, mcq: 40 } },
                    createdAt: '2026-11-01T10:00:00.000Z',
                  },
                ]
              : [],
        });
      if (path.endsWith('/proportion-consensus') && init?.method === 'POST') {
        if (options.postGate) await options.postGate;
        if (options.postStatus)
          return ok(
            { message: options.message ?? 'Consensus response rejected' },
            options.postStatus,
          );
        if (options.dropBeforeCommit) throw new TypeError('Connection lost');
        const body = JSON.parse(String(init.body)) as {
          agreed: boolean;
          comments?: string;
        };
        const response = {
          lecturerId: fixture.viewer.id,
          lecturerName: fixture.viewer.fullName,
          agreed: body.agreed,
          comments: body.comments ?? '',
          respondedAt: '2026-11-01T12:00:00.000Z',
        };
        fixture.structure.hodProportionDivision.responses = [response];
        const status = !body.agreed
          ? 'DISAGREED_RETURNED_TO_HOD'
          : options.completeOnAgree
            ? 'CONSENSUS_REACHED'
            : 'AWAITING_OTHER_EXAMINERS';
        if (status !== 'AWAITING_OTHER_EXAMINERS') {
          fixture.structure.hodProportionDivision.status = status;
          fixture.detail.currentStageKey = 'HEAD_OF_DEPARTMENT';
          fixture.detail.formData.hodProportionDivision = structuredClone(
            fixture.structure.hodProportionDivision,
          );
        }
        if (options.dropAfterCommit)
          throw new TypeError('Response lost after commit');
        if (options.malformedResult)
          return ok({ status, message: 'Recorded', paperStructure: {} });
        return ok(
          {
            status,
            message: body.agreed
              ? 'Your agreement was recorded.'
              : 'Your disagreement was recorded.',
            paperStructure: fixture.structure,
          },
          201,
        );
      }
      throw new Error(`Unexpected request ${path}`);
    },
  );
  vi.stubGlobal('fetch', fetcher);
  const client = createApiClient(
    'https://api.example.test/api/v1',
    () => 'test-token',
    vi.fn(),
  );
  const session = {
    status: 'authenticated' as const,
    message: '',
    version: 1,
    client,
  };
  const posts = () =>
    fetcher.mock.calls.filter(([, init]) => init?.method === 'POST');
  return {
    ...fixture,
    session,
    fetcher,
    refresh,
    posts,
    detailReads: () => detailReads,
  };
}
function open(setup: ReturnType<typeof backend>, page = false) {
  return render(
    <SessionContext.Provider value={setup.session}>
      <MemoryRouter initialEntries={[`/requests/${setup.detail.id}`]}>
        {page ? (
          <Routes>
            <Route
              path="/requests/:requestId"
              element={<RequestDetailPage />}
            />
          </Routes>
        ) : (
          <LecturerProportionAgreement
            detail={setup.detail}
            viewer={setup.viewer}
            onRefresh={setup.refresh}
          />
        )}
      </MemoryRouter>
    </SessionContext.Provider>,
  );
}
async function ready() {
  return screen.findByRole('button', { name: 'Agree' });
}
afterEach(() => vi.unstubAllGlobals());

describe('lecturer proportion agreement', () => {
  it('shows an empty state for a missing registration without exposing response controls', async () => {
    const setup = backend({ noProposal: true });
    open(setup);
    expect(await screen.findByText('No current HOD proposal')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Agree' }),
    ).not.toBeInTheDocument();
    expect(setup.posts()).toHaveLength(0);
  });
  it('rejects a lookup for a different examination', async () => {
    const setup = backend({ foreignLookup: true });
    open(setup);
    expect(
      await screen.findByText('The proposal does not match this examination.'),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Agree' }),
    ).not.toBeInTheDocument();
  });
  it('keeps incomplete examination metadata read-only', () => {
    const setup = backend();
    setup.detail.formData.metadata = {};
    open(setup);
    expect(
      screen.getByText('Examination details are incomplete'),
    ).toBeVisible();
    expect(setup.fetcher).not.toHaveBeenCalled();
  });
  it('does not mutate when existing response records were omitted from the lookup', async () => {
    const setup = backend();
    (
      setup.structure.hodProportionDivision as unknown as Record<
        string,
        unknown
      >
    ).responses = undefined;
    open(setup);
    expect(
      await screen.findByText('Recorded responses are unavailable'),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Agree' }),
    ).not.toBeInTheDocument();
    expect(setup.posts()).toHaveLength(0);
  });
  it('rechecks the acting lecturer identity before any POST', async () => {
    const setup = backend({ actorRole: 'HOD' });
    open(setup);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Agree' }));
    expect(
      await screen.findByText(
        'The signed-in lecturer changed. Refresh your account before responding.',
      ),
    ).toBeVisible();
    expect(setup.posts()).toHaveLength(0);
    expect(
      screen.queryByRole('button', { name: 'Agree' }),
    ).not.toBeInTheDocument();
  });
  it('closes explicit revision controls after success even when the server response timestamp is unchanged', async () => {
    const setup = backend({ existing: true });
    setup.structure.hodProportionDivision.responses[0]!.respondedAt =
      '2026-11-01T12:00:00.000Z';
    open(setup);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Change response' }),
    );
    fireEvent.click(await ready());
    expect(await screen.findByText('Agreement submitted')).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Agree' }),
    ).not.toBeInTheDocument();
    expect(setup.posts()).toHaveLength(1);
  });
  it('rejects stale disagreement text when the proposal changes before submission', async () => {
    const setup = backend();
    open(setup);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Disagree' }));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'Feedback about the previous proposal' },
    });
    setup.structure.hodProportionDivision.setAt = '2026-11-02T09:00:00.000Z';
    fireEvent.click(
      screen.getByRole('button', { name: 'Submit disagreement' }),
    );
    expect(await screen.findByText('Proposal changed or reset')).toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(setup.posts()).toHaveLength(0);
  });
  it('requires reconciliation after a server error rather than automatically retrying a POST', async () => {
    const setup = backend({ postStatus: 500 });
    open(setup);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Agree' }));
    expect(
      await screen.findByText('Response confirmation required'),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Agree' }),
    ).not.toBeInTheDocument();
    expect(setup.posts()).toHaveLength(1);
  });
  it('shows the authoritative HOD proposal using Feature 11 and sends only verified DTO fields', async () => {
    const user = userEvent.setup({ delay: null });
    const setup = backend();
    open(setup);
    await ready();
    expect(screen.getByText('Recorded HOD')).toBeVisible();
    expect(screen.getByText('HOD proposal remarks')).toBeVisible();
    expect(
      screen.getByText('Proposed essay weight (%)').parentElement,
    ).toHaveTextContent('60');
    expect(
      screen.getByText('Proposed MCQ weight (%)').parentElement,
    ).toHaveTextContent('40');
    await user.click(screen.getByRole('button', { name: 'Agree' }));
    expect(await screen.findByText('Agreement submitted')).toBeVisible();
    expect(screen.getByText(/Waiting for other lecturers/)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Agree' }),
    ).not.toBeInTheDocument();
    expect(setup.posts()).toHaveLength(1);
    expect(JSON.parse(String(setup.posts()[0]![1]!.body))).toEqual({
      ...setup.exam,
      agreed: true,
    });
    expect(setup.refresh).toHaveBeenCalledOnce();
    expect(
      (setup.detail.formData.hodProportionDivision as { responses: unknown[] })
        .responses,
    ).toHaveLength(0);
    expect(
      await screen.findByText('Your agreement is already recorded.'),
    ).toBeVisible();
  });
  it.each(['', '   ', '!!!', 'ab'])(
    'rejects a meaningless disagreement comment %j without POST',
    async (comment) => {
      const setup = backend();
      open(setup);
      await ready();
      fireEvent.click(screen.getByRole('button', { name: 'Disagree' }));
      fireEvent.change(
        screen.getByRole('textbox', { name: /Reason for disagreement/ }),
        { target: { value: comment } },
      );
      fireEvent.click(
        screen.getByRole('button', { name: 'Submit disagreement' }),
      );
      expect(
        await screen.findByText(
          'Explain your disagreement using at least 3 letters or numbers.',
        ),
      ).toBeVisible();
      expect(screen.getByRole('textbox')).toHaveFocus();
      expect(setup.posts()).toHaveLength(0);
    },
  );
  it('submits a trimmed disagreement and refreshes the HOD stage without treating it as rejection', async () => {
    const user = userEvent.setup({ delay: null });
    const setup = backend();
    open(setup, true);
    await ready();
    await user.click(screen.getByRole('button', { name: 'Disagree' }));
    await user.type(
      screen.getByRole('textbox', { name: /Reason for disagreement/ }),
      '  Please increase essay weight.  ',
    );
    await user.click(
      screen.getByRole('button', { name: 'Submit disagreement' }),
    );
    expect(await screen.findByText('Disagreement submitted')).toBeVisible();
    expect(
      await screen.findByText('Current stage: Head of Department'),
    ).toBeVisible();
    expect(JSON.parse(String(setup.posts()[0]![1]!.body))).toEqual({
      ...setup.exam,
      agreed: false,
      comments: 'Please increase essay weight.',
    });
    expect(screen.queryByText('Rejected')).not.toBeInTheDocument();
  });
  it('requires explicit Change response for a previous response while the server permits revisions', async () => {
    const user = userEvent.setup({ delay: null });
    const setup = backend({ existing: true });
    open(setup);
    expect(
      await screen.findByText('Your agreement is already recorded.'),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Agree' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Change response' }));
    await ready();
    await user.click(screen.getByRole('button', { name: 'Agree' }));
    expect(await screen.findByText('Agreement submitted')).toBeVisible();
    expect(setup.posts()).toHaveLength(1);
  });
  it('makes completed consensus read-only even when the request snapshot is stale', async () => {
    const setup = backend({ completed: true });
    open(setup);
    expect(await screen.findByText(/Consensus is completed/)).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Agree' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Change response' }),
    ).not.toBeInTheDocument();
    expect(setup.posts()).toHaveLength(0);
  });
  it('refreshes request details, tracking and genuine history after completed consensus', async () => {
    const user = userEvent.setup({ delay: null });
    const setup = backend({ completeOnAgree: true });
    open(setup, true);
    await ready();
    await user.click(screen.getByRole('button', { name: 'Agree' }));
    expect(await screen.findByText('Agreement submitted')).toBeVisible();
    expect(await screen.findByText(/Consensus is completed/)).toBeVisible();
    expect(
      await screen.findByText('Current stage: Head of Department'),
    ).toBeVisible();
    expect(
      await screen.findByText('Proportion consensus completed'),
    ).toBeVisible();
    for (const suffix of ['/tracking', '/history'])
      expect(
        setup.fetcher.mock.calls.filter(([input]) =>
          String(input).endsWith(suffix),
        ).length,
      ).toBeGreaterThanOrEqual(2);
  });
  it.each([400, 401, 403])(
    'shows a definitive API %s rejection and does not claim success',
    async (postStatus) => {
      const setup = backend({
        postStatus,
        message: 'Your response cannot be accepted.',
      });
      open(setup);
      await ready();
      fireEvent.click(screen.getByRole('button', { name: 'Agree' }));
      expect(
        await screen.findByText('Response could not be submitted'),
      ).toBeVisible();
      expect(screen.queryByText('Agreement submitted')).not.toBeInTheDocument();
      if (postStatus === 400)
        expect(
          screen.getByText('Your response cannot be accepted.'),
        ).toBeVisible();
      else
        expect(
          screen.queryByRole('button', { name: 'Agree' }),
        ).not.toBeInTheDocument();
      expect(setup.posts()).toHaveLength(1);
    },
  );
  it('surfaces array validation messages and retains the comment for correction', async () => {
    const setup = backend({
      postStatus: 400,
      message: ['Invalid examination.', 'Review your feedback.'],
    });
    open(setup);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Disagree' }));
    fireEvent.change(screen.getByRole('textbox'), {
      target: { value: 'My requested change' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Submit disagreement' }),
    );
    expect(
      await screen.findByText('Invalid examination. Review your feedback.'),
    ).toBeVisible();
    expect(screen.getByRole('textbox')).toHaveValue('My requested change');
  });
  it('prevents duplicate POSTs from rapid clicks while a response is in flight', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const setup = backend({ postGate: gate });
    open(setup);
    const agree = await ready();
    fireEvent.click(agree);
    fireEvent.click(agree);
    await waitFor(() => expect(setup.posts()).toHaveLength(1));
    release();
    expect(await screen.findByText('Agreement submitted')).toBeVisible();
    expect(setup.posts()).toHaveLength(1);
  });
  it('detects a response recorded in another tab during preflight and never overwrites it silently', async () => {
    const setup = backend();
    open(setup);
    await ready();
    setup.structure.hodProportionDivision.responses.push({
      lecturerId: setup.viewer.id,
      agreed: true,
      comments: '',
      respondedAt: '2026-11-01T12:00:00.000Z',
    });
    fireEvent.click(screen.getByRole('button', { name: 'Agree' }));
    expect(
      await screen.findByText(/A response is already recorded/),
    ).toBeVisible();
    expect(
      screen.getByText('Your agreement is already recorded.'),
    ).toBeVisible();
    expect(setup.posts()).toHaveLength(0);
  });
  it('detects a reset before posting and presents the new proposal for review', async () => {
    const setup = backend();
    open(setup);
    await ready();
    setup.structure.hodProportionDivision.setAt = '2026-11-02T09:00:00.000Z';
    setup.structure.hodProportionDivision.essayWeightPercent = 70;
    setup.structure.hodProportionDivision.mcqWeightPercent = 30;
    fireEvent.click(screen.getByRole('button', { name: 'Agree' }));
    expect(await screen.findByText('Proposal changed or reset')).toBeVisible();
    expect(
      screen.getByText('Proposed essay weight (%)').parentElement,
    ).toHaveTextContent('70');
    expect(setup.posts()).toHaveLength(0);
  });
  it('does not apply a previous successful response to a newly reset proposal', async () => {
    const setup = backend();
    open(setup);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Agree' }));
    await screen.findByText('Your agreement is already recorded.');
    setup.structure.hodProportionDivision.setAt = '2026-11-02T09:00:00.000Z';
    setup.structure.hodProportionDivision.responses = [];
    fireEvent.click(screen.getByRole('button', { name: 'Refresh proposal' }));
    expect(await screen.findByText('Proposal changed or reset')).toBeVisible();
    expect(await ready()).toBeVisible();
    expect(screen.queryByText('Agreement submitted')).not.toBeInTheDocument();
  });
  it.each(['dropAfterCommit', 'malformedResult'] as const)(
    'reconciles an unknown %s outcome through a recorded-response check without a second POST',
    async (kind) => {
      const setup = backend({ [kind]: true });
      open(setup);
      await ready();
      fireEvent.click(screen.getByRole('button', { name: 'Agree' }));
      expect(
        await screen.findByText('Response confirmation required'),
      ).toBeVisible();
      expect(
        screen.queryByRole('button', { name: 'Agree' }),
      ).not.toBeInTheDocument();
      fireEvent.click(
        screen.getByRole('button', { name: 'Check recorded response' }),
      );
      expect(
        await screen.findByText(
          'Your response is confirmed in the current proposal record.',
        ),
      ).toBeVisible();
      expect(setup.posts()).toHaveLength(1);
    },
  );
  it('does not assume a failed network request was uncommitted or automatically resend it', async () => {
    const setup = backend({ dropBeforeCommit: true });
    open(setup);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Agree' }));
    await screen.findByText('Response confirmation required');
    fireEvent.click(
      screen.getByRole('button', { name: 'Check recorded response' }),
    );
    expect(
      await screen.findByText(/No matching recorded response can be confirmed/),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Agree' }),
    ).not.toBeInTheDocument();
    expect(setup.posts()).toHaveLength(1);
  });
  it.each(['HOD', 'ADMIN'] as const)(
    'does not expose lecturer controls or lookup requests to %s',
    async (role) => {
      const setup = backend();
      setup.viewer.role = role;
      open(setup);
      await waitFor(() =>
        expect(
          screen.queryByRole('button', { name: 'Agree' }),
        ).not.toBeInTheDocument(),
      );
      expect(setup.fetcher).not.toHaveBeenCalled();
    },
  );
  it.each(['DRAFT', 'REJECTED', 'SETTLED'] as const)(
    'keeps %s claims read-only',
    async (status) => {
      const setup = backend();
      setup.detail.status = status;
      open(setup);
      await waitFor(() =>
        expect(
          screen.queryByRole('button', { name: 'Agree' }),
        ).not.toBeInTheDocument(),
      );
      expect(setup.fetcher).not.toHaveBeenCalled();
    },
  );
  it('shows lookup errors instead of assuming a missing or available proposal', async () => {
    const setup = backend({ lookupStatus: 403 });
    open(setup);
    expect(
      await screen.findByText('Current proposal could not be loaded'),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Agree' }),
    ).not.toBeInTheDocument();
    expect(setup.posts()).toHaveLength(0);
  });
  it('stops preflight submission when its component is no longer active', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const setup = backend({ preflightGate: gate });
    const view = open(setup);
    await ready();
    fireEvent.click(screen.getByRole('button', { name: 'Agree' }));
    await waitFor(() => expect(setup.detailReads()).toBe(1));
    view.unmount();
    release();
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(setup.posts()).toHaveLength(0);
  });
  it('makes pending proposals discoverable from the existing dashboard request link', async () => {
    const setup = backend();
    render(
      <SessionContext.Provider value={setup.session}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </SessionContext.Provider>,
    );
    const link = await screen.findByRole('link', {
      name: /Review the HOD proportion proposal/,
    });
    expect(link).toHaveAttribute('href', `/requests/${setup.detail.id}`);
  });
});
