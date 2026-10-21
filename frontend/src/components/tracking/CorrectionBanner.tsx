import { Alert } from '../common/Feedback';
import { Button } from '../common/Button';
export function CorrectionBanner({
  reviewer,
  reason,
  onEdit,
}: {
  reviewer: string;
  reason: string;
  onEdit?: () => void;
}) {
  return (
    <Alert tone="warning" title={`Returned for correction by ${reviewer}`}>
      <p className="whitespace-pre-wrap">{reason}</p>
      {onEdit && (
        <Button variant="warning" className="mt-3" onClick={onEdit}>
          Edit corrections
        </Button>
      )}
    </Alert>
  );
}
