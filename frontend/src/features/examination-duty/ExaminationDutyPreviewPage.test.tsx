import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { ExaminationDutyPreviewPage } from './ExaminationDutyPreviewPage';

async function completeRequiredPersonalInformation(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.type(screen.getByLabelText(/^Full name/), 'Sample Lecturer');
  await user.type(screen.getByLabelText(/^Designation/), 'Lecturer');
  await user.type(screen.getByLabelText(/^Department/), 'Sample Department');
  await user.type(screen.getByLabelText(/^Staff ID/), 'SAMPLE-001');
}

describe('ExaminationDutyPreviewPage', () => {
  it('requires the personal fields before advancing and focuses the first missing field', async () => {
    const user = userEvent.setup();
    render(<ExaminationDutyPreviewPage />);

    await user.click(
      screen.getByRole('button', { name: 'Next: Duty details' }),
    );

    expect(screen.getByText('Enter your full name.')).toBeInTheDocument();
    expect(document.activeElement).toBe(screen.getByLabelText(/^Full name/));
    expect(
      screen.getByRole('heading', {
        name: 'Step 1 — Personal & Application Information',
      }),
    ).toBeInTheDocument();
  });

  it('adds duty rows and displays only their local entry sum', async () => {
    const user = userEvent.setup();
    render(<ExaminationDutyPreviewPage />);

    await completeRequiredPersonalInformation(user);
    await user.click(
      screen.getByRole('button', { name: 'Next: Duty details' }),
    );
    await user.type(
      screen.getByLabelText('Payment amount in LKR for duty entry 1'),
      '4500.50',
    );
    await user.click(screen.getByRole('button', { name: '+ Add duty row' }));
    await user.type(
      screen.getByLabelText('Payment amount in LKR for duty entry 2'),
      '250.50',
    );

    expect(screen.getByText('LKR 4,751.00')).toBeInTheDocument();
    expect(
      screen.getByText(/The total only adds amounts entered in these rows/),
    ).toBeInTheDocument();
  });

  it('keeps selected files local and allows removing them from the preview', async () => {
    const user = userEvent.setup();
    render(<ExaminationDutyPreviewPage />);

    await completeRequiredPersonalInformation(user);
    await user.click(
      screen.getByRole('button', { name: 'Next: Duty details' }),
    );
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    const file = new File(['sample'], 'duty-evidence.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(
      screen.getByLabelText('Select supporting documents · PDF / image'),
      { target: { files: [file] } },
    );

    expect(
      screen.getByText(/duty-evidence\.pdf.*Not uploaded/),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', {
        name: 'Remove duty-evidence.pdf from local preview',
      }),
    );
    expect(screen.getByText('No files selected.')).toBeInTheDocument();
  });

  it('keeps draft saving and final submission disabled without backend support', async () => {
    const user = userEvent.setup();
    render(<ExaminationDutyPreviewPage />);

    await completeRequiredPersonalInformation(user);
    await user.click(
      screen.getByRole('button', { name: 'Next: Duty details' }),
    );
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      screen.getByRole('heading', { name: 'Review & Submit' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /This local sum is not an authoritative or payable amount/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Submit Application →' }),
    ).toBeDisabled();
  });
});
