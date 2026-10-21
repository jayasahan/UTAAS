import { useEffect, useId, useRef } from 'react';
import type { ReactNode } from 'react';
import { Button } from './Button';
interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
}
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const notified = useRef(false);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open) {
      notified.current = false;
      if (!dialog.open) dialog.showModal();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={description ? descriptionId : undefined}
      onClose={() => {
        // A controlled prop close is not a user dismissal. Handle native close
        // once, including form method="dialog", without Escape/button duplicates.
        if (open && !notified.current) {
          notified.current = true;
          onClose();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        ref.current?.close();
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Tab') return;
        const controls = Array.from(
          event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
          ),
        ).filter(
          (element) =>
            element.getClientRects().length > 0 && element.tabIndex >= 0,
        );
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first && last) {
          event.preventDefault();
          last.focus();
        } else if (
          !event.shiftKey &&
          document.activeElement === last &&
          first
        ) {
          event.preventDefault();
          first.focus();
        }
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-2rem)] max-w-2xl overflow-y-auto rounded-card border-0 bg-white p-6 text-ink shadow-xl"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id={titleId} className="text-2xl font-bold text-brand">
          {title}
        </h2>
        <Button
          variant="ghost"
          aria-label="Close dialog"
          onClick={() => ref.current?.close()}
        >
          ×
        </Button>
      </div>
      {description && (
        <p id={descriptionId} className="mt-2 text-sm text-muted">
          {description}
        </p>
      )}
      <div className="mt-6">{children}</div>
    </dialog>
  );
}
