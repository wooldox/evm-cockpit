import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { PublicClient } from 'viem';
import { ToastProvider } from '@/shared/ui';
import type { RpcProvider } from '@/shared/ports/rpc';
import { buildUnsignedTxJson } from '@/shared/lib/tx/downloadUnsignedTx';
import { SignScreen } from './SignScreen';

const ACCOUNT = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const;
const TO = '0xA0b86991c6218B36c1d19D4a2e9Eb0cE3606eB48' as const;
const SIG =
  '0x8b1d000000000000000000000000000000000000000000000000000000000e1d' as const;
const HASH =
  '0x1111111111111111111111111111111111111111111111111111111111111111' as const;

/* ── controllable wagmi stubs ───────────────────────────── */
let accountStub: { address: `0x${string}` | undefined; isConnected: boolean };
let chainIdStub: number;
let signMessageAsync: ReturnType<typeof vi.fn>;
let sendTransactionAsync: ReturnType<typeof vi.fn>;

vi.mock('wagmi', () => ({
  useAccount: () => accountStub,
  useChainId: () => chainIdStub,
  useSignMessage: () => ({ signMessageAsync }),
  useSendTransaction: () => ({ sendTransactionAsync }),
}));

function makeRpc(waitImpl?: () => Promise<unknown>): {
  rpc: RpcProvider;
  waitForTransactionReceipt: ReturnType<typeof vi.fn>;
} {
  const waitForTransactionReceipt = vi
    .fn()
    .mockImplementation(
      waitImpl ??
        (() => Promise.resolve({ status: 'success', blockNumber: 1234567n })),
    );
  const client = { waitForTransactionReceipt } as unknown as PublicClient;
  const getClient = vi.fn().mockReturnValue(client);
  return { rpc: { getClient }, waitForTransactionReceipt };
}

function renderScreen(rpc: RpcProvider) {
  return render(
    <ToastProvider>
      <SignScreen deps={{ rpc }} />
    </ToastProvider>,
  );
}

const REAL_TX_JSON = buildUnsignedTxJson({
  chainId: 1,
  to: TO,
  data: '0xa9059cbb0000000000000000000000000000000000000000',
  value: 1_000_000_000_000_000_000n,
  gas: 51284n,
  nonce: 142,
  maxFeePerGas: 30_000_000_000n,
  maxPriorityFeePerGas: 1_500_000_000n,
});

function pasteRawTx(json: string): void {
  // Raw-tx mode is the default; there is a single textarea.
  fireEvent.change(screen.getByRole('textbox'), {
    target: { value: json },
  });
}

beforeEach(() => {
  accountStub = { address: ACCOUNT, isConnected: true };
  chainIdStub = 1;
  signMessageAsync = vi.fn().mockResolvedValue(SIG);
  sendTransactionAsync = vi.fn().mockResolvedValue(HASH);
});

describe('SignScreen — message mode', () => {
  it('type message → byte length shown → Sign → signature rendered + CopyBtn', async () => {
    const user = userEvent.setup();
    renderScreen(makeRpc().rpc);

    await user.click(screen.getByRole('tab', { name: /Message/ }));
    await user.type(screen.getByPlaceholderText(/I authorize/), 'hello');

    expect(screen.getByText('5 bytes')).toBeInTheDocument();
    expect(screen.getByText('personal_sign')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Sign$/ }));

    // wait for the signature-result block (the rendered signature value is
    // unique — "Signature" as a label now also appears in the verify panel).
    await screen.findByText(SIG);
    expect(signMessageAsync).toHaveBeenCalledWith({ message: 'hello' });
    expect(screen.getByText(SIG)).toBeInTheDocument();
    // copy button present
    expect(screen.getByTitle('Copy')).toBeInTheDocument();
  });

  it('reject → inline danger + error toast', async () => {
    signMessageAsync = vi
      .fn()
      .mockRejectedValue({ shortMessage: 'User rejected the request' });
    const user = userEvent.setup();
    renderScreen(makeRpc().rpc);

    await user.click(screen.getByRole('tab', { name: /Message/ }));
    await user.type(screen.getByPlaceholderText(/I authorize/), 'hi');
    await user.click(screen.getByRole('button', { name: /^Sign$/ }));

    await waitFor(() =>
      expect(
        screen.getAllByText('User rejected the request').length,
      ).toBeGreaterThan(0),
    );
    // no signature-result block ("signed" badge is unique to it; "Signature"
    // as a label now also appears in the verify panel).
    expect(screen.queryByText('signed')).not.toBeInTheDocument();
  });

  it('not connected → Sign disabled with title', async () => {
    accountStub = { address: undefined, isConnected: false };
    const user = userEvent.setup();
    renderScreen(makeRpc().rpc);

    await user.click(screen.getByRole('tab', { name: /Message/ }));
    await user.type(screen.getByPlaceholderText(/I authorize/), 'hi');

    const btn = screen.getByRole('button', { name: /^Sign$/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', 'Connect a wallet to sign');
  });
});

describe('SignScreen — layout & verify panel', () => {
  it('uses the shared 1080px content column (matches Deploy/History)', () => {
    const { container } = renderScreen(makeRpc().rpc);
    expect(container.querySelector('.max-w-\\[1080px\\]')).not.toBeNull();
    expect(container.querySelector('.max-w-\\[760px\\]')).toBeNull();
  });

  it('shows the verify panel on the Message tab only', async () => {
    const user = userEvent.setup();
    renderScreen(makeRpc().rpc);
    expect(screen.queryByText(/verify a signed message/i)).toBeNull();
    await user.click(screen.getByRole('tab', { name: /Message/ }));
    expect(screen.getByText(/verify a signed message/i)).toBeInTheDocument();
  });
});

describe('SignScreen — raw tx mode', () => {
  it('paste a real unsigned-tx JSON → preview rows correct', () => {
    renderScreen(makeRpc().rpc);

    pasteRawTx(REAL_TX_JSON);

    expect(screen.getByText('You are about to sign')).toBeInTheDocument();
    expect(screen.getByText('0xA0b869…06eB48')).toBeInTheDocument();
    expect(screen.getByText('1 ETH')).toBeInTheDocument();
    // data: (length-2)/2 bytes — 48 hex chars → 24 bytes
    expect(screen.getByText('24 bytes')).toBeInTheDocument();
    expect(screen.getByText('142')).toBeInTheDocument();
    expect(screen.getByText('51,284')).toBeInTheDocument();
    expect(screen.getByText('Ethereum')).toBeInTheDocument();
  });

  it('invalid JSON → inline error, button disabled', () => {
    renderScreen(makeRpc().rpc);

    pasteRawTx('{not json');

    expect(screen.getByText('invalid JSON')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Sign & broadcast/ }),
    ).toBeDisabled();
    expect(screen.queryByText('You are about to sign')).not.toBeInTheDocument();
  });

  it('broadcast happy → sendTransactionAsync called with bigints + confirmed inline with block + link', async () => {
    const user = userEvent.setup();
    renderScreen(makeRpc().rpc);

    pasteRawTx(REAL_TX_JSON);
    await user.click(screen.getByRole('button', { name: /Sign & broadcast/ }));

    await screen.findByText(/Confirmed in block 1234567/);
    expect(sendTransactionAsync).toHaveBeenCalledWith({
      to: TO,
      data: '0xa9059cbb0000000000000000000000000000000000000000',
      value: 1_000_000_000_000_000_000n,
      gas: 51284n,
      nonce: 142,
      maxFeePerGas: 30_000_000_000n,
      maxPriorityFeePerGas: 1_500_000_000n,
    });
    // explorer link present (chain 1 → etherscan)
    expect(screen.getByTitle('View on explorer')).toBeInTheDocument();
  });

  it('chain mismatch → danger Badge when tx.chainId ≠ connected chainId', () => {
    chainIdStub = 11155111; // sepolia, tx says chainId 1
    renderScreen(makeRpc().rpc);

    pasteRawTx(REAL_TX_JSON);

    expect(screen.getByText('wallet on different chain')).toBeInTheDocument();
  });

  it('not connected → Sign & broadcast disabled with title', () => {
    accountStub = { address: undefined, isConnected: false };
    renderScreen(makeRpc().rpc);

    pasteRawTx(REAL_TX_JSON);

    const btn = screen.getByRole('button', { name: /Sign & broadcast/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', 'Connect a wallet to broadcast');
  });
});
