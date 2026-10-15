import 'fake-indexeddb/auto';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider } from '@/shared/ui';
import { useContractsStore } from '@/entities/contract/model/store';
import { useSettingsStore } from '@/entities/settings/model/store';
import { erc20Abi } from '@/shared/lib/abi/fixtures';
import { AddContractModal } from './AddContractModal';

// next/navigation is used transitively by some imports
vi.mock('next/navigation', () => ({ usePathname: () => '/' }));

const VALID_ADDRESS = '0x1234567890123456789012345678901234567890';
const VALID_ABI =
  '[{"type":"function","name":"x","inputs":[],"outputs":[],"stateMutability":"view"}]';

function renderModal(onClose = vi.fn()) {
  return render(
    <ToastProvider>
      <AddContractModal onClose={onClose} />
    </ToastProvider>,
  );
}

describe('AddContractModal', () => {
  beforeEach(() => {
    useContractsStore.setState({ contracts: [] });
    useSettingsStore.setState({ etherscanApiKey: '' });
  });

  // ── 0. Default ABI-source tab follows the Etherscan key ──────────────────

  it('defaults to Paste manually when no Etherscan key is set', async () => {
    useSettingsStore.setState({ etherscanApiKey: '' });
    renderModal();
    await screen.findByRole('dialog');
    expect(
      screen.getByRole('tab', { name: /paste manually/i }),
    ).toHaveAttribute('aria-selected', 'true');
    expect(
      screen.getByRole('tab', { name: /auto-fetch from explorer/i }),
    ).toHaveAttribute('aria-selected', 'false');
  });

  it('defaults to Auto-fetch when an Etherscan key is set', async () => {
    useSettingsStore.setState({ etherscanApiKey: 'ABC123' });
    renderModal();
    await screen.findByRole('dialog');
    expect(
      screen.getByRole('tab', { name: /auto-fetch from explorer/i }),
    ).toHaveAttribute('aria-selected', 'true');
  });

  // ── 1. Manual mode: invalid ABI shows error and disables submit ──────────

  it('manual mode: invalid JSON ABI shows error and disables submit', async () => {
    const onClose = vi.fn();
    renderModal(onClose);

    // Modal uses createPortal + useEffect mount gate → wait for it
    await screen.findByRole('dialog');

    // Switch to manual ABI mode (the Segment tab)
    await userEvent.click(screen.getByRole('tab', { name: /paste manually/i }));

    // Fill name
    await userEvent.type(
      screen.getByPlaceholderText(/my contract/i),
      'TestContract',
    );

    // Fill a valid Ethereum address (42 chars)
    await userEvent.type(
      screen.getByPlaceholderText(/0x0000000000000000000000000000000000000000/),
      VALID_ADDRESS,
    );

    // Type invalid JSON into the ABI textarea
    // Use paste to avoid userEvent treating { as a key descriptor
    const textarea = screen.getByPlaceholderText(/\[ \{ "type"/i);
    await userEvent.click(textarea);
    await userEvent.paste('not valid json {');

    // ABI error message should appear
    expect(screen.getByText(/abi must be valid json/i)).toBeInTheDocument();

    // Submit button ("Add contract") should be disabled
    const submitBtn = screen.getByRole('button', { name: /add contract/i });
    expect(submitBtn).toBeDisabled();
  });

  // ── 2. Manual happy path: valid inputs → store gains entry, onClose fires ─

  it('manual mode: valid inputs → adds contract with source:manual, fires onClose', async () => {
    const onClose = vi.fn();
    renderModal(onClose);

    await screen.findByRole('dialog');

    // Switch to manual mode
    await userEvent.click(screen.getByRole('tab', { name: /paste manually/i }));

    // Fill name
    await userEvent.type(
      screen.getByPlaceholderText(/my contract/i),
      'MyToken',
    );

    // Fill valid address
    await userEvent.type(
      screen.getByPlaceholderText(/0x0000000000000000000000000000000000000000/),
      VALID_ADDRESS,
    );

    // Paste valid ABI JSON array into textarea
    // userEvent.type interprets { and [ as key descriptors — use paste instead
    const textarea = screen.getByPlaceholderText(/\[ \{ "type"/i);
    await userEvent.click(textarea);
    await userEvent.paste(VALID_ABI);

    // Submit button should now be enabled
    const submitBtn = screen.getByRole('button', { name: /add contract/i });
    expect(submitBtn).not.toBeDisabled();

    // Click submit
    await userEvent.click(submitBtn);

    // Store should have one contract with source: "manual"
    const contracts = useContractsStore.getState().contracts;
    expect(contracts).toHaveLength(1);
    const added = contracts[0]!;
    expect(added.source).toBe('manual');
    expect(added.name).toBe('MyToken');
    expect(added.address).toBe(VALID_ADDRESS);

    // onClose should have been called
    expect(onClose).toHaveBeenCalledOnce();
  });

  // ── 2b. Chain combobox: search + select changes the chain on the saved contract ──

  it('chain combobox: search and select sets the chain on the added contract', async () => {
    const onClose = vi.fn();
    renderModal(onClose);
    await screen.findByRole('dialog');

    await userEvent.click(screen.getByRole('tab', { name: /paste manually/i }));
    await userEvent.type(screen.getByPlaceholderText(/my contract/i), 'OnBase');
    await userEvent.type(
      screen.getByPlaceholderText(/0x0000000000000000000000000000000000000000/),
      VALID_ADDRESS,
    );
    const textarea = screen.getByPlaceholderText(/\[ \{ "type"/i);
    await userEvent.click(textarea);
    await userEvent.paste(VALID_ABI);

    // Open the chain combobox, search by exact id, pick Base (8453).
    await userEvent.click(screen.getByRole('combobox', { name: 'Chain' }));
    await userEvent.type(
      screen.getByRole('textbox', { name: /search networks/i }),
      '8453',
    );
    const listbox = screen.getByRole('listbox');
    await userEvent.click(
      within(listbox).getByRole('option', { name: /Base8453$/ }),
    );
    // Popover closed and the trigger reflects the new chain.
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(screen.getByRole('combobox', { name: 'Chain' })).toHaveTextContent(
      'Base',
    );

    await userEvent.click(
      screen.getByRole('button', { name: /add contract/i }),
    );

    const added = useContractsStore.getState().contracts[0]!;
    expect(added.chainId).toBe(8453);
  });

  it('chain combobox: Escape in the search closes the popover but not the modal', async () => {
    const onClose = vi.fn();
    renderModal(onClose);
    await screen.findByRole('dialog');

    await userEvent.click(screen.getByRole('combobox', { name: 'Chain' }));
    await userEvent.type(
      screen.getByRole('textbox', { name: /search networks/i }),
      '{Escape}',
    );

    // Popover closed…
    expect(screen.queryByRole('listbox')).toBeNull();
    // …but the modal stays open and onClose was not called.
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  // ── 3. Import mode (share link / file review) ────────────────────────────

  it('importing: prefilled "Import contract" keeps the proxy and opens it', async () => {
    const user = userEvent.setup();
    const onSaved = vi.fn();
    const proxy = {
      kind: 'eip1967' as const,
      implAddress: '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const,
      implAbi: erc20Abi,
    };
    render(
      <ToastProvider>
        <AddContractModal
          importing
          prefill={{
            name: 'Imported Token',
            chainId: 137,
            address: VALID_ADDRESS,
            abi: erc20Abi,
            source: 'sourcify',
            proxy,
          }}
          onClose={vi.fn()}
          onSaved={onSaved}
        />
      </ToastProvider>,
    );
    await screen.findByRole('dialog', { name: 'Import contract' });
    expect(screen.getByDisplayValue('Imported Token')).toBeInTheDocument();
    expect(screen.getByDisplayValue(VALID_ADDRESS)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Import contract' }));

    const saved = useContractsStore.getState().contracts[0]!;
    expect(saved).toMatchObject({
      name: 'Imported Token',
      chainId: 137,
      source: 'sourcify',
      proxy,
    });
    expect(onSaved).toHaveBeenCalledWith(saved);
  });

  it('no longer has an "Import file" button (import lives in the + menu)', async () => {
    renderModal();
    await screen.findByRole('dialog');
    expect(
      screen.queryByRole('button', { name: /import file/i }),
    ).not.toBeInTheDocument();
  });
});
