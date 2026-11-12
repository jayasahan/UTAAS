import { useRef, useState } from 'react';
import { Alert } from '../../components/common/Feedback';
import { Button } from '../../components/common/Button';
import { Card } from '../../components/common/Card';
import { Checkbox, Input } from '../../components/common/FormControls';
import { Table, TableCell, TableHead } from '../../components/common/Table';
import { useSession } from '../../auth/session';

type StepNumber = 1 | 2 | 3 | 4;
type PersonalDraft = {
  fullName: string | null;
  designation: string;
  department: string | null;
  staffId: string;
  referenceTitle: string;
};
type ExpenseRow = {
  id: number;
  date: string;
  description: string;
  amount: string;
};
type SelectedFile = { id: number; name: string; size: number };

const steps = [
  'Personal & Application',
  'Claim Details',
  'Supporting Documents',
  'Review & Submit',
] as const;

function newExpenseRow(id: number): ExpenseRow {
  return { id, date: '', description: '', amount: '' };
}

function amountInCents(value: string): number {
  if (!value.trim()) return 0;
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return 0;
  const cents = Math.round(amount * 100);
  return Number.isSafeInteger(cents) ? cents : 0;
}

function formatLkr(cents: number): string {
  return `LKR ${new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100)}`;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function SectionHeading({
  number,
  children,
}: {
  number: number;
  children: string;
}) {
  return (
    <h3 className="flex items-center gap-3 font-bold text-brand">
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-control bg-success-subtle text-success-ink"
      >
        {number}
      </span>
      <span>{children}</span>
    </h3>
  );
}

function SummaryValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 break-words text-ink">{value || 'Not provided'}</dd>
    </div>
  );
}

export function GeneralReimbursementPreviewPage() {
  const session = useSession();
  const [step, setStep] = useState<StepNumber>(1);
  const [personalDraft, setPersonalDraft] = useState<PersonalDraft>({
    fullName: null,
    designation: '',
    department: null,
    staffId: '',
    referenceTitle: '',
  });
  const [expenses, setExpenses] = useState<ExpenseRow[]>([newExpenseRow(1)]);
  const [selectedFiles, setSelectedFiles] = useState<SelectedFile[]>([]);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [personalAttempted, setPersonalAttempted] = useState(false);
  const nextExpenseId = useRef(2);
  const nextFileId = useRef(1);

  const personal = {
    fullName: personalDraft.fullName ?? session.user?.fullName ?? '',
    designation: personalDraft.designation,
    department: personalDraft.department ?? session.user?.departmentCode ?? '',
    staffId: personalDraft.staffId,
    referenceTitle: personalDraft.referenceTitle,
  };
  const totalCents = expenses.reduce(
    (total, expense) => total + amountInCents(expense.amount),
    0,
  );
  const personalErrors = {
    fullName:
      personalAttempted && !personal.fullName.trim()
        ? 'Enter your full name.'
        : undefined,
    designation:
      personalAttempted && !personal.designation.trim()
        ? 'Enter your designation.'
        : undefined,
    department:
      personalAttempted && !personal.department.trim()
        ? 'Enter your department.'
        : undefined,
    staffId:
      personalAttempted && !personal.staffId.trim()
        ? 'Enter your staff ID.'
        : undefined,
  };

  function changePersonal(key: keyof PersonalDraft, value: string) {
    setPersonalDraft((current) => ({ ...current, [key]: value }));
    setDeclarationAccepted(false);
  }

  function changeExpense(
    id: number,
    key: keyof Omit<ExpenseRow, 'id'>,
    value: string,
  ) {
    setExpenses((current) =>
      current.map((expense) =>
        expense.id === id ? { ...expense, [key]: value } : expense,
      ),
    );
    setDeclarationAccepted(false);
  }

  function addExpense() {
    const id = nextExpenseId.current++;
    setExpenses((current) => [...current, newExpenseRow(id)]);
    setDeclarationAccepted(false);
  }

  function removeExpense(id: number) {
    setExpenses((current) => {
      if (current.length === 1) return [newExpenseRow(nextExpenseId.current++)];
      return current.filter((expense) => expense.id !== id);
    });
    setDeclarationAccepted(false);
  }

  function selectFiles(files: FileList | null) {
    if (!files?.length) return;
    const selected = Array.from(files, (file) => ({
      id: nextFileId.current++,
      name: file.name,
      size: file.size,
    }));
    setSelectedFiles((current) => [...current, ...selected]);
    setDeclarationAccepted(false);
  }

  function removeSelectedFile(id: number) {
    setSelectedFiles((current) => current.filter((file) => file.id !== id));
    setDeclarationAccepted(false);
  }

  function nextStep() {
    if (step === 1) {
      setPersonalAttempted(true);
      const firstMissing = [
        { id: 'general-reimbursement-name', value: personal.fullName },
        {
          id: 'general-reimbursement-designation',
          value: personal.designation,
        },
        {
          id: 'general-reimbursement-department',
          value: personal.department,
        },
        { id: 'general-reimbursement-staff-id', value: personal.staffId },
      ].find(({ value }) => !value.trim());
      if (firstMissing) {
        document.getElementById(firstMissing.id)?.focus();
        return;
      }
    }
    setStep((current) => Math.min(4, current + 1) as StepNumber);
  }

  function previousStep() {
    setStep((current) => Math.max(1, current - 1) as StepNumber);
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-brand">
            General reimbursement
          </h1>
          <span className="rounded-md bg-warning-subtle px-3 py-1 text-xs font-bold uppercase tracking-wide text-warning-ink">
            Development preview
          </span>
        </div>
        <p className="text-sm text-muted">
          Four-step application flow based on the current PRIMARY design; the
          official form sequence and field rules still need confirmation.
        </p>
      </header>

      <Alert title="UI preview only" tone="info">
        Values stay in this page while it is open. Nothing is sent or saved, and
        draft saving, document upload, and submission are unavailable. Use
        sample information and files only.
      </Alert>

      <ol
        aria-label="Application progress"
        className="grid grid-cols-2 gap-2 md:grid-cols-4"
      >
        {steps.map((label, index) => {
          const number = index + 1;
          const active = number === step;
          return (
            <li
              key={label}
              aria-current={active ? 'step' : undefined}
              className={`flex min-h-14 items-center rounded-control px-3 py-3 text-xs font-semibold ${active ? 'bg-brand text-white' : 'bg-white text-slate-600'}`}
            >
              <span className="mr-2">{number}</span>
              <span>{label}</span>
            </li>
          );
        })}
      </ol>

      {step === 1 && (
        <>
          <Card className="space-y-6">
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-brand">
                Step 1 — Personal & Application Information
              </h2>
              <p className="text-sm text-muted">
                The current staff profile contract provides a name and
                department code only. Designation and staff ID are not available
                for verification in this preview.
              </p>
            </div>
            <div className="grid gap-5 md:grid-cols-2">
              <Input
                id="general-reimbursement-name"
                label="Full name"
                required
                value={personal.fullName}
                {...(personalErrors.fullName
                  ? { error: personalErrors.fullName }
                  : {})}
                hint={
                  session.user?.fullName
                    ? 'Prefilled from the current staff profile. Edits remain local and are not reverified.'
                    : 'No staff profile is loaded in this preview. Use sample information only.'
                }
                onChange={(event) =>
                  changePersonal('fullName', event.target.value)
                }
              />
              <Input
                id="general-reimbursement-designation"
                label="Designation"
                required
                value={personal.designation}
                {...(personalErrors.designation
                  ? { error: personalErrors.designation }
                  : {})}
                hint="Not returned by the current profile endpoint; this value is not verified."
                onChange={(event) =>
                  changePersonal('designation', event.target.value)
                }
              />
              <Input
                id="general-reimbursement-department"
                label="Department"
                required
                value={personal.department}
                {...(personalErrors.department
                  ? { error: personalErrors.department }
                  : {})}
                hint={
                  session.user?.departmentCode
                    ? 'Prefilled with the profile department code, not a verified department name.'
                    : 'No department value is available from a staff profile in this preview.'
                }
                onChange={(event) =>
                  changePersonal('department', event.target.value)
                }
              />
              <Input
                id="general-reimbursement-staff-id"
                label="Staff ID"
                required
                value={personal.staffId}
                {...(personalErrors.staffId
                  ? { error: personalErrors.staffId }
                  : {})}
                hint="Not returned by the current profile endpoint; this value is not verified."
                onChange={(event) =>
                  changePersonal('staffId', event.target.value)
                }
              />
              <div className="md:col-span-2">
                <Input
                  id="general-reimbursement-reference-title"
                  label="My Reference Title (optional — only visible to you)"
                  value={personal.referenceTitle}
                  hint="Private labels are not part of the current backend contract and remain in this page only."
                  onChange={(event) =>
                    changePersonal('referenceTitle', event.target.value)
                  }
                />
              </div>
            </div>
          </Card>
          <Card className="space-y-2">
            <h2 className="font-bold text-brand">Next steps</h2>
            <p className="text-sm text-muted">
              Step 2: Expense details · Step 3: Supporting documents · Step 4:
              Review and submit
            </p>
          </Card>
        </>
      )}

      {step === 2 && (
        <Card className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-brand">
              Expense Particulars
            </h2>
            <p className="text-sm text-muted">
              Enter expense rows using the layout from the PRIMARY design. The
              sum below is only the amounts entered here; it is not an approved
              reimbursement amount.
            </p>
          </div>
          <Table caption="General reimbursement expense entries">
            <thead className="hidden md:table-header-group">
              <tr>
                <TableHead className="md:w-36">Date</TableHead>
                <TableHead className="md:w-72">
                  Expense particulars / description
                </TableHead>
                <TableHead className="md:w-40">Amount (LKR)</TableHead>
                <TableHead className="md:w-16">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </tr>
            </thead>
            <tbody className="block space-y-3 md:table-row-group md:space-y-0">
              {expenses.map((expense, index) => (
                <tr
                  key={expense.id}
                  className="block rounded-control bg-canvas p-3 md:table-row md:bg-transparent md:p-0"
                >
                  <TableCell className="block p-2 md:table-cell">
                    <label
                      htmlFor={`expense-date-${expense.id}`}
                      className="mb-2 block text-xs font-semibold text-ink md:sr-only md:mb-0"
                    >
                      Date for expense entry {index + 1}
                    </label>
                    <input
                      id={`expense-date-${expense.id}`}
                      type="date"
                      value={expense.date}
                      className="field-control min-w-0 text-sm"
                      onChange={(event) =>
                        changeExpense(expense.id, 'date', event.target.value)
                      }
                    />
                  </TableCell>
                  <TableCell className="block p-2 md:table-cell">
                    <label
                      htmlFor={`expense-description-${expense.id}`}
                      className="mb-2 block text-xs font-semibold text-ink md:sr-only md:mb-0"
                    >
                      Expense description for entry {index + 1}
                    </label>
                    <input
                      id={`expense-description-${expense.id}`}
                      type="text"
                      value={expense.description}
                      placeholder="Enter expense description"
                      className="field-control min-w-0 text-sm"
                      onChange={(event) =>
                        changeExpense(
                          expense.id,
                          'description',
                          event.target.value,
                        )
                      }
                    />
                  </TableCell>
                  <TableCell className="block p-2 md:table-cell">
                    <label
                      htmlFor={`expense-amount-${expense.id}`}
                      className="mb-2 block text-xs font-semibold text-ink md:sr-only md:mb-0"
                    >
                      Amount (LKR) for expense entry {index + 1}
                    </label>
                    <input
                      id={`expense-amount-${expense.id}`}
                      type="number"
                      min="0"
                      step="0.01"
                      inputMode="decimal"
                      value={expense.amount}
                      placeholder="0.00"
                      className="field-control min-w-0 text-sm"
                      onChange={(event) =>
                        changeExpense(expense.id, 'amount', event.target.value)
                      }
                    />
                  </TableCell>
                  <TableCell className="flex justify-end p-2 md:table-cell md:text-center">
                    <Button
                      variant="ghost"
                      className="min-h-10 px-2 text-danger"
                      aria-label={`Remove expense entry ${index + 1}`}
                      onClick={() => removeExpense(expense.id)}
                    >
                      ×
                    </Button>
                  </TableCell>
                </tr>
              ))}
            </tbody>
          </Table>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <Button
              variant="primary"
              className="min-h-9 px-3 py-2 text-xs"
              onClick={addExpense}
            >
              + Add expense row
            </Button>
            <div className="flex min-h-14 items-center justify-between gap-5 rounded-control bg-success-subtle px-4 py-3 text-success-ink sm:min-w-80">
              <span className="text-xs font-bold uppercase tracking-wide">
                Claimed total (entry sum)
              </span>
              <output
                aria-live="polite"
                className="text-lg font-bold tabular-nums"
              >
                {formatLkr(totalCents)}
              </output>
            </div>
          </div>
          <p className="text-sm text-muted">
            The official expense categories, supporting evidence, and amount
            rules still need confirmation with the form owner.
          </p>
        </Card>
      )}

      {step === 3 && (
        <Card className="space-y-5">
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-brand">
              Supporting documents
            </h2>
            <p className="text-sm text-muted">
              The PRIMARY design shows PDF or image evidence. Select sample
              files to preview the list; this page does not upload them.
            </p>
          </div>
          <label className="relative flex min-h-32 cursor-pointer items-center justify-center rounded-control bg-blue-50 p-6 text-center font-semibold text-action focus-within:outline-2 focus-within:outline-offset-4 focus-within:outline-action">
            <input
              type="file"
              accept="application/pdf,image/*"
              multiple
              className="absolute inset-0 size-full cursor-pointer opacity-0"
              aria-describedby="general-reimbursement-file-note"
              onChange={(event) => {
                selectFiles(event.currentTarget.files);
                event.currentTarget.value = '';
              }}
            />
            <span>Select supporting documents · PDF / image</span>
          </label>
          <p
            id="general-reimbursement-file-note"
            className="text-sm text-muted"
          >
            Files are only selected in your browser for this preview. No file
            upload or audit-record association exists for this form yet.
          </p>
          <section
            aria-labelledby="selected-files-heading"
            className="space-y-3"
          >
            <h3
              id="selected-files-heading"
              className="font-semibold text-brand"
            >
              Selected locally ({selectedFiles.length})
            </h3>
            {selectedFiles.length === 0 ? (
              <p className="text-sm text-muted">No files selected.</p>
            ) : (
              <ul className="space-y-2">
                {selectedFiles.map((file) => (
                  <li
                    key={file.id}
                    className="flex flex-wrap items-center justify-between gap-3 rounded-control border border-border p-3"
                  >
                    <span className="min-w-0 break-all text-sm">
                      {file.name} · {formatFileSize(file.size)} · Not uploaded
                    </span>
                    <Button
                      variant="ghost"
                      aria-label={`Remove ${file.name} from local preview`}
                      onClick={() => removeSelectedFile(file.id)}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </Card>
      )}

      {step === 4 && (
        <div className="space-y-4">
          <header>
            <h2 className="text-2xl font-bold text-brand">Review & Submit</h2>
            <p className="mt-1 text-sm text-muted">
              General reimbursement · Step 4 of 4 · Local preview
            </p>
          </header>
          <div className="rounded-control bg-info-subtle p-4 text-sm font-semibold text-info-ink">
            1 Personal & Application <span aria-hidden="true">→</span> 2 Claim
            Details <span aria-hidden="true">→</span> 3 Documents{' '}
            <span aria-hidden="true">→</span> 4 Review & Submit
          </div>
          <Card className="space-y-4">
            <SectionHeading number={1}>
              Personal & Application Information
            </SectionHeading>
            <p className="text-sm text-muted">
              Read-only summary of the information currently entered in Step 1.
            </p>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <SummaryValue label="Applicant" value={personal.fullName} />
              <SummaryValue label="Designation" value={personal.designation} />
              <SummaryValue label="Department" value={personal.department} />
              <SummaryValue label="Staff ID" value={personal.staffId} />
              {personal.referenceTitle && (
                <SummaryValue
                  label="Private reference title"
                  value={personal.referenceTitle}
                />
              )}
            </dl>
          </Card>
          <Card className="space-y-4">
            <SectionHeading number={2}>Claim / Payment Details</SectionHeading>
            <p className="text-sm text-muted">
              Expense particulars entered in Step 2; amounts are not verified.
            </p>
            <p className="text-sm">
              Expense entries: {expenses.length}{' '}
              <span aria-hidden="true">·</span> Claimed total (entry sum):{' '}
              {formatLkr(totalCents)}
            </p>
            <ul className="space-y-2 text-sm">
              {expenses.map((expense, index) => (
                <li
                  key={expense.id}
                  className="break-words border-t border-border pt-2"
                >
                  <span className="font-semibold">Entry {index + 1}</span>
                  {' · '}
                  {expense.date || 'Date not entered'}
                  {' · '}
                  {expense.description || 'Description not entered'}
                  {' · '}
                  {expense.amount
                    ? formatLkr(amountInCents(expense.amount))
                    : 'Amount not entered'}
                </li>
              ))}
            </ul>
            <p className="text-sm font-semibold text-warning-ink">
              This local sum is not an authoritative or payable reimbursement
              amount.
            </p>
          </Card>
          <Card className="space-y-4">
            <SectionHeading number={3}>Supporting Documents</SectionHeading>
            <p className="text-sm text-muted">
              Selected in Step 3 · {selectedFiles.length} file
              {selectedFiles.length === 1 ? '' : 's'} · Not uploaded
            </p>
            {selectedFiles.length > 0 && (
              <ul className="list-disc space-y-1 pl-5 text-sm">
                {selectedFiles.map((file) => (
                  <li key={file.id} className="break-all">
                    {file.name}
                  </li>
                ))}
              </ul>
            )}
          </Card>
          <Card className="space-y-4">
            <h3 className="font-bold text-brand">Declaration</h3>
            <Checkbox
              id="general-reimbursement-declaration"
              label="I declare that the information provided is accurate and supported by valid documents."
              checked={declarationAccepted}
              onChange={(event) => setDeclarationAccepted(event.target.checked)}
              hint="This checkbox only changes the local preview state. It does not record or submit a declaration."
            />
          </Card>
        </div>
      )}

      <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-3">
          {step > 1 && (
            <Button
              variant="ghost"
              onClick={step === 4 ? () => setStep(1) : previousStep}
            >
              {step === 4 ? '← Back to edit' : '← Previous'}
            </Button>
          )}
          <Button
            variant="secondary"
            disabled
            aria-describedby="general-reimbursement-actions-note"
          >
            Save draft
          </Button>
        </div>
        {step < 4 ? (
          <Button
            className="sm:min-w-44"
            onClick={nextStep}
            aria-label={step === 1 ? 'Next: Claim details' : 'Continue'}
          >
            {step === 1 ? 'Next: Claim details →' : 'Continue →'}
          </Button>
        ) : (
          <Button
            variant="success"
            disabled
            aria-describedby="general-reimbursement-actions-note"
          >
            Submit Application →
          </Button>
        )}
      </div>
      <p id="general-reimbursement-actions-note" className="text-sm text-muted">
        Draft persistence, upload, and submission remain disabled until the
        backend contract and official form rules are available.
      </p>
    </div>
  );
}
