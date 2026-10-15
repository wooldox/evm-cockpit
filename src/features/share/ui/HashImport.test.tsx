import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import { ToastProvider } from '@/shared/ui';
import { erc20Abi } from '@/shared/lib/abi/fixtures';
import { encodeShare } from '@/shared/lib/share/codec';
import { useContractsStore } from '@/entities/contract/model/store';
import type { TContract } from '@/entities/contract/model/types';
import { HashImport } from './HashImport';

const ADDR = '0x1234567890123456789012345678901234567890' as const;

const fixture: TContract = {
  id: 'seed-id',
  name: 'USD Coin',
  chainId: 1,
  address: ADDR,
  abi: erc20Abi,
  source: 'sourcify',
  addedAt: 0,
};

function setHash(h: string) {
  window.location.hash = h;
}

const onImport = vi.fn();

function renderImport() {
  return render(
    <ToastProvider>
      <HashImport onImport={onImport} />
    </ToastProvider>,
  );
}

beforeEach(() => {
  onImport.mockClear();
  useContractsStore.setState({ contracts: [] });
  setHash('');
});

afterEach(() => {
  setHash('');
});

describe('HashImport', () => {
  it('decodes the link and hands it to review — adds nothing, clears hash', async () => {
    setHash(`#import=${await encodeShare([fixture])}`);

    renderImport();

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    expect(onImport.mock.calls[0]![0]).toEqual([
      expect.objectContaining({ name: 'USD Coin', chainId: 1, address: ADDR }),
    ]);
    expect(useContractsStore.getState().contracts).toHaveLength(0);
    expect(window.location.hash).toBe('');
  });

  it('corrupt payload: error toast, no review, hash cleared', async () => {
    setHash('#import=not-a-real-token!!!');

    renderImport();

    expect(await screen.findByText(/import failed/i)).toBeInTheDocument();
    expect(onImport).not.toHaveBeenCalled();
    expect(window.location.hash).toBe('');
  });

  it('no #import hash: does nothing', async () => {
    renderImport();
    await new Promise((r) => setTimeout(r, 0));
    expect(onImport).not.toHaveBeenCalled();
  });

  it('waits for store hydration before handing off (so "already saved" is accurate)', async () => {
    setHash(`#import=${await encodeShare([fixture])}`);

    const hasHydratedSpy = vi
      .spyOn(useContractsStore.persist, 'hasHydrated')
      .mockReturnValue(false);
    let finishHydration: (() => void) | undefined;
    const onFinishSpy = vi
      .spyOn(useContractsStore.persist, 'onFinishHydration')
      .mockImplementation((cb) => {
        finishHydration = cb as () => void;
        return () => {};
      });

    renderImport();

    await new Promise((r) => setTimeout(r, 0));
    expect(onFinishSpy).toHaveBeenCalledTimes(1);
    expect(onImport).not.toHaveBeenCalled();

    finishHydration!();
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));

    hasHydratedSpy.mockRestore();
    onFinishSpy.mockRestore();
  });

  it('also handles a link pasted into an already-open tab (hashchange)', async () => {
    renderImport();
    await new Promise((r) => setTimeout(r, 0));
    expect(onImport).not.toHaveBeenCalled();

    setHash(`#import=${await encodeShare([fixture])}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    expect(window.location.hash).toBe('');
  });
});
