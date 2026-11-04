import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { PaperMarkingClaimPage } from './PaperMarkingClaimPage';
import { ReviewStep } from './components/ReviewStep';
import { academicLabels, createForm, personalLabels } from './model';
import { SessionContext } from '../../auth/session';
import type { ApiClient } from '../../services/apiClient';
import { currentCircularFixture } from '../../test/circularRatesFixture';

async function personal(user: ReturnType<typeof userEvent.setup>) {
  for (const [label, value] of [
    ['Full name', 'Local Lecturer'],
    ['Designation', 'Lecturer'],
    ['Department', 'Engineering'],
    ['Staff ID', 'LOCAL-123'],
  ]) {
    fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), {
      target: { value: value! },
    });
  }
  await user.click(screen.getByRole('button', { name: 'Continue →' }));
}
async function payment(user: ReturnType<typeof userEvent.setup>) {
  for (const label of [
    'Academic year',
    'Semester',
    'Degree programme',
    'Course code',
    'Course title',
    'Examination type',
    'Examiner role',
  ])
    fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), {
      target: { value: 'Entered locally' },
    });
  fireEvent.change(screen.getByLabelText(/^Title of paper/), {
    target: { value: 'EC5060 Software Engineering' },
  });
  fireEvent.change(screen.getByLabelText(/^Duration/), {
    target: { value: '3' },
  });
  const count = screen.getByLabelText(/^Papers set/);
  fireEvent.change(count, { target: { value: '1' } });
  await user.click(screen.getByRole('button', { name: 'Continue →' }));
}
async function review(user: ReturnType<typeof userEvent.setup>) {
  await personal(user);
  await payment(user);
  await user.upload(
    screen.getByLabelText('Select supporting documents'),
    new File(['pdf content'], 'appointment.pdf', { type: 'application/pdf' }),
  );
  await user.click(
    screen.getByRole('button', { name: 'Review application →' }),
  );
}

function RequestDestination() {
  const { requestId = '' } = useParams();
  return <p role="status">Request details destination: {requestId}</p>;
}

function renderClaimPage(element = <PaperMarkingClaimPage />) {
  return render(
    <MemoryRouter initialEntries={['/requests/new']}>
      <Routes>
        <Route path="/requests/new" element={element} />
        <Route path="/requests/:requestId" element={<RequestDestination />} />
      </Routes>
    </MemoryRouter>,
  );
}

function authenticatedClient(): ApiClient {
  return {
    get: vi.fn(async (path, decode) => {
      if (path === '/auth/me')
        return decode({
          id: 'lecturer-1',
          email: 'lecturer@example.test',
          fullName: 'Verified Lecturer',
          role: 'LECTURER',
          departmentCode: 'ENG',
          departmentId: 'department-1',
        });
      return decode(currentCircularFixture);
    }),
    upload: vi.fn(async (_path, file, category, decode) =>
      decode({
        name: file.name,
        url: `/api/v1/requests/documents/lecturer-1__${file.name}`,
        documentType: category,
        size: file.size,
        mimetype: file.type,
        requestId: null,
      }),
    ),
    post: vi.fn(async (_path, body, decode) =>
      decode({
        id: 'submitted-claim-id',
        trackingNumber: 'UT-2026-009',
        status: 'UNDER_REVIEW',
        totalAmount: 3500,
        formData: body,
      }),
    ),
  };
}

function authenticatedPage(client = authenticatedClient()) {
  return renderClaimPage(
    <SessionContext.Provider
      value={{ status: 'authenticated', message: '', client, version: 1 }}
    >
      <PaperMarkingClaimPage />
    </SessionContext.Provider>,
  );
}
describe('paper-marking claim UI', () => {
  it('renders every long editable text value intact in constrained review summaries', () => {
    const form = createForm();
    for (const key of Object.keys(
      personalLabels,
    ) as (keyof typeof personalLabels)[])
      form.personal[key] = `${key}${'X'.repeat(200 - key.length)}`;
    for (const key of Object.keys(
      academicLabels,
    ) as (keyof typeof academicLabels)[])
      form.academic[key] = `${key}${'X'.repeat(200 - key.length)}`;
    form.papers[0]!.title = 'P'.repeat(200);
    render(
      <ReviewStep
        form={form}
        errors={[]}
        onEdit={vi.fn()}
        onDeclaration={vi.fn()}
      />,
    );
    for (const value of [
      ...Object.values(form.personal),
      ...Object.values(form.academic),
    ])
      expect(screen.getByText(value)).toBeVisible();
    expect(
      screen.getByRole('heading', {
        name: `Paper 1: ${form.papers[0]!.title}`,
      }),
    ).toBeVisible();
    // jsdom cannot measure layout; real viewport overflow is checked in Edge.
    expect(screen.getByRole('region', { name: 'Review & Submit' })).toHaveClass(
      'min-w-0',
      '[overflow-wrap:anywhere]',
    );
  });
  it('preserves category through the full journey and keeps earlier file categories', async () => {
    const user = userEvent.setup({ delay: null });
    renderClaimPage();
    expect(screen.getByRole('heading', { name: 'Next steps' })).toBeVisible();
    await personal(user);
    await payment(user);
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Document category' }),
      'EXAM_TIMETABLE',
    );
    await user.upload(
      screen.getByLabelText('Select supporting documents'),
      new File(['x'], 'schedule.pdf', { type: 'application/pdf' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Review application →' }),
    );
    expect(
      screen.getByRole('navigation', { name: 'Application form progress' }),
    ).toHaveTextContent('4 Review & Submit');
    await user.click(
      screen.getByRole('button', { name: '3 Supporting Documents' }),
    );
    expect(
      screen.getByRole('combobox', { name: 'Document category' }),
    ).toHaveValue('EXAM_TIMETABLE');
    await user.click(screen.getByRole('button', { name: '← Previous' }));
    await user.click(screen.getByRole('button', { name: 'Continue →' }));
    expect(
      screen.getByRole('combobox', { name: 'Document category' }),
    ).toHaveValue('EXAM_TIMETABLE');
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Document category' }),
      'ATTENDANCE_MARKS_SHEET',
    );
    await user.upload(
      screen.getByLabelText('Select supporting documents'),
      new File(['y'], 'marks.png', { type: 'image/png' }),
    );
    expect(screen.getByText(/Examination timetable ·/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Remove marks.png' }));
    expect(
      screen.getByRole('combobox', { name: 'Document category' }),
    ).toHaveValue('ATTENDANCE_MARKS_SHEET');
    expect(
      screen.getByRole('button', { name: 'Remove schedule.pdf' }),
    ).toBeVisible();
  });
  it('clears and revalidates unit changes inline without stealing keyboard focus', async () => {
    const user = userEvent.setup();
    renderClaimPage();
    await personal(user);
    const quantity = screen.getByRole('textbox', {
      name: 'Assessment candidates — paper 1',
    });
    await user.clear(quantity);
    await user.type(quantity, '4');
    const unit = screen.getByRole('combobox', {
      name: 'Assessment unit — paper 1',
    });
    await user.selectOptions(unit, 'hours');
    const hours = screen.getByRole('textbox', {
      name: 'Assessment hours — paper 1',
    });
    expect(hours).toHaveValue('');
    expect(hours).toHaveAttribute('aria-invalid', 'true');
    expect(unit).toHaveFocus();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.type(hours, '1.5');
    expect(hours).not.toHaveAttribute('aria-invalid', 'true');
    await user.selectOptions(unit, 'candidates');
    const candidates = screen.getByRole('textbox', {
      name: 'Assessment candidates — paper 1',
    });
    expect(candidates).toHaveValue('');
    await user.type(candidates, '1.5');
    expect(candidates).toHaveAttribute('aria-invalid', 'true');
  });
  it('blocks jumping ahead and exposes linked accessible required-field errors', async () => {
    const user = userEvent.setup();
    renderClaimPage();
    await user.click(screen.getByRole('button', { name: /4. Review/ }));
    expect(screen.getByRole('alert')).toHaveFocus();
    const name = screen.getByLabelText(/^Full name/);
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name).toHaveAccessibleDescription('Full name is required.');
    await user.click(
      screen.getByRole('link', { name: 'Full name is required.' }),
    );
    expect(name).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
  });
  it('adds/removes independently editable rows and keeps estimates unavailable', async () => {
    const user = userEvent.setup();
    renderClaimPage();
    await personal(user);
    await user.type(
      screen.getByRole('textbox', { name: 'Title of paper — paper 1' }),
      'First paper',
    );
    await user.click(screen.getByRole('button', { name: '+ Add paper row' }));
    expect(
      screen.getByRole('textbox', { name: 'Title of paper — paper 2' }),
    ).toHaveFocus();
    await user.type(
      screen.getByRole('textbox', { name: 'Title of paper — paper 2' }),
      'Second paper',
    );
    await user.click(screen.getByRole('button', { name: 'Remove paper 1' }));
    expect(
      screen.getByRole('textbox', { name: 'Title of paper — paper 1' }),
    ).toHaveValue('Second paper');
    expect(
      screen.getByRole('button', { name: '+ Add paper row' }),
    ).toHaveFocus();
    expect(screen.getByText(/TOTAL PAYMENT ESTIMATE/)).toHaveTextContent(
      'Unavailable',
    );
    await user.click(screen.getByRole('button', { name: 'Remove paper 1' }));
    expect(screen.getByText('No papers added.')).toBeVisible();
  });
  it('rejects invalid quantities without confusing candidate and hourly assessments', async () => {
    const user = userEvent.setup();
    renderClaimPage();
    await personal(user);
    fireEvent.change(screen.getByLabelText(/^Papers translated/), {
      target: { value: '-1' },
    });
    await user.click(screen.getByRole('button', { name: 'Continue →' }));
    expect(screen.getByLabelText(/^Papers translated/)).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });
  it('validates and removes locally selected documents, including invalid and duplicate files', async () => {
    const user = userEvent.setup({ applyAccept: false });
    renderClaimPage();
    await personal(user);
    await payment(user);
    await user.click(
      screen.getByRole('button', { name: 'Review application →' }),
    );
    expect(
      screen.getByLabelText('Select supporting documents'),
    ).toHaveAttribute('aria-invalid', 'true');
    const file = new File(['content'], 'letter.pdf', {
      type: 'application/pdf',
      lastModified: 123,
    });
    await user.upload(screen.getByLabelText('Select supporting documents'), [
      file,
      new File(['bad'], 'bad.exe', { type: 'application/octet-stream' }),
    ]);
    expect(
      screen.getByRole('heading', { name: 'Locally selected documents (1)' }),
    ).toBeVisible();
    expect(screen.getByText(/Some files could not/)).toBeVisible();
    await user.upload(
      screen.getByLabelText('Select supporting documents'),
      file,
    );
    expect(
      screen.getByLabelText('Select supporting documents'),
    ).toHaveAccessibleDescription(/already selected/);
    await user.click(screen.getByRole('button', { name: 'Remove letter.pdf' }));
    expect(screen.getByText('No documents selected.')).toBeVisible();
    expect(screen.getByLabelText('Select supporting documents')).toHaveFocus();
  });
  it('reviews all four steps, gates declaration, preserves edits and never submits or calls an API', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch');
    const user = userEvent.setup();
    renderClaimPage();
    await review(user);
    expect(
      screen.getByRole('heading', { name: 'Review & Submit' }),
    ).toBeVisible();
    expect(screen.getByText('Local Lecturer')).toBeVisible();
    expect(screen.getByText(/EC5060 Software Engineering/)).toBeVisible();
    expect(screen.getByText(/appointment.pdf/)).toHaveTextContent(
      'not uploaded',
    );
    await user.click(screen.getByRole('button', { name: 'Validate review' }));
    expect(
      within(screen.getByRole('alert')).getByRole('link', {
        name: /Accept the declaration/,
      }),
    ).toBeVisible();
    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Validate review' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Upload every selected document before submission.',
    );
    const submit = screen.getByRole('button', { name: 'Submit Application' });
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(fetchSpy).not.toHaveBeenCalled();
    await user.click(
      screen.getByRole('button', { name: 'Edit personal information' }),
    );
    await user.type(screen.getByLabelText(/^Full name/), ' Edited');
    await user.click(screen.getByRole('button', { name: /4. Review/ }));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByText('Local Lecturer Edited')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
  });

  it('uploads a selected document and submits a verified multi-step claim to request details', async () => {
    const user = userEvent.setup({ delay: null });
    const client = authenticatedClient();
    authenticatedPage(client);
    expect(await screen.findByDisplayValue('Verified Lecturer')).toBeVisible();
    await personal(user);
    await payment(user);
    await user.click(screen.getByRole('button', { name: '← Previous' }));
    await user.click(screen.getByRole('button', { name: '+ Add paper row' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Title of paper — paper 2' }),
      'EC5070 Practical',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Duration (hours) — paper 2' }),
      '2',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Papers translated — paper 2' }),
      '1',
    );
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Assessment unit — paper 2' }),
      'hours',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Assessment hours — paper 2' }),
      '2',
    );
    await user.click(screen.getByRole('button', { name: 'Continue →' }));
    await user.selectOptions(
      screen.getByRole('combobox', { name: 'Document category' }),
      'EXAM_TIMETABLE',
    );
    const file = new File(['proof'], 'timetable.pdf', {
      type: 'application/pdf',
    });
    await user.upload(
      screen.getByLabelText('Select supporting documents'),
      file,
    );
    await user.click(screen.getByRole('button', { name: 'Upload' }));
    expect(await screen.findByText(/Server upload confirmed/)).toBeVisible();
    expect(client.upload).toHaveBeenCalledWith(
      '/requests/upload',
      file,
      'EXAM_TIMETABLE',
      expect.any(Function),
      undefined,
    );
    await user.click(
      screen.getByRole('button', { name: 'Review application →' }),
    );
    expect(screen.getByText(/timetable.pdf/)).toBeVisible();
    expect(screen.getByText(/Total estimate:/)).toHaveTextContent(
      'Unavailable',
    );
    expect(
      screen.getByText(/Hour-based assessment estimates are unavailable/),
    ).toBeVisible();
    await user.click(screen.getByRole('checkbox'));
    const submit = screen.getByRole('button', { name: 'Submit Application' });
    expect(submit).toBeEnabled();
    await user.click(submit);
    expect(
      await screen.findByText(
        'Request details destination: submitted-claim-id',
      ),
    ).toBeVisible();
    expect(client.post).toHaveBeenCalledTimes(1);
    expect(vi.mocked(client.post).mock.calls[0]?.[0]).toBe(
      '/requests/paper-marking/submit',
    );
    const payload = vi.mocked(client.post).mock.calls[0]?.[1] as {
      papers: Array<{ title: string; assessmentUnit: string }>;
      supportingDocuments: Array<{ name: string; documentType: string }>;
      declaration: boolean;
      items?: unknown;
    };
    expect(payload.papers).toHaveLength(2);
    expect(payload.papers[0]).toMatchObject({
      title: 'EC5060 Software Engineering',
      assessmentUnit: 'candidates',
    });
    expect(payload.papers[1]).toMatchObject({
      title: 'EC5070 Practical',
      translationCount: 1,
      assessmentUnit: 'hours',
      assessmentQuantity: 2,
    });
    expect(payload.supportingDocuments).toEqual([
      expect.objectContaining({
        name: 'timetable.pdf',
        documentType: 'EXAM_TIMETABLE',
      }),
    ]);
    expect(payload.declaration).toBe(true);
    expect(payload.items).toBeUndefined();
  });

  it('keeps a failed upload selected and retries without duplicating a success', async () => {
    const user = userEvent.setup({ delay: null });
    const client = authenticatedClient();
    vi.mocked(client.upload)
      .mockRejectedValueOnce(new Error('connection failed'))
      .mockImplementationOnce(async (_path, file, category, decode) =>
        decode({
          name: file.name,
          url: '/api/v1/requests/documents/lecturer-1__retry.pdf',
          documentType: category,
          size: file.size,
          mimetype: file.type,
          requestId: null,
        }),
      );
    authenticatedPage(client);
    await screen.findByDisplayValue('Verified Lecturer');
    await personal(user);
    await payment(user);
    await user.upload(
      screen.getByLabelText('Select supporting documents'),
      new File(['proof'], 'retry.pdf', { type: 'application/pdf' }),
    );
    await user.click(screen.getByRole('button', { name: 'Upload' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      /could not be reached|connection failed/,
    );
    expect(screen.getByRole('button', { name: 'Retry upload' })).toBeEnabled();
    expect(screen.getByText(/retry.pdf/)).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Retry upload' }));
    expect(await screen.findByText(/Server upload confirmed/)).toBeVisible();
    expect(client.upload).toHaveBeenCalledTimes(2);
    expect(
      screen.getByRole('heading', {
        name: 'Uploaded supporting documents (1)',
      }),
    ).toBeVisible();
  });
});
