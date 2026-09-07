import { describe, it, expect } from 'vitest';
import { resolveRpcUrls } from './resolveRpcUrls';
import { DEFAULT_RPC_URLS } from './chains';

describe('resolveRpcUrls', () => {
  it('uses the user override alone when present', () => {
    expect(resolveRpcUrls(1, { 1: 'https://my.rpc' })).toEqual([
      'https://my.rpc',
    ]);
  });

  it('falls back to the curated list when no override', () => {
    expect(resolveRpcUrls(1, {})).toEqual([...DEFAULT_RPC_URLS[1]!]);
  });

  it('returns an empty list for an unknown chain with no override', () => {
    expect(resolveRpcUrls(999999, {})).toEqual([]);
  });

  it('treats an empty-string override as absent (falls through to curated)', () => {
    expect(resolveRpcUrls(1, { 1: '' })).toEqual([...DEFAULT_RPC_URLS[1]!]);
  });

  it('treats a whitespace-only override as absent (falls through to curated)', () => {
    expect(resolveRpcUrls(1, { 1: '   ' })).toEqual([...DEFAULT_RPC_URLS[1]!]);
  });

  it('returns an empty list for an unknown chain with an empty override', () => {
    expect(resolveRpcUrls(999999, { 999999: '  ' })).toEqual([]);
  });

  it('falls back to the catalog RPCs for a chain with no curated default', () => {
    expect(
      resolveRpcUrls(999999, {}, ['https://a.example', 'https://b.example']),
    ).toEqual(['https://a.example', 'https://b.example']);
  });

  it('prefers the override over the catalog RPCs, with no public fallback', () => {
    expect(
      resolveRpcUrls(999999, { 999999: 'https://my.rpc' }, ['https://a']),
    ).toEqual(['https://my.rpc']);
  });

  it('appends the catalog RPCs after the curated ones', () => {
    expect(resolveRpcUrls(1, {}, ['https://a.example'])).toEqual([
      ...DEFAULT_RPC_URLS[1]!,
      'https://a.example',
    ]);
  });

  it('dedupes a catalog RPC that is already curated', () => {
    expect(resolveRpcUrls(1, {}, [DEFAULT_RPC_URLS[1]![0]!])).toEqual([
      ...DEFAULT_RPC_URLS[1]!,
    ]);
  });

  it('returns an empty list when catalog RPCs are empty', () => {
    expect(resolveRpcUrls(999999, {}, [])).toEqual([]);
  });
});
