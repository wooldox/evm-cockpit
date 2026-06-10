import { describe, it, expect, vi, afterEach } from 'vitest';
import { createSourcifyAbiSource } from './sourcify';

const MOCK_ABI = [
  {
    type: 'function',
    name: 'balanceOf',
    inputs: [{ name: 'owner', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
  },
];

const MOCK_METADATA = {
  output: { abi: MOCK_ABI },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('createSourcifyAbiSource', () => {
  it('returns ok+abi when full_match metadata is found', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => MOCK_METADATA,
      }),
    );

    const source = createSourcifyAbiSource();
    const result = await source.fetchAbi(
      1,
      '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.source).toBe('sourcify');
      expect(result.abi).toEqual(MOCK_ABI);
    }

    expect(fetch).toHaveBeenCalledWith(
      'https://repo.sourcify.dev/contracts/full_match/1/0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48/metadata.json',
    );
  });

  it('returns ok:false when the server responds with 404', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      }),
    );

    const source = createSourcifyAbiSource();
    const result = await source.fetchAbi(1, '0xdeadbeef');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/404|not found/i);
    }
  });

  it('returns ok:false when metadata has no output.abi array', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ output: {} }),
      }),
    );

    const source = createSourcifyAbiSource();
    const result = await source.fetchAbi(1, '0xdeadbeef');

    expect(result.ok).toBe(false);
  });

  it('returns ok:false when fetch throws a network error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new Error('Network failure')),
    );

    const source = createSourcifyAbiSource();
    const result = await source.fetchAbi(1, '0xdeadbeef');

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toMatch(/network failure/i);
    }
  });
});
