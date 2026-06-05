import { expect, type Page } from "@playwright/test";
import type { Abi } from "viem";
import { deployArtifact, loadArtifact } from "../src/test/anvil";

/** The global Anvil started in global-setup listens here (also baked into the app). */
export const ANVIL_URL = "http://127.0.0.1:8545";

/** App IndexedDB database name (zustand-persist + idb storage). */
const APP_DB = "evm-cockpit";

/** Anvil account #0 — the mock connector auto-connects as this address. */
export const ACCOUNT_0 =
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266" as `0x${string}`;
export const ACCOUNT_0_TRUNC = "0xf39F…2266";
/** Anvil account #1 — a convenient transfer recipient. */
export const ACCOUNT_1 =
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as `0x${string}`;

/**
 * Navigate to the app on a clean slate: open the origin, drop the app's
 * IndexedDB (must run on the origin, so goto first), then reload so the
 * zustand-persisted stores rehydrate empty.
 */
export async function freshApp(page: Page): Promise<void> {
  await page.goto("/");
  await page.evaluate(
    (db) =>
      new Promise<void>((resolve) => {
        const req = indexedDB.deleteDatabase(db);
        req.onsuccess = req.onerror = req.onblocked = () => resolve();
      }),
    APP_DB,
  );
  await page.reload();
}

export type DeployedToken = { address: `0x${string}`; abi: Abi };

/**
 * Deploy a fresh TestToken to the global Anvil and return its address + ABI.
 * Each spec deploys its own token so addresses are unique and state isolated.
 */
export async function deployToken(
  name = "Cockpit Token",
  symbol = "CKPT",
  supply: bigint = 1_000n * 10n ** 18n,
): Promise<DeployedToken> {
  const address = await deployArtifact(ANVIL_URL, "TestToken", [
    name,
    symbol,
    supply,
  ]);
  return { address, abi: loadArtifact("TestToken").abi };
}

/**
 * Drive the Add-contract modal to register a contract via the UI (manual ABI
 * paste against the Localhost · Anvil chain), then open it from the sidebar.
 */
export async function addContractViaUi(
  page: Page,
  { name, address, abi }: { name: string; address: string; abi: Abi },
): Promise<void> {
  // Open the Add modal (works from empty state or with existing contracts).
  const firstBtn = page.getByRole("button", {
    name: "Add your first contract",
  });
  if (await firstBtn.isVisible().catch(() => false)) {
    await firstBtn.click();
  } else {
    await page.getByRole("button", { name: "Add contract" }).first().click();
  }

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();

  await dialog.getByPlaceholder("My Contract").fill(name);

  // Chain combobox: open → search → pick the Localhost · Anvil option.
  // The popover renders in a body portal (escapes the modal's overflow), so
  // the search field and options are scoped to the page, not the dialog.
  await dialog.getByRole("combobox", { name: "Chain" }).click();
  await page
    .getByRole("textbox", { name: /search networks/i })
    .fill("Localhost");
  await page.getByRole("option", { name: /Localhost · Anvil/ }).click();

  await dialog
    .getByPlaceholder("0x0000000000000000000000000000000000000000")
    .fill(address);

  // Manual ABI paste (fill, not type — JSON).
  await dialog.getByRole("tab", { name: "Paste manually" }).click();
  await dialog.locator("textarea").fill(JSON.stringify(abi));

  await dialog.getByRole("button", { name: "Add contract" }).click();
  await expect(dialog).toBeHidden();

  // Sidebar lists it; open it.
  const sidebarItem = page.getByRole("button", { name: new RegExp(name) });
  await expect(sidebarItem.first()).toBeVisible();
  await sidebarItem.first().click();
}
