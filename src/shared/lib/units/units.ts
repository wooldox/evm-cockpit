import { parseUnits, formatUnits } from "viem";

export type EthUnit = "wei" | "gwei" | "ether";

const ETH_DECIMALS: Record<EthUnit, number> = { wei: 0, gwei: 9, ether: 18 };

/** Convert a human decimal string to base units (bigint). `unit` is an EthUnit or token decimals. */
export function toBaseUnits(value: string, unit: EthUnit | number): bigint {
  const decimals = typeof unit === "number" ? unit : ETH_DECIMALS[unit];
  if (decimals === 0 && value.includes(".")) {
    throw new Error("wei amounts must be integers");
  }
  return parseUnits(value, decimals);
}

/** Convert base units (bigint) back to a human decimal string. */
export function fromBaseUnits(value: bigint, unit: EthUnit | number): string {
  const decimals = typeof unit === "number" ? unit : ETH_DECIMALS[unit];
  return formatUnits(value, decimals);
}
