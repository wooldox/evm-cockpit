"use client";

import { useAccount, useSwitchChain } from "wagmi";
import { useTheme } from "@/shared/lib/use-theme";
import { Icon } from "@/shared/icons";
import { useAppShell } from "@/widgets/app-shell/AppShellProvider";
import { ChainSelector } from "@/widgets/app-shell/ChainSelector";
import { WalletButton } from "@/app/web3/WalletButton";

/* ============================================================
   TopBar
   ============================================================ */
export function TopBar() {
  const [theme, , toggle] = useTheme();
  const { currentChainId, setCurrentChainId, openSettings } = useAppShell();
  const { isConnected, chainId: walletChainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  const handleChainChange = (id: number) => {
    setCurrentChainId(id);
    // Best-effort wallet sync: nudge the connected wallet to the new chain. The
    // app context changes regardless; the write flow still guards via
    // simulate + auto-switch. Fire-and-forget — rejections are swallowed.
    if (isConnected && walletChainId !== id) {
      // switchChainAsync's chainId type is the config's chains union, but the
      // config bundles every viem chain so the union widens to accept a plain
      // number (same precedent as useSendOperation). For a catalog-only (remote)
      // id this is still safe at runtime — the connector falls back to
      // wallet_addEthereumChain or rejects, which we catch.
      void switchChainAsync({ chainId: id }).catch(() => {});
    }
  };

  return (
    <header className="z-20 flex h-[54px] flex-none items-center gap-2.5 border-b border-border bg-[color-mix(in_oklab,var(--bg-elev-1)_75%,transparent)] px-[18px] backdrop-blur-[10px]">
      <ChainSelector value={currentChainId} onChange={handleChainChange} />
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
        title="Settings"
        onClick={openSettings}
        className="grid size-[34px] place-items-center rounded-sm border border-transparent bg-transparent text-fg-2 cursor-pointer transition-colors hover:bg-elev-3 hover:text-fg"
      >
        <Icon.settings size={16} />
      </button>
      <div className="mx-1 h-[22px] w-px bg-border" />
      <WalletButton />
    </header>
  );
}
