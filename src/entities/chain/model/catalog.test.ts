import { describe, it, expect } from 'vitest';
import {
  sanitizeRpcUrls,
  genDisplay,
  buildStaticCatalog,
  mergeCatalog,
  composeCatalog,
  type TCatalogChain,
} from './catalog';
import { CURATED_VIEM_CHAINS } from './chains';

// Curated supported ids in chains.ts order — must lead the sort.
const CURATED_ORDER = [1, 8453, 42161, 10, 137, 11155111, 31337];

describe('sanitizeRpcUrls', () => {
  it('keeps https URLs', () => {
    expect(sanitizeRpcUrls(['https://a.example'])).toEqual([
      'https://a.example',
    ]);
  });

  it('drops wss, http, and API-key template URLs', () => {
    expect(
      sanitizeRpcUrls([
        'wss://ws.example',
        'http://insecure.example',
        'https://rpc.example/${INFURA_API_KEY}',
        'https://keep.example',
      ]),
    ).toEqual(['https://keep.example']);
  });

  it('trims surrounding whitespace', () => {
    expect(sanitizeRpcUrls(['  https://a.example  '])).toEqual([
      'https://a.example',
    ]);
  });

  it('dedupes repeated URLs', () => {
    expect(sanitizeRpcUrls(['https://a.example', 'https://a.example'])).toEqual(
      ['https://a.example'],
    );
  });

  it('caps the result at 3', () => {
    expect(
      sanitizeRpcUrls([
        'https://a.example',
        'https://b.example',
        'https://c.example',
        'https://d.example',
      ]),
    ).toEqual(['https://a.example', 'https://b.example', 'https://c.example']);
  });

  it('returns [] for empty input', () => {
    expect(sanitizeRpcUrls([])).toEqual([]);
  });
});

describe('genDisplay', () => {
  it('uses curated META for chain 1 (ETH/#627eea)', () => {
    expect(genDisplay(1, 'Ethereum', 'ETH')).toEqual({
      short: 'ETH',
      color: '#627eea',
    });
  });

  it('uses the native symbol when 2..6 chars and not curated', () => {
    const d = genDisplay(999999, 'Some Chain', 'xdai');
    expect(d.short).toBe('XDAI');
  });

  it('falls back to name initials when the symbol is too long (>6)', () => {
    const d = genDisplay(999998, 'Foo Bar Baz Qux Quux', 'TOOLONGSYM');
    expect(d.short).toBe('FBBQ');
  });

  it('falls back to name initials when the symbol is too short (<2)', () => {
    const d = genDisplay(999997, 'Hello World', 'X');
    expect(d.short).toBe('HW');
  });

  it('produces a deterministic palette color that is a valid hex', () => {
    const a = genDisplay(123456, 'Chain A', 'AAA');
    const b = genDisplay(123456, 'Chain A', 'AAA');
    expect(a.color).toBe(b.color);
    expect(a.color).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('upcases the symbol', () => {
    expect(genDisplay(888888, 'Lower', 'eth').short).toBe('ETH');
  });
});

describe('buildStaticCatalog', () => {
  const catalog = buildStaticCatalog();

  it('includes a large number of chains (>= 600)', () => {
    expect(catalog.length).toBeGreaterThanOrEqual(600);
  });

  it('has unique ids', () => {
    const ids = catalog.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('resolves chain 1 short to ETH', () => {
    const eth = catalog.find((c) => c.id === 1);
    expect(eth?.short).toBe('ETH');
  });

  it('keeps the curated 31337 name override and LOC short', () => {
    const local = catalog.find((c) => c.id === 31337);
    expect(local?.name).toBe('Localhost · Anvil');
    expect(local?.short).toBe('LOC');
  });

  it('leads the sort with the curated ids in chains.ts order', () => {
    const firstIds = catalog.slice(0, CURATED_ORDER.length).map((c) => c.id);
    expect(firstIds).toEqual(CURATED_ORDER);
  });

  it('sorts the non-curated tail alphabetically by name', () => {
    const tail = catalog.slice(CURATED_ORDER.length);
    const names = tail.map((c) => c.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
  });

  it('strips a trailing slash off explorer URLs', () => {
    for (const c of catalog) {
      if (c.explorerUrl) expect(c.explorerUrl.endsWith('/')).toBe(false);
    }
  });

  it('marks every entry source viem', () => {
    expect(catalog.every((c) => c.source === 'viem')).toBe(true);
  });
});

describe('mergeCatalog', () => {
  const base: TCatalogChain[] = [
    {
      id: 1,
      name: 'Ethereum',
      short: 'ETH',
      color: '#627eea',
      rpcUrls: ['https://eth.example'],
      nativeSymbol: 'ETH',
      source: 'viem',
    },
  ];

  const validRemote = {
    name: 'Zeta Chain',
    chain: 'ZETA',
    chainId: 700700,
    rpc: ['https://zeta.example/', 'wss://zeta.ws'],
    explorers: [{ url: 'https://zetascan.example/' }],
    nativeCurrency: { name: 'Zeta', symbol: 'ZET', decimals: 18 },
  };

  it('adds a valid remote chain mapped correctly', () => {
    const out = mergeCatalog(base, [validRemote]);
    const z = out.find((c) => c.id === 700700);
    expect(z).toBeDefined();
    expect(z?.source).toBe('remote');
    expect(z?.name).toBe('Zeta Chain');
    expect(z?.nativeSymbol).toBe('ZET');
    expect(z?.short).toBe('ZET');
    expect(z?.rpcUrls).toEqual(['https://zeta.example/']);
    expect(z?.explorerUrl).toBe('https://zetascan.example');
  });

  it('skips ids already present in base', () => {
    const collide = { ...validRemote, chainId: 1 };
    const out = mergeCatalog(base, [collide]);
    expect(out.filter((c) => c.id === 1)).toHaveLength(1);
    expect(out.find((c) => c.id === 1)?.source).toBe('viem');
  });

  it('skips malformed entries silently (missing rpc)', () => {
    const bad = { ...validRemote, chainId: 111111, rpc: undefined };
    const out = mergeCatalog(base, [bad]);
    expect(out.find((c) => c.id === 111111)).toBeUndefined();
  });

  it('skips entries with empty explorers', () => {
    const bad = { ...validRemote, chainId: 111112, explorers: [] };
    const out = mergeCatalog(base, [bad]);
    expect(out.find((c) => c.id === 111112)).toBeUndefined();
  });

  it('skips entries with a non-numeric chainId', () => {
    const bad = { ...validRemote, chainId: '700701' };
    const out = mergeCatalog(base, [bad]);
    expect(out).toHaveLength(base.length);
  });

  it('skips entries whose rpc sanitizes to empty', () => {
    const bad = {
      ...validRemote,
      chainId: 111113,
      rpc: ['http://insecure.example', 'wss://ws.example'],
    };
    const out = mergeCatalog(base, [bad]);
    expect(out.find((c) => c.id === 111113)).toBeUndefined();
  });

  it('skips entries with a missing native symbol', () => {
    const bad = {
      ...validRemote,
      chainId: 111114,
      nativeCurrency: { name: 'X', decimals: 18 },
    };
    const out = mergeCatalog(base, [bad]);
    expect(out.find((c) => c.id === 111114)).toBeUndefined();
  });

  it('skips entries with an empty name', () => {
    const bad = { ...validRemote, chainId: 111115, name: '' };
    const out = mergeCatalog(base, [bad]);
    expect(out.find((c) => c.id === 111115)).toBeUndefined();
  });

  it('skips non-object remote items', () => {
    const out = mergeCatalog(base, [null, 42, 'x']);
    expect(out).toHaveLength(base.length);
  });

  it('appends remote chains alphabetically by name after base', () => {
    const a = { ...validRemote, chainId: 200001, name: 'Alpha Net' };
    const z = { ...validRemote, chainId: 200002, name: 'Zulu Net' };
    const out = mergeCatalog(base, [z, a]);
    const remoteNames = out
      .filter((c) => c.source === 'remote')
      .map((c) => c.name);
    expect(remoteNames).toEqual(['Alpha Net', 'Zulu Net']);
    // base stays first
    expect(out[0]?.id).toBe(1);
  });

  it('applies the testnet heuristic on the name', () => {
    const t = { ...validRemote, chainId: 300001, name: 'Foo Sepolia' };
    const m = { ...validRemote, chainId: 300002, name: 'Foo Mainnet' };
    const out = mergeCatalog(base, [t, m]);
    expect(out.find((c) => c.id === 300001)?.testnet).toBe(true);
    expect(out.find((c) => c.id === 300002)?.testnet).toBeUndefined();
  });

  it('skips entries whose explorer url is not a string', () => {
    const bad = {
      ...validRemote,
      chainId: 111116,
      explorers: [{ url: 123 }],
    };
    const out = mergeCatalog(base, [bad]);
    expect(out.find((c) => c.id === 111116)).toBeUndefined();
  });

  it('skips entries with a non-integer chainId', () => {
    const bad = { ...validRemote, chainId: 1.5 };
    const out = mergeCatalog(base, [bad]);
    expect(out).toHaveLength(base.length);
  });

  it('skips entries with a non-positive chainId', () => {
    const bad = { ...validRemote, chainId: 0 };
    const out = mergeCatalog(base, [bad]);
    expect(out).toHaveLength(base.length);
  });

  it('skips entries with a non-string rpc element', () => {
    const bad = { ...validRemote, chainId: 111117, rpc: [123] };
    const out = mergeCatalog(base, [bad]);
    expect(out.find((c) => c.id === 111117)).toBeUndefined();
  });

  it('skips entries whose first explorer is not an object', () => {
    const bad = { ...validRemote, chainId: 111118, explorers: ['notanobject'] };
    const out = mergeCatalog(base, [bad]);
    expect(out.find((c) => c.id === 111118)).toBeUndefined();
  });

  it('skips entries whose nativeCurrency is not an object', () => {
    const bad = { ...validRemote, chainId: 111119, nativeCurrency: 'ETH' };
    const out = mergeCatalog(base, [bad]);
    expect(out.find((c) => c.id === 111119)).toBeUndefined();
  });

  it('treats non-array remote input gracefully via [] (no additions)', () => {
    const out = mergeCatalog(base, []);
    expect(out).toEqual(base);
  });
});

describe('composeCatalog', () => {
  const mk = (
    id: number,
    name: string,
    source: TCatalogChain['source'] = 'viem',
  ): TCatalogChain => ({
    id,
    name,
    short: name.slice(0, 3).toUpperCase(),
    color: '#6b7682',
    rpcUrls: [`https://rpc.${id}.xyz`],
    nativeSymbol: 'ETH',
    source,
  });

  it('returns base unchanged when there are no custom entries', () => {
    const base = buildStaticCatalog();
    expect(composeCatalog(base, [])).toBe(base);
  });

  it('inserts custom entries right after the curated head', () => {
    const base = buildStaticCatalog();
    const custom = [mk(999001, 'My Net', 'custom')];
    const out = composeCatalog(base, custom);
    // curated head intact …
    expect(out.slice(0, CURATED_VIEM_CHAINS.length).map((c) => c.id)).toEqual(
      CURATED_VIEM_CHAINS.map((c) => c.id),
    );
    // … custom immediately after …
    expect(out[CURATED_VIEM_CHAINS.length]!.id).toBe(999001);
    // … and nothing lost
    expect(out.length).toBe(base.length + 1);
  });

  it('custom wins on id collision with a base entry', () => {
    const base = [...buildStaticCatalog(), mk(999002, 'Remote Net', 'remote')];
    const custom = [mk(999002, 'Mine', 'custom')];
    const out = composeCatalog(base, custom);
    const hits = out.filter((c) => c.id === 999002);
    expect(hits).toHaveLength(1);
    expect(hits[0]!.name).toBe('Mine');
    expect(hits[0]!.source).toBe('custom');
  });
});
