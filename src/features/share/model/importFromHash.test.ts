import { describe, it, expect, vi } from 'vitest';
import { erc20Abi } from '@/shared/lib/abi/fixtures';
import { encodeContractShare } from '@/shared/lib/share/codec';
import type { TContract } from '@/entities/contract/model/types';
import { importFromHash } from './importFromHash';

const ADDR = '0x1234567890123456789012345678901234567890' as const;

const fixture: TContract = {
  id: 'seed-id',
  name: 'USD Coin',
  chainId: 1,
  address: ADDR,
  abi: erc20Abi,
  source: 'sourcify',
  addedAt: 0,
};

describe('importFromHash', () => {
  it('returns null when the hash has no #import= prefix', async () => {
    const addContract = vi.fn();
    expect(
      await importFromHash('', { getContracts: () => [], addContract }),
    ).toBeNull();
    expect(
      await importFromHash('#c=abc', { getContracts: () => [], addContract }),
    ).toBeNull();
    expect(addContract).not.toHaveBeenCalled();
  });

  it('adds a contract with a fresh id from a valid payload', async () => {
    const token = await encodeContractShare(fixture);
    const added: TContract[] = [];
    const result = await importFromHash(`#import=${token}`, {
      getContracts: () => [],
      addContract: (c) => added.push(c),
    });

    expect(result).toMatchObject({ ok: true, deduped: false });
    expect(added).toHaveLength(1);
    if (result?.ok) {
      expect(result.contract.name).toBe('USD Coin');
      expect(result.contract.chainId).toBe(1);
      expect(result.contract.address).toBe(ADDR);
      expect(result.contract.abi).toEqual(erc20Abi);
      // fresh id — not the fixture's seed id
      expect(result.contract.id).not.toBe('seed-id');
      expect(result.contract.id.length).toBeGreaterThan(0);
    }
  });

  it('de-dupes against an existing contract (case-insensitive address) without adding', async () => {
    const token = await encodeContractShare(fixture);
    const addContract = vi.fn();
    const existing: TContract = {
      ...fixture,
      id: 'already-here',
      address: ADDR.toUpperCase().replace('0X', '0x') as `0x${string}`,
    };
    const result = await importFromHash(`#import=${token}`, {
      getContracts: () => [existing],
      addContract,
    });

    expect(result).toEqual({ ok: true, contract: existing, deduped: true });
    expect(addContract).not.toHaveBeenCalled();
  });

  it('returns ok:false with the clean message on a corrupt payload', async () => {
    const addContract = vi.fn();
    const result = await importFromHash('#import=not-a-real-token!!!', {
      getContracts: () => [],
      addContract,
    });

    expect(result).toEqual({
      ok: false,
      error: 'invalid or corrupted share link',
    });
    expect(addContract).not.toHaveBeenCalled();
  });
});
