"use client";

import { useState } from "react";
import type { AbiEvent } from "abitype";
import type { TContract } from "@/entities/contract/model/types";
import type { RpcProvider } from "@/shared/ports/rpc";
import { getBrowserSections } from "@/features/contract-browser/model/effectiveAbi";
import { useEventLogs } from "@/features/contract-browser/model/useEventLogs";
import {
  MAX_LOGS,
  type TDecodedLog,
} from "@/features/contract-browser/model/fetchEventLogs";
import { txUrl } from "@/entities/chain/model/explorer";
import { Icon } from "@/shared/icons";
import { trunc } from "@/shared/lib/format";
import { Button, Muted, Panel, Spinner } from "@/shared/ui";
import { ExtLink } from "@/shared/ui/copyable";
import { Field, Input, Select } from "@/shared/ui/field";
import { TypedValue } from "./values";
import { SectionHead } from "./PropertiesSection";

/** Test seam mirroring useEventLogs deps (defaults to the rpc singleton). */
type EventsDeps = { rpc: RpcProvider };

/** Full event signature `name(type,…)` — unique even across overloads. */
function eventSig(e: AbiEvent): string {
  return `${e.name}(${e.inputs.map((i) => i.type).join(",")})`;
}

/* ── EventsTable ────────────────────────────────────────── */
function EventsTable({
  event,
  logs,
  chainId,
}: {
  event: AbiEvent;
  logs: TDecodedLog[];
  chainId: number;
}) {
  const th =
    "sticky top-0 whitespace-nowrap border-b border-border bg-elev-1 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-fg-3";
  const td = "border-b border-border px-3 py-[9px] align-top text-fg-2";

  return (
    <div className="mt-3 overflow-auto rounded-sm border border-border">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr>
            <th className={th}>Block</th>
            {event.inputs.map((input, i) => (
              <th key={input.name ?? `arg${i}`} className={th}>
                {input.name || `arg${i}`}
              </th>
            ))}
            <th className={th}>Tx</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log) => {
            const link = txUrl(chainId, log.txHash);
            return (
              <tr
                key={`${log.txHash}-${log.logIndex}`}
                className="[&:hover_td]:bg-elev-3"
              >
                <td className={`${td} font-mono tabular-nums`}>
                  {log.blockNumber.toLocaleString()}
                </td>
                {event.inputs.map((input, i) => {
                  const key = input.name ?? String(i);
                  return (
                    <td key={input.name ?? `arg${i}`} className={td}>
                      <TypedValue
                        type={input.type}
                        value={log.args[key]}
                        chainId={chainId}
                      />
                    </td>
                  );
                })}
                <td className={td}>
                  <span className="inline-flex items-center gap-[7px]">
                    <span className="font-mono">{trunc(log.txHash, 5)}</span>
                    {link && <ExtLink href={link} size={12} />}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ── EventsSection ──────────────────────────────────────── */
export function EventsSection({
  contract,
  q,
  deps,
}: {
  contract: TContract;
  q: string;
  deps?: EventsDeps;
}) {
  const sections = getBrowserSections(contract);
  const events = sections.events;

  const [selSig, setSelSig] = useState(events[0] ? eventSig(events[0]) : "");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const { state, loadDefaultRange, fetchLogs, reset } = useEventLogs(
    contract,
    deps,
  );

  if (events.length === 0) return null;

  const filtered = events.filter((e) => !q || e.name.toLowerCase().includes(q));
  const selected = events.find((e) => eventSig(e) === selSig) ?? events[0];

  const loading = state.status === "loading";

  function onSelectEvent(sig: string): void {
    setSelSig(sig);
    // Results belong to the previous event — drop them.
    reset();
  }

  async function onFetch(): Promise<void> {
    if (!selected) return;
    let fromValue = from.trim();
    if (fromValue === "") {
      // Resolve the default look-back window first, populate the From input so
      // the user sees what ran, then fetch with the resolved value. (State
      // updates aren't visible in this closure, so use the returned range.)
      const range = await loadDefaultRange();
      if (range === null) return; // lookup failed — hook surfaced the error
      fromValue = range.from;
      setFrom(range.from);
    }
    await fetchLogs(selected, fromValue, to);
  }

  return (
    <section>
      <SectionHead tone="read" title="Events" count={events.length} />
      <Panel className="p-3.5">
        <div className="grid grid-cols-[1.4fr_1fr_1fr_auto] items-end gap-3 max-[860px]:grid-cols-1">
          <Field label="Event">
            <Select
              value={selSig}
              onChange={(e) => onSelectEvent(e.target.value)}
            >
              {filtered.map((e) => {
                const sig = eventSig(e);
                return (
                  <option key={sig} value={sig}>
                    {sig}
                  </option>
                );
              })}
            </Select>
          </Field>
          <Field label="From block">
            <Input
              mono
              placeholder="auto (last 10k blocks)"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </Field>
          <Field label="To block">
            <Input
              mono
              placeholder="latest"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </Field>
          <Button
            variant="read"
            fill="soft"
            icon={loading ? <Spinner /> : <Icon.filter size={14} />}
            onClick={() => void onFetch()}
            disabled={loading}
          >
            {loading ? "Fetching…" : "Fetch logs"}
          </Button>
        </div>

        {state.status === "done" &&
          selected &&
          (state.result.logs.length > 0 ? (
            <>
              <EventsTable
                event={selected}
                logs={state.result.logs}
                chainId={contract.chainId}
              />
              <Muted className="mt-2.5 block text-xs">
                {state.result.logs.length} logs · {state.result.chunks} RPC
                calls
              </Muted>
              {state.result.truncated && (
                <p className="mt-1 text-xs text-danger-fg">
                  showing first {MAX_LOGS} — narrow the range
                </p>
              )}
            </>
          ) : (
            <Muted className="mt-3 block text-sm">No logs in this range.</Muted>
          ))}

        {state.status === "error" && (
          <div className="mt-3 flex flex-col gap-1">
            <p className="font-mono text-[12px] text-danger-fg">
              {state.error}
            </p>
            <Muted className="text-xs">
              large ranges are auto-chunked; if the RPC rejects, narrow the
              range or set a custom RPC in Settings
            </Muted>
          </div>
        )}

        {state.status === "idle" && (
          <div className="mt-3 text-xs text-fg-3">
            Pick an event and block range, then fetch decoded logs. Large ranges
            are auto-chunked.
          </div>
        )}
      </Panel>
    </section>
  );
}
