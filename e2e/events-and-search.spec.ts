import { test, expect } from '@playwright/test';
import { foundry } from 'viem/chains';
import { clientsFor } from '../src/test/anvil';
import {
  freshApp,
  deployToken,
  addContractViaUi,
  ANVIL_URL,
  ACCOUNT_1,
  type DeployedToken,
} from './helpers';

test.describe('events + search journeys', () => {
  let token: DeployedToken;

  test.beforeAll(async () => {
    token = await deployToken('Event Token', 'EVT');

    // Seed two real Transfer logs directly via viem (NOT through the UI). With
    // the constructor mint there are then exactly 3 Transfer events.
    const { pub, wallet } = clientsFor(ANVIL_URL);
    for (let i = 0; i < 2; i++) {
      const hash = await wallet.writeContract({
        address: token.address,
        abi: token.abi,
        functionName: 'transfer',
        args: [ACCOUNT_1, 1n * 10n ** 18n],
        account: wallet.account ?? null,
        chain: foundry,
      });
      await pub.waitForTransactionReceipt({ hash });
    }
  });

  test('fetch decoded Transfer logs into a table', async ({ page }) => {
    await freshApp(page);
    await addContractViaUi(page, {
      name: 'Event Token',
      address: token.address,
      abi: token.abi,
    });

    const events = page.getByRole('heading', { name: 'Events' });
    await events.scrollIntoViewIfNeeded();
    await expect(events).toBeVisible();

    // The event picker sorts alphabetically (Approval first), so select Transfer.
    await page
      .getByRole('combobox')
      .last()
      .selectOption({ label: 'Transfer(address,address,uint256)' });
    await page.getByRole('button', { name: 'Fetch logs' }).click();

    // constructor mint + 2 seeded transfers = 3 rows.
    const eventsTable = page.locator('table').last();
    await expect(eventsTable.locator('tbody tr')).toHaveCount(3);
    await expect(page.getByText(/3 logs ·/)).toBeVisible();
  });

  test('toolbar filter narrows function cards and reports no-match', async ({
    page,
  }) => {
    await freshApp(page);
    await addContractViaUi(page, {
      name: 'Event Token',
      address: token.address,
      abi: token.abi,
    });

    const filter = page.getByPlaceholder(
      'Filter functions across all sections…',
    );

    // "transfer" keeps transfer/transferFrom, drops mint.
    await filter.fill('transfer');
    await expect(
      page.locator('[data-cc="fn-head"]', { hasText: 'transfer' }).first(),
    ).toBeVisible();
    await expect(
      page.locator('[data-cc="fn-head"]', { hasText: 'mint' }),
    ).toHaveCount(0);

    // A non-matching query shows the empty-state message.
    await filter.fill('zzzz');
    await expect(page.getByText('No functions match "zzzz"')).toBeVisible();
  });
});
