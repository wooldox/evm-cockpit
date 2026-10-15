import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ConfirmProvider, ToastProvider } from '@/shared/ui';
import { useContractsStore } from '@/entities/contract/model/store';
import { useHistoryStore } from '@/entities/history/model/store';
import type { TContract } from '@/entities/contract/model/types';
import type { THistoryEntry } from '@/entities/history/model/types';
import { useDeleteContract } from './useDeleteContract';

const c1: TContract = {
  id: 'c1',
  name: 'USD Coin',
  chainId: 1,
  address: `0x${'1'.repeat(40)}`,
  abi: [],
  source: 'manual',
  addedAt: 0,
};

const entry = (id: string, contractId: string) =>
  ({
    id,
    contractId,
    chainId: 1,
    type: 'read',
    fnName: 'name',
    args: {},
    status: 'ok',
    timestamp: 0,
  }) as THistoryEntry;

function Harness() {
  const del = useDeleteContract();
  return (
    <button type="button" onClick={() => void del(c1)}>
      delete
    </button>
  );
}

const setup = () => {
  render(
    <ToastProvider>
      <ConfirmProvider>
        <Harness />
      </ConfirmProvider>
    </ToastProvider>,
  );
  return userEvent.setup();
};

describe('useDeleteContract', () => {
  beforeEach(() => {
    useContractsStore.setState({ contracts: [c1] });
    useHistoryStore.setState({
      entries: [entry('h1', 'c1'), entry('h2', 'c1'), entry('h3', 'other')],
    });
  });

  it('keeps history by default', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'delete' }));
    expect(
      screen.getByRole('checkbox', {
        name: 'Also delete its 2 history entries',
      }),
    ).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(useContractsStore.getState().contracts).toEqual([]);
    expect(useHistoryStore.getState().entries).toHaveLength(3);
  });

  it("deletes only this contract's history when ticked", async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'delete' }));
    await user.click(screen.getByRole('checkbox'));
    await user.click(screen.getByRole('button', { name: 'Delete' }));
    expect(useHistoryStore.getState().entries.map((e) => e.id)).toEqual(['h3']);
  });

  it('offers no checkbox when there is no history', async () => {
    useHistoryStore.setState({ entries: [] });
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'delete' }));
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  it('cancel deletes nothing', async () => {
    const user = setup();
    await user.click(screen.getByRole('button', { name: 'delete' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(useContractsStore.getState().contracts).toHaveLength(1);
  });
});
