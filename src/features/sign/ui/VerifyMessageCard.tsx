'use client';

import { useRef, useState } from 'react';
import { isAddress } from 'viem';
import { cx } from '@/shared/lib/cx';
import { Icon } from '@/shared/icons';
import {
  Address,
  Button,
  Card,
  CardBody,
  CardHead,
  CardTitle,
  Eyebrow,
  Muted,
  Spinner,
  Textarea,
} from '@/shared/ui';
import { Field, Input } from '@/shared/ui/field';
import {
  SIGNATURE_RE,
  verifySignedMessage,
  type TVerifyResult,
} from '../model/verifyMessage';

// A real, valid example pair: EXAMPLE_MESSAGE signed by the canonical dev
// account 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 (anvil #0) — so the
// "Paste example" shortcut verifies green end-to-end.
const EXAMPLE_MESSAGE =
  'I authorize this session for app.evm-cockpit.xyz\nNonce: 8f2a01';
const EXAMPLE_SIGNATURE =
  '0x6848e23fe8322f3e91990437ad86b894c8c43f59ab36615651bde62cad1e1e1c6ebc1824375e812626d544aaf6f172835353aec3bc215ed40441825ac6a2b8051c';

/** The reverse of signing: recover a signer from a message + signature.
 *  Read-only (no gas, no wallet) — styled with the read (blue) accent. */
export function VerifyMessageCard() {
  const [msg, setMsg] = useState('');
  const [sig, setSig] = useState('');
  const [signer, setSigner] = useState('');
  const [result, setResult] = useState<TVerifyResult | null>(null);
  const [verifying, setVerifying] = useState(false);
  const busyRef = useRef(false);

  const sigFormatOk = SIGNATURE_RE.test(sig.trim());
  const signerTrim = signer.trim();
  const signerFormatOk = !signerTrim || isAddress(signerTrim);
  const canVerify =
    Boolean(msg.trim()) && Boolean(sig.trim()) && signerFormatOk && !verifying;

  async function handleVerify(): Promise<void> {
    if (!canVerify || busyRef.current) return;
    busyRef.current = true;
    setVerifying(true);
    try {
      const r = await verifySignedMessage({
        message: msg,
        signature: sig,
        expectedSigner: signerTrim || undefined,
      });
      setResult(r);
    } finally {
      busyRef.current = false;
      setVerifying(false);
    }
  }

  function fillExample(): void {
    setMsg(EXAMPLE_MESSAGE);
    setSig(EXAMPLE_SIGNATURE);
    setSigner('');
    setResult(null);
  }

  const headline = result?.ok
    ? signerTrim
      ? 'Signature valid · signer matches'
      : 'Valid signature'
    : 'Verification failed';

  let verifyTitle: string | undefined;
  if (!msg.trim() || !sig.trim())
    verifyTitle = 'Paste a message and its signature';
  else if (!signerFormatOk) verifyTitle = 'Fix the expected signer address';

  return (
    <Card>
      <CardHead>
        <Icon.checkCircle size={15} className="text-fg-3" />
        <CardTitle>Verify a signed message</CardTitle>
        <button
          type="button"
          onClick={fillExample}
          className="ml-auto cursor-pointer border-0 bg-transparent p-0 text-xs font-medium text-read-fg underline"
        >
          Paste example
        </button>
      </CardHead>
      <CardBody className="flex flex-col gap-3.5">
        <div className="inline-flex w-fit items-center gap-[7px] rounded-sm border border-read-border bg-read-bg px-2.5 py-1.5 text-xs font-medium text-read-fg">
          <Icon.eye size={13} /> Recovers the signer from a signature —
          read-only, costs no gas
        </div>

        <Field label="Message">
          <Textarea
            mono
            rows={3}
            aria-label="Message"
            placeholder="The original message that was signed"
            value={msg}
            onChange={(e) => {
              setMsg(e.target.value);
              setResult(null);
            }}
          />
        </Field>

        <Field
          label="Signature"
          type="65-byte hex"
          error={
            sig && !sigFormatOk
              ? 'Must be a 0x hex signature (≥ 65 bytes)'
              : undefined
          }
        >
          <Textarea
            mono
            rows={2}
            aria-label="Signature"
            tone={sig ? (sigFormatOk ? 'valid' : 'invalid') : 'default'}
            placeholder="0x…"
            value={sig}
            onChange={(e) => {
              setSig(e.target.value);
              setResult(null);
            }}
          />
        </Field>

        <Field
          label="Expected signer"
          hint="Optional — compare the recovered address against a known signer."
          error={!signerFormatOk ? 'Not a valid address' : undefined}
        >
          <Input
            mono
            aria-label="Expected signer"
            tone={!signerFormatOk ? 'invalid' : 'default'}
            placeholder="0x0000…0000"
            value={signer}
            onChange={(e) => {
              setSigner(e.target.value);
              setResult(null);
            }}
          />
        </Field>

        <div className="flex items-center gap-2">
          <Button
            variant="read"
            icon={verifying ? <Spinner /> : <Icon.checkCircle size={15} />}
            onClick={() => void handleVerify()}
            disabled={!canVerify}
            title={verifyTitle}
          >
            Verify signature
          </Button>
          <Muted className="text-xs">ecrecover · off-chain</Muted>
        </div>

        {result && (
          <div
            className={cx(
              'overflow-clip rounded-sm border',
              result.ok ? 'border-success-border' : 'border-danger-border',
            )}
          >
            <div
              className={cx(
                'flex items-center gap-[11px] px-3.5 py-3',
                result.ok ? 'bg-success-bg' : 'bg-danger-bg',
              )}
            >
              <span
                className={cx(
                  'grid size-[30px] flex-none place-items-center rounded-full [&_svg]:size-[17px]',
                  result.ok ? 'bg-success text-white' : 'bg-danger text-white',
                )}
              >
                {result.ok ? <Icon.checkCircle /> : <Icon.xCircle />}
              </span>
              <div className="flex-1">
                <div
                  className={cx(
                    'text-sm font-semibold',
                    result.ok ? 'text-success-fg' : 'text-danger-fg',
                  )}
                >
                  {headline}
                </div>
                <div className="text-xs text-fg-3">
                  {result.ok
                    ? 'The signature was produced by the recovered account.'
                    : result.error}
                </div>
              </div>
            </div>
            {result.recovered && (
              <div className="flex flex-col gap-1.5 px-3.5 py-3">
                <Eyebrow>Recovered signer</Eyebrow>
                <Address value={result.recovered} />
              </div>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
