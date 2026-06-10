import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Copyable, Address } from './copyable';

// jsdom has no real clipboard — provide a mock before each test
beforeEach(() => {
  Object.assign(navigator, {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe('Copyable / Address', () => {
  it('copies the raw value when the copy control is clicked', async () => {
    render(<Copyable value="0xABCDEF1234" />);
    // CopyBtn uses title="Copy" (no aria-label), so query by title
    await userEvent.click(screen.getByTitle(/copy/i));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('0xABCDEF1234');
  });

  it('displays the display prop instead of raw value when provided', () => {
    render(<Copyable value="0xABCDEF1234" display="Custom Label" />);
    expect(screen.getByText('Custom Label')).toBeInTheDocument();
  });

  it('Address renders the full address when short is false', () => {
    const addr = '0x4E639304D9229AF411020C45b6b4c0ac105225c4';
    render(<Address value={addr} />);
    expect(screen.getByText(addr)).toBeInTheDocument();
  });

  it('Address renders truncated form when short=true', () => {
    // trunc(addr, 6) = addr.slice(0, 8) + "…" + addr.slice(-6)
    // = "0x4E6393" + "…" + "5225c4" = "0x4E6393…5225c4"
    render(
      <Address value="0x4E639304D9229AF411020C45b6b4c0ac105225c4" short />,
    );
    expect(screen.getByText('0x4E6393…5225c4')).toBeInTheDocument();
  });

  it('Address copies the full raw value even when short=true', async () => {
    const addr = '0x4E639304D9229AF411020C45b6b4c0ac105225c4';
    render(<Address value={addr} short />);
    await userEvent.click(screen.getByTitle(/copy/i));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(addr);
  });
});
