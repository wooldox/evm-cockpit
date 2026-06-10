import { describe, it, expect } from 'vitest';
import { privateKeyToAccount } from 'viem/accounts';
import { SIGNATURE_RE, verifySignedMessage } from './verifyMessage';

// The canonical dev key (anvil account #0) — fine to embed in tests.
const PK =
  '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as const;
const account = privateKeyToAccount(PK); // 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
const MESSAGE =
  'I authorize this session for app.evmcockpit.xyz\nNonce: 8f2a01';

describe('SIGNATURE_RE', () => {
  it('accepts a 65-byte 0x-hex string and rejects junk', () => {
    expect(SIGNATURE_RE.test(`0x${'ab'.repeat(65)}`)).toBe(true);
    expect(SIGNATURE_RE.test('0x1234')).toBe(false);
    expect(SIGNATURE_RE.test(`zz${'ab'.repeat(65)}`)).toBe(false);
    expect(SIGNATURE_RE.test(`0x${'ab'.repeat(64)}gg`)).toBe(false);
  });
});

describe('verifySignedMessage', () => {
  it('recovers the signer from a real signature (roundtrip)', async () => {
    const signature = await account.signMessage({ message: MESSAGE });
    const r = await verifySignedMessage({ message: MESSAGE, signature });
    expect(r).toEqual({ ok: true, recovered: account.address });
  });

  it('matches an expected signer case-insensitively', async () => {
    const signature = await account.signMessage({ message: MESSAGE });
    const r = await verifySignedMessage({
      message: MESSAGE,
      signature,
      expectedSigner: account.address.toLowerCase(),
    });
    expect(r.ok).toBe(true);
  });

  it('flags a mismatching expected signer but still exposes the recovered address', async () => {
    const signature = await account.signMessage({ message: MESSAGE });
    const r = await verifySignedMessage({
      message: MESSAGE,
      signature,
      expectedSigner: '0x0000000000000000000000000000000000000001',
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.recovered).toBe(account.address);
    expect(r.error).toMatch(/does not match/i);
  });

  it('a tampered message recovers a DIFFERENT signer (mismatch against expected)', async () => {
    const signature = await account.signMessage({ message: MESSAGE });
    const r = await verifySignedMessage({
      message: MESSAGE + ' (tampered)',
      signature,
      expectedSigner: account.address,
    });
    // ecrecover on a different digest yields some other address (or throws);
    // either way it must NOT verify as ok.
    expect(r.ok).toBe(false);
  });

  it('rejects a format-invalid signature without attempting recovery', async () => {
    const r = await verifySignedMessage({
      message: MESSAGE,
      signature: '0x1234',
    });
    expect(r).toEqual({
      ok: false,
      error: 'Malformed signature — expected a 65-byte 0x-hex string.',
    });
  });

  it('reports a recovery failure for valid-format-but-bogus signatures', async () => {
    // v byte = 0x00 → viem throws on signature parse/recovery.
    const r = await verifySignedMessage({
      message: MESSAGE,
      signature: `0x${'00'.repeat(65)}`,
    });
    expect(r.ok).toBe(false);
    if (r.ok) throw new Error('unreachable');
    expect(r.recovered).toBeUndefined();
  });

  it('trims whitespace around the signature', async () => {
    const signature = await account.signMessage({ message: MESSAGE });
    const r = await verifySignedMessage({
      message: MESSAGE,
      signature: `  ${signature}\n`,
    });
    expect(r).toEqual({ ok: true, recovered: account.address });
  });
});
