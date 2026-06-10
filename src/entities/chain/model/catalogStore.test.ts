import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useChainCatalog,
  catalogDisplay,
  useChainDisplay,
  CHAINS_ENDPOINT,
} from './catalogStore';
import { type TCatalogChain } from './catalog';
import { CURATED_VIEM_CHAINS } from './chains';
import { resetCatalog as resetStore } from './testing/resetCatalog';

const REMOTE_ITEM = {
  name: 'Zeta Chain',
  chain: 'ZETA',
  chainId: 700700,
  rpc: ['https://zeta.example'],
  explorers: [{ url: 'https://zetascan.example' }],
  nativeCurrency: { name: 'Zeta', symbol: 'ZET', decimals: 18 },
};

describe('useChainCatalog', () => {
  beforeEach(resetStore);

  it('exposes the chainid.network endpoint constant', () => {
    expect(CHAINS_ENDPOINT).toBe('https://chainid.network/chains.json');
  });

  it('initializes to static with entries ready and a working byId', () => {
    const s = useChainCatalog.getState();
    expect(s.status).toBe('static');
    expect(s.entries.length).toBeGreaterThanOrEqual(600);
    expect(s.byId.get(1)?.short).toBe('ETH');
  });

  it('loadRemote success → extended + new id resolvable', async () => {
    const fetchJson = vi.fn(async () => [REMOTE_ITEM]);
    await useChainCatalog.getState().loadRemote({ fetchJson });
    expect(useChainCatalog.getState().status).toBe('extended');
    expect(catalogDisplay(700700).name).toBe('Zeta Chain');
    expect(useChainCatalog.getState().byId.get(700700)?.source).toBe('remote');
  });

  it('loadRemote failure (fetchJson rejects) → static-fallback, entries unchanged', async () => {
    const before = useChainCatalog.getState().entries;
    const fetchJson = vi.fn(async () => {
      throw new Error('network');
    });
    await useChainCatalog.getState().loadRemote({ fetchJson });
    expect(useChainCatalog.getState().status).toBe('static-fallback');
    expect(useChainCatalog.getState().entries).toBe(before);
  });

  it('loadRemote with a non-ok-style throw → static-fallback', async () => {
    const fetchJson = vi.fn(async () => {
      throw new Error('HTTP 500');
    });
    await useChainCatalog.getState().loadRemote({ fetchJson });
    expect(useChainCatalog.getState().status).toBe('static-fallback');
  });

  it('double loadRemote calls fetchJson once', async () => {
    const fetchJson = vi.fn(async () => [REMOTE_ITEM]);
    await useChainCatalog.getState().loadRemote({ fetchJson });
    await useChainCatalog.getState().loadRemote({ fetchJson });
    expect(fetchJson).toHaveBeenCalledTimes(1);
  });

  it('loadRemote with non-array json → extended with no remote additions', async () => {
    const fetchJson = vi.fn(async () => ({ not: 'an array' }));
    const before = useChainCatalog.getState().entries.length;
    await useChainCatalog.getState().loadRemote({ fetchJson });
    expect(useChainCatalog.getState().status).toBe('extended');
    expect(useChainCatalog.getState().entries.length).toBe(before);
  });

  it('catalogDisplay falls back to getChainDisplay for unknown ids', () => {
    const d = catalogDisplay(99887766);
    expect(d.name).toBe('Chain 99887766');
  });

  it('default fetch path: ok response → extended', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => [REMOTE_ITEM],
    } as Response);
    await useChainCatalog.getState().loadRemote();
    expect(fetchSpy).toHaveBeenCalledWith(CHAINS_ENDPOINT, expect.any(Object));
    expect(useChainCatalog.getState().status).toBe('extended');
    expect(useChainCatalog.getState().byId.get(700700)?.name).toBe(
      'Zeta Chain',
    );
    fetchSpy.mockRestore();
  });

  it('default fetch path: non-ok response → static-fallback', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({}),
    } as Response);
    await useChainCatalog.getState().loadRemote();
    expect(useChainCatalog.getState().status).toBe('static-fallback');
    fetchSpy.mockRestore();
  });
});

describe('custom chains', () => {
  beforeEach(resetStore);

  const CUSTOM: TCatalogChain = {
    id: 999777,
    name: 'Testlandia',
    short: 'TLD',
    color: '#22c55e',
    rpcUrls: ['http://127.0.0.1:9999'],
    nativeSymbol: 'TLD',
    source: 'custom',
  };

  it('addCustomChain adds, indexes, and places after the curated head', () => {
    useChainCatalog.getState().addCustomChain(CUSTOM);
    const s = useChainCatalog.getState();
    expect(s.byId.get(999777)?.name).toBe('Testlandia');
    expect(s.entries[CURATED_VIEM_CHAINS.length]!.id).toBe(999777);
  });

  it('addCustomChain no-ops on a duplicate id (defense in depth)', () => {
    useChainCatalog.getState().addCustomChain(CUSTOM);
    useChainCatalog.getState().addCustomChain({ ...CUSTOM, name: 'Imposter' });
    const s = useChainCatalog.getState();
    expect(s.byId.get(999777)?.name).toBe('Testlandia');
    expect(s.entries.filter((c) => c.id === 999777)).toHaveLength(1);
  });

  it('addCustomChain rejects ids already in the base catalog (e.g. mainnet)', () => {
    useChainCatalog.getState().addCustomChain({ ...CUSTOM, id: 1 });
    expect(useChainCatalog.getState().byId.get(1)?.source).not.toBe('custom');
  });

  it('custom entries survive a remote merge and win id collisions', async () => {
    useChainCatalog.getState().addCustomChain(CUSTOM);
    const remote = [
      {
        chainId: 999777, // collides with the custom entry
        name: 'Remote Testlandia',
        rpc: ['https://rpc.remote.xyz'],
        explorers: [{ url: 'https://scan.remote.xyz' }],
        nativeCurrency: { symbol: 'RTL' },
      },
    ];
    await useChainCatalog
      .getState()
      .loadRemote({ fetchJson: async () => remote });
    const s = useChainCatalog.getState();
    expect(s.status).toBe('extended');
    expect(s.byId.get(999777)?.name).toBe('Testlandia'); // custom won
  });

  it('catalogDisplay resolves a custom chain', () => {
    useChainCatalog.getState().addCustomChain(CUSTOM);
    expect(catalogDisplay(999777)).toEqual({
      id: 999777,
      name: 'Testlandia',
      short: 'TLD',
      color: '#22c55e',
    });
  });

  it('persists ONLY the custom array (partialize)', () => {
    useChainCatalog.getState().addCustomChain(CUSTOM);
    const opts = useChainCatalog.persist.getOptions();
    const partial = opts.partialize!(useChainCatalog.getState()) as {
      custom: TCatalogChain[];
    };
    expect(Object.keys(partial)).toEqual(['custom']);
    expect(partial.custom).toEqual([CUSTOM]);
  });

  it('rehydrate re-derives entries from a persisted custom array (merge)', async () => {
    // Reset first and let its fire-and-forget persist write flush, THEN seed the
    // persisted record directly so rehydrate reads our value (not a later write).
    resetStore();
    await Promise.resolve();
    const opts = useChainCatalog.persist.getOptions();
    await opts.storage!.setItem('cc-chains', {
      state: { custom: [CUSTOM] },
      version: 0,
    });
    expect(useChainCatalog.getState().byId.has(999777)).toBe(false);
    await useChainCatalog.persist.rehydrate();
    const s = useChainCatalog.getState();
    expect(s.byId.get(999777)?.name).toBe('Testlandia');
    expect(s.entries[CURATED_VIEM_CHAINS.length]!.id).toBe(999777);
  });

  it('rehydrate with no persisted state falls back to an empty custom array', async () => {
    // No prior write for this run's key → merge takes the `?? []` branch.
    await useChainCatalog.persist.clearStorage();
    resetStore();
    await useChainCatalog.persist.rehydrate();
    const s = useChainCatalog.getState();
    expect(s.custom).toEqual([]);
    expect(s.byId.get(1)?.short).toBe('ETH');
  });
});

describe('useChainDisplay', () => {
  beforeEach(resetStore);

  it('returns the curated display for chain 1', () => {
    const { result } = renderHook(() => useChainDisplay(1));
    expect(result.current.short).toBe('ETH');
    expect(result.current.name).toBe('Ethereum');
  });

  it('returns the Chain <id> fallback for an unknown id', () => {
    const { result } = renderHook(() => useChainDisplay(424242));
    expect(result.current.name).toBe('Chain 424242');
    expect(result.current.short).toBe('424242');
  });
});
