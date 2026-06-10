'use client';

import { startTransition, useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@/shared/icons';
import { cx } from '@/shared/lib/cx';

/* XBtn — small dismiss control reused by Modal and Toast. */
export function XBtn({
  onClick,
  size = 17,
  className,
  label = 'Close',
}: {
  onClick?: () => void;
  size?: number;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cx(
        'grid size-7 place-items-center rounded-sm border-0 bg-transparent text-fg-3',
        'cursor-pointer transition-colors hover:bg-elev-3 hover:text-fg',
        className,
      )}
    >
      <Icon.x size={size} />
    </button>
  );
}

export interface ModalProps {
  title: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  lg?: boolean;
}

export function Modal({ title, onClose, children, footer, lg }: ModalProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    startTransition(() => setMounted(true));
  }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  if (!mounted) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-[rgba(4,6,9,0.62)] p-6 backdrop-blur-[2px] animate-fade-in"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="cc-modal-title"
        onMouseDown={(e) => e.stopPropagation()}
        className={cx(
          'flex max-h-[88vh] w-full flex-col rounded-lg border border-border-strong bg-elev-2',
          'shadow-[var(--shadow-lg)] animate-pop-in',
          lg ? 'max-w-[720px]' : 'max-w-[560px]',
        )}
      >
        <div className="flex items-center gap-3 border-b border-border px-[18px] py-4">
          <div
            id="cc-modal-title"
            className="flex-1 text-base font-semibold text-fg"
          >
            {title}
          </div>
          <XBtn onClick={onClose} />
        </div>
        <div className="overflow-y-auto p-[18px]">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 border-t border-border px-[18px] py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
