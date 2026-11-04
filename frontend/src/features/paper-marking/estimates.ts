import type { PaperRow } from './model';
import { isMoney, isQuantity } from './validation';
import type { CircularRates } from '../../auth/contracts';

/** Null means missing/unsupported, never an invented zero rate. */
export interface VerifiedRates {
  circularReference: string;
  setting: number | null;
  moderation: number | null;
  translation: number | null;
  marking: number | null;
  secondMarking: number | null;
  assessmentPerCandidate: number | null;
}

const rateContracts = {
  setting: ['PAPER_SETTING', 'per paper'],
  moderation: ['PAPER_MODERATION', 'per paper'],
  translation: ['PAPER_TRANSLATION', 'per paper'],
  marking: ['SCRIPT_MARKING', 'per script'],
  secondMarking: ['SECOND_MARKING', 'per script'],
  assessmentPerCandidate: ['PRACTICAL_ASSESSMENT', 'per script / candidate'],
} as const;

/** Match getApprovedRates(), independently verifying each supported fee line. */
export function verifiedRatesFromCircular(
  circular: CircularRates | null | undefined,
): VerifiedRates | undefined {
  if (!circular?.circularReference.trim()) return undefined;
  const rate = (field: keyof typeof rateContracts): number | null => {
    const [key, unit] = rateContracts[field];
    const item = circular.rates[key];
    return item && item.unit === unit && isMoney(item.rate) ? item.rate : null;
  };
  const rates: VerifiedRates = {
    circularReference: circular.circularReference,
    setting: rate('setting'),
    moderation: rate('moderation'),
    translation: rate('translation'),
    marking: rate('marking'),
    secondMarking: rate('secondMarking'),
    assessmentPerCandidate: rate('assessmentPerCandidate'),
  };
  return Object.values(rates).some((value) => typeof value === 'number')
    ? rates
    : undefined;
}

export interface PaperEstimate {
  preparation: number | null;
  marking: number | null;
  assessment: number | null;
  total: number | null;
}

function line(quantity: string, rate: number | null): number | null {
  if (!isQuantity(quantity, true)) return null;
  // A missing optional rate cannot invalidate an unused fee line.
  if (Number(quantity) === 0) return 0;
  if (rate === null || !isMoney(rate)) return null;
  const amount = Number((Number(quantity) * rate).toFixed(2));
  return isMoney(amount) ? amount : null;
}

function sum(amounts: (number | null)[]): number | null {
  let total = 0;
  for (const amount of amounts) {
    if (amount === null) return null;
    total += amount;
  }
  const rounded = Number(total.toFixed(2));
  return isMoney(rounded) ? rounded : null;
}

function hasUnsupportedRowData(paper: PaperRow): boolean {
  return (
    ('settingShare' in paper && paper.settingShare != null) ||
    ('markingShare' in paper && paper.markingShare != null) ||
    ('combinedPaperConfig' in paper && paper.combinedPaperConfig != null) ||
    ('typedPageCount' in paper &&
      paper.typedPageCount !== undefined &&
      paper.typedPageCount !== 0)
  );
}

export function estimatePaperBreakdown(
  paper: PaperRow,
  rates?: VerifiedRates,
): PaperEstimate | null {
  if (!rates?.circularReference.trim() || hasUnsupportedRowData(paper))
    return null;
  const preparation = sum([
    line(paper.settingCount, rates.setting),
    line(paper.moderationCount, rates.moderation),
    line(paper.translationCount, rates.translation),
  ]);
  const marking = sum([
    line(paper.scriptCount, rates.marking),
    line(paper.secondMarkingCount, rates.secondMarking),
  ]);
  const assessment =
    paper.assessmentUnit === 'candidates'
      ? line(paper.assessmentQuantity, rates.assessmentPerCandidate)
      : paper.assessmentUnit === 'hours' &&
          isQuantity(paper.assessmentQuantity) &&
          Number(paper.assessmentQuantity) === 0
        ? 0
        : null;
  return {
    preparation,
    marking,
    assessment,
    total: sum([preparation, marking, assessment]),
  };
}

export function estimatePaper(
  paper: PaperRow,
  rates?: VerifiedRates,
): number | null {
  return estimatePaperBreakdown(paper, rates)?.total ?? null;
}

const countFields = [
  'settingCount',
  'moderationCount',
  'translationCount',
  'scriptCount',
  'secondMarkingCount',
] as const;

/** Aggregate quantities, then round each fee line once, as the backend does. */
export function estimateTotal(
  papers: PaperRow[],
  rates?: VerifiedRates,
): number | null {
  if (!papers.length || !rates?.circularReference.trim()) return null;
  const aggregate = {
    settingCount: 0,
    moderationCount: 0,
    translationCount: 0,
    scriptCount: 0,
    secondMarkingCount: 0,
  };
  let candidates = 0;
  for (const paper of papers) {
    if (hasUnsupportedRowData(paper)) return null;
    for (const field of countFields) {
      if (!isQuantity(paper[field], true)) return null;
      aggregate[field] += Number(paper[field]);
      if (!Number.isSafeInteger(aggregate[field])) return null;
    }
    if (paper.assessmentUnit === 'candidates') {
      if (!isQuantity(paper.assessmentQuantity, true)) return null;
      candidates += Number(paper.assessmentQuantity);
      if (!Number.isSafeInteger(candidates)) return null;
    } else if (
      paper.assessmentUnit !== 'hours' ||
      !isQuantity(paper.assessmentQuantity) ||
      Number(paper.assessmentQuantity) !== 0
    ) {
      // The circular has no hourly rate. Never reinterpret hours as candidates
      // or silently drop them when the server applies aggregate precedence.
      return null;
    }
  }
  return sum([
    line(String(aggregate.settingCount), rates.setting),
    line(String(aggregate.moderationCount), rates.moderation),
    line(String(aggregate.translationCount), rates.translation),
    line(String(aggregate.scriptCount), rates.marking),
    line(String(aggregate.secondMarkingCount), rates.secondMarking),
    line(String(candidates), rates.assessmentPerCandidate),
  ]);
}

export function estimateLimitations(
  papers: PaperRow[],
  rates?: VerifiedRates,
): string[] {
  if (!rates)
    return [
      'Estimates are unavailable until supported circular rates are loaded.',
    ];
  const messages: string[] = [];
  if (papers.some(hasUnsupportedRowData))
    messages.push(
      'Shared, combined-paper, and typing amounts require server calculation.',
    );
  if (
    papers.some(
      (paper) =>
        paper.assessmentUnit === 'hours' &&
        Number(paper.assessmentQuantity) > 0,
    )
  )
    messages.push(
      'Hour-based assessment estimates are unavailable because the circular does not provide an hourly rate.',
    );
  const fields = [
    ['settingCount', 'setting', 'paper setting'],
    ['moderationCount', 'moderation', 'moderation'],
    ['translationCount', 'translation', 'translation'],
    ['scriptCount', 'marking', 'script marking'],
    ['secondMarkingCount', 'secondMarking', 'second marking'],
  ] as const;
  for (const [field, key, label] of fields)
    if (
      (rates[key] === null || !isMoney(rates[key])) &&
      papers.some((paper) => Number(paper[field]) > 0)
    )
      messages.push(`No supported circular rate is available for ${label}.`);
  if (
    rates.assessmentPerCandidate === null &&
    papers.some(
      (paper) =>
        paper.assessmentUnit === 'candidates' &&
        Number(paper.assessmentQuantity) > 0,
    )
  )
    messages.push(
      'No supported circular rate is available for candidate assessment.',
    );
  if (
    rates.translation === 0 &&
    papers.some((paper) => Number(paper.translationCount) > 0)
  )
    messages.push(
      'Translation has a zero rate in this circular and does not add a payable amount.',
    );
  return messages;
}

export function formatEstimate(value: number | null): string {
  return value === null
    ? 'Unavailable'
    : new Intl.NumberFormat('en-LK', {
        style: 'currency',
        currency: 'LKR',
      }).format(value);
}
