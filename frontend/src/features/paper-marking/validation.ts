import { academicLabels, personalLabels } from './model';
import type { ClaimForm, FieldError, PaperRow } from './model';

export const MAX_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_DOCUMENTS = 10;
const allowedTypes: Record<string, readonly string[]> = {
  'application/pdf': ['pdf'],
  'image/png': ['png'],
  'image/jpeg': ['jpg', 'jpeg'],
};
export function validateFile(file: File): string | undefined {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!allowedTypes[file.type]?.includes(extension))
    return 'Choose a PDF, PNG or JPEG file with a matching file extension.';
  if (file.size === 0) return 'Empty files cannot be selected.';
  if (file.size > MAX_FILE_BYTES) return 'Choose a file no larger than 10 MiB.';
  return undefined;
}
export function isQuantity(value: string, integer = false): boolean {
  if (!/^\d+(?:\.\d+)?$/.test(value)) return false;
  const number = Number(value);
  return (
    Number.isFinite(number) &&
    number >= 0 &&
    number <= Number.MAX_SAFE_INTEGER &&
    (!integer || Number.isSafeInteger(number))
  );
}
/** For future verified rate adapters; invalid money must never become a zero. */
export function isMoney(value: number): boolean {
  return (
    Number.isFinite(value) &&
    value >= 0 &&
    value <= Number.MAX_SAFE_INTEGER / 100 &&
    Math.abs(value * 100 - Math.round(value * 100)) < 0.000001
  );
}
export function validateStep(form: ClaimForm, step: number): FieldError[] {
  const errors: FieldError[] = [];
  const add = (field: string, message: string) =>
    errors.push({ field, message, step });
  if (step === 0) {
    for (const key of [
      'fullName',
      'designation',
      'department',
      'staffId',
    ] as const) {
      if (!form.personal[key].trim())
        add(key, `${personalLabels[key]} is required.`);
    }
  }
  if (step === 1) {
    for (const key of Object.keys(
      academicLabels,
    ) as (keyof typeof academicLabels)[]) {
      if (!form.academic[key].trim())
        add(key, `${academicLabels[key]} is required.`);
    }
    if (form.papers.length === 0) add('paper-table', 'Add at least one paper.');
    form.papers.forEach((paper, index) => {
      if (!paper.title.trim())
        add(`${paper.id}-title`, `Paper ${index + 1}: title is required.`);
      if (!isQuantity(paper.durationHours) || Number(paper.durationHours) <= 0)
        add(
          `${paper.id}-durationHours`,
          `Paper ${index + 1}: enter a positive duration in hours.`,
        );
      for (const key of [
        'settingCount',
        'moderationCount',
        'translationCount',
        'scriptCount',
        'secondMarkingCount',
      ] as const) {
        if (!isQuantity(paper[key], true))
          add(
            `${paper.id}-${key}`,
            `Paper ${index + 1}: ${quantityLabels[key]} must be a non-negative whole number.`,
          );
      }
      if (
        !isQuantity(
          paper.assessmentQuantity,
          paper.assessmentUnit === 'candidates',
        )
      )
        add(
          `${paper.id}-assessmentQuantity`,
          `Paper ${index + 1}: assessment quantity must be non-negative${paper.assessmentUnit === 'candidates' ? ' and a whole number' : ''}.`,
        );
      const quantities = [
        paper.settingCount,
        paper.moderationCount,
        paper.translationCount,
        paper.scriptCount,
        paper.secondMarkingCount,
        paper.assessmentQuantity,
      ];
      if (
        quantities.every((value) => isQuantity(value)) &&
        quantities.every((value) => Number(value) === 0)
      )
        add(
          `${paper.id}-settingCount`,
          `Paper ${index + 1}: enter at least one positive claim quantity.`,
        );
    });
  }
  if (step === 2 && form.documents.length === 0)
    add(
      'documents',
      'Select at least one supporting document for local review.',
    );
  return errors;
}
export function validateReview(form: ClaimForm): FieldError[] {
  const errors = [0, 1, 2].flatMap((step) => validateStep(form, step));
  if (!form.declaration)
    errors.push({
      field: 'declaration',
      message:
        'Accept the declaration before the application can be ready for submission.',
      step: 3,
    });
  return errors;
}
export const quantityLabels = {
  settingCount: 'Papers set',
  moderationCount: 'Papers moderated',
  translationCount: 'Papers translated',
  scriptCount: 'Scripts marked',
  secondMarkingCount: 'Scripts second-marked',
} satisfies Partial<Record<keyof PaperRow, string>>;
