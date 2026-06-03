"use client";

import { useEffect, useState } from "react";
import { CHAIN_LIST, getChainDisplay } from "@/entities/chain/model/chains";
import { useTheme } from "@/shared/lib/use-theme";
import { Icon } from "@/shared/icons";
import { ChainGlyph } from "@/shared/ui";
import { useAppShell } from "@/widgets/app-shell/AppShellProvider";
import { WalletButton } from "@/app/web3/WalletButton";

/* ============================================================
   ChainSelector
   ============================================================ */
function ChainSelector() {
  const { currentChainId, setCurrentChainId } = useAppShell();
  const chain = getChainDisplay(currentChainId);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const h = () => setOpen(false);
    window.addEventListener("click", h);
    return () => window.removeEventListener("click", h);
  }, [open]);

  return (
    <div className="relative" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="flex h-[34px] items-center gap-2 rounded-sm border border-border-strong bg-elev-2 px-[11px] text-[13px] font-medium text-fg transition-colors hover:border-[var(--gray-500)]"
      >
        <ChainGlyph chain={chain} size={16} />
        {chain.name}
        <Icon.chevD size={13} className="opacity-60" />
      </button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 min-w-[230px] rounded-md border border-border-strong bg-elev-2 p-[5px] shadow-[var(--shadow-pop)] animate-pop-in">
          <div className="px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-fg-4">
            Network
          </div>
          {CHAIN_LIST.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                setCurrentChainId(c.id);
                setOpen(false);
              }}
              className="flex w-full items-center gap-[9px] rounded-sm border-0 bg-transparent px-2 py-[7px] text-left text-[13px] text-fg-2 cursor-pointer hover:bg-elev-3 hover:text-fg"
            >
              <ChainGlyph chain={c} size={16} />
              {c.name}
              <span className="ml-auto font-mono text-[11px] text-fg-4">
                {c.id}
              </span>
              {c.id === chain.id && (
                <Icon.check size={14} className="ml-auto text-read-fg" />
              )}
            </button>
          ))}
          <div className="my-[5px] h-px bg-border" />
          {/* TODO(M2c): custom chain entry flow */}
          <button
            type="button"
            className="flex w-full items-center gap-[9px] rounded-sm border-0 bg-transparent px-2 py-[7px] text-left text-[13px] text-fg-2 cursor-pointer hover:bg-elev-3 hover:text-fg"
          >
            <Icon.plus size={14} /> Add custom chain
          </button>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   TopBar
   ============================================================ */
export function TopBar() {
  const [theme, , toggle] = useTheme();

  return (
    <header className="z-20 flex h-[54px] flex-none items-center gap-2.5 border-b border-border bg-[color-mix(in_oklab,var(--bg-elev-1)_75%,transparent)] px-[18px] backdrop-blur-[10px]">
      <ChainSelector />
      <div className="flex-1" />
      <button
        type="button"
        title="Toggle theme"
        onClick={toggle}
        className="grid size-[34px] place-items-center rounded-sm border border-transparent bg-transparent text-fg-2 cursor-pointer transition-colors hover:bg-elev-3 hover:text-fg"
      >
        {theme === "dark" ? <Icon.sun size={16} /> : <Icon.moon size={16} />}
      </button>
      <button
        type="button"
        title="Settings (coming soon)"
        onClick={() => {
          // TODO(M2c): open Settings modal
        }}
        className="grid size-[34px] place-items-center rounded-sm border border-transparent bg-transparent text-fg-2 cursor-pointer transition-colors hover:bg-elev-3 hover:text-fg"
      >
        <Icon.settings size={16} />
      </button>
      <div className="mx-1 h-[22px] w-px bg-border" />
      <WalletButton />
    </header>
  );
}
