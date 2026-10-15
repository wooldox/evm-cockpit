import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@/shared/ui';
import { erc20Abi } from '@/shared/lib/abi/fixtures';
import * as codec from '@/shared/lib/share/codec';
import { decodeShare, toShareBundle } from '@/shared/lib/share/codec';
import type { TContract } from '@/entities/contract/model/types';
import { ShareModal } from './ShareModal';

// Mock the codec module so we can override `encodeShare` per-test while
// keeping the real implementations for everything else.
vi.mock('@/shared/lib/share/codec', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/shared/lib/share/codec')>();
  return { ...actual };
});

const ADDR = '0x1234567890123456789012345678901234567890' as const;

const smallContract: TContract = {
  id: 'abc123',
  name: 'USD Coin',
  chainId: 1,
  address: ADDR,
  abi: erc20Abi,
  source: 'sourcify',
  addedAt: 0,
};

/** A contract whose ABI is far too big to fit a share link. */
function bigContract(): TContract {
  const abi = Array.from({ length: 6000 }, (_, i) => ({
    type: 'function' as const,
    name: `fn_${i}_padding_to_make_each_entry_substantial`,
    stateMutability: 'view' as const,
    inputs: [{ name: `arg${i}`, type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  }));
  return { ...smallContract, abi };
}

function renderModal(contract: TContract) {
  return render(
    <ToastProvider>
      <ShareModal contract={contract} onClose={vi.fn()} />
    </ToastProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ShareModal', () => {
  it('small contract: shows a link input with a decodable #import= payload', async () => {
    renderModal(smallContract);

    const input = (await screen.findByDisplayValue(
      /#import=/,
    )) as HTMLInputElement;
    expect(input).toBeInTheDocument();

    const token = input.value.split('#import=')[1]!;
    const decoded = await decodeShare(token);
    expect(decoded).toEqual([
      expect.objectContaining({
        name: smallContract.name,
        chainId: smallContract.chainId,
        address: smallContract.address,
        abi: smallContract.abi,
      }),
    ]);

    // CopyBtn present
    expect(screen.getByRole('button', { name: /copy/i })).toBeInTheDocument();
  });

  it('encode failure: shows a fallback hint, no link input', async () => {
    vi.spyOn(codec, 'encodeShare').mockRejectedValue(new Error('boom'));

    renderModal(smallContract);

    expect(
      await screen.findByText(/couldn't generate a link — use file export/i),
    ).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/#import=/)).not.toBeInTheDocument();
  });

  it('oversized contract: replaces the link with a fallback hint', async () => {
    renderModal(bigContract());

    expect(
      await screen.findByText(/abi too large for a link/i),
    ).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/#import=/)).not.toBeInTheDocument();
  });

  it('Download JSON: calls downloadJson with parseable JSON equal to the payload', async () => {
    const fakeUrl = 'blob:fake-url';
    let captured: Blob | null = null;
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn((b: Blob) => {
        captured = b;
        return fakeUrl;
      }),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(
      () => undefined,
    );

    renderModal(smallContract);
    await screen.findByDisplayValue(/#import=/);

    await userEvent.click(
      screen.getByRole('button', { name: /download json/i }),
    );

    await waitFor(() => expect(captured).not.toBeNull());
    const text = await (captured as unknown as Blob).text();
    expect(JSON.parse(text)).toEqual(toShareBundle([smallContract]));
  });
});
