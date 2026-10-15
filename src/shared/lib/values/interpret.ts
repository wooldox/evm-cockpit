import { formatUnits, hexToBytes, keccak256, toHex } from 'viem';

/* ============================================================
   Value interpretation — turning raw ABI values into readable
   forms (token amounts, dates, durations…).

   The ABI never says what unit a number is in, so AUTO detection
   only fires where the unit is certain: a token standard defines
   it, the name states it outright AND the value is plausible, or
   the guess is verifiable (e.g. a role hash we can recompute).
   Everything else stays raw; the user can pick a view manually.
   ============================================================ */

/** How an integer is displayed. `raw` = the plain number. */
export type TIntView =
  | { kind: 'raw' }
  | { kind: 'units'; decimals: number; symbol?: string }
  | { kind: 'date' } // unix seconds
  | { kind: 'dateMs' } // unix milliseconds
  | { kind: 'duration' } // seconds
  | { kind: 'bps' } // basis points → %
  | { kind: 'hex' };

export type TAutoIntView = { view: TIntView; reason: string };

/** ERC-20 functions whose return value is denominated in the token's own
 *  `decimals()` by the standard (OZ ERC20Capped adds `cap`). */
const TOKEN_AMOUNT_FNS = new Set([
  'totalSupply',
  'balanceOf',
  'allowance',
  'cap',
]);

const DATE_WORDS = new Set([
  'time',
  'timestamp',
  'ts',
  'deadline',
  'expiry',
  'expiration',
  'expires',
  'expire',
  'date',
  'until',
  'since',
]);
const DURATION_WORDS = new Set(['duration', 'cooldown', 'seconds', 'secs']);

/** Ethereum mainnet genesis (2015-07-30) … 2100-01-01: the only window a real
 *  on-chain Unix timestamp can fall in. */
const TS_MIN = 1_438_269_973n;
const TS_MAX = 4_102_444_800n;

/** Identifier → lowercase words: `PUBLIC_START_TIMESTAMP` → public,start,timestamp;
 *  `maxFeeBPS` → max,fee,bps; `expiresAt` → expires,at. */
export function nameWords(name: string): string[] {
  return name
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((w) => w.toLowerCase());
}

export type TIntContext = {
  /** Function / output / event-arg name the value came from. */
  name?: string;
  /** Name of the function that returned it (for standard-function checks). */
  fnName?: string;
  /** True for an ERC-20 Transfer/Approval event amount (standard-defined). */
  standardAmount?: boolean;
  /** The contract's own ERC-20 `decimals()` / `symbol()`, when it has them. */
  token?: { decimals: number; symbol?: string };
  nativeSymbol?: string;
};

/** Auto view for an integer, or null when nothing is certain enough. */
export function autoIntView(
  value: bigint,
  ctx: TIntContext,
): TAutoIntView | null {
  const words = ctx.name ? nameWords(ctx.name) : [];
  const has = (set: Set<string>) => words.some((w) => set.has(w));

  if (
    ctx.token &&
    (ctx.standardAmount || (ctx.fnName && TOKEN_AMOUNT_FNS.has(ctx.fnName)))
  ) {
    return {
      view: {
        kind: 'units',
        decimals: ctx.token.decimals,
        symbol: ctx.token.symbol,
      },
      reason: `ERC-20 ${ctx.standardAmount ? 'event amount' : ctx.fnName} is in the token's ${ctx.token.decimals} decimals`,
    };
  }
  if (words.includes('wei')) {
    return {
      view: { kind: 'units', decimals: 18, symbol: ctx.nativeSymbol },
      reason: 'name says the value is in wei',
    };
  }
  if (words.includes('bps')) {
    return {
      view: { kind: 'bps' },
      reason: 'name says the value is in basis points',
    };
  }
  const timeName =
    has(DATE_WORDS) || (words.length > 1 && words.at(-1) === 'at');
  if (timeName && value >= TS_MIN && value <= TS_MAX) {
    return {
      view: { kind: 'date' },
      reason: 'time-like name and a plausible Unix timestamp (2015–2100)',
    };
  }
  if (timeName && value >= TS_MIN * 1000n && value <= TS_MAX * 1000n) {
    return {
      view: { kind: 'dateMs' },
      reason: 'time-like name and a plausible Unix timestamp in ms (2015–2100)',
    };
  }
  if (has(DURATION_WORDS) && value >= 0n && value < TS_MIN) {
    return {
      view: { kind: 'duration' },
      reason: 'name says the value is a duration in seconds',
    };
  }
  return null;
}

/** `type(uintN).max` for N ≥ 64 (smaller maxima like 255 are just numbers). */
export function uintMaxLabel(type: string, value: bigint): string | null {
  const m = /^uint(\d+)$/.exec(type);
  const bits = m ? Number(m[1]) : 0;
  if (bits < 64 || value !== (1n << BigInt(bits)) - 1n) return null;
  return `max uint${bits}`;
}

/* ── formatting ─────────────────────────────────────────────── */

function groupInt(s: string): string {
  const neg = s.startsWith('-');
  const digits = neg ? s.slice(1) : s;
  return (neg ? '-' : '') + digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Exact (no rounding) decimal amount with a grouped integer part. */
export function formatAmount(value: bigint, decimals: number): string {
  const [int = '0', frac] = formatUnits(value, decimals).split('.');
  return frac ? `${groupInt(int)}.${frac}` : groupInt(int);
}

/** `2026-10-12 08:00:00 UTC`, or null when outside JS Date's range. */
export function formatUtc(ms: bigint): string | null {
  if (ms > 8_640_000_000_000_000n || ms < -8_640_000_000_000_000n) return null;
  return `${new Date(Number(ms))
    .toISOString()
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, '')} UTC`;
}

const UNITS: [string, number][] = [
  ['y', 31_536_000],
  ['d', 86_400],
  ['h', 3_600],
  ['m', 60],
  ['s', 1],
];

/** `7d 2h 5m`; years for long spans; `0s` for zero. */
export function formatDuration(seconds: bigint): string {
  const neg = seconds < 0n;
  let rest = neg ? -seconds : seconds;
  const parts: string[] = [];
  for (const [u, size] of UNITS) {
    const n = rest / BigInt(size);
    if (n > 0n) parts.push(`${n.toLocaleString('en-US')}${u}`);
    rest %= BigInt(size);
  }
  return (neg ? '-' : '') + (parts.slice(0, 3).join(' ') || '0s');
}

/** `in 3d` / `5h ago` — coarse relative time for a date view. */
export function formatRelative(ms: number, now = Date.now()): string {
  const diff = Math.round((ms - now) / 1000);
  const abs = Math.abs(diff);
  const [u, size] = UNITS.find(([, s]) => abs >= s) ?? ['s', 1];
  const n = Math.floor(abs / size);
  if (n === 0) return 'now';
  return diff > 0 ? `in ${n}${u}` : `${n}${u} ago`;
}

export type TFormattedInt = { text: string; sub?: string };

export function formatInt(value: bigint, view: TIntView): TFormattedInt {
  switch (view.kind) {
    case 'raw':
      return { text: groupInt(value.toString()) };
    case 'units': {
      const amt = formatAmount(value, view.decimals);
      return { text: view.symbol ? `${amt} ${view.symbol}` : amt };
    }
    case 'date':
    case 'dateMs': {
      const ms = view.kind === 'date' ? value * 1000n : value;
      const text = formatUtc(ms);
      return text
        ? { text, sub: formatRelative(Number(ms)) }
        : { text: 'out of date range' };
    }
    case 'duration':
      return { text: formatDuration(value) };
    case 'bps':
      return { text: `${formatAmount(value, 2)}%` };
    case 'hex':
      return {
        text: value < 0n ? `-0x${(-value).toString(16)}` : toHex(value),
      };
  }
}

export function intViewLabel(view: TIntView): string {
  switch (view.kind) {
    case 'raw':
      return 'Raw number';
    case 'units':
      return view.symbol
        ? `${view.symbol} (${view.decimals} decimals)`
        : `${view.decimals} decimals`;
    case 'date':
      return 'Date (Unix seconds)';
    case 'dateMs':
      return 'Date (Unix ms)';
    case 'duration':
      return 'Duration (seconds)';
    case 'bps':
      return 'Percent (basis points)';
    case 'hex':
      return 'Hex';
  }
}

export function sameView(a: TIntView, b: TIntView): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/* ── non-integer annotations ───────────────────────────────── */

/** `bytes32` role constants: verified by recomputing keccak256(name). */
export function roleHashLabel(
  name: string | undefined,
  value: string,
): string | null {
  if (!name || !/^0x[0-9a-fA-F]{64}$/.test(value)) return null;
  if (keccak256(toHex(name)).toLowerCase() === value.toLowerCase())
    return `keccak256("${name}")`;
  return null;
}

/** Zero-padded ASCII in a fixed-size bytes value (`0x555344…00` → "USD"). */
export function bytesText(value: string): string | null {
  if (!/^0x([0-9a-fA-F]{2}){2,32}$/.test(value)) return null;
  const bytes = hexToBytes(value as `0x${string}`);
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end--;
  if (end < 2) return null;
  for (let i = 0; i < end; i++) {
    const b = bytes[i]!;
    if (b < 0x20 || b > 0x7e) return null;
  }
  // Must be zero-padded — a full-width printable value is more likely data.
  if (end === bytes.length) return null;
  return String.fromCharCode(...bytes.slice(0, end));
}

/** Well-known ERC-165 interface ids. */
export const KNOWN_INTERFACE_IDS: Record<string, string> = {
  '0x01ffc9a7': 'ERC-165',
  '0x80ac58cd': 'ERC-721',
  '0x5b5e139f': 'ERC-721 Metadata',
  '0x780e9d63': 'ERC-721 Enumerable',
  '0xd9b67a26': 'ERC-1155',
  '0x0e89341c': 'ERC-1155 Metadata URI',
  '0x2a55205a': 'ERC-2981 Royalties',
  '0x49064906': 'ERC-4906 Metadata Update',
  '0x7965db0b': 'AccessControl',
};

export type TStringKind =
  | { kind: 'json'; json: string }
  | { kind: 'link'; href: string }
  | null;

/** Token-metadata style strings: data:application/json URIs are decoded,
 *  ipfs:// gets a gateway link, http(s) is linked as-is. */
export function stringKind(s: string): TStringKind {
  const data = /^data:application\/json(;[^,]*)?,/i.exec(s);
  if (data) {
    try {
      const body = s.slice(data[0].length);
      const text = /;base64/i.test(data[1] ?? '')
        ? new TextDecoder().decode(
            Uint8Array.from(atob(body), (c) => c.charCodeAt(0)),
          )
        : decodeURIComponent(body);
      return { kind: 'json', json: JSON.stringify(JSON.parse(text), null, 2) };
    } catch {
      return null;
    }
  }
  if (/^ipfs:\/\/\S+$/i.test(s))
    return {
      kind: 'link',
      href: `https://ipfs.io/ipfs/${s.slice(7).replace(/^ipfs\//, '')}`,
    };
  if (/^https?:\/\/\S+$/i.test(s)) return { kind: 'link', href: s };
  return null;
}
