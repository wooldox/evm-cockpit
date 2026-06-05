"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cx } from "@/shared/lib/cx";
import { Icon } from "@/shared/icons";
import { ChainGlyph } from "./badge";

/* ============================================================
   ChainPickerPanel
   ------------------------------------------------------------
   The shared popover CONTENT for searchable chain pickers:
   sticky search (matches name / short / chain id), an optional
   status notice, a count row, a scrollable result list with
   full keyboard nav (↑/↓/Enter/Esc), match highlighting and
   scroll-keeping, plus an empty state.

   It does NOT own open/close, positioning, or outside-close —
   the OWNER wraps it (ChainSelector, ChainCombobox). Entries
   are passed as a structural type so shared/ui never imports
   from entities.
   ============================================================ */

export type TPickerChain = {
  id: number;
  name: string;
  short: string;
  color: string;
};

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

export function ChainPickerPanel({
  entries,
  value,
  onSelect,
  onRequestClose,
  notice,
  footer,
  listboxId,
  autoFocus = true,
}: {
  entries: readonly TPickerChain[];
  value: number;
  onSelect: (id: number) => void;
  /** Esc inside the panel asks the owner to close. */
  onRequestClose?: () => void;
  /** Status line rendered under the count row (e.g. static-fallback note). */
  notice?: string;
  /** Owner-supplied trailing region (e.g. the selector's pinned action). */
  footer?: React.ReactNode;
  /** id for the result listbox — lets a combobox owner set aria-controls. */
  listboxId?: string;
  autoFocus?: boolean;
}): React.JSX.Element {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  // on mount: focus the search field (query/active start clean — no setState here).
  useEffect(() => {
    if (!autoFocus) return;
    const t = setTimeout(
      () => inputRef.current?.focus({ preventScroll: true }),
      0,
    );
    return () => clearTimeout(t);
  }, [autoFocus]);

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

  // Clamp the active index to the current result set: when `entries` change
  // while the panel is open (e.g. the runtime catalog fetch lands and grows the
  // list, or a filter shrinks it), `active` may point past the end. Deriving the
  // clamped value keeps highlight/Enter valid without an effect.
  const activeClamped = Math.min(active, Math.max(0, results.length - 1));

  // keep the highlighted row visible without scrollIntoView
  useEffect(() => {
    const el = itemRefs.current[activeClamped];
    const list = listRef.current;
    if (!el || !list) return;
    const top = el.offsetTop;
    const bottom = top + el.offsetHeight;
    if (top < list.scrollTop) list.scrollTop = top - 4;
    else if (bottom > list.scrollTop + list.clientHeight)
      list.scrollTop = bottom - list.clientHeight + 4;
  }, [activeClamped, results]);

  const onQueryChange = (next: string) => {
    setQ(next);
    setActive(0); // reset highlight to the top whenever the result set changes
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(activeClamped + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(activeClamped - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const c = results[activeClamped];
      if (c) onSelect(c.id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      // Stop the bubble so an Escape that closes the popover doesn't also reach
      // an ancestor's window/keydown handler (e.g. the Modal's close-on-Escape).
      e.stopPropagation();
      onRequestClose?.();
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
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
      {notice && (
        <div className="px-3 pb-1 text-[11px] normal-case text-fg-4">
          {notice}
        </div>
      )}

      {/* scrollable results */}
      <div
        ref={listRef}
        id={listboxId}
        role="listbox"
        className="min-h-0 flex-1 overflow-y-auto px-[5px] pb-1"
      >
        {results.length === 0 ? (
          <div className="px-2 py-6 text-center text-[13px] text-fg-4">
            No networks match
            <span className="font-medium text-fg-3"> “{q.trim()}”</span>
          </div>
        ) : (
          results.map((c, i) => (
            <button
              key={c.id}
              ref={(el) => {
                itemRefs.current[i] = el;
              }}
              type="button"
              role="option"
              aria-selected={i === activeClamped}
              onMouseMove={() => setActive(i)}
              onClick={() => onSelect(c.id)}
              className={cx(
                "flex w-full items-center gap-[9px] rounded-sm border-0 px-2 py-[7px] text-left text-[13px] cursor-pointer",
                i === activeClamped
                  ? "bg-elev-3 text-fg"
                  : "bg-transparent text-fg-2",
              )}
            >
              <ChainGlyph chain={c} size={16} />
              <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap">
                <HlMatch text={c.name} q={q} />
              </span>
              <span className="font-mono text-[11px] text-fg-4">{c.id}</span>
              {c.id === value && (
                <Icon.check size={14} className="flex-none text-read-fg" />
              )}
            </button>
          ))
        )}
      </div>

      {footer}
    </div>
  );
}
