import type { ComponentProps } from 'react';
export function Card({ className = '', ...props }: ComponentProps<'div'>) {
  return (
    <div
      {...props}
      className={`rounded-card border border-slate-200 bg-surface p-6 ${className}`}
    />
  );
}
