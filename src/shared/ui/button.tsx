import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { tv, type VariantProps } from 'tailwind-variants';

/**
 * Button — read=blue / write=amber semantics baked in.
 *
 *   variant: neutral | ghost | subtle | primary | read | write | success | danger
 *   fill:    auto (per-variant default) | solid | soft
 *   size:    sm | md | lg
 *
 * Per the original system: `read` defaults to a soft tint, `write` defaults
 * to solid (it sends a transaction — it should look like the loud verb).
 */
export const button = tv({
  base: [
    'inline-flex items-center justify-center gap-1.5 whitespace-nowrap select-none',
    'font-sans font-medium leading-none cursor-pointer',
    'border transition-[background-color,border-color,transform,box-shadow] duration-[110ms] ease-[var(--ease)]',
    '[&_svg]:flex-none',
    'active:translate-y-[0.5px]',
    'focus-visible:outline-none focus-visible:[box-shadow:0_0_0_2px_var(--bg),0_0_0_4px_var(--border-focus)]',
    'disabled:opacity-45 disabled:cursor-not-allowed disabled:pointer-events-none',
    'aria-disabled:opacity-45 aria-disabled:cursor-not-allowed aria-disabled:pointer-events-none',
  ],
  variants: {
    variant: {
      neutral:
        'bg-elev-3 text-fg border-border-strong hover:bg-[color-mix(in_oklab,var(--bg-elev-3)_88%,var(--text))]',
      ghost:
        'bg-transparent text-fg-2 border-transparent hover:bg-elev-3 hover:text-fg',
      subtle:
        'bg-elev-3 text-fg border-transparent hover:bg-[color-mix(in_oklab,var(--bg-elev-3)_88%,var(--text))]',
      primary:
        'bg-fg text-surface border-fg font-semibold hover:bg-[color-mix(in_oklab,var(--text)_90%,var(--bg))]',
      read: 'font-semibold',
      write: 'font-semibold',
      success: 'font-semibold',
      danger: '',
    },
    fill: { auto: '', solid: '', soft: '' },
    size: {
      sm: 'h-[26px] px-[9px] text-xs rounded-xs [&_svg]:size-[13px]',
      md: 'h-8 px-3 text-[13px] rounded-sm [&_svg]:size-[15px]',
      lg: 'h-[38px] px-4 text-sm rounded-sm [&_svg]:size-4',
    },
    iconOnly: { true: 'px-0', false: '' },
    block: { true: 'flex w-full', false: '' },
  },
  compoundVariants: [
    // READ — soft by default, solid on demand
    {
      variant: 'read',
      fill: ['auto', 'soft'],
      class:
        'bg-read-bg text-read-fg border-read-border hover:bg-read-bg-strong',
    },
    {
      variant: 'read',
      fill: 'solid',
      class: 'bg-read text-read-on border-read hover:bg-read-hover',
    },
    // WRITE — solid by default, soft on demand
    {
      variant: 'write',
      fill: ['auto', 'solid'],
      class: 'bg-write text-write-on border-write hover:bg-write-hover',
    },
    {
      variant: 'write',
      fill: 'soft',
      class:
        'bg-write-bg text-write-fg border-write-border hover:bg-write-bg-strong',
    },
    // SUCCESS — solid
    {
      variant: 'success',
      fill: ['auto', 'solid'],
      class: 'bg-success text-white border-success',
    },
    // DANGER — soft by default, solid on demand
    {
      variant: 'danger',
      fill: ['auto', 'soft'],
      class:
        'bg-danger-bg text-danger-fg border-danger-border hover:bg-danger-bg-strong',
    },
    {
      variant: 'danger',
      fill: 'solid',
      class: 'bg-danger text-white border-danger',
    },
    // icon-only sizing
    { iconOnly: true, size: 'sm', class: 'w-[26px]' },
    { iconOnly: true, size: 'md', class: 'w-8' },
    { iconOnly: true, size: 'lg', class: 'w-[38px]' },
  ],
  defaultVariants: { variant: 'neutral', size: 'md', fill: 'auto' },
});

type ButtonVariants = VariantProps<typeof button>;

export interface ButtonProps
  extends
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'>,
    Omit<ButtonVariants, 'iconOnly'> {
  icon?: ReactNode;
  iconRight?: ReactNode;
  children?: ReactNode;
}

export function Button({
  variant,
  size,
  fill,
  block,
  icon,
  iconRight,
  children,
  className,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={button({
        variant,
        size,
        fill,
        block,
        iconOnly: !children,
        className,
      })}
      {...rest}
    >
      {icon}
      {children}
      {iconRight}
    </button>
  );
}
