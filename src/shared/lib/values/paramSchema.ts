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
    try {
      const n = BigInt(v as string);
      if (n < 0n) throw new Error("negative");
      if (n > max) throw new Error("overflow");
      return n;
    } catch {
      ctx.addIssue({ code: "custom", message: `invalid uint${bits}` });
      return z.NEVER;
    }
  });
}

function intSchema(bits: number) {
  const limit = 1n << BigInt(bits - 1);
  return z.union([z.string(), z.number(), z.bigint()]).transform((v, ctx) => {
    try {
      const n = BigInt(v as string);
      if (n < -limit || n > limit - 1n) throw new Error("range");
      return n;
    } catch {
      ctx.addIssue({ code: "custom", message: `invalid int${bits}` });
      return z.NEVER;
    }
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
