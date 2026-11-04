import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { SessionContext } from '../../../auth/session';
import { ApiError, type ApiClient } from '../../../services/apiClient';
import { RequestDetailPage } from '../../../pages/RequestDetailPage';
import { academicOptionsFixture } from '../../../test/academicOptionsFixture';
import { paperStructureFixture } from '../../../test/paperStructureFixture';
import { syntheticOfficerReview } from '../../officer-review/developmentFixture';
import { PaperMarkingClaimPage } from '../PaperMarkingClaimPage';

const sample = syntheticOfficerReview;
function draftData(settingCount = 0) {
  return {
    personal: {
      fullName: 'Lecturer',
      designation: 'Senior Lecturer',
      department: 'Engineering',
      staffId: 'STAFF-1',
      referenceTitle: 'Quota draft',
    },
    metadata: {
      courseCode: 'EC5060',
      academicYear: '2026',
      semester: '1',
      examType: 'Final',
      courseTitle: 'Software Engineering',
      degreeProgramme: 'BSc',
      examinerRole: 'First Examiner',
    },
    papers: [
      {
        id: 'row-1',
        title: 'EC5060 Software Engineering',
        durationHours: 3,
        settingCount,
        moderationCount: 0,
        translationCount: 0,
        scriptCount: 20,
        secondMarkingCount: 0,
        assessmentUnit: 'candidates',
        assessmentQuantity: 0,
      },
    ],
    supportingDocuments: [
      {
        name: 'appointment.pdf',
        url: '/api/v1/requests/documents/lecturer__appointment.pdf',
        documentType: 'APPOINTMENT_LETTER',
        size: 512,
      },
    ],
    declaration: true,
  };
}
function backend(
  options: {
    settingCount?: number;
    unregistered?: boolean;
    submitError?: boolean;
  } = {},
) {
  let submitted = false;
  let formData: unknown = draftData(options.settingCount);
  const detail = () => ({
    id: sample.id,
    trackingNumber: sample.trackingNumber,
    status: submitted ? 'UNDER_REVIEW' : 'DRAFT',
    currentStageKey: submitted ? 'HEAD_OF_DEPARTMENT' : 'DRAFT',
    totalAmount: 9876.54,
    createdAt: sample.submittedAt,
    formData,
  });
  const client: ApiClient = {
    get: vi.fn(async (path, decode, _signal, query) => {
      if (path === '/auth/me')
        return decode({
          id: 'me',
          fullName: 'Profile Name',
          email: 'lecturer@example.test',
          role: 'LECTURER',
          departmentCode: 'ENG',
          departmentId: 'dept-1',
        });
      if (path === '/requests/paper-marking/options/form-dropdowns')
        return decode({
          ...academicOptionsFixture,
          courseModules: academicOptionsFixture.courseModules.map((course) => ({
            ...course,
            semester: 1,
          })),
        });
      if (path.endsWith('/rates/circular'))
        return decode({ circularReference: 'TEST', rates: {} });
      if (path.endsWith('/paper-structure')) {
        if (options.unregistered && !submitted)
          return decode({
            exists: false,
            message: 'No examination structure is registered yet.',
          });
        const fixture = paperStructureFixture();
        return decode({
          ...fixture,
          paperStructure: { ...fixture.paperStructure, ...query },
        });
      }
      if (path === `/requests/paper-marking/${sample.id}`)
        return decode(detail());
      if (path.endsWith('/tracking')) return decode(sample.tracking);
      if (path.endsWith('/history')) return decode(sample.history);
      throw new Error(`Unexpected GET ${path}`);
    }),
    post: vi.fn(async (path, body, decode) => {
      if (path.endsWith('/submit') && options.submitError)
        throw new ApiError('server', 400, [
          'Paper Setting quota exceeded for EC5060. Other claims have changed.',
        ]);
      formData = body;
      if (path.endsWith('/submit')) submitted = true;
      return decode(detail());
    }),
    upload: vi.fn(),
  };
  return client;
}
function open(client: ApiClient) {
  render(
    <SessionContext.Provider
      value={{ status: 'authenticated', message: '', client, version: 1 }}
    >
      <MemoryRouter initialEntries={[`/requests/new?draftId=${sample.id}`]}>
        <Routes>
          <Route path="/requests/new" element={<PaperMarkingClaimPage />} />
          <Route path="/requests/:requestId" element={<RequestDetailPage />} />
        </Routes>
      </MemoryRouter>
    </SessionContext.Provider>,
  );
}
async function payment(user: ReturnType<typeof userEvent.setup>) {
  await screen.findByDisplayValue('Lecturer');
  await user.click(screen.getByRole('button', { name: /Continue/ }));
  await screen.findByRole('heading', { name: /Registered paper structure/ });
}
async function review(user: ReturnType<typeof userEvent.setup>) {
  await payment(user);
  await user.click(screen.getByRole('button', { name: /Continue/ }));
  await screen.findByRole('heading', {
    name: 'Uploaded supporting documents (1)',
  });
  await user.click(screen.getByRole('button', { name: /Review application/ }));
}

describe('paper structure integration with claim workflow', () => {
  it('loads draft selections, disables unavailable whole setting and refreshes after saving', async () => {
    const user = userEvent.setup({ delay: null });
    const client = backend();
    open(client);
    await payment(user);
    expect(
      await screen.findByText('Whole-paper setting unavailable'),
    ).toBeVisible();
    expect(screen.getByLabelText(/^Papers set/)).toBeDisabled();
    const queries = () =>
      vi
        .mocked(client.get)
        .mock.calls.filter(([path]) => path.endsWith('/paper-structure'))
        .length;
    expect(queries()).toBe(1);
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText(/Draft saved on the server/);
    await waitFor(() => expect(queries()).toBe(2));
  });
  it('blocks an invalid restored whole setting claim before review and allows it to be cleared', async () => {
    const user = userEvent.setup({ delay: null });
    const client = backend({ settingCount: 1 });
    open(client);
    await payment(user);
    await screen.findByText('Whole-paper setting unavailable');
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    expect(
      await screen.findByRole('link', {
        name: /Whole-paper setting is unavailable/,
      }),
    ).toBeVisible();
    expect(client.post).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText(/^Papers set/), {
      target: { value: '0' },
    });
    await user.click(screen.getByRole('button', { name: /Continue/ }));
    expect(
      await screen.findByRole('heading', {
        name: 'Uploaded supporting documents (1)',
      }),
    ).toBeVisible();
  });
  it('refreshes when a course selection changes without restoring stale information', async () => {
    const user = userEvent.setup({ delay: null });
    const client = backend();
    open(client);
    await payment(user);
    await screen.findByText('Dr. Registrar');
    fireEvent.change(screen.getByLabelText(/^Course code/), {
      target: { value: 'EC5070' },
    });
    await waitFor(() =>
      expect(
        vi
          .mocked(client.get)
          .mock.calls.some(
            ([path, , , query]) =>
              path.endsWith('/paper-structure') &&
              query?.courseCode === 'EC5070',
          ),
      ).toBe(true),
    );
    expect(
      await screen.findByText(/EC5070 · Software Engineering/),
    ).toBeVisible();
  });
  it('permits the verified first-submission flow and loads fresh structure on request details afterward', async () => {
    const user = userEvent.setup({ delay: null });
    const client = backend({ unregistered: true });
    open(client);
    await review(user);
    expect(
      await screen.findByText('No registered paper structure'),
    ).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Submit Application' }),
    );
    expect(
      await screen.findByText('Claim submitted successfully'),
    ).toBeVisible();
    expect(await screen.findByText('Dr. Registrar')).toBeVisible();
    expect(
      screen.queryByText('No registered paper structure'),
    ).not.toBeInTheDocument();
    expect(
      vi
        .mocked(client.get)
        .mock.calls.filter(([path]) => path.endsWith('/paper-structure'))
        .length,
    ).toBeGreaterThanOrEqual(2);
    expect(vi.mocked(client.post).mock.calls[0]?.[0]).toBe(
      '/requests/paper-marking/submit',
    );
    expect(vi.mocked(client.post).mock.calls[0]?.[1]).not.toHaveProperty(
      'paperStructure',
    );
  });
  it('surfaces server quota rejection and refreshes afterward instead of claiming success', async () => {
    const user = userEvent.setup({ delay: null });
    const client = backend({ unregistered: true, submitError: true });
    open(client);
    await review(user);
    await screen.findByText('No registered paper structure');
    await user.click(
      screen.getByRole('button', { name: 'Submit Application' }),
    );
    expect(
      await screen.findByText(
        'Paper Setting quota exceeded for EC5060. Other claims have changed.',
      ),
    ).toBeVisible();
    expect(
      screen.queryByText('Claim submitted successfully'),
    ).not.toBeInTheDocument();
    await waitFor(() =>
      expect(
        vi
          .mocked(client.get)
          .mock.calls.filter(([path]) => path.endsWith('/paper-structure'))
          .length,
      ).toBe(2),
    );
  });
});
