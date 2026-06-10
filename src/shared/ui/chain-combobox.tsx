'use client';

import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/shared/lib/cx';
import { Icon } from '@/shared/icons';
import { ChainGlyph } from './badge';
import { ChainPickerPanel, type TPickerChain } from './chain-picker';

/* ============================================================
   ChainCombobox
   ------------------------------------------------------------
   Field-anchored searchable chain picker for forms. The trigger
   is styled like our <Select> (same height/border/bg tokens)
   and shows the selected chain's glyph + name + mono id; click
   opens a ChainPickerPanel anchored under it.

   The popover renders into a body portal with fixed positioning
   measured from the trigger's rect, so it escapes any clipping
   `overflow` ancestor (notably the scrollable modal body). The
   anchor is recomputed on scroll/resize. Outside-mousedown and
   Esc close it.
   ============================================================ */

const triggerCx = {
  default:
    'border-border-strong focus:border-read focus:[box-shadow:0_0_0_3px_var(--read-bg)]',
  invalid: 'border-danger focus:[box-shadow:0_0_0_3px_var(--danger-bg)]',
  valid:
    'border-success-border focus:border-read focus:[box-shadow:0_0_0_3px_var(--read-bg)]',
} as const;

export type ChainComboboxTone = keyof typeof triggerCx;

const GAP = 6; // px between trigger and popover
const POPOVER_W = 290;
const VIEWPORT_MARGIN = 8; // keep the popover this far from the viewport edges
const MAX_POPOVER_H = 380;
const MIN_POPOVER_H = 160; // below this, flipping isn't worth it

/** Vertical anchor: open downward (`top`) or upward (`bottom`), height-capped. */
type Anchor =
  | { left: number; top: number; maxHeight: number }
  | { left: number; bottom: number; maxHeight: number };

export function ChainCombobox({
  value,
  onChange,
  entries,
  tone = 'default',
  'aria-label': ariaLabel,
}: {
  value: number;
  onChange: (id: number) => void;
  entries: readonly TPickerChain[];
  tone?: ChainComboboxTone;
  'aria-label'?: string;
}): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<Anchor | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const selected = entries.find((c) => c.id === value);

  const reposition = useCallback(() => {
    const t = triggerRef.current;
    if (!t) return;
    const r = t.getBoundingClientRect();
    // Clamp horizontally so the fixed-width popover never overflows the viewport.
    const left = Math.max(
      VIEWPORT_MARGIN,
      Math.min(r.left, window.innerWidth - POPOVER_W - VIEWPORT_MARGIN),
    );

    // Flip upward when there isn't enough room below (e.g. the trigger sits low
    // in a modal near the viewport bottom) and there's more room above. Either
    // way, cap the height to the space available on the chosen side so the
    // popover never runs off the page.
    const spaceBelow = window.innerHeight - r.bottom - GAP - VIEWPORT_MARGIN;
    const spaceAbove = r.top - GAP - VIEWPORT_MARGIN;
    const openUp = spaceBelow < MIN_POPOVER_H && spaceAbove > spaceBelow;

    if (openUp) {
      setPos({
        left,
        bottom: window.innerHeight - (r.top - GAP),
        maxHeight: Math.min(MAX_POPOVER_H, spaceAbove),
      });
    } else {
      setPos({
        left,
        top: r.bottom + GAP,
        maxHeight: Math.min(MAX_POPOVER_H, spaceBelow),
      });
    }
  }, []);

  // Measure synchronously before paint when opening, then track scroll/resize.
  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);
    return () => {
      window.removeEventListener('scroll', reposition, true);
      window.removeEventListener('resize', reposition);
    };
  }, [open, reposition]);

  // Close on click/tap outside (trigger + portaled popover both count as inside).
  // Capture phase is required: when the combobox lives inside a Modal, the
  // modal content stops mousedown propagation (to guard its backdrop-close), so
  // a bubble-phase document listener would never fire. Capturing on the way
  // down runs before that stopPropagation.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (rootRef.current?.contains(target)) return;
      if (popRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown, true);
    return () => document.removeEventListener('mousedown', onDown, true);
  }, [open]);

  const select = (id: number) => {
    onChange(id);
    setOpen(false);
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-label={ariaLabel}
        onClick={() => setOpen((o) => !o)}
        className={cx(
          'flex h-[34px] w-full items-center gap-2 rounded-sm border bg-elev-3 px-2.5 text-[13px] text-fg outline-none',
          'transition-[border-color,box-shadow,background-color] duration-[110ms]',
          'hover:border-[var(--gray-500)]',
          triggerCx[tone],
        )}
      >
        {selected ? (
          <>
            <ChainGlyph chain={selected} size={16} />
            <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left">
              {selected.name}
            </span>
            <span className="font-mono text-[11px] text-fg-4">
              {selected.id}
            </span>
          </>
        ) : (
          <span className="flex-1 text-left text-fg-3">Chain {value}</span>
        )}
        <Icon.chevD size={13} className="flex-none opacity-60" />
      </button>
      {open &&
        pos &&
        createPortal(
          <div
            ref={popRef}
            style={{
              left: pos.left,
              width: POPOVER_W,
              maxHeight: pos.maxHeight,
              ...('top' in pos ? { top: pos.top } : { bottom: pos.bottom }),
            }}
            className="fixed z-[110] flex flex-col overflow-hidden rounded-md border border-border-strong bg-elev-2 shadow-[var(--shadow-pop)] animate-pop-in"
          >
            <ChainPickerPanel
              entries={entries}
              value={value}
              onSelect={select}
              onRequestClose={() => setOpen(false)}
              listboxId={listboxId}
            />
          </div>,
          document.body,
        )}
    </div>
  );
}
