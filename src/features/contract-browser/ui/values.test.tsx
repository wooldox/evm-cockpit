import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { keccak256, toHex } from 'viem';
import { useValueViewStore } from '@/entities/value-view/model/store';
import { TypedValue, ParamInput, ResultValue } from './values';

// jsdom has no real clipboard — provide a mock before each test
beforeEach(() => {
  // defineProperty: userEvent.setup() swaps in a getter-only clipboard.
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

// ── TypedValue ───────────────────────────────────────────────────────────────

describe('TypedValue', () => {
  it('bigint: formats with thousands separators', () => {
    render(<TypedValue type="uint256" value={1500000n} />);
    expect(screen.getByText('1,500,000')).toBeInTheDocument();
  });

  it('bigint long: shows compact raw as Copyable alongside formatted value', () => {
    // 13-digit number — length > 12 → shows Copyable
    render(<TypedValue type="uint256" value={1234567890123n} />);
    expect(screen.getByText('1,234,567,890,123')).toBeInTheDocument();
    // raw ≤ 16 digits is shown in full next to the formatted value
    expect(screen.getByText('1234567890123')).toBeInTheDocument();
  });

  it('address: renders truncated form via Address short', () => {
    const addr = '0x4E639304D9229AF411020C45b6b4c0ac105225c4';
    render(<TypedValue type="address" value={addr} />);
    // trunc(addr, 6) = "0x4E6393…5225c4"
    expect(screen.getByText(/0x4E6393.*5225c4/)).toBeInTheDocument();
  });

  it('address: includes explorer link when chainId resolves to mainnet', () => {
    const addr = '0x4E639304D9229AF411020C45b6b4c0ac105225c4';
    render(<TypedValue type="address" value={addr} chainId={1} />);
    const link = screen.getByTitle(/view on explorer/i);
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining(`/address/${addr}`),
    );
  });

  it('address: omits explorer link when chainId is absent', () => {
    const addr = '0x4E639304D9229AF411020C45b6b4c0ac105225c4';
    render(<TypedValue type="address" value={addr} />);
    expect(screen.queryByTitle(/view on explorer/i)).toBeNull();
  });

  it('bool true → ✓ success style', () => {
    render(<TypedValue type="bool" value={true} />);
    const el = screen.getByText(/✓ true/);
    expect(el).toHaveClass('text-success-fg');
  });

  it('bool false → ✗ danger style', () => {
    render(<TypedValue type="bool" value={false} />);
    const el = screen.getByText(/✗ false/);
    expect(el).toHaveClass('text-danger-fg');
  });

  it('string → quoted in success tone', () => {
    render(<TypedValue type="string" value="hello" />);
    expect(screen.getByText(/"hello"/)).toBeInTheDocument();
    expect(screen.getByText(/"hello"/)).toHaveClass('text-success-fg');
  });

  it('object/tuple → renders stringified JSON and CopyBtn copies compact JSON', async () => {
    render(<TypedValue type="tuple" value={{ a: 1n }} />);
    // The pretty-printed JSON should appear in the pre
    expect(screen.getByText(/"a"/)).toBeInTheDocument();
    // CopyBtn copies the compact form
    await userEvent.click(screen.getByTitle(/copy/i));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('{"a":"1"}');
  });

  it('bytes fallback short value → plain mono', () => {
    render(<TypedValue type="bytes32" value="0xdeadbeef" />);
    expect(screen.getByText('0xdeadbeef')).toBeInTheDocument();
  });

  it('bytes fallback long value → Copyable with truncation', () => {
    const longHex = '0x' + 'ab'.repeat(15); // 32 chars > 20 → truncated
    render(<TypedValue type="bytes32" value={longHex} />);
    // Should render a Copyable (has a CopyBtn)
    expect(screen.getByTitle(/copy/i)).toBeInTheDocument();
  });
});

// ── ParamInput ───────────────────────────────────────────────────────────────

describe('ParamInput', () => {
  it('renders label from param.name', () => {
    render(
      <ParamInput
        param={{ name: 'recipient', type: 'address' }}
        value=""
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('recipient')).toBeInTheDocument();
  });

  it("falls back to 'arg' when name is empty", () => {
    render(
      <ParamInput
        param={{ name: '', type: 'uint256' }}
        value=""
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('arg')).toBeInTheDocument();
  });

  it('renders type chip', () => {
    render(
      <ParamInput
        param={{ name: 'amount', type: 'uint256' }}
        value=""
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('uint256')).toBeInTheDocument();
  });

  it('calls onChange when user types', async () => {
    const onChange = vi.fn();
    render(
      <ParamInput
        param={{ name: 'x', type: 'uint256' }}
        value=""
        onChange={onChange}
      />,
    );
    await userEvent.type(screen.getByRole('textbox'), '42');
    // Each keystroke fires onChange with the single typed character
    // (value is fixed at "" so e.target.value is just the new char)
    expect(onChange).toHaveBeenCalledWith('4');
    expect(onChange).toHaveBeenCalledWith('2');
    expect(onChange).toHaveBeenCalledTimes(2);
  });

  it('shows error message when error prop is set', () => {
    render(
      <ParamInput
        param={{ name: 'x', type: 'address' }}
        value="bad"
        error="must be 42 chars"
        onChange={() => {}}
      />,
    );
    expect(screen.getByText('must be 42 chars')).toBeInTheDocument();
  });

  it('uses address placeholder for address type', () => {
    render(
      <ParamInput
        param={{ name: 'to', type: 'address' }}
        value=""
        onChange={() => {}}
      />,
    );
    expect(
      screen.getByPlaceholderText('0x0000000000000000000000000000000000000000'),
    ).toBeInTheDocument();
  });

  it('uses JSON placeholder for array type', () => {
    render(
      <ParamInput
        param={{ name: 'ids', type: 'uint256[]' }}
        value=""
        onChange={() => {}}
      />,
    );
    expect(screen.getByPlaceholderText(/JSON, e\.g\./i)).toBeInTheDocument();
  });
});

// ── interpretation & "view as" ───────────────────────────────────────────────

describe('TypedValue interpretation', () => {
  beforeEach(() => useValueViewStore.setState({ views: {} }));

  it('auto-formats a timestamp-named value as a UTC date, raw kept', () => {
    render(
      <TypedValue
        type="uint32"
        value={1791828000n}
        name="GTD_START_TIMESTAMP"
      />,
    );
    expect(screen.getByText('2026-10-12 18:00:00 UTC')).toBeInTheDocument();
    expect(screen.getByText('1791828000')).toBeInTheDocument();
  });

  it('leaves an ambiguous price raw until the user picks a view, then remembers it', async () => {
    const user = userEvent.setup();
    const props = {
      type: 'uint256',
      value: 100_000_000_000_000_000n,
      name: 'GTD_PRICE',
      viewKey: 'c1|GTD_PRICE()|0',
    };
    const { unmount } = render(<TypedValue {...props} />);
    expect(screen.getByText('100,000,000,000,000,000')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'View as…' }));
    await user.click(
      screen.getByRole('menuitem', { name: 'ETH (18 decimals)' }),
    );
    expect(screen.getByText('0.1 ETH')).toBeInTheDocument();
    expect(useValueViewStore.getState().views['c1|GTD_PRICE()|0']).toEqual({
      kind: 'units',
      decimals: 18,
      symbol: 'ETH',
    });

    unmount();
    render(<TypedValue {...props} />);
    expect(screen.getByText('0.1 ETH')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'View as…' }));
    await user.click(screen.getByRole('menuitem', { name: /^Auto/ }));
    expect(screen.getByText('100,000,000,000,000,000')).toBeInTheDocument();
  });

  it('labels verified role hashes and max uint', () => {
    render(
      <>
        <TypedValue
          type="bytes32"
          value={keccak256(toHex('MINTER_ROLE'))}
          name="MINTER_ROLE"
        />
        <TypedValue type="uint256" value={(1n << 256n) - 1n} />
      </>,
    );
    expect(screen.getByText('keccak256("MINTER_ROLE")')).toBeInTheDocument();
    expect(screen.getByText('max uint256')).toBeInTheDocument();
  });

  it('ResultValue splits multiple outputs into labeled values', () => {
    render(
      <ResultValue
        fn={{
          type: 'function',
          name: 'getReserves',
          stateMutability: 'view',
          inputs: [],
          outputs: [
            { name: 'reserve0', type: 'uint112' },
            { name: 'reserve1', type: 'uint112' },
            { name: 'blockTimestampLast', type: 'uint32' },
          ],
        }}
        value={[5n, 7n, 1791828000n]}
      />,
    );
    expect(screen.getByText('reserve0')).toBeInTheDocument();
    expect(screen.getByText('2026-10-12 18:00:00 UTC')).toBeInTheDocument();
  });
});
