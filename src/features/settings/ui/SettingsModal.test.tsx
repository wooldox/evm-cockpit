import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AppShellProvider } from '@/widgets/app-shell/AppShellProvider';
import { useSettingsStore } from '@/entities/settings/model/store';
import { SettingsModal } from './SettingsModal';

// next/navigation is required transitively by some imports
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

function renderModal(onClose = vi.fn()) {
  return render(
    <AppShellProvider>
      <SettingsModal onClose={onClose} />
    </AppShellProvider>,
  );
}

describe('SettingsModal', () => {
  beforeEach(() => {
    // Reset settings store to known defaults
    useSettingsStore.setState({
      density: 'comfortable',
      etherscanApiKey: '',
      rpcOverrides: {},
    });
    // Reset theme attribute so tests start clean
    document.documentElement.removeAttribute('data-theme');
  });

  // ── 1. Density ────────────────────────────────────────────────────────────

  it("clicking Compact segment updates density to 'compact' in store", async () => {
    renderModal();

    // Modal uses createPortal + useEffect mount gate → wait for dialog
    await screen.findByRole('dialog');

    // Click the "Compact" segment tab inside the Density field
    await userEvent.click(screen.getByRole('tab', { name: /compact/i }));

    expect(useSettingsStore.getState().density).toBe('compact');
  });

  // ── 2. Etherscan API key ──────────────────────────────────────────────────

  it('typing in the Etherscan key input updates etherscanApiKey in store', async () => {
    renderModal();

    await screen.findByRole('dialog');

    // The input has placeholder "Optional · stored in your browser only"
    const keyInput = screen.getByPlaceholderText(/optional/i);
    await userEvent.clear(keyInput);
    await userEvent.type(keyInput, 'my-api-key');

    expect(useSettingsStore.getState().etherscanApiKey).toBe('my-api-key');
  });

  // ── 3. Theme toggle ───────────────────────────────────────────────────────

  it('clicking Light segment sets data-theme=light on documentElement', async () => {
    // Start with dark theme explicitly set
    document.documentElement.setAttribute('data-theme', 'dark');

    renderModal();

    await screen.findByRole('dialog');

    // Click the "Light" segment tab inside the Theme field
    await userEvent.click(screen.getByRole('tab', { name: /light/i }));

    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
