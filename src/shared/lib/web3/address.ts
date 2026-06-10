import { isAddress } from 'viem';
import type { TAddress } from '@/entities/contract/model/types';

export function isValidAddress(value: string): value is TAddress {
  return isAddress(value, { strict: false });
}

export function truncateAddress(address: string, head = 6, tail = 4): string {
  if (address.length <= head + tail) return address;
  return `${address.slice(0, head)}…${address.slice(-tail)}`;
}
