import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import { useHistoryStore } from '@/entities/history/model/store';
import { useContractsStore } from '@/entities/contract/model/store';
import { useRerunStore } from '@/entities/rerun/model/store';
import { txUrl } from '@/entities/chain/model/explorer';
import { erc20Abi } from '@/shared/lib/abi/fixtures';
import type { TContract } from '@/entities/contract/model/types';
import type { THistoryEntry } from '@/entities/history/model/types';
import { ConfirmProvider } from '@/shared/ui';
import { HistoryView } from './HistoryView';

/* ── next/navigation mock ───────────────────────────────── */
const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
}));

const ADDR_A = '0x1234567890123456789012345678901234567890' as const;
const ADDR_B = '0xabcabcabcabcabcabcabcabcabcabcabcabcabca' as const;
const HASH =
  '0x1111111111111111111111111111111111111111111111111111111111111111' as const;

const contractA: TContract = {
  id: 'a',
  name: 'USD Coin',
  chainId: 1,
  address: ADDR_A,
  abi: erc20Abi,
  source: 'sourcify',
  addedAt: 0,
};

const contractB: TContract = {
  id: 'b',
  name: 'Wrapped Ether',
  chainId: 1,
  address: ADDR_B,
  abi: erc20Abi,
  source: 'sourcify',
  addedAt: 0,
};

const DELETED_ID = '0xdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

function entry(over: Partial<THistoryEntry>): THistoryEntry {
  return {
    id: Math.random().toString(36).slice(2),
    contractId: 'a',
    chainId: 1,
    type: 'read',
    fnName: 'balanceOf',
    args: {},
    status: 'ok',
    timestamp: 1_700_000_000_000,
    ...over,
  };
}

function seed(entries: THistoryEntry[], contracts: TContract[] = [contractA]) {
  useHistoryStore.setState({ entries });
  useContractsStore.setState({ contracts });
}

beforeEach(() => {
  useHistoryStore.setState({ entries: [] });
  useContractsStore.setState({ contracts: [] });
  useRerunStore.setState({ intent: null });
  pushMock.mockClear();
  vi.restoreAllMocks();
});

describe('HistoryView', () => {
  it('renders read-ok row: type badge, fn, contract name, status', () => {
    seed([entry({ type: 'read', status: 'ok', result: '1,000' })]);
    render(<HistoryView />, { wrapper: ConfirmProvider });

    expect(screen.getByText('read')).toBeInTheDocument();
    expect(screen.getByText('balanceOf()')).toBeInTheDocument();
    // "USD Coin" appears in both the filter <option> and the row cell.
    expect(screen.getAllByText('USD Coin').length).toBeGreaterThan(0);
    expect(screen.getByText('✓ ok')).toBeInTheDocument();
  });

  it('renders simulate-error row with truncated message + full title attr', () => {
    const msg = 'execution reverted: InsufficientBalance(1, 2)';
    seed([
      entry({
        type: 'simulate',
        status: 'error',
        fnName: 'transfer',
        error: msg,
      }),
    ]);
    render(<HistoryView />, { wrapper: ConfirmProvider });

    expect(screen.getByText('simulate')).toBeInTheDocument();
    const statusCell = screen.getByText(/^error/);
    expect(statusCell).toHaveAttribute('title', msg);
  });

  it('renders write-ok row with explorer tx link', () => {
    seed([
      entry({
        type: 'write',
        status: 'ok',
        fnName: 'transfer',
        txHash: HASH,
      }),
    ]);
    render(<HistoryView />, { wrapper: ConfirmProvider });

    expect(screen.getByText('write')).toBeInTheDocument();
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', txUrl(1, HASH));
  });

  it('filters rows by contract', async () => {
    const user = userEvent.setup();
    seed(
      [
        entry({ contractId: 'a', fnName: 'balanceOf' }),
        entry({ contractId: 'b', fnName: 'allowance' }),
      ],
      [contractA, contractB],
    );
    render(<HistoryView />, { wrapper: ConfirmProvider });

    expect(screen.getByText('balanceOf()')).toBeInTheDocument();
    expect(screen.getByText('allowance()')).toBeInTheDocument();

    await user.selectOptions(
      screen.getByLabelText('Filter by contract'),
      'Wrapped Ether',
    );

    expect(screen.queryByText('balanceOf()')).not.toBeInTheDocument();
    expect(screen.getByText('allowance()')).toBeInTheDocument();
  });

  it('shows truncated contractId for a deleted contract', () => {
    seed([entry({ contractId: DELETED_ID })], []);
    render(<HistoryView />, { wrapper: ConfirmProvider });

    expect(screen.getByText(/^0xdead/)).toBeInTheDocument();
  });

  it('Clear empties history when confirmed', async () => {
    const user = userEvent.setup();
    seed([entry({})]);
    render(<HistoryView />, { wrapper: ConfirmProvider });

    await user.click(screen.getByRole('button', { name: /Clear/ }));
    await user.click(screen.getByRole('button', { name: 'Clear history' }));

    expect(useHistoryStore.getState().entries).toHaveLength(0);
  });

  it('shows the empty state when there is no history', () => {
    seed([]);
    render(<HistoryView />, { wrapper: ConfirmProvider });

    expect(screen.getByText('No history yet')).toBeInTheDocument();
  });

  it('type filter narrows rows to the selected type', async () => {
    const user = userEvent.setup();
    seed([
      entry({ type: 'read', fnName: 'balanceOf' }),
      entry({ type: 'write', fnName: 'transfer' }),
    ]);
    render(<HistoryView />, { wrapper: ConfirmProvider });

    expect(screen.getByText('balanceOf()')).toBeInTheDocument();
    expect(screen.getByText('transfer()')).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: 'Writes' }));

    expect(screen.queryByText('balanceOf()')).not.toBeInTheDocument();
    expect(screen.getByText('transfer()')).toBeInTheDocument();
  });

  it('Re-run sets the intent and navigates to the contract browser', async () => {
    const user = userEvent.setup();
    seed([
      entry({
        contractId: 'a',
        type: 'read',
        fnName: 'balanceOf',
        args: { owner: '0xdead' },
      }),
    ]);
    render(<HistoryView />, { wrapper: ConfirmProvider });

    await user.click(screen.getByRole('button', { name: /Re-run/ }));

    expect(useRerunStore.getState().intent).toEqual({
      contractId: 'a',
      fnName: 'balanceOf',
      argCount: 1,
      args: { owner: '0xdead' },
      type: 'read',
    });
    expect(pushMock).toHaveBeenCalledWith('/?c=a');
  });

  it('Re-run is disabled with a title when the contract was deleted', () => {
    seed([entry({ contractId: DELETED_ID })], []);
    render(<HistoryView />, { wrapper: ConfirmProvider });

    const btn = screen.getByRole('button', { name: /Re-run/ });
    expect(btn).toBeDisabled();
    expect(btn).toHaveAttribute('title', 'contract no longer saved');
  });

  it('initialContractId preselects the contract filter on first render', () => {
    seed(
      [
        entry({ contractId: 'a', fnName: 'balanceOf' }),
        entry({ contractId: 'b', fnName: 'allowance' }),
      ],
      [contractA, contractB],
    );
    // The /history?c=b page passes the searchParam through as the prop.
    render(<HistoryView initialContractId="b" />, { wrapper: ConfirmProvider });

    // Rows filtered to contract B from the first render — no effects.
    expect(screen.queryByText('balanceOf()')).not.toBeInTheDocument();
    expect(screen.getByText('allowance()')).toBeInTheDocument();
    // Select reflects the preselected contract.
    expect(
      (screen.getByLabelText('Filter by contract') as HTMLSelectElement).value,
    ).toBe('b');
  });

  it("initialContractId falls back to 'all' when the contract is unknown", () => {
    seed([entry({ contractId: 'a', fnName: 'balanceOf' })], [contractA]);
    render(<HistoryView initialContractId="does-not-exist" />, {
      wrapper: ConfirmProvider,
    });

    expect(screen.getByText('balanceOf()')).toBeInTheDocument();
    expect(
      (screen.getByLabelText('Filter by contract') as HTMLSelectElement).value,
    ).toBe('all');
  });
});
