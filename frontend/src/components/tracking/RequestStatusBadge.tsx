import { Badge } from '../common/Feedback';
import type { Tone, BadgeAppearance } from '../common/Feedback';
// Display values mirror inspected RequestStatus; no transition logic or API calls.
export type RequestDisplayStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'UNDER_REVIEW'
  | 'RETURNED_FOR_CORRECTION'
  | 'APPROVED'
  | 'REJECTED'
  | 'SETTLED';
const statuses: Record<RequestDisplayStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: 'Draft', tone: 'neutral' },
  SUBMITTED: { label: 'Submitted', tone: 'info' },
  UNDER_REVIEW: { label: 'Under review', tone: 'info' },
  RETURNED_FOR_CORRECTION: {
    label: 'Returned for correction',
    tone: 'warning',
  },
  APPROVED: { label: 'Approved', tone: 'success' },
  REJECTED: { label: 'Rejected', tone: 'danger' },
  SETTLED: { label: 'Settled', tone: 'success' },
};
export function RequestStatusBadge({
  status,
  appearance = 'solid',
}: {
  status: RequestDisplayStatus;
  appearance?: BadgeAppearance;
}) {
  const config = statuses[status];
  return (
    <Badge tone={config.tone} appearance={appearance}>
      {config.label}
    </Badge>
  );
}
