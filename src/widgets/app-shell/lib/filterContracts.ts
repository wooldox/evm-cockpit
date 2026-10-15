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
export function filterAndGroup(
  contracts: SidebarContract[],
  opts: FilterOpts,
): ChainGroup[] {
  const { scope, query, currentChainId } = opts;
  const scoped =
    scope === 'current'
      ? contracts.filter((c) => c.chainId === currentChainId)
      : contracts;
  const q = query.trim().toLowerCase();
  const filtered = q
    ? scoped.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.address.toLowerCase().includes(q),
      )
    : scoped;
  const groups: ChainGroup[] = [];
  const index = new Map<number, ChainGroup>();
  for (const c of filtered) {
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
