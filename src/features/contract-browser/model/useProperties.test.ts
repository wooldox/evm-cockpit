import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ChainDoesNotSupportContract } from 'viem';
import { mainnet } from 'viem/chains';
import { useProperties } from './useProperties';
import { erc20Abi } from '@/shared/lib/abi/fixtures';
import { getBrowserSections } from './effectiveAbi';
import type { TContract } from '@/entities/contract/model/types';
import type { RpcProvider } from '@/shared/ports/rpc';

const ADDR = '0x1234567890123456789012345678901234567890' as const;

function makeContract(overrides?: Partial<TContract>): TContract {
  return {
    id: 'test-id',
    name: 'TestToken',
    chainId: 1,
    address: ADDR,
    abi: erc20Abi,
    source: 'manual',
    addedAt: 0,
    ...overrides,
  };
}

function makeWrapper() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client }, children);
  return Wrapper;
}

function makeFakeClient(
  multicallResults:
    | { status: 'success'; result: unknown }[]
    | (
        | { status: 'failure'; error: Error }
        | { status: 'success'; result: unknown }
      )[],
) {
  return {
    multicall: vi.fn().mockResolvedValue(multicallResults),
  };
}

describe('useProperties', () => {
  it('maps success and failure rows correctly', async () => {
    const contract = makeContract();
    const sections = getBrowserSections(contract);
    const propertiesCount = sections.properties.length;

    // Build results: first = success, second = failure, rest = success
    const results = sections.properties.map((_, i) => {
      if (i === 0) return { status: 'success' as const, result: 'USD Coin' };
      if (i === 1)
        return { status: 'failure' as const, error: new Error('boom') };
      return { status: 'success' as const, result: 'fallback' };
    });

    const fakeClient = makeFakeClient(results);
    const rpc: RpcProvider = {
      getClient: vi.fn().mockReturnValue(fakeClient),
    };

    const wrapper = makeWrapper();
    const { result } = renderHook(() => useProperties(contract, { rpc }), {
      wrapper,
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.rows).toHaveLength(propertiesCount);

    // First row: ok
    const firstRow = result.current.rows[0]!;
    expect(firstRow.status).toBe('ok');
    if (firstRow.status === 'ok') {
      expect(firstRow.value).toBe('USD Coin');
    }

    // Second row: error
    const secondRow = result.current.rows[1]!;
    expect(secondRow.status).toBe('error');
    if (secondRow.status === 'error') {
      expect(secondRow.error).toBe('boom');
    }

    expect(result.current.isError).toBe(false);
    expect(fakeClient.multicall).toHaveBeenCalledOnce();
  });

  it('exposes isError when multicall throws', async () => {
    const contract = makeContract();
    const fakeClient = {
      multicall: vi.fn().mockRejectedValue(new Error('network failure')),
    };
    const rpc: RpcProvider = {
      getClient: vi.fn().mockReturnValue(fakeClient),
    };

    const wrapper = makeWrapper();
    const { result } = renderHook(() => useProperties(contract, { rpc }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(true);
    expect(result.current.rows).toHaveLength(0);
  });

  it('falls back to per-property readContract when the chain has no multicall3', async () => {
    const contract = makeContract();
    const sections = getBrowserSections(contract);
    const propertiesCount = sections.properties.length;

    const noMulticall = new ChainDoesNotSupportContract({
      chain: mainnet,
      contract: { name: 'multicall3' },
    });

    // Each readContract resolves to the function's name, except the second
    // which rejects — that row should surface an error, the rest ok.
    const readContract = vi
      .fn()
      .mockImplementation(({ functionName }: { functionName: string }) => {
        const idx = sections.properties.findIndex(
          (f) => f.name === functionName,
        );
        if (idx === 1) return Promise.reject(new Error('read boom'));
        return Promise.resolve(`val:${functionName}`);
      });

    const fakeClient = {
      multicall: vi.fn().mockRejectedValue(noMulticall),
      readContract,
    };
    const rpc: RpcProvider = {
      getClient: vi.fn().mockReturnValue(fakeClient),
    };

    const wrapper = makeWrapper();
    const { result } = renderHook(() => useProperties(contract, { rpc }), {
      wrapper,
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(result.current.isError).toBe(false);
    expect(result.current.rows).toHaveLength(propertiesCount);
    expect(fakeClient.multicall).toHaveBeenCalledOnce();
    expect(readContract).toHaveBeenCalledTimes(propertiesCount);

    const firstRow = result.current.rows[0]!;
    expect(firstRow.status).toBe('ok');
    if (firstRow.status === 'ok') {
      expect(firstRow.value).toBe(`val:${sections.properties[0]!.name}`);
    }

    const secondRow = result.current.rows[1]!;
    expect(secondRow.status).toBe('error');
    if (secondRow.status === 'error') {
      expect(secondRow.error).toBe('read boom');
    }
  });
});
