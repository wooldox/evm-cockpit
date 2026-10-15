'use client';

import type { AbiFunction, AbiParameter } from 'abitype';
import { Fragment, useCallback, useRef, useState, type JSX } from 'react';
import { SUPPORTED_VIEM_CHAINS } from '@/entities/chain/model/chains';
import { trunc } from '@/shared/lib/format';
import { stringifyWithBigint } from '@/shared/lib/json/stringify';
import { cx } from '@/shared/lib/cx';
import { Field, Input } from '@/shared/ui/field';
import { Address, Copyable, CopyBtn, ExtLink } from '@/shared/ui/copyable';
import { Badge } from '@/shared/ui/badge';
import { Menu, type MenuAnchor, type MenuItem } from '@/shared/ui/menu';
import { Muted } from '@/shared/ui/text';
import { Icon } from '@/shared/icons';
import { useValueViewStore } from '@/entities/value-view/model/store';
import {
  autoIntView,
  bytesText,
  formatInt,
  intViewLabel,
  KNOWN_INTERFACE_IDS,
  roleHashLabel,
  sameView,
  stringKind,
  uintMaxLabel,
  type TAutoIntView,
  type TIntView,
} from '@/shared/lib/values/interpret';
import { useValueContext, type TValueContext } from './valueContext';

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

/* ─── IntValue ────────────────────────────────────────────── */

/** Manual "view as" choices offered for every integer. */
function intViewOptions(ctx: TValueContext | null): TIntView[] {
  const opts: TIntView[] = [
    { kind: 'raw' },
    { kind: 'units', decimals: 18, symbol: ctx?.nativeSymbol ?? 'ETH' },
    { kind: 'units', decimals: 9, symbol: 'gwei' },
  ];
  if (ctx?.token)
    opts.push({
      kind: 'units',
      decimals: ctx.token.decimals,
      symbol: ctx.token.symbol,
    });
  for (const decimals of [6, 8])
    if (decimals !== ctx?.token?.decimals)
      opts.push({ kind: 'units', decimals });
  opts.push(
    { kind: 'date' },
    { kind: 'dateMs' },
    { kind: 'duration' },
    { kind: 'bps' },
    { kind: 'hex' },
  );
  return opts;
}

function ViewAsButton({
  viewKey,
  current,
  auto,
  override,
  ctx,
}: {
  viewKey: string;
  current: TIntView;
  auto: TAutoIntView | null;
  override: boolean;
  ctx: TValueContext | null;
}) {
  const [menu, setMenu] = useState<MenuAnchor | null>(null);
  const ref = useRef<HTMLButtonElement>(null);
  const close = useCallback(() => setMenu(null), []);
  const { setView, clearView } = useValueViewStore.getState();

  const check = (on: boolean) =>
    on ? <Icon.check size={13} /> : <span className="w-[13px]" />;
  const pick = (v: TIntView) =>
    // Choosing what auto would show anyway clears the override.
    sameView(v, auto?.view ?? { kind: 'raw' })
      ? clearView(viewKey)
      : setView(viewKey, v);

  const items: MenuItem[] = [
    {
      key: 'auto',
      label: `Auto · ${auto ? intViewLabel(auto.view) : 'raw number'}`,
      icon: check(!override),
      onSelect: () => clearView(viewKey),
    },
    ...intViewOptions(ctx).map((v, i) => ({
      key: `${i}`,
      label: intViewLabel(v),
      icon: check(override && sameView(v, current)),
      separated: i === 0,
      onSelect: () => pick(v),
    })),
  ];

  return (
    <>
      <button
        ref={ref}
        type="button"
        aria-label="View as…"
        aria-haspopup="menu"
        aria-expanded={!!menu}
        title={
          override
            ? `Viewing as ${intViewLabel(current)} (your choice)`
            : 'View as…'
        }
        onClick={() => {
          if (menu) return setMenu(null);
          const r = ref.current!.getBoundingClientRect();
          setMenu({ x: r.left, y: r.bottom + 4, flipY: r.top - 4 });
        }}
        className={cx(
          'grid size-[22px] flex-none cursor-pointer place-items-center rounded-xs border-0 bg-transparent transition-colors hover:bg-elev-4 hover:text-fg',
          override || menu ? 'text-read-fg' : 'text-fg-4',
        )}
      >
        <Icon.chevD size={13} />
      </button>
      {menu && (
        <Menu
          anchor={menu}
          items={items}
          onClose={close}
          label="View as"
          triggerRef={ref}
        />
      )}
    </>
  );
}

type TIntMeta = {
  name?: string;
  fnName?: string;
  standardAmount?: boolean;
  viewKey?: string;
};

/** Resolve an integer's view: the user's saved choice, else auto, else raw. */
function useIntView(value: bigint, meta: TIntMeta) {
  const ctx = useValueContext();
  const override = useValueViewStore((s) =>
    meta.viewKey ? s.views[meta.viewKey] : undefined,
  );
  const auto = autoIntView(value, {
    name: meta.name,
    fnName: meta.fnName,
    standardAmount: meta.standardAmount,
    token: ctx?.token,
    nativeSymbol: ctx?.nativeSymbol,
  });
  const view: TIntView = override ?? auto?.view ?? { kind: 'raw' };
  return { ctx, override, auto, view };
}

/** Column-level "view as" for a table of values (e.g. an event arg column):
 *  one trigger in the header instead of one per cell. `sample` is any value
 *  from the column, used to describe what auto would pick. */
export function ColumnViewAs({
  sample,
  viewKey,
  ...meta
}: Omit<TIntMeta, 'viewKey'> & { sample: bigint; viewKey: string }) {
  const { ctx, override, auto, view } = useIntView(sample, {
    ...meta,
    viewKey,
  });
  return (
    <ViewAsButton
      viewKey={viewKey}
      current={view}
      auto={auto}
      override={!!override}
      ctx={ctx}
    />
  );
}

function IntValue({
  type,
  value,
  name,
  fnName,
  standardAmount,
  viewKey,
  viewMenu,
}: TIntMeta & { type: string; value: bigint; viewMenu: boolean }) {
  const { ctx, override, auto, view } = useIntView(value, {
    name,
    fnName,
    standardAmount,
    viewKey,
  });
  const { text, sub } = formatInt(value, view);
  const raw = value.toString();
  const max = uintMaxLabel(type, value);
  const interpreted = view.kind !== 'raw';

  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-[7px]">
      <span
        className="min-w-0 font-mono tabular-nums [overflow-wrap:anywhere]"
        title={
          override
            ? `Viewing as ${intViewLabel(view)} (your choice)`
            : auto
              ? `Auto: ${auto.reason}`
              : undefined
        }
      >
        {text}
      </span>
      {sub && <Muted className="text-[12px]">{sub}</Muted>}
      {max && (
        <Badge size="sm" variant="neutral">
          {max}
        </Badge>
      )}
      {/* Raw value + view trigger stay together when the row wraps. */}
      <span className="inline-flex flex-none items-center gap-1">
        {interpreted || raw.length > 12 ? (
          <Copyable
            value={raw}
            display={raw.length > 16 ? trunc(raw, 6) : raw}
            className="text-[11px]"
          />
        ) : (
          <CopyBtn value={raw} />
        )}
        {viewKey && viewMenu && (
          <ViewAsButton
            viewKey={viewKey}
            current={view}
            auto={auto}
            override={!!override}
            ctx={ctx}
          />
        )}
      </span>
    </span>
  );
}

/* ─── TypedValue ──────────────────────────────────────────── */

export type TValueMeta = {
  /** Output / event-arg name (falls back to the function name for single outputs). */
  name?: string;
  /** Function that produced the value. */
  fnName?: string;
  /** ERC-20 Transfer/Approval amount — defined to use the token's decimals. */
  standardAmount?: boolean;
  /** Persistence key for the user's "view as" choice; omit to hide the menu. */
  viewKey?: string;
  /** Show the per-value "view as" trigger (false when a column header has it). */
  viewMenu?: boolean;
};

function Annotation({ children }: { children: React.ReactNode }) {
  return (
    <span className="min-w-0 font-mono text-[12px] text-fg-3 [overflow-wrap:anywhere]">
      {children}
    </span>
  );
}

export function TypedValue({
  type,
  value,
  chainId,
  name,
  fnName,
  standardAmount,
  viewKey,
  viewMenu = true,
}: {
  type: string;
  value: unknown;
  chainId?: number;
} & TValueMeta): JSX.Element {
  const ctx = useValueContext();
  const chain = chainId ?? ctx?.chainId;

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
    return <AddressValue value={value} chainId={chain} />;
  }

  /* ── bigint / int types ── */
  if (typeof value === 'bigint' || isIntType(type)) {
    let big: bigint | null = null;
    try {
      big = BigInt(value as string | number | bigint);
    } catch {
      /* not an integer after all — fall through to the fallback */
    }
    if (big !== null)
      return (
        <IntValue
          type={type}
          value={big}
          name={name ?? fnName}
          fnName={fnName}
          standardAmount={standardAmount}
          viewKey={viewKey}
          viewMenu={viewMenu}
        />
      );
  }

  /* ── string ── */
  if (type === 'string') {
    const str = String(value);
    const kind = stringKind(str);
    if (kind?.kind === 'json')
      return (
        <div className="flex w-full min-w-0 flex-col gap-1.5">
          <span className="inline-flex min-w-0 items-center gap-[7px]">
            <Annotation>decoded data: URI (JSON)</Annotation>
            <CopyBtn value={str} />
          </span>
          <JsonBlock json={kind.json} copy={kind.json} />
        </div>
      );
    return (
      <span className="inline-flex min-w-0 flex-wrap items-center gap-[7px]">
        <span className="min-w-0 font-mono text-success-fg [overflow-wrap:anywhere]">
          &quot;{str}&quot;
        </span>
        {kind?.kind === 'link' && <ExtLink href={kind.href} size={12} />}
      </span>
    );
  }

  /* ── arrays / tuples / objects ── */
  if (typeof value === 'object' && value !== null) {
    return (
      <JsonBlock
        json={stringifyWithBigint(value, 2)}
        copy={stringifyWithBigint(value)}
      />
    );
  }

  /* ── bytes* / fallback ── */
  const str = String(value);
  const label = /^bytes\d+$/.test(type)
    ? bytesLabel(type, str, name, ctx)
    : null;
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-[7px]">
      {str.length > 20 ? (
        <Copyable value={str} display={trunc(str, 8)} />
      ) : (
        <span className="min-w-0 font-mono [overflow-wrap:anywhere]">
          {str}
        </span>
      )}
      {label && <Annotation>{label}</Annotation>}
    </span>
  );
}

/** Address, labeled when it's the zero address or a contract saved (on this
 *  chain) in the sidebar. */
function AddressValue({ value, chainId }: { value: string; chainId?: number }) {
  const savedName = useValueContext()?.savedNames.get(value.toLowerCase());
  let explorerUrl: string | undefined;
  if (chainId != null) {
    const c = SUPPORTED_VIEM_CHAINS.find((x) => x.id === chainId);
    const base = c?.blockExplorers?.default?.url;
    if (base) explorerUrl = `${base}/address/${value}`;
  }
  const label = /^0x0{40}$/i.test(value) ? 'zero address' : savedName;
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-[7px]">
      <Address value={value} short withIdent={false} link={explorerUrl} />
      {label && <Annotation>{label}</Annotation>}
    </span>
  );
}

/** Certain readings of fixed-size bytes: role hashes (verified by hashing the
 *  name), selectors from this contract's ABI, ERC-165 ids, padded ASCII. */
function bytesLabel(
  type: string,
  value: string,
  name: string | undefined,
  ctx: TValueContext | null,
): string | null {
  if (type === 'bytes32') {
    if (name === 'DEFAULT_ADMIN_ROLE' && /^0x0{64}$/.test(value))
      return 'default admin role (0x00)';
    const role = roleHashLabel(name, value);
    if (role) return role;
  }
  if (type === 'bytes4') {
    const v = value.toLowerCase();
    const fn = ctx?.selectors.get(v);
    if (fn) return fn;
    const iface = KNOWN_INTERFACE_IDS[v];
    if (iface) return `${iface} interface id`;
  }
  const text = bytesText(value);
  return text ? `"${text}"` : null;
}

function JsonBlock({ json, copy }: { json: string; copy: string }) {
  return (
    <div className="relative w-full min-w-0 rounded-sm border border-border bg-inset">
      <pre className="overflow-x-auto px-3.5 py-2.5 font-mono text-[13px] leading-relaxed">
        {json}
      </pre>
      <span className="absolute right-1.5 top-1.5">
        <CopyBtn value={copy} />
      </span>
    </div>
  );
}

/* ─── ResultValue ─────────────────────────────────────────── */

/** A function's return value: one output renders inline; several render as a
 *  labeled list so each output gets its own type-aware display and view. */
export function ResultValue({
  fn,
  value,
  viewKeyBase,
  chainId,
}: {
  fn: AbiFunction;
  value: unknown;
  /** `<contractId>|<signature>` — per-output view keys append `|<index>`. */
  viewKeyBase?: string;
  chainId?: number;
}): JSX.Element {
  const outs = fn.outputs;
  const key = (i: number) => (viewKeyBase ? `${viewKeyBase}|${i}` : undefined);
  if (outs.length > 1 && Array.isArray(value) && value.length === outs.length) {
    return (
      <div className="grid w-full min-w-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-1.5">
        {outs.map((o, i) => (
          <Fragment key={i}>
            <span className="font-mono text-[12px] text-fg-3">
              {o.name || `[${i}]`}{' '}
              <span className="text-[11px] text-fg-4">{o.type}</span>
            </span>
            <TypedValue
              type={o.type}
              value={value[i]}
              chainId={chainId}
              name={o.name || undefined}
              fnName={fn.name}
              viewKey={key(i)}
            />
          </Fragment>
        ))}
      </div>
    );
  }
  return (
    <TypedValue
      type={outs[0]?.type ?? ''}
      value={value}
      chainId={chainId}
      name={outs[0]?.name || fn.name}
      fnName={fn.name}
      viewKey={key(0)}
    />
  );
}

/** Stable key base for a function's values: `<contractId>|name(types)`. */
export function fnViewKey(contractId: string, fn: AbiFunction): string {
  return `${contractId}|${fn.name}(${fn.inputs.map((i) => i.type).join(',')})`;
}
