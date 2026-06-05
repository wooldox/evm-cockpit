"use client";

import { useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Icon } from "@/shared/icons";
import { ChainGlyph, ChainPickerPanel } from "@/shared/ui";
import {
  useChainCatalog,
  useChainDisplay,
} from "@/entities/chain/model/catalogStore";
import { AddChainModal } from "@/features/add-chain/ui/AddChainModal";

/* ============================================================
   ChainSelector
   ------------------------------------------------------------
   Searchable autocomplete network selector built to scale to
   tens/hundreds of networks. The popover internals (sticky
   search, count row, keyboard nav, highlighting, scroll-keeping)
   live in the shared ChainPickerPanel; this component owns the
   trigger, the absolute popover wrapper, open state, outside-
   close, the status notice and the pinned "Add custom chain"
   action.
   ============================================================ */

export function ChainSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (id: number) => void;
}) {
  const chain = useChainDisplay(value);
  // Reactive entries + status: re-renders when the catalog gains remote chains
  // or falls back to static. useShallow keeps the tuple stable across renders.
  const { entries, status } = useChainCatalog(
    useShallow((s) => ({ entries: s.entries, status: s.status })),
  );

  const [open, setOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // close on click/tap outside (ref-contains — robust, no self-close race)
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const select = (id: number) => {
    onChange(id);
    setOpen(false);
  };

  const onAddCustom = () => {
    setOpen(false);
    setAddOpen(true);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex h-[34px] items-center gap-2 rounded-sm border border-border-strong bg-elev-2 px-[11px] text-[13px] font-medium text-fg transition-colors hover:border-[var(--gray-500)]"
      >
        <ChainGlyph chain={chain} size={16} />
        {chain.name}
        <Icon.chevD size={13} className="opacity-60" />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 flex max-h-[min(440px,70vh)] w-[270px] flex-col overflow-hidden rounded-md border border-border-strong bg-elev-2 shadow-[var(--shadow-pop)] animate-pop-in">
          <ChainPickerPanel
            entries={entries}
            value={chain.id}
            onSelect={select}
            onRequestClose={() => setOpen(false)}
            notice={
              status === "static-fallback"
                ? "showing built-in networks — full list unavailable"
                : undefined
            }
            footer={
              <div className="flex-none border-t border-border p-[5px]">
                <button
                  type="button"
                  onClick={onAddCustom}
                  className="flex w-full items-center gap-[9px] rounded-sm border-0 bg-transparent px-2 py-[7px] text-left text-[13px] text-fg-2 cursor-pointer hover:bg-elev-3 hover:text-fg"
                >
                  <Icon.plus size={14} /> Add custom chain
                </button>
              </div>
            }
          />
        </div>
      )}
      {addOpen && (
        <AddChainModal
          onClose={() => setAddOpen(false)}
          onAdded={(id) => onChange(id)}
        />
      )}
    </div>
  );
}
