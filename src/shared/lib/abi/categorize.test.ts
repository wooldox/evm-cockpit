import { describe, it, expect } from 'vitest';
import { categorizeAbi } from './categorize';
import { erc20Abi } from './fixtures';

describe('categorizeAbi', () => {
  const c = categorizeAbi(erc20Abi);

  it('puts zero-input view/pure functions in properties', () => {
    expect(c.properties.map((f) => f.name).sort()).toEqual([
      'decimals',
      'name',
      'totalSupply',
    ]);
  });

  it('puts view/pure functions with inputs in getters', () => {
    expect(c.getters.map((f) => f.name).sort()).toEqual(['balanceOf', 'hash']);
  });

  it('puts state-changing functions in operations (including overloads and payable)', () => {
    expect(c.operations.map((f) => f.name).sort()).toEqual(
      ['deposit', 'mint', 'mint', 'transfer'].sort(),
    );
  });

  it('collects events, errors, and the constructor', () => {
    expect(c.events.map((e) => e.name)).toEqual(['Transfer']);
    expect(c.errors.map((e) => e.name)).toEqual(['InsufficientBalance']);
    expect(c.constructor?.inputs[0]?.name).toBe('supply');
  });

  it('flags fallback and receive', () => {
    expect(c.hasFallback).toBe(true);
    expect(c.hasReceive).toBe(true);
  });

  it('handles an empty ABI without throwing', () => {
    const empty = categorizeAbi([]);
    expect(empty.properties).toEqual([]);
    expect(empty.hasFallback).toBe(false);
  });
});
