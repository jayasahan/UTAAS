import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Dialog } from './Dialog';

function DialogHarness({ onClose }: { onClose: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        Open dialog
      </button>
      <Dialog
        open={open}
        onClose={() => {
          onClose();
          setOpen(false);
        }}
        title="Review decision"
      >
        <button type="button">Inside dialog</button>
      </Dialog>
    </>
  );
}

function getReviewDialog(): HTMLDialogElement {
  return screen.getByRole('dialog', {
    name: 'Review decision',
  }) as HTMLDialogElement;
}

describe('Dialog accessibility behavior', () => {
  it('dismisses on Escape and synchronizes the controlled state', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    const dialog = getReviewDialog();
    screen.getByRole('button', { name: 'Inside dialog' }).focus();
    await user.keyboard('{Escape}');

    expect(dialog.open).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('synchronizes a native close event and calls the controlled callback once', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    const dialog = getReviewDialog();
    act(() => dialog.close());

    expect(dialog.open).toBe(false);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not notify twice when a controlled close also emits a native close event', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);

    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole('dialog', { hidden: true }) as HTMLDialogElement,
    ).toHaveProperty('open', false);
  });

  it('restores focus to the control that opened the dialog', async () => {
    const user = userEvent.setup();
    render(<DialogHarness onClose={vi.fn()} />);
    const opener = screen.getByRole('button', { name: 'Open dialog' });

    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));

    expect(document.activeElement).toBe(opener);
  });

  it('can reopen after dismissal and starts a fresh close cycle', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);
    const opener = screen.getByRole('button', { name: 'Open dialog' });

    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    await user.click(opener);
    expect(getReviewDialog().open).toBe(true);
    await user.click(screen.getByRole('button', { name: 'Close dialog' }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('keeps keyboard focus inside the dialog at both Tab boundaries', async () => {
    const user = userEvent.setup();
    render(<DialogHarness onClose={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: 'Open dialog' }));

    const first = screen.getByRole('button', { name: 'Close dialog' });
    const last = screen.getByRole('button', { name: 'Inside dialog' });
    for (const control of [first, last]) {
      Object.defineProperty(control, 'getClientRects', {
        configurable: true,
        value: () => ({ length: 1 }) as unknown as DOMRectList,
      });
    }

    last.focus();
    fireEvent.keyDown(last, { key: 'Tab' });
    expect(document.activeElement).toBe(first);

    fireEvent.keyDown(first, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(last);
  });
});
