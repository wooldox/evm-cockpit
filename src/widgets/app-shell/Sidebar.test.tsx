import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...p
  }: {
    href: string | object;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={typeof href === 'string' ? href : '#'} {...p}>
      {children}
    </a>
  ),
}));

import { Sidebar } from './Sidebar';
import { AppShellProvider, useAppShell } from './AppShellProvider';
import { ToastProvider } from '@/shared/ui';
import { useContractsStore } from '@/entities/contract/model/store';
import type { TContract } from '@/entities/contract/model/types';

const mk = (id: string, name: string, chainId = 1): TContract => ({
  id,
  name,
  chainId,
  address: `0x${id.padStart(40, '0')}` as `0x${string}`,
  abi: [],
  source: 'manual',
  addedAt: 0,
});

describe('Sidebar', () => {
  beforeEach(() => useContractsStore.setState({ contracts: [] }));

  it('shows the empty state with no contracts', () => {
    render(
      <ToastProvider>
        <AppShellProvider>
          <Sidebar />
        </AppShellProvider>
      </ToastProvider>,
    );
    expect(screen.getByText(/no saved contracts/i)).toBeInTheDocument();
  });

  it('renders a seeded contract grouped by chain', () => {
    useContractsStore.setState({ contracts: [mk('1', 'USD Coin')] });
    render(
      <ToastProvider>
        <AppShellProvider>
          <Sidebar />
        </AppShellProvider>
      </ToastProvider>,
    );
    expect(screen.getByText('USD Coin')).toBeInTheDocument();
    // Chain group header shows the chain name — chainId 1 = "Ethereum"
    // (may appear in multiple nodes: scope tab + group header)
    expect(screen.getAllByText(/ethereum/i).length).toBeGreaterThan(0);
  });

  describe('contract actions menu', () => {
    function DuplicateProbe() {
      const { addOpen, duplicating } = useAppShell();
      return addOpen && duplicating ? (
        <div data-testid="dup">{duplicating.id}</div>
      ) : null;
    }
    const renderWithProbe = () =>
      render(
        <ToastProvider>
          <AppShellProvider>
            <Sidebar />
            <DuplicateProbe />
          </AppShellProvider>
        </ToastProvider>,
      );

    it('opens from the dots trigger with all actions', async () => {
      const user = userEvent.setup();
      useContractsStore.setState({ contracts: [mk('1', 'USD Coin')] });
      renderWithProbe();

      await user.click(
        screen.getByRole('button', { name: /actions for usd coin/i }),
      );
      const items = screen.getAllByRole('menuitem').map((el) => el.textContent);
      expect(items).toEqual([
        'Edit',
        'Duplicate',
        'Share',
        'History',
        'Delete',
      ]);
    });

    it('opens as a context menu on right-click and closes on Escape', async () => {
      const user = userEvent.setup();
      useContractsStore.setState({ contracts: [mk('1', 'USD Coin')] });
      renderWithProbe();

      fireEvent.contextMenu(screen.getByText('USD Coin'));
      expect(screen.getByRole('menu')).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('Duplicate opens the add modal seeded from the contract', async () => {
      const user = userEvent.setup();
      useContractsStore.setState({ contracts: [mk('1', 'USD Coin')] });
      renderWithProbe();

      fireEvent.contextMenu(screen.getByText('USD Coin'));
      await user.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
      expect(screen.getByTestId('dup')).toHaveTextContent('1');
      expect(screen.queryByRole('menu')).not.toBeInTheDocument();
    });

    it('Delete removes the contract after confirm', async () => {
      const user = userEvent.setup();
      vi.spyOn(window, 'confirm').mockReturnValue(true);
      useContractsStore.setState({
        contracts: [mk('1', 'USD Coin'), mk('2', 'Tether')],
      });
      renderWithProbe();

      fireEvent.contextMenu(screen.getByText('USD Coin'));
      await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
      expect(useContractsStore.getState().contracts.map((c) => c.id)).toEqual([
        '2',
      ]);
    });
  });
});
