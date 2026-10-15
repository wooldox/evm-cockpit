import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock next/navigation — usePathname must be set before component imports
vi.mock('next/navigation', () => ({
  usePathname: () => '/deploy',
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// next/link renders fine under jsdom as-is (renders an <a> tag),
// but mock it explicitly to avoid any SSR/RSC edge-cases in jsdom
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string | object;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={typeof href === 'string' ? href : '#'} {...props}>
      {children}
    </a>
  ),
}));

import { AppShell } from './AppShell';

describe('AppShell', () => {
  beforeEach(() => {
    document.documentElement.setAttribute('data-theme', 'dark');
    // The current chain persists to localStorage (cc-chain) — clear it so each
    // test starts at the Ethereum default regardless of test order.
    window.localStorage.clear();
  });

  // ----------------------------------------------------------------
  // 1. Sidebar nav links
  // ----------------------------------------------------------------
  it('renders the sidebar nav as links with correct hrefs', () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );
    expect(screen.getByRole('link', { name: /deploy/i })).toHaveAttribute(
      'href',
      '/deploy',
    );
    expect(screen.getByRole('link', { name: /sign/i })).toHaveAttribute(
      'href',
      '/sign',
    );
    expect(screen.getByRole('link', { name: /history/i })).toHaveAttribute(
      'href',
      '/history',
    );
  });

  // ----------------------------------------------------------------
  // 2. Active route (pathname = /deploy → Deploy link is active)
  //    Active link gets classes "bg-elev-3 text-fg" per Sidebar.tsx
  // ----------------------------------------------------------------
  it('marks the active route (pathname=/deploy → Deploy link active)', () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );
    const deploy = screen.getByRole('link', { name: /deploy/i });
    // Active: "bg-elev-3 text-fg [&_svg]:text-read-fg"
    expect(deploy.className).toMatch(/bg-elev-3/);
    expect(deploy.className).toMatch(/text-fg/);
  });

  it('does not mark inactive routes as active', () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );
    const sign = screen.getByRole('link', { name: /sign/i });
    // Inactive link has "hover:bg-elev-3" but not a bare "bg-elev-3" (no hover: prefix)
    // Active link has both. Check the inactive link lacks "text-fg" without a prefix
    expect(sign.className).not.toMatch(/(?<![:\w])bg-elev-3(?![\w-])/);
  });

  // ----------------------------------------------------------------
  // 3. Theme toggle
  // ----------------------------------------------------------------
  it('toggles theme from dark to light when the theme button is clicked', async () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );
    // TopBar renders: <button title="Toggle theme" ...>
    await userEvent.click(
      screen.getByRole('button', { name: /toggle theme/i }),
    );
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });

  it('toggles theme back to dark on a second click', async () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );
    const btn = screen.getByRole('button', { name: /toggle theme/i });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
  });

  // ----------------------------------------------------------------
  // 4. Chain selector — opens dropdown and switches chain
  //    Default: Ethereum (id=1). CHAIN_LIST[1] = Base.
  // ----------------------------------------------------------------
  it('opens the chain selector dropdown on trigger click', async () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );
    // The trigger button shows the current chain name: "Ethereum"
    const trigger = screen.getByRole('button', { name: /ethereum/i });
    await userEvent.click(trigger);
    // Dropdown appears: the searchable list with a "Network" heading.
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(screen.getByText('Network')).toBeInTheDocument();
  });

  it('switches the current chain when a different chain is selected', async () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );

    // Open the chain selector
    const trigger = screen.getByRole('button', { name: /ethereum/i });
    await userEvent.click(trigger);

    // Narrow the searchable list to Base via its numeric id, then pick it.
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

    // Trigger now shows "Base"
    expect(screen.getByRole('button', { name: /base/i })).toBeInTheDocument();
    // Ethereum trigger is gone from the topbar
    expect(
      screen.queryAllByRole('button', { name: /^ethereum$/i }),
    ).toHaveLength(0);
  });

  it("add-contract modal defaults its chain to the app's current chain", async () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );

    // Switch the app chain to Base first
    await userEvent.click(screen.getByRole('button', { name: /ethereum/i }));
    await userEvent.type(
      screen.getByRole('textbox', { name: /search networks/i }),
      '8453',
    );
    const baseOption = screen.getAllByRole('option').find((el) => {
      const name = within(el).queryByText('Base');
      return name?.tagName === 'SPAN' && el.textContent?.includes('8453');
    });
    await userEvent.click(baseOption!);

    // Open the add-contract modal — its chain combobox must show Base, not Ethereum
    await userEvent.click(
      screen.getByRole('button', { name: 'Add or import contracts' }),
    );
    await userEvent.click(
      screen.getByRole('menuitem', { name: 'Add contract' }),
    );
    const combobox = await screen.findByRole('combobox');
    expect(combobox).toHaveTextContent(/base/i);
    expect(combobox).not.toHaveTextContent(/ethereum/i);
  });

  // ----------------------------------------------------------------
  // 5. Children rendered in main content area
  // ----------------------------------------------------------------
  it('renders children in the main content area', () => {
    render(
      <AppShell>
        <div>hello-content</div>
      </AppShell>,
    );
    const main = screen.getByRole('main');
    expect(within(main).getByText('hello-content')).toBeInTheDocument();
  });
});
