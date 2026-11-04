import { record } from '../../auth/contracts';
import type { ClaimForm, PaperRow } from './model';

export interface ExaminerShare {
  isShared?: boolean;
  totalQuestions?: number;
  questionsClaimed?: number;
  proportion?: number;
}
export interface CombinedPaperConfig {
  isCombinedPaper?: boolean;
  essayWeightPercent?: number;
  mcqWeightPercent?: number;
  mcqQuestionCount?: number;
}
export interface PaperExtensions {
  settingShare?: ExaminerShare;
  markingShare?: ExaminerShare;
  typedPageCount?: number;
  combinedPaperConfig?: CombinedPaperConfig;
}
export const itemLabels = {
  paperSettingCount: 'Paper setting quantity',
  paperModerationCount: 'Paper moderation quantity',
  paperTranslationCount: 'Paper translation quantity',
  scriptMarkingCount: 'Script marking quantity',
  practicalAssessmentHours: 'Practical assessment hours',
  secondMarkingCount: 'Second marking quantity',
  candidateAssessmentCount: 'Candidate assessment quantity',
  paperTypingPages: 'Paper typing pages',
  continuousAssessmentCount: 'Continuous assessments',
  dissertationUndergradCount: 'Undergraduate dissertations',
  dissertationPostgradCount: 'Postgraduate dissertations',
  thesisMPhilCount: 'MPhil theses',
  thesisPhDCount: 'PhD theses',
} as const;
export type ClaimItems = Partial<Record<keyof typeof itemLabels, number>>;

function quantity(value: unknown, label: string, minimum = 0): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum)
    throw new Error(
      `Invalid stored ${label}. Editing is unavailable to prevent losing claim details.`,
    );
  return value;
}
function numericFields<T extends string>(
  data: Record<string, unknown>,
  keys: readonly T[],
): Partial<Record<T, number>> {
  return Object.fromEntries(
    keys
      .filter((key) => data[key] != null)
      .map((key) => [key, quantity(data[key], key)]),
  ) as Partial<Record<T, number>>;
}
function optionalFlag(data: Record<string, unknown>, key: string) {
  if (data[key] == null) return {};
  if (typeof data[key] !== 'boolean') throw new Error(`Invalid stored ${key}.`);
  return { [key]: data[key] };
}
function decodeShare(value: unknown): ExaminerShare {
  const data = record(value);
  return {
    ...optionalFlag(data, 'isShared'),
    ...numericFields(data, ['questionsClaimed', 'proportion']),
    ...(data.totalQuestions == null
      ? {}
      : {
          totalQuestions: quantity(data.totalQuestions, 'total questions', 1),
        }),
  };
}
/** Explicit allowlists mirror PaperRowDto and its nested DTOs. No response-only fields. */
export function decodePaperExtensions(value: unknown): PaperExtensions {
  const data = record(value);
  const combined =
    data.combinedPaperConfig == null
      ? undefined
      : record(data.combinedPaperConfig);
  return {
    ...(data.settingShare == null
      ? {}
      : { settingShare: decodeShare(data.settingShare) }),
    ...(data.markingShare == null
      ? {}
      : { markingShare: decodeShare(data.markingShare) }),
    ...(data.typedPageCount == null
      ? {}
      : { typedPageCount: quantity(data.typedPageCount, 'typed pages') }),
    ...(combined === undefined
      ? {}
      : {
          combinedPaperConfig: {
            ...optionalFlag(combined, 'isCombinedPaper'),
            ...numericFields(combined, [
              'essayWeightPercent',
              'mcqWeightPercent',
              'mcqQuestionCount',
            ]),
          },
        }),
  };
}
export function decodeClaimItems(value: unknown): ClaimItems | undefined {
  if (value == null) return undefined;
  return numericFields(
    record(value),
    Object.keys(itemLabels) as (keyof ClaimItems)[],
  );
}
export function decodeComments(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value !== 'string')
    throw new Error('Invalid stored applicant comments.');
  return value;
}

/** Nonfinancial quantities only; matches FeeCalculationService.aggregateFromPaperRows.
 * Used to distinguish derived quantities from independent aggregate claims, never to price a claim.
 */
function rowQuantities(papers: PaperRow[]): ClaimItems {
  const totals: ClaimItems = {};
  const add = (key: keyof ClaimItems, value: number) => {
    totals[key] = (totals[key] ?? 0) + value;
  };
  for (const paper of papers.filter((row) => row.title.trim())) {
    const setting = paper.settingShare;
    const marking = paper.markingShare;
    add(
      'paperSettingCount',
      setting?.isShared && setting.totalQuestions
        ? Number(
            ((setting.questionsClaimed ?? 0) / setting.totalQuestions).toFixed(
              4,
            ),
          )
        : Number(paper.settingCount),
    );
    add(
      'scriptMarkingCount',
      marking?.isShared && marking.totalQuestions
        ? Number(
            (
              Number(paper.scriptCount) *
              ((marking.questionsClaimed ?? 0) / marking.totalQuestions)
            ).toFixed(2),
          )
        : Number(paper.scriptCount),
    );
    add('paperModerationCount', Number(paper.moderationCount));
    add('paperTranslationCount', Number(paper.translationCount));
    add('secondMarkingCount', Number(paper.secondMarkingCount));
    add('paperTypingPages', paper.typedPageCount ?? 0);
    add(
      paper.assessmentUnit === 'hours'
        ? 'practicalAssessmentHours'
        : 'candidateAssessmentCount',
      Number(paper.assessmentQuantity),
    );
  }
  return totals;
}
export function preservedItems(form: ClaimForm): ClaimItems | undefined {
  const items = decodeClaimItems(form.items);
  if (!items || !form.originalPapers) return items;
  const previous = rowQuantities(form.originalPapers);
  const current = rowQuantities(form.papers);
  for (const key of Object.keys(items) as (keyof ClaimItems)[]) {
    const before = previous[key] ?? 0;
    const after = current[key] ?? 0;
    if (before === after) continue;
    if (items[key] === before || items[key] === 0) {
      items[key] = after;
    } else {
      throw new Error(
        `Cannot change ${itemLabels[key].toLowerCase()} while a separate saved aggregate exists. The backend must reconcile aggregate and paper quantities before this edit can be saved.`,
      );
    }
  }
  return items;
}

export function hasExtendedPaperValues(paper: PaperExtensions): boolean {
  return !!(
    paper.settingShare?.isShared ||
    paper.markingShare?.isShared ||
    paper.combinedPaperConfig?.isCombinedPaper ||
    paper.typedPageCount
  );
}
