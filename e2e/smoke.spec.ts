import { test, expect } from '@playwright/test';
import {
  freshApp,
  deployToken,
  addContractViaUi,
  ACCOUNT_0_TRUNC,
  type DeployedToken,
} from './helpers';

test.describe('smoke journey', () => {
  // Each spec run reuses the global Anvil; deploy a fresh token per file so the
  // contract address is unique and state is isolated enough for the journey.
  let token: DeployedToken;

  test.beforeAll(async () => {
    token = await deployToken('Cockpit Token', 'CKPT');
  });

  test.beforeEach(async ({ page }) => {
    await freshApp(page);
  });

  test('add a contract and read real properties off Anvil', async ({
    page,
  }) => {
    // Empty state.
    await expect(page.getByText('No contracts yet')).toBeVisible();

    await addContractViaUi(page, {
      name: 'E2E Token',
      address: token.address,
      abi: token.abi,
    });

    // Properties section renders REAL multicall reads against Anvil.
    await expect(
      page.getByRole('heading', { name: 'Properties' }),
    ).toBeVisible();
    // String property values render quoted (e.g. "Cockpit Token").
    await expect(page.getByText('"Cockpit Token"')).toBeVisible();
    await expect(page.getByText('"CKPT"')).toBeVisible();

    // Mock wallet auto-connected: TopBar shows the truncated account #0 address.
    await expect(page.getByText(ACCOUNT_0_TRUNC)).toBeVisible();
  });
});
