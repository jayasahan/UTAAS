import type { PaperRow } from './model';
import { isMoney, isQuantity } from './validation';

/** Future authenticated rate adapter input. No hardcoded rates or HTTP calls. */
export interface VerifiedRates {
  circularReference: string;
  setting: number;
  moderation: number;
  marking: number;
  secondMarking: number;
  assessmentPerHour: number;
}
export function estimatePaper(
  paper: PaperRow,
  rates?: VerifiedRates,
): number | null {
  if (
    !rates?.circularReference.trim() ||
    !Object.values(rates)
      .filter((v): v is number => typeof v === 'number')
      .every(isMoney)
  )
    return null;
  if (
    Number(paper.translationCount) !== 0 ||
    (paper.assessmentUnit === 'candidates' &&
      Number(paper.assessmentQuantity) > 0)
  )
    return null;
  const counts = [
    paper.settingCount,
    paper.moderationCount,
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
        [rates.setting, rates.moderation, rates.marking, rates.secondMarking][
          index
        ]!,
    ),
  );
  amounts.push(
    round(Number(paper.assessmentQuantity) * rates.assessmentPerHour),
  );
  const total = round(amounts.reduce((sum, amount) => sum + amount, 0));
  return isMoney(total) ? total : null;
}
export function estimateTotal(
  papers: PaperRow[],
  rates?: VerifiedRates,
): number | null {
  if (!papers.length) return null;
  const amounts = papers.map((paper) => estimatePaper(paper, rates));
  if (amounts.some((amount) => amount === null)) return null;
  const total =
    Math.round(
      amounts.reduce<number>((sum, amount) => sum + (amount ?? 0), 0) * 100,
    ) / 100;
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
