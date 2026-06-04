import { test, expect, type Page } from "@playwright/test";
import { deployArtifact, loadArtifact } from "../src/test/anvil";

const ANVIL_URL = "http://127.0.0.1:8545";
const APP_DB = "evm-cockpit";

// Anvil account #0 — the mock connector auto-connects as this address.
const ACCOUNT_0_TRUNC = "0xf39F…2266";

/**
 * Navigate to the app on a clean slate: open the origin, drop the app's
 * IndexedDB (must run on the origin, so goto first), then reload so the
 * zustand-persisted stores rehydrate empty.
 */
async function freshApp(page: Page): Promise<void> {
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

test.describe("smoke journey", () => {
  // Each spec run reuses the global Anvil; deploy a fresh token per file so the
  // contract address is unique and state is isolated enough for the journey.
  let tokenAddress: `0x${string}`;
  let abiJson: string;

  test.beforeAll(async () => {
    tokenAddress = await deployArtifact(ANVIL_URL, "TestToken", [
      "Cockpit Token",
      "CKPT",
      1_000_000n,
    ]);
    abiJson = JSON.stringify(loadArtifact("TestToken").abi);
  });

  test.beforeEach(async ({ page }) => {
    await freshApp(page);
  });

  test("add a contract and read real properties off Anvil", async ({
    page,
  }) => {
    // Empty state.
    await expect(page.getByText("No contracts yet")).toBeVisible();

    // Open the Add modal.
    await page.getByRole("button", { name: "Add your first contract" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    // Name + chain + address.
    await dialog.getByPlaceholder("My Contract").fill("E2E Token");
    await dialog
      .getByRole("combobox")
      .selectOption({ label: "Localhost · Anvil · 31337" });
    await dialog
      .getByPlaceholder("0x0000000000000000000000000000000000000000")
      .fill(tokenAddress);

    // Switch to manual ABI and paste the artifact ABI (fill, not type — JSON).
    await dialog.getByRole("tab", { name: "Paste manually" }).click();
    await dialog.locator("textarea").fill(abiJson);

    // Submit.
    await dialog.getByRole("button", { name: "Add contract" }).click();
    await expect(dialog).toBeHidden();

    // Sidebar lists it; open it.
    const sidebarItem = page.getByRole("button", { name: /E2E Token/ });
    await expect(sidebarItem).toBeVisible();
    await sidebarItem.click();

    // Properties section renders REAL multicall reads against Anvil.
    await expect(
      page.getByRole("heading", { name: "Properties" }),
    ).toBeVisible();
    // String property values render quoted (e.g. "Cockpit Token").
    await expect(page.getByText('"Cockpit Token"')).toBeVisible();
    await expect(page.getByText('"CKPT"')).toBeVisible();

    // Mock wallet auto-connected: TopBar shows the truncated account #0 address.
    await expect(page.getByText(ACCOUNT_0_TRUNC)).toBeVisible();
  });
});
