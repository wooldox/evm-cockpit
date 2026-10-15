import { describe, it, expect } from 'vitest';
import type { TContract } from '@/entities/contract/model/types';
import { erc20Abi } from '@/shared/lib/abi/fixtures';
import { toShareBundle } from '@/shared/lib/share/codec';
import { dedupeItems, findSaved, readShareFile } from './importItems';

const c = (id: string, address: string, chainId = 1): TContract => ({
  id,
  name: `C${id}`,
  chainId,
  address: address as `0x${string}`,
  abi: erc20Abi,
  source: 'manual',
  addedAt: 0,
});
const A = `0x${'a'.repeat(40)}`;
const B = `0x${'b'.repeat(40)}`;

const file = (body: string) =>
  new File([body], 'x.json', { type: 'application/json' });

describe('importItems', () => {
  it('readShareFile parses a v2 bundle and drops in-file duplicates', async () => {
    const bundle = toShareBundle([
      c('1', A),
      c('2', A.toUpperCase().replace('0X', '0x')),
      c('3', B),
    ]);
    const r = await readShareFile(file(JSON.stringify(bundle)));
    expect(r.ok && r.items.map((i) => i.name)).toEqual(['C1', 'C3']);
  });

  it('readShareFile reads an old v1 export', async () => {
    const v1 = {
      v: 1,
      name: 'Old',
      chainId: 1,
      address: A,
      abi: erc20Abi,
      source: 'manual',
    };
    const r = await readShareFile(file(JSON.stringify(v1)));
    expect(r.ok && r.items[0]!.name).toBe('Old');
  });

  it('readShareFile rejects anything else', async () => {
    expect(await readShareFile(file('{"hello":1}'))).toEqual({
      ok: false,
      error: 'not a valid contract export',
    });
    expect((await readShareFile(file('not json'))).ok).toBe(false);
  });

  it('findSaved matches chain + address case-insensitively', () => {
    const saved = [c('s', A)];
    expect(
      findSaved({ ...c('x', A.toUpperCase().replace('0X', '0x')) }, saved)?.id,
    ).toBe('s');
    expect(findSaved(c('x', A, 5), saved)).toBeUndefined();
  });

  it('dedupeItems keeps the first of each chain+address', () => {
    expect(
      dedupeItems([c('1', A), c('2', A), c('3', A, 5)]).map((i) => i.name),
    ).toEqual(['C1', 'C3']);
  });
});
