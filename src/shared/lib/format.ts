// NOTE: address truncation overlaps src/shared/lib/web3/address.ts#truncateAddress
// (same default output). truncateAddress is canonical for domain code; trunc is the
// UI-layer formatter. Kept separate intentionally; unify in a later cleanup if desired.
/** Truncate a hex string the way explorers do: 0x1234…abcd */
export function trunc(addr: string | null | undefined, n = 4): string {
  if (!addr) return "";
  return `${addr.slice(0, 2 + n)}…${addr.slice(-n)}`;
}

/** Format a stringy big integer with thousands separators. */
export function fmtBig(s: string | number | bigint): string {
  try {
    return BigInt(s).toLocaleString("en-US");
  } catch {
    return String(s);
  }
}

/**
 * Deterministic two-stop gradient for identicons — same seed → same colors.
 * Returns a CSS linear-gradient string.
 */
export function identGradient(seed: string | null | undefined): string {
  let h = 0;
  for (const c of seed ?? "") h = (h * 31 + c.charCodeAt(0)) % 360;
  const a = `hsl(${h} 70% 55%)`;
  const b = `hsl(${(h + 80) % 360} 70% 50%)`;
  return `linear-gradient(135deg, ${a}, ${b})`;
}
