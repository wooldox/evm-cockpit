import type { AbiFunction } from 'abitype';
import { paramSchema } from '@/shared/lib/values/paramSchema';
import { toBaseUnits, type EthUnit } from '@/shared/lib/units/units';

export type ParsedInputs =
  | { ok: true; args: readonly unknown[]; value: bigint | undefined }
  | {
      ok: false;
      argErrors: Record<string, string>;
      valueError: string | undefined;
    };

/**
 * Validate + coerce an operation's raw form inputs into typed args and an
 * optional payable value. Pure: the single source of truth shared by the
 * Simulate and Execute paths so a signed tx can never use args that differ
 * from what was validated/displayed. Arg keys are the input name, or the
 * positional index for unnamed inputs.
 */
export function parseOperationInputs(
  fn: AbiFunction,
  rawArgs: Record<string, string>,
  rawValue?: { amount: string; unit: EthUnit },
): ParsedInputs {
  const argErrors: Record<string, string> = {};
  const args: unknown[] = [];
  for (let i = 0; i < fn.inputs.length; i++) {
    const input = fn.inputs[i]!;
    const key = input.name ?? String(i);
    const raw = rawArgs[key] ?? '';
    const parsed = paramSchema(input.type).safeParse(raw);
    if (!parsed.success) {
      argErrors[key] = parsed.error.issues[0]?.message ?? 'invalid value';
    } else {
      args.push(parsed.data);
    }
  }

  let value: bigint | undefined;
  let valueError: string | undefined;
  if (rawValue) {
    const amount = rawValue.amount.trim();
    if (amount !== '' && amount !== '0') {
      try {
        value = toBaseUnits(amount, rawValue.unit);
      } catch (e) {
        valueError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  if (Object.keys(argErrors).length > 0 || valueError !== undefined) {
    return { ok: false, argErrors, valueError };
  }
  return { ok: true, args, value };
}
