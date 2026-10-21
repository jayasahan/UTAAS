import type { ReactNode } from 'react';
import { Button } from './Button';
export type Tone = 'neutral' | 'info' | 'success' | 'warning' | 'danger';
export type BadgeAppearance = 'solid' | 'soft';
const solidTones: Record<Tone, string> = {
  neutral: 'bg-muted text-white',
  info: 'bg-action text-white',
  success: 'bg-success text-white',
  warning: 'bg-warning text-white',
  danger: 'bg-danger text-white',
};
const tones: Record<Tone, string> = {
  neutral: 'bg-slate-100 text-slate-700',
  info: 'bg-blue-50 text-blue-800',
  success: 'bg-teal-50 text-teal-800',
  warning: 'bg-amber-50 text-amber-800',
  danger: 'bg-red-50 text-red-800',
};
const softBadgeTones: Record<Tone, string> = {
  ...tones,
  info: 'bg-info-subtle text-info-ink',
  success: 'bg-success-subtle text-success-ink',
  warning: 'bg-warning-subtle text-warning-ink',
};
export function Badge({
  children,
  tone = 'neutral',
  appearance = 'solid',
}: {
  children: ReactNode;
  tone?: Tone;
  appearance?: BadgeAppearance;
}) {
  return (
    <span
      data-tone={tone}
      data-appearance={appearance}
      className={`inline-flex rounded-md px-3 py-1 text-sm font-semibold ${appearance === 'solid' ? solidTones[tone] : softBadgeTones[tone]}`}
    >
      {children}
    </span>
  );
}
export function Alert({
  title,
  children,
  tone = 'info',
  urgent = false,
}: {
  title: string;
  children?: ReactNode;
  tone?: Tone;
  urgent?: boolean;
}) {
  return (
    <div
      role={urgent ? 'alert' : 'status'}
      className={`rounded-control border border-current/15 p-4 ${tones[tone]}`}
    >
      <p className="font-semibold">{title}</p>
      {children && <div className="mt-2 text-sm">{children}</div>}
    </div>
  );
}
export function Skeleton({ label = 'Loading content' }: { label?: string }) {
  return (
    <div role="status" className="space-y-3">
      <span className="sr-only">{label}</span>
      <div
        aria-hidden="true"
        className="h-5 w-2/3 rounded bg-slate-200 motion-safe:animate-pulse"
      />
      <div
        aria-hidden="true"
        className="h-5 rounded bg-slate-200 motion-safe:animate-pulse"
      />
    </div>
  );
}
export function EmptyState({
  title,
  children,
  onRetry,
}: {
  title: string;
  children?: ReactNode;
  onRetry?: () => void;
}) {
  return (
    <div className="rounded-card border border-dashed border-border p-6 text-center">
      <p className="font-semibold text-brand">{title}</p>
      {children && <div className="mt-2 text-sm text-muted">{children}</div>}
      {onRetry && (
        <Button variant="ghost" className="mt-4" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
