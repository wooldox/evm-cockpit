'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { cx } from '@/shared/lib/cx';
import { Icon } from '@/shared/icons';
import { Button } from './button';

export type ConfirmOptions = {
  title: ReactNode;
  description?: ReactNode;
  /** Defaults to "Confirm" ("Delete" reads better for destructive actions). */
  confirmLabel?: string;
  cancelLabel?: string;
  /** `danger` = destructive action: red confirm button + warning icon. */
  tone?: 'danger' | 'default';
};

/* ============================================================
   AlertDialog — modal confirmation that demands an explicit
   choice (role="alertdialog"): no backdrop-click dismiss, focus
   starts on Cancel and is trapped between the actions, Escape
   cancels, and focus returns to where it was on close.
   ============================================================ */
export function AlertDialog({
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'default',
  onResolve,
}: ConfirmOptions & { onResolve: (confirmed: boolean) => void }) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();
    return () => prev?.focus?.();
  }, []);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onResolve(false);
    } else if (e.key === 'Tab') {
      const els = Array.from(
        ref.current?.querySelectorAll<HTMLElement>('button') ?? [],
      );
      const first = els[0];
      const last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-[120] grid place-items-center bg-[rgba(4,6,9,0.62)] p-6 backdrop-blur-[2px] animate-fade-in">
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={description ? `${id}-desc` : undefined}
        onKeyDown={onKeyDown}
        className="w-full max-w-[420px] rounded-lg border border-border-strong bg-elev-2 p-5 shadow-[var(--shadow-lg)] animate-pop-in"
      >
        <div className="flex gap-3.5">
          {tone === 'danger' && (
            <span className="grid size-9 flex-none place-items-center rounded-full bg-danger-bg text-danger-fg">
              <Icon.alert size={17} />
            </span>
          )}
          <div className="min-w-0 flex-1">
            <h2
              id={`${id}-title`}
              className="text-[15px] font-semibold text-fg [overflow-wrap:anywhere]"
            >
              {title}
            </h2>
            {description && (
              <div
                id={`${id}-desc`}
                className="mt-1.5 text-[13px] leading-[1.5] text-fg-3 [overflow-wrap:anywhere]"
              >
                {description}
              </div>
            )}
          </div>
        </div>
        <div className={cx('mt-5 flex justify-end gap-2')}>
          <Button
            ref={cancelRef}
            variant="ghost"
            onClick={() => onResolve(false)}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            fill={tone === 'danger' ? 'solid' : undefined}
            onClick={() => onResolve(true)}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ── useConfirm: promise-based drop-in for window.confirm ── */

type Pending = ConfirmOptions & { resolve: (ok: boolean) => void };

const ConfirmCtx = createContext<
  ((opts: ConfirmOptions) => Promise<boolean>) | null
>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(
    (opts: ConfirmOptions) =>
      new Promise<boolean>((resolve) => setPending({ ...opts, resolve })),
    [],
  );

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}
      {pending && (
        <AlertDialog
          {...pending}
          onResolve={(ok) => {
            pending.resolve(ok);
            setPending(null);
          }}
        />
      )}
    </ConfirmCtx.Provider>
  );
}

/** `if (!(await confirm({ title: 'Delete X?', tone: 'danger' }))) return;` */
export function useConfirm(): (opts: ConfirmOptions) => Promise<boolean> {
  const ctx = useContext(ConfirmCtx);
  if (!ctx) throw new Error('useConfirm must be used within <ConfirmProvider>');
  return ctx;
}
