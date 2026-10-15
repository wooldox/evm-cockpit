import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
import { ConfirmProvider, ToastProvider } from '@/shared/ui';
import { useSidebarStore } from './model/sidebarStore';
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
        <ConfirmProvider>
          <AppShellProvider>
            <Sidebar />
          </AppShellProvider>
        </ConfirmProvider>
      </ToastProvider>,
    );
    expect(screen.getByText(/no saved contracts/i)).toBeInTheDocument();
  });

  it('renders a seeded contract grouped by chain', () => {
    useContractsStore.setState({ contracts: [mk('1', 'USD Coin')] });
    render(
      <ToastProvider>
        <ConfirmProvider>
          <AppShellProvider>
            <Sidebar />
          </AppShellProvider>
        </ConfirmProvider>
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
          <ConfirmProvider>
            <AppShellProvider>
              <Sidebar />
              <DuplicateProbe />
            </AppShellProvider>
          </ConfirmProvider>
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
        'Select',
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
      useContractsStore.setState({
        contracts: [mk('1', 'USD Coin'), mk('2', 'Tether')],
      });
      renderWithProbe();

      fireEvent.contextMenu(screen.getByText('USD Coin'));
      await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
      await user.click(screen.getByRole('button', { name: 'Delete' }));
      expect(useContractsStore.getState().contracts.map((c) => c.id)).toEqual([
        '2',
      ]);
    });
  });

  describe('collapsible chains', () => {
    beforeEach(() => {
      useSidebarStore.setState({ collapsed: [] });
      useContractsStore.setState({
        contracts: [mk('1', 'USD Coin', 1), mk('2', 'Mock USDC', 11155111)],
      });
    });

    const renderSidebar = (props: { currentId?: string } = {}) =>
      render(
        <ToastProvider>
          <ConfirmProvider>
            <AppShellProvider>
              <Sidebar {...props} />
            </AppShellProvider>
          </ConfirmProvider>
        </ToastProvider>,
      );
    const header = (name: RegExp) =>
      screen
        .getAllByRole('button', { name })
        .find((b) => b.hasAttribute('aria-expanded'))!;
    const list = (h: HTMLElement) =>
      document.getElementById(h.getAttribute('aria-controls')!)!;

    it('clicking a chain header collapses and expands its contracts', async () => {
      const user = userEvent.setup();
      renderSidebar();
      const eth = header(/ethereum/i);
      expect(eth).toHaveAttribute('aria-expanded', 'true');

      await user.click(eth);
      expect(eth).toHaveAttribute('aria-expanded', 'false');
      expect(list(eth)).toHaveAttribute('inert');
      expect(useSidebarStore.getState().collapsed).toEqual([1]);

      await user.click(eth);
      expect(eth).toHaveAttribute('aria-expanded', 'true');
      expect(list(eth)).not.toHaveAttribute('inert');
    });

    it('Alt-click collapses every chain', () => {
      renderSidebar();
      fireEvent.click(header(/ethereum/i), { altKey: true });
      expect(header(/ethereum/i)).toHaveAttribute('aria-expanded', 'false');
      expect(header(/sepolia/i)).toHaveAttribute('aria-expanded', 'false');
    });

    it('searching shows matches inside collapsed chains', async () => {
      const user = userEvent.setup();
      useSidebarStore.setState({ collapsed: [1, 11155111] });
      renderSidebar();
      await user.type(screen.getByPlaceholderText('Search contracts'), 'usd');
      expect(header(/ethereum/i)).toHaveAttribute('aria-expanded', 'true');
      expect(header(/ethereum/i)).toBeDisabled();
    });

    it('opening a contract expands its chain', async () => {
      useSidebarStore.setState({ collapsed: [1, 11155111] });
      renderSidebar({ currentId: '2' });
      // Waits for persisted state to finish loading before expanding.
      await waitFor(() =>
        expect(useSidebarStore.getState().collapsed).toEqual([1]),
      );
    });
  });

  it('"+" opens a menu with Add contract and Import from file', async () => {
    const user = userEvent.setup();
    render(
      <ToastProvider>
        <ConfirmProvider>
          <AppShellProvider>
            <Sidebar />
          </AppShellProvider>
        </ConfirmProvider>
      </ToastProvider>,
    );
    await user.click(
      screen.getByRole('button', { name: 'Add or import contracts' }),
    );
    expect(screen.getAllByRole('menuitem').map((el) => el.textContent)).toEqual(
      ['Add contract', 'Import from file…'],
    );
  });

  describe('bulk select', () => {
    beforeEach(() => {
      useSidebarStore.setState({ collapsed: [] });
      useContractsStore.setState({
        contracts: [
          mk('1', 'USD Coin', 1),
          mk('2', 'Wood', 11155111),
          mk('3', 'Water', 11155111),
          mk('4', 'Stone', 11155111),
        ],
      });
    });

    const renderSidebar = () => {
      render(
        <ToastProvider>
          <ConfirmProvider>
            <AppShellProvider>
              <Sidebar />
            </AppShellProvider>
          </ConfirmProvider>
        </ToastProvider>,
      );
      return userEvent.setup();
    };
    const row = (name: string) =>
      screen.getByRole('checkbox', { name: new RegExp(name) });
    const bar = () => screen.queryByRole('toolbar', { name: 'Bulk actions' });

    const enterVia = async (
      user: ReturnType<typeof userEvent.setup>,
      name: string,
    ) => {
      fireEvent.contextMenu(screen.getByText(name));
      await user.click(screen.getByRole('menuitem', { name: 'Select' }));
    };

    it('"Select" in the menu enters select mode with that contract checked', async () => {
      const user = renderSidebar();
      await enterVia(user, 'Wood');
      expect(row('Wood')).toHaveAttribute('aria-checked', 'true');
      expect(row('Water')).toHaveAttribute('aria-checked', 'false');
      expect(bar()).toHaveTextContent('1 selected');
      // rows toggle instead of navigating; the ⋯ triggers are gone
      await user.click(row('Water'));
      expect(bar()).toHaveTextContent('2 selected');
      expect(
        screen.queryByRole('button', { name: /actions for/i }),
      ).not.toBeInTheDocument();
    });

    it('Shift-click selects a range; the chain checkbox selects the whole chain', async () => {
      const user = renderSidebar();
      await enterVia(user, 'USD Coin');
      await user.click(row('Wood'));
      fireEvent.click(row('Stone'), { shiftKey: true });
      expect(bar()).toHaveTextContent('4 selected');

      await user.click(
        screen.getByRole('checkbox', { name: 'Select all on Sepolia' }),
      );
      expect(bar()).toHaveTextContent('1 selected');
    });

    it('Cmd/Ctrl-click enters select mode; Select all; ✕ and Escape exit', async () => {
      const user = renderSidebar();
      fireEvent.click(screen.getByText('Water'), { metaKey: true });
      expect(bar()).toHaveTextContent('1 selected');

      await user.click(screen.getByRole('button', { name: 'Select all' }));
      expect(bar()).toHaveTextContent('4 selected');
      expect(screen.getByRole('button', { name: 'Select all' })).toBeDisabled();

      await user.click(screen.getByRole('button', { name: /exit selection/i }));
      expect(bar()).not.toBeInTheDocument();

      fireEvent.click(screen.getByText('Water'), { ctrlKey: true });
      expect(bar()).toBeInTheDocument();
      await user.keyboard('{Escape}');
      expect(bar()).not.toBeInTheDocument();
    });

    it('Share opens one dialog for all selected; Delete confirms then removes them', async () => {
      const user = renderSidebar();
      await enterVia(user, 'Wood');
      await user.click(row('Water'));

      await user.click(screen.getByRole('button', { name: 'Share' }));
      expect(
        screen.getByRole('dialog', { name: 'Share 2 contracts' }),
      ).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Close' }));

      await user.click(screen.getByRole('button', { name: 'Delete' }));
      const dialog = screen.getByRole('alertdialog', {
        name: 'Delete 2 contracts?',
      });
      expect(dialog).toHaveTextContent('Wood, Water will be removed');
      await user.click(screen.getByRole('button', { name: 'Delete 2' }));
      expect(useContractsStore.getState().contracts.map((c) => c.name)).toEqual(
        ['USD Coin', 'Stone'],
      );
      expect(bar()).not.toBeInTheDocument();
    });
  });

  describe('drop to import', () => {
    function ImportProbe() {
      const { importing } = useAppShell();
      return importing ? (
        <div data-testid="importing">
          {importing.map((i) => i.name).join(',')}
        </div>
      ) : null;
    }
    const exportFile = (name: string) =>
      new File(
        [
          JSON.stringify({
            v: 1,
            name,
            chainId: 1,
            address: `0x${'b'.repeat(40)}`,
            abi: [{ type: 'function', name: 'x', inputs: [], outputs: [] }],
            source: 'manual',
          }),
        ],
        `${name}.json`,
        { type: 'application/json' },
      );

    it('shows a drop overlay for files and hands dropped exports to the review step', async () => {
      useContractsStore.setState({ contracts: [] });
      render(
        <ToastProvider>
          <ConfirmProvider>
            <AppShellProvider>
              <Sidebar />
              <ImportProbe />
            </AppShellProvider>
          </ConfirmProvider>
        </ToastProvider>,
      );
      const aside = screen.getByText(/no saved contracts/i).closest('aside')!;
      const file = exportFile('Dropped');
      const dataTransfer = { types: ['Files'], files: [file], dropEffect: '' };

      fireEvent.dragEnter(aside, { dataTransfer });
      expect(screen.getByText('Drop to import contracts')).toBeInTheDocument();

      fireEvent.drop(aside, { dataTransfer });
      expect(
        screen.queryByText('Drop to import contracts'),
      ).not.toBeInTheDocument();
      expect(await screen.findByTestId('importing')).toHaveTextContent(
        'Dropped',
      );
    });

    it('ignores non-file drags (e.g. text)', () => {
      render(
        <ToastProvider>
          <ConfirmProvider>
            <AppShellProvider>
              <Sidebar />
            </AppShellProvider>
          </ConfirmProvider>
        </ToastProvider>,
      );
      const aside = screen
        .getByPlaceholderText('Search contracts')
        .closest('aside')!;
      fireEvent.dragEnter(aside, { dataTransfer: { types: ['text/plain'] } });
      expect(
        screen.queryByText('Drop to import contracts'),
      ).not.toBeInTheDocument();
    });
  });
});
