import { useId } from 'react';
import type { ComponentProps, ReactNode } from 'react';
interface FieldProps {
  id: string;
  label: string;
  hint?: string | undefined;
  error?: string | undefined;
  required?: boolean | undefined;
  children: ReactNode;
}
export function FormField({
  id,
  label,
  hint,
  error,
  required,
  children,
}: FieldProps) {
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-semibold text-brand">
        {label}
        {required && <span aria-hidden="true"> *</span>}
      </label>
      {children}
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
interface FieldOptions {
  label: string;
  hint?: string;
  error?: string;
}
function descriptions(
  id: string,
  hint?: string,
  error?: string,
  additional?: string,
) {
  return (
    [additional, hint ? `${id}-hint` : '', error ? `${id}-error` : '']
      .filter(Boolean)
      .join(' ') || undefined
  );
}
export function Input({
  label,
  hint,
  error,
  id: suppliedId,
  className = '',
  required,
  ...props
}: ComponentProps<'input'> & FieldOptions) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  return (
    <FormField
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
    >
      <input
        {...props}
        id={id}
        required={required}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={descriptions(
          id,
          hint,
          error,
          props['aria-describedby'],
        )}
        className={`field-control ${className}`}
      />
    </FormField>
  );
}
export function Textarea({
  label,
  hint,
  error,
  id: suppliedId,
  className = '',
  required,
  ...props
}: ComponentProps<'textarea'> & FieldOptions) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  return (
    <FormField
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
    >
      <textarea
        rows={4}
        {...props}
        id={id}
        required={required}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={descriptions(
          id,
          hint,
          error,
          props['aria-describedby'],
        )}
        className={`field-control ${className}`}
      />
    </FormField>
  );
}
export function Select({
  label,
  hint,
  error,
  id: suppliedId,
  className = '',
  required,
  children,
  ...props
}: ComponentProps<'select'> & FieldOptions) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  return (
    <FormField
      id={id}
      label={label}
      hint={hint}
      error={error}
      required={required}
    >
      <select
        {...props}
        id={id}
        required={required}
        aria-invalid={error ? true : props['aria-invalid']}
        aria-describedby={descriptions(
          id,
          hint,
          error,
          props['aria-describedby'],
        )}
        className={`field-control ${className}`}
      >
        {children}
      </select>
    </FormField>
  );
}
export function Checkbox({
  label,
  hint,
  error,
  id: suppliedId,
  className = '',
  ...props
}: Omit<ComponentProps<'input'>, 'type'> & FieldOptions) {
  const generatedId = useId();
  const id = suppliedId ?? generatedId;
  return (
    <div className="space-y-2">
      <label htmlFor={id} className="flex items-start gap-3 text-sm text-ink">
        <input
          {...props}
          id={id}
          type="checkbox"
          aria-invalid={error ? true : props['aria-invalid']}
          aria-describedby={descriptions(
            id,
            hint,
            error,
            props['aria-describedby'],
          )}
          className={`mt-0.5 size-5 shrink-0 accent-action ${className}`}
        />
        {label}
      </label>
      {hint && (
        <p id={`${id}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm font-semibold text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
