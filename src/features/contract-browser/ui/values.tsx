'use client';

import type { AbiParameter } from 'abitype';
import type { JSX } from 'react';
import { SUPPORTED_VIEM_CHAINS } from '@/entities/chain/model/chains';
import { fmtBig, trunc } from '@/shared/lib/format';
import { stringifyWithBigint } from '@/shared/lib/json/stringify';
import { cx } from '@/shared/lib/cx';
import { Field, Input } from '@/shared/ui/field';
import { Address, Copyable, CopyBtn } from '@/shared/ui/copyable';

/* ─── helpers ─────────────────────────────────────────────── */

/** True for uint* / int* types. */
function isIntType(type: string): boolean {
  return /^u?int/.test(type);
}

/** Placeholder text driven by the ABI type. */
function placeholderFor(type: string): string {
  // Array / tuple checks must come BEFORE the bare-type checks so that
  // e.g. "uint256[]" doesn't accidentally match isIntType.
  if (type.endsWith(']') || type.startsWith('tuple')) {
    return 'JSON, e.g. ["…", …]';
  }
  if (type === 'address') return '0x0000000000000000000000000000000000000000';
  if (type === 'bool') return 'true | false';
  if (/^bytes/.test(type)) return '0x…';
  if (type === 'string') return '…';
  if (isIntType(type)) return '0';
  return '…';
}

/* ─── ParamInput ──────────────────────────────────────────── */

export function ParamInput({
  param,
  value,
  error,
  onChange,
  autoFocus,
}: {
  param: AbiParameter;
  value: string | undefined;
  error?: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}): JSX.Element {
  const label = 'name' in param && param.name ? param.name : 'arg';
  const ph = placeholderFor(param.type);
  // TODO(nicety): unit toggle for uint amounts
  return (
    <Field label={label} type={param.type} error={error}>
      <Input
        mono
        tone={error ? 'invalid' : 'default'}
        placeholder={ph}
        value={value ?? ''}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
      />
    </Field>
  );
}

/* ─── TypedValue ──────────────────────────────────────────── */

export function TypedValue({
  type,
  value,
  chainId,
}: {
  type: string;
  value: unknown;
  chainId?: number;
}): JSX.Element {
  /* ── bool ── */
  if (type === 'bool' || value === true || value === false) {
    const v = value === true || value === 'true' || String(value) === 'true';
    return (
      <span
        className={cx('font-mono', v ? 'text-success-fg' : 'text-danger-fg')}
      >
        {v ? '✓ true' : '✗ false'}
      </span>
    );
  }

  /* ── address ── */
  if (type === 'address' && typeof value === 'string') {
    let explorerUrl: string | undefined;
    if (chainId != null) {
      const chain = SUPPORTED_VIEM_CHAINS.find((c) => c.id === chainId);
      const base = chain?.blockExplorers?.default?.url;
      if (base) explorerUrl = `${base}/address/${value}`;
    }
    return <Address value={value} short withIdent={false} link={explorerUrl} />;
  }

  /* ── bigint / int types ── */
  if (typeof value === 'bigint' || isIntType(type)) {
    const formatted = fmtBig(value as string | number | bigint);
    const raw = typeof value === 'bigint' ? value.toString() : String(value);
    const long = raw.length > 12;
    return (
      <span className="inline-flex items-center gap-[7px]">
        <span className="font-mono tabular-nums">{formatted}</span>
        {long && (
          <Copyable
            value={raw}
            display={trunc(raw, 6)}
            className="text-[11px]"
          />
        )}
        {!long && <CopyBtn value={raw} />}
      </span>
    );
  }

  /* ── string ── */
  if (type === 'string') {
    return (
      <span className="font-mono text-success-fg">
        &quot;{String(value)}&quot;
      </span>
    );
  }

  /* ── arrays / tuples / objects ── */
  if (typeof value === 'object' && value !== null) {
    const json = stringifyWithBigint(value, 2);
    const compact = stringifyWithBigint(value);
    return (
      <div className="relative w-full rounded-sm border border-border bg-inset">
        <pre className="overflow-x-auto px-3.5 py-2.5 font-mono text-[13px] leading-relaxed">
          {json}
        </pre>
        <span className="absolute right-1.5 top-1.5">
          <CopyBtn value={compact} />
        </span>
      </div>
    );
  }

  /* ── bytes* / fallback ── */
  const str = String(value);
  if (str.length > 20) {
    return <Copyable value={str} display={trunc(str, 8)} />;
  }
  return <span className="font-mono">{str}</span>;
}
