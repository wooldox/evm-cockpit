import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  freshApp,
  deployToken,
  addContractViaUi,
  type DeployedToken,
} from "./helpers";

test.describe("share + import journeys", () => {
  let token: DeployedToken;

  test.beforeAll(async () => {
    token = await deployToken("Share Token", "SHR");
  });

  test("share link round-trips: dedupe in-place, fresh import elsewhere", async ({
    page,
    browser,
  }) => {
    await freshApp(page);
    await addContractViaUi(page, {
      name: "Share Token",
      address: token.address,
      abi: token.abi,
    });

    // Open the Share modal and read the #import= link.
    await page.getByRole("button", { name: "Share", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    const linkInput = dialog.locator("input[readonly]");
    await expect(linkInput).toBeVisible();
    await expect(linkInput).toHaveValue(/#import=/);
    const shareUrl = await linkInput.inputValue();
    expect(shareUrl).toContain("#import=");

    // (a) Same context (contract already saved) → dedupe path.
    await page.goto(shareUrl);
    await expect(page.getByText("Already saved — opening")).toBeVisible();

    // (b) Fresh context (empty IDB) → clean import path.
    const ctx = await browser.newContext();
    const fresh = await ctx.newPage();
    await fresh.goto(shareUrl);
    await expect(fresh.getByText("Contract imported")).toBeVisible();
    await expect(
      fresh.getByRole("button", { name: /Share Token/ }).first(),
    ).toBeVisible();
    await ctx.close();
  });

  test("download JSON export and re-import it via file", async ({ page }) => {
    await freshApp(page);
    await addContractViaUi(page, {
      name: "Share Token",
      address: token.address,
      abi: token.abi,
    });

    // Download the JSON export from the Share modal.
    await page.getByRole("button", { name: "Share", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();

    const downloadPromise = page.waitForEvent("download");
    await dialog.getByRole("button", { name: "Download JSON" }).click();
    const download = await downloadPromise;
    const file = path.join(os.tmpdir(), `cc-share-${Date.now()}.json`);
    await download.saveAs(file);

    const json = JSON.parse(readFileSync(file, "utf8")) as Record<
      string,
      unknown
    >;
    expect(json.v).toBe(1);
    expect(json.name).toBe("Share Token");
    expect(json.chainId).toBe(31337);
    expect(String(json.address).toLowerCase()).toBe(
      token.address.toLowerCase(),
    );

    // Fresh app, then import the downloaded file via the Add modal.
    await freshApp(page);
    await page.getByRole("button", { name: "Add your first contract" }).click();
    const addDialog = page.getByRole("dialog");
    await expect(addDialog).toBeVisible();

    await addDialog
      .getByLabel("Import contract export file")
      .setInputFiles(file);

    // Fields are prefilled for review.
    await expect(addDialog.getByPlaceholder("My Contract")).toHaveValue(
      "Share Token",
    );
    await expect(
      addDialog.getByPlaceholder("0x0000000000000000000000000000000000000000"),
    ).toHaveValue(new RegExp(token.address, "i"));

    await addDialog.getByRole("button", { name: "Add contract" }).click();
    await expect(addDialog).toBeHidden();
    await expect(
      page.getByRole("button", { name: /Share Token/ }).first(),
    ).toBeVisible();
  });
});
