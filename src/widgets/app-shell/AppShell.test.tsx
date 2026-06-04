import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// Mock next/navigation — usePathname must be set before component imports
vi.mock("next/navigation", () => ({
  usePathname: () => "/deploy",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

// next/link renders fine under jsdom as-is (renders an <a> tag),
// but mock it explicitly to avoid any SSR/RSC edge-cases in jsdom
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    ...props
  }: {
    href: string | object;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={typeof href === "string" ? href : "#"} {...props}>
      {children}
    </a>
  ),
}));

import { AppShell } from "./AppShell";

describe("AppShell", () => {
  beforeEach(() => {
    document.documentElement.setAttribute("data-theme", "dark");
  });

  // ----------------------------------------------------------------
  // 1. Sidebar nav links
  // ----------------------------------------------------------------
  it("renders the sidebar nav as links with correct hrefs", () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );
    expect(screen.getByRole("link", { name: /deploy/i })).toHaveAttribute(
      "href",
      "/deploy",
    );
    expect(screen.getByRole("link", { name: /sign/i })).toHaveAttribute(
      "href",
      "/sign",
    );
    expect(screen.getByRole("link", { name: /history/i })).toHaveAttribute(
      "href",
      "/history",
    );
  });

  // ----------------------------------------------------------------
  // 2. Active route (pathname = /deploy → Deploy link is active)
  //    Active link gets classes "bg-elev-3 text-fg" per Sidebar.tsx
  // ----------------------------------------------------------------
  it("marks the active route (pathname=/deploy → Deploy link active)", () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );
    const deploy = screen.getByRole("link", { name: /deploy/i });
    // Active: "bg-elev-3 text-fg [&_svg]:text-read-fg"
    expect(deploy.className).toMatch(/bg-elev-3/);
    expect(deploy.className).toMatch(/text-fg/);
  });

  it("does not mark inactive routes as active", () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );
    const sign = screen.getByRole("link", { name: /sign/i });
    // Inactive link has "hover:bg-elev-3" but not a bare "bg-elev-3" (no hover: prefix)
    // Active link has both. Check the inactive link lacks "text-fg" without a prefix
    expect(sign.className).not.toMatch(/(?<![:\w])bg-elev-3(?![\w-])/);
  });

  // ----------------------------------------------------------------
  // 3. Theme toggle
  // ----------------------------------------------------------------
  it("toggles theme from dark to light when the theme button is clicked", async () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );
    // TopBar renders: <button title="Toggle theme" ...>
    await userEvent.click(
      screen.getByRole("button", { name: /toggle theme/i }),
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("toggles theme back to dark on a second click", async () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );
    const btn = screen.getByRole("button", { name: /toggle theme/i });
    await userEvent.click(btn);
    await userEvent.click(btn);
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
  });

  // ----------------------------------------------------------------
  // 4. Chain selector — opens dropdown and switches chain
  //    Default: Ethereum (id=1). CHAIN_LIST[1] = Base.
  // ----------------------------------------------------------------
  it("opens the chain selector dropdown on trigger click", async () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );
    // The trigger button shows the current chain name: "Ethereum"
    const trigger = screen.getByRole("button", { name: /ethereum/i });
    await userEvent.click(trigger);
    // Dropdown appears: "Network" heading
    expect(screen.getByText(/network/i)).toBeInTheDocument();
  });

  it("switches the current chain when a different chain is selected", async () => {
    render(
      <AppShell>
        <div>content</div>
      </AppShell>,
    );

    // Open the chain selector
    const trigger = screen.getByRole("button", { name: /ethereum/i });
    await userEvent.click(trigger);

    // The dropdown lists all chains; pick "Base"
    // Multiple buttons could have text "Base" (trigger + dropdown item) — scope
    // to the dropdown container (the div with z-50/animate-pop-in classes)
    const dropdown = screen
      .getAllByRole("button", { name: /base/i })
      .find((el) => el.closest("[class*='animate-pop-in']"));
    expect(dropdown).toBeTruthy();
    await userEvent.click(dropdown!);

    // Trigger now shows "Base"
    expect(screen.getByRole("button", { name: /base/i })).toBeInTheDocument();
    // Ethereum trigger is gone from the topbar
    expect(
      screen.queryAllByRole("button", { name: /^ethereum$/i }),
    ).toHaveLength(0);
  });

  // ----------------------------------------------------------------
  // 5. Children rendered in main content area
  // ----------------------------------------------------------------
  it("renders children in the main content area", () => {
    render(
      <AppShell>
        <div>hello-content</div>
      </AppShell>,
    );
    const main = screen.getByRole("main");
    expect(within(main).getByText("hello-content")).toBeInTheDocument();
  });
});
