import 'fake-indexeddb/auto';
import { describe, it, expect, afterEach } from 'vitest';
import { dynamicHttp } from './dynamicHttp';
import { useSettingsStore } from '@/entities/settings/model/store';
import { DEFAULT_RPC_URLS } from '@/entities/chain/model/chains';

afterEach(() => {
  useSettingsStore.setState({ rpcOverrides: {} });
});

describe('dynamicHttp', () => {
  it('resolves the URL from the settings override at instantiation time', () => {
    useSettingsStore.setState({ rpcOverrides: { 1: 'https://my.rpc' } });
    const transport = dynamicHttp(1)({});
    expect(transport.value?.url).toBe('https://my.rpc');
  });

  it('falls back to the curated default when no override is set', () => {
    useSettingsStore.setState({ rpcOverrides: {} });
    const transport = dynamicHttp(1)({});
    expect(transport.value?.url).toBe(DEFAULT_RPC_URLS[1]);
  });

  it('ignores an empty/whitespace override and uses the curated default', () => {
    useSettingsStore.setState({ rpcOverrides: { 1: '  ' } });
    const transport = dynamicHttp(1)({});
    expect(transport.value?.url).toBe(DEFAULT_RPC_URLS[1]);
  });
});
