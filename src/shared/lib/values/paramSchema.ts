import { z } from 'zod';
import { isAddress, isHex } from 'viem';

const addressSchema = z
  .string()
  .refine((v) => isAddress(v, { strict: false }), 'invalid address');

const boolSchema = z.preprocess((v) => {
  if (typeof v === 'boolean') return v;
  if (v === 'true') return true;
  if (v === 'false') return false;
  return v;
}, z.boolean());

function uintSchema(bits: number) {
  const max = (1n << BigInt(bits)) - 1n;
  return z.union([z.string(), z.number(), z.bigint()]).transform((v, ctx) => {
    let n: bigint;
    if (typeof v === 'number') {
      if (!Number.isInteger(v) || Math.abs(v) > Number.MAX_SAFE_INTEGER) {
        ctx.addIssue({ code: 'custom', message: `invalid uint${bits}` });
        return z.NEVER;
      }
      n = BigInt(v);
    } else {
      try {
        n = BigInt(v as string | bigint);
      } catch {
        ctx.addIssue({ code: 'custom', message: `invalid uint${bits}` });
        return z.NEVER;
      }
    }
    if (n < 0n) {
      ctx.addIssue({ code: 'custom', message: `invalid uint${bits}` });
      return z.NEVER;
    }
    if (n > max) {
      ctx.addIssue({ code: 'custom', message: `invalid uint${bits}` });
      return z.NEVER;
    }
    return n;
  });
}

function intSchema(bits: number) {
  const limit = 1n << BigInt(bits - 1);
  return z.union([z.string(), z.number(), z.bigint()]).transform((v, ctx) => {
    let n: bigint;
    if (typeof v === 'number') {
      if (!Number.isInteger(v) || Math.abs(v) > Number.MAX_SAFE_INTEGER) {
        ctx.addIssue({ code: 'custom', message: `invalid int${bits}` });
        return z.NEVER;
      }
      n = BigInt(v);
    } else {
      try {
        n = BigInt(v as string | bigint);
      } catch {
        ctx.addIssue({ code: 'custom', message: `invalid int${bits}` });
        return z.NEVER;
      }
    }
    if (n < -limit || n > limit - 1n) {
      ctx.addIssue({ code: 'custom', message: `invalid int${bits}` });
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

/**
 * Quote bare integer and 0x-hex tokens (outside of strings) so that
 * `[1000000000000000000000]` keeps full precision through JSON.parse and
 * Etherscan-style `[0xabc…, 0xdef…]` parses at all.
 */
function quoteBareTokens(json: string): string {
  let out = '';
  let inString = false;
  for (let i = 0; i < json.length; i++) {
    const c = json[i]!;
    if (inString) {
      out += c;
      if (c === '\\') out += json[++i] ?? '';
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') {
      inString = true;
      out += c;
      continue;
    }
    const m = /^(?:0x[0-9a-fA-F]*|-?\d+)(?![\w.])/.exec(json.slice(i));
    if (m) {
      out += `"${m[0]}"`;
      i += m[0].length - 1;
      continue;
    }
    out += c;
  }
  return out;
}

/**
 * Form fields hand us strings; array params need a real array. Parse the
 * JSON text the input placeholder asks for. Non-strings pass through, so
 * already-structured values (and nested arrays) are untouched.
 */
function arraySchema(element: z.ZodType, length?: number): z.ZodType {
  const base =
    length === undefined ? z.array(element) : z.array(element).length(length);
  return z.preprocess((v, ctx) => {
    if (typeof v !== 'string') return v;
    try {
      return JSON.parse(quoteBareTokens(v.trim()));
    } catch {
      ctx.addIssue({
        code: 'custom',
        message: 'expected a JSON array, e.g. [1, 2]',
      });
      return z.NEVER;
    }
  }, base);
}

/** Build a zod schema for a single ABI parameter type string. */
export function paramSchema(type: string): z.ZodType {
  if (type.endsWith('[]')) {
    return arraySchema(paramSchema(type.slice(0, -2)));
  }
  const fixedArr = /^(.+)\[(\d+)\]$/.exec(type);
  if (fixedArr) {
    return arraySchema(paramSchema(fixedArr[1]!), Number(fixedArr[2]!));
  }
  if (type === 'address') return addressSchema;
  if (type === 'bool') return boolSchema;
  if (type === 'string') return z.string();
  if (type === 'bytes')
    return z
      .string()
      .refine(
        (v) => isHex(v) && (v.length - 2) % 2 === 0,
        'expected even-length hex',
      );

  const uintMatch = /^uint(\d+)$/.exec(type);
  if (uintMatch) return uintSchema(Number(uintMatch[1]));
  const intMatch = /^int(\d+)$/.exec(type);
  if (intMatch) return intSchema(Number(intMatch[1]));
  const bytesMatch = /^bytes(\d+)$/.exec(type);
  if (bytesMatch) return fixedBytesSchema(Number(bytesMatch[1]));

  return z.unknown();
}
