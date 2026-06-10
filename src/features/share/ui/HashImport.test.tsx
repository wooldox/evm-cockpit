import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, waitFor, screen } from '@testing-library/react';
import { ToastProvider } from '@/shared/ui';
import { erc20Abi } from '@/shared/lib/abi/fixtures';
import { encodeContractShare } from '@/shared/lib/share/codec';
import { useContractsStore } from '@/entities/contract/model/store';
import type { TContract } from '@/entities/contract/model/types';
import { HashImport } from './HashImport';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

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

function renderImport() {
  return render(
    <ToastProvider>
      <HashImport />
    </ToastProvider>,
  );
}

beforeEach(() => {
  pushMock.mockClear();
  useContractsStore.setState({ contracts: [] });
  setHash('');
});

afterEach(() => {
  setHash('');
});

describe('HashImport', () => {
  it('imports a valid payload: adds contract, toasts, navigates, clears hash', async () => {
    const token = await encodeContractShare(fixture);
    setHash(`#import=${token}`);

    renderImport();

    await waitFor(() => {
      expect(useContractsStore.getState().contracts).toHaveLength(1);
    });
    const added = useContractsStore.getState().contracts[0]!;
    expect(added.name).toBe('USD Coin');
    expect(added.id).not.toBe('seed-id');

    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith(`/?c=${added.id}`);
    });
    expect(await screen.findByText(/contract imported/i)).toBeInTheDocument();
    expect(window.location.hash).toBe('');
  });

  it('corrupt payload: error toast, no navigation, hash cleared', async () => {
    setHash('#import=not-a-real-token!!!');

    renderImport();

    expect(await screen.findByText(/import failed/i)).toBeInTheDocument();
    expect(pushMock).not.toHaveBeenCalled();
    expect(useContractsStore.getState().contracts).toHaveLength(0);
    expect(window.location.hash).toBe('');
  });

  it('no #import hash: does nothing', async () => {
    renderImport();

    // Give any (non-existent) async work a tick to settle.
    await new Promise((r) => setTimeout(r, 0));
    expect(pushMock).not.toHaveBeenCalled();
    expect(useContractsStore.getState().contracts).toHaveLength(0);
  });

  it('waits for store hydration before importing → no duplicate when contract is in storage', async () => {
    const token = await encodeContractShare(fixture);
    setHash(`#import=${token}`);

    // Simulate a cold load: persist has NOT finished rehydrating yet, so the
    // in-memory snapshot is empty even though `fixture` lives in storage.
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

    // Nothing imported yet — the effect registered an onFinishHydration cb.
    await new Promise((r) => setTimeout(r, 0));
    expect(onFinishSpy).toHaveBeenCalledTimes(1);
    expect(useContractsStore.getState().contracts).toHaveLength(0);
    expect(pushMock).not.toHaveBeenCalled();

    // Hydration completes: the existing contract is now present in the store,
    // then the captured callback fires.
    useContractsStore.setState({ contracts: [fixture] });
    finishHydration!();

    // Dedupe hits: no new contract added, "Already saved" toast, navigates to
    // the existing contract.
    expect(await screen.findByText(/already saved/i)).toBeInTheDocument();
    expect(useContractsStore.getState().contracts).toHaveLength(1);
    expect(useContractsStore.getState().contracts[0]!.id).toBe('seed-id');
    await waitFor(() => {
      expect(pushMock).toHaveBeenCalledWith('/?c=seed-id');
    });

    hasHydratedSpy.mockRestore();
    onFinishSpy.mockRestore();
  });
});
