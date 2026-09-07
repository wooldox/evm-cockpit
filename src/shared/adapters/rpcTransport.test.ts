import { describe, it, expect } from 'vitest';
import { rpcTransport } from './rpcTransport';

/** A stand-in for the chain viem passes at instantiation time. */
const CHAIN = {
  id: 1,
  name: 'Test',
  nativeCurrency: { name: 'E', symbol: 'E', decimals: 18 },
  rpcUrls: { default: { http: ['https://chain-default.example'] } },
} as unknown as Parameters<ReturnType<typeof rpcTransport>>[0]['chain'];

/** Per-endpoint request timeouts, in fallback order. */
function timeoutsOf(
  t: ReturnType<typeof rpcTransport>,
): (number | undefined)[] {
  const inst = t({ chain: CHAIN }) as {
    config: { timeout?: number };
    value?: { transports?: { config: { timeout?: number } }[] };
  };
  const sub = inst.value?.transports;
  return sub ? sub.map((s) => s.config.timeout) : [inst.config.timeout];
}

/** The instantiated transport's URL (single) or its ordered fallback URLs. */
function urlsOf(t: ReturnType<typeof rpcTransport>): (string | undefined)[] {
  const inst = t({ chain: CHAIN }) as {
    value?: { url?: string; transports?: { value?: { url?: string } }[] };
  };
  const sub = inst.value?.transports;
  return sub ? sub.map((s) => s.value?.url) : [inst.value?.url];
}

describe('rpcTransport', () => {
  it('exposes each URL as its own fallback transport, in list order', () => {
    expect(
      urlsOf(rpcTransport(['https://a.example', 'https://b.example'])),
    ).toEqual(['https://a.example', 'https://b.example']);
  });

  it('uses a plain http transport for a single URL', () => {
    expect(urlsOf(rpcTransport(['https://a.example']))).toEqual([
      'https://a.example',
    ]);
  });

  it('gives every endpoint but the last a short fail-fast timeout', () => {
    const t = timeoutsOf(
      rpcTransport([
        'https://a.example',
        'https://b.example',
        'https://c.example',
      ]),
    );
    expect(t[0]).toBe(5_000);
    expect(t[1]).toBe(5_000);
    // Nowhere left to fail over to — viem's default patience (10s) applies.
    expect(t[2]).toBe(10_000);
  });

  it('leaves a lone endpoint on the default timeout', () => {
    expect(timeoutsOf(rpcTransport(['https://a.example']))).toEqual([10_000]);
  });

  it("falls back to viem's chain default for an empty list", () => {
    expect(urlsOf(rpcTransport([]))).toEqual(['https://chain-default.example']);
  });
});
