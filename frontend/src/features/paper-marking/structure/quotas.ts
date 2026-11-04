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
  settingShare?: { isShared?: boolean; questionsClaimed?: number };
};
export function settingQuotaErrors(
  papers: SettingQuotaRow[],
  data: PaperStructureResponse | null,
  examinerId?: string,
): FieldError[] {
  const availability = settingAvailability(data, examinerId);
  if (!availability) return [];
  return papers.flatMap((row): FieldError[] => {
    if (row.settingShare?.isShared) {
      return (row.settingShare.questionsClaimed ?? 0) > availability.remaining
        ? [
            {
              field: `${row.id}-settingCount`,
              step: 1,
              message: `Shared setting exceeds the current quota: only ${availability.remaining} questions remain after other examiners' claims.`,
            },
          ]
        : [];
    }
    return Number(row.settingCount) > 0 && !availability.wholePaperAvailable
      ? [
          {
            field: `${row.id}-settingCount`,
            step: 1,
            message: `Whole-paper setting is unavailable: other examiners have claimed questions and only ${availability.remaining} remain. Clear this setting quantity. Shared question-setting entry requires the shared-claims feature.`,
          },
        ]
      : [];
  });
}
