"use client";

import { useRef, useState } from "react";
import { Icon } from "@/shared/icons";
import { useChainCatalog } from "@/entities/chain/model/catalogStore";
import type { TAddress, TContract } from "@/entities/contract/model/types";
import type { Abi } from "abitype";
import { trunc } from "@/shared/lib/format";
import { sharePayloadSchema } from "@/shared/lib/share/codec";
import {
  Badge,
  Button,
  ChainCombobox,
  ErrorBanner,
  Field,
  Input,
  Modal,
  Mono,
  Muted,
  Segment,
  Spinner,
  Textarea,
  useToast,
} from "@/shared/ui";
import { useAddContractForm } from "../model/useAddContractForm";

export interface AddContractModalProps {
  onClose: () => void;
  editing?: TContract | null;
}

export function AddContractModal({ onClose, editing }: AddContractModalProps) {
  const f = useAddContractForm({ editing });
  const toast = useToast();
  const chainEntries = useChainCatalog((s) => s.entries);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  async function handleImportFile(file: File): Promise<void> {
    setImportError(null);
    try {
      const text = await file.text();
      const payload = sharePayloadSchema.parse(JSON.parse(text));
      // Prefill the form; the user reviews and saves through the normal flow.
      // Set address/chain BEFORE the proxy: those setters clear importedProxy
      // (staleness guard), so the proxy must be applied last.
      f.setName(payload.name);
      f.setChainId(payload.chainId);
      f.setAddress(payload.address);
      f.setAbiText(JSON.stringify(payload.abi, null, 2));
      f.setMode("manual");
      f.setImportedProxy(
        payload.proxy
          ? {
              kind: payload.proxy.kind,
              implAddress: payload.proxy.implAddress as TAddress,
              implAbi: payload.proxy.implAbi as Abi | undefined,
            }
          : undefined,
      );
    } catch {
      setImportError("not a valid contract export");
    }
  }

  return (
    <Modal
      lg
      title={editing ? "Edit contract" : "Add contract"}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!f.canSubmit}
            onClick={() => {
              if (f.submit()) {
                toast({
                  kind: "success",
                  title: editing ? "Contract updated" : "Contract added",
                  msg: f.name,
                });
                onClose();
              }
            }}
          >
            {editing ? "Save changes" : "Add contract"}
          </Button>
        </>
      }
    >
      {/* ── Name + Chain row ─────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3.5 max-[860px]:grid-cols-1">
        <Field label="Name" required>
          <Input
            placeholder="My Contract"
            value={f.name}
            onChange={(e) => f.setName(e.target.value)}
            autoFocus
          />
        </Field>
        <Field label="Chain" required>
          <ChainCombobox
            value={f.chainId}
            onChange={f.setChainId}
            entries={chainEntries}
            aria-label="Chain"
          />
        </Field>

        {/* ── Address (full-width) ─────────────────────────────────── */}
        <div className="col-span-full">
          <Field
            label="Address"
            required
            type="address"
            error={f.errors.address}
          >
            <Input
              mono
              tone={
                f.address
                  ? f.errors.address
                    ? "invalid"
                    : f.addrValid
                      ? "valid"
                      : "default"
                  : "default"
              }
              placeholder="0x0000000000000000000000000000000000000000"
              value={f.address}
              onChange={(e) => f.setAddress(e.target.value.trim())}
            />
          </Field>
        </div>
      </div>

      {/* ── ABI section ──────────────────────────────────────────── */}
      <hr className="my-4 border-0 border-t border-border" />
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-fg-2">ABI</span>
          <Button
            variant="ghost"
            size="sm"
            icon={<Icon.file size={13} />}
            onClick={() => fileInputRef.current?.click()}
          >
            Import file
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            aria-label="Import contract export file"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleImportFile(file);
              // Reset so re-selecting the same file re-fires onChange.
              e.target.value = "";
            }}
          />
        </div>
        <Segment
          value={f.mode}
          onChange={f.setMode}
          options={[
            {
              value: "fetch" as const,
              label: "Auto-fetch from explorer",
              icon: <Icon.download size={14} />,
            },
            {
              value: "manual" as const,
              label: "Paste manually",
              icon: <Icon.code size={14} />,
            },
          ]}
        />
      </div>

      {importError && (
        <div className="mb-3 flex items-center gap-1.5 text-xs text-danger-fg">
          <Icon.alertCircle size={13} />
          {importError}
        </div>
      )}

      {/* ── Fetch tab ─────────────────────────────────────────────── */}
      {f.mode === "fetch" ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-end gap-2">
            <div className="flex-1 text-xs text-fg-3">
              Resolves the verified ABI via{" "}
              <strong className="text-fg">Sourcify → Etherscan V2</strong> and
              auto-detects proxies.
            </div>
            <Button
              variant="read"
              fill="soft"
              icon={
                f.fetch.status === "loading" ? (
                  <Spinner />
                ) : (
                  <Icon.refresh size={14} />
                )
              }
              onClick={f.fetchAbi}
              disabled={!f.addrValid || f.fetch.status === "loading"}
            >
              Fetch ABI
            </Button>
          </div>

          {/* loading */}
          {f.fetch.status === "loading" && (
            <div className="flex items-center gap-2.5 rounded-sm border border-border bg-elev-3 px-3.5 py-3 text-[13px]">
              <Spinner />
              <Muted>Querying…</Muted>
            </div>
          )}

          {/* done */}
          {f.fetch.status === "done" && (
            <div className="flex flex-col items-stretch gap-[9px] rounded-sm border border-border bg-inset px-3.5 py-3 text-[13px]">
              <div className="flex items-center gap-2">
                <Icon.checkCircle size={16} className="text-success-fg" />
                <strong className="font-semibold">Verified ABI found</strong>
                <Badge size="sm" variant="success">
                  {f.fetch.categories ? "Verified" : "Source"}
                </Badge>
              </div>
              {f.fetch.categories && (
                <div className="flex items-center gap-2 text-xs text-fg-3">
                  <span>
                    <strong className="font-mono text-fg">
                      {f.fetch.categories.properties}
                    </strong>{" "}
                    properties
                  </span>
                  <span className="text-fg-4">·</span>
                  <span>
                    <strong className="font-mono text-fg">
                      {f.fetch.categories.getters}
                    </strong>{" "}
                    getters
                  </span>
                  <span className="text-fg-4">·</span>
                  <span>
                    <strong className="font-mono text-fg">
                      {f.fetch.categories.operations}
                    </strong>{" "}
                    operations
                  </span>
                  <span className="text-fg-4">·</span>
                  <span>
                    <strong className="font-mono text-fg">
                      {f.fetch.categories.events}
                    </strong>{" "}
                    events
                  </span>
                </div>
              )}
              {f.fetch.proxy && (
                <div className="flex items-center gap-[7px] rounded-xs border border-read-border bg-read-bg px-2.5 py-[7px] text-xs text-fg-2">
                  <Icon.layers size={13} className="text-read-fg" />
                  <strong className="font-semibold text-read-fg">
                    {f.fetch.proxy.kind === "beacon"
                      ? "Beacon proxy detected"
                      : "EIP-1967 proxy detected"}
                  </strong>{" "}
                  — implementation{" "}
                  <Mono>{trunc(f.fetch.proxy.implAddress)}</Mono>{" "}
                  {f.fetch.proxy.implAbi
                    ? "ABI merged automatically"
                    : "(implementation ABI unavailable)"}
                  .
                </div>
              )}
            </div>
          )}

          {/* error */}
          {f.fetch.status === "error" && (
            <ErrorBanner
              icon={<Icon.alert size={18} />}
              title="Not verified on Sourcify or Etherscan"
              hint={
                <>
                  → Switch to{" "}
                  <button
                    type="button"
                    onClick={() => f.setMode("manual")}
                    className="cursor-pointer border-0 bg-transparent p-0 text-read-fg underline"
                  >
                    Paste manually
                  </button>{" "}
                  to supply the ABI yourself.
                </>
              }
            >
              {f.fetch.error}
            </ErrorBanner>
          )}
        </div>
      ) : (
        /* ── Manual tab ───────────────────────────────────────────── */
        <Field
          error={f.errors.abi}
          hint="Paste the contract ABI as a JSON array."
        >
          <Textarea
            mono
            rows={9}
            tone={f.errors.abi ? "invalid" : "default"}
            placeholder='[ { "type": "function", "name": "transfer", "inputs": [...] } ]'
            value={f.abiText}
            onChange={(e) => f.setAbiText(e.target.value)}
          />
        </Field>
      )}
    </Modal>
  );
}
