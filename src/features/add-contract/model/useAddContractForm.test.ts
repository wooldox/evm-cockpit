import { describe, it, expect, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAddContractForm } from './useAddContractForm';
import type { Deps } from './useAddContractForm';
import type { TContract } from '@/entities/contract/model/types';
import { erc20Abi } from '@/shared/lib/abi/fixtures';
import { categorizeAbi } from '@/shared/lib/abi/categorize';
import type { AbiSource } from '@/shared/ports/abi-source';
import type { RpcProvider } from '@/shared/ports/rpc';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_ADDRESS = '0x1234567890123456789012345678901234567890' as const;
const IMPL_ADDRESS = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const;

function makeAbiSource(
  result: Awaited<ReturnType<AbiSource['fetchAbi']>>,
): AbiSource {
  return { fetchAbi: vi.fn().mockResolvedValue(result) };
}

function makeRpc(): RpcProvider {
  return { getClient: vi.fn() };
}

function makeDeps(overrides?: Partial<Deps>): Deps {
  return {
    abiResolver: makeAbiSource({ ok: true, abi: erc20Abi, source: 'sourcify' }),
    rpc: makeRpc(),
    addContract: vi.fn(),
    updateContract: vi.fn(),
    detectProxy: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

// ─── Test suite ──────────────────────────────────────────────────────────────

describe('useAddContractForm', () => {
  // ── 0. Initial mode ────────────────────────────────────────────────────────

  describe('prefill (duplicate)', () => {
    it('seeds a NEW contract in manual mode with the ABI pasted', () => {
      const deps = makeDeps();
      const { result } = renderHook(() =>
        useAddContractForm({
          prefill: {
            name: 'USDC',
            chainId: 1,
            address: VALID_ADDRESS,
            abi: erc20Abi,
          },
          defaultMode: 'fetch',
          deps,
        }),
      );
      expect(result.current.mode).toBe('manual');
      expect(result.current.name).toBe('USDC');
      expect(JSON.parse(result.current.abiText)).toEqual(erc20Abi);

      act(() => {
        result.current.setChainId(11155111);
        result.current.setAddress(IMPL_ADDRESS);
      });
      act(() => {
        expect(result.current.submit()).not.toBeNull();
      });
      expect(deps.updateContract).not.toHaveBeenCalled();
      expect(deps.addContract).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'USDC',
          chainId: 11155111,
          address: IMPL_ADDRESS,
          abi: erc20Abi,
          source: 'manual',
        }),
      );
    });
  });

  describe('prefill (import)', () => {
    const proxy = {
      kind: 'eip1967' as const,
      implAddress: IMPL_ADDRESS,
      implAbi: erc20Abi,
    };
    const prefill = {
      name: 'USDC',
      chainId: 1,
      address: VALID_ADDRESS,
      abi: erc20Abi,
      source: 'sourcify' as const,
      proxy,
    };

    it('keeps the imported source and proxy when saved unchanged', () => {
      const deps = makeDeps();
      const { result } = renderHook(() =>
        useAddContractForm({ prefill, deps }),
      );
      let saved: TContract | null = null;
      act(() => {
        saved = result.current.submit();
      });
      expect(saved).toMatchObject({ source: 'sourcify', proxy });
      expect(deps.addContract).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'sourcify', proxy }),
      );
    });

    it('editing the ABI makes it manual; changing the address drops the proxy', () => {
      const deps = makeDeps();
      const { result } = renderHook(() =>
        useAddContractForm({ prefill, deps }),
      );
      act(() => {
        result.current.setAbiText(JSON.stringify(erc20Abi));
        result.current.setAddress(IMPL_ADDRESS);
      });
      act(() => {
        result.current.submit();
      });
      expect(deps.addContract).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'manual', proxy: undefined }),
      );
    });
  });

  describe('defaultMode', () => {
    it('defaults to fetch when no defaultMode is given', () => {
      const { result } = renderHook(() =>
        useAddContractForm({ deps: makeDeps() }),
      );
      expect(result.current.mode).toBe('fetch');
    });

    it("opens in manual when defaultMode is 'manual'", () => {
      const { result } = renderHook(() =>
        useAddContractForm({ defaultMode: 'manual', deps: makeDeps() }),
      );
      expect(result.current.mode).toBe('manual');
    });

    it("opens in fetch when defaultMode is 'fetch'", () => {
      const { result } = renderHook(() =>
        useAddContractForm({ defaultMode: 'fetch', deps: makeDeps() }),
      );
      expect(result.current.mode).toBe('fetch');
    });
  });

  // ── 1. Manual mode ────────────────────────────────────────────────────────

  describe('manual mode', () => {
    it('invalid JSON in abiText → errors.abi set, submit() returns null, addContract NOT called', async () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useAddContractForm({ deps }));

      act(() => {
        result.current.setMode('manual');
        result.current.setName('MyToken');
        result.current.setAddress(VALID_ADDRESS);
        result.current.setAbiText('not valid json {{');
      });

      // errors.abi should be set because abiText is non-empty and invalid
      expect(result.current.errors.abi).toBeDefined();

      let submitResult: TContract | null = null;
      act(() => {
        submitResult = result.current.submit();
      });

      expect(submitResult).toBeNull();
      expect(deps.addContract).not.toHaveBeenCalled();
    });

    it('non-array JSON in abiText → errors.abi set, submit() returns null', async () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useAddContractForm({ deps }));

      act(() => {
        result.current.setMode('manual');
        result.current.setName('MyToken');
        result.current.setAddress(VALID_ADDRESS);
        result.current.setAbiText('{"not": "an array"}');
      });

      expect(result.current.errors.abi).toBeDefined();

      let submitResult: TContract | null = null;
      act(() => {
        submitResult = result.current.submit();
      });

      expect(submitResult).toBeNull();
      expect(deps.addContract).not.toHaveBeenCalled();
    });

    it("valid JSON array + name + valid address → submit() returns the contract, addContract called with source:'manual'", async () => {
      const deps = makeDeps();
      const { result } = renderHook(() => useAddContractForm({ deps }));

      act(() => {
        result.current.setMode('manual');
        result.current.setName('MyToken');
        result.current.setAddress(VALID_ADDRESS);
        result.current.setAbiText(JSON.stringify(erc20Abi));
      });

      expect(result.current.errors.abi).toBeUndefined();
      expect(result.current.canSubmit).toBe(true);

      let submitResult: TContract | null = null;
      act(() => {
        submitResult = result.current.submit();
      });

      expect(submitResult).not.toBeNull();
      expect(deps.addContract).toHaveBeenCalledOnce();

      const called = (
        (deps.addContract as ReturnType<typeof vi.fn>).mock.calls[0] as [
          TContract,
        ]
      )[0];
      expect(called.source).toBe('manual');
      expect(called.abi).toEqual(erc20Abi);
      expect(called.name).toBe('MyToken');
      expect(called.address).toBe(VALID_ADDRESS);
      expect(called.proxy).toBeUndefined();
    });
  });

  // ── 2. Fetch success (no proxy) ───────────────────────────────────────────

  describe('fetch mode – success, no proxy', () => {
    it('after fetchAbi(), status=done, categories match categorizeAbi(erc20Abi)', async () => {
      const deps = makeDeps({
        abiResolver: makeAbiSource({
          ok: true,
          abi: erc20Abi,
          source: 'sourcify',
        }),
        detectProxy: vi.fn().mockResolvedValue(null),
      });

      const { result } = renderHook(() => useAddContractForm({ deps }));

      act(() => {
        result.current.setName('ERC20');
        result.current.setAddress(VALID_ADDRESS);
      });

      await act(async () => {
        await result.current.fetchAbi();
      });

      expect(result.current.fetch.status).toBe('done');
      expect(result.current.fetch.proxy).toBeUndefined();

      const expected = categorizeAbi(erc20Abi);
      expect(result.current.fetch.categories).toEqual({
        properties: expected.properties.length,
        getters: expected.getters.length,
        operations: expected.operations.length,
        events: expected.events.length,
      });
    });

    it('submit adds contract with resolved source and no proxy', async () => {
      const deps = makeDeps({
        abiResolver: makeAbiSource({
          ok: true,
          abi: erc20Abi,
          source: 'sourcify',
        }),
        detectProxy: vi.fn().mockResolvedValue(null),
      });

      const { result } = renderHook(() => useAddContractForm({ deps }));

      act(() => {
        result.current.setName('ERC20');
        result.current.setAddress(VALID_ADDRESS);
      });

      await act(async () => {
        await result.current.fetchAbi();
      });

      let submitResult: TContract | null = null;
      act(() => {
        submitResult = result.current.submit();
      });

      expect(submitResult).not.toBeNull();
      expect(deps.addContract).toHaveBeenCalledOnce();

      const called = (
        (deps.addContract as ReturnType<typeof vi.fn>).mock.calls[0] as [
          TContract,
        ]
      )[0];
      expect(called.source).toBe('sourcify');
      expect(called.abi).toEqual(erc20Abi);
      expect(called.proxy).toBeUndefined();
    });
  });

  // ── 3. Fetch + proxy ─────────────────────────────────────────────────────

  describe('fetch mode – proxy detected', () => {
    it('detectProxy returns eip1967; resolver returns erc20Abi for both → proxy stored, implAbi set', async () => {
      const abiResolver: AbiSource = {
        fetchAbi: vi.fn().mockResolvedValue({
          ok: true,
          abi: erc20Abi,
          source: 'sourcify' as const,
        }),
      };

      const deps = makeDeps({
        abiResolver,
        detectProxy: vi.fn().mockResolvedValue({
          kind: 'eip1967',
          implAddress: IMPL_ADDRESS,
        }),
      });

      const { result } = renderHook(() => useAddContractForm({ deps }));

      act(() => {
        result.current.setName('Proxy');
        result.current.setAddress(VALID_ADDRESS);
      });

      await act(async () => {
        await result.current.fetchAbi();
      });

      expect(result.current.fetch.status).toBe('done');
      expect(result.current.fetch.proxy).toBeDefined();
      expect(result.current.fetch.proxy?.kind).toBe('eip1967');
      expect(result.current.fetch.proxy?.implAddress).toBe(IMPL_ADDRESS);
      expect(result.current.fetch.proxy?.implAbi).toEqual(erc20Abi);
    });

    it('submit stores proxy on the contract', async () => {
      const abiResolver: AbiSource = {
        fetchAbi: vi.fn().mockResolvedValue({
          ok: true,
          abi: erc20Abi,
          source: 'sourcify' as const,
        }),
      };

      const deps = makeDeps({
        abiResolver,
        detectProxy: vi.fn().mockResolvedValue({
          kind: 'eip1967',
          implAddress: IMPL_ADDRESS,
        }),
      });

      const { result } = renderHook(() => useAddContractForm({ deps }));

      act(() => {
        result.current.setName('Proxy');
        result.current.setAddress(VALID_ADDRESS);
      });

      await act(async () => {
        await result.current.fetchAbi();
      });

      let submitResult: TContract | null = null;
      act(() => {
        submitResult = result.current.submit();
      });

      expect(submitResult).not.toBeNull();
      const called = (
        (deps.addContract as ReturnType<typeof vi.fn>).mock.calls[0] as [
          TContract,
        ]
      )[0];
      expect(called.proxy).toBeDefined();
      expect(called.proxy?.kind).toBe('eip1967');
      expect(called.proxy?.implAddress).toBe(IMPL_ADDRESS);
      expect(called.proxy?.implAbi).toEqual(erc20Abi);
    });

    it('categories reflect merged proxy + impl ABIs', async () => {
      const abiResolver: AbiSource = {
        fetchAbi: vi.fn().mockResolvedValue({
          ok: true,
          abi: erc20Abi,
          source: 'sourcify' as const,
        }),
      };

      const deps = makeDeps({
        abiResolver,
        detectProxy: vi.fn().mockResolvedValue({
          kind: 'eip1967',
          implAddress: IMPL_ADDRESS,
        }),
      });

      const { result } = renderHook(() => useAddContractForm({ deps }));

      act(() => {
        result.current.setName('Proxy');
        result.current.setAddress(VALID_ADDRESS);
      });

      await act(async () => {
        await result.current.fetchAbi();
      });

      // Both proxy and impl have erc20Abi, merged = doubled counts
      const merged = [...erc20Abi, ...erc20Abi];
      const expected = categorizeAbi(merged);
      expect(result.current.fetch.categories).toEqual({
        properties: expected.properties.length,
        getters: expected.getters.length,
        operations: expected.operations.length,
        events: expected.events.length,
      });
    });
  });

  // ── 3b. Proxy detected but impl ABI fetch fails ───────────────────────────

  describe('fetch mode – proxy detected, impl ABI unavailable', () => {
    it('proxy recorded without implAbi; status done; submit stores proxy', async () => {
      const abiResolver: AbiSource = {
        fetchAbi: vi
          .fn()
          .mockResolvedValueOnce({
            ok: true,
            abi: erc20Abi,
            source: 'sourcify' as const,
          })
          .mockResolvedValueOnce({ ok: false, error: 'impl not verified' }),
      };

      const deps = makeDeps({
        abiResolver,
        detectProxy: vi.fn().mockResolvedValue({
          kind: 'eip1967',
          implAddress: IMPL_ADDRESS,
        }),
      });

      const { result } = renderHook(() => useAddContractForm({ deps }));

      act(() => {
        result.current.setName('ProxyNoImpl');
        result.current.setAddress(VALID_ADDRESS);
      });

      await act(async () => {
        await result.current.fetchAbi();
      });

      expect(result.current.fetch.status).toBe('done');
      expect(result.current.fetch.proxy).toBeDefined();
      expect(result.current.fetch.proxy?.kind).toBe('eip1967');
      expect(result.current.fetch.proxy?.implAddress).toBe(IMPL_ADDRESS);
      expect(result.current.fetch.proxy?.implAbi).toBeUndefined();

      let submitResult: TContract | null = null;
      act(() => {
        submitResult = result.current.submit();
      });

      expect(submitResult).not.toBeNull();
      const called = (
        (deps.addContract as ReturnType<typeof vi.fn>).mock.calls[0] as [
          TContract,
        ]
      )[0];
      expect(called.proxy).toBeDefined();
      expect(called.proxy?.kind).toBe('eip1967');
      expect(called.proxy?.implAddress).toBe(IMPL_ADDRESS);
      expect(called.proxy?.implAbi).toBeUndefined();
    });
  });

  // ── 3c. Fetch state reset on address/chainId change ───────────────────────

  describe('fetch state reset', () => {
    it('changing address after successful fetch resets status to idle and canSubmit to false', async () => {
      const deps = makeDeps({
        abiResolver: makeAbiSource({
          ok: true,
          abi: erc20Abi,
          source: 'sourcify',
        }),
        detectProxy: vi.fn().mockResolvedValue(null),
      });

      const { result } = renderHook(() => useAddContractForm({ deps }));

      act(() => {
        result.current.setName('Token');
        result.current.setAddress(VALID_ADDRESS);
      });

      await act(async () => {
        await result.current.fetchAbi();
      });

      expect(result.current.fetch.status).toBe('done');
      expect(result.current.canSubmit).toBe(true);

      // Change to a different valid address
      act(() => {
        result.current.setAddress(('0x' + '9'.repeat(40)) as `0x${string}`);
      });

      expect(result.current.fetch.status).toBe('idle');
      expect(result.current.canSubmit).toBe(false);
    });
  });

  // ── 4. Fetch error ────────────────────────────────────────────────────────

  describe('fetch mode – resolver error', () => {
    it("resolver returns {ok:false,error} → status='error'", async () => {
      const deps = makeDeps({
        abiResolver: makeAbiSource({
          ok: false,
          error: 'ABI not found on Sourcify or Etherscan',
        }),
      });

      const { result } = renderHook(() => useAddContractForm({ deps }));

      act(() => {
        result.current.setName('Unknown');
        result.current.setAddress(VALID_ADDRESS);
      });

      await act(async () => {
        await result.current.fetchAbi();
      });

      expect(result.current.fetch.status).toBe('error');
      expect(result.current.fetch.error).toBe(
        'ABI not found on Sourcify or Etherscan',
      );
    });
  });

  // ── 5. Address validation ─────────────────────────────────────────────────

  describe('address validation', () => {
    it('addrValid false when address is empty', () => {
      const { result } = renderHook(() =>
        useAddContractForm({ deps: makeDeps() }),
      );
      expect(result.current.addrValid).toBe(false);
    });

    it('addrValid true for valid hex address', () => {
      const { result } = renderHook(() =>
        useAddContractForm({ deps: makeDeps() }),
      );
      act(() => {
        result.current.setAddress(VALID_ADDRESS);
      });
      expect(result.current.addrValid).toBe(true);
    });

    it('addrValid false for invalid address string', () => {
      const { result } = renderHook(() =>
        useAddContractForm({ deps: makeDeps() }),
      );
      act(() => {
        result.current.setAddress('0xnothex');
      });
      expect(result.current.addrValid).toBe(false);
      expect(result.current.errors.address).toBeDefined();
    });
  });

  // ── 6. canSubmit ─────────────────────────────────────────────────────────

  describe('canSubmit', () => {
    it('false when no name', () => {
      const { result } = renderHook(() =>
        useAddContractForm({ deps: makeDeps() }),
      );
      act(() => {
        result.current.setAddress(VALID_ADDRESS);
        result.current.setMode('manual');
        result.current.setAbiText(JSON.stringify(erc20Abi));
      });
      expect(result.current.canSubmit).toBe(false);
    });

    it('false when fetch mode and status is not done', () => {
      const { result } = renderHook(() =>
        useAddContractForm({ deps: makeDeps() }),
      );
      act(() => {
        result.current.setName('Token');
        result.current.setAddress(VALID_ADDRESS);
        // mode is "fetch" by default, fetch.status is "idle"
      });
      expect(result.current.canSubmit).toBe(false);
    });
  });

  // ── 6b. Default chain ──────────────────────────────────────────────────────

  describe('defaultChainId', () => {
    it("a new contract defaults to the app's current chain, not Ethereum", () => {
      const { result } = renderHook(() =>
        useAddContractForm({ defaultChainId: 8453, deps: makeDeps() }),
      );
      expect(result.current.chainId).toBe(8453);
    });

    it("an editing contract's own chain wins over defaultChainId", () => {
      const existing: TContract = {
        id: 'existing-id',
        name: 'Old Name',
        chainId: 137,
        address: VALID_ADDRESS,
        abi: erc20Abi,
        source: 'sourcify',
        addedAt: 1000,
      };
      const { result } = renderHook(() =>
        useAddContractForm({
          editing: existing,
          defaultChainId: 8453,
          deps: makeDeps(),
        }),
      );
      expect(result.current.chainId).toBe(137);
    });

    it('falls back to mainnet when no default is provided', () => {
      const { result } = renderHook(() =>
        useAddContractForm({ deps: makeDeps() }),
      );
      expect(result.current.chainId).toBe(1);
    });
  });

  // ── 7. Editing mode ───────────────────────────────────────────────────────

  describe('editing mode', () => {
    it('pre-populates from existing contract and calls updateContract on submit', async () => {
      const existing: TContract = {
        id: 'existing-id',
        name: 'Old Name',
        chainId: 137,
        address: VALID_ADDRESS,
        abi: erc20Abi,
        source: 'sourcify',
        addedAt: 1000,
      };

      const deps = makeDeps();
      const { result } = renderHook(() =>
        useAddContractForm({ editing: existing, deps }),
      );

      expect(result.current.name).toBe('Old Name');
      expect(result.current.chainId).toBe(137);
      expect(result.current.address).toBe(VALID_ADDRESS);

      act(() => {
        result.current.setName('New Name');
        result.current.setMode('manual');
        result.current.setAbiText(JSON.stringify(erc20Abi));
      });

      let submitResult: TContract | null = null;
      act(() => {
        submitResult = result.current.submit();
      });

      expect(submitResult).not.toBeNull();
      expect(deps.updateContract).toHaveBeenCalledOnce();
      expect(deps.addContract).not.toHaveBeenCalled();

      const callArgs = (deps.updateContract as ReturnType<typeof vi.fn>).mock
        .calls[0] as [string, TContract];
      expect(callArgs[0]).toBe('existing-id');
      const patch = callArgs[1];
      expect(patch.id).toBe('existing-id');
      expect(patch.name).toBe('New Name');
      expect(patch.addedAt).toBe(1000);
    });
  });
});
