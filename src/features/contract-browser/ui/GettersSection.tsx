"use client";

import { useState } from "react";
import type { AbiFunction } from "abitype";
import type { TContract } from "@/entities/contract/model/types";
import { useGetterCall } from "@/features/contract-browser/model/useGetterCall";
import { getBrowserSections } from "@/features/contract-browser/model/effectiveAbi";
import { Icon } from "@/shared/icons";
import { cx } from "@/shared/lib/cx";
import { stringifyWithBigint } from "@/shared/lib/json/stringify";
import { Button, Muted, MutTag, Spinner } from "@/shared/ui";
import { CopyBtn } from "@/shared/ui/copyable";
import { ParamInput, TypedValue } from "./values";
import { SectionHead } from "./PropertiesSection";

/* ── FnCard ─────────────────────────────────────────────── */
function FnCard({
  tone,
  open,
  onToggle,
  fn,
  badge,
  children,
}: {
  tone: "read" | "write";
  open: boolean;
  onToggle: () => void;
  fn: AbiFunction;
  badge?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cx(
        "overflow-clip rounded-md border border-l-2 border-border bg-elev-2 transition-colors",
        tone === "read" ? "border-l-read" : "border-l-write",
      )}
    >
      <button
        type="button"
        data-cc="fn-head"
        onClick={onToggle}
        className="flex w-full cursor-pointer select-none items-center gap-2.5 px-3.5 py-[11px] text-left hover:bg-elev-3"
      >
        <Icon.chevR
          size={15}
          className={cx(
            "flex-none text-fg-3 transition-transform duration-[170ms]",
            open && "rotate-90",
          )}
        />
        <span className="flex min-w-0 flex-1 items-baseline gap-[7px]">
          <span className="font-mono text-[13px] font-semibold text-fg">
            {fn.name}
          </span>
          <span className="overflow-hidden text-ellipsis whitespace-nowrap font-mono text-xs text-fg-3">
            (
            {fn.inputs
              .map((i) => `${i.type}${i.name ? ` ${i.name}` : ""}`)
              .join(", ")}
            )
          </span>
        </span>
        {badge}
      </button>
      {open && (
        <div data-cc="fn-body" className="px-3.5 pb-3.5">
          {children}
        </div>
      )}
    </div>
  );
}

/* ── GetterCard ─────────────────────────────────────────── */
function GetterCard({
  contract,
  fn,
}: {
  contract: TContract;
  fn: AbiFunction;
}) {
  const [open, setOpen] = useState(false);
  const [args, setArgs] = useState<Record<string, string>>({});
  const { status, result, error, argErrors, call } = useGetterCall(
    contract,
    fn,
  );

  const outType = fn.outputs[0]?.type ?? "";

  const handleCall = () => {
    void call(args);
  };

  return (
    <FnCard
      tone="read"
      open={open}
      onToggle={() => setOpen((v) => !v)}
      fn={fn}
      badge={<MutTag state={fn.stateMutability as "view" | "pure"} />}
    >
      <div className="flex flex-col gap-3">
        {fn.inputs.map((p, i) => {
          const key = p.name ?? String(i);
          return (
            <ParamInput
              key={key}
              param={p}
              value={args[key]}
              error={argErrors[key]}
              autoFocus={i === 0}
              onChange={(v) => setArgs((s) => ({ ...s, [key]: v }))}
            />
          );
        })}
        <div className="mt-0.5 flex items-center gap-2">
          <Button
            variant="read"
            size="sm"
            icon={status === "loading" ? <Spinner /> : <Icon.play size={13} />}
            onClick={handleCall}
            disabled={status === "loading"}
          >
            {status === "loading" ? "Calling…" : "Call"}
          </Button>
          <Muted className="text-xs">free · eth_call · no gas</Muted>
        </div>
      </div>

      {status === "done" && (
        <div className="relative mt-3 rounded-sm border border-border bg-inset font-mono text-[13px]">
          <div className="flex items-center justify-between gap-2 border-b border-border py-1.5 pl-3 pr-2">
            <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.05em] text-fg-3">
              Result · {fn.outputs.map((o) => o.type).join(", ")}
            </span>
            <CopyBtn value={stringifyWithBigint(result)} />
          </div>
          <div className="overflow-x-auto px-3.5 py-[11px] leading-[1.6]">
            <TypedValue
              type={outType}
              value={result}
              chainId={contract.chainId}
            />
          </div>
        </div>
      )}

      {status === "error" && (
        <p className="mt-2 font-mono text-[12px] text-danger-fg">{error}</p>
      )}
    </FnCard>
  );
}

/* ── GettersSection ─────────────────────────────────────── */
export function GettersSection({
  contract,
  q,
}: {
  contract: TContract;
  q: string;
}) {
  const sections = getBrowserSections(contract);
  const fns = sections.getters.filter(
    (f) => !q || f.name.toLowerCase().includes(q),
  );

  if (sections.getters.length === 0) return null;

  return (
    <section>
      <SectionHead
        tone="read"
        title="Getters & Calls"
        count={sections.getters.length}
      />
      <div className="flex flex-col gap-2">
        {fns.map((f) => {
          // Use full signature as key to handle overloads
          const key = `${f.name}(${f.inputs.map((i) => i.type).join(",")})`;
          return <GetterCard key={key} contract={contract} fn={f} />;
        })}
      </div>
    </section>
  );
}
