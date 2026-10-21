import { steps } from '../model';

/** PRIMARY 67:2 compact review strip. Keep backward editing keyboard accessible. */
export function ReviewProgress({ onEdit }: { onEdit: (step: number) => void }) {
  return (
    <nav
      aria-label="Application form progress"
      className="rounded-control bg-sky-100 p-4 text-sm font-semibold text-sky-800"
    >
      <ol className="flex flex-wrap items-center gap-x-3 gap-y-4">
        {steps.map((step, index) => (
          <li
            key={step.id}
            className="flex min-w-0 items-center gap-3"
            aria-current={index === 3 ? 'step' : undefined}
          >
            {index < 3 ? (
              <button
                type="button"
                className="min-h-11 rounded text-left underline-offset-4 hover:underline"
                onClick={() => onEdit(index)}
              >
                {index + 1} {step.label}
              </button>
            ) : (
              <span>
                {index + 1} {step.label}
              </span>
            )}
            {index < 3 && <span aria-hidden="true">→</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
