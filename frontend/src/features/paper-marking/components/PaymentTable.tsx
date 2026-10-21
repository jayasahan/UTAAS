import { Button } from '../../../components/common/Button';
import { Input, Select } from '../../../components/common/FormControls';
import { Table, TableCell, TableHead } from '../../../components/common/Table';
import { estimatePaper, estimateTotal, formatEstimate } from '../estimates';
import type { FieldError, PaperRow } from '../model';
import { quantityLabels } from '../validation';

export function PaymentTable({
  papers,
  errors,
  onChange,
  onAdd,
  onRemove,
}: {
  papers: PaperRow[];
  errors: FieldError[];
  onChange: (
    id: string,
    key: keyof Omit<PaperRow, 'id'>,
    value: string,
  ) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
}) {
  function field(
    row: PaperRow,
    index: number,
    key:
      | keyof typeof quantityLabels
      | 'title'
      | 'durationHours'
      | 'assessmentQuantity',
    label: string,
    integer = true,
  ) {
    const id = `${row.id}-${key}`;
    const error = errors.find((item) => item.field === id);
    return (
      <Input
        id={id}
        label={`${label} — paper ${index + 1}`}
        value={row[key]}
        required
        maxLength={key === 'title' ? 200 : 16}
        className={key === 'title' ? 'min-w-48' : 'min-w-32'}
        {...(key === 'title'
          ? {}
          : {
              inputMode: integer ? ('numeric' as const) : ('decimal' as const),
            })}
        {...(error ? { error: error.message } : {})}
        onChange={(event) => onChange(row.id, key, event.target.value)}
      />
    );
  }
  return (
    <section aria-labelledby="payment-heading" className="space-y-4">
      <h2 id="payment-heading" className="text-2xl font-bold text-brand">
        Paper Setting, Marking & Assessment Particulars
      </h2>
      <p className="text-sm text-muted">
        One row per paper. Scroll the table horizontally to reach all columns.
        Duration describes the paper; assessment hours and candidates are
        distinct units.
      </p>
      <p
        id="rate-limitation"
        className="rounded-control bg-blue-50 p-4 text-sm text-brand"
      >
        Estimates unavailable: authenticated circular rates are not connected.
        Translation and candidate-based assessment rules also require
        confirmation. Rates and amounts cannot be entered manually.
      </p>
      <div id="paper-table" className="paper-payment-table" tabIndex={-1}>
        <Table
          caption="Paper payment details"
          aria-describedby="rate-limitation"
        >
          <thead>
            <tr>
              <TableHead rowSpan={2}>Title of paper</TableHead>
              <TableHead scope="colgroup" colSpan={5}>
                Setting / Moderating / Translating
              </TableHead>
              <TableHead scope="colgroup" colSpan={4}>
                Marking scripts
              </TableHead>
              <TableHead scope="colgroup" colSpan={4}>
                Assessing Practical / Clinical / Oral
              </TableHead>
              <TableHead rowSpan={2}>Total estimate (LKR)</TableHead>
              <TableHead rowSpan={2}>Actions</TableHead>
            </tr>
            <tr>
              {[
                'Duration (hours)',
                'Papers set',
                'Papers moderated',
                'Papers translated',
                'Amount (LKR)',
                'Scripts marked',
                'Second marking',
                'Rate (LKR)',
                'Amount (LKR)',
                'Unit',
                'Quantity',
                'Rate (LKR)',
                'Amount (LKR)',
              ].map((label, index) => (
                <TableHead key={index}>{label}</TableHead>
              ))}
            </tr>
          </thead>
          <tbody>
            {papers.map((row, index) => (
              <tr key={row.id} className="even:bg-slate-50">
                <TableCell>
                  {field(row, index, 'title', 'Title of paper')}
                </TableCell>
                <TableCell>
                  {field(
                    row,
                    index,
                    'durationHours',
                    'Duration (hours)',
                    false,
                  )}
                </TableCell>
                {(
                  [
                    'settingCount',
                    'moderationCount',
                    'translationCount',
                  ] as const
                ).map((key) => (
                  <TableCell key={key}>
                    {field(row, index, key, quantityLabels[key])}
                  </TableCell>
                ))}
                <TableCell>Unavailable</TableCell>
                <TableCell>
                  {field(row, index, 'scriptCount', quantityLabels.scriptCount)}
                </TableCell>
                <TableCell>
                  {field(
                    row,
                    index,
                    'secondMarkingCount',
                    quantityLabels.secondMarkingCount,
                  )}
                </TableCell>
                <TableCell>Unavailable</TableCell>
                <TableCell>Unavailable</TableCell>
                <TableCell>
                  <Select
                    id={`${row.id}-assessmentUnit`}
                    label={`Assessment unit — paper ${index + 1}`}
                    value={row.assessmentUnit}
                    onChange={(event) =>
                      onChange(row.id, 'assessmentUnit', event.target.value)
                    }
                    className="min-w-40"
                  >
                    <option value="candidates">Candidates</option>
                    <option value="hours">Hours</option>
                  </Select>
                </TableCell>
                <TableCell>
                  {field(
                    row,
                    index,
                    'assessmentQuantity',
                    `Assessment ${row.assessmentUnit}`,
                    row.assessmentUnit === 'candidates',
                  )}
                </TableCell>
                <TableCell>Unavailable</TableCell>
                <TableCell>Unavailable</TableCell>
                <TableCell className="bg-success-subtle font-semibold">
                  {formatEstimate(estimatePaper(row))}
                </TableCell>
                <TableCell>
                  <Button
                    variant="ghost"
                    aria-label={`Remove paper ${index + 1}`}
                    onClick={() => onRemove(row.id)}
                  >
                    Remove
                  </Button>
                </TableCell>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>
      {papers.length === 0 && (
        <p className="text-sm text-muted">No papers added.</p>
      )}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Button id="add-paper" variant="ghost" onClick={onAdd}>
          + Add paper row
        </Button>
        <p className="rounded-control bg-success-subtle p-4 font-semibold text-brand">
          TOTAL PAYMENT ESTIMATE:{' '}
          <output>{formatEstimate(estimateTotal(papers))}</output>
        </p>
      </div>
      <p className="text-sm text-muted">
        No final payable amount is calculated or submitted in Phase 1.
      </p>
    </section>
  );
}
