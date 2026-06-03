import type { ReactNode } from "react";
import { cx } from "@/shared/lib/cx";

/** Inline monospace span — replaces the old `<span class="mono">` used inside
 *  toast/help strings, so we never need dangerouslySetInnerHTML. */
export function Mono({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "font-mono [font-feature-settings:'zero'_1] tracking-[-0.01em]",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Muted helper text. */
export function Muted({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <span className={cx("text-fg-3", className)}>{children}</span>;
}

/** Eyebrow — small uppercase section label. */
export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "text-[11px] font-semibold uppercase tracking-[0.07em] text-fg-3",
        className,
      )}
    >
      {children}
    </span>
  );
}
