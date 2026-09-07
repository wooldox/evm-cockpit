import { describe, it, expect, afterEach } from 'vitest';
import { createViemRpc } from './viem-rpc';
import { useChainCatalog } from '@/entities/chain/model/catalogStore';
import type { TCatalogChain } from '@/entities/chain/model/catalog';
import { DEFAULT_RPC_URLS } from '@/entities/chain/model/chains';
import type { PublicClient } from 'viem';

/** Ordered URLs behind a client's transport (a fallback list, or the single
 *  http URL when only one endpoint is known). */
function urlsOf(client: PublicClient): (string | undefined)[] {
  const t = client.transport as {
    url?: string;
    transports?: { value?: { url?: string } }[];
  };
  return t.transports ? t.transports.map((s) => s.value?.url) : [t.url];
}

describe('viem rpc adapter', () => {
  it('returns a public client for a known chain', () => {
    const rpc = createViemRpc(() => ({}));
    const client = rpc.getClient(1);
    expect(client.chain?.id).toBe(1);
    // Curated list first when no override is present; the catalog's own RPCs
    // follow it as extra fallbacks.
    expect(urlsOf(client).slice(0, DEFAULT_RPC_URLS[1]!.length)).toEqual([
      ...DEFAULT_RPC_URLS[1]!,
    ]);
  });
  it('uses the override URL when present', () => {
    const rpc = createViemRpc(() => ({ 1: 'https://my.rpc' }));
    // An explicit endpoint is used alone — never silently traded for a public one.
    expect(urlsOf(rpc.getClient(1))).toEqual(['https://my.rpc']);
  });
  it('ignores an empty/whitespace override and uses the curated default', () => {
    // Behavior fix: the old inline `?? DEFAULT_RPC_URLS` would keep an empty
    // string (not nullish) and feed http("") a broken URL. resolveRpcUrls now
    // treats empty/whitespace overrides as absent.
    const rpc = createViemRpc(() => ({ 1: '   ' }));
    expect(urlsOf(rpc.getClient(1))[0]).toBe(DEFAULT_RPC_URLS[1]![0]);
  });
  it('memoizes the client for the same chain+url', () => {
    const rpc = createViemRpc(() => ({}));
    expect(rpc.getClient(1)).toBe(rpc.getClient(1));
  });
  it('throws a clear error for a chain not in viem or the catalog', () => {
    const rpc = createViemRpc(() => ({}));
    expect(() => rpc.getClient(123456789)).toThrow(/unknown chain 123456789/i);
  });
  // Note: simulating a chain in SUPPORTED_VIEM_CHAINS but absent from DEFAULT_RPC_URLS
  // would require patching the module-level CHAIN_MAP, which is not straightforward without
  // mocking. The fallback to viem's chain default (http(undefined)) is covered by the
  // implementation path but not exercised here.
});

describe('viem rpc adapter — catalog-only chains', () => {
  const CATALOG_ONLY_ID = 987654;

  function seedCatalog(entry: Partial<TCatalogChain>): void {
    const full: TCatalogChain = {
      id: CATALOG_ONLY_ID,
      name: 'Exotic Chain',
      short: 'EXO',
      color: '#abcdef',
      rpcUrls: ['https://exotic.example/rpc'],
      nativeSymbol: 'EXO',
      source: 'remote',
      ...entry,
    };
    const byId = new Map(useChainCatalog.getState().byId);
    byId.set(full.id, full);
    useChainCatalog.setState({ byId });
  }

  afterEach(() => {
    const byId = new Map(useChainCatalog.getState().byId);
    byId.delete(CATALOG_ONLY_ID);
    useChainCatalog.setState({ byId });
  });

  it("synthesizes a client from the catalog entry's first RPC", () => {
    seedCatalog({});
    const rpc = createViemRpc(() => ({}));
    const client = rpc.getClient(CATALOG_ONLY_ID);
    expect(client.chain?.id).toBe(CATALOG_ONLY_ID);
    expect(client.chain?.name).toBe('Exotic Chain');
    expect(urlsOf(client)).toEqual(['https://exotic.example/rpc']);
  });

  it("keeps the entry's RPC order as the fallback order", () => {
    seedCatalog({ rpcUrls: ['https://one.example', 'https://two.example'] });
    const rpc = createViemRpc(() => ({}));
    expect(urlsOf(rpc.getClient(CATALOG_ONLY_ID))).toEqual([
      'https://one.example',
      'https://two.example',
    ]);
  });

  it('honors a settings override for a catalog-only chain', () => {
    seedCatalog({});
    const rpc = createViemRpc(() => ({ [CATALOG_ONLY_ID]: 'https://my.rpc' }));
    expect(urlsOf(rpc.getClient(CATALOG_ONLY_ID))).toEqual(['https://my.rpc']);
  });

  it('throws when a catalog-only chain has no RPC and no override', () => {
    seedCatalog({ rpcUrls: [] });
    const rpc = createViemRpc(() => ({}));
    expect(() => rpc.getClient(CATALOG_ONLY_ID)).toThrow(
      /no RPC known for chain 987654/i,
    );
  });

  it('memoizes the synthesized client by url', () => {
    seedCatalog({});
    const rpc = createViemRpc(() => ({}));
    expect(rpc.getClient(CATALOG_ONLY_ID)).toBe(rpc.getClient(CATALOG_ONLY_ID));
  });
});
