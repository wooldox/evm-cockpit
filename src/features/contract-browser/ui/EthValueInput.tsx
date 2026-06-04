"use client";

import type { JSX } from "react";
import type { EthUnit } from "@/shared/lib/units/units";
import { cx } from "@/shared/lib/cx";
import { Field, Input } from "@/shared/ui/field";

/** Display label → EthUnit. "ETH" maps to viem's "ether". */
const UNITS: ReadonlyArray<{ label: string; unit: EthUnit }> = [
  { label: "ETH", unit: "ether" },
  { label: "gwei", unit: "gwei" },
  { label: "wei", unit: "wei" },
];

/**
 * ETH value field for payable operations: a mono amount input plus an inline
 * ETH/gwei/wei unit toggle. Amount + unit are controlled by the parent so the
 * card can feed both into the simulation.
 */
export function EthValueInput({
  amount,
  unit,
  error,
  onChange,
}: {
  amount: string;
  unit: EthUnit;
  error?: string;
  onChange: (amount: string, unit: EthUnit) => void;
}): JSX.Element {
  return (
    <Field
      label="ETH value"
      type={`payable · ${unit === "ether" ? "ETH" : unit}`}
      error={error}
    >
      <div className="relative flex items-center">
        <Input
          mono
          tone={error ? "invalid" : "default"}
          className="pr-[110px]"
          placeholder="0.0"
          value={amount}
          onChange={(e) => onChange(e.target.value, unit)}
        />
        <span className="absolute right-1 flex items-center gap-[3px]">
          <span className="inline-flex gap-px rounded-xs border border-border bg-elev-1 p-0.5">
            {UNITS.map((u) => {
              const active = u.unit === unit;
              return (
                <button
                  key={u.unit}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onChange(amount, u.unit)}
                  className={cx(
                    "rounded-[3px] px-[7px] py-0.5 font-mono text-[11px]",
                    active ? "bg-elev-4 text-fg" : "text-fg-3",
                  )}
                >
                  {u.label}
                </button>
              );
            })}
          </span>
        </span>
      </div>
    </Field>
  );
}
