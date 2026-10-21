import type { ComponentProps, ReactNode } from 'react';
export function Table({
  caption,
  children,
  variant = 'claim',
  ...props
}: Omit<ComponentProps<'table'>, 'className'> & {
  caption: string;
  children: ReactNode;
  variant?: 'claim' | 'officer';
}) {
  return (
    <div
      role="region"
      aria-label={caption}
      tabIndex={0}
      className="max-w-full overflow-x-auto rounded-control border border-slate-200"
    >
      <table
        {...props}
        data-variant={variant}
        className="ds-table w-full border-collapse bg-surface text-left text-sm"
      >
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}
export function TableHead({ className = '', ...props }: ComponentProps<'th'>) {
  return (
    <th
      scope="col"
      {...props}
      className={`border-b border-border px-4 py-3 font-semibold text-brand ${className}`}
    />
  );
}
export function TableCell({ className = '', ...props }: ComponentProps<'td'>) {
  return (
    <td
      {...props}
      className={`border-b border-slate-100 px-4 py-4 align-top ${className}`}
    />
  );
}
