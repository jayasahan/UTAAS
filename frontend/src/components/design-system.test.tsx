import { StrictMode, useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { Button } from './common/Button';
import { Input, Select, Checkbox, Textarea } from './common/FormControls';
import { Alert, Skeleton, EmptyState } from './common/Feedback';
import { Dialog } from './common/Dialog';
import { Table, TableHead, TableCell } from './common/Table';
import { RequestStatusBadge } from './tracking/RequestStatusBadge';
import type { RequestDisplayStatus } from './tracking/RequestStatusBadge';
import { FormStepper, WorkflowStepper } from './tracking/Steppers';
import { CorrectionBanner } from './tracking/CorrectionBanner';
import { AppLayout } from './layout/AppLayout';

describe('design system behavior', () => {
  it('defaults buttons to non-submit and blocks pending actions', async () => {
    const click = vi.fn();
    const user = userEvent.setup();
    const { rerender } = render(<Button onClick={click}>Save</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
    await user.click(screen.getByRole('button'));
    expect(click).toHaveBeenCalledTimes(1);
    rerender(
      <Button pending onClick={click}>
        Save
      </Button>,
    );
    expect(screen.getByRole('button')).toBeDisabled();
    expect(screen.getByRole('button')).toHaveAttribute('aria-busy', 'true');
    await user.click(screen.getByRole('button'));
    expect(click).toHaveBeenCalledTimes(1);
  });
  it('associates labels, helper text and validation errors', async () => {
    render(
      <Input
        label="Course"
        hint="Official code"
        error="Code is required"
        required
      />,
    );
    const input = screen.getByRole('textbox', { name: 'Course' });
    expect(input).toBeRequired();
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Official code Code is required');
    await userEvent.setup().type(input, 'EC5406');
    expect(input).toHaveValue('EC5406');
  });
  it('generates distinct field associations and respects supplied IDs', () => {
    render(
      <>
        <Input label="First" />
        <Input label="Second" id="second" />
      </>,
    );
    expect(screen.getByLabelText('First').id).not.toBe('second');
    expect(screen.getByLabelText('Second')).toHaveAttribute('id', 'second');
  });
  it('supports keyboard-native selects, checkboxes and textareas', async () => {
    const user = userEvent.setup();
    render(
      <>
        <Select label="Semester">
          <option value="1">One</option>
          <option value="2">Two</option>
        </Select>
        <Checkbox label="Declaration" />
        <Textarea label="Reason" />
      </>,
    );
    await user.selectOptions(screen.getByLabelText('Semester'), '2');
    expect(screen.getByLabelText('Semester')).toHaveValue('2');
    await user.click(screen.getByLabelText('Declaration'));
    expect(screen.getByLabelText('Declaration')).toBeChecked();
    await user.type(screen.getByLabelText('Reason'), 'Check evidence');
    expect(screen.getByLabelText('Reason')).toHaveValue('Check evidence');
  });
  it('keeps disabled and read-only controls non-editable', async () => {
    render(
      <>
        <Input label="Disabled" disabled />
        <Input label="Staff" value="Staff 1" readOnly />
      </>,
    );
    expect(screen.getByLabelText('Disabled')).toBeDisabled();
    await userEvent.setup().type(screen.getByLabelText('Staff'), 'changed');
    expect(screen.getByLabelText('Staff')).toHaveValue('Staff 1');
  });
  it.each<[RequestDisplayStatus, string, string]>([
    ['DRAFT', 'Draft', 'neutral'],
    ['SUBMITTED', 'Submitted', 'info'],
    ['UNDER_REVIEW', 'Under review', 'info'],
    ['RETURNED_FOR_CORRECTION', 'Returned for correction', 'warning'],
    ['APPROVED', 'Approved', 'success'],
    ['REJECTED', 'Rejected', 'danger'],
    ['SETTLED', 'Settled', 'success'],
  ])(
    'renders the exact label and semantic tone for %s',
    (status, label, tone) => {
      const { rerender } = render(<RequestStatusBadge status={status} />);
      expect(screen.getByText(label, { exact: true })).toHaveAttribute(
        'data-tone',
        tone,
      );
      expect(screen.getByText(label)).toHaveAttribute(
        'data-appearance',
        'solid',
      );
      rerender(<RequestStatusBadge status={status} appearance="soft" />);
      expect(screen.getByText(label)).toHaveAttribute('data-tone', tone);
      expect(screen.getByText(label)).toHaveAttribute(
        'data-appearance',
        'soft',
      );
    },
  );
  it('distinguishes form progress from workflow state and reports callbacks', async () => {
    const change = vi.fn();
    render(
      <FormStepper
        steps={[
          { id: 'one', label: 'Personal' },
          { id: 'two', label: 'Details' },
        ]}
        currentStepId="two"
        onStepChange={change}
      />,
    );
    expect(screen.getByText('2. Details').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: '1. Personal' }));
    expect(change).toHaveBeenCalledWith('one');
  });
  it('renders variable workflow stages without discarding earlier approvals', () => {
    render(
      <WorkflowStepper
        stages={[
          { id: 'hod', label: 'HOD', state: 'completed' },
          { id: 'exam', label: 'Exam', state: 'returned' },
          { id: 'finance', label: 'Finance', state: 'active' },
        ]}
      />,
    );
    expect(screen.getByText('Completed')).toBeVisible();
    expect(screen.getByText('Returned for correction')).toBeVisible();
    expect(screen.getByText('Finance').closest('li')).toHaveAttribute(
      'aria-current',
      'step',
    );
  });
  it('renders untrusted correction notes as text and delegates edit', async () => {
    const edit = vi.fn();
    render(
      <CorrectionBanner
        reviewer="Exam"
        reason={'<script>alert(1)</script>'}
        onEdit={edit}
      />,
    );
    expect(screen.getByText('<script>alert(1)</script>')).toBeVisible();
    expect(document.querySelector('script')).toBeNull();
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Edit corrections' }));
    expect(edit).toHaveBeenCalledOnce();
  });
  it('uses polite feedback by default and urgent alerts only when requested', () => {
    render(
      <>
        <Alert title="Saved" />
        <Alert title="Failed" urgent />
        <Skeleton label="Loading queue" />
      </>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
    expect(screen.getByText('Saved').closest('[role]')).toHaveAttribute(
      'role',
      'status',
    );
    expect(screen.getByText('Loading queue')).toBeInTheDocument();
  });
  it('keeps retries explicit and table semantics accessible', async () => {
    const retry = vi.fn();
    render(
      <>
        <EmptyState title="No data" onRetry={retry} />
        <Table caption="Claims">
          <thead>
            <tr>
              <TableHead>Course</TableHead>
            </tr>
          </thead>
          <tbody>
            <tr>
              <TableCell>EC5406</TableCell>
            </tr>
          </tbody>
        </Table>
      </>,
    );
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalledOnce();
    const table = screen.getByRole('table', { name: 'Claims' });
    expect(within(table).getByRole('columnheader')).toHaveAttribute(
      'scope',
      'col',
    );
    expect(screen.getByRole('region', { name: 'Claims' })).toHaveAttribute(
      'tabindex',
      '0',
    );
  });
  it('labels controlled dialogs and delegates cancellation (native behavior checked in browser)', async () => {
    const close = vi.fn();
    const { rerender } = render(
      <Dialog
        open
        onClose={close}
        title="Return"
        description="Explain corrections"
      >
        <Input label="Reason" />
      </Dialog>,
    );
    expect(
      screen.getByRole('dialog', { name: 'Return' }),
    ).toHaveAccessibleDescription('Explain corrections');
    fireEvent(
      screen.getByRole('dialog'),
      new Event('cancel', { cancelable: true }),
    );
    expect(close).toHaveBeenCalledOnce();
    fireEvent(screen.getByRole('dialog', { hidden: true }), new Event('close'));
    expect(close).toHaveBeenCalledOnce();
    rerender(
      <Dialog open={false} onClose={close} title="Return">
        <span>Closed</span>
      </Dialog>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(close).toHaveBeenCalledOnce();
  });
  it('synchronizes native close and can reopen without duplicate callbacks in StrictMode', async () => {
    const closed = vi.fn();
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <Button onClick={() => setOpen(true)}>Open</Button>
          <Dialog
            open={open}
            onClose={() => {
              closed();
              setOpen(false);
            }}
            title="Native close"
          >
            <span>Content</span>
          </Dialog>
        </>
      );
    }
    const user = userEvent.setup();
    render(
      <StrictMode>
        <Harness />
      </StrictMode>,
    );
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const dialog = screen.getByRole('dialog') as HTMLDialogElement;
    fireEvent(dialog, new Event('close')); // native form/direct close event
    expect(closed).toHaveBeenCalledOnce();
    expect(screen.queryByRole('dialog')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Open' }));
    expect(screen.getByRole('dialog')).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(closed).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('dialog')).toBeNull();
  });
  it('does not notify dismissal when the parent closes the dialog prop', () => {
    const closed = vi.fn();
    const { rerender } = render(
      <Dialog open title="Controlled" onClose={closed}>
        <span>Content</span>
      </Dialog>,
    );
    rerender(
      <Dialog open={false} title="Controlled" onClose={closed}>
        <span>Content</span>
      </Dialog>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(closed).not.toHaveBeenCalled();
  });
  it('preserves route navigation and officer layout without selecting user permissions', async () => {
    function Harness() {
      const [variant] = useState<'officer'>('officer');
      return (
        <AppLayout
          variant={variant}
          items={[
            { to: '/', label: 'Home', end: true },
            { to: '/queue', label: 'Queue' },
          ]}
          workspaceLabel="Officer portal"
        />
      );
    }
    render(
      <MemoryRouter>
        <Routes>
          <Route element={<Harness />}>
            <Route index element={<h1>Home page</h1>} />
            <Route path="queue" element={<h1>Queue page</h1>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Home' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await userEvent.setup().click(screen.getByRole('link', { name: 'Queue' }));
    expect(screen.getByRole('heading', { name: 'Queue page' })).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Skip to content' }),
    ).toHaveAttribute('href', '#main-content');
  });
});
