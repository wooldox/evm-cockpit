'use client';

import { useState } from 'react';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import type { TContract } from '@/entities/contract/model/types';
import type { RpcProvider } from '@/shared/ports/rpc';
import type { THistoryEntry } from '@/entities/history/model/types';
import { useRerunStore, type TRerunIntent } from '@/entities/rerun/model/store';
import { getBrowserSections } from '@/features/contract-browser/model/effectiveAbi';
import { propertiesQueryKey } from '@/features/contract-browser/model/useProperties';
import { Icon } from '@/shared/icons';
import { Badge, Button, Empty, Input, Spinner } from '@/shared/ui';
import { ContractHeader } from './ContractHeader';
import { PropertiesSection } from './PropertiesSection';
import { GettersSection } from './GettersSection';
import { OperationsSection } from './OperationsSection';
import { EventsSection } from './EventsSection';
import { ValueContextProvider } from './valueContext';

/**
 * Test seam (flat). Forwarded as-is to OperationsSection; EventsSection only
 * needs `{ rpc }`, which this superset satisfies, so the same flat object drives
 * both sections and existing callers stay source-compatible.
 */
type BrowserDeps = {
  rpc: RpcProvider;
  addHistory: (e: Omit<THistoryEntry, 'id' | 'timestamp'>) => void;
};

/* ── NoFunctionMatch ─────────────────────────────────────── */
function NoFunctionMatch({ q }: { q: string }) {
  return (
    <Empty
      icon={<Icon.search size={24} />}
      title={`No functions match "${q}"`}
    />
  );
}

/* ── ContractBrowser ─────────────────────────────────────── */
export function ContractBrowser({
  contract,
  onRemoved,
  deps,
}: {
  contract: TContract;
  onRemoved: () => void;
  deps?: BrowserDeps;
}) {
  const [q, setQ] = useState('');
  const ql = q.toLowerCase();

  // Consume a re-run intent once per mount (lazy initializer — no effect).
  // Peek first: only consume when the intent targets THIS contract, so a
  // non-matching intent stays in the store and still fires when the user
  // navigates to the right contract. Relies on `key={contract.id}` in the route
  // so a second re-run to a different contract remounts and consumes.
  const [rerun] = useState<TRerunIntent | null>(() => {
    const i = useRerunStore.getState().intent;
    if (i && i.contractId === contract.id) {
      useRerunStore.getState().consume();
      return i;
    }
    return null;
  });

  const sections = getBrowserSections(contract);

  // Lives in the sticky toolbar (not the Properties section head) so it stays
  // reachable while scrolled down to Operations / Events.
  const queryClient = useQueryClient();
  const propsKey = propertiesQueryKey(contract.id);
  const refreshing = useIsFetching({ queryKey: propsKey }) > 0;

  const noMatch =
    q &&
    ![
      ...sections.properties,
      ...sections.getters,
      ...sections.operations,
      ...sections.events,
    ].some((x) => x.name.toLowerCase().includes(ql));

  return (
    <ValueContextProvider contract={contract}>
      <div className="flex min-h-0 flex-col">
        <ContractHeader contract={contract} onRemoved={onRemoved} />

        {/* Sticky toolbar */}
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-[color-mix(in_oklab,var(--bg)_88%,transparent)] px-7 py-3.5 backdrop-blur-[8px]">
          <div className="relative flex max-w-[420px] flex-1 items-center">
            <Icon.search
              size={14}
              className="pointer-events-none absolute left-2.5 text-fg-3"
            />
            <Input
              className="pl-[30px]"
              placeholder="Filter functions across all sections…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          <Badge variant="read" size="sm" dot>
            read = free
          </Badge>
          <Badge variant="write" size="sm" dot>
            write = sends tx
          </Badge>
          {sections.properties.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto"
              title="Re-read properties"
              icon={refreshing ? <Spinner /> : <Icon.refresh size={14} />}
              onClick={() => queryClient.refetchQueries({ queryKey: propsKey })}
              disabled={refreshing}
            >
              Refresh
            </Button>
          )}
        </div>

        {/* Body */}
        <div
          data-cc="cb-body"
          className="mx-auto flex w-full max-w-[1080px] flex-col gap-7 px-7 pb-16 pt-5"
        >
          <PropertiesSection contract={contract} q={ql} />
          <GettersSection contract={contract} q={ql} rerun={rerun} />

          <OperationsSection
            contract={contract}
            q={ql}
            deps={deps}
            rerun={rerun}
          />

          <EventsSection
            contract={contract}
            q={ql}
            deps={deps ? { rpc: deps.rpc } : undefined}
          />

          {noMatch && <NoFunctionMatch q={q} />}
        </div>
      </div>
    </ValueContextProvider>
  );
}
