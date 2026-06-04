/** JSON.stringify that serializes bigint as a decimal string. */
export function stringifyWithBigint(value: unknown, space?: number): string {
  return JSON.stringify(value, (_k, v) => (typeof v === "bigint" ? v.toString() : v), space);
}
