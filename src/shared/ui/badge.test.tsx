import { describe, it, expect } from 'vitest';
import { chainInitial } from './badge';

describe('chainInitial', () => {
  it("uses the chain name's first letter, not the native symbol", () => {
    // Abstract's native symbol (and catalog `short`) is ETH
    expect(chainInitial({ name: 'Abstract', short: 'ETH', color: '' })).toBe(
      'A',
    );
    expect(
      chainInitial({ name: 'Robinhood Chain', short: 'ETH', color: '' }),
    ).toBe('R');
    expect(chainInitial({ name: 'Ethereum', short: 'ETH', color: '' })).toBe(
      'E',
    );
    expect(chainInitial({ name: '0G Mainnet', short: '0G', color: '' })).toBe(
      '0',
    );
  });
});
