"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/shared/icons";
import type { TContract } from "@/entities/contract/model/types";
import {
  encodeContractShare,
  toSharePayload,
  MAX_SHARE_PAYLOAD_CHARS,
} from "@/shared/lib/share/codec";
import { downloadJson } from "@/shared/lib/tx/downloadUnsignedTx";
import {
  Button,
  CopyBtn,
  Field,
  Input,
  Modal,
  Muted,
  Spinner,
  useToast,
} from "@/shared/ui";

export interface ShareModalProps {
  contract: TContract;
  onClose: () => void;
}

export function ShareModal({ contract, onClose }: ShareModalProps) {
  const toast = useToast();
  const [payload, setPayload] = useState<string | null>(null);

  // Encode on mount. Setting state from an async continuation (not a
  // synchronous setState inside the effect body) is permitted by the project's
  // React 19 set-state-in-effect rule. `cancelled` guards against late resolves
  // after unmount.
  useEffect(() => {
    let cancelled = false;
    encodeContractShare(contract)
      .then((token) => {
        if (!cancelled) setPayload(token);
      })
      .catch(() => {
        if (!cancelled) setPayload("");
      });
    return () => {
      cancelled = true;
    };
  }, [contract]);

  const tooLarge = payload !== null && payload.length > MAX_SHARE_PAYLOAD_CHARS;
  const shareUrl =
    payload && !tooLarge
      ? `${window.location.origin}/#import=${payload}`
      : null;

  const handleDownload = () => {
    // toSharePayload returns plain JSON (no bigints), so JSON.stringify is safe.
    downloadJson(
      `${contract.name}.contract.json`,
      JSON.stringify(toSharePayload(contract), null, 2),
    );
    toast({ kind: "success", title: "Contract exported", msg: contract.name });
  };

  return (
    <Modal title="Share contract" onClose={onClose}>
      <div className="flex flex-col gap-4">
        {/* ── Share link ─────────────────────────────────────────── */}
        {payload === null ? (
          <div className="flex items-center gap-2.5 text-[13px]">
            <Spinner />
            <Muted>Encoding share link…</Muted>
          </div>
        ) : tooLarge ? (
          <Field label="Share link">
            <div className="flex items-center gap-2 rounded-sm border border-danger-border bg-danger-bg px-3 py-2.5 text-xs text-danger-fg">
              <Icon.alertCircle size={14} />
              ABI too large for a link — use file export below.
            </div>
          </Field>
        ) : (
          <Field
            label="Share link"
            hint="Anyone with this link can import the contract."
          >
            <div className="flex items-center gap-1.5">
              <Input mono readOnly value={shareUrl ?? ""} />
              <CopyBtn value={shareUrl ?? ""} />
            </div>
          </Field>
        )}

        {/* ── Download JSON ──────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <Muted className="text-xs">
            Prefer a file? Export the contract as JSON.
          </Muted>
          <Button
            variant="subtle"
            icon={<Icon.download size={15} />}
            onClick={handleDownload}
          >
            Download JSON
          </Button>
        </div>

        {/* ── Privacy note ───────────────────────────────────────── */}
        <Muted className="text-xs leading-[1.5]">
          The link encodes the contract locally — nothing is uploaded.
        </Muted>
      </div>
    </Modal>
  );
}
