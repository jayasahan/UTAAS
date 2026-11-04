import type { PaperRow } from '../model';
import { estimateLimitations, type VerifiedRates } from '../estimates';

export function EstimateNotice({
  papers,
  rates,
}: {
  papers: PaperRow[];
  rates?: VerifiedRates;
}) {
  const limitations = estimateLimitations(papers, rates);
  return (
    <div className="space-y-2 text-sm text-muted">
      {rates && (
        <p>
          Estimates use supported rates from {rates.circularReference}. Setting
          uses the standard per-paper rate; duration-specific rates are not
          applied.
        </p>
      )}
      {limitations.length > 0 && (
        <ul
          aria-label="Estimate limitations"
          className="list-inside list-disc space-y-1"
        >
          {limitations.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
      <p>
        Row estimates may round differently from the claim total. Only the items
        shown here are estimated. Server-confirmed payment breakdowns and totals
        remain authoritative.
      </p>
    </div>
  );
}
