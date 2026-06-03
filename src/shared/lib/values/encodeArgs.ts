import { encodeFunctionData, type Abi } from "viem";
import { paramSchema } from "./paramSchema";

export type EncodeError = { index: number; name: string; message: string };
export type EncodeResult =
  | { ok: true; data: `0x${string}`; args: unknown[] }
  | { ok: false; errors: EncodeError[] };

/** Find a function ABI item by name, picking the overload matching the arg count. */
function findFunction(abi: Abi, name: string, argCount: number) {
  const matches = abi.filter(
    (i): i is Extract<(typeof abi)[number], { type: "function" }> =>
      i.type === "function" && "name" in i && i.name === name,
  );
  return matches.find((f) => f.inputs.length === argCount) ?? matches[0];
}

/** Validate raw form values against the function's param types, then encode calldata. */
export function encodeCall(
  abi: Abi,
  name: string,
  rawArgs: unknown[],
): EncodeResult {
  const fn = findFunction(abi, name, rawArgs.length);
  if (!fn)
    return {
      ok: false,
      errors: [{ index: -1, name, message: "function not found" }],
    };

  if (fn.inputs.length !== rawArgs.length) {
    return {
      ok: false,
      errors: [
        {
          index: -1,
          name,
          message: `expected ${fn.inputs.length} args, got ${rawArgs.length}`,
        },
      ],
    };
  }

  const args: unknown[] = [];
  const errors: EncodeError[] = [];

  fn.inputs.forEach((input, index) => {
    const parsed = paramSchema(input.type).safeParse(rawArgs[index]);
    if (parsed.success) {
      args.push(parsed.data);
    } else {
      const firstIssue = parsed.error.issues[0];
      errors.push({
        index,
        name: input.name ?? `arg${index}`,
        message: firstIssue?.message ?? "invalid",
      });
    }
  });

  if (errors.length > 0) return { ok: false, errors };

  const data = encodeFunctionData({
    abi,
    functionName: name,
    args,
  }) as `0x${string}`;
  return { ok: true, data, args };
}
