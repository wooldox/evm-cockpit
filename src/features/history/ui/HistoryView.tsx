'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useHistoryStore } from '@/entities/history/model/store';
import type {
  THistoryEntry,
  THistoryType,
} from '@/entities/history/model/types';
import { useContractsStore } from '@/entities/contract/model/store';
import { useRerunStore } from '@/entities/rerun/model/store';
import { useChainDisplay } from '@/entities/chain/model/catalogStore';
import { txUrl } from '@/entities/chain/model/explorer';
import { trunc } from '@/shared/lib/format';
import {
  Badge,
  Button,
  Empty,
  Muted,
  Panel,
  Segment,
  Select,
} from '@/shared/ui';
import { ExtLink } from '@/shared/ui/copyable';
import { Icon } from '@/shared/icons';

type TypeFilter = 'all' | THistoryType;

const TYPE_FILTER_OPTIONS: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'read', label: 'Reads' },
  { value: 'write', label: 'Writes' },
  { value: 'simulate', label: 'Sims' },
];

const TYPE_BADGE: Record<
  THistoryType,
  { variant: 'read' | 'neutral' | 'write'; label: string }
> = {
  read: { variant: 'read', label: 'read' },
  simulate: { variant: 'neutral', label: 'simulate' },
  write: { variant: 'write', label: 'write' },
};

/* ── HistoryRow ─────────────────────────────────────────── */
function HistoryRow({
  entry,
  contractName,
  contractExists,
  onRerun,
}: {
  entry: THistoryEntry;
  contractName: string;
  contractExists: boolean;
  onRerun: (entry: THistoryEntry) => void;
}) {
  const badge = TYPE_BADGE[entry.type];
  const chainName = useChainDisplay(entry.chainId).name;
  const link = entry.txHash ? txUrl(entry.chainId, entry.txHash) : undefined;

  return (
    <tr className="[&:hover_td]:bg-elev-3">
      <td className="border-b border-border px-3 py-[9px] align-top">
        <Badge variant={badge.variant} size="sm">
          {badge.label}
        </Badge>
      </td>
      <td className="border-b border-border px-3 py-[9px] align-top font-mono text-fg-2">
        {entry.fnName}()
      </td>
      <td className="border-b border-border px-3 py-[9px] align-top text-fg-2">
        <span>{contractName}</span>
        <Muted className="ml-1.5 text-[11px]">{chainName}</Muted>
      </td>
      <td className="border-b border-border px-3 py-[9px] align-top">
        {entry.status === 'ok' ? (
          <span className="text-success-fg">✓ ok</span>
        ) : (
          <span className="text-danger-fg" title={entry.error}>
            error{entry.error ? ` · ${trunc(entry.error, 16)}` : ''}
          </span>
        )}
      </td>
      <td className="border-b border-border px-3 py-[9px] align-top">
        {entry.result && (
          <Muted className="font-mono text-[12px]">
            {trunc(entry.result, 18)}
          </Muted>
        )}
        {entry.txHash && (
          <span className="inline-flex items-center gap-[7px]">
            <span className="font-mono text-[12px] text-fg-2">
              {trunc(entry.txHash, 6)}
            </span>
            {link && <ExtLink href={link} size={12} />}
          </span>
        )}
      </td>
      <td className="border-b border-border px-3 py-[9px] align-top whitespace-nowrap">
        <Muted className="text-[11px]">
          {new Date(entry.timestamp).toLocaleString()}
        </Muted>
      </td>
      <td className="border-b border-border px-3 py-[9px] align-top">
        <Button
          variant="ghost"
          size="sm"
          icon={<Icon.refresh size={13} />}
          onClick={() => onRerun(entry)}
          disabled={!contractExists}
          title={contractExists ? undefined : 'contract no longer saved'}
        >
          Re-run
        </Button>
      </td>
    </tr>
  );
}

/* ── HistoryView ────────────────────────────────────────── */
export function HistoryView({
  initialContractId,
}: {
  initialContractId?: string;
} = {}) {
  const router = useRouter();
  const entries = useHistoryStore((s) => s.entries);
  const clear = useHistoryStore((s) => s.clear);
  const contracts = useContractsStore((s) => s.contracts);

  // Preselect the deep-linked contract when it still exists in the store;
  // otherwise fall back to "all". Initializer-only — no effects.
  const [sel, setSel] = useState<string>(() =>
    initialContractId &&
    useContractsStore
      .getState()
      .contracts.some((c) => c.id === initialContractId)
      ? initialContractId
      : 'all',
  );
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');

  const filtered = entries.filter(
    (e) =>
      (sel === 'all' || e.contractId === sel) &&
      (typeFilter === 'all' || e.type === typeFilter),
  );

  const nameById = new Map(contracts.map((c) => [c.id, c.name]));
  const contractName = (id: string) => nameById.get(id) ?? trunc(id, 6);
  const contractIds = new Set(contracts.map((c) => c.id));

  function handleClear(): void {
    if (window.confirm('Clear all history?')) clear();
  }

  /**
   * Re-run NEVER auto-executes: it only stores the intent and navigates to the
   * browser, which re-opens the originating card prefilled. The user must
   * re-simulate and (for writes) sign manually.
   */
  function handleRerun(e: THistoryEntry): void {
    useRerunStore.getState().request({
      contractId: e.contractId,
      fnName: e.fnName,
      argCount: Object.keys(e.args).length,
      args: e.args,
      type: e.type,
    });
    router.push(`/?c=${e.contractId}`);
  }

  return (
    <div className="mx-auto w-full max-w-[1080px] px-7 pb-16 pt-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2.5">
          <h1 className="m-0 text-[22px] font-semibold tracking-[-0.02em]">
            History
          </h1>
          <Muted className="text-[13px]">
            {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
          </Muted>
        </div>
        <div className="flex items-center gap-2">
          <Segment
            value={typeFilter}
            onChange={setTypeFilter}
            options={TYPE_FILTER_OPTIONS}
          />
          <Select
            wrapClassName="w-[200px]"
            value={sel}
            onChange={(e) => setSel(e.target.value)}
            aria-label="Filter by contract"
          >
            <option value="all">All contracts</option>
            {contracts.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Button
            variant="ghost"
            size="sm"
            icon={<Icon.trash size={15} />}
            onClick={handleClear}
            disabled={entries.length === 0}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="mt-5">
        {filtered.length === 0 ? (
          <Panel className="p-0">
            <Empty icon={<Icon.history size={26} />} title="No history yet">
              Reads, simulations, and transactions you run will appear here.
            </Empty>
          </Panel>
        ) : (
          <div className="overflow-auto rounded-sm border border-border">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr>
                  {[
                    'Type',
                    'Function',
                    'Contract',
                    'Status',
                    'Result',
                    'Time',
                    '',
                  ].map((h, i) => (
                    <th
                      key={h || `col-${i}`}
                      className="sticky top-0 whitespace-nowrap border-b border-border bg-elev-1 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.04em] text-fg-3"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <HistoryRow
                    key={entry.id}
                    entry={entry}
                    contractName={contractName(entry.contractId)}
                    contractExists={contractIds.has(entry.contractId)}
                    onRerun={handleRerun}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
