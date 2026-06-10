'use client';

import { useCopy } from '@/shared/lib/use-copy';
import { identGradient, trunc } from '@/shared/lib/format';
import { Icon } from '@/shared/icons';
import { cx } from '@/shared/lib/cx';

/* ---------- Ident — deterministic gradient identicon ---------- */
export function Ident({ seed, size = 16 }: { seed: string; size?: number }) {
  return (
    <span
      className="inline-block flex-none rounded-[4px]"
      style={{ width: size, height: size, background: identGradient(seed) }}
    />
  );
}

/* ---------- CopyBtn ---------- */
export function CopyBtn({
  value,
  size = 13,
}: {
  value: unknown;
  size?: number;
}) {
  const [copied, copy] = useCopy();
  return (
    <button
      type="button"
      title="Copy"
      className={cx(
        'inline-grid size-[22px] flex-none place-items-center rounded-xs border-0 bg-transparent',
        'cursor-pointer transition-[background-color,color] duration-[110ms]',
        'hover:bg-elev-4 hover:text-fg',
        copied ? 'text-success-fg' : 'text-fg-3',
      )}
      onClick={(e) => {
        e.stopPropagation();
        copy(value);
      }}
    >
      {copied ? <Icon.check size={size} /> : <Icon.copy size={size} />}
    </button>
  );
}

/* ---------- Copyable — mono value pill (hashes, big numbers) ---------- */
export function Copyable({
  value,
  display,
  link,
  mono = true,
  className,
}: {
  value: string;
  display?: string;
  link?: string;
  mono?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cx(
        'inline-flex max-w-full items-center gap-1.5 rounded-xs border border-border bg-inset py-[3px] pl-[9px] pr-1 text-[13px] text-fg',
        className,
      )}
    >
      <span
        className={cx(
          'overflow-hidden text-ellipsis whitespace-nowrap',
          mono && 'font-mono',
        )}
      >
        {display ?? value}
      </span>
      {link && <ExtLink href={link} />}
      <CopyBtn value={value} />
    </span>
  );
}

/* ---------- Address — ident + mono address + copy ---------- */
export function Address({
  value,
  link,
  short = false,
  withIdent = true,
}: {
  value: string;
  link?: string;
  short?: boolean;
  withIdent?: boolean;
}) {
  return (
    <span className="inline-flex max-w-full items-center gap-[7px] rounded-xs border border-border bg-inset py-[3px] pl-[9px] pr-1 text-[13px] text-fg">
      {withIdent && <Ident seed={value} />}
      <span className="overflow-hidden text-ellipsis whitespace-nowrap font-mono">
        {short ? trunc(value, 6) : value}
      </span>
      {link && <ExtLink href={link} />}
      <CopyBtn value={value} />
    </span>
  );
}

/* ---------- ExtLink — explorer out-link ---------- */
export function ExtLink({ href, size = 13 }: { href: string; size?: number }) {
  return (
    <a
      className="inline-grid place-items-center text-fg-3 transition-colors hover:text-read-fg"
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(e) => e.stopPropagation()}
      title="View on explorer"
    >
      <Icon.external size={size} />
    </a>
  );
}
