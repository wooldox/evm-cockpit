'use client';

import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { cx } from '@/shared/lib/cx';
import { Icon } from '@/shared/icons';
import { Button, ChainGlyph, Eyebrow, Muted, Spinner } from '@/shared/ui';
import { Input } from '@/shared/ui/field';
import { ChainCombobox } from '@/shared/ui/chain-combobox';
import { useSettingsStore } from '@/entities/settings/model/store';
import { useChainCatalog } from '@/entities/chain/model/catalogStore';
import { getChainDisplay } from '@/entities/chain/model/chains';
import { testRpc, type RpcTestResult } from '../model/testRpc';

// Lenient on purpose: custom RPCs are often local/private nodes
// (http://127.0.0.1:8545), so allow any http(s) URL — same rule as add-chain.
const URL_RE = /^https?:\/\/.+/i;

type TestState = { state: 'testing' } | ({ state: 'done' } & RpcTestResult);

type Deps = { testRpcFn?: typeof testRpc };

/**
 * Manage custom RPC overrides for ANY chain (not just the selected one). The
 * store keys overrides by chainId, so there is inherently one RPC per chain;
 * the form blocks adding a second for a chain that already has one. Each row
 * can be live-tested (real eth_blockNumber) and removed.
 */
export function CustomRpcManager({
  currentChainId,
  deps,
}: {
  currentChainId: number;
  deps?: Deps;
}) {
  const runTestRpc = deps?.testRpcFn ?? testRpc;
  const { rpcOverrides, setRpcOverride, clearRpcOverride } = useSettingsStore(
    useShallow((s) => ({
      rpcOverrides: s.rpcOverrides,
      setRpcOverride: s.setRpcOverride,
      clearRpcOverride: s.clearRpcOverride,
    })),
  );
  const entries = useChainCatalog((s) => s.entries);

  const [url, setUrl] = useState('');
  const [chainId, setChainId] = useState<number>(currentChainId);
  const [tests, setTests] = useState<Record<number, TestState>>({});

  const display = (id: number) =>
    entries.find((c) => c.id === id) ?? getChainDisplay(id);

  const rows = Object.entries(rpcOverrides)
    .map(([id, rpcUrl]) => ({ chainId: Number(id), url: rpcUrl }))
    .filter((r) => r.url.trim() !== '')
    .sort((a, b) =>
      display(a.chainId).name.localeCompare(display(b.chainId).name),
    );

  const exists = (rpcOverrides[chainId] ?? '').trim() !== '';
  const urlValid = URL_RE.test(url.trim());
  const canAdd = urlValid && !exists;

  function onAdd(): void {
    if (!canAdd) return;
    setRpcOverride(chainId, url.trim());
    setUrl('');
  }

  async function runTest(r: { chainId: number; url: string }): Promise<void> {
    setTests((t) => ({ ...t, [r.chainId]: { state: 'testing' } }));
    const res = await runTestRpc(r.url);
    setTests((t) => ({ ...t, [r.chainId]: { state: 'done', ...res } }));
  }

  const selName = display(chainId).name;

  return (
    <div>
      <Eyebrow className="mb-2 block">Custom RPCs</Eyebrow>

      <div className="flex items-end gap-2">
        <Input
          mono
          aria-label="Custom RPC URL"
          className="min-w-0 flex-1"
          placeholder="https://your-rpc.example.com"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onAdd();
          }}
        />
        <div className="w-[172px] flex-none">
          <ChainCombobox
            value={chainId}
            onChange={setChainId}
            entries={entries}
            aria-label="Chain for custom RPC"
          />
        </div>
        <Button
          variant="read"
          fill="soft"
          // Match the 34px height of the URL input + chain combobox in this row.
          className="h-[34px]"
          icon={<Icon.plus size={15} />}
          onClick={onAdd}
          disabled={!canAdd}
        >
          Add
        </Button>
      </div>

      {exists ? (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-write-fg">
          <Icon.alertCircle size={13} className="flex-none" />
          You already have an RPC for {selName}. Remove it first to add a new
          one.
        </div>
      ) : url && !urlValid ? (
        <div className="mt-2 flex items-center gap-1.5 text-xs text-fg-3">
          <Icon.info size={13} className="flex-none" /> Enter a valid http(s)
          URL.
        </div>
      ) : (
        <Muted className="mt-1.5 block text-xs">
          Applies to reads immediately; wallet actions may need a reload.
        </Muted>
      )}

      {rows.length === 0 ? (
        <div className="mt-3 rounded-sm border border-dashed border-border-strong px-3.5 py-3.5 text-center text-xs text-fg-4">
          No custom RPCs yet — add one above to override a chain&rsquo;s default
          endpoint.
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-1.5">
          {rows.map((r) => {
            const c = display(r.chainId);
            const t = tests[r.chainId];
            return (
              <div
                key={r.chainId}
                className="flex items-center gap-2.5 rounded-sm border border-border bg-elev-2 py-2 pl-[11px] pr-2 hover:border-border-strong"
              >
                <span className="flex w-[120px] flex-none items-center gap-[7px] text-[13px] font-medium">
                  <ChainGlyph chain={c} size={16} />
                  <span className="min-w-0 truncate">{c.name}</span>
                </span>
                <span
                  className="min-w-0 flex-1 truncate font-mono text-xs text-fg-2"
                  title={r.url}
                >
                  {r.url}
                </span>
                {t && (
                  <span
                    className={cx(
                      'flex flex-none items-center gap-[5px] text-[11px]',
                      t.state === 'testing'
                        ? 'text-fg-3'
                        : t.ok
                          ? 'text-success-fg'
                          : 'text-danger-fg',
                    )}
                  >
                    {t.state === 'testing' ? (
                      <>
                        <Spinner size={12} /> testing…
                      </>
                    ) : t.ok ? (
                      <>
                        <Icon.checkCircle size={13} /> {t.info}
                      </>
                    ) : (
                      <>
                        <Icon.xCircle size={13} /> {t.info}
                      </>
                    )}
                  </span>
                )}
                <Button
                  variant="subtle"
                  size="sm"
                  icon={
                    t?.state === 'testing' ? (
                      <Spinner size={13} />
                    ) : (
                      <Icon.gas size={13} />
                    )
                  }
                  onClick={() => void runTest(r)}
                  disabled={t?.state === 'testing'}
                >
                  Test
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Icon.trash size={14} />}
                  onClick={() => clearRpcOverride(r.chainId)}
                  title={`Remove RPC for ${c.name}`}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
