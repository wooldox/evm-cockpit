import { describe, it, expect } from 'vitest';
import { keccak256, toHex } from 'viem';
import {
  autoIntView,
  bytesText,
  formatDuration,
  formatInt,
  formatRelative,
  nameWords,
  roleHashLabel,
  stringKind,
  uintMaxLabel,
} from './interpret';

describe('nameWords', () => {
  it.each([
    ['PUBLIC_START_TIMESTAMP', ['public', 'start', 'timestamp']],
    ['maxFeeBPS', ['max', 'fee', 'bps']],
    ['expiresAt', ['expires', 'at']],
    ['priceInWei', ['price', 'in', 'wei']],
    ['candidate', ['candidate']],
  ])('%s', (name, words) => expect(nameWords(name)).toEqual(words));
});

describe('autoIntView', () => {
  const ts = 1_791_828_000n; // 2026-10-12

  it('dates need BOTH a time-like name and a plausible timestamp', () => {
    expect(autoIntView(ts, { name: 'GTD_START_TIMESTAMP' })?.view).toEqual({
      kind: 'date',
    });
    expect(autoIntView(ts, { name: 'createdAt' })?.view.kind).toBe('date');
    expect(autoIntView(ts * 1000n, { name: 'deadline' })?.view.kind).toBe(
      'dateMs',
    );
    // plausible value, but the name says nothing about time
    expect(autoIntView(ts, { name: 'GTD_PRICE' })).toBeNull();
    // time-like name, implausible value (a block number / small count)
    expect(autoIntView(19_000_000n, { name: 'startTime' })).toBeNull();
    // "date" inside a word isn't the word "date"
    expect(autoIntView(ts, { name: 'candidateVotes' })).toBeNull();
    expect(autoIntView(ts, { name: 'format' })).toBeNull();
  });

  it('never guesses units for ambiguous price/fee names', () => {
    expect(
      autoIntView(100_000_000_000_000_000n, { name: 'GTD_PRICE' }),
    ).toBeNull();
    expect(autoIntView(250n, { name: 'fee' })).toBeNull();
  });

  it('uses the contract decimals only for standard ERC-20 amount functions', () => {
    const token = { decimals: 6, symbol: 'USDC' };
    expect(
      autoIntView(1n, { fnName: 'totalSupply', name: 'totalSupply', token })
        ?.view,
    ).toEqual({ kind: 'units', decimals: 6, symbol: 'USDC' });
    expect(autoIntView(1n, { fnName: 'MAX_SUPPLY', token })).toBeNull();
    // NFT: no decimals → balanceOf stays a count
    expect(autoIntView(3n, { fnName: 'balanceOf' })).toBeNull();
  });

  it('explicit unit names', () => {
    expect(
      autoIntView(1n, { name: 'mintPriceWei', nativeSymbol: 'ETH' })?.view,
    ).toEqual({ kind: 'units', decimals: 18, symbol: 'ETH' });
    expect(autoIntView(250n, { name: 'royaltyBps' })?.view.kind).toBe('bps');
    expect(autoIntView(604_800n, { name: 'vestingDuration' })?.view.kind).toBe(
      'duration',
    );
    // "period"/"delay" are often in blocks (OZ Governor) — not auto
    expect(autoIntView(50_400n, { name: 'votingPeriod' })).toBeNull();
  });
});

describe('formatInt', () => {
  it('formats each view exactly', () => {
    expect(formatInt(100_000_000_000_000_000n, { kind: 'raw' }).text).toBe(
      '100,000,000,000,000,000',
    );
    expect(
      formatInt(100_000_000_000_000_000n, {
        kind: 'units',
        decimals: 18,
        symbol: 'ETH',
      }).text,
    ).toBe('0.1 ETH');
    expect(
      formatInt(48_181_840_960_757_645n, { kind: 'units', decimals: 6 }).text,
    ).toBe('48,181,840,960.757645');
    expect(formatInt(1_791_828_000n, { kind: 'date' }).text).toBe(
      '2026-10-12 18:00:00 UTC',
    );
    expect(formatInt(250n, { kind: 'bps' }).text).toBe('2.5%');
    expect(formatInt(255n, { kind: 'hex' }).text).toBe('0xff');
    expect(formatInt(10n ** 30n, { kind: 'date' }).text).toBe(
      'out of date range',
    );
  });

  it('durations and relative time', () => {
    expect(formatDuration(0n)).toBe('0s');
    expect(formatDuration(604_800n + 7_200n + 5n)).toBe('7d 2h 5s');
    expect(formatRelative(3 * 86_400_000, 0)).toBe('in 3d');
    expect(formatRelative(0, 5 * 3_600_000)).toBe('5h ago');
  });
});

describe('annotations', () => {
  it('uintMaxLabel', () => {
    expect(uintMaxLabel('uint256', (1n << 256n) - 1n)).toBe('max uint256');
    expect(uintMaxLabel('uint8', 255n)).toBeNull();
    expect(uintMaxLabel('uint256', 5n)).toBeNull();
  });

  it('roleHashLabel verifies by recomputing the hash', () => {
    const h = keccak256(toHex('MINTER_ROLE'));
    expect(roleHashLabel('MINTER_ROLE', h)).toBe('keccak256("MINTER_ROLE")');
    expect(roleHashLabel('BURNER_ROLE', h)).toBeNull();
  });

  it('bytesText needs printable ASCII followed by zero padding', () => {
    expect(bytesText(`0x555344${'00'.repeat(29)}`)).toBe('USD');
    expect(bytesText(keccak256('0x01'))).toBeNull();
    expect(bytesText(`0x${'00'.repeat(32)}`)).toBeNull();
  });

  it('stringKind', () => {
    const json = btoa(JSON.stringify({ name: 'X' }));
    expect(stringKind(`data:application/json;base64,${json}`)).toEqual({
      kind: 'json',
      json: '{\n  "name": "X"\n}',
    });
    expect(stringKind('ipfs://Qm123/1.json')).toEqual({
      kind: 'link',
      href: 'https://ipfs.io/ipfs/Qm123/1.json',
    });
    expect(stringKind('hello')).toBeNull();
  });
});
