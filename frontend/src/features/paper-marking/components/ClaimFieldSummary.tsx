import type { PaperExtensions, ClaimItems } from '../supportedFields';
import { itemLabels } from '../supportedFields';

const extensionLabels: Record<string, string> = {
  isShared: 'Shared',
  totalQuestions: 'Total questions',
  questionsClaimed: 'Questions claimed',
  proportion: 'Stored proportion',
  isCombinedPaper: 'Combined paper',
  essayWeightPercent: 'Essay weight (%)',
  mcqWeightPercent: 'MCQ weight (%)',
  mcqQuestionCount: 'MCQ questions',
};
function Fields({ values }: { values: object }) {
  return (
    <dl className="grid gap-2 sm:grid-cols-2">
      {Object.entries(values).map(([key, value]) => (
        <div key={key}>
          <dt className="text-sm text-muted">{extensionLabels[key] ?? key}</dt>
          <dd>
            {typeof value === 'boolean'
              ? value
                ? 'Yes'
                : 'No'
              : String(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/** Read-only stored quantities, never a financial estimate or an authorization to edit. */
export function ClaimFieldSummary({
  papers,
  items,
  comments,
}: {
  papers: (PaperExtensions & { title: string | null })[];
  items?: ClaimItems | undefined;
  comments?: string | undefined;
}) {
  const rows = papers.filter(
    (paper) =>
      paper.settingShare ||
      paper.markingShare ||
      paper.combinedPaperConfig ||
      paper.typedPageCount !== undefined,
  );
  if (!rows.length && !items && comments === undefined) return null;
  return (
    <section
      aria-label="Additional stored claim details"
      className="space-y-4 rounded-control border border-border p-4 [overflow-wrap:anywhere]"
    >
      <h3 className="font-semibold text-brand">
        Additional stored claim details
      </h3>
      {rows.map((paper, index) => (
        <div key={index} className="space-y-3 border-t border-border pt-3">
          <h4 className="font-semibold">
            {paper.title || `Paper ${index + 1}`}
          </h4>
          {paper.settingShare && (
            <div>
              <h5 className="font-semibold">Setting share</h5>
              <Fields values={paper.settingShare} />
            </div>
          )}
          {paper.markingShare && (
            <div>
              <h5 className="font-semibold">Marking share</h5>
              <Fields values={paper.markingShare} />
            </div>
          )}
          {paper.typedPageCount !== undefined && (
            <p>Typed pages: {paper.typedPageCount}</p>
          )}
          {paper.combinedPaperConfig && (
            <div>
              <h5 className="font-semibold">Combined paper configuration</h5>
              <Fields values={paper.combinedPaperConfig} />
            </div>
          )}
        </div>
      ))}
      {items && (
        <div>
          <h4 className="font-semibold">Stored aggregate quantities</h4>
          <dl className="grid gap-2 sm:grid-cols-2">
            {(Object.keys(items) as (keyof ClaimItems)[]).map((key) => (
              <div key={key}>
                <dt className="text-sm text-muted">{itemLabels[key]}</dt>
                <dd>{items[key]}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
      {comments !== undefined && (
        <div>
          <h4 className="font-semibold">Applicant comments</h4>
          <p className="whitespace-pre-wrap">{comments || 'No comments'}</p>
        </div>
      )}
      <p className="text-sm text-muted">
        These stored details are retained when saving or resubmitting. Payment
        amounts are confirmed by the server.
      </p>
    </section>
  );
}
