'use client';

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import {
  DndContext,
  MeasuringStrategy,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
  type Modifier,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cx } from '@/shared/lib/cx';
import { trunc } from '@/shared/lib/format';
import { Icon } from '@/shared/icons';
import {
  Button,
  ChainGlyph,
  Checkbox,
  CheckMark,
  Menu,
  type MenuAnchor,
  type MenuItem,
} from '@/shared/ui';
import { Ident } from '@/shared/ui/copyable';
import {
  catalogDisplay,
  useChainDisplay,
} from '@/entities/chain/model/catalogStore';
import {
  filterAndGroup,
  filterContracts,
  type SidebarContract,
} from '@/widgets/app-shell/lib/filterContracts';
import { useAppShell } from '@/widgets/app-shell/AppShellProvider';
import { Logo } from '@/widgets/app-shell/Logo';
import { BulkBar } from '@/widgets/app-shell/BulkBar';
import { useImportFiles } from '@/widgets/app-shell/ShellImport';
import {
  useSidebarHydrated,
  useSidebarStore,
} from '@/widgets/app-shell/model/sidebarStore';
import { useContractsStore } from '@/entities/contract/model/store';
import type { TContract } from '@/entities/contract/model/types';
import { ShareModal } from '@/features/share/ui/ShareModal';
import { useDeleteContracts } from '@/features/delete-contract/model/useDeleteContracts';

/* ---------- useFileDrop ---------- */
/** Drag-and-drop target for files (ignores text/links being dragged). A depth
 *  counter keeps `dragging` steady while the pointer crosses child elements. */
function useFileDrop(onFiles: (files: File[]) => void) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);
  const hasFiles = (e: React.DragEvent) =>
    e.dataTransfer.types.includes('Files');
  return {
    dragging,
    handlers: {
      onDragEnter: (e: React.DragEvent) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current += 1;
        setDragging(true);
      },
      onDragOver: (e: React.DragEvent) => {
        if (!hasFiles(e)) return;
        // Required for the element to accept a drop.
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
      },
      onDragLeave: (e: React.DragEvent) => {
        if (!hasFiles(e)) return;
        depth.current = Math.max(0, depth.current - 1);
        if (depth.current === 0) setDragging(false);
      },
      onDrop: (e: React.DragEvent) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        depth.current = 0;
        setDragging(false);
        onFiles([...e.dataTransfer.files]);
      },
    },
  };
}

/** Group key for the Pinned section (0 is never a real chain id). */
const PINNED = 0;

/* ---------- Drag-to-reorder helpers ---------- */
type TDragData =
  | { kind: 'chain'; chainId: number }
  | { kind: 'contract'; chainId: number };

/** Sidebar drags only move up/down. */
const verticalOnly: Modifier = ({ transform }) => ({ ...transform, x: 0 });

/** A chain only lands among chains; a contract only among its own chain's
 *  contracts (moving it to another chain is what Edit is for). */
const sameKindCollision: CollisionDetection = (args) => {
  const a = args.active.data.current as TDragData | undefined;
  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter((c) => {
      const d = c.data.current as TDragData | undefined;
      return (
        d?.kind === a?.kind &&
        (a?.kind === 'chain' || d?.chainId === a?.chainId)
      );
    }),
  });
};

/** Sortable wrapper for a chain group; the header gets the drag listeners. */
function SortableGroup({
  chainId,
  disabled,
  children,
}: {
  chainId: number;
  disabled: boolean;
  children: (
    dragHandle: ReturnType<typeof useSortable>['listeners'],
    dragging: boolean,
  ) => React.ReactNode;
}) {
  const { setNodeRef, listeners, transform, transition, isDragging } =
    useSortable({
      id: `chain:${chainId}`,
      data: { kind: 'chain', chainId } satisfies TDragData,
      disabled,
    });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cx('mb-3', isDragging && 'relative z-20')}
    >
      {children(listeners, isDragging)}
    </div>
  );
}

/* ---------- ChainHeaderRow: header + its ⋯ / right-click menu ---------- */
function ChainHeaderRow({
  chainName,
  onMove,
  dragHandle,
  children,
}: {
  chainName: string;
  /** Move the whole chain up/down; empty when reordering is unavailable. */
  onMove: { up?: () => void; down?: () => void };
  dragHandle: ReturnType<typeof useSortable>['listeners'];
  children: React.ReactNode;
}) {
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setMenu(null), []);
  const items: MenuItem[] = [
    ...(onMove.up
      ? [
          {
            key: 'up',
            label: 'Move chain up',
            icon: <Icon.chevD size={14} className="rotate-180" />,
            onSelect: onMove.up,
          },
        ]
      : []),
    ...(onMove.down
      ? [
          {
            key: 'down',
            label: 'Move chain down',
            icon: <Icon.chevD size={14} />,
            onSelect: onMove.down,
          },
        ]
      : []),
  ];
  return (
    <div
      {...dragHandle}
      className="group/hdr relative flex items-center"
      onContextMenu={(e) => {
        if (!items.length) return;
        e.preventDefault();
        setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      {children}
      {items.length > 0 && (
        <button
          ref={ref}
          type="button"
          aria-label={`Actions for ${chainName}`}
          aria-haspopup="menu"
          aria-expanded={!!menu}
          title="Actions"
          onClick={() => {
            if (menu) return setMenu(null);
            const r = ref.current!.getBoundingClientRect();
            setMenu({ x: r.right, y: r.bottom + 4, align: 'end' });
          }}
          className={cx(
            'ml-0.5 grid size-6 flex-none cursor-pointer place-items-center rounded-sm border-0 bg-transparent text-fg-3 transition-[opacity,color,background-color] hover:bg-elev-4 hover:text-fg focus-visible:opacity-100',
            menu
              ? 'bg-elev-4 text-fg opacity-100'
              : 'opacity-0 group-hover/hdr:opacity-100',
          )}
        >
          <Icon.dots size={14} />
        </button>
      )}
      {menu && (
        <Menu
          anchor={menu}
          items={items}
          onClose={close}
          label={`${chainName} actions`}
          triggerRef={ref}
        />
      )}
    </div>
  );
}

/* ---------- ScopeBtn ---------- */
function ScopeBtn({
  active,
  onClick,
  title,
  children,
}: {
  active: boolean;
  onClick: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      title={title}
      onClick={onClick}
      className={cx(
        'flex min-w-0 flex-1 items-center justify-center gap-1.5 overflow-hidden text-ellipsis whitespace-nowrap rounded-xs border-0 px-1.5 py-[5px] text-xs font-medium cursor-pointer transition-colors',
        active
          ? 'bg-elev-4 text-fg shadow-[var(--shadow-sm),inset_0_0_0_1px_var(--border-strong)]'
          : 'bg-transparent text-fg-3 hover:text-fg-2',
      )}
    >
      {children}
    </button>
  );
}

/* ---------- AddMenu: "+" → add or import ---------- */
function AddMenu() {
  const { openAdd, openImportFile } = useAppShell();
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setMenu(null), []);
  return (
    <>
      <Button
        ref={ref}
        variant="subtle"
        icon={<Icon.plus size={15} />}
        title="Add or import contracts"
        aria-label="Add or import contracts"
        aria-haspopup="menu"
        aria-expanded={!!menu}
        onClick={() => {
          if (menu) return setMenu(null);
          const r = ref.current!.getBoundingClientRect();
          setMenu({ x: r.right, y: r.bottom + 4, align: 'end' });
        }}
      />
      {menu && (
        <Menu
          anchor={menu}
          label="Add or import contracts"
          onClose={close}
          triggerRef={ref}
          items={[
            {
              key: 'add',
              label: 'Add contract',
              icon: <Icon.plus size={14} />,
              onSelect: openAdd,
            },
            {
              key: 'import',
              label: 'Import from file…',
              icon: <Icon.file size={14} />,
              onSelect: openImportFile,
            },
          ]}
        />
      )}
    </>
  );
}

/* ---------- ContractRow ---------- */
function ContractRow({
  contract,
  active,
  selecting,
  checked,
  onRowClick,
  onStartSelect,
  dragDisabled,
  onMove,
  groupKey,
  showChain,
  pinned,
  onTogglePin,
}: {
  contract: TContract;
  active: boolean;
  dragDisabled: boolean;
  /** Which list the row is in (a chain id, or PINNED) — drags stay inside it. */
  groupKey: number;
  /** Show the chain next to the address (Pinned mixes chains). */
  showChain: boolean;
  pinned: boolean;
  onTogglePin: () => void;
  /** Move up/down within its chain; absent when already at that end. */
  onMove: { up?: () => void; down?: () => void };
  /** Bulk-select mode: the row toggles a checkbox instead of opening. */
  selecting: boolean;
  checked: boolean;
  onRowClick: (e: React.MouseEvent) => void;
  onStartSelect: () => void;
}) {
  const { openEdit, openDuplicate } = useAppShell();
  const router = useRouter();
  const deleteContracts = useDeleteContracts();
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const shareList = useMemo(() => [contract], [contract]);
  const dotsRef = useRef<HTMLButtonElement>(null);
  const closeMenu = useCallback(() => setMenu(null), []);
  const proxy = !!contract.proxy;
  const { setNodeRef, listeners, transform, transition, isDragging } =
    useSortable({
      id: `c:${contract.id}`,
      data: { kind: 'contract', chainId: groupKey } satisfies TDragData,
      disabled: dragDisabled,
    });

  const handleDelete = async () => {
    if ((await deleteContracts([contract])) && active) router.push('/');
  };

  const items: MenuItem[] = [
    {
      key: 'edit',
      label: 'Edit',
      icon: <Icon.edit size={14} />,
      onSelect: () => openEdit(contract),
    },
    {
      key: 'duplicate',
      label: 'Duplicate',
      icon: <Icon.copy size={14} />,
      onSelect: () => openDuplicate(contract),
    },
    {
      key: 'share',
      label: 'Share',
      icon: <Icon.share size={14} />,
      onSelect: () => setShareOpen(true),
    },
    {
      key: 'history',
      label: 'History',
      icon: <Icon.history size={14} />,
      onSelect: () => router.push(`/history?c=${contract.id}`),
    },
    {
      key: 'pin',
      label: pinned ? 'Unpin' : 'Pin to top',
      icon: <Icon.pin size={14} />,
      onSelect: onTogglePin,
    },
    ...(onMove.up
      ? [
          {
            key: 'up',
            label: 'Move up',
            icon: <Icon.chevD size={14} className="rotate-180" />,
            separated: true,
            onSelect: onMove.up,
          },
        ]
      : []),
    ...(onMove.down
      ? [
          {
            key: 'down',
            label: 'Move down',
            icon: <Icon.chevD size={14} />,
            separated: !onMove.up,
            onSelect: onMove.down,
          },
        ]
      : []),
    {
      key: 'select',
      label: 'Select',
      icon: <Icon.checkCircle size={14} />,
      onSelect: onStartSelect,
    },
    {
      key: 'delete',
      label: 'Delete',
      icon: <Icon.trash size={14} />,
      danger: true,
      separated: true,
      onSelect: handleDelete,
    },
  ];

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cx(
        'group relative',
        isDragging &&
          'z-20 rounded-sm bg-elev-3 shadow-[var(--shadow-pop)] [&_button]:cursor-grabbing',
      )}
      onContextMenu={(e) => {
        e.preventDefault();
        if (!selecting) setMenu({ x: e.clientX, y: e.clientY });
      }}
    >
      <button
        type="button"
        onClick={onRowClick}
        {...(selecting && { role: 'checkbox', 'aria-checked': checked })}
        className={cx(
          'flex w-full items-center gap-2.5 rounded-sm border px-[9px] py-2 text-left transition-colors',
          active && !selecting
            ? 'border-border-strong bg-elev-3'
            : menu || (selecting && checked)
              ? 'border-transparent bg-elev-3'
              : 'border-transparent bg-transparent hover:bg-elev-3',
        )}
      >
        {selecting ? (
          // Same 26px slot as the identicon, so the row height doesn't change.
          <span className="grid size-[26px] flex-none place-items-center">
            <CheckMark checked={checked} />
          </span>
        ) : (
          <Ident seed={contract.address} size={26} />
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[5px] overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium text-fg">
            {contract.name}
            {proxy && (
              <span className="text-[11px] text-read-fg" title="Proxy">
                ⃝
              </span>
            )}
          </div>
          <div className="mt-px flex items-center gap-1.5 font-mono text-[11.5px] text-fg-3">
            {showChain && (
              <span title={catalogDisplay(contract.chainId).name}>
                <ChainGlyph
                  chain={catalogDisplay(contract.chainId)}
                  size={11}
                />
              </span>
            )}
            {trunc(contract.address, 5)}
          </div>
        </div>
        {proxy && (
          <span
            className={cx(
              'rounded-[4px] border border-read-border bg-read-bg px-[5px] py-px font-mono text-[10px] text-read-fg transition-opacity',
              // Yield the slot to the dots trigger while it's showing.
              menu
                ? 'opacity-0'
                : 'group-hover:opacity-0 group-has-[:focus-visible]:opacity-0',
            )}
          >
            proxy
          </span>
        )}
      </button>
      {!selecting && (
        <button
          ref={dotsRef}
          type="button"
          aria-label={`Actions for ${contract.name}`}
          aria-haspopup="menu"
          aria-expanded={!!menu}
          title="Actions"
          onClick={() => {
            if (menu) return setMenu(null);
            const r = dotsRef.current!.getBoundingClientRect();
            setMenu({ x: r.right, y: r.bottom + 4, align: 'end' });
          }}
          className={cx(
            'absolute right-1.5 top-1/2 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-sm border-0 bg-transparent text-fg-3 transition-[opacity,color,background-color] hover:bg-elev-4 hover:text-fg focus-visible:opacity-100',
            menu
              ? 'bg-elev-4 text-fg opacity-100'
              : 'opacity-0 group-hover:opacity-100 group-has-[:focus-visible]:opacity-100',
          )}
        >
          <Icon.dots size={16} />
        </button>
      )}
      {menu && (
        <Menu
          anchor={menu}
          items={items}
          onClose={closeMenu}
          label={`${contract.name} actions`}
          triggerRef={dotsRef}
        />
      )}
      {shareOpen && (
        <ShareModal contracts={shareList} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
}

/* ---------- Sidebar ---------- */
export function Sidebar({
  currentId,
  onSelect,
}: {
  currentId?: string;
  onSelect?: (id: string) => void;
}) {
  const { currentChainId } = useAppShell();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = currentId ?? searchParams.get('c') ?? undefined;
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'all' | 'current'>('all');

  const rawContracts = useContractsStore((s) => s.contracts);
  const byId = new Map(rawContracts.map((c) => [c.id, c]));
  const contracts: SidebarContract[] = rawContracts.map((c) => ({
    id: c.id,
    name: c.name,
    address: c.address,
    chainId: c.chainId,
    proxy: !!c.proxy,
  }));

  const currentChain = useChainDisplay(currentChainId);
  const chainOrder = useSidebarStore((s) => s.chainOrder);
  // Pinned contracts live in their own section above the chains (in pin
  // order) and leave their chain group, so nothing shows twice.
  const pinnedIds = useSidebarStore((s) => s.pinned).filter((id) =>
    byId.has(id),
  );
  const pinnedSet = new Set(pinnedIds);
  const unpinned = contracts.filter((c) => !pinnedSet.has(c.id));
  const sidebarById = new Map(contracts.map((c) => [c.id, c]));
  const pinnedList = filterContracts(
    pinnedIds.map((id) => sidebarById.get(id)!),
    { scope, query: q, currentChainId },
  );
  const groups = filterAndGroup(unpinned, {
    scope,
    query: q,
    currentChainId,
    chainOrder,
  });
  // Every chain in display order, whatever the filter — what reordering acts on.
  const allChainIds = filterAndGroup(unpinned, {
    scope: 'all',
    query: '',
    currentChainId,
    chainOrder,
  }).map((g) => g.chainId);

  const collapsed = useSidebarStore((s) => s.collapsed);
  const hydrated = useSidebarHydrated();
  // Searching shows every match, whatever is collapsed.
  const searching = q.trim() !== '';
  // The group the open contract is shown in (Pinned or its chain).
  const activeChainId =
    pathname !== '/' || !selectedId
      ? undefined
      : pinnedSet.has(selectedId)
        ? PINNED
        : byId.get(selectedId)?.chainId;

  // Opening a contract (sidebar, History, shared link, Duplicate…) expands its
  // chain so you can see where you are. Keyed on the selection, so collapsing
  // the active contract's chain afterwards sticks.
  useEffect(() => {
    if (hydrated && activeChainId !== undefined)
      useSidebarStore.getState().expandChain(activeChainId);
  }, [hydrated, selectedId, activeChainId]);

  const onChainHeaderClick = (e: React.MouseEvent, chainId: number) => {
    if (justDragged.current) return;
    const { toggleChain, setAll } = useSidebarStore.getState();
    // Alt-click: collapse/expand every chain, like VS Code's tree views.
    if (e.altKey)
      setAll(
        [PINNED, ...groups.map((g) => g.chainId)],
        !collapsed.includes(chainId),
      );
    else toggleChain(chainId);
  };
  const hasContracts = contracts.length > 0;

  /* ---------- Bulk select ---------- */
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState<Set<string>>(() => new Set());
  // Last row toggled without Shift — the anchor for Shift-click ranges.
  const anchorRef = useRef<string | null>(null);
  const [shareList, setShareList] = useState<TContract[] | null>(null);
  const deleteContracts = useDeleteContracts();

  // "Select all" = everything the current scope/search shows (collapsed
  // chains included); Shift-click ranges only span rows actually on screen.
  const filteredIds = [
    ...pinnedList.map((c) => c.id),
    ...groups.flatMap((g) => g.contracts.map((c) => c.id)),
  ];
  // In sidebar order (filtered first, then any the filter hides); ids deleted
  // elsewhere while selecting drop out.
  const selectedIds = [
    ...filteredIds,
    ...rawContracts.map((c) => c.id).filter((id) => !filteredIds.includes(id)),
  ].filter((id) => picked.has(id));
  const visibleIds = [{ chainId: PINNED, contracts: pinnedList }, ...groups]
    .filter((g) => searching || !collapsed.includes(g.chainId))
    .flatMap((g) => g.contracts.map((c) => c.id));
  const filteredSet = new Set(filteredIds);
  const hiddenSelected = selectedIds.filter((id) => !filteredSet.has(id));
  const allSelected =
    filteredIds.length > 0 && filteredIds.every((id) => picked.has(id));

  const exitSelect = useCallback(() => {
    setSelecting(false);
    setPicked(new Set());
    anchorRef.current = null;
  }, []);

  const startSelect = (id: string) => {
    setSelecting(true);
    setPicked(new Set([id]));
    anchorRef.current = id;
  };

  const toggle = (id: string, range: boolean) => {
    const anchor = anchorRef.current;
    const from = anchor ? visibleIds.indexOf(anchor) : -1;
    const to = visibleIds.indexOf(id);
    if (range && from !== -1 && to !== -1) {
      const [a, b] = from < to ? [from, to] : [to, from];
      setPicked((p) => new Set([...p, ...visibleIds.slice(a, b + 1)]));
      return;
    }
    anchorRef.current = id;
    setPicked((p) => {
      const next = new Set(p);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const setMany = (ids: string[], on: boolean) =>
    setPicked((p) => {
      const next = new Set(p);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });

  const onRowClick = (id: string) => (e: React.MouseEvent) => {
    if (justDragged.current) return;
    if (selecting) return toggle(id, e.shiftKey);
    // Cmd/Ctrl/Shift-click enters select mode with this row picked.
    if (e.metaKey || e.ctrlKey || e.shiftKey) return startSelect(id);
    router.push(`/?c=${id}`);
    onSelect?.(id);
  };

  const handleBulkDelete = async () => {
    const list = selectedIds.map((id) => byId.get(id)!);
    if (!(await deleteContracts(list))) return;
    if (selectedId && picked.has(selectedId) && pathname === '/')
      router.push('/');
    exitSelect();
  };

  // Escape leaves select mode — unless a dialog or menu is open (Escape is
  // theirs then).
  useEffect(() => {
    if (!selecting) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (
        document.querySelector('[role=dialog],[role=alertdialog],[role=menu]')
      )
        return;
      exitSelect();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selecting, exitSelect]);

  /* ---------- Reordering (drag + Move up/down) ---------- */
  const sensors = useSensors(
    // A few px of movement before a drag starts, so clicks still click.
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const [dragKind, setDragKind] = useState<TDragData['kind'] | null>(null);
  // A drag ends with a pointerup on the row/header, and the browser follows
  // it with a click in the same task — swallow that one click.
  const justDragged = useRef(false);
  // Dragging needs every row on screen in its real order: off while searching
  // or bulk-selecting; chains also stay put when only one chain is shown.
  const contractDragOff = searching || selecting;
  const chainDragOff = contractDragOff || scope === 'current';

  const moveChain = (chainId: number, delta: -1 | 1) => {
    const i = allChainIds.indexOf(chainId);
    useSidebarStore
      .getState()
      .setChainOrder(arrayMove(allChainIds, i, i + delta));
  };
  /** Ids in a group's display order: the pin order, or a chain's unpinned
   *  contracts (pinned ones keep their hidden slots in the chain). */
  const groupIds = (key: number) =>
    key === PINNED
      ? pinnedIds
      : rawContracts
          .filter((c) => c.chainId === key && !pinnedSet.has(c.id))
          .map((c) => c.id);
  /** Apply a new order for a group's ids (see groupIds). */
  const reorderGroup = (key: number, ordered: string[]) => {
    if (key === PINNED) return useSidebarStore.getState().setPinned(ordered);
    const queue = [...ordered];
    const full = rawContracts
      .filter((c) => c.chainId === key)
      .map((c) => (pinnedSet.has(c.id) ? c.id : queue.shift()!));
    useContractsStore.getState().reorderChain(key, full);
  };
  const moveInGroup = (key: number, id: string, delta: -1 | 1) => {
    const ids = groupIds(key);
    const i = ids.indexOf(id);
    reorderGroup(key, arrayMove(ids, i, i + delta));
  };

  const onDragStart = ({ active }: DragStartEvent) =>
    setDragKind((active.data.current as TDragData).kind);
  const onDragEnd = ({ active, over }: DragEndEvent) => {
    justDragged.current = true;
    setTimeout(() => (justDragged.current = false), 0);
    setDragKind(null);
    if (!over || active.id === over.id) return;
    const a = active.data.current as TDragData;
    const o = over.data.current as TDragData;
    if (a.kind === 'chain' && o.kind === 'chain') {
      useSidebarStore
        .getState()
        .setChainOrder(
          arrayMove(
            allChainIds,
            allChainIds.indexOf(a.chainId),
            allChainIds.indexOf(o.chainId),
          ),
        );
    } else if (a.kind === 'contract' && a.chainId === o.chainId) {
      const ids = groupIds(a.chainId);
      const from = ids.indexOf(String(active.id).slice(2));
      const to = ids.indexOf(String(over.id).slice(2));
      reorderGroup(a.chainId, arrayMove(ids, from, to));
    }
  };

  // Drop exported .json files anywhere on the sidebar to import them.
  const importFiles = useImportFiles();
  const drop = useFileDrop((files) => void importFiles(files));

  /** A group's sortable rows (a chain's, or Pinned). */
  const renderRows = (key: number, list: SidebarContract[]) => {
    const ids = groupIds(key);
    return (
      <SortableContext
        items={list.map((c) => `c:${c.id}`)}
        strategy={verticalListSortingStrategy}
      >
        {list.map((c) => {
          const contract = byId.get(c.id);
          if (!contract) return null;
          const i = ids.indexOf(c.id);
          return (
            <ContractRow
              key={c.id}
              contract={contract}
              active={selectedId === c.id && pathname === '/'}
              selecting={selecting}
              checked={picked.has(c.id)}
              onRowClick={onRowClick(c.id)}
              onStartSelect={() => startSelect(c.id)}
              dragDisabled={contractDragOff}
              groupKey={key}
              showChain={key === PINNED}
              pinned={pinnedSet.has(c.id)}
              onTogglePin={() => useSidebarStore.getState().togglePin(c.id)}
              onMove={{
                up: i > 0 ? () => moveInGroup(key, c.id, -1) : undefined,
                down:
                  i < ids.length - 1
                    ? () => moveInGroup(key, c.id, 1)
                    : undefined,
              }}
            />
          );
        })}
      </SortableContext>
    );
  };

  /** Select-mode checkbox on a group header (all / some / none picked). */
  const groupCheckbox = (ids: string[], label: string) => {
    const n = ids.filter((id) => picked.has(id)).length;
    return (
      // Lines up with the rows' checkboxes (26px slot after 10px).
      <span className="ml-[10px] grid w-[26px] flex-none place-items-center">
        <Checkbox
          aria-label={label}
          checked={n === ids.length}
          indeterminate={n > 0 && n < ids.length}
          onChange={() => setMany(ids, n < ids.length)}
        />
      </span>
    );
  };

  /* ---------- Bottom nav item ---------- */
  const navLinks: { href: string; icon: React.ReactNode; label: string }[] = [
    { href: '/deploy', icon: <Icon.rocket size={15} />, label: 'Deploy' },
    { href: '/sign', icon: <Icon.sign size={15} />, label: 'Sign' },
    { href: '/history', icon: <Icon.history size={15} />, label: 'History' },
  ];

  return (
    <aside
      {...drop.handlers}
      className="relative flex min-h-0 flex-col border-r border-border bg-elev-1 max-[860px]:hidden"
    >
      {drop.dragging && (
        <div className="pointer-events-none absolute inset-2 z-30 grid place-items-center rounded-md border-2 border-dashed border-read bg-[color-mix(in_oklab,var(--bg-elev-1)_88%,transparent)] backdrop-blur-[2px] animate-fade-in">
          <div className="flex flex-col items-center gap-2 px-6 text-center">
            <Icon.file size={22} className="text-read-fg" />
            <span className="text-[13px] font-medium text-fg">
              Drop to import contracts
            </span>
            <span className="text-xs text-fg-3">
              EVM Cockpit export (.json)
            </span>
          </div>
        </div>
      )}
      {/* Logo */}
      <div className="px-4 pb-2.5 pt-3.5">
        <Logo />
      </div>

      {/* Search + Add */}
      <div className="flex gap-[7px] px-3 pb-3 pt-1">
        <div className="relative flex flex-1 items-center">
          <Icon.search
            size={14}
            className="pointer-events-none absolute left-2.5 text-fg-3"
          />
          <input
            className="h-8 w-full rounded-sm border border-border-strong bg-elev-3 pl-[30px] pr-2.5 text-[13px] text-fg outline-none transition-colors placeholder:text-fg-4 hover:border-[var(--gray-500)] focus:border-read focus:[box-shadow:0_0_0_3px_var(--read-bg)]"
            placeholder="Search contracts"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <AddMenu />
      </div>

      {/* Scope segmented control */}
      {hasContracts && (
        <div className="px-3 pb-2.5">
          <div
            role="tablist"
            className="flex w-full gap-0.5 rounded-sm border border-border bg-elev-3 p-[3px]"
          >
            <ScopeBtn active={scope === 'all'} onClick={() => setScope('all')}>
              <Icon.layers size={13} className="flex-none" />
              <span className="min-w-0 truncate">All chains</span>
            </ScopeBtn>
            <ScopeBtn
              active={scope === 'current'}
              onClick={() => setScope('current')}
              title={`Only ${currentChain.name}`}
            >
              <ChainGlyph chain={currentChain} size={13} />
              <span className="min-w-0 truncate">{currentChain.name}</span>
            </ScopeBtn>
          </div>
        </div>
      )}

      {/* Contract list */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-1">
        {groups.length === 0 &&
          pinnedList.length === 0 &&
          (scope === 'current' && !q ? (
            <div className="px-3 py-6 text-center text-[13px] text-fg-4">
              No contracts on {currentChain.name}.
              <button
                type="button"
                className="mx-auto mt-2 block cursor-pointer border-0 bg-transparent text-read-fg underline"
                onClick={() => setScope('all')}
              >
                Show all chains
              </button>
            </div>
          ) : (
            <div className="px-3 py-6 text-center text-[13px] text-fg-4">
              {q ? 'No matches' : 'No saved contracts'}
              {!q && (
                <span className="mt-1.5 block text-xs">
                  Tip: drop an exported .json here to import it.
                </span>
              )}
            </div>
          ))}

        <DndContext
          sensors={sensors}
          collisionDetection={sameKindCollision}
          modifiers={[verticalOnly]}
          // Chain drags collapse every group to its header (below), so
          // positions must be re-measured while dragging.
          measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
          onDragCancel={() => setDragKind(null)}
        >
          {pinnedList.length > 0 &&
            (() => {
              const isCollapsed =
                dragKind === 'chain' ||
                (!searching && collapsed.includes(PINNED));
              return (
                <div className="mb-3">
                  <div className="flex items-center">
                    {selecting &&
                      groupCheckbox(
                        pinnedList.map((c) => c.id),
                        'Select all pinned',
                      )}
                    <button
                      type="button"
                      aria-expanded={!isCollapsed}
                      aria-controls="sidebar-pinned"
                      disabled={searching}
                      title={
                        searching
                          ? undefined
                          : `${isCollapsed ? 'Expand' : 'Collapse'} · Alt-click for all`
                      }
                      onClick={(e) => onChainHeaderClick(e, PINNED)}
                      className="group/chain flex min-w-0 flex-1 items-center gap-[7px] rounded-sm border-0 bg-transparent px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-fg-3 transition-colors enabled:cursor-pointer enabled:hover:bg-elev-3 enabled:hover:text-fg-2"
                    >
                      <Icon.pin size={14} className="flex-none text-read-fg" />
                      <span className="min-w-0 truncate">Pinned</span>
                      <span className="ml-auto rounded-full bg-elev-3 px-[7px] py-px text-[11px] text-fg-4">
                        {pinnedList.length}
                      </span>
                      {!searching && (
                        <Icon.chevD
                          size={13}
                          className={cx(
                            'flex-none text-fg-4 transition-transform duration-150 group-hover/chain:text-fg-3',
                            isCollapsed && '-rotate-90',
                          )}
                        />
                      )}
                    </button>
                    {/* Keeps the count/chevron aligned with chain headers,
                        which reserve room for their ⋯ button. */}
                    {!chainDragOff && allChainIds.length > 1 && (
                      <span className="ml-0.5 w-6 flex-none" />
                    )}
                  </div>
                  <div
                    id="sidebar-pinned"
                    inert={isCollapsed}
                    className={cx(
                      'grid ease-out',
                      !dragKind &&
                        'transition-[grid-template-rows] duration-150',
                      isCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
                    )}
                  >
                    <div
                      className={cx(
                        'min-h-0',
                        (isCollapsed || dragKind !== 'contract') &&
                          'overflow-hidden',
                      )}
                    >
                      {renderRows(PINNED, pinnedList)}
                    </div>
                  </div>
                </div>
              );
            })()}
          <SortableContext
            items={groups.map((g) => `chain:${g.chainId}`)}
            strategy={verticalListSortingStrategy}
          >
            {groups.map(({ chainId, contracts: list }) => {
              // Non-reactive: can't call hooks inside a map. The static catalog is
              // populated synchronously at store init, so names resolve correctly.
              const chain = catalogDisplay(chainId);
              // While a chain is dragged, every group shows just its header, so
              // you move a short header — not a dozen rows.
              const isCollapsed =
                dragKind === 'chain' ||
                (!searching && collapsed.includes(chainId));
              const listId = `sidebar-chain-${chainId}`;
              const ci = allChainIds.indexOf(chainId);
              const chainMove = chainDragOff
                ? {}
                : {
                    up: ci > 0 ? () => moveChain(chainId, -1) : undefined,
                    down:
                      ci < allChainIds.length - 1
                        ? () => moveChain(chainId, 1)
                        : undefined,
                  };
              return (
                <SortableGroup
                  key={chainId}
                  chainId={chainId}
                  disabled={chainDragOff}
                >
                  {(dragHandle) => (
                    <>
                      <ChainHeaderRow
                        chainName={chain.name}
                        onMove={chainMove}
                        dragHandle={dragHandle}
                      >
                        {selecting &&
                          groupCheckbox(
                            list.map((c) => c.id),
                            `Select all on ${chain.name}`,
                          )}
                        <button
                          type="button"
                          aria-expanded={!isCollapsed}
                          aria-controls={listId}
                          disabled={searching}
                          title={
                            searching
                              ? undefined
                              : `${isCollapsed ? 'Expand' : 'Collapse'} · Alt-click for all chains`
                          }
                          onClick={(e) => onChainHeaderClick(e, chainId)}
                          className="group/chain flex min-w-0 flex-1 items-center gap-[7px] rounded-sm border-0 bg-transparent px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-fg-3 transition-colors enabled:cursor-pointer enabled:hover:bg-elev-3 enabled:hover:text-fg-2"
                        >
                          <ChainGlyph chain={chain} size={14} />
                          <span className="min-w-0 truncate">{chain.name}</span>
                          <span className="ml-auto rounded-full bg-elev-3 px-[7px] py-px text-[11px] text-fg-4">
                            {list.length}
                          </span>
                          {!searching && (
                            <Icon.chevD
                              size={13}
                              className={cx(
                                'flex-none text-fg-4 transition-transform duration-150 group-hover/chain:text-fg-3',
                                isCollapsed && '-rotate-90',
                              )}
                            />
                          )}
                        </button>
                      </ChainHeaderRow>
                      {/* 0fr↔1fr grid rows animate the height; `inert` keeps the
                  hidden rows out of the tab order and accessibility tree. */}
                      <div
                        id={listId}
                        inert={isCollapsed}
                        className={cx(
                          'grid ease-out',
                          // No animation while a chain drag collapses everything —
                          // the drop targets must settle immediately.
                          !dragKind &&
                            'transition-[grid-template-rows] duration-150',
                          isCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
                        )}
                      >
                        {/* Collapsed groups hide their rows only by clipping, so they
                            always clip; an open group lets a dragged row's shadow spill
                            out while a contract is dragged. */}
                        <div
                          className={cx(
                            'min-h-0',
                            (isCollapsed || dragKind !== 'contract') &&
                              'overflow-hidden',
                          )}
                        >
                          {renderRows(chainId, list)}
                        </div>
                      </div>
                    </>
                  )}
                </SortableGroup>
              );
            })}
          </SortableContext>
        </DndContext>
      </div>

      {selecting && (
        <BulkBar
          count={selectedIds.length}
          hidden={hiddenSelected.length}
          allSelected={allSelected}
          onSelectAll={() => setMany(filteredIds, true)}
          onShare={() => setShareList(selectedIds.map((id) => byId.get(id)!))}
          onDelete={handleBulkDelete}
          onClose={exitSelect}
        />
      )}
      {shareList && (
        <ShareModal contracts={shareList} onClose={() => setShareList(null)} />
      )}

      {/* Bottom nav */}
      <div className="flex flex-col gap-0.5 border-t border-border p-2">
        {navLinks.map(({ href, icon, label }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={cx(
                'flex items-center gap-2.5 rounded-sm border-0 bg-transparent px-2.5 py-2 text-[13px] font-medium',
                'cursor-pointer transition-colors no-underline',
                active
                  ? 'bg-elev-3 text-fg [&_svg]:text-read-fg'
                  : 'text-fg-2 hover:bg-elev-3 hover:text-fg',
              )}
            >
              {icon}
              {label}
            </Link>
          );
        })}
      </div>
    </aside>
  );
}
