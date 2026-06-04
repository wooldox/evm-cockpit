"use client";

import { useRef, useState } from "react";
import { useAccount } from "wagmi";
import type { AbiFunction } from "abitype";
import type { TContract } from "@/entities/contract/model/types";
import type { RpcProvider } from "@/shared/ports/rpc";
import type { THistoryEntry } from "@/entities/history/model/types";
import type { TRerunIntent } from "@/entities/rerun/model/store";
import { getBrowserSections } from "@/features/contract-browser/model/effectiveAbi";
import { useSimulation } from "@/features/contract-browser/model/useSimulation";
import { useSendOperation } from "@/features/contract-browser/model/useSendOperation";
import { getChainDisplay } from "@/entities/chain/model/chains";
import { Icon } from "@/shared/icons";
import { trunc } from "@/shared/lib/format";
import { fromBaseUnits, type EthUnit } from "@/shared/lib/units/units";
import {
  buildUnsignedTxJson,
  downloadJson,
} from "@/shared/lib/tx/downloadUnsignedTx";
import {
  Button,
  Eyebrow,
  Metric,
  Mono,
  Muted,
  MutTag,
  RevertReason,
  SimDetail,
  SimShell,
  SimStatus,
  Spinner,
  TxField,
  TxGrid,
  useToast,
} from "@/shared/ui";
import { Field } from "@/shared/ui/field";
import { FnCard } from "./GettersSection";
import { ParamInput } from "./values";
import { EthValueInput } from "./EthValueInput";
import { SectionHead } from "./PropertiesSection";

/** Dependency seam mirroring useSimulation/useSendOperation deps for tests. */
type OpDeps = {
  rpc: RpcProvider;
  addHistory: (e: Omit<THistoryEntry, "id" | "timestamp">) => void;
};

/* ── OperationCard ──────────────────────────────────────── */
function OperationCard({
  contract,
  fn,
  deps,
  initialArgs,
  defaultOpen,
}: {
  contract: TContract;
  fn: AbiFunction;
  deps?: OpDeps;
  initialArgs?: Record<string, string>;
  defaultOpen?: boolean;
}) {
  // initialArgs/defaultOpen are useState initializers only — no effects, no
  // syncing. Re-run prefills + opens the card; Sign still requires a fresh
  // simulation (no verdict is carried over), so writes are never auto-executed.
  const [open, setOpen] = useState(defaultOpen ?? false);
  const [args, setArgs] = useState<Record<string, string>>(initialArgs ?? {});
  const [ethAmount, setEthAmount] = useState("");
  const [ethUnit, setEthUnit] = useState<EthUnit>("ether");

  const toast = useToast();
  /** Synchronous guard: blocks a second click before the disabled state commits. */
  const sendBusyRef = useRef(false);
  const { address, isConnected, chainId: walletChainId } = useAccount();

  const sim = useSimulation(contract, fn, deps);
  const sender = useSendOperation(contract, fn, deps);

  const payable = fn.stateMutability === "payable";

  /** Any input/value/unit change invalidates a stale simulation. */
  function invalidate(): void {
    sim.reset();
  }

  function onArg(key: string, v: string): void {
    setArgs((s) => ({ ...s, [key]: v }));
    invalidate();
  }

  function onEth(amount: string, unit: EthUnit): void {
    setEthAmount(amount);
    setEthUnit(unit);
    invalidate();
  }

  function onSimulate(): void {
    void sim.simulate(
      args,
      payable ? { amount: ethAmount, unit: ethUnit } : undefined,
      address,
    );
  }

  const loading = sim.state.status === "loading";
  const done = sim.state.status === "done" ? sim.state : null;
  const result = done?.result;

  const sendState = sender.state;
  const sendBusy =
    sendState.status === "wallet" || sendState.status === "pending";

  async function handleSend(): Promise<void> {
    if (!done || !result || !result.ok) return;
    // Synchronous re-entrancy guard: a rapid second click lands before the
    // button's disabled state commits (especially across switchChainAsync), so
    // gate here to keep the "Sending" toast (and send) from firing twice.
    if (sendBusyRef.current) return;
    sendBusyRef.current = true;
    try {
      toast({
        kind: "write",
        title: `Sending ${fn.name}()`,
        msg: "Awaiting signature in wallet…",
      });
      const final = await sender.send({
        args: done.parsedArgs,
        value: done.parsedValue,
        gas: result.gas,
        rawArgs: args,
      });
      if (final.status === "confirmed") {
        toast({
          kind: "success",
          title: "Transaction confirmed",
          msg: (
            <>
              <Mono>{trunc(final.hash, 6)}</Mono> · block{" "}
              {final.blockNumber.toString()}
            </>
          ),
        });
      } else if (final.status === "failed") {
        toast({
          kind: "error",
          title: `${fn.name}() failed`,
          msg: final.error,
        });
      }
    } finally {
      sendBusyRef.current = false;
    }
  }

  function onDownload(): void {
    if (!result || !result.ok) return;
    downloadJson(
      `${fn.name}-tx.json`,
      buildUnsignedTxJson({
        chainId: contract.chainId,
        to: contract.address,
        data: result.data,
        value: done?.parsedValue,
        gas: result.gas,
        nonce: result.nonce,
        maxFeePerGas: result.fees?.maxFeePerGas,
        maxPriorityFeePerGas: result.fees?.maxPriorityFeePerGas,
        from: address,
      }),
    );
    toast({
      kind: "success",
      title: "Transaction downloaded",
      msg: (
        <>
          Unsigned tx saved as <Mono>{fn.name}-tx.json</Mono> — for offline /
          multisig signing.
        </>
      ),
    });
  }

  const wrongChain = isConnected && walletChainId !== contract.chainId;
  const chainName = getChainDisplay(contract.chainId).name;

  /* Sign & Send button: label, disabled state and title. */
  const signDisabled = !result?.ok || !isConnected || sendBusy;
  let signLabel = "Sign & Send";
  if (sendState.status === "wallet") signLabel = "Confirm in wallet…";
  else if (sendState.status === "pending") signLabel = "Pending…";
  else if (wrongChain && result?.ok)
    signLabel = `Switch to ${chainName} & Send`;

  let signTitle: string | undefined;
  if (!result?.ok) signTitle = "Disabled — simulation predicts revert";
  else if (!isConnected) signTitle = "Connect a wallet to sign";
  else if (!sendBusy) signTitle = "Sign and broadcast";

  const fromValue = address ? trunc(address, 6) : "— connect wallet —";

  return (
    <FnCard
      tone="write"
      open={open}
      onToggle={() => setOpen((v) => !v)}
      fn={fn}
      badge={<MutTag state={fn.stateMutability as "nonpayable" | "payable"} />}
    >
      <div className="mb-3.5 inline-flex items-center gap-[7px] rounded-sm border border-write-border bg-write-bg px-2.5 py-1.5 text-xs font-medium text-write-fg">
        <Icon.bolt size={13} /> Sends a transaction · costs gas · irreversible
      </div>

      <div className="flex flex-col gap-3">
        {fn.inputs.map((p, i) => {
          const key = p.name ?? String(i);
          return (
            <ParamInput
              key={key}
              param={p}
              value={args[key]}
              error={sim.argErrors[key]}
              autoFocus={i === 0}
              onChange={(v) => onArg(key, v)}
            />
          );
        })}
        {payable && (
          <EthValueInput
            amount={ethAmount}
            unit={ethUnit}
            error={sim.valueError}
            onChange={onEth}
          />
        )}
      </div>

      <div className="my-3 flex items-center gap-2">
        <Button
          variant="read"
          fill="soft"
          size="sm"
          icon={loading ? <Spinner /> : <Icon.eye size={14} />}
          onClick={onSimulate}
          disabled={loading}
        >
          {loading ? "Simulating…" : "Simulate"}
        </Button>
        <Muted className="text-xs">dry-run before you sign — recommended</Muted>
      </div>

      {/* RPC-kind failure: not a revert verdict — inline danger + retry hint. */}
      {done && result && !result.ok && result.kind === "rpc" && (
        <div className="flex flex-col gap-1">
          <p className="font-mono text-[12px] text-danger-fg">
            {result.message}
          </p>
          <Muted className="text-xs">
            simulation could not run — check RPC/network and retry
          </Muted>
        </div>
      )}

      {/* Revert verdict: blocked sign, no raw-tx detail. */}
      {done && result && !result.ok && result.kind === "revert" && (
        <SimShell status="revert">
          <SimStatus
            status="revert"
            icon={<Icon.xCircle size={17} />}
            headline="Will revert"
            sub="Transaction would fail on-chain — signing is blocked"
          />
          <SimDetail>
            <RevertReason>{result.message}</RevertReason>
            {renderButtons()}
          </SimDetail>
        </SimShell>
      )}

      {/* Success verdict: full raw-tx detail + enabled sign. */}
      {done && result && result.ok && (
        <SimShell status="success">
          <SimStatus
            status="success"
            icon={<Icon.checkCircle size={17} />}
            headline="Will succeed"
            sub="Simulation passed against current chain state"
            aside={
              <Metric
                label="Est. gas"
                value={result.gas.toLocaleString()}
                className="text-right"
              />
            }
          />
          <SimDetail>
            <Eyebrow className="mt-0.5">Raw transaction</Eyebrow>
            <TxGrid>
              <TxField label="From" value={fromValue} />
              <TxField label="To" value={trunc(contract.address, 6)} />
              <TxField
                label="Nonce"
                value={result.nonce !== undefined ? result.nonce : "—"}
              />
              <TxField label="Gas limit" value={result.gas.toString()} />
              <TxField
                label="Max fee"
                value={
                  result.fees
                    ? `${fromBaseUnits(result.fees.maxFeePerGas, "gwei")} gwei`
                    : "—"
                }
              />
              <TxField
                label="Priority fee"
                value={
                  result.fees
                    ? `${fromBaseUnits(
                        result.fees.maxPriorityFeePerGas,
                        "gwei",
                      )} gwei`
                    : "—"
                }
              />
            </TxGrid>
            <Field label="Data (calldata)">
              <div className="rounded-sm border border-border bg-inset">
                <div className="overflow-x-auto break-all px-3.5 py-[11px] font-mono text-[13px] leading-[1.6] text-fg-2">
                  {result.data}
                </div>
              </div>
            </Field>
            {renderButtons()}
            {renderSendStatus()}
          </SimDetail>
        </SimShell>
      )}
    </FnCard>
  );

  /* ── buttons row (success + revert shells) ── */
  function renderButtons() {
    const revert = result !== undefined && !result.ok;
    return (
      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <Button
          variant="write"
          icon={sendBusy ? <Spinner /> : <Icon.sign size={15} />}
          onClick={() => void handleSend()}
          disabled={signDisabled}
          title={signTitle}
        >
          {signLabel}
        </Button>
        <Button
          variant="subtle"
          icon={<Icon.download size={15} />}
          onClick={onDownload}
          disabled={!result?.ok}
        >
          Download
        </Button>
        {revert && (
          <span className="ml-0.5 flex items-center gap-1.5 text-xs text-danger-fg">
            <Icon.lock size={13} /> Sign blocked while revert is predicted
          </span>
        )}
      </div>
    );
  }

  /* ── inline tx lifecycle status (under buttons, success shell only) ── */
  function renderSendStatus() {
    if (sendState.status === "pending") {
      return (
        <p className="font-mono text-[12px] text-write-fg">
          Transaction submitted · {trunc(sendState.hash, 6)}
        </p>
      );
    }
    if (sendState.status === "confirmed") {
      return (
        <p className="font-mono text-[12px] text-success-fg">
          Confirmed in block {sendState.blockNumber.toString()} ·{" "}
          {trunc(sendState.hash, 6)}
        </p>
      );
    }
    if (sendState.status === "failed") {
      return (
        <p className="font-mono text-[12px] text-danger-fg">
          {sendState.error}
        </p>
      );
    }
    return null;
  }
}

/* ── OperationsSection ──────────────────────────────────── */
export function OperationsSection({
  contract,
  q,
  deps,
  rerun,
}: {
  contract: TContract;
  q: string;
  deps?: OpDeps;
  rerun?: TRerunIntent | null;
}) {
  const sections = getBrowserSections(contract);
  if (sections.operations.length === 0) return null;

  const fns = sections.operations.filter(
    (f) => !q || f.name.toLowerCase().includes(q),
  );

  // Re-run targets this (write) section only when type is "simulate" | "write".
  // Overload limitation: we match on name + argCount (inputs.length), so two
  // overloads with the same arity are indistinguishable — the FIRST match wins.
  const matchTarget =
    rerun && (rerun.type === "write" || rerun.type === "simulate")
      ? fns.find(
          (f) => f.name === rerun.fnName && f.inputs.length === rerun.argCount,
        )
      : undefined;

  return (
    <section>
      <SectionHead
        tone="write"
        title="Operations"
        count={sections.operations.length}
        note="state-changing · sends transactions"
      />
      <div className="flex flex-col gap-2">
        {fns.map((f) => {
          // Full signature as key so overloads stay distinct.
          const key = `${f.name}(${f.inputs.map((i) => i.type).join(",")})`;
          const isTarget = f === matchTarget;
          return (
            <OperationCard
              key={key}
              contract={contract}
              fn={f}
              deps={deps}
              initialArgs={isTarget ? rerun?.args : undefined}
              defaultOpen={isTarget}
            />
          );
        })}
      </div>
    </section>
  );
}
