import { Card } from '../common/Card';
import { Alert, EmptyState } from '../common/Feedback';
import { WorkflowStepper } from './Steppers';
import type { RequestTracking } from '../../features/requests/contracts';
import {
  workflowProgress,
  type ConfirmedWorkflow,
} from '../../features/requests/workflowTracking';

export function RequestWorkflowProgress({
  detail,
  tracking,
  compact = false,
}: {
  detail: ConfirmedWorkflow;
  tracking: RequestTracking | null;
  compact?: boolean;
}) {
  const progress = workflowProgress(detail, tracking);
  return (
    <div className="min-w-0 space-y-3 [overflow-wrap:anywhere]">
      <Card>
        <p className="font-semibold text-brand">
          Current stage: {progress.label}
        </p>
        <p className="mt-1 text-sm text-muted">
          Assigned role:{' '}
          {progress.assignedRole
            ? progress.assignedRole.replaceAll('_', ' ')
            : 'Not confirmed by a matching stage record'}
        </p>
        {detail.currentStageKey === 'LECTURER_PROPORTION_CONSENSUS' && (
          <p className="mt-2 text-sm">
            Lecturer agreement is pending at the current request stage.
            Individual agreement outcomes are shown only when recorded data is
            available.
          </p>
        )}
      </Card>
      {progress.warnings.map((warning) => (
        <Alert
          key={warning}
          title="Stage history needs confirmation"
          tone="warning"
        >
          <p>{warning}</p>
        </Alert>
      ))}
      {progress.stages.length ? (
        <WorkflowStepper stages={progress.stages} vertical={compact} />
      ) : (
        <EmptyState title="No confirmed stage timeline is available">
          <p>Earlier activity remains in the audit history below.</p>
        </EmptyState>
      )}
    </div>
  );
}
