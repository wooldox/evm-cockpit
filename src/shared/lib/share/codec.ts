import { z } from 'zod';
import type { TContract } from '@/entities/contract/model/types';

/** Format written by this version: a bundle of 1..N contracts. v1 (a single
 *  contract) is still accepted when decoding old links and files. */
export const SHARE_VERSION = 2;

/** Conservative cap for a shareable URL payload. */
export const MAX_SHARE_PAYLOAD_CHARS = 6000;

/** Upper bound on contracts in one bundle (link or file). */
export const MAX_SHARE_CONTRACTS = 500;

const evmAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const abiArray = z.array(z.unknown()).min(1); // structural ABI validation is viem's job at use time
const contractBase = {
  name: z.string().min(1).max(120),
  chainId: z.number().int().positive(),
  address: evmAddress,
  source: z.enum(['manual', 'sourcify', 'etherscan']),
};
const proxyKind = z.enum(['eip1967', 'beacon']);

/** v1 — one contract, ABIs inline. */
export const sharePayloadSchema = z.object({
  v: z.literal(1),
  ...contractBase,
  abi: abiArray,
  proxy: z
    .object({
      kind: proxyKind,
      implAddress: evmAddress,
      implAbi: abiArray.optional(),
    })
    .optional(),
});

/** v2 — a bundle. Each distinct ABI is stored once in `abis`; contracts refer
 *  to it by index, so N contracts sharing an ABI cost about one ABI. */
export const shareBundleSchema = z
  .object({
    v: z.literal(2),
    abis: z.array(abiArray).min(1),
    contracts: z
      .array(
        z.object({
          ...contractBase,
          abi: z.number().int().nonnegative(),
          proxy: z
            .object({
              kind: proxyKind,
              implAddress: evmAddress,
              implAbi: z.number().int().nonnegative().optional(),
            })
            .optional(),
        }),
      )
      .min(1)
      .max(MAX_SHARE_CONTRACTS),
  })
  .superRefine((b, ctx) => {
    const ok = (i: number | undefined) => i === undefined || i < b.abis.length;
    if (!b.contracts.every((c) => ok(c.abi) && ok(c.proxy?.implAbi)))
      ctx.addIssue({ code: 'custom', message: 'ABI index out of range' });
  });

export type TSharePayload = z.infer<typeof sharePayloadSchema>;
export type TShareBundle = z.infer<typeof shareBundleSchema>;

/** One contract as carried by a link/file (format-independent). */
export type TShareContract = {
  name: string;
  chainId: number;
  address: string;
  abi: readonly unknown[];
  source: 'manual' | 'sourcify' | 'etherscan';
  proxy?: {
    kind: 'eip1967' | 'beacon';
    implAddress: string;
    implAbi?: readonly unknown[];
  };
};

/**
 * Build a v2 bundle from contracts: strips `id`/`addedAt` and stores each
 * distinct ABI once.
 *
 * Note: `TContract.abi` is a viem `Abi`, which is plain JSON (no bigints), so it
 * round-trips through `JSON.stringify`/`JSON.parse` as-is — no bigint handling
 * is needed in this codec.
 */
export function toShareBundle(contracts: TContract[]): TShareBundle {
  const abis: unknown[][] = [];
  const index = new Map<string, number>();
  const ref = (abi: readonly unknown[]): number => {
    const key = JSON.stringify(abi);
    let i = index.get(key);
    if (i === undefined) {
      i = abis.push(abi as unknown[]) - 1;
      index.set(key, i);
    }
    return i;
  };
  return {
    v: SHARE_VERSION,
    abis,
    contracts: contracts.map((c) => ({
      name: c.name,
      chainId: c.chainId,
      address: c.address,
      abi: ref(c.abi),
      source: c.source,
      ...(c.proxy
        ? {
            proxy: {
              kind: c.proxy.kind,
              implAddress: c.proxy.implAddress,
              ...(c.proxy.implAbi !== undefined
                ? { implAbi: ref(c.proxy.implAbi) }
                : {}),
            },
          }
        : {}),
    })),
  };
}

/** Validate a parsed link/file payload (v1 or v2) into a flat contract list. */
export function parseSharePayload(value: unknown): TShareContract[] {
  const v1 = sharePayloadSchema.safeParse(value);
  if (v1.success) {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { v: _v, ...c } = v1.data;
    return [c];
  }
  const b = shareBundleSchema.parse(value);
  return b.contracts.map((c) => ({
    name: c.name,
    chainId: c.chainId,
    address: c.address,
    abi: b.abis[c.abi]!,
    source: c.source,
    ...(c.proxy
      ? {
          proxy: {
            kind: c.proxy.kind,
            implAddress: c.proxy.implAddress,
            ...(c.proxy.implAbi !== undefined
              ? { implAbi: b.abis[c.proxy.implAbi]! }
              : {}),
          },
        }
      : {}),
  }));
}

/** Encode raw bytes as a URL-safe base64 string (no padding). */
function bytesToBase64Url(bytes: Uint8Array): string {
  // Build the binary string in chunks so a huge ABI can't blow the call stack
  // via String.fromCharCode(...spread).
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...chunk);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/** Decode a URL-safe base64 string back into raw bytes. */
function base64UrlToBytes(s: string): Uint8Array<ArrayBuffer> {
  const base64 =
    s.replace(/-/g, '+').replace(/_/g, '/') +
    '='.repeat((4 - (s.length % 4)) % 4);
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/** A one-chunk ReadableStream of the given bytes (avoids Blob.stream(), which
 * jsdom does not implement). */
function streamOf(
  bytes: Uint8Array<ArrayBuffer>,
): ReadableStream<BufferSource> {
  return new ReadableStream<BufferSource>({
    start(controller) {
      controller.enqueue(bytes);
      controller.close();
    },
  });
}

async function deflate(json: string): Promise<Uint8Array> {
  const input = new TextEncoder().encode(json);
  const stream = streamOf(input).pipeThrough(
    new CompressionStream('deflate-raw'),
  );
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

const MAX_DECOMPRESSED_BYTES = 2_000_000;

async function inflate(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const stream = streamOf(bytes).pipeThrough(
    new DecompressionStream('deflate-raw'),
  );
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk =
        value instanceof Uint8Array
          ? value
          : new Uint8Array(value as ArrayBuffer);
      total += chunk.byteLength;
      if (total > MAX_DECOMPRESSED_BYTES) {
        await reader.cancel();
        throw new Error('decompressed size exceeds limit');
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

/**
 * @internal Exposed for tests: compress + base64url-encode an arbitrary payload
 * (so tests can build malformed payloads, e.g. a wrong `v`, through the real
 * pipeline). Production code should use {@link encodeContractShare}.
 */
export async function encodePayload(payload: unknown): Promise<string> {
  const json = JSON.stringify(payload);
  const compressed = await deflate(json);
  return bytesToBase64Url(compressed);
}

/** Encode contracts into a compact, URL-safe share token (v2 bundle). */
export async function encodeShare(contracts: TContract[]): Promise<string> {
  return encodePayload(toShareBundle(contracts));
}

/**
 * Decode a share token (v1 or v2) back into a validated contract list. Every
 * failure mode (bad base64, bad deflate stream, bad JSON, schema mismatch,
 * oversized input, or decompression bomb) collapses into a single opaque error
 * so internals never leak.
 */
export async function decodeShare(s: string): Promise<TShareContract[]> {
  try {
    if (s.length > MAX_SHARE_PAYLOAD_CHARS) {
      throw new Error('token exceeds maximum length');
    }
    const bytes = base64UrlToBytes(s);
    const json = await inflate(bytes);
    return parseSharePayload(JSON.parse(json));
  } catch (cause) {
    throw new Error('invalid or corrupted share link', { cause });
  }
}
