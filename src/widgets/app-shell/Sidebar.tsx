'use client';

import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
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
  type SidebarContract,
} from '@/widgets/app-shell/lib/filterContracts';
import { useAppShell } from '@/widgets/app-shell/AppShellProvider';
import { Logo } from '@/widgets/app-shell/Logo';
import { BulkBar } from '@/widgets/app-shell/BulkBar';
import {
  useSidebarHydrated,
  useSidebarStore,
} from '@/widgets/app-shell/model/sidebarStore';
import { useContractsStore } from '@/entities/contract/model/store';
import type { TContract } from '@/entities/contract/model/types';
import { ShareModal } from '@/features/share/ui/ShareModal';
import { useDeleteContracts } from '@/features/delete-contract/model/useDeleteContracts';

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
}: {
  contract: TContract;
  active: boolean;
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
      className="group relative"
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
          <div className="mt-px font-mono text-[11.5px] text-fg-3">
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
  const groups = filterAndGroup(contracts, { scope, query: q, currentChainId });

  const collapsed = useSidebarStore((s) => s.collapsed);
  const hydrated = useSidebarHydrated();
  // Searching shows every match, whatever is collapsed.
  const searching = q.trim() !== '';
  const activeChainId =
    pathname === '/' ? byId.get(selectedId ?? '')?.chainId : undefined;

  // Opening a contract (sidebar, History, shared link, Duplicate…) expands its
  // chain so you can see where you are. Keyed on the selection, so collapsing
  // the active contract's chain afterwards sticks.
  useEffect(() => {
    if (hydrated && activeChainId !== undefined)
      useSidebarStore.getState().expandChain(activeChainId);
  }, [hydrated, selectedId, activeChainId]);

  const onChainHeaderClick = (e: React.MouseEvent, chainId: number) => {
    const { toggleChain, setAll } = useSidebarStore.getState();
    // Alt-click: collapse/expand every chain, like VS Code's tree views.
    if (e.altKey)
      setAll(
        groups.map((g) => g.chainId),
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
  const filteredIds = groups.flatMap((g) => g.contracts.map((c) => c.id));
  // In sidebar order (filtered first, then any the filter hides); ids deleted
  // elsewhere while selecting drop out.
  const selectedIds = [
    ...filteredIds,
    ...rawContracts.map((c) => c.id).filter((id) => !filteredIds.includes(id)),
  ].filter((id) => picked.has(id));
  const visibleIds = groups
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

  /* ---------- Bottom nav item ---------- */
  const navLinks: { href: string; icon: React.ReactNode; label: string }[] = [
    { href: '/deploy', icon: <Icon.rocket size={15} />, label: 'Deploy' },
    { href: '/sign', icon: <Icon.sign size={15} />, label: 'Sign' },
    { href: '/history', icon: <Icon.history size={15} />, label: 'History' },
  ];

  return (
    <aside className="flex min-h-0 flex-col border-r border-border bg-elev-1 max-[860px]:hidden">
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
            </div>
          ))}

        {groups.map(({ chainId, contracts: list }) => {
          // Non-reactive: can't call hooks inside a map. The static catalog is
          // populated synchronously at store init, so names resolve correctly.
          const chain = catalogDisplay(chainId);
          const isCollapsed = !searching && collapsed.includes(chainId);
          const listId = `sidebar-chain-${chainId}`;
          return (
            <div key={chainId} className="mb-3">
              <div className="flex items-center">
                {selecting &&
                  (() => {
                    const ids = list.map((c) => c.id);
                    const n = ids.filter((id) => picked.has(id)).length;
                    return (
                      // Lines up with the rows' checkboxes (26px slot after 10px).
                      <span className="ml-[10px] grid w-[26px] flex-none place-items-center">
                        <Checkbox
                          aria-label={`Select all on ${chain.name}`}
                          checked={n === ids.length}
                          indeterminate={n > 0 && n < ids.length}
                          onChange={() => setMany(ids, n < ids.length)}
                        />
                      </span>
                    );
                  })()}
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
                  className="group/chain flex w-full items-center gap-[7px] rounded-sm border-0 bg-transparent px-2 py-1.5 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-fg-3 transition-colors enabled:cursor-pointer enabled:hover:bg-elev-3 enabled:hover:text-fg-2"
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
              </div>
              {/* 0fr↔1fr grid rows animate the height; `inert` keeps the
                  hidden rows out of the tab order and accessibility tree. */}
              <div
                id={listId}
                inert={isCollapsed}
                className={cx(
                  'grid transition-[grid-template-rows] duration-150 ease-out',
                  isCollapsed ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]',
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  {list.map((c) => {
                    const contract = byId.get(c.id);
                    if (!contract) return null;
                    return (
                      <ContractRow
                        key={c.id}
                        contract={contract}
                        active={selectedId === c.id && pathname === '/'}
                        selecting={selecting}
                        checked={picked.has(c.id)}
                        onRowClick={onRowClick(c.id)}
                        onStartSelect={() => startSelect(c.id)}
                      />
                    );
                  })}
                </div>
              </div>
            </div>
          );
        })}
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
