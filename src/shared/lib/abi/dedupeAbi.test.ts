import { describe, it, expect } from 'vitest';
import type { Abi } from 'viem';
import { dedupeAbi } from './dedupeAbi';

describe('dedupeAbi', () => {
  it('collapses a duplicate event (the proxy+impl Upgraded(address) case)', () => {
    const abi: Abi = [
      {
        type: 'event',
        name: 'Upgraded',
        inputs: [{ type: 'address', name: 'implementation', indexed: true }],
      },
      {
        type: 'event',
        name: 'Upgraded',
        inputs: [{ type: 'address', name: 'impl', indexed: true }],
      },
    ];
    const out = dedupeAbi(abi);
    expect(out).toHaveLength(1);
    // first occurrence wins (keeps the original input name)
    const ev = out[0]!;
    expect(ev.type).toBe('event');
    if (ev.type !== 'event') throw new Error('unreachable');
    expect(ev.inputs[0]!.name).toBe('implementation');
  });

  it('collapses a duplicate function by selector', () => {
    const fn = {
      type: 'function',
      name: 'owner',
      inputs: [],
      outputs: [{ type: 'address', name: '' }],
      stateMutability: 'view',
    } as const;
    expect(dedupeAbi([fn, { ...fn }] as Abi)).toHaveLength(1);
  });

  it('keeps true overloads (same name, different inputs)', () => {
    const abi: Abi = [
      {
        type: 'function',
        name: 'mint',
        inputs: [{ type: 'uint256', name: 'amount' }],
        outputs: [],
        stateMutability: 'nonpayable',
      },
      {
        type: 'function',
        name: 'mint',
        inputs: [
          { type: 'address', name: 'to' },
          { type: 'uint256', name: 'amount' },
        ],
        outputs: [],
        stateMutability: 'nonpayable',
      },
    ];
    expect(dedupeAbi(abi)).toHaveLength(2);
  });

  it('distinguishes tuple overloads that a naive type-join would merge', () => {
    const mk = (componentType: string): Abi[number] => ({
      type: 'event',
      name: 'E',
      inputs: [
        {
          type: 'tuple',
          name: 'data',
          components: [{ type: componentType, name: 'x' }],
        },
      ],
    });
    // naive `inputs.map(i => i.type)` => "E(tuple)" for both; formatAbiItem
    // expands to "E((uint256))" vs "E((address))" — must stay distinct.
    expect(dedupeAbi([mk('uint256'), mk('address')])).toHaveLength(2);
  });

  it('namespaces by kind — a function and event with the same signature both survive', () => {
    const abi: Abi = [
      {
        type: 'function',
        name: 'Foo',
        inputs: [{ type: 'uint256', name: 'x' }],
        outputs: [],
        stateMutability: 'nonpayable',
      },
      {
        type: 'event',
        name: 'Foo',
        inputs: [{ type: 'uint256', name: 'x', indexed: false }],
      },
    ];
    expect(dedupeAbi(abi)).toHaveLength(2);
  });

  it('keeps a single constructor/fallback/receive and drops duplicates', () => {
    const abi: Abi = [
      { type: 'constructor', inputs: [], stateMutability: 'nonpayable' },
      { type: 'constructor', inputs: [], stateMutability: 'nonpayable' },
      { type: 'fallback', stateMutability: 'payable' },
      { type: 'receive', stateMutability: 'payable' },
    ];
    const out = dedupeAbi(abi);
    expect(out.filter((i) => i.type === 'constructor')).toHaveLength(1);
    expect(out).toHaveLength(3);
  });

  it('returns an equivalent ABI when there are no duplicates', () => {
    const abi: Abi = [
      {
        type: 'function',
        name: 'a',
        inputs: [],
        outputs: [],
        stateMutability: 'view',
      },
      { type: 'event', name: 'B', inputs: [] },
      { type: 'error', name: 'C', inputs: [] },
    ];
    expect(dedupeAbi(abi)).toEqual(abi);
  });
});
