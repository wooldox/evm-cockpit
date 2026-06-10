import { z } from 'zod';
import type { TContract } from '@/entities/contract/model/types';

export const SHARE_VERSION = 1;

/** Conservative cap for a shareable URL payload. */
export const MAX_SHARE_PAYLOAD_CHARS = 6000;

const evmAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

export const sharePayloadSchema = z.object({
  v: z.literal(1),
  name: z.string().min(1).max(120),
  chainId: z.number().int().positive(),
  address: evmAddress,
  abi: z.array(z.unknown()).min(1), // structural ABI validation is viem's job at use time
  source: z.enum(['manual', 'sourcify', 'etherscan']),
  proxy: z
    .object({
      kind: z.enum(['eip1967', 'beacon']),
      implAddress: evmAddress,
      implAbi: z.array(z.unknown()).optional(),
    })
    .optional(),
});

export type TSharePayload = z.infer<typeof sharePayloadSchema>;

/**
 * Build a shareable payload from a contract: strips `id`/`addedAt`, stamps the
 * version, and omits `proxy` entirely when the contract has none.
 *
 * Note: `TContract.abi` is a viem `Abi`, which is plain JSON (no bigints), so it
 * round-trips through `JSON.stringify`/`JSON.parse` as-is — no bigint handling
 * is needed in this codec.
 */
export function toSharePayload(c: TContract): TSharePayload {
  const payload: TSharePayload = {
    v: SHARE_VERSION,
    name: c.name,
    chainId: c.chainId,
    address: c.address,
    abi: c.abi as unknown[],
    source: c.source,
  };
  if (c.proxy) {
    payload.proxy = {
      kind: c.proxy.kind,
      implAddress: c.proxy.implAddress,
      ...(c.proxy.implAbi !== undefined
        ? { implAbi: c.proxy.implAbi as unknown[] }
        : {}),
    };
  }
  return payload;
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

/** Encode a contract into a compact, URL-safe share token. */
export async function encodeContractShare(c: TContract): Promise<string> {
  return encodePayload(toSharePayload(c));
}

/**
 * Decode a share token back into a validated payload. Every failure mode (bad
 * base64, bad deflate stream, bad JSON, schema mismatch, oversized input, or
 * decompression bomb) collapses into a single opaque error so internals never leak.
 */
export async function decodeContractShare(s: string): Promise<TSharePayload> {
  try {
    if (s.length > MAX_SHARE_PAYLOAD_CHARS) {
      throw new Error('token exceeds maximum length');
    }
    const bytes = base64UrlToBytes(s);
    const json = await inflate(bytes);
    const parsed: unknown = JSON.parse(json);
    return sharePayloadSchema.parse(parsed);
  } catch (cause) {
    throw new Error('invalid or corrupted share link', { cause });
  }
}
