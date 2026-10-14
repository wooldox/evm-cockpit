'use client';

import type { TContract } from '@/entities/contract/model/types';
import { getBrowserSections } from '@/features/contract-browser/model/effectiveAbi';
import { useProperties } from '@/features/contract-browser/model/useProperties';
import { Icon } from '@/shared/icons';
import { cx } from '@/shared/lib/cx';
import { Badge, ErrorBanner, Muted, Panel, Skeleton } from '@/shared/ui';
import { TypedValue } from './values';

/* ── Rail + SectionHead (local to this file; also used in GettersSection/ContractBrowser) ── */
function Rail({ tone }: { tone: 'read' | 'write' }) {
  return (
    <span
      className={cx(
        'h-[15px] w-[3px] rounded-[2px]',
        tone === 'read' ? 'bg-read' : 'bg-write',
      )}
    />
  );
}

export function SectionHead({
  tone,
  title,
  count,
  note,
  action,
}: {
  tone: 'read' | 'write';
  title: string;
  count: number;
  note?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-[11px] flex items-center justify-between gap-3">
      <div className="flex items-center gap-[9px]">
        <Rail tone={tone} />
        <h2 className="text-[15px] font-semibold tracking-[-0.01em]">
          {title}
        </h2>
        <Badge size="sm" variant={tone}>
          {count}
        </Badge>
        {note && <Muted className="ml-1 text-xs">{note}</Muted>}
      </div>
      {action}
    </div>
  );
}

/* ── PropRow ────────────────────────────────────────────── */
function PropRow({
  name,
  outType,
  value,
  status,
  error,
  isLoading,
  last,
}: {
  name: string;
  outType: string;
  value: unknown;
  status: 'ok' | 'error' | undefined;
  error: string | undefined;
  isLoading: boolean;
  last: boolean;
  chainId: number;
}) {
  const border = last ? '' : 'border-b border-border';
  return (
    <div className="group contents">
      <div
        data-cc="kv-cell"
        className={cx(
          'flex min-w-0 items-center gap-2 px-3.5 py-[9px] font-mono text-[13px] text-fg-2 group-hover:bg-elev-3',
          border,
        )}
      >
        {name}
        <Muted className="text-[11px]">{outType}</Muted>
      </div>
      <div
        data-cc="kv-cell"
        className={cx(
          'flex min-w-0 items-center gap-2 px-3.5 py-[9px] group-hover:bg-elev-3',
          border,
        )}
      >
        {isLoading ? (
          <Skeleton width={120 + ((name.length * 6) % 140)} />
        ) : status === 'ok' ? (
          <TypedValue type={outType} value={value} />
        ) : status === 'error' ? (
          <span className="font-mono text-[12px] text-danger-fg">{error}</span>
        ) : null}
      </div>
    </div>
  );
}

/* ── PropertiesSection ─────────────────────────────────── */
export function PropertiesSection({
  contract,
  q,
}: {
  contract: TContract;
  q: string;
}) {
  const { rows, isLoading, isError, error, refetch } = useProperties(contract);

  // sections is also computed inside useProperties; reuse it here for skeleton source
  const sections = getBrowserSections(contract);

  // Return null when no properties at all (post-load only)
  if (!isLoading && rows.length === 0) return null;

  const filtered = rows.filter(
    (r) => !q || r.fn.name.toLowerCase().includes(q),
  );

  // During initial load render one skeleton row per property derived from the ABI
  // so the layout is populated even before multicall resolves.
  const skeletonFns = sections.properties;

  return (
    <section>
      <SectionHead
        tone="read"
        title="Properties"
        count={isLoading ? skeletonFns.length : rows.length}
        note="auto-read · multicall batched"
      />
      {isError && (
        <ErrorBanner
          icon={<Icon.alertCircle size={18} />}
          title="Failed to read properties"
          hint={error?.message}
        >
          <button
            type="button"
            className="mt-1 text-xs underline text-fg-2 cursor-pointer"
            onClick={() => refetch()}
          >
            Retry
          </button>
        </ErrorBanner>
      )}
      {!isError && (
        <Panel>
          <div className="grid grid-cols-[minmax(160px,280px)_1fr]">
            {isLoading
              ? skeletonFns.map((fn, i) => {
                  const outType = fn.outputs[0]?.type ?? '';
                  return (
                    <PropRow
                      key={`${fn.name}()`}
                      name={fn.name}
                      outType={outType}
                      value={undefined}
                      status={undefined}
                      error={undefined}
                      isLoading={true}
                      last={i === skeletonFns.length - 1}
                      chainId={contract.chainId}
                    />
                  );
                })
              : filtered.map((row, i) => {
                  const outType = row.fn.outputs[0]?.type ?? '';
                  return (
                    <PropRow
                      key={`${row.fn.name}()`}
                      name={row.fn.name}
                      outType={outType}
                      value={row.status === 'ok' ? row.value : undefined}
                      status={row.status}
                      error={row.status === 'error' ? row.error : undefined}
                      isLoading={false}
                      last={i === filtered.length - 1}
                      chainId={contract.chainId}
                    />
                  );
                })}
          </div>
        </Panel>
      )}
    </section>
  );
}
