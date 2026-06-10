import { recoverMessageAddress } from 'viem';
import type { Address } from 'viem';

/**
 * Outcome of an off-chain personal_sign verification. Pure ecrecover —
 * no RPC, no wallet. Known limitation: ERC-1271/ERC-6492 smart-account
 * signatures will not verify here (they need an on-chain isValidSignature
 * call); this covers EOA signatures, which is what our Sign panel produces.
 */
export type TVerifyResult =
  | { ok: true; recovered: Address }
  | { ok: false; recovered?: Address; error: string };

/** 65-byte (or longer) 0x-hex signature shape. */
export const SIGNATURE_RE = /^0x[0-9a-fA-F]{130,}$/;

export async function verifySignedMessage(args: {
  message: string;
  signature: string;
  /** Optional known signer to compare against (case-insensitive). The CALLER
   *  validates address format — a malformed expectedSigner simply mismatches. */
  expectedSigner?: string;
}): Promise<TVerifyResult> {
  const signature = args.signature.trim();
  if (!SIGNATURE_RE.test(signature)) {
    return {
      ok: false,
      error: 'Malformed signature — expected a 65-byte 0x-hex string.',
    };
  }

  let recovered: Address;
  try {
    recovered = await recoverMessageAddress({
      message: args.message,
      signature: signature as `0x${string}`,
    });
  } catch {
    return {
      ok: false,
      error: 'Could not recover a signer from this signature.',
    };
  }

  const expected = args.expectedSigner?.trim() ?? '';
  if (expected && expected.toLowerCase() !== recovered.toLowerCase()) {
    return {
      ok: false,
      recovered,
      error: 'Recovered signer does not match the expected address.',
    };
  }
  return { ok: true, recovered };
}
