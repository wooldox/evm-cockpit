import { z } from "zod";

export type TParsedTx = {
  to: `0x${string}`;
  data?: `0x${string}`;
  valueWei?: bigint;
  gas?: bigint;
  nonce?: number;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  chainId?: number;
};

/** Decimal-string-or-number → non-negative bigint. Rejects negatives and
 * non-integer numbers. */
const bigintLike = z.union([z.string(), z.number()]).transform((v, ctx) => {
  if (typeof v === "number") {
    if (!Number.isInteger(v)) {
      ctx.addIssue({ code: "custom", message: "must be an integer" });
      return z.NEVER;
    }
  }
  let parsed: bigint;
  try {
    parsed = BigInt(v);
  } catch {
    ctx.addIssue({ code: "custom", message: "must be an integer" });
    return z.NEVER;
  }
  if (parsed < 0n) {
    ctx.addIssue({ code: "custom", message: "must not be negative" });
    return z.NEVER;
  }
  return parsed;
});

const unsignedTxSchema = z.object({
  to: z
    .string()
    .regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x-prefixed 20-byte address"),
  data: z
    .string()
    .regex(/^0x([0-9a-fA-F]{2})*$/, "must be 0x-prefixed even-length hex")
    .optional(),
  value: bigintLike.optional(),
  gas: bigintLike.optional(),
  maxFeePerGas: bigintLike.optional(),
  maxPriorityFeePerGas: bigintLike.optional(),
  nonce: z.number().int().nonnegative().optional(),
  chainId: z.number().int().nonnegative().optional(),
});

/**
 * Parse a pasted unsigned-tx JSON string into a typed, validated shape.
 * Unknown keys (e.g. `from`) are ignored and dropped. On failure returns the
 * first issue as `"<path>: <message>"`, or "invalid JSON" for non-JSON input.
 */
export function parseUnsignedTx(
  raw: string,
): { ok: true; tx: TParsedTx } | { ok: false; error: string } {
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { ok: false, error: "invalid JSON" };
  }

  const result = unsignedTxSchema.safeParse(json);
  if (!result.success) {
    const issue = result.error.issues[0];
    const path = issue?.path.join(".") ?? "";
    const message = issue?.message ?? "invalid input";
    return { ok: false, error: path ? `${path}: ${message}` : message };
  }

  const d = result.data;
  const tx: TParsedTx = { to: d.to as `0x${string}` };
  if (d.data !== undefined) tx.data = d.data as `0x${string}`;
  if (d.value !== undefined) tx.valueWei = d.value;
  if (d.gas !== undefined) tx.gas = d.gas;
  if (d.maxFeePerGas !== undefined) tx.maxFeePerGas = d.maxFeePerGas;
  if (d.maxPriorityFeePerGas !== undefined)
    tx.maxPriorityFeePerGas = d.maxPriorityFeePerGas;
  if (d.nonce !== undefined) tx.nonce = d.nonce;
  if (d.chainId !== undefined) tx.chainId = d.chainId;
  return { ok: true, tx };
}
