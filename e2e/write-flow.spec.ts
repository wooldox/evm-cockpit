import { test, expect, type Locator, type Page } from "@playwright/test";
import {
  freshApp,
  deployToken,
  addContractViaUi,
  ACCOUNT_1,
  type DeployedToken,
} from "./helpers";

/**
 * THE product-safety journey: a write is simulated before it can be signed, and
 * Sign is hard-gated on a passing simulation. A revert-predicting simulation
 * must leave Sign visibly disabled; only a will-succeed simulation unlocks it.
 */

// The `transfer` and `mint` overloads share the param names
// `(address to, uint256 amount)`, so scope on the function NAME at the head.
const TRANSFER_HEAD = /transfer\s*\(address to, uint256 amount\)/;

/** Locate the Operations card whose head is the `transfer(address,uint256)` overload. */
function transferCard(page: Page, head: Locator): Locator {
  // The card is the nearest wrapper that contains BOTH the head and a fn-body.
  return page
    .locator("div")
    .filter({ has: head })
    .filter({ has: page.locator('[data-cc="fn-body"]') })
    .last();
}

test.describe("simulate-gated write flow", () => {
  let token: DeployedToken;

  test.beforeAll(async () => {
    token = await deployToken("Write Token", "WRT");
  });

  test("revert prediction hard-blocks Sign; a passing sim unlocks it and the send confirms", async ({
    page,
  }) => {
    await freshApp(page);
    await addContractViaUi(page, {
      name: "Write Token",
      address: token.address,
      abi: token.abi,
    });

    // Expand the transfer card via its fn-name head (NOT mint, NOT transferFrom).
    const head = page
      .locator('[data-cc="fn-head"]')
      .filter({ hasText: TRANSFER_HEAD });
    await head.click();

    const card = transferCard(page, head);
    const toInput = card.getByPlaceholder(
      "0x0000000000000000000000000000000000000000",
    );
    const amountInput = card.getByPlaceholder("0", { exact: true });
    await expect(toInput).toBeVisible();

    /* ── 1. Over-supply transfer → simulation predicts revert ───────────── */
    await toInput.fill(ACCOUNT_1);
    await amountInput.fill("2000000000000000000000000"); // way over supply
    await card.getByRole("button", { name: "Simulate" }).click();

    await expect(card.getByText("Will revert")).toBeVisible();
    await expect(card.getByText(/InsufficientBalance/)).toBeVisible();

    // *** THE core safety assertion: Sign is visible but DISABLED. ***
    const signBtn = card.getByRole("button", { name: "Sign & Send" });
    await expect(signBtn).toBeVisible();
    await expect(signBtn).toBeDisabled();
    await expect(signBtn).toHaveAttribute(
      "title",
      "Disabled — simulation predicts revert",
    );
    await expect(
      card.getByText("Sign blocked while revert is predicted"),
    ).toBeVisible();

    /* ── 2. Editing the amount invalidates the stale verdict ────────────── */
    await amountInput.fill("1000000000000000000"); // 1 token
    await expect(card.getByText("Will revert")).toBeHidden();

    /* ── 3. Passing simulation unlocks Sign; the send confirms ──────────── */
    await card.getByRole("button", { name: "Simulate" }).click();
    await expect(card.getByText("Will succeed")).toBeVisible();
    await expect(card.getByText("Est. gas")).toBeVisible();

    // The e2e config deterministically starts on mainnet, so the Sign action is
    // labelled "Switch to Localhost · Anvil & Send" — this journey exercises the
    // auto chain-switch-before-broadcast path. The specific label self-documents that.
    const sendBtn = card.getByRole("button", {
      name: /Switch to Localhost · Anvil & Send/,
    });
    await expect(sendBtn).toBeEnabled();

    await sendBtn.click();
    // Mock wallet forwards eth_sendTransaction to Anvil's unlocked account.
    await expect(card.getByText(/Confirmed in block/)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Transaction confirmed")).toBeVisible();

    /* ── 4. History records both the simulate and the write ─────────────── */
    await page.getByRole("button", { name: "History" }).first().click();
    await expect(page.getByRole("heading", { name: "History" })).toBeVisible();

    const rows = page.locator("tbody tr");
    // A simulate badge row and a write badge row, both for transfer().
    await expect(
      rows.filter({ hasText: "simulate" }).filter({ hasText: "transfer()" }),
    ).not.toHaveCount(0);
    await expect(
      rows.filter({ hasText: "write" }).filter({ hasText: "transfer()" }),
    ).not.toHaveCount(0);
  });
});
