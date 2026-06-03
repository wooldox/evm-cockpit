import type { ReactNode } from "react";
import { tv } from "tailwind-variants";
import { cx } from "@/shared/lib/cx";

export type SimStatusKind = "idle" | "success" | "revert";

/* ---------- shell + status tints ---------- */
const simShell = tv({
  base: "overflow-clip rounded-md border bg-elev-2",
  variants: {
    status: {
      idle: "border-border",
      success: "border-success-border",
      revert: "border-danger-border",
    },
  },
});

const simStatusRow = tv({
  base: "flex items-center gap-[11px] border-b border-border px-3.5 py-3",
  variants: {
    status: {
      idle: "bg-elev-1",
      success: "bg-success-bg",
      revert: "bg-danger-bg",
    },
  },
});

const simIcon = tv({
  base: "grid size-[30px] flex-none place-items-center rounded-full [&_svg]:size-[17px]",
  variants: {
    status: {
      idle: "bg-neutral-bg text-fg-3",
      success: "bg-success text-white",
      revert: "bg-danger text-white",
    },
  },
});

const headlineColor: Record<SimStatusKind, string> = {
  idle: "text-fg",
  success: "text-success-fg",
  revert: "text-danger-fg",
};

/* ---------- pieces ---------- */
export function SimShell({
  status,
  children,
  className,
}: {
  status: SimStatusKind;
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx(simShell({ status }), className)}>{children}</div>;
}

export function SimStatus({
  status,
  icon,
  headline,
  sub,
  aside,
}: {
  status: SimStatusKind;
  icon: ReactNode;
  headline: ReactNode;
  sub?: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className={simStatusRow({ status })}>
      <span className={simIcon({ status })}>{icon}</span>
      <div className="flex-1">
        <div className={cx("text-sm font-semibold", headlineColor[status])}>
          {headline}
        </div>
        {sub && <div className="text-xs text-fg-3">{sub}</div>}
      </div>
      {aside}
    </div>
  );
}

export function SimDetail({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2.5 px-3.5 py-3">{children}</div>;
}

export function RevertReason({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-sm border border-danger-border bg-danger-bg px-[11px] py-[9px] font-mono text-[13px] leading-normal text-danger-fg">
      {children}
    </div>
  );
}

/* ---------- raw-tx grid + metric ---------- */
export function TxGrid({ children }: { children: ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-x-3.5 gap-y-2.5 max-[860px]:grid-cols-2">
      {children}
    </div>
  );
}

export function TxField({
  label,
  value,
  mono = true,
}: {
  label: ReactNode;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-fg-3">
        {label}
      </span>
      <span
        className={cx("break-all text-[13px] text-fg", mono && "font-mono")}
      >
        {value}
      </span>
    </div>
  );
}

export function Metric({
  label,
  value,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-0.5", className)}>
      <span className="text-[11px] font-semibold uppercase tracking-[0.04em] text-fg-3">
        {label}
      </span>
      <span className="font-mono text-[15px] font-medium text-fg">{value}</span>
    </div>
  );
}
