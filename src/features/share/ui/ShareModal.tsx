'use client';

import { useEffect, useState } from 'react';
import { Icon } from '@/shared/icons';
import type { TContract } from '@/entities/contract/model/types';
import { catalogDisplay } from '@/entities/chain/model/catalogStore';
import {
  encodeShare,
  toShareBundle,
  MAX_SHARE_PAYLOAD_CHARS,
} from '@/shared/lib/share/codec';
import { trunc } from '@/shared/lib/format';
import { downloadJson } from '@/shared/lib/tx/downloadUnsignedTx';
import {
  Button,
  ChainGlyph,
  CopyBtn,
  Field,
  Input,
  Modal,
  Muted,
  Spinner,
  useToast,
} from '@/shared/ui';

/** Links longer than this may get cut by chat apps (Discord caps messages at
 *  2,000 characters) — still offered, with a warning. */
const LONG_LINK_CHARS = 2000;

const plural = (n: number) => `${n} contract${n === 1 ? '' : 's'}`;

export interface ShareModalProps {
  /** One or more contracts to share as a single link / file. */
  contracts: TContract[];
  onClose: () => void;
}

export function ShareModal({ contracts, onClose }: ShareModalProps) {
  const toast = useToast();
  const [payload, setPayload] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const single = contracts.length === 1 ? contracts[0]! : null;

  // Encode on mount. Setting state from an async continuation (not a
  // synchronous setState inside the effect body) is permitted by the project's
  // React 19 set-state-in-effect rule. `cancelled` guards against late resolves
  // after unmount.
  useEffect(() => {
    let cancelled = false;
    encodeShare(contracts)
      .then((token) => {
        if (cancelled) return;
        setFailed(false);
        setPayload(token);
      })
      .catch(() => {
        if (cancelled) return;
        setPayload(null);
        setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [contracts]);

  const tooLarge = payload !== null && payload.length > MAX_SHARE_PAYLOAD_CHARS;
  const shareUrl =
    payload && !tooLarge
      ? `${window.location.origin}/#import=${payload}`
      : null;

  const handleDownload = () => {
    // toShareBundle returns plain JSON (no bigints), so JSON.stringify is safe.
    downloadJson(
      single
        ? `${single.name}.contract.json`
        : `evm-cockpit-${contracts.length}-contracts.json`,
      JSON.stringify(toShareBundle(contracts), null, 2),
    );
    toast({
      kind: 'success',
      title: single
        ? 'Contract exported'
        : `Exported ${plural(contracts.length)}`,
      msg: single?.name,
    });
  };

  const fallback = (msg: string) => (
    <Field label="Share link">
      <div className="flex items-center gap-2 rounded-sm border border-danger-border bg-danger-bg px-3 py-2.5 text-xs text-danger-fg">
        <Icon.alertCircle size={14} />
        {msg}
      </div>
    </Field>
  );

  return (
    <Modal
      title={single ? 'Share contract' : `Share ${plural(contracts.length)}`}
      onClose={onClose}
    >
      <div className="flex flex-col gap-4">
        {/* ── What's included (multi only) ───────────────────────── */}
        {!single && (
          <ul className="max-h-[188px] overflow-y-auto rounded-sm border border-border">
            {contracts.map((c) => {
              const chain = catalogDisplay(c.chainId);
              return (
                <li
                  key={c.id}
                  className="flex items-center gap-2.5 border-b border-border px-3 py-2 last:border-b-0"
                >
                  <span className="min-w-0 flex-1 truncate text-[13px] text-fg">
                    {c.name}
                  </span>
                  <span className="flex flex-none items-center gap-1.5 text-[11.5px] text-fg-3">
                    <ChainGlyph chain={chain} size={12} />
                    {chain.name}
                    <span className="font-mono">· {trunc(c.address, 5)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {/* ── Share link ─────────────────────────────────────────── */}
        {failed ? (
          fallback("Couldn't generate a link — use file export below.")
        ) : payload === null ? (
          <div className="flex items-center gap-2.5 text-[13px]">
            <Spinner />
            <Muted>Encoding share link…</Muted>
          </div>
        ) : tooLarge ? (
          fallback(
            single
              ? 'ABI too large for a link — use file export below.'
              : `Too long for a link (${plural(contracts.length)}) — use file export below.`,
          )
        ) : (
          <Field
            label="Share link"
            hint={
              (shareUrl?.length ?? 0) > LONG_LINK_CHARS
                ? `Long link (${shareUrl!.length.toLocaleString('en-US')} characters) — some chat apps cut links this long; the file is safer.`
                : single
                  ? 'Anyone with this link can import the contract.'
                  : 'Anyone with this link can review and import these contracts.'
            }
          >
            <div className="flex items-center gap-1.5">
              <Input mono readOnly value={shareUrl ?? ''} />
              <CopyBtn value={shareUrl ?? ''} />
            </div>
          </Field>
        )}

        {/* ── Download JSON ──────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
          <Muted className="text-xs">
            Prefer a file? Export{' '}
            {single ? 'the contract' : `all ${contracts.length}`} as JSON.
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
          The link encodes the contract{single ? '' : 's'} locally — nothing is
          uploaded.
        </Muted>
      </div>
    </Modal>
  );
}
