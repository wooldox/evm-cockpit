import { describe, it, expect } from 'vitest';
import { filterAndGroup, type SidebarContract } from './filterContracts';
const C: SidebarContract[] = [
  { id: '1', name: 'USD Coin', address: '0xA0b8...', chainId: 1 },
  { id: '2', name: 'Wrapped Ether', address: '0xC02a...', chainId: 1 },
  { id: '3', name: 'Yield Vault', address: '0x7Bf3...', chainId: 8453 },
];
describe('filterAndGroup', () => {
  it('groups by chain when scope=all and no query', () => {
    const g = filterAndGroup(C, { scope: 'all', query: '', currentChainId: 1 });
    expect(g.map((x) => x.chainId)).toEqual([1, 8453]);
    expect(g[0]!.contracts.length).toBe(2);
  });
  it('restricts to current chain when scope=current', () => {
    const g = filterAndGroup(C, {
      scope: 'current',
      query: '',
      currentChainId: 8453,
    });
    expect(g).toHaveLength(1);
    expect(g[0]!.chainId).toBe(8453);
  });
  it('filters by name/address case-insensitive', () => {
    const g = filterAndGroup(C, {
      scope: 'all',
      query: 'yield',
      currentChainId: 1,
    });
    expect(g.flatMap((x) => x.contracts).map((c) => c.id)).toEqual(['3']);
  });
  it('orders chains by chainOrder; unlisted chains follow in first-seen order', () => {
    const more: SidebarContract[] = [
      ...C,
      { id: '4', name: 'Other', address: '0x4', chainId: 10 },
    ];
    const g = filterAndGroup(more, {
      scope: 'all',
      query: '',
      currentChainId: 1,
      chainOrder: [8453],
    });
    expect(g.map((x) => x.chainId)).toEqual([8453, 1, 10]);
  });
});
