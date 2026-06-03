"use client";

/**
 * Switch — peer-driven toggle. The track and thumb react to the hidden
 * checkbox via Tailwind's `peer-checked:` variants (no JS state needed beyond
 * the controlled value).
 */
export function Switch({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange?: (next: boolean) => void;
}) {
  return (
    <label className="relative inline-block h-5 w-9 flex-none cursor-pointer">
      <input
        type="checkbox"
        className="peer absolute inset-0 m-0 cursor-pointer opacity-0"
        checked={checked}
        onChange={(e) => onChange?.(e.target.checked)}
      />
      <span className="absolute inset-0 rounded-full border border-border-strong bg-elev-4 transition-colors duration-[170ms] peer-checked:border-read peer-checked:bg-read" />
      <span className="absolute left-0.5 top-0.5 size-3.5 rounded-full bg-fg-2 transition-[transform,background-color] duration-[170ms] ease-[var(--ease)] peer-checked:translate-x-4 peer-checked:bg-white" />
    </label>
  );
}
