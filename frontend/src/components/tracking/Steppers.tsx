export interface FormStep {
  id: string;
  label: string;
}
export function FormStepper({
  steps,
  currentStepId,
  onStepChange,
}: {
  steps: readonly FormStep[];
  currentStepId: string;
  onStepChange?: (id: string) => void;
}) {
  return (
    <nav aria-label="Application form progress">
      <ol className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {steps.map((step, index) => (
          <li
            key={step.id}
            aria-current={step.id === currentStepId ? 'step' : undefined}
            className={`rounded-control px-4 py-4 text-sm ${step.id === currentStepId ? 'focus-on-dark bg-brand font-semibold text-white' : 'border border-slate-200 bg-white text-ink'}`}
          >
            {onStepChange ? (
              <button
                type="button"
                className="w-full rounded text-left"
                onClick={() => onStepChange(step.id)}
              >
                {index + 1}. {step.label}
              </button>
            ) : (
              <span>
                {index + 1}. {step.label}
              </span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}
export interface WorkflowDisplayStage {
  id: string;
  label: string;
  state: 'completed' | 'active' | 'pending' | 'returned' | 'rejected';
  detail?: string;
}
const states = {
  completed: { label: 'Completed', icon: '✓', style: 'bg-success text-white' },
  active: { label: 'In progress', icon: '●', style: 'bg-action text-white' },
  pending: {
    label: 'Pending',
    icon: '○',
    style: 'bg-slate-200 text-slate-700',
  },
  returned: {
    label: 'Returned for correction',
    icon: '!',
    style: 'bg-warning text-white',
  },
  rejected: { label: 'Rejected', icon: '×', style: 'bg-danger text-white' },
};
export function WorkflowStepper({
  stages,
  orientation = 'responsive',
}: {
  stages: readonly WorkflowDisplayStage[];
  orientation?: 'responsive' | 'vertical';
}) {
  const isVertical = orientation === 'vertical';
  return (
    <section
      aria-label="Approval workflow"
      className="rounded-card bg-surface p-6"
    >
      <ol
        className={
          isVertical
            ? 'workflow-stepper-vertical flex flex-col'
            : 'flex flex-col xl:flex-row'
        }
      >
        {stages.map((stage) => {
          const state = states[stage.state];
          return (
            <li
              key={stage.id}
              aria-current={stage.state === 'active' ? 'step' : undefined}
              data-state={stage.state}
              className="workflow-stage"
            >
              <span
                aria-hidden="true"
                className={`relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full font-bold ${state.style}`}
              >
                {state.icon}
              </span>
              <div className={isVertical ? 'min-w-0 flex-1' : undefined}>
                <p className="text-sm font-semibold text-brand">
                  {stage.label}
                </p>
                <p className="text-xs text-ink">{state.label}</p>
                {stage.detail && (
                  <p className="mt-1 text-xs text-muted">{stage.detail}</p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
