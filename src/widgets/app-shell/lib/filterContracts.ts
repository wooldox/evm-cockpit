export type SidebarContract = {
  id: string;
  name: string;
  address: string;
  chainId: number;
  proxy?: boolean;
};
export type ChainGroup = { chainId: number; contracts: SidebarContract[] };
export type FilterOpts = {
  scope: 'all' | 'current';
  query: string;
  currentChainId: number;
  /** Preferred chain order; unlisted chains follow in first-seen order. */
  chainOrder?: number[];
};
/** Contracts matching the scope (current chain only?) and search query. */
export function filterContracts(
  contracts: SidebarContract[],
  { scope, query, currentChainId }: Omit<FilterOpts, 'chainOrder'>,
): SidebarContract[] {
  const scoped =
    scope === 'current'
      ? contracts.filter((c) => c.chainId === currentChainId)
      : contracts;
  const q = query.trim().toLowerCase();
  return q
    ? scoped.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.address.toLowerCase().includes(q),
      )
    : scoped;
}

export function filterAndGroup(
  contracts: SidebarContract[],
  opts: FilterOpts,
): ChainGroup[] {
  const groups: ChainGroup[] = [];
  const index = new Map<number, ChainGroup>();
  for (const c of filterContracts(contracts, opts)) {
    let g = index.get(c.chainId);
    if (!g) {
      g = { chainId: c.chainId, contracts: [] };
      index.set(c.chainId, g);
      groups.push(g);
    }
    g.contracts.push(c);
  }
  const rank = new Map((opts.chainOrder ?? []).map((id, i) => [id, i]));
  const r = (g: ChainGroup) => rank.get(g.chainId) ?? Infinity;
  // Array.prototype.sort is stable, so ties keep first-seen order.
  return groups.sort((a, b) => r(a) - r(b));
}
