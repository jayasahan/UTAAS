import { OfficerClaimReviewView } from './OfficerClaimReviewView';
import { syntheticOfficerReview } from './developmentFixture';

export default function DevOfficerClaimReviewPreview() {
  return (
    <div className="space-y-5">
      <div
        role="note"
        className="rounded-control border border-warning/40 bg-amber-50 p-4 text-sm text-amber-950"
      >
        <p className="font-bold">Synthetic fixture preview</p>
        <p>
          This screen contains fictional sample data only. It makes no backend
          requests and does not bypass officer authorization.
        </p>
      </div>
      <OfficerClaimReviewView review={syntheticOfficerReview} />
    </div>
  );
}
