import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { PublicClient } from 'viem';
import type { AbiFunction } from 'abitype';
import { erc20Abi } from '@/shared/lib/abi/fixtures';
import type { TContract } from '@/entities/contract/model/types';
import type { RpcProvider } from '@/shared/ports/rpc';

const ADDR = '0x1234567890123456789012345678901234567890' as const;
const ACCOUNT = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const;
const HASH =
  '0x1111111111111111111111111111111111111111111111111111111111111111' as const;

// --- module-level wagmi stubs, controlled per-test ---
let accountStub: {
  address: `0x${string}` | undefined;
  chainId: number | undefined;
  isConnected: boolean;
};
let switchChainAsync: ReturnType<typeof vi.fn>;
let writeContractAsync: ReturnType<typeof vi.fn>;

vi.mock('wagmi', () => ({
  useAccount: () => accountStub,
  useSwitchChain: () => ({ switchChainAsync }),
  useWriteContract: () => ({ writeContractAsync }),
}));

import { useSendOperation, type SendState } from './useSendOperation';

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

// transfer(address to, uint256 amount) → bool
const transferFn = erc20Abi.find(
  (x) => x.type === 'function' && x.name === 'transfer',
) as AbiFunction;

function makeRpc(waitImpl?: () => Promise<unknown>): {
  rpc: RpcProvider;
  waitForTransactionReceipt: ReturnType<typeof vi.fn>;
} {
  const waitForTransactionReceipt = vi
    .fn()
    .mockImplementation(
      waitImpl ??
        (() => Promise.resolve({ status: 'success', blockNumber: 99n })),
    );
  const client = { waitForTransactionReceipt } as unknown as PublicClient;
  return {
    rpc: { getClient: vi.fn().mockReturnValue(client) },
    waitForTransactionReceipt,
  };
}

const SEND_ARGS = {
  args: [ACCOUNT, 100n] as const,
  rawArgs: { to: ACCOUNT, amount: '100' },
};

beforeEach(() => {
  accountStub = { address: ACCOUNT, chainId: 1, isConnected: true };
  switchChainAsync = vi.fn().mockResolvedValue(undefined);
  writeContractAsync = vi.fn().mockResolvedValue(HASH);
});

describe('useSendOperation', () => {
  it('connected + matching chain + success receipt → confirmed, ok history, write args correct, no switch', async () => {
    const { rpc, waitForTransactionReceipt } = makeRpc();
    const addHistory = vi.fn();
    const { result } = renderHook(() =>
      useSendOperation(makeContract(), transferFn, { rpc, addHistory }),
    );

    let resolved: SendState = { status: 'idle' };
    await act(async () => {
      resolved = await result.current.send({
        ...SEND_ARGS,
        value: 5n,
        gas: 30000n,
      });
    });

    // send() resolves with the terminal state so callers can toast on outcome.
    expect(resolved.status).toBe('confirmed');
    expect(result.current.state.status).toBe('confirmed');
    if (result.current.state.status !== 'confirmed')
      throw new Error('not confirmed');
    expect(result.current.state.hash).toBe(HASH);
    expect(result.current.state.blockNumber).toBe(99n);

    expect(switchChainAsync).not.toHaveBeenCalled();
    expect(writeContractAsync).toHaveBeenCalledWith({
      address: ADDR,
      abi: erc20Abi,
      functionName: 'transfer',
      args: SEND_ARGS.args,
      value: 5n,
      gas: 30000n,
      chainId: 1,
    });
    expect(waitForTransactionReceipt).toHaveBeenCalledWith({ hash: HASH });
    expect(addHistory).toHaveBeenCalledWith({
      contractId: 'test-id',
      chainId: 1,
      type: 'write',
      fnName: 'transfer',
      args: SEND_ARGS.rawArgs,
      status: 'ok',
      txHash: HASH,
      result: 'block 99',
      from: ACCOUNT,
    });
  });

  it('wallet chain mismatch → switchChainAsync called with contract chainId before write', async () => {
    accountStub = { address: ACCOUNT, chainId: 5, isConnected: true };
    const { rpc } = makeRpc();
    const addHistory = vi.fn();
    const { result } = renderHook(() =>
      useSendOperation(makeContract(), transferFn, { rpc, addHistory }),
    );

    await act(async () => {
      await result.current.send(SEND_ARGS);
    });

    expect(switchChainAsync).toHaveBeenCalledWith({ chainId: 1 });
    expect(switchChainAsync.mock.invocationCallOrder[0]!).toBeLessThan(
      writeContractAsync.mock.invocationCallOrder[0]!,
    );
    expect(result.current.state.status).toBe('confirmed');
  });

  it('switchChainAsync rejects → failed, write NOT called, error history', async () => {
    accountStub = { address: ACCOUNT, chainId: 5, isConnected: true };
    switchChainAsync = vi.fn().mockRejectedValue(new Error('denied'));
    const { rpc } = makeRpc();
    const addHistory = vi.fn();
    const { result } = renderHook(() =>
      useSendOperation(makeContract(), transferFn, { rpc, addHistory }),
    );

    await act(async () => {
      await result.current.send(SEND_ARGS);
    });

    expect(result.current.state.status).toBe('failed');
    if (result.current.state.status !== 'failed') throw new Error('not failed');
    expect(result.current.state.error).toBe('network switch rejected');
    expect(writeContractAsync).not.toHaveBeenCalled();
    expect(addHistory).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'write', status: 'error' }),
    );
  });

  it('writeContractAsync rejects (shortMessage) → failed with that message, error history', async () => {
    writeContractAsync = vi
      .fn()
      .mockRejectedValue({ shortMessage: 'User rejected the request' });
    const { rpc, waitForTransactionReceipt } = makeRpc();
    const addHistory = vi.fn();
    const { result } = renderHook(() =>
      useSendOperation(makeContract(), transferFn, { rpc, addHistory }),
    );

    await act(async () => {
      await result.current.send(SEND_ARGS);
    });

    expect(result.current.state.status).toBe('failed');
    if (result.current.state.status !== 'failed') throw new Error('not failed');
    expect(result.current.state.error).toBe('User rejected the request');
    expect(waitForTransactionReceipt).not.toHaveBeenCalled();
    expect(addHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'write',
        status: 'error',
        from: ACCOUNT,
      }),
    );
  });

  it('reverted receipt → failed with on-chain message, error history includes txHash', async () => {
    const { rpc } = makeRpc(() =>
      Promise.resolve({ status: 'reverted', blockNumber: 99n }),
    );
    const addHistory = vi.fn();
    const { result } = renderHook(() =>
      useSendOperation(makeContract(), transferFn, { rpc, addHistory }),
    );

    await act(async () => {
      await result.current.send(SEND_ARGS);
    });

    expect(result.current.state.status).toBe('failed');
    if (result.current.state.status !== 'failed') throw new Error('not failed');
    expect(result.current.state.error).toBe('transaction reverted on-chain');
    expect(result.current.state.hash).toBe(HASH);
    expect(addHistory).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'write',
        status: 'error',
        txHash: HASH,
      }),
    );
  });

  it('receipt fetch throws → failed keeping hash, error history with txHash', async () => {
    const { rpc } = makeRpc(() => Promise.reject(new Error('timeout')));
    const addHistory = vi.fn();
    const { result } = renderHook(() =>
      useSendOperation(makeContract(), transferFn, { rpc, addHistory }),
    );

    await act(async () => {
      await result.current.send(SEND_ARGS);
    });

    expect(result.current.state.status).toBe('failed');
    if (result.current.state.status !== 'failed') throw new Error('not failed');
    expect(result.current.state.error).toBe('timeout');
    expect(result.current.state.hash).toBe(HASH);
    expect(addHistory).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'error', txHash: HASH }),
    );
  });

  it('re-entrant send while first is in-flight is ignored (write called once)', async () => {
    // writeContractAsync parks on a deferred so the first send stays in-flight.
    let resolveWrite: (h: `0x${string}`) => void = () => {};
    writeContractAsync = vi.fn().mockReturnValue(
      new Promise<`0x${string}`>((res) => {
        resolveWrite = res;
      }),
    );
    const { rpc } = makeRpc();
    const addHistory = vi.fn();
    const { result } = renderHook(() =>
      useSendOperation(makeContract(), transferFn, { rpc, addHistory }),
    );

    let firstSend: Promise<SendState> = Promise.resolve({ status: 'idle' });
    act(() => {
      firstSend = result.current.send(SEND_ARGS);
    });
    expect(result.current.state.status).toBe('wallet');

    // Second send while the first awaits the wallet — must be a no-op.
    await act(async () => {
      await result.current.send(SEND_ARGS);
    });
    expect(writeContractAsync).toHaveBeenCalledTimes(1);

    // Let the first send complete cleanly.
    await act(async () => {
      resolveWrite(HASH);
      await firstSend;
    });
    expect(writeContractAsync).toHaveBeenCalledTimes(1);
    expect(result.current.state.status).toBe('confirmed');
  });

  it("not connected → failed 'connect a wallet to sign', nothing called", async () => {
    accountStub = {
      address: undefined,
      chainId: undefined,
      isConnected: false,
    };
    const { rpc, waitForTransactionReceipt } = makeRpc();
    const addHistory = vi.fn();
    const { result } = renderHook(() =>
      useSendOperation(makeContract(), transferFn, { rpc, addHistory }),
    );

    await act(async () => {
      await result.current.send(SEND_ARGS);
    });

    expect(result.current.state.status).toBe('failed');
    if (result.current.state.status !== 'failed') throw new Error('not failed');
    expect(result.current.state.error).toBe('connect a wallet to sign');
    expect(switchChainAsync).not.toHaveBeenCalled();
    expect(writeContractAsync).not.toHaveBeenCalled();
    expect(waitForTransactionReceipt).not.toHaveBeenCalled();
    expect(addHistory).not.toHaveBeenCalled();
  });
});
