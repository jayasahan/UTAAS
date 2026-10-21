import type { ComponentProps } from 'react';
const variants = {
  primary: 'bg-action text-white hover:bg-blue-700',
  secondary: 'bg-brand text-white hover:bg-slate-800',
  success: 'bg-success text-white hover:bg-teal-800',
  warning: 'bg-warning text-white hover:bg-amber-800',
  danger: 'bg-danger text-white hover:bg-red-800',
  ghost: 'border border-border bg-white text-brand hover:bg-slate-100',
};
interface ButtonProps extends ComponentProps<'button'> {
  variant?: keyof typeof variants;
  pending?: boolean;
}
export function Button({
  variant = 'primary',
  pending = false,
  disabled,
  type = 'button',
  className = '',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      type={type}
      disabled={disabled || pending}
      aria-busy={pending || undefined}
      className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-control px-4 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${className}`}
    >
      {pending && <span aria-hidden="true">…</span>}
      {children}
    </button>
  );
}
