import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  buildUnsignedTxJson,
  downloadJson,
  type UnsignedTx,
} from './downloadUnsignedTx';

const FULL_TX: UnsignedTx = {
  chainId: 1,
  to: '0xabc0000000000000000000000000000000000001',
  data: '0xdeadbeef',
  value: 1000000000000000000n,
  gas: 21000n,
  nonce: 5,
  maxFeePerGas: 30000000000n,
  maxPriorityFeePerGas: 1500000000n,
  from: '0xdef0000000000000000000000000000000000002',
};

const MINIMAL_TX: UnsignedTx = {
  chainId: 137,
  to: '0xabc0000000000000000000000000000000000001',
  data: '0x',
};

describe('buildUnsignedTxJson', () => {
  it('serializes bigint values as decimal strings and numbers remain numbers', () => {
    const json = buildUnsignedTxJson(FULL_TX);
    const parsed = JSON.parse(json) as Record<string, unknown>;

    expect(parsed['value']).toBe('1000000000000000000');
    expect(parsed['gas']).toBe('21000');
    expect(parsed['maxFeePerGas']).toBe('30000000000');
    expect(parsed['maxPriorityFeePerGas']).toBe('1500000000');

    expect(parsed['chainId']).toBe(1);
    expect(parsed['nonce']).toBe(5);
  });

  it('omits optional keys when not provided (undefined keys absent from output)', () => {
    const json = buildUnsignedTxJson(MINIMAL_TX);
    const parsed = JSON.parse(json) as Record<string, unknown>;

    expect('value' in parsed).toBe(false);
    expect('gas' in parsed).toBe(false);
    expect('nonce' in parsed).toBe(false);
    expect('maxFeePerGas' in parsed).toBe(false);
    expect('maxPriorityFeePerGas' in parsed).toBe(false);
    expect('from' in parsed).toBe(false);
  });

  it('required fields are present in minimal tx', () => {
    const json = buildUnsignedTxJson(MINIMAL_TX);
    const parsed = JSON.parse(json) as Record<string, unknown>;

    expect(parsed['chainId']).toBe(137);
    expect(parsed['to']).toBe('0xabc0000000000000000000000000000000000001');
    expect(parsed['data']).toBe('0x');
  });

  it('produces 2-space pretty-printed output', () => {
    const json = buildUnsignedTxJson(MINIMAL_TX);
    expect(json).toContain('\n  "');
  });
});

describe('downloadJson', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('creates a Blob, triggers an anchor click with correct attributes, and revokes the URL', () => {
    const fakeUrl = 'blob:fake-url-123';
    const createObjectURL = vi.fn().mockReturnValue(fakeUrl);
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL,
      revokeObjectURL,
    });

    const clickSpy = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    const json = '{"test":true}';
    downloadJson('tx.json', json);

    // createObjectURL was called with a Blob containing our JSON
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blobArg = createObjectURL.mock.calls[0]?.[0] as Blob;
    expect(blobArg).toBeInstanceOf(Blob);
    expect(blobArg.type).toBe('application/json');

    // anchor click was fired
    expect(clickSpy).toHaveBeenCalledTimes(1);

    // revokeObjectURL was called with the same URL
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith(fakeUrl);

    // anchor is no longer in the DOM
    const anchors = document.querySelectorAll('a[download]');
    expect(anchors).toHaveLength(0);
  });

  it('sets the download attribute to the provided filename', () => {
    const fakeUrl = 'blob:fake-url-456';
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn().mockReturnValue(fakeUrl),
      revokeObjectURL: vi.fn(),
    });

    let capturedDownload: string | null = null;
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      capturedDownload = this.download;
    });

    downloadJson('unsigned-tx-1.json', '{}');

    expect(capturedDownload).toBe('unsigned-tx-1.json');
  });
});
