import { describe, it, expect } from 'vitest';
import { encodeErrorResult } from 'viem';
import { decodeRevert } from './decodeRevert';
import { erc20Abi } from '@/shared/lib/abi/fixtures';

describe('decodeRevert', () => {
  it('decodes a standard Error(string)', () => {
    const data = encodeErrorResult({
      abi: [{ type: 'error', name: 'Error', inputs: [{ type: 'string' }] }],
      errorName: 'Error',
      args: ['nope'],
    });
    expect(decodeRevert(erc20Abi, data)).toBe('reverted: "nope"');
  });

  it('decodes a custom error with args', () => {
    const data = encodeErrorResult({
      abi: erc20Abi,
      errorName: 'InsufficientBalance',
      args: [1n, 2n],
    });
    expect(decodeRevert(erc20Abi, data)).toContain('InsufficientBalance');
  });

  it('falls back gracefully on undecodable data', () => {
    expect(decodeRevert(erc20Abi, '0xdeadbeef')).toBe(
      'execution reverted (could not decode reason)',
    );
  });

  it('decodes a Panic code', () => {
    const data = encodeErrorResult({
      abi: [{ type: 'error', name: 'Panic', inputs: [{ type: 'uint256' }] }],
      errorName: 'Panic',
      args: [17n],
    });
    expect(decodeRevert(erc20Abi, data)).toBe('panic(17)');
  });

  it('decodes a custom error with no args', () => {
    const abi = [{ type: 'error', name: 'Unauthorized', inputs: [] }] as const;
    const data = encodeErrorResult({ abi, errorName: 'Unauthorized' });
    expect(decodeRevert(abi, data)).toBe('Unauthorized');
  });
});
