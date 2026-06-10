import type { CSSProperties, ReactNode } from 'react';
import { cx } from '@/shared/lib/cx';

/* Spinner — inline loading indicator. */
export function Spinner({
  size = 15,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-block animate-spin rounded-full border-2 border-border-strong border-t-read',
        className,
      )}
      style={{ width: size, height: size }}
    />
  );
}

/* Skeleton — shimmering placeholder. */
export function Skeleton({
  width,
  height = 14,
  className,
}: {
  width?: number | string;
  height?: number | string;
  className?: string;
}) {
  const style: CSSProperties = { width, height };
  return (
    <span
      className={cx(
        'block animate-shimmer rounded-xs',
        'bg-[linear-gradient(90deg,var(--bg-elev-3)_25%,var(--bg-elev-4)_37%,var(--bg-elev-3)_63%)] bg-[length:400%_100%]',
        className,
      )}
      style={style}
    />
  );
}

/* Empty — illustrative empty state. */
export function Empty({
  icon,
  title,
  children,
  actions,
  className,
}: {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center gap-3.5 px-6 py-12 text-center',
        className,
      )}
    >
      {icon && (
        <div className="grid size-14 place-items-center rounded-lg border border-border bg-elev-3 text-fg-3">
          {icon}
        </div>
      )}
      <div className="text-base font-semibold text-fg">{title}</div>
      {children && (
        <div className="max-w-[340px] text-[13px] leading-[1.55] text-fg-3">
          {children}
        </div>
      )}
      {actions && <div className="mt-1 flex gap-2">{actions}</div>}
    </div>
  );
}

/* ErrorBanner — inline failure callout. */
export function ErrorBanner({
  icon,
  title,
  children,
  hint,
}: {
  icon?: ReactNode;
  title: ReactNode;
  children?: ReactNode;
  hint?: ReactNode;
}) {
  return (
    <div className="flex gap-[11px] rounded-md border border-danger-border bg-danger-bg p-3">
      <span className="mt-px size-[18px] flex-none text-danger-fg">{icon}</span>
      <div>
        <div className="text-[13px] font-semibold text-danger-fg">{title}</div>
        {children && (
          <div className="mt-0.5 text-xs leading-normal text-fg-2">
            {children}
          </div>
        )}
        {hint && <div className="mt-1.5 text-xs text-fg-3">{hint}</div>}
      </div>
    </div>
  );
}
