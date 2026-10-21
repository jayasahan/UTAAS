import type { PaperRow } from './model';
import { isMoney, isQuantity } from './validation';
import type { CircularRates } from '../../auth/contracts';

/** Future authenticated rate adapter input. No hardcoded rates or HTTP calls. */
export interface VerifiedRates {
  circularReference: string;
  setting: number;
  moderation: number;
  translation: number;
  marking: number;
  secondMarking: number;
  assessmentPerHour: number;
  assessmentPerCandidate: number;
}

const rateUnits = {
  PAPER_SETTING: 'per paper',
  PAPER_MODERATION: 'per paper',
  PAPER_TRANSLATION: 'per paper',
  SCRIPT_MARKING: 'per script',
  SECOND_MARKING: 'per script',
  PRACTICAL_ASSESSMENT: 'per hour',
  CANDIDATE_ASSESSMENT: 'per candidate',
} as const;

/** Accept rates only when every known backend line and unit matches its source contract. */
export function verifiedRatesFromCircular(
  circular: CircularRates | null | undefined,
): VerifiedRates | undefined {
  if (!circular?.circularReference.trim()) return undefined;
  const amounts = {} as Record<keyof typeof rateUnits, number>;
  for (const [key, unit] of Object.entries(rateUnits) as [
    keyof typeof rateUnits,
    (typeof rateUnits)[keyof typeof rateUnits],
  ][]) {
    const item = circular.rates[key];
    if (!item || item.unit !== unit || !isMoney(item.rate)) return undefined;
    amounts[key] = item.rate;
  }
  return {
    circularReference: circular.circularReference,
    setting: amounts.PAPER_SETTING,
    moderation: amounts.PAPER_MODERATION,
    translation: amounts.PAPER_TRANSLATION,
    marking: amounts.SCRIPT_MARKING,
    secondMarking: amounts.SECOND_MARKING,
    assessmentPerHour: amounts.PRACTICAL_ASSESSMENT,
    assessmentPerCandidate: amounts.CANDIDATE_ASSESSMENT,
  };
}
export interface PaperEstimate {
  preparation: number;
  marking: number;
  assessment: number;
  total: number;
}

export function estimatePaperBreakdown(
  paper: PaperRow,
  rates?: VerifiedRates,
): PaperEstimate | null {
  if (
    !rates?.circularReference.trim() ||
    !Object.values(rates)
      .filter((v): v is number => typeof v === 'number')
      .every(isMoney)
  )
    return null;
  const counts = [
    paper.settingCount,
    paper.moderationCount,
    paper.translationCount,
    paper.scriptCount,
    paper.secondMarkingCount,
  ];
  if (
    !counts.every((value) => isQuantity(value, true)) ||
    !isQuantity(paper.translationCount, true) ||
    !isQuantity(paper.assessmentQuantity, paper.assessmentUnit === 'candidates')
  )
    return null;
  // Match the inspected service: round each fee line before summing.
  const round = (value: number) => Number(value.toFixed(2));
  const amounts = counts.map((value, index) =>
    round(
      Number(value) *
        [
          rates.setting,
          rates.moderation,
          rates.translation,
          rates.marking,
          rates.secondMarking,
        ][index]!,
    ),
  );
  amounts.push(
    round(
      Number(paper.assessmentQuantity) *
        (paper.assessmentUnit === 'hours'
          ? rates.assessmentPerHour
          : rates.assessmentPerCandidate),
    ),
  );
  const preparation = round(amounts[0]! + amounts[1]! + amounts[2]!);
  const marking = round(amounts[3]! + amounts[4]!);
  const assessment = amounts[5]!;
  const total = round(preparation + marking + assessment);
  return [preparation, marking, assessment, total].every(isMoney)
    ? { preparation, marking, assessment, total }
    : null;
}

export function estimatePaper(
  paper: PaperRow,
  rates?: VerifiedRates,
): number | null {
  return estimatePaperBreakdown(paper, rates)?.total ?? null;
}
export function estimateTotal(
  papers: PaperRow[],
  rates?: VerifiedRates,
): number | null {
  if (!papers.length) return null;
  if (
    !rates?.circularReference.trim() ||
    !Object.values(rates)
      .filter((value): value is number => typeof value === 'number')
      .every(isMoney)
  )
    return null;
  const aggregate = {
    setting: 0,
    moderation: 0,
    translation: 0,
    marking: 0,
    secondMarking: 0,
    hours: 0,
    candidates: 0,
  };
  for (const paper of papers) {
    const counts = [
      paper.settingCount,
      paper.moderationCount,
      paper.translationCount,
      paper.scriptCount,
      paper.secondMarkingCount,
    ];
    if (
      !counts.every((value) => isQuantity(value, true)) ||
      !isQuantity(
        paper.assessmentQuantity,
        paper.assessmentUnit === 'candidates',
      )
    )
      return null;
    aggregate.setting += Number(paper.settingCount);
    aggregate.moderation += Number(paper.moderationCount);
    aggregate.translation += Number(paper.translationCount);
    aggregate.marking += Number(paper.scriptCount);
    aggregate.secondMarking += Number(paper.secondMarkingCount);
    aggregate[paper.assessmentUnit] += Number(paper.assessmentQuantity);
  }
  const round = (value: number) => Number(value.toFixed(2));
  const total = round(
    round(aggregate.setting * rates.setting) +
      round(aggregate.moderation * rates.moderation) +
      round(aggregate.translation * rates.translation) +
      round(aggregate.marking * rates.marking) +
      round(aggregate.secondMarking * rates.secondMarking) +
      round(aggregate.hours * rates.assessmentPerHour) +
      round(aggregate.candidates * rates.assessmentPerCandidate),
  );
  return isMoney(total) ? total : null;
}
export function formatEstimate(value: number | null): string {
  return value === null
    ? 'Unavailable'
    : new Intl.NumberFormat('en-LK', {
        style: 'currency',
        currency: 'LKR',
      }).format(value);
}
