'use client';

import {
  Fragment,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/shared/lib/cx';

export type MenuItem = {
  key: string;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
  /** Draw a divider above this item. */
  separated?: boolean;
  onSelect: () => void;
};

/** Viewport point the menu opens from. `align: 'end'` puts the menu's right
 *  edge on `x` (dropdown under a right-aligned trigger); `'start'` puts its left
 *  edge there (context menu at the cursor). */
export type MenuAnchor = {
  x: number;
  y: number;
  align?: 'start' | 'end';
  /** Where to put the menu's bottom edge when it must open upward (a
   *  trigger's top), so it doesn't cover the trigger. Defaults to `y`. */
  flipY?: number;
};

const EDGE = 8;

/* ============================================================
   Menu — portaled, fixed-position action menu. Used both as a
   dropdown (anchored to a trigger) and as a right-click context
   menu (anchored to the cursor). Closes on outside mousedown,
   Escape, Tab, scroll and resize; arrow keys move focus.
   ============================================================ */
export function Menu({
  anchor,
  items,
  onClose,
  label,
  triggerRef,
}: {
  anchor: MenuAnchor;
  items: MenuItem[];
  onClose: () => void;
  label: string;
  /** Clicks on the trigger are left to the trigger (it toggles the menu). */
  triggerRef?: RefObject<HTMLElement | null>;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ left: number; top: number } | null>(null);

  // Measure before paint and clamp inside the viewport (flip up when the menu
  // would run off the bottom, e.g. right-clicking the last sidebar row).
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const { width, height } = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = anchor.align === 'end' ? anchor.x - width : anchor.x;
    let top = anchor.y;
    if (top + height > vh - EDGE)
      top = Math.max(EDGE, (anchor.flipY ?? anchor.y) - height);
    left = Math.min(Math.max(EDGE, left), vw - width - EDGE);
    setPos({ left, top });
    el.querySelector<HTMLElement>('[role="menuitem"]')?.focus();
  }, [anchor]);

  useEffect(() => {
    // Capture phase so a modal's stopPropagation can't swallow the close.
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || triggerRef?.current?.contains(t)) return;
      onClose();
    };
    const onScroll = (e: Event) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    document.addEventListener('mousedown', onDown, true);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onClose);
    window.addEventListener('blur', onClose);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onClose);
      window.removeEventListener('blur', onClose);
    };
  }, [onClose, triggerRef]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const els = Array.from(
      ref.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [],
    );
    const i = els.indexOf(document.activeElement as HTMLElement);
    const move = (n: number) => els[(i + n + els.length) % els.length]?.focus();
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        move(1);
        break;
      case 'ArrowUp':
        e.preventDefault();
        move(-1);
        break;
      case 'Home':
        e.preventDefault();
        els[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        els[els.length - 1]?.focus();
        break;
      case 'Escape':
        e.preventDefault();
        e.stopPropagation();
        onClose();
        triggerRef?.current?.focus();
        break;
      case 'Tab':
        e.preventDefault();
        onClose();
        break;
    }
  };

  return createPortal(
    <div
      ref={ref}
      role="menu"
      aria-label={label}
      onKeyDown={onKeyDown}
      onContextMenu={(e) => e.preventDefault()}
      style={pos ?? { left: anchor.x, top: anchor.y, visibility: 'hidden' }}
      className="fixed z-[110] w-max min-w-[168px] max-w-[calc(100vw-16px)] rounded-md border border-border-strong bg-elev-2 p-1 shadow-[var(--shadow-pop)] animate-pop-in"
    >
      {items.map((it) => (
        <Fragment key={it.key}>
          {it.separated && (
            <div role="separator" className="mx-1 my-1 h-px bg-border" />
          )}
          <button
            type="button"
            role="menuitem"
            tabIndex={-1}
            onClick={() => {
              onClose();
              it.onSelect();
            }}
            className={cx(
              'flex w-full cursor-pointer items-center gap-2.5 rounded-xs border-0 bg-transparent px-2.5 py-[7px] text-left text-[13px] outline-none transition-colors',
              '[&_svg]:flex-none',
              it.danger
                ? 'text-danger-fg hover:bg-danger-bg focus:bg-danger-bg'
                : 'text-fg-2 hover:bg-elev-4 hover:text-fg focus:bg-elev-4 focus:text-fg [&_svg]:text-fg-3',
            )}
          >
            {it.icon}
            {it.label}
          </button>
        </Fragment>
      ))}
    </div>,
    document.body,
  );
}
