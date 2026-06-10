'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { cx } from '@/shared/lib/cx';
import { trunc } from '@/shared/lib/format';
import { Icon } from '@/shared/icons';
import { Button, ChainGlyph } from '@/shared/ui';
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
import { useContractsStore } from '@/entities/contract/model/store';

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

/* ---------- Sidebar ---------- */
export function Sidebar({
  currentId,
  onSelect,
}: {
  currentId?: string;
  onSelect?: (id: string) => void;
}) {
  const { currentChainId, openAdd } = useAppShell();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const selectedId = currentId ?? searchParams.get('c') ?? undefined;
  const [q, setQ] = useState('');
  const [scope, setScope] = useState<'all' | 'current'>('all');

  const rawContracts = useContractsStore((s) => s.contracts);
  const contracts: SidebarContract[] = rawContracts.map((c) => ({
    id: c.id,
    name: c.name,
    address: c.address,
    chainId: c.chainId,
    proxy: !!c.proxy,
  }));

  const currentChain = useChainDisplay(currentChainId);
  const groups = filterAndGroup(contracts, { scope, query: q, currentChainId });
  const hasContracts = contracts.length > 0;

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
        <Button
          variant="subtle"
          icon={<Icon.plus size={15} />}
          title="Add contract"
          onClick={openAdd}
        />
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
          return (
            <div key={chainId} className="mb-3">
              <div className="flex items-center gap-[7px] px-2 py-1.5 text-[11px] font-semibold uppercase tracking-[0.04em] text-fg-3">
                <ChainGlyph chain={chain} size={14} />
                {chain.name}
                <span className="ml-auto rounded-full bg-elev-3 px-[7px] py-px text-[11px] text-fg-4">
                  {list.length}
                </span>
              </div>
              {list.map((c) => {
                const active = selectedId === c.id && pathname === '/';
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => {
                      router.push(`/?c=${c.id}`);
                      onSelect?.(c.id);
                    }}
                    className={cx(
                      'flex w-full items-center gap-2.5 rounded-sm border px-[9px] py-2 text-left transition-colors',
                      active
                        ? 'border-border-strong bg-elev-3'
                        : 'border-transparent bg-transparent hover:bg-elev-3',
                    )}
                  >
                    <Ident seed={c.address} size={26} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-[5px] overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-medium text-fg">
                        {c.name}
                        {c.proxy && (
                          <span
                            className="text-[11px] text-read-fg"
                            title="Proxy"
                          >
                            ⃝
                          </span>
                        )}
                      </div>
                      <div className="mt-px font-mono text-[11.5px] text-fg-3">
                        {trunc(c.address, 5)}
                      </div>
                    </div>
                    {c.proxy && (
                      <span className="rounded-[4px] border border-read-border bg-read-bg px-[5px] py-px font-mono text-[10px] text-read-fg">
                        proxy
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>

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
