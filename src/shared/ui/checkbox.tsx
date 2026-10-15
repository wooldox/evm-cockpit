'use client';

import {
  useEffect,
  useRef,
  type InputHTMLAttributes,
  type ReactNode,
} from 'react';
import { cx } from '@/shared/lib/cx';
import { Icon } from '@/shared/icons';

export interface CheckboxProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'type' | 'size'
> {
  /** Partially-checked state (e.g. "some contracts in this chain selected"). */
  indeterminate?: boolean;
  label?: ReactNode;
}

/* Native checkbox (keyboard/form/a11y for free) with a custom look. */
export function Checkbox({
  indeterminate = false,
  label,
  className,
  ...rest
}: CheckboxProps) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  const box = (
    <span className="relative inline-grid size-4 flex-none place-items-center">
      <input
        ref={ref}
        type="checkbox"
        className={cx(
          'peer size-4 cursor-pointer appearance-none rounded-[4px] border border-border-strong bg-elev-3 transition-colors',
          'checked:border-read checked:bg-read indeterminate:border-read indeterminate:bg-read',
          'hover:border-[var(--gray-500)] focus-visible:outline-none focus-visible:[box-shadow:0_0_0_3px_var(--read-bg)]',
          'disabled:cursor-not-allowed disabled:opacity-50',
        )}
        {...rest}
      />
      <Icon.check
        size={11}
        className="pointer-events-none absolute text-white opacity-0 peer-checked:opacity-100 peer-indeterminate:opacity-0"
      />
      <span className="pointer-events-none absolute h-[2px] w-2 rounded-full bg-white opacity-0 peer-indeterminate:opacity-100" />
    </span>
  );

  if (!label) return <span className={className}>{box}</span>;
  return (
    <label
      className={cx(
        'inline-flex cursor-pointer select-none items-center gap-2 text-[13px] text-fg-2',
        className,
      )}
    >
      {box}
      {label}
    </label>
  );
}
