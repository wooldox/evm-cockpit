"use client";

import type {
  InputHTMLAttributes,
  TextareaHTMLAttributes,
  SelectHTMLAttributes,
  ReactNode,
} from "react";
import { tv, type VariantProps } from "tailwind-variants";
import { Icon } from "@/shared/icons";

/* ---------- shared control styles ---------- */
const control = tv({
  base: [
    "w-full font-sans text-[13px] text-fg bg-elev-3 border rounded-sm outline-none",
    "transition-[border-color,box-shadow,background-color] duration-[110ms]",
    "placeholder:text-fg-4 hover:border-[var(--gray-500)]",
    "disabled:opacity-55 disabled:cursor-not-allowed",
  ],
  variants: {
    tone: {
      default:
        "border-border-strong focus:border-read focus:[box-shadow:0_0_0_3px_var(--read-bg)]",
      invalid: "border-danger focus:[box-shadow:0_0_0_3px_var(--danger-bg)]",
      valid:
        "border-success-border focus:border-read focus:[box-shadow:0_0_0_3px_var(--read-bg)]",
    },
    mono: { true: "font-mono", false: "" },
    as: {
      input: "h-[34px] px-2.5",
      // appearance-none kills the native caret (which sits flush against the
      // right edge and can't be padded) so we can pad the right and draw our
      // own chevron (see <Select/>) — consistent spacing across browsers.
      select:
        "h-[34px] pl-2.5 pr-8 appearance-none cursor-pointer [&::-ms-expand]:hidden",
      textarea: "min-h-[76px] px-2.5 py-2 leading-normal resize-y",
    },
  },
  defaultVariants: { tone: "default", as: "input", mono: false },
});

type ControlTone = VariantProps<typeof control>["tone"];

/* ---------- Field (label + hint/error wrapper) ---------- */
export interface FieldProps {
  label?: ReactNode;
  type?: string;
  required?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Field({
  label,
  type,
  required,
  hint,
  error,
  children,
  className,
}: FieldProps) {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      {label != null && (
        <label className="flex items-center gap-1.5 text-xs font-medium text-fg-2">
          {label}
          {required && <span className="text-write-fg">*</span>}
          {type && (
            <span className="rounded-xs border border-border bg-elev-3 px-1.5 py-px font-mono text-[11px] text-fg-3">
              {type}
            </span>
          )}
        </label>
      )}
      {children}
      {error ? (
        <span className="flex items-center gap-1.5 text-xs text-danger-fg">
          <Icon.alertCircle size={13} />
          {error}
        </span>
      ) : hint ? (
        <span className="text-xs text-fg-3">{hint}</span>
      ) : null}
    </div>
  );
}

/* ---------- Input ---------- */
export interface InputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "size"
> {
  tone?: ControlTone;
  mono?: boolean;
}
export function Input({ tone, mono, className, ...rest }: InputProps) {
  return (
    <input
      className={control({ tone, mono, as: "input", className })}
      {...rest}
    />
  );
}

/* ---------- Textarea ---------- */
export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  tone?: ControlTone;
  mono?: boolean;
}
export function Textarea({ tone, mono, className, ...rest }: TextareaProps) {
  return (
    <textarea
      className={control({ tone, mono, as: "textarea", className })}
      {...rest}
    />
  );
}

/* ---------- Select ---------- */
export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  tone?: ControlTone;
  mono?: boolean;
  /** Classes for the positioning wrapper (e.g. a width); replaces its
   *  default `w-full`. `className` still styles the <select> itself. */
  wrapClassName?: string;
}
export function Select({
  tone,
  mono,
  className,
  wrapClassName,
  children,
  ...rest
}: SelectProps) {
  return (
    <div className={`relative ${wrapClassName ?? "w-full"}`}>
      <select
        className={control({ tone, mono, as: "select", className })}
        {...rest}
      >
        {children}
      </select>
      <Icon.chevD
        size={14}
        className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-fg-3"
      />
    </div>
  );
}

/* ---------- SearchInput (leading magnifier) ---------- */
export interface SearchInputProps extends InputProps {
  wrapClassName?: string;
}
export function SearchInput({
  wrapClassName,
  className,
  ...rest
}: SearchInputProps) {
  return (
    <div className={`relative flex flex-1 items-center ${wrapClassName ?? ""}`}>
      <Icon.search
        size={14}
        className="pointer-events-none absolute left-2.5 text-fg-3"
      />
      <Input className={`pl-[30px] ${className ?? ""}`} {...rest} />
    </div>
  );
}
