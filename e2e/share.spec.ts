import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  freshApp,
  deployToken,
  addContractViaUi,
  type DeployedToken,
} from './helpers';

test.describe('share + import journeys', () => {
  let token: DeployedToken;

  test.beforeAll(async () => {
    token = await deployToken('Share Token', 'SHR');
  });

  test('share link round-trips: dedupe in-place, fresh import elsewhere', async ({
    page,
    browser,
  }) => {
    await freshApp(page);
    await addContractViaUi(page, {
      name: 'Share Token',
      address: token.address,
      abi: token.abi,
    });

    // Open the Share modal and read the #import= link.
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    const linkInput = dialog.locator('input[readonly]');
    await expect(linkInput).toBeVisible();
    await expect(linkInput).toHaveValue(/#import=/);
    const shareUrl = await linkInput.inputValue();
    expect(shareUrl).toContain('#import=');

    // (a) Same context (contract already saved) → dedupe path.
    await page.goto(shareUrl);
    await expect(page.getByText('Already saved — opening')).toBeVisible();

    // (b) Fresh context (empty IDB) → review step, nothing added until confirmed.
    const ctx = await browser.newContext();
    const fresh = await ctx.newPage();
    await fresh.goto(shareUrl);
    const review = fresh.getByRole('dialog', { name: 'Import contract' });
    await expect(review).toBeVisible();
    await expect(review.getByPlaceholder('My Contract')).toHaveValue(
      'Share Token',
    );
    await review.getByRole('button', { name: 'Import contract' }).click();
    await expect(fresh.getByText('Contract imported')).toBeVisible();
    await expect(
      fresh.getByRole('button', { name: /Share Token/ }).first(),
    ).toBeVisible();
    await ctx.close();
  });

  test('download JSON export and re-import it via file', async ({ page }) => {
    await freshApp(page);
    await addContractViaUi(page, {
      name: 'Share Token',
      address: token.address,
      abi: token.abi,
    });

    // Download the JSON export from the Share modal.
    await page.getByRole('button', { name: 'Share', exact: true }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();

    const downloadPromise = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Download JSON' }).click();
    const download = await downloadPromise;
    const file = path.join(os.tmpdir(), `cc-share-${Date.now()}.json`);
    await download.saveAs(file);

    const json = JSON.parse(readFileSync(file, 'utf8')) as {
      v: number;
      contracts: { name: string; chainId: number; address: string }[];
    };
    expect(json.v).toBe(2);
    expect(json.contracts).toHaveLength(1);
    expect(json.contracts[0]!.name).toBe('Share Token');
    expect(json.contracts[0]!.chainId).toBe(31337);
    expect(json.contracts[0]!.address.toLowerCase()).toBe(
      token.address.toLowerCase(),
    );

    // Fresh app, then import the downloaded file (shell-level file input,
    // opened by "+" → Import from file… or the empty state's button).
    await freshApp(page);
    await page.getByLabel('Import contract export file').setInputFiles(file);
    const addDialog = page.getByRole('dialog', { name: 'Import contract' });
    await expect(addDialog).toBeVisible();

    // Fields are prefilled for review.
    await expect(addDialog.getByPlaceholder('My Contract')).toHaveValue(
      'Share Token',
    );
    await expect(
      addDialog.getByPlaceholder('0x0000000000000000000000000000000000000000'),
    ).toHaveValue(new RegExp(token.address, 'i'));

    await addDialog.getByRole('button', { name: 'Import contract' }).click();
    await expect(addDialog).toBeHidden();
    await expect(
      page.getByRole('button', { name: /Share Token/ }).first(),
    ).toBeVisible();
  });
});
