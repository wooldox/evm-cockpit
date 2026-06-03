import type { ReactNode } from "react";
import { cx } from "@/shared/lib/cx";

/* Card — elevated panel with optional head / body / foot. */
export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "overflow-clip rounded-md border border-border bg-elev-2",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardHead({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex items-center gap-2.5 border-b border-border px-3.5 py-2.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cx("text-sm font-semibold text-fg", className)}>
      {children}
    </span>
  );
}

export function CardBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  // data-cc lets the compact-density rule in globals.css tighten padding.
  return (
    <div data-cc="card-body" className={cx("p-3.5", className)}>
      {children}
    </div>
  );
}

export function CardFoot({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "border-t border-border bg-elev-1 px-3.5 py-2.5",
        className,
      )}
    >
      {children}
    </div>
  );
}

/* Panel — lighter container (no overflow clip, used for tables/lists). */
export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("rounded-md border border-border bg-elev-2", className)}>
      {children}
    </div>
  );
}
