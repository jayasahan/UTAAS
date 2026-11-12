import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { GeneralReimbursementPreviewPage } from './GeneralReimbursementPreviewPage';

async function completeRequiredPersonalInformation(
  user: ReturnType<typeof userEvent.setup>,
) {
  await user.type(screen.getByLabelText(/^Full name/), 'Sample Lecturer');
  await user.type(screen.getByLabelText(/^Designation/), 'Lecturer');
  await user.type(screen.getByLabelText(/^Department/), 'Sample Department');
  await user.type(screen.getByLabelText(/^Staff ID/), 'SAMPLE-001');
}

describe('GeneralReimbursementPreviewPage', () => {
  it('adds expense rows and displays only their local entry sum', async () => {
    const user = userEvent.setup();
    render(<GeneralReimbursementPreviewPage />);

    await user.click(
      screen.getByRole('button', { name: 'Next: Claim details' }),
    );
    expect(screen.getByText('Enter your full name.')).toBeInTheDocument();
    await completeRequiredPersonalInformation(user);
    await user.click(
      screen.getByRole('button', { name: 'Next: Claim details' }),
    );
    await user.type(
      screen.getByLabelText('Amount (LKR) for expense entry 1'),
      '4500.50',
    );
    await user.click(screen.getByRole('button', { name: '+ Add expense row' }));
    await user.type(
      screen.getByLabelText('Amount (LKR) for expense entry 2'),
      '250.50',
    );

    expect(screen.getByText('LKR 4,751.00')).toBeInTheDocument();
    expect(
      screen.getByText(/not an approved reimbursement amount/i),
    ).toBeInTheDocument();
  });

  it('keeps draft saving and final submission disabled without backend support', async () => {
    const user = userEvent.setup();
    render(<GeneralReimbursementPreviewPage />);

    await completeRequiredPersonalInformation(user);
    await user.click(
      screen.getByRole('button', { name: 'Next: Claim details' }),
    );
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(
      screen.getByRole('heading', { name: 'Review & Submit' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save draft' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Submit Application →' }),
    ).toBeDisabled();
  });

  it('lists selected file metadata as local and not uploaded', async () => {
    const user = userEvent.setup();
    render(<GeneralReimbursementPreviewPage />);

    await completeRequiredPersonalInformation(user);
    await user.click(
      screen.getByRole('button', { name: 'Next: Claim details' }),
    );
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    const file = new File(['sample'], 'receipt.pdf', {
      type: 'application/pdf',
    });
    fireEvent.change(
      screen.getByLabelText('Select supporting documents · PDF / image'),
      {
        target: { files: [file] },
      },
    );

    expect(screen.getByText(/receipt\.pdf.*Not uploaded/)).toBeInTheDocument();
  });
});
