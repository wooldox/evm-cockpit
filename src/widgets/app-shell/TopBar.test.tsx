import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

/* ── controllable wagmi mock ───────────────────────────── */
let accountStub: { isConnected: boolean; chainId: number | undefined };
let switchChainAsync: ReturnType<typeof vi.fn>;

vi.mock('wagmi', () => ({
  useAccount: () => accountStub,
  useSwitchChain: () => ({ switchChainAsync }),
}));

// WalletButton pulls in RainbowKit/wagmi context we don't need here.
vi.mock('@/app/web3/WalletButton', () => ({
  WalletButton: () => <div data-testid="wallet-button" />,
}));

import { ToastProvider } from '@/shared/ui';
import { AppShellProvider } from './AppShellProvider';
import { useChainCatalog } from '@/entities/chain/model/catalogStore';
import { buildStaticCatalog } from '@/entities/chain/model/catalog';
import { TopBar } from './TopBar';

function resetCatalog() {
  const entries = buildStaticCatalog();
  useChainCatalog.setState({
    entries,
    byId: new Map(entries.map((c) => [c.id, c])),
    status: 'static',
  });
}

function renderTopBar() {
  render(
    <AppShellProvider>
      <ToastProvider>
        <TopBar />
      </ToastProvider>
    </AppShellProvider>,
  );
}

describe('TopBar chain selection', () => {
  beforeEach(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    localStorage.clear();
    resetCatalog();
    accountStub = { isConnected: false, chainId: undefined };
    switchChainAsync = vi.fn().mockResolvedValue(undefined);
  });

  async function selectBase() {
    await userEvent.click(screen.getByRole('button', { name: /ethereum/i }));
    // Numeric filter "8453" narrows to exactly Base.
    await userEvent.type(
      screen.getByRole('textbox', { name: /search networks/i }),
      '8453',
    );
    const baseOption = screen.getAllByRole('option').find((el) => {
      const name = within(el).queryByText('Base');
      return name?.tagName === 'SPAN' && el.textContent?.includes('8453');
    });
    expect(baseOption).toBeTruthy();
    await userEvent.click(baseOption!);
  }

  it('renders a GitHub source link that opens in a new tab', () => {
    renderTopBar();
    const link = screen.getByRole('link', { name: /github/i });
    expect(link).toHaveAttribute(
      'href',
      'https://github.com/wooldox/evm-cockpit',
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('updates the selector trigger to the picked chain (context effect)', async () => {
    renderTopBar();
    await selectBase();
    expect(screen.getByRole('button', { name: /base/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^ethereum$/i })).toBeNull();
  });

  it('does NOT call switchChainAsync when the wallet is disconnected', async () => {
    accountStub = { isConnected: false, chainId: undefined };
    renderTopBar();
    await selectBase();
    expect(switchChainAsync).not.toHaveBeenCalled();
  });

  it('calls switchChainAsync with the id when connected on a different chain', async () => {
    accountStub = { isConnected: true, chainId: 1 };
    renderTopBar();
    await selectBase();
    expect(switchChainAsync).toHaveBeenCalledWith({ chainId: 8453 });
  });

  it('does NOT call switchChainAsync when already on the target chain', async () => {
    accountStub = { isConnected: true, chainId: 8453 };
    renderTopBar();
    await selectBase();
    expect(switchChainAsync).not.toHaveBeenCalled();
  });

  it('swallows a switchChainAsync rejection (no unhandled)', async () => {
    accountStub = { isConnected: true, chainId: 1 };
    switchChainAsync = vi.fn().mockRejectedValue(new Error('user rejected'));
    renderTopBar();
    await selectBase();
    expect(switchChainAsync).toHaveBeenCalledWith({ chainId: 8453 });
    // If the rejection were unhandled the test runner would flag it.
  });
});
