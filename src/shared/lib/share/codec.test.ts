import { describe, it, expect } from "vitest";
import type { TContract } from "@/entities/contract/model/types";
import { erc20Abi } from "@/shared/lib/abi/fixtures";
import {
  SHARE_VERSION,
  MAX_SHARE_PAYLOAD_CHARS,
  sharePayloadSchema,
  toSharePayload,
  encodeContractShare,
  decodeContractShare,
  encodePayload,
} from "./codec";

const baseContract: TContract = {
  id: "uid-123",
  name: "Test Token",
  chainId: 1,
  address: "0x1111111111111111111111111111111111111111",
  abi: erc20Abi,
  source: "etherscan",
  addedAt: 1700000000000,
};

const proxyContract: TContract = {
  ...baseContract,
  id: "uid-456",
  proxy: {
    kind: "eip1967",
    implAddress: "0x2222222222222222222222222222222222222222",
    implAbi: erc20Abi,
  },
};

describe("toSharePayload", () => {
  it("strips id and addedAt and stamps the version", () => {
    const payload = toSharePayload(baseContract);
    expect(payload.v).toBe(SHARE_VERSION);
    expect(payload).not.toHaveProperty("id");
    expect(payload).not.toHaveProperty("addedAt");
    expect(payload.name).toBe("Test Token");
    expect(payload.chainId).toBe(1);
    expect(payload.address).toBe(baseContract.address);
    expect(payload.source).toBe("etherscan");
    expect(payload.abi).toEqual(erc20Abi);
  });

  it("omits the proxy key entirely when the contract has none", () => {
    const payload = toSharePayload(baseContract);
    expect("proxy" in payload).toBe(false);
  });

  it("includes proxy with implAbi when present", () => {
    const payload = toSharePayload(proxyContract);
    expect(payload.proxy).toEqual({
      kind: "eip1967",
      implAddress: "0x2222222222222222222222222222222222222222",
      implAbi: erc20Abi,
    });
  });

  it("omits implAbi when the proxy has none", () => {
    const c: TContract = {
      ...baseContract,
      proxy: {
        kind: "beacon",
        implAddress: "0x3333333333333333333333333333333333333333",
      },
    };
    const payload = toSharePayload(c);
    expect(payload.proxy).toBeDefined();
    expect("implAbi" in payload.proxy!).toBe(false);
  });
});

describe("round-trip", () => {
  it("decodes an encoded contract without proxy to its payload", async () => {
    const encoded = await encodeContractShare(baseContract);
    const decoded = await decodeContractShare(encoded);
    expect(decoded).toEqual(toSharePayload(baseContract));
  });

  it("decodes an encoded contract with proxy (incl. implAbi)", async () => {
    const encoded = await encodeContractShare(proxyContract);
    const decoded = await decodeContractShare(encoded);
    expect(decoded).toEqual(toSharePayload(proxyContract));
  });

  it("produces a URL-safe token", async () => {
    const encoded = await encodeContractShare(proxyContract);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("compresses below the raw JSON length for the fixture", async () => {
    const encoded = await encodeContractShare(proxyContract);
    const raw = JSON.stringify(toSharePayload(proxyContract));
    expect(encoded.length).toBeLessThan(raw.length);
  });
});

describe("decodeContractShare failure modes", () => {
  it("rejects tampered tokens with a clean error", async () => {
    const encoded = await encodeContractShare(baseContract);
    const mid = Math.floor(encoded.length / 2);
    // Flip a run of middle chars to corrupt the deflate stream / payload.
    const flip = (ch: string) => (ch === "A" ? "B" : "A");
    const tampered =
      encoded.slice(0, mid) +
      flip(encoded[mid]!) +
      flip(encoded[mid + 1]!) +
      flip(encoded[mid + 2]!) +
      encoded.slice(mid + 3);
    await expect(decodeContractShare(tampered)).rejects.toThrow(
      "invalid or corrupted share link",
    );
  });

  it("rejects non-base64 garbage", async () => {
    await expect(decodeContractShare("!!!not base64!!!")).rejects.toThrow(
      "invalid or corrupted share link",
    );
  });

  it("rejects valid base64 that is not a deflate stream", async () => {
    // "hello" base64url-encoded — decodes to bytes but is not deflate-raw.
    await expect(decodeContractShare("aGVsbG8")).rejects.toThrow(
      "invalid or corrupted share link",
    );
  });

  it("rejects a wrong-version payload sent through the real pipeline", async () => {
    const token = await encodePayload({
      ...toSharePayload(baseContract),
      v: 2,
    });
    await expect(decodeContractShare(token)).rejects.toThrow(
      "invalid or corrupted share link",
    );
  });

  it("rejects valid deflate of non-JSON", async () => {
    const token = await encodePayload(undefined); // JSON.stringify(undefined) === undefined
    await expect(decodeContractShare(token)).rejects.toThrow(
      "invalid or corrupted share link",
    );
  });

  it("preserves the original error as cause", async () => {
    try {
      await decodeContractShare("aGVsbG8");
      expect.unreachable("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(Error);
      expect((err as Error).cause).toBeDefined();
    }
  });

  it("rejects tokens longer than MAX_SHARE_PAYLOAD_CHARS with a clean error", async () => {
    const oversized = "a".repeat(MAX_SHARE_PAYLOAD_CHARS + 1);
    await expect(decodeContractShare(oversized)).rejects.toThrow(
      "invalid or corrupted share link",
    );
  });

  it("rejects a decompression bomb that expands past the 2 MB cap", async () => {
    // A 3 MB string of repeated chars compresses to well under 6000 chars
    // (deflate achieves >700x ratio on uniform data), so it passes guard 1
    // but the decompressed output blows past the 2 MB cap → guard 2 fires.
    const token = await encodePayload("x".repeat(3_000_000));
    expect(token.length).toBeLessThanOrEqual(MAX_SHARE_PAYLOAD_CHARS);
    await expect(decodeContractShare(token)).rejects.toThrow(
      "invalid or corrupted share link",
    );
  });
});

describe("sharePayloadSchema", () => {
  const valid = toSharePayload(baseContract);

  it("accepts a valid payload", () => {
    expect(() => sharePayloadSchema.parse(valid)).not.toThrow();
  });

  it("rejects a bad address", () => {
    expect(() =>
      sharePayloadSchema.parse({ ...valid, address: "0xnope" }),
    ).toThrow();
  });

  it("rejects chainId 0", () => {
    expect(() => sharePayloadSchema.parse({ ...valid, chainId: 0 })).toThrow();
  });

  it("rejects a negative chainId", () => {
    expect(() => sharePayloadSchema.parse({ ...valid, chainId: -1 })).toThrow();
  });

  it("rejects a float chainId", () => {
    expect(() =>
      sharePayloadSchema.parse({ ...valid, chainId: 1.5 }),
    ).toThrow();
  });

  it("rejects an unknown source", () => {
    expect(() =>
      sharePayloadSchema.parse({ ...valid, source: "blockscout" }),
    ).toThrow();
  });

  it("rejects an empty abi", () => {
    expect(() => sharePayloadSchema.parse({ ...valid, abi: [] })).toThrow();
  });

  it("rejects an empty name", () => {
    expect(() => sharePayloadSchema.parse({ ...valid, name: "" })).toThrow();
  });

  it("rejects a bad proxy kind", () => {
    expect(() =>
      sharePayloadSchema.parse({
        ...valid,
        proxy: {
          kind: "diamond",
          implAddress: "0x2222222222222222222222222222222222222222",
        },
      }),
    ).toThrow();
  });

  it("rejects a bad proxy implAddress", () => {
    expect(() =>
      sharePayloadSchema.parse({
        ...valid,
        proxy: { kind: "eip1967", implAddress: "0xbad" },
      }),
    ).toThrow();
  });
});
