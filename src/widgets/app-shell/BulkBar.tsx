'use client';

import { Icon } from '@/shared/icons';
import { Button, Muted, XBtn } from '@/shared/ui';

/** Floating action bar shown under the contract list in select mode. */
export function BulkBar({
  count,
  hidden,
  allSelected,
  onSelectAll,
  onShare,
  onDelete,
  onClose,
}: {
  count: number;
  /** Selected contracts the current search/scope filter hides. */
  hidden: number;
  allSelected: boolean;
  onSelectAll: () => void;
  onShare: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  return (
    <div
      role="toolbar"
      aria-label="Bulk actions"
      className="mx-2 mb-2 rounded-md border border-border-strong bg-elev-2 p-2 shadow-[var(--shadow-pop)] animate-pop-in"
    >
      <div className="flex items-center justify-between gap-2 pb-1.5 pl-1">
        <span className="text-[13px] font-medium text-fg" aria-live="polite">
          {count} selected
          {hidden > 0 && (
            <Muted className="text-xs font-normal">
              {' '}
              · {hidden} hidden by filter
            </Muted>
          )}
        </span>
        <XBtn
          onClick={onClose}
          size={15}
          label="Exit selection (Esc)"
          className="size-6"
        />
      </div>
      <div className="flex gap-1">
        <Button
          variant="ghost"
          size="sm"
          icon={<Icon.checkCircle size={13} />}
          onClick={onSelectAll}
          disabled={allSelected}
          className="flex-1"
        >
          Select all
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<Icon.share size={13} />}
          onClick={onShare}
          disabled={count === 0}
          className="flex-1"
        >
          Share
        </Button>
        <Button
          variant="danger"
          size="sm"
          icon={<Icon.trash size={13} />}
          onClick={onDelete}
          disabled={count === 0}
          className="flex-1"
        >
          Delete
        </Button>
      </div>
    </div>
  );
}
