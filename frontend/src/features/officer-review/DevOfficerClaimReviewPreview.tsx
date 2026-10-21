import { OfficerClaimReviewView } from './OfficerClaimReviewView';
import { syntheticOfficerReview } from './developmentFixture';

async function previewOnlyDecision(): Promise<void> {
  throw new Error('Synthetic preview only. No workflow action was sent.');
}

export default function DevOfficerClaimReviewPreview() {
  return (
    <div className="space-y-5">
      <div
        role="note"
        className="rounded-control border border-warning/40 bg-amber-50 p-4 text-sm text-amber-950"
      >
        <p className="font-bold">Synthetic fixture preview</p>
        <p>
          This screen contains fictional sample data only. Decision controls are
          inert and send no backend requests. The preview does not bypass
          officer authorization.
        </p>
      </div>
      <OfficerClaimReviewView
        review={syntheticOfficerReview}
        onExecuteDecision={previewOnlyDecision}
        actionsEnabled={false}
      />
    </div>
  );
}
