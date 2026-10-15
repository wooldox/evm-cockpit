import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@/shared/ui';
import { erc20Abi } from '@/shared/lib/abi/fixtures';
import type { TShareContract } from '@/shared/lib/share/codec';
import { useContractsStore } from '@/entities/contract/model/store';
import { ImportReviewModal } from './ImportReviewModal';

const item = (name: string, hex: string, chainId = 1): TShareContract => ({
  name,
  chainId,
  address: `0x${hex.repeat(40)}`,
  abi: erc20Abi,
  source: 'sourcify',
});
const items = [
  item('Wood', 'a', 11155111),
  item('Water', 'b', 11155111),
  item('Saved One', 'c'),
  item('Mystery', 'd', 987654321),
];

const setup = () => {
  render(
    <ToastProvider>
      <ImportReviewModal items={items} onClose={() => {}} />
    </ToastProvider>,
  );
  return userEvent.setup();
};

describe('ImportReviewModal', () => {
  beforeEach(() =>
    useContractsStore.setState({
      contracts: [
        {
          id: 'saved',
          name: 'Mine',
          chainId: 1,
          address: `0x${'C'.repeat(40)}`,
          abi: erc20Abi,
          source: 'manual',
          addedAt: 0,
        },
      ],
    }),
  );

  it('lists every contract; new ones checked, saved ones locked out', () => {
    setup();
    expect(
      screen.getByRole('dialog', { name: 'Import 4 contracts' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Import Wood' })).toBeChecked();
    const saved = screen.getByRole('checkbox', { name: 'Import Saved One' });
    expect(saved).not.toBeChecked();
    expect(saved).toBeDisabled();
    expect(screen.getByText('already saved')).toBeInTheDocument();
    expect(screen.getByText('unknown chain')).toBeInTheDocument();
    expect(
      screen.getByText('3 of 3 selected · 1 already saved'),
    ).toBeInTheDocument();
  });

  it('imports only the checked contracts', async () => {
    const user = setup();
    await user.click(screen.getByRole('checkbox', { name: 'Import Water' }));
    await user.click(
      screen.getByRole('button', { name: 'Import 2 contracts' }),
    );
    const names = useContractsStore.getState().contracts.map((c) => c.name);
    expect(names).toEqual(['Mine', 'Wood', 'Mystery']);
  });

  it('select all toggles every importable contract', async () => {
    const user = setup();
    await user.click(screen.getByRole('checkbox', { name: 'Deselect all' }));
    expect(screen.getByRole('button', { name: 'Import' })).toBeDisabled();
    await user.click(screen.getByRole('checkbox', { name: 'Select all' }));
    expect(
      screen.getByRole('button', { name: 'Import 3 contracts' }),
    ).toBeEnabled();
  });
});
