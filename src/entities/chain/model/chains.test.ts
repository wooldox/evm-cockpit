import { describe, it, expect } from 'vitest';
import {
  CHAIN_LIST,
  CURATED_VIEM_CHAINS,
  SUPPORTED_VIEM_CHAINS,
  getChainDisplay,
} from './chains';

const CURATED_ORDER = [1, 8453, 42161, 10, 137, 11155111, 31337];

describe('chain display', () => {
  it('includes core chains with id/name/short/color', () => {
    const eth = getChainDisplay(1);
    expect(eth.name).toMatch(/ethereum/i);
    expect(eth.short.length).toBeGreaterThan(0);
    expect(eth.color).toMatch(/^#/);
  });
  it('CHAIN_LIST is non-empty and unique by id', () => {
    expect(CHAIN_LIST.length).toBeGreaterThan(3);
    const ids = CHAIN_LIST.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it('returns a usable fallback for an unknown chain id', () => {
    const x = getChainDisplay(999999);
    expect(x.id).toBe(999999);
    expect(x.name).toBeTruthy();
    expect(x.color).toMatch(/^#/);
  });
});

describe('SUPPORTED_VIEM_CHAINS (all viem chains)', () => {
  it('includes the full viem chain set', () => {
    expect(SUPPORTED_VIEM_CHAINS.length).toBeGreaterThanOrEqual(600);
  });

  it('leads with the curated chains in declaration order', () => {
    const head = SUPPORTED_VIEM_CHAINS.slice(0, CURATED_ORDER.length).map(
      (c) => c.id,
    );
    expect(head).toEqual(CURATED_ORDER);
  });

  it('has unique ids', () => {
    const ids = SUPPORTED_VIEM_CHAINS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  // Regression: viem's `arc` (5042) ships `rpcUrls.default.http: []`. wagmi
  // builds a transport for EVERY config chain, and viem's http(undefined)
  // throws UrlRequiredError at client creation when the chain carries no
  // default URL to fall back on — an unhandled rejection at app startup.
  // Every chain we hand to wagmi must have a usable default http RPC.
  it('every config chain has a usable default http RPC (transport invariant)', () => {
    const broken = SUPPORTED_VIEM_CHAINS.filter((c) => {
      const url = c.rpcUrls?.default?.http?.[0];
      return typeof url !== 'string' || url === '';
    });
    expect(broken.map((c) => `${c.id} ${c.name}`)).toEqual([]);
  });

  it('excludes viem chains without a default http RPC (e.g. arc/5042)', () => {
    expect(SUPPORTED_VIEM_CHAINS.find((c) => c.id === 5042)).toBeUndefined();
  });

  it('preserves the curated Localhost · Anvil 31337 multicall3 override', () => {
    const anvil = SUPPORTED_VIEM_CHAINS.find((c) => c.id === 31337);
    expect(anvil).toBeDefined();
    expect(anvil!.name).toBe('Localhost · Anvil');
    expect(anvil!.contracts?.multicall3?.address).toBe(
      '0xca11bde05977b3631167028862be2a173976ca11',
    );
  });

  it("keeps the curated objects' identity at the head", () => {
    expect(SUPPORTED_VIEM_CHAINS.slice(0, CURATED_VIEM_CHAINS.length)).toEqual(
      CURATED_VIEM_CHAINS,
    );
  });
});
