"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { cx } from "@/shared/lib/cx";
import { Icon } from "@/shared/icons";
import { ChainGlyph, useToast } from "@/shared/ui";
import {
  useChainCatalog,
  useChainDisplay,
} from "@/entities/chain/model/catalogStore";
import type { TCatalogChain } from "@/entities/chain/model/catalog";

/* ============================================================
   ChainSelector
   ------------------------------------------------------------
   Searchable autocomplete network selector built to scale to
   tens/hundreds of networks: sticky search (matches name /
   short / chain id), scrollable results, full keyboard nav
   (↑/↓/Enter/Esc), match highlighting, and a pinned
   "Add custom chain" action. Ported from the design source
   (docs/design-tailwind/network-selector/shell-updated.tsx).
   ============================================================ */

/** Highlights the matched substring within `text` using a <mark>. */
function HlMatch({ text, q }: { text: string; q: string }) {
  const needle = q.trim();
  if (!needle) return <>{text}</>;
  const i = text.toLowerCase().indexOf(needle.toLowerCase());
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <mark className="bg-transparent font-semibold text-read-fg">
        {text.slice(i, i + needle.length)}
      </mark>
      {text.slice(i + needle.length)}
    </>
  );
}

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
  const toast = useToast();

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

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

  // on open: focus the search field (query/active are reset in toggleOpen, so
  // this effect only syncs the DOM focus — no setState here).
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(
      () => inputRef.current?.focus({ preventScroll: true }),
      0,
    );
    return () => clearTimeout(t);
  }, [open]);

  // filter by name / short ticker / chain id (case-insensitive substring)
  const results = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return entries;
    return entries.filter(
      (c) =>
        c.name.toLowerCase().includes(needle) ||
        c.short.toLowerCase().includes(needle) ||
        String(c.id).includes(needle),
    );
  }, [q, entries]);

  // keep the highlighted row visible without scrollIntoView
  useEffect(() => {
    const el = itemRefs.current[active];
    const list = listRef.current;
    if (!el || !list) return;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top - 4;
    else if (bottom > list.scrollTop + list.clientHeight)
      list.scrollTop = bottom - list.clientHeight + 4;
  }, [active, results]);

  const toggleOpen = () => {
    setOpen((wasOpen) => {
      if (!wasOpen) {
        // opening: start from a clean, top-highlighted full list
        setQ("");
        setActive(0);
      }
      return !wasOpen;
    });
  };

  const onQueryChange = (next: string) => {
    setQ(next);
    setActive(0); // reset highlight to the top whenever the result set changes
  };

  const select = (id: number) => {
    onChange(id);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const c = results[active];
      if (c) select(c.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOpen(false);
    }
  };

  const onAddCustom = () => {
    // TODO(backlog): custom chain entry flow
    toast({
      kind: "info",
      title: "Custom chains are coming soon",
      msg: "Track it on the backlog — for now use Settings → RPC override for supported networks.",
    });
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={toggleOpen}
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
          {/* sticky search */}
          <div className="flex-none border-b border-border p-[7px]">
            <div className="relative flex items-center">
              <Icon.search
                size={14}
                className="pointer-events-none absolute left-2.5 text-fg-3"
              />
              <input
                ref={inputRef}
                value={q}
                onChange={(e) => onQueryChange(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder="Search networks…"
                aria-label="Search networks"
                className="h-8 w-full rounded-sm border border-border-strong bg-elev-3 pl-[30px] pr-2.5 text-[13px] text-fg outline-none transition-colors placeholder:text-fg-4 hover:border-[var(--gray-500)] focus:border-read focus:[box-shadow:0_0_0_3px_var(--read-bg)]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-fg-4">
            <span>Network</span>
            <span className="font-mono normal-case tracking-normal text-fg-4">
              {results.length}
              {q.trim() ? "" : " total"}
            </span>
          </div>
          {status === "static-fallback" && (
            <div className="px-3 pb-1 text-[11px] normal-case text-fg-4">
              showing built-in networks — full list unavailable
            </div>
          )}

          {/* scrollable results */}
          <div
            ref={listRef}
            role="listbox"
            className="min-h-0 flex-1 overflow-y-auto px-[5px] pb-1"
          >
            {results.length === 0 ? (
              <div className="px-2 py-6 text-center text-[13px] text-fg-4">
                No networks match
                <span className="font-medium text-fg-3"> “{q.trim()}”</span>
              </div>
            ) : (
              results.map((c: TCatalogChain, i) => (
                <button
                  key={c.id}
                  ref={(el) => {
                    itemRefs.current[i] = el;
                  }}
                  type="button"
                  role="option"
                  aria-selected={i === active}
                  onMouseMove={() => setActive(i)}
                  onClick={() => select(c.id)}
                  className={cx(
                    "flex w-full items-center gap-[9px] rounded-sm border-0 px-2 py-[7px] text-left text-[13px] cursor-pointer",
                    i === active
                      ? "bg-elev-3 text-fg"
                      : "bg-transparent text-fg-2",
                  )}
                >
                  <ChainGlyph chain={c} size={16} />
                  <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                    <HlMatch text={c.name} q={q} />
                  </span>
                  <span className="font-mono text-[11px] text-fg-4">
                    {c.id}
                  </span>
                  {c.id === chain.id && (
                    <Icon.check size={14} className="flex-none text-read-fg" />
                  )}
                </button>
              ))
            )}
          </div>

          {/* pinned action */}
          <div className="flex-none border-t border-border p-[5px]">
            <button
              type="button"
              onClick={onAddCustom}
              className="flex w-full items-center gap-[9px] rounded-sm border-0 bg-transparent px-2 py-[7px] text-left text-[13px] text-fg-2 cursor-pointer hover:bg-elev-3 hover:text-fg"
            >
              <Icon.plus size={14} /> Add custom chain
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
