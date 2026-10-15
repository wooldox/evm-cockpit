import { describe, it, expect } from 'vitest';
import type { TContract } from '@/entities/contract/model/types';
import { erc20Abi } from '@/shared/lib/abi/fixtures';
import {
  SHARE_VERSION,
  MAX_SHARE_PAYLOAD_CHARS,
  sharePayloadSchema,
  toShareBundle,
  parseSharePayload,
  encodeShare,
  decodeShare,
  encodePayload,
} from './codec';

const baseContract: TContract = {
  id: 'uid-123',
  name: 'Test Token',
  chainId: 1,
  address: '0x1111111111111111111111111111111111111111',
  abi: erc20Abi,
  source: 'etherscan',
  addedAt: 1700000000000,
};

const proxyContract: TContract = {
  ...baseContract,
  id: 'uid-456',
  proxy: {
    kind: 'eip1967',
    implAddress: '0x2222222222222222222222222222222222222222',
    implAbi: erc20Abi,
  },
};

/** A contract as it comes back out of a link/file. */
const asShared = (c: TContract) => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, addedAt: _addedAt, ...rest } = c;
  return JSON.parse(JSON.stringify(rest)) as unknown;
};

/** The pre-v2 single-contract payload, as old links/files carry it. */
const v1Payload = (c: TContract) => ({
  v: 1,
  ...(asShared(c) as object),
});

describe('toShareBundle', () => {
  it('stamps v2, strips id/addedAt, stores each distinct ABI once', () => {
    const other: TContract = {
      ...baseContract,
      id: 'o',
      address: `0x${'9'.repeat(40)}`,
    };
    const b = toShareBundle([baseContract, other, proxyContract]);
    expect(b.v).toBe(SHARE_VERSION);
    expect(b.v).toBe(2);
    // erc20Abi is used 4× (2 contracts + proxy + its impl) but stored once
    expect(b.abis).toEqual([erc20Abi]);
    expect(b.contracts.map((c) => c.abi)).toEqual([0, 0, 0]);
    expect(b.contracts[2]!.proxy).toEqual({
      kind: 'eip1967',
      implAddress: '0x2222222222222222222222222222222222222222',
      implAbi: 0,
    });
    expect(b.contracts[0]).not.toHaveProperty('id');
    expect(b.contracts[0]).not.toHaveProperty('addedAt');
    expect('proxy' in b.contracts[0]!).toBe(false);
  });

  it('omits implAbi when the proxy has none', () => {
    const c: TContract = {
      ...baseContract,
      proxy: {
        kind: 'beacon',
        implAddress: '0x3333333333333333333333333333333333333333',
      },
    };
    const proxy = toShareBundle([c]).contracts[0]!.proxy;
    expect(proxy).toBeDefined();
    expect('implAbi' in proxy!).toBe(false);
  });
});

describe('round-trip', () => {
  it('decodes encoded contracts (with and without proxy)', async () => {
    const decoded = await decodeShare(
      await encodeShare([baseContract, proxyContract]),
    );
    expect(decoded).toEqual([asShared(baseContract), asShared(proxyContract)]);
  });

  it('still decodes old v1 single-contract links', async () => {
    const token = await encodePayload(v1Payload(proxyContract));
    expect(await decodeShare(token)).toEqual([asShared(proxyContract)]);
  });

  it('parseSharePayload reads v1 and v2 files', () => {
    expect(parseSharePayload(v1Payload(baseContract))).toEqual([
      asShared(baseContract),
    ]);
    expect(parseSharePayload(toShareBundle([baseContract]))).toEqual([
      asShared(baseContract),
    ]);
  });

  it('produces a URL-safe token', async () => {
    const encoded = await encodeShare([proxyContract]);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('compresses below the raw JSON length for the fixture', async () => {
    const encoded = await encodeShare([proxyContract]);
    const raw = JSON.stringify(v1Payload(proxyContract));
    expect(encoded.length).toBeLessThan(raw.length);
  });

  it('many contracts sharing an ABI cost little more than one', async () => {
    const many = Array.from({ length: 20 }, (_, i) => ({
      ...baseContract,
      id: String(i),
      name: `Resource ${i}`,
      address: `0x${i.toString(16).padStart(40, '0')}` as `0x${string}`,
    }));
    const one = (await encodeShare([baseContract])).length;
    const twenty = (await encodeShare(many)).length;
    expect(twenty).toBeLessThan(one * 3);
  });
});

describe('decodeShare failure modes', () => {
  it('rejects tampered tokens with a clean error', async () => {
    const encoded = await encodeShare([baseContract]);
    const mid = Math.floor(encoded.length / 2);
    // Flip a run of middle chars to corrupt the deflate stream / payload.
    const flip = (ch: string) => (ch === 'A' ? 'B' : 'A');
    const tampered =
      encoded.slice(0, mid) +
      flip(encoded[mid]!) +
      flip(encoded[mid + 1]!) +
      flip(encoded[mid + 2]!) +
      encoded.slice(mid + 3);
    await expect(decodeShare(tampered)).rejects.toThrow(
      'invalid or corrupted share link',
    );
  });

  it('rejects non-base64 garbage', async () => {
    await expect(decodeShare('!!!not base64!!!')).rejects.toThrow(
      'invalid or corrupted share link',
    );
  });

  it('rejects valid base64 that is not a deflate stream', async () => {
    // "hello" base64url-encoded — decodes to bytes but is not deflate-raw.
    await expect(decodeShare('aGVsbG8')).rejects.toThrow(
      'invalid or corrupted share link',
    );
  });

  it('rejects a wrong-version payload sent through the real pipeline', async () => {
    const token = await encodePayload({
      ...v1Payload(baseContract),
      v: 3,
    });
    await expect(decodeShare(token)).rejects.toThrow(
      'invalid or corrupted share link',
    );
  });

  it('rejects a bundle whose ABI index is out of range', async () => {
    const b = toShareBundle([baseContract]);
    const token = await encodePayload({
      ...b,
      contracts: [{ ...b.contracts[0]!, abi: 5 }],
    });
    await expect(decodeShare(token)).rejects.toThrow(
      'invalid or corrupted share link',
    );
  });

  it('rejects valid deflate of non-JSON', async () => {
    const token = await encodePayload(undefined); // JSON.stringify(undefined) === undefined
    await expect(decodeShare(token)).rejects.toThrow(
      'invalid or corrupted share link',
    );
  });

  it('preserves the original error as cause', async () => {
    try {
      await decodeShare('aGVsbG8');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).cause).toBeDefined();
    }
  });

  it('rejects tokens longer than MAX_SHARE_PAYLOAD_CHARS with a clean error', async () => {
    const oversized = 'a'.repeat(MAX_SHARE_PAYLOAD_CHARS + 1);
    await expect(decodeShare(oversized)).rejects.toThrow(
      'invalid or corrupted share link',
    );
  });

  it('rejects a decompression bomb that expands past the 2 MB cap', async () => {
    // A 3 MB string of repeated chars compresses to well under 6000 chars
    // (deflate achieves >700x ratio on uniform data), so it passes guard 1
    // but the decompressed output blows past the 2 MB cap → guard 2 fires.
    const token = await encodePayload('x'.repeat(3_000_000));
    expect(token.length).toBeLessThanOrEqual(MAX_SHARE_PAYLOAD_CHARS);
    await expect(decodeShare(token)).rejects.toThrow(
      'invalid or corrupted share link',
    );
  });
});

describe('sharePayloadSchema', () => {
  const valid = v1Payload(baseContract) as Record<string, unknown>;

  it('accepts a valid payload', () => {
    expect(() => sharePayloadSchema.parse(valid)).not.toThrow();
  });

  it('rejects a bad address', () => {
    expect(() =>
      sharePayloadSchema.parse({ ...valid, address: '0xnope' }),
    ).toThrow();
  });

  it('rejects chainId 0', () => {
    expect(() => sharePayloadSchema.parse({ ...valid, chainId: 0 })).toThrow();
  });

  it('rejects a negative chainId', () => {
    expect(() => sharePayloadSchema.parse({ ...valid, chainId: -1 })).toThrow();
  });

  it('rejects a float chainId', () => {
    expect(() =>
      sharePayloadSchema.parse({ ...valid, chainId: 1.5 }),
    ).toThrow();
  });

  it('rejects an unknown source', () => {
    expect(() =>
      sharePayloadSchema.parse({ ...valid, source: 'blockscout' }),
    ).toThrow();
  });

  it('rejects an empty abi', () => {
    expect(() => sharePayloadSchema.parse({ ...valid, abi: [] })).toThrow();
  });

  it('rejects an empty name', () => {
    expect(() => sharePayloadSchema.parse({ ...valid, name: '' })).toThrow();
  });

  it('rejects a bad proxy kind', () => {
    expect(() =>
      sharePayloadSchema.parse({
        ...valid,
        proxy: {
          kind: 'diamond',
          implAddress: '0x2222222222222222222222222222222222222222',
        },
      }),
    ).toThrow();
  });

  it('rejects a bad proxy implAddress', () => {
    expect(() =>
      sharePayloadSchema.parse({
        ...valid,
        proxy: { kind: 'eip1967', implAddress: '0xbad' },
      }),
    ).toThrow();
  });
});
