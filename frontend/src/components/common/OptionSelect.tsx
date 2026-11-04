import type { ComponentProps } from 'react';
import { Select } from './FormControls';

export interface SelectOption {
  value: string;
  label: string;
}

/** Keep a restored value visible without offering it as an unverified choice. */
export function OptionSelect({
  options,
  placeholder,
  value,
  currentLabel,
  ...props
}: Omit<ComponentProps<typeof Select>, 'children' | 'value'> & {
  options: readonly SelectOption[];
  placeholder: string;
  value: string;
  currentLabel?: string;
}) {
  const missing =
    Boolean(value) && !options.some((option) => option.value === value);
  return (
    <Select {...props} value={value}>
      <option value="">{placeholder}</option>
      {missing && (
        <option value={value} disabled>
          {currentLabel ?? value}
        </option>
      )}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </Select>
  );
}
