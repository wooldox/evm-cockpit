import 'fake-indexeddb/auto';
import { describe, it, expect, afterEach } from 'vitest';
import { dynamicHttp } from './dynamicHttp';
import { useSettingsStore } from '@/entities/settings/model/store';
import { DEFAULT_RPC_URLS } from '@/entities/chain/model/chains';
import type { Transport } from 'viem';

/** Ordered URLs behind an instantiated transport (a fallback list, or the
 *  single http URL when only one endpoint is known). */
function urlsOf(transport: ReturnType<Transport>): (string | undefined)[] {
  const v = transport.value as
    | { url?: string; transports?: { value?: { url?: string } }[] }
    | undefined;
  return v?.transports ? v.transports.map((s) => s.value?.url) : [v?.url];
}

afterEach(() => {
  useSettingsStore.setState({ rpcOverrides: {} });
});

describe('dynamicHttp', () => {
  it('resolves the URL from the settings override at instantiation time', () => {
    useSettingsStore.setState({ rpcOverrides: { 1: 'https://my.rpc' } });
    expect(urlsOf(dynamicHttp(1)({}))).toEqual(['https://my.rpc']);
  });

  it('falls back to the curated list, in order, when no override is set', () => {
    useSettingsStore.setState({ rpcOverrides: {} });
    const urls = urlsOf(dynamicHttp(1)({}));
    expect(urls.slice(0, DEFAULT_RPC_URLS[1]!.length)).toEqual([
      ...DEFAULT_RPC_URLS[1]!,
    ]);
  });

  it('ignores an empty/whitespace override and uses the curated default', () => {
    useSettingsStore.setState({ rpcOverrides: { 1: '  ' } });
    expect(urlsOf(dynamicHttp(1)({}))[0]).toBe(DEFAULT_RPC_URLS[1]![0]);
  });
});
