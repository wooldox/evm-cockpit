import type { ReactNode } from "react";
import { tv, type VariantProps } from "tailwind-variants";

/** Minimal chain descriptor used by ChainGlyph and ChainBadge. */
export interface Chain {
  name: string;
  short: string;
  color: string;
}

/* ============================================================
   ChainGlyph — the little colored network token, reused in the
   sidebar, topbar, chain menu and chain badge.
   ============================================================ */
export function ChainGlyph({
  chain,
  size = 16,
}: {
  chain: Chain;
  size?: number;
}) {
  return (
    <span
      className="inline-grid flex-none place-items-center rounded-full font-bold text-white"
      style={{
        background: chain.color,
        width: size,
        height: size,
        fontSize: Math.round(size * 0.56),
      }}
    >
      {chain.short[0]}
    </span>
  );
}

/* ============================================================
   Badge
   ============================================================ */
export const badge = tv({
  base: "inline-flex items-center gap-[5px] leading-none rounded-full border whitespace-nowrap font-medium",
  variants: {
    variant: {
      neutral: "bg-neutral-bg border-neutral-border text-fg-2",
      read: "bg-read-bg border-read-border text-read-fg",
      write: "bg-write-bg border-write-border text-write-fg",
      success: "bg-success-bg border-success-border text-success-fg",
      danger: "bg-danger-bg border-danger-border text-danger-fg",
    },
    size: { sm: "text-[11px] px-[7px] py-0.5", md: "text-xs px-2 py-[3px]" },
  },
  defaultVariants: { variant: "neutral", size: "md" },
});

export interface BadgeProps extends VariantProps<typeof badge> {
  children: ReactNode;
  dot?: boolean;
  className?: string;
}
export function Badge({ variant, size, dot, children, className }: BadgeProps) {
  return (
    <span className={badge({ variant, size, className })}>
      {dot && <span className="size-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

/* ============================================================
   MutTag — state-mutability chip (view / pure / nonpayable / payable)
   ============================================================ */
export const mutTag = tv({
  base: "font-mono text-[10.5px] font-medium tracking-[0.02em] px-1.5 py-0.5 rounded-xs lowercase border",
  variants: {
    state: {
      view: "bg-read-bg text-read-fg border-read-border",
      pure: "bg-neutral-bg text-fg-3 border-neutral-border",
      nonpayable: "bg-write-bg text-write-fg border-write-border",
      payable: "bg-write-bg-strong text-write-fg border-write-border",
    },
  },
  defaultVariants: { state: "view" },
});

export function MutTag({
  state,
}: {
  state: "view" | "pure" | "nonpayable" | "payable";
}) {
  return <span className={mutTag({ state })}>{state}</span>;
}

/* ============================================================
   ChainBadge
   ============================================================ */
export function ChainBadge({
  chain,
  sm,
}: {
  chain: Chain | null | undefined;
  sm?: boolean;
}) {
  if (!chain) return null;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-elev-3 font-medium text-fg-2 ${
        sm
          ? "py-0.5 pl-[3px] pr-2 text-[11px]"
          : "py-[3px] pl-1 pr-[9px] text-xs"
      }`}
    >
      <ChainGlyph chain={chain} size={sm ? 14 : 16} />
      {chain.name}
    </span>
  );
}
