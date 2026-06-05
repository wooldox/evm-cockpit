"use client";

import { cx } from "@/shared/lib/cx";
import { Button, Field, Input, Modal, Mono, useToast } from "@/shared/ui";
import { useChainCatalog } from "@/entities/chain/model/catalogStore";
import { CHAIN_COLORS, useAddChainForm } from "../model/useAddChainForm";

/** "Add custom chain" — adds a user-defined network to the catalog.
 *  NOTE: custom chains are not in the wagmi config — wallet operations only
 *  reach them if the wallet already knows the chain (same limitation as
 *  catalog-only chains); reads work through the viem-rpc synthChain path. */
export function AddChainModal({
  onClose,
  onAdded,
}: {
  onClose: () => void;
  /** Called with the new chain id after a successful add (callers select it). */
  onAdded: (id: number) => void;
}) {
  const f = useAddChainForm();
  const toast = useToast();
  const addCustomChain = useChainCatalog((s) => s.addCustomChain);

  const submit = () => {
    if (!f.canSave) return;
    const entry = f.buildEntry();
    addCustomChain(entry);
    toast({
      kind: "success",
      title: "Custom chain added",
      msg: (
        <>
          {entry.name} · chain id <Mono>{entry.id}</Mono>
        </>
      ),
    });
    onAdded(entry.id);
    onClose();
  };

  return (
    <Modal
      title="Add custom chain"
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={submit} disabled={!f.canSave}>
            Add chain
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3.5 max-[860px]:grid-cols-1">
        <Field label="Network name" required>
          <Input
            aria-label="Network name"
            placeholder="My Network"
            value={f.name}
            onChange={(e) => f.setName(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Chain ID" required type="uint" error={f.idError}>
          <Input
            mono
            aria-label="Chain ID"
            tone={
              f.idStr
                ? f.idValid && !f.idDup
                  ? "valid"
                  : "invalid"
                : "default"
            }
            placeholder="1"
            value={f.idStr}
            onChange={(e) => f.setIdStr(e.target.value.replace(/[^\d]/g, ""))}
          />
        </Field>
        <div className="col-span-full">
          <Field label="RPC URL" required type="http(s)" error={f.rpcError}>
            <Input
              mono
              aria-label="RPC URL"
              tone={f.rpc ? (f.rpcValid ? "valid" : "invalid") : "default"}
              placeholder="https://rpc.my-network.xyz"
              value={f.rpc}
              onChange={(e) => f.setRpc(e.target.value.trim())}
            />
          </Field>
        </div>
        <Field
          label="Currency symbol"
          required
          hint="Native gas token, e.g. ETH"
        >
          <Input
            mono
            aria-label="Currency symbol"
            placeholder="ETH"
            value={f.symbol}
            onChange={(e) => f.setSymbol(e.target.value.trim())}
          />
        </Field>
        <Field label="Block explorer URL" hint="Optional">
          <Input
            mono
            aria-label="Block explorer URL"
            placeholder="https://explorer.my-network.xyz"
            value={f.explorer}
            onChange={(e) => f.setExplorer(e.target.value.trim())}
          />
        </Field>
        <div className="col-span-full">
          <Field label="Accent">
            <div className="flex items-center gap-3">
              <span
                className="inline-grid size-8 flex-none place-items-center rounded-full text-[13px] font-bold text-white"
                style={{ background: f.color }}
              >
                {f.glyphChar}
              </span>
              <div className="flex gap-2">
                {CHAIN_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => f.setColor(c)}
                    className={cx(
                      "size-7 cursor-pointer rounded-full border-2 transition-transform",
                      f.color === c
                        ? "scale-110 border-fg"
                        : "border-transparent hover:scale-105",
                    )}
                    style={{ background: c }}
                  />
                ))}
              </div>
            </div>
          </Field>
        </div>
      </div>
    </Modal>
  );
}
