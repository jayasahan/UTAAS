import type { FieldError, PaperRow } from '../model';
import type { PaperStructureResponse } from './contracts';

/** Mirrors submission's exclusion of ALL claims belonging to the current applicant. */
export function settingAvailability(
  data: PaperStructureResponse | null,
  examinerId?: string,
) {
  if (!data?.exists || !examinerId) return null;
  const otherQuestions = data.claimsBreakdown.setting.claimants
    .filter((claimant) => claimant.examinerId !== examinerId)
    .reduce((sum, claimant) => sum + claimant.questionsClaimed, 0);
  const remaining = Math.max(
    0,
    data.paperStructure.totalQuestions - otherQuestions,
  );
  return {
    remaining,
    wholePaperAvailable: remaining >= data.paperStructure.totalQuestions,
  };
}
// Structural input also accepts preserved shared rows once the separate form feature is merged.
type SettingQuotaRow = Pick<PaperRow, 'id' | 'settingCount'> & {
  settingShare?: {
    isShared?: boolean;
    questionsClaimed?: number | string;
    totalQuestions?: number;
  };
  markingShare?: {
    isShared?: boolean;
    questionsClaimed?: number | string;
    totalQuestions?: number;
  };
};
export function settingQuotaErrors(
  papers: SettingQuotaRow[],
  data: PaperStructureResponse | null,
  examinerId?: string,
): FieldError[] {
  const availability = settingAvailability(data, examinerId);
  return papers.flatMap((row): FieldError[] => {
    const errors: FieldError[] = [];
    const registeredTotal = data?.exists
      ? data.paperStructure.totalQuestions
      : undefined;
    if (row.settingShare?.isShared) {
      const claimed = Number(row.settingShare.questionsClaimed);
      if (!Number.isSafeInteger(claimed) || claimed < 1)
        errors.push({
          field: `${row.id}-settingShare-questions`,
          step: 1,
          message:
            'Enter a whole number of setting questions greater than zero.',
        });
      else if (registeredTotal !== row.settingShare.totalQuestions)
        errors.push({
          field: `${row.id}-settingShare-questions`,
          step: 1,
          message:
            'The registered question total changed. Turn sharing off and on again to refresh this allocation.',
        });
      else if (availability && claimed > availability.remaining)
        errors.push({
          field: `${row.id}-settingShare-questions`,
          step: 1,
          message: `Shared setting exceeds the current quota: only ${availability.remaining} questions remain after other examiners' claims.`,
        });
    } else if (
      availability &&
      Number(row.settingCount) > 0 &&
      !availability.wholePaperAvailable
    ) {
      errors.push({
        field: `${row.id}-settingCount`,
        step: 1,
        message: `Whole-paper setting is unavailable: other examiners have claimed questions and only ${availability.remaining} remain. Clear this setting quantity.`,
      });
    }
    if (row.markingShare?.isShared) {
      const claimed = Number(row.markingShare.questionsClaimed);
      const markingTotal = row.markingShare.totalQuestions ?? 0;
      if (
        !Number.isSafeInteger(claimed) ||
        claimed < 1 ||
        claimed > markingTotal
      )
        errors.push({
          field: `${row.id}-markingShare-questions`,
          step: 1,
          message: `Enter a whole number from 1 to ${markingTotal} for your marking share.`,
        });
      else if (registeredTotal !== markingTotal)
        errors.push({
          field: `${row.id}-markingShare-questions`,
          step: 1,
          message:
            'The registered question total changed. Turn sharing off and on again to refresh this allocation.',
        });
    }
    return errors;
  });
}
