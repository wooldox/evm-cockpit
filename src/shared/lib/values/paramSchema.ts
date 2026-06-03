import { z } from "zod";
import { isAddress, isHex } from "viem";

const addressSchema = z
  .string()
  .refine((v) => isAddress(v, { strict: false }), "invalid address");

const boolSchema = z.preprocess((v) => {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return v;
}, z.boolean());

function uintSchema(bits: number) {
  const max = (1n << BigInt(bits)) - 1n;
  return z.union([z.string(), z.number(), z.bigint()]).transform((v, ctx) => {
    let n: bigint;
    if (typeof v === "number") {
      if (!Number.isInteger(v) || Math.abs(v) > Number.MAX_SAFE_INTEGER) {
        ctx.addIssue({ code: "custom", message: `invalid uint${bits}` });
        return z.NEVER;
      }
      n = BigInt(v);
    } else {
      try {
        n = BigInt(v as string | bigint);
      } catch {
        ctx.addIssue({ code: "custom", message: `invalid uint${bits}` });
        return z.NEVER;
      }
    }
    if (n < 0n) {
      ctx.addIssue({ code: "custom", message: `invalid uint${bits}` });
      return z.NEVER;
    }
    if (n > max) {
      ctx.addIssue({ code: "custom", message: `invalid uint${bits}` });
      return z.NEVER;
    }
    return n;
  });
}

function intSchema(bits: number) {
  const limit = 1n << BigInt(bits - 1);
  return z.union([z.string(), z.number(), z.bigint()]).transform((v, ctx) => {
    let n: bigint;
    if (typeof v === "number") {
      if (!Number.isInteger(v) || Math.abs(v) > Number.MAX_SAFE_INTEGER) {
        ctx.addIssue({ code: "custom", message: `invalid int${bits}` });
        return z.NEVER;
      }
      n = BigInt(v);
    } else {
      try {
        n = BigInt(v as string | bigint);
      } catch {
        ctx.addIssue({ code: "custom", message: `invalid int${bits}` });
        return z.NEVER;
      }
    }
    if (n < -limit || n > limit - 1n) {
      ctx.addIssue({ code: "custom", message: `invalid int${bits}` });
      return z.NEVER;
    }
    return n;
  });
}

function fixedBytesSchema(byteLen: number) {
  return z
    .string()
    .refine(
      (v) => isHex(v) && v.length === 2 + byteLen * 2,
      `expected ${byteLen}-byte hex`,
    );
}

/** Build a zod schema for a single ABI parameter type string. */
export function paramSchema(type: string): z.ZodType {
  if (type.endsWith("[]")) {
    return z.array(paramSchema(type.slice(0, -2)));
  }
  const fixedArr = /^(.+)\[(\d+)\]$/.exec(type);
  if (fixedArr) {
    return z.array(paramSchema(fixedArr[1]!)).length(Number(fixedArr[2]!));
  }
  if (type === "address") return addressSchema;
  if (type === "bool") return boolSchema;
  if (type === "string") return z.string();
  if (type === "bytes")
    return z
      .string()
      .refine(
        (v) => isHex(v) && (v.length - 2) % 2 === 0,
        "expected even-length hex",
      );

  const uintMatch = /^uint(\d+)$/.exec(type);
  if (uintMatch) return uintSchema(Number(uintMatch[1]));
  const intMatch = /^int(\d+)$/.exec(type);
  if (intMatch) return intSchema(Number(intMatch[1]));
  const bytesMatch = /^bytes(\d+)$/.exec(type);
  if (bytesMatch) return fixedBytesSchema(Number(bytesMatch[1]));

  return z.unknown();
}
