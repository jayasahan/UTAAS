import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { PaperMarkingClaimPage } from './PaperMarkingClaimPage';
import { ReviewStep } from './components/ReviewStep';
import { academicLabels, createForm, personalLabels } from './model';

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
    render(<PaperMarkingClaimPage />);
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
    render(<PaperMarkingClaimPage />);
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
    render(<PaperMarkingClaimPage />);
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
    render(<PaperMarkingClaimPage />);
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
    render(<PaperMarkingClaimPage />);
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
    render(<PaperMarkingClaimPage />);
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
    render(<PaperMarkingClaimPage />);
    await review(user);
    expect(
      screen.getByRole('heading', { name: 'Review & Submit' }),
    ).toBeVisible();
    expect(screen.getByText('Local Lecturer')).toBeVisible();
    expect(screen.getByText(/EC5060 Software Engineering/)).toBeVisible();
    expect(screen.getByText(/appointment.pdf/)).toHaveTextContent(
      'not uploaded',
    );
    await user.click(
      screen.getByRole('button', { name: 'Validate local review' }),
    );
    expect(
      within(screen.getByRole('alert')).getByRole('link', {
        name: /Accept the declaration/,
      }),
    ).toBeVisible();
    const checkbox = screen.getByRole('checkbox');
    await user.click(checkbox);
    expect(checkbox).toBeChecked();
    await user.click(
      screen.getByRole('button', { name: 'Validate local review' }),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
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
});
