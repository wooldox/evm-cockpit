/**
 * cx — tiny className joiner (clsx-lite). Filters falsy values.
 * Used everywhere a conditional class is needed without pulling in a dep.
 * For variant logic we use tailwind-variants (tv); cx is for one-off joins.
 */
export type ClassValue = string | number | false | null | undefined;

export function cx(...parts: ClassValue[]): string {
  return parts.filter(Boolean).join(' ');
}
