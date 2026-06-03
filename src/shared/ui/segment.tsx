"use client";

import type { ReactNode } from "react";
import { cx } from "@/shared/lib/cx";

export interface SegmentOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode;
  title?: string;
}

/**
 * Segment — segmented control / tab strip. Generic over the value union so
 * onChange is fully typed.
 */
export function Segment<T extends string>({
  value,
  onChange,
  options,
  block,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  block?: boolean;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      className={cx(
        "inline-flex gap-0.5 rounded-sm border border-border bg-elev-3 p-[3px]",
        block && "flex w-full",
        className,
      )}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-pressed={active}
            title={o.title}
            onClick={() => onChange(o.value)}
            className={cx(
              "inline-flex items-center justify-center gap-1.5 rounded-xs border-0 bg-transparent px-3 py-[5px]",
              "font-sans text-[13px] font-medium cursor-pointer transition-[color,background-color,box-shadow] duration-[110ms]",
              "[&_svg]:flex-none",
              block &&
                "min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap",
              active
                ? "bg-elev-1 text-fg shadow-[var(--shadow-sm)]"
                : "text-fg-3 hover:text-fg-2",
            )}
          >
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
