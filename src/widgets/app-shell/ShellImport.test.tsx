import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@/shared/ui';
import { erc20Abi } from '@/shared/lib/abi/fixtures';
import { toShareBundle, type TShareContract } from '@/shared/lib/share/codec';
import { useContractsStore } from '@/entities/contract/model/store';
import type { TContract } from '@/entities/contract/model/types';
import { AppShellProvider, useAppShell } from './AppShellProvider';
import { ShellImport } from './ShellImport';

const pushMock = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: pushMock }),
  usePathname: () => '/',
}));

const saved: TContract = {
  id: 'saved',
  name: 'Mine',
  chainId: 1,
  address: `0x${'a'.repeat(40)}`,
  abi: erc20Abi,
  source: 'manual',
  addedAt: 0,
};
const item = (name: string, hex: string): TShareContract => ({
  name,
  chainId: 1,
  address: `0x${hex.repeat(40)}`,
  abi: erc20Abi,
  source: 'sourcify',
});

function Trigger({ items }: { items: TShareContract[] }) {
  const { startImport, openImportFile } = useAppShell();
  return (
    <>
      <button type="button" onClick={() => startImport(items)}>
        start
      </button>
      <button type="button" onClick={openImportFile}>
        file
      </button>
    </>
  );
}

const setup = (items: TShareContract[] = []) => {
  render(
    <AppShellProvider>
      <ToastProvider>
        <Trigger items={items} />
        <ShellImport />
      </ToastProvider>
    </AppShellProvider>,
  );
  return userEvent.setup();
};

describe('ShellImport', () => {
  beforeEach(() => {
    pushMock.mockClear();
    useContractsStore.setState({ contracts: [saved] });
  });

  it('one new contract → prefilled "Import contract" modal; nothing added yet', async () => {
    const user = setup([item('Shared', 'b')]);
    await user.click(screen.getByRole('button', { name: 'start' }));
    expect(
      await screen.findByRole('dialog', { name: 'Import contract' }),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue('Shared')).toBeInTheDocument();
    expect(useContractsStore.getState().contracts).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: 'Import contract' }));
    const added = useContractsStore.getState().contracts[1]!;
    expect(added.name).toBe('Shared');
    expect(pushMock).toHaveBeenCalledWith(`/?c=${added.id}`);
  });

  it('one already-saved contract → opens it', async () => {
    const user = setup([item('Mine again', 'A')]);
    await user.click(screen.getByRole('button', { name: 'start' }));
    expect(
      await screen.findByText('Already saved — opening'),
    ).toBeInTheDocument();
    expect(pushMock).toHaveBeenCalledWith('/?c=saved');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('several contracts → the review list', async () => {
    const user = setup([item('One', 'b'), item('Two', 'c')]);
    await user.click(screen.getByRole('button', { name: 'start' }));
    expect(
      await screen.findByRole('dialog', { name: 'Import 2 contracts' }),
    ).toBeInTheDocument();
  });

  it('file picker → parses the export and opens the review', async () => {
    const user = setup();
    const bundle = toShareBundle([
      { ...saved, id: 'x', name: 'F1', address: `0x${'d'.repeat(40)}` },
      { ...saved, id: 'y', name: 'F2', address: `0x${'e'.repeat(40)}` },
    ]);
    const input = screen.getByLabelText('Import contract export file');
    await user.upload(
      input,
      new File([JSON.stringify(bundle)], 'export.json', {
        type: 'application/json',
      }),
    );
    expect(
      await screen.findByRole('dialog', { name: 'Import 2 contracts' }),
    ).toBeInTheDocument();
  });

  it('invalid file → error toast', async () => {
    const user = setup();
    await user.upload(
      screen.getByLabelText('Import contract export file'),
      new File(['{"nope":true}'], 'bad.json', { type: 'application/json' }),
    );
    await waitFor(() =>
      expect(screen.getByText('Import failed')).toBeInTheDocument(),
    );
    expect(screen.getByText(/not a valid contract export/)).toBeInTheDocument();
  });
});
