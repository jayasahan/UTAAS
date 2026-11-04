import { Button } from '../../../components/common/Button';
import { Input, Select } from '../../../components/common/FormControls';
import { Table, TableCell, TableHead } from '../../../components/common/Table';
import {
  estimatePaperBreakdown,
  estimateTotal,
  formatEstimate,
} from '../estimates';
import type { VerifiedRates } from '../estimates';
import type { FieldError, PaperRow } from '../model';
import { quantityLabels } from '../validation';
import { OptionSelect } from '../../../components/common/OptionSelect';
import type { PaperDurationOption } from '../academicOptions';

export function PaymentTable({
  papers,
  rates,
  errors,
  onChange,
  onAdd,
  onRemove,
  durations,
  durationsReady,
  settingUnavailable = false,
}: {
  papers: PaperRow[];
  rates?: VerifiedRates;
  errors: FieldError[];
  onChange: (
    id: string,
    key: keyof Omit<PaperRow, 'id'>,
    value: string,
  ) => void;
  onAdd: () => void;
  onRemove: (id: string) => void;
  durations: readonly PaperDurationOption[];
  durationsReady: boolean;
  settingUnavailable?: boolean;
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
        disabled={
          key === 'settingCount' &&
          settingUnavailable &&
          Number(row.settingCount) === 0
        }
        {...(key === 'settingCount' && settingUnavailable
          ? {
              hint: 'Whole-paper setting is unavailable. A previously entered value can be cleared to 0; shared setting requires the shared-claims feature.',
              max: 0,
            }
          : {})}
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
        {rates
          ? `Estimates use the authenticated backend circular ${rates.circularReference} and its verified per-paper, per-script, per-hour, and per-candidate units. The backend calculates the final amount when the claim is submitted.`
          : 'Estimates are unavailable because a complete, unit-matched circular response is not available. Rates and amounts cannot be entered manually.'}
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
                  <OptionSelect
                    id={`${row.id}-durationHours`}
                    label={`Duration (hours) — paper ${index + 1}`}
                    value={
                      row.durationHours &&
                      Number.isFinite(Number(row.durationHours))
                        ? String(Number(row.durationHours))
                        : row.durationHours
                    }
                    options={durations.map((duration) => ({
                      value: String(duration.hours),
                      label: duration.label,
                    }))}
                    placeholder={
                      !durationsReady
                        ? 'Load academic choices'
                        : durations.length
                          ? 'Select duration'
                          : 'No durations available'
                    }
                    disabled={!durationsReady || durations.length === 0}
                    required
                    className="min-w-48"
                    {...(errors.find(
                      (error) => error.field === `${row.id}-durationHours`,
                    )
                      ? {
                          error: errors.find(
                            (error) =>
                              error.field === `${row.id}-durationHours`,
                          )!.message,
                        }
                      : {})}
                    onChange={(event) =>
                      onChange(row.id, 'durationHours', event.target.value)
                    }
                  />
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
                <TableCell>
                  {formatEstimate(
                    estimatePaperBreakdown(row, rates)?.preparation ?? null,
                  )}
                </TableCell>
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
                <TableCell>
                  {rates
                    ? `${formatEstimate(rates.marking)} / script · ${formatEstimate(rates.secondMarking)} / script`
                    : 'Unavailable'}
                </TableCell>
                <TableCell>
                  {formatEstimate(
                    estimatePaperBreakdown(row, rates)?.marking ?? null,
                  )}
                </TableCell>
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
                <TableCell>
                  {rates
                    ? formatEstimate(
                        row.assessmentUnit === 'hours'
                          ? rates.assessmentPerHour
                          : rates.assessmentPerCandidate,
                      )
                    : 'Unavailable'}
                </TableCell>
                <TableCell>
                  {formatEstimate(
                    estimatePaperBreakdown(row, rates)?.assessment ?? null,
                  )}
                </TableCell>
                <TableCell className="bg-success-subtle font-semibold">
                  {formatEstimate(
                    estimatePaperBreakdown(row, rates)?.total ?? null,
                  )}
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
          <output>{formatEstimate(estimateTotal(papers, rates))}</output>
        </p>
      </div>
      <p className="text-sm text-muted">
        Row amounts and the total are estimates. The server-confirmed total is
        shown only after a successful submission response.
      </p>
    </section>
  );
}
