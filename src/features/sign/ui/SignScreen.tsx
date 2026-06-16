'use client';

import { useRef, useState } from 'react';
import {
  useAccount,
  useChainId,
  useSendTransaction,
  useSignMessage,
} from 'wagmi';
import type { RpcProvider } from '@/shared/ports/rpc';
import { viemRpc } from '@/app/web3/services';
import { getChainDisplay } from '@/entities/chain/model/chains';
import { txUrl } from '@/entities/chain/model/explorer';
import { trunc } from '@/shared/lib/format';
import { fromBaseUnits } from '@/shared/lib/units/units';
import {
  parseUnsignedTx,
  type TParsedTx,
} from '@/features/sign/model/parseUnsignedTx';
import { Icon } from '@/shared/icons';
import {
  Badge,
  Button,
  Card,
  CardBody,
  CardHead,
  CardTitle,
  Eyebrow,
  Muted,
  Segment,
  Spinner,
  Textarea,
  useToast,
} from '@/shared/ui';
import { CopyBtn, ExtLink } from '@/shared/ui/copyable';
import { Field } from '@/shared/ui/field';
import { VerifyMessageCard } from './VerifyMessageCard';

// NOTE: the Sign page intentionally records NO history entries — signing/broadcasting
// here is not bound to a stored contract (no contractId).

type Deps = { rpc: RpcProvider };

type Mode = 'tx' | 'message';

const TX_SAMPLE = [
  '{',
  '  "to": "0xA0b86991c6218B36c1d19D4a2e9Eb0cE3606eB48",',
  '  "value": "0",',
  '  "data": "0xa9059cbb…",',
  '  "nonce": 142,',
  '  "gas": "51284"',
  '}',
].join('\n');

const MSG_SAMPLE =
  'I authorize this session for app.evm-cockpit.xyz\nNonce: 8f2a01';

/** Broadcast lifecycle for raw-tx mode. */
type TxStatus =
  | { kind: 'idle' }
  | { kind: 'wallet' }
  | { kind: 'pending'; hash: `0x${string}` }
  | { kind: 'confirmed'; hash: `0x${string}`; blockNumber: bigint }
  | { kind: 'failed'; error: string };

function SignRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-[13px]">
      <Muted className="text-xs">{k}</Muted>
      <span className="font-mono">{v}</span>
    </div>
  );
}

function errMessage(e: unknown): string {
  if (e && typeof e === 'object') {
    const o = e as { shortMessage?: unknown; message?: unknown };
    if (typeof o.shortMessage === 'string') return o.shortMessage;
    if (typeof o.message === 'string') return o.message;
  }
  return 'Something went wrong';
}

export function SignScreen({ deps }: { deps?: Deps }) {
  const rpc = deps?.rpc ?? viemRpc;
  const toast = useToast();
  const { isConnected } = useAccount();
  const walletChainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const { sendTransactionAsync } = useSendTransaction();

  const [mode, setMode] = useState<Mode>('tx');

  // ── Message mode ──
  const [message, setMessage] = useState('');
  const [signature, setSignature] = useState<`0x${string}` | null>(null);
  const [signError, setSignError] = useState<string | null>(null);
  const signBusyRef = useRef(false);
  const [signing, setSigning] = useState(false);
  const msgByteLength = new TextEncoder().encode(message).length;

  // ── Raw tx mode ──
  const [raw, setRaw] = useState('');
  const [txStatus, setTxStatus] = useState<TxStatus>({ kind: 'idle' });
  const sendBusyRef = useRef(false);

  const parsed = raw.trim() ? parseUnsignedTx(raw) : null;
  const tx: TParsedTx | null = parsed?.ok ? parsed.tx : null;
  const parseError = parsed && !parsed.ok ? parsed.error : null;

  async function handleSignMessage(): Promise<void> {
    if (!message || signBusyRef.current) return;
    signBusyRef.current = true;
    setSigning(true);
    setSignError(null);
    setSignature(null);
    try {
      const sig = await signMessageAsync({ message });
      setSignature(sig);
      toast({ kind: 'success', title: 'Message signed' });
    } catch (e) {
      const msg = errMessage(e);
      setSignError(msg);
      toast({ kind: 'error', title: 'Signing failed', msg });
    } finally {
      signBusyRef.current = false;
      setSigning(false);
    }
  }

  async function handleBroadcast(): Promise<void> {
    if (!tx || sendBusyRef.current) return;
    sendBusyRef.current = true;
    setTxStatus({ kind: 'wallet' });
    try {
      const hash = await sendTransactionAsync({
        to: tx.to,
        data: tx.data,
        value: tx.valueWei,
        gas: tx.gas,
        nonce: tx.nonce,
        maxFeePerGas: tx.maxFeePerGas,
        maxPriorityFeePerGas: tx.maxPriorityFeePerGas,
      });
      setTxStatus({ kind: 'pending', hash });
      const receipt = await rpc
        .getClient(walletChainId)
        .waitForTransactionReceipt({ hash });
      if (receipt.status === 'success') {
        setTxStatus({
          kind: 'confirmed',
          hash,
          blockNumber: receipt.blockNumber,
        });
        toast({ kind: 'success', title: 'Transaction confirmed' });
      } else {
        setTxStatus({ kind: 'failed', error: 'Transaction reverted' });
        toast({ kind: 'error', title: 'Transaction reverted' });
      }
    } catch (e) {
      const msg = errMessage(e);
      setTxStatus({ kind: 'failed', error: msg });
      toast({ kind: 'error', title: 'Broadcast failed', msg });
    } finally {
      sendBusyRef.current = false;
    }
  }

  const txBusy = txStatus.kind === 'wallet' || txStatus.kind === 'pending';

  const signDisabled = !message || !isConnected || signing;
  const signTitle = !isConnected ? 'Connect a wallet to sign' : undefined;

  const sendDisabled = !tx || !isConnected || txBusy;
  let sendTitle: string | undefined;
  if (!isConnected) sendTitle = 'Connect a wallet to broadcast';
  else if (!tx) sendTitle = 'Paste a valid unsigned transaction';

  let sendLabel = 'Sign & broadcast';
  if (txStatus.kind === 'wallet') sendLabel = 'Confirm in wallet…';
  else if (txStatus.kind === 'pending') sendLabel = 'Broadcasting…';

  const chainMismatch =
    tx?.chainId !== undefined && tx.chainId !== walletChainId;

  const confirmedHashLink =
    txStatus.kind === 'confirmed'
      ? txUrl(walletChainId, txStatus.hash)
      : undefined;

  return (
    <div className="mx-auto w-full max-w-[1080px] px-7 pb-16 pt-6">
      {/* page head */}
      <div className="mb-[22px]">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em]">Sign</h1>
        <p className="mt-1 max-w-[560px] text-[13px] leading-normal text-fg-3">
          Sign a raw transaction or message with a clear preview of exactly what
          you&apos;re authorizing.
        </p>
      </div>

      <div className="mb-4">
        <Segment
          value={mode}
          onChange={setMode}
          options={[
            {
              value: 'tx',
              label: 'Raw transaction',
              icon: <Icon.file size={14} />,
            },
            {
              value: 'message',
              label: 'Message',
              icon: <Icon.sign size={14} />,
            },
          ]}
        />
      </div>

      <div className="flex flex-col gap-[18px]">
        <Card>
          <CardHead>
            <CardTitle>
              {mode === 'tx' ? 'Transaction payload' : 'Message to sign'}
            </CardTitle>
          </CardHead>
          <CardBody className="flex flex-col gap-3.5">
            {mode === 'tx' ? (
              <>
                <Field
                  label="Unsigned transaction (JSON)"
                  error={parseError ?? undefined}
                >
                  <Textarea
                    mono
                    rows={7}
                    tone={parseError ? 'invalid' : 'default'}
                    placeholder={TX_SAMPLE}
                    value={raw}
                    onChange={(e) => setRaw(e.target.value)}
                  />
                </Field>

                {tx && (
                  <div className="rounded-sm border border-border bg-inset px-[15px] py-[13px]">
                    <Eyebrow>You are about to sign</Eyebrow>
                    <div className="mt-2.5 flex flex-col gap-[7px]">
                      <SignRow k="To" v={trunc(tx.to, 6)} />
                      <SignRow
                        k="Value"
                        v={`${fromBaseUnits(tx.valueWei ?? 0n, 'ether')} ETH`}
                      />
                      <SignRow
                        k="Data"
                        v={tx.data ? `${(tx.data.length - 2) / 2} bytes` : '—'}
                      />
                      <SignRow k="Nonce" v={tx.nonce ?? '—'} />
                      <SignRow
                        k="Gas"
                        v={tx.gas !== undefined ? tx.gas.toLocaleString() : '—'}
                      />
                      <SignRow
                        k="Chain"
                        v={
                          tx.chainId !== undefined ? (
                            <span className="inline-flex items-center gap-2">
                              {getChainDisplay(tx.chainId).name}
                              {chainMismatch && (
                                <Badge size="sm" variant="danger">
                                  wallet on different chain
                                </Badge>
                              )}
                            </span>
                          ) : (
                            '—'
                          )
                        }
                      />
                    </div>
                  </div>
                )}

                <Muted className="text-xs leading-normal">
                  Browser wallets can&apos;t return a signed transaction without
                  sending it — this signs and broadcasts.
                </Muted>

                <div className="flex items-center gap-2">
                  <Button
                    variant="write"
                    icon={txBusy ? <Spinner /> : <Icon.sign size={15} />}
                    onClick={() => void handleBroadcast()}
                    disabled={sendDisabled}
                    title={sendTitle}
                  >
                    {sendLabel}
                  </Button>
                </div>

                {/* broadcast status */}
                {txStatus.kind === 'pending' && (
                  <p className="font-mono text-[12px] text-fg-3">
                    Submitted · {trunc(txStatus.hash, 6)}
                  </p>
                )}
                {txStatus.kind === 'confirmed' && (
                  <p className="inline-flex items-center gap-1.5 font-mono text-[12px] text-success-fg">
                    Confirmed in block {txStatus.blockNumber.toString()} ·{' '}
                    {trunc(txStatus.hash, 6)}
                    {confirmedHashLink && <ExtLink href={confirmedHashLink} />}
                  </p>
                )}
                {txStatus.kind === 'failed' && (
                  <p className="font-mono text-[12px] text-danger-fg">
                    {txStatus.error}
                  </p>
                )}
              </>
            ) : (
              <>
                <Field label="Message">
                  <Textarea
                    mono
                    rows={7}
                    placeholder={MSG_SAMPLE}
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </Field>

                <div className="rounded-sm border border-border bg-inset px-[15px] py-[13px]">
                  <Eyebrow>You are about to sign</Eyebrow>
                  <div className="mt-2.5 flex flex-col gap-[7px]">
                    <SignRow k="Type" v="personal_sign" />
                    <SignRow k="Length" v={`${msgByteLength} bytes`} />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="write"
                    icon={signing ? <Spinner /> : <Icon.sign size={15} />}
                    onClick={() => void handleSignMessage()}
                    disabled={signDisabled}
                    title={signTitle}
                  >
                    Sign
                  </Button>
                </div>

                {signError && (
                  <p className="font-mono text-[12px] text-danger-fg">
                    {signError}
                  </p>
                )}

                {signature && (
                  <div className="rounded-sm border border-border bg-inset px-[15px] py-[13px]">
                    <div className="mb-2 flex items-center justify-between">
                      <Eyebrow>Signature</Eyebrow>
                      <Badge size="sm" variant="success">
                        signed
                      </Badge>
                    </div>
                    <div className="flex items-start gap-1.5">
                      <span className="break-all font-mono text-[12px] text-fg-2">
                        {signature}
                      </span>
                      <CopyBtn value={signature} />
                    </div>
                  </div>
                )}
              </>
            )}
          </CardBody>
        </Card>

        {mode === 'message' && <VerifyMessageCard />}
      </div>
    </div>
  );
}
