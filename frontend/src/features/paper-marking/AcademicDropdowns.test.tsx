import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { SessionContext } from '../../auth/session';
import { ApiError, type ApiClient } from '../../services/apiClient';
import { academicOptionsFixture } from '../../test/academicOptionsFixture';
import { PaperMarkingClaimPage } from './PaperMarkingClaimPage';

const profile = {
  id: 'lecturer-1',
  fullName: 'Verified Lecturer',
  email: 'lecturer@example.test',
  role: 'LECTURER',
  departmentId: 'verified-department',
  departmentCode: 'ENG',
};
function savedForm() {
  return {
    personal: {
      fullName: 'Saved Lecturer',
      designation: 'Lecturer',
      department: 'ENG',
      staffId: 'STAFF-1',
      referenceTitle: '',
    },
    metadata: {
      academicYear: '2024/2025',
      semester: 'Semester 5',
      degreeProgramme: 'BSc',
      courseCode: 'EC5060',
      courseTitle: 'Software Engineering',
      examType: 'Final',
      examinerRole: 'First Examiner',
    },
    papers: [
      {
        id: 'saved-row',
        title: 'Saved paper',
        durationHours: 3,
        settingCount: 1,
        moderationCount: 0,
        translationCount: 0,
        scriptCount: 0,
        secondMarkingCount: 0,
        assessmentUnit: 'candidates',
        assessmentQuantity: 0,
      },
    ],
    supportingDocuments: [],
    declaration: false,
  };
}
function clientFor(
  options: {
    dropdowns?: () => unknown | Promise<unknown>;
    draft?: ReturnType<typeof savedForm>;
    staff?: typeof profile;
  } = {},
): ApiClient {
  return {
    get: vi.fn(async (path, decode) => {
      if (path === '/auth/me') return decode(options.staff ?? profile);
      if (path === '/requests/paper-marking/options/form-dropdowns')
        return decode(
          await (options.dropdowns
            ? options.dropdowns()
            : academicOptionsFixture),
        );
      if (path === '/requests/paper-marking/saved-claim')
        return decode({
          id: 'saved-claim',
          trackingNumber: 'UT-DRAFT-1',
          status: 'DRAFT',
          totalAmount: 1200,
          formData: options.draft,
        });
      if (path.endsWith('/rates/circular'))
        return decode({ circularReference: 'TEST-ONLY', rates: {} });
      throw new Error(`Unexpected test path: ${path}`);
    }),
    post: vi.fn(async (_path, body, decode) =>
      decode({
        id: 'saved-claim',
        trackingNumber: 'UT-DRAFT-1',
        status: 'DRAFT',
        totalAmount: 1200,
        formData: body,
      }),
    ),
    upload: vi.fn(),
  };
}
function page(client: ApiClient, draft = false) {
  return (
    <SessionContext.Provider
      value={{ status: 'authenticated', message: '', client, version: 1 }}
    >
      <MemoryRouter
        initialEntries={[
          draft ? '/requests/new?draftId=saved-claim' : '/requests/new',
        ]}
      >
        <PaperMarkingClaimPage />
      </MemoryRouter>
    </SessionContext.Provider>
  );
}
function mount(client: ApiClient, draft = false) {
  return render(page(client, draft));
}
async function openAcademicFields(
  user: ReturnType<typeof userEvent.setup>,
  draft = false,
) {
  await screen.findByDisplayValue(
    draft ? 'Saved Lecturer' : 'Verified Lecturer',
  );
  if (!draft) {
    await user.type(screen.getByLabelText(/^Designation/), 'Lecturer');
    await user.type(screen.getByLabelText(/^Staff ID/), 'STAFF-1');
    await user.clear(screen.getByLabelText(/^Department/));
    await user.type(
      screen.getByLabelText(/^Department/),
      'Local department edit',
    );
  }
  await user.click(screen.getByRole('button', { name: 'Continue →' }));
}
async function choose(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  value: string,
) {
  const control = screen.getByRole('combobox', {
    name: new RegExp(`^${label}`),
  });
  await waitFor(() => expect(control).toBeEnabled());
  await user.selectOptions(control, value);
}

describe('academic dropdowns in the claim form', () => {
  it('uses backend options, scopes queries to the profile, synchronizes course/title and saves DTO-compatible values', async () => {
    const user = userEvent.setup();
    const client = clientFor();
    mount(client);
    await openAcademicFields(user);
    await choose(user, 'Academic year', '2024/2025');
    await choose(user, 'Degree programme', 'BSc');
    await choose(user, 'Semester', 'Semester 5');
    await choose(user, 'Course code', 'EC5060');
    expect(
      screen.getByRole('combobox', { name: /^Course title/ }),
    ).toHaveDisplayValue('Software Engineering');
    await choose(user, 'Course title', 'EC5070');
    expect(screen.getByRole('combobox', { name: /^Course code/ })).toHaveValue(
      'EC5070',
    );
    await choose(user, 'Examination type', 'Final');
    await choose(user, 'Examiner role', 'First Examiner');
    await choose(user, 'Duration', '3');
    await user.type(screen.getByLabelText(/^Title of paper/), 'Paper title');
    await user.clear(screen.getByLabelText(/^Papers set/));
    await user.type(screen.getByLabelText(/^Papers set/), '1');
    expect(client.get).toHaveBeenCalledWith(
      '/requests/paper-marking/options/form-dropdowns',
      expect.any(Function),
      expect.any(AbortSignal),
      { semester: '5', departmentId: 'verified-department' },
    );
    expect(
      within(
        screen.getByRole('combobox', { name: /^Course code/ }),
      ).queryByRole('option', { name: 'EC6010' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText(/Draft saved on the server/);
    expect(vi.mocked(client.post).mock.calls[0]?.[1]).toMatchObject({
      metadata: {
        semester: 'Semester 5',
        courseCode: 'EC5070',
        courseTitle: 'Computer Networks',
      },
      papers: [{ durationHours: 3 }],
    });
  });

  it('clears course and title when year, programme, or semester changes', async () => {
    const user = userEvent.setup();
    mount(clientFor());
    await openAcademicFields(user);
    await choose(user, 'Academic year', '2024/2025');
    await choose(user, 'Degree programme', 'BSc');
    await choose(user, 'Semester', 'Semester 5');
    for (const [parent, next] of [
      ['Academic year', '2023/2024'],
      ['Degree programme', 'Postgraduate Engineering'],
      ['Semester', 'Semester 6'],
    ]) {
      await choose(user, 'Course code', 'EC5060');
      await choose(user, parent!, next!);
      expect(
        screen.getByRole('combobox', { name: /^Course code/ }),
      ).toHaveValue('');
      expect(
        screen.getByRole('combobox', { name: /^Course title/ }),
      ).toHaveValue('');
    }
    await choose(user, 'Course code', 'EC6010');
    expect(
      screen.getByRole('combobox', { name: /^Course title/ }),
    ).toHaveDisplayValue('Operating Systems');
  });

  it('preserves a valid draft while choices load and after asynchronous choices arrive', async () => {
    const user = userEvent.setup();
    let release: (value: unknown) => void = () => {};
    const gate = new Promise<unknown>((resolve) => {
      release = resolve;
    });
    const client = clientFor({ draft: savedForm(), dropdowns: () => gate });
    mount(client, true);
    await openAcademicFields(user, true);
    const year = screen.getByRole('combobox', { name: /^Academic year/ });
    expect(year).toHaveValue('2024/2025');
    expect(year).toBeDisabled();
    expect(
      screen.getByRole('combobox', { name: /^Course title/ }),
    ).toHaveDisplayValue('Software Engineering');
    expect(screen.getByRole('combobox', { name: /^Duration/ })).toHaveValue(
      '3',
    );
    await act(async () => release(academicOptionsFixture));
    await waitFor(() => expect(year).toBeEnabled());
    expect(screen.getByRole('combobox', { name: /^Course code/ })).toHaveValue(
      'EC5060',
    );
    expect(
      screen.getByRole('combobox', { name: /^Course title/ }),
    ).toHaveDisplayValue('Software Engineering');
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText(/Draft saved on the server/);
    expect(vi.mocked(client.post).mock.calls[0]?.[1]).toMatchObject({
      metadata: savedForm().metadata,
      papers: [{ durationHours: 3 }],
    });
  });

  it('keeps unavailable draft values visible and saveable but prevents advancing with them', async () => {
    const user = userEvent.setup();
    const draft = savedForm();
    draft.metadata.courseCode = 'EC9000';
    draft.metadata.courseTitle = 'Saved old title';
    draft.metadata.examinerRole = 'Former appointment';
    const client = clientFor({ draft });
    mount(client, true);
    await openAcademicFields(user, true);
    await waitFor(() =>
      expect(
        screen.getByRole('combobox', { name: /^Examiner role/ }),
      ).toBeEnabled(),
    );
    expect(
      screen.getByRole('combobox', { name: /^Course title/ }),
    ).toHaveDisplayValue('Saved old title');
    expect(screen.getByRole('option', { name: 'EC9000' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Continue →' }));
    expect(
      screen.getByRole('link', {
        name: 'Choose a course available for your department and semester.',
      }),
    ).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Save draft' }));
    await screen.findByText(/Draft saved on the server/);
    expect(vi.mocked(client.post).mock.calls[0]?.[1]).toMatchObject({
      metadata: draft.metadata,
    });
  });

  it.each([
    new ApiError('network'),
    new ApiError('not-found', 404),
    new ApiError('forbidden', 403),
  ])(
    'shows API failure %s and retry, and handles empty courses without a local fallback',
    async (failure) => {
      const user = userEvent.setup();
      let fail = true;
      const client = clientFor({
        dropdowns: () => {
          if (fail) throw failure;
          return { ...academicOptionsFixture, courseModules: [] };
        },
      });
      mount(client);
      await openAcademicFields(user);
      expect(
        screen.getByRole('combobox', { name: /^Academic year/ }),
      ).toBeDisabled();
      fail = false;
      await user.click(
        await screen.findByRole('button', { name: 'Retry academic choices' }),
      );
      await choose(user, 'Semester', 'Semester 5');
      await waitFor(() =>
        expect(
          screen.getByRole('combobox', { name: /^Semester/ }),
        ).toBeEnabled(),
      );
      expect(
        screen.getByRole('combobox', { name: /^Course code/ }),
      ).toBeDisabled();
      expect(
        screen.getAllByText(
          'No courses are available for your department and semester.',
        ),
      ).toHaveLength(2);
      expect(
        screen.queryByRole('option', { name: 'EC5060' }),
      ).not.toBeInTheDocument();
    },
  );

  it('does not offer the backend legacy fallback as verified course choices', async () => {
    const user = userEvent.setup();
    mount(
      clientFor({
        dropdowns: () => ({
          ...academicOptionsFixture,
          courseModules: [
            {
              code: 'EC5060',
              title: 'Unfiltered course',
              departmentCode: 'ENG',
              level: 5,
            },
          ],
        }),
      }),
    );
    await openAcademicFields(user);
    await choose(user, 'Semester', 'Semester 5');
    await screen.findByRole('button', { name: 'Retry course choices' });
    expect(
      screen.getByRole('combobox', { name: /^Course code/ }),
    ).toBeDisabled();
    expect(
      screen.queryByRole('option', { name: 'EC5060' }),
    ).not.toBeInTheDocument();
  });

  it('clears the selected course and requests fresh choices when the verified department changes', async () => {
    const user = userEvent.setup();
    const view = mount(clientFor());
    await openAcademicFields(user);
    await choose(user, 'Semester', 'Semester 5');
    await choose(user, 'Course code', 'EC5060');
    const nextClient = clientFor({
      staff: {
        ...profile,
        departmentId: 'next-department',
        departmentCode: 'CIV',
      },
      dropdowns: () => ({
        ...academicOptionsFixture,
        userDepartmentCode: 'CIV',
        courseModules: [
          {
            code: 'CE5010',
            title: 'Civil Engineering Course',
            semester: 5,
            departmentCode: 'CIV',
          },
        ],
      }),
    });
    view.rerender(page(nextClient));
    await screen.findByRole('option', { name: 'CE5010' });
    expect(screen.getByRole('combobox', { name: /^Course code/ })).toHaveValue(
      '',
    );
    expect(screen.getByRole('combobox', { name: /^Course title/ })).toHaveValue(
      '',
    );
    expect(nextClient.get).toHaveBeenCalledWith(
      '/requests/paper-marking/options/form-dropdowns',
      expect.any(Function),
      expect.any(AbortSignal),
      { departmentId: 'next-department', semester: '5' },
    );
  });

  it('reports a malformed response and keeps unavailable controls disabled without defaults', async () => {
    const user = userEvent.setup();
    const client = clientFor({
      dropdowns: () => ({
        ...academicOptionsFixture,
        academicYears: 'invalid response',
      }),
    });
    mount(client);
    await openAcademicFields(user);
    await screen.findByRole('button', { name: 'Retry academic choices' });
    expect(
      screen.getByRole('combobox', { name: /^Academic year/ }),
    ).toBeDisabled();
    expect(
      screen.queryByRole('option', { name: '2024/2025' }),
    ).not.toBeInTheDocument();
    expect(client.post).not.toHaveBeenCalled();
  });
});
