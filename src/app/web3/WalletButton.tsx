"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Icon } from "@/shared/icons";
import { Ident } from "@/shared/ui/copyable";
import { trunc } from "@/shared/lib/format";

export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openConnectModal, openAccountModal, mounted }) => {
        // Guard: RainbowKit not yet ready (avoids hydration mismatch).
        if (!mounted) {
          return (
            <button
              type="button"
              aria-hidden="true"
              className="inline-flex h-9 items-center gap-2 rounded-[11px] border-0 px-[15px] text-[13px] font-semibold text-white opacity-0"
            >
              Connect Wallet
            </button>
          );
        }

        // Not connected
        if (!account || !chain) {
          return (
            <button
              type="button"
              onClick={openConnectModal}
              className="inline-flex h-9 items-center gap-2 rounded-[11px] border-0 px-[15px] text-[13px] font-semibold text-white transition-[filter,box-shadow,transform] hover:brightness-110 active:translate-y-[0.5px]"
              style={{
                background:
                  "linear-gradient(135deg, var(--read) 0%, #7c5cff 55%, var(--write) 130%)",
                boxShadow:
                  "0 2px 12px -2px color-mix(in oklab, var(--read) 50%, transparent)",
              }}
            >
              <Icon.wallet size={15} /> Connect Wallet
            </button>
          );
        }

        // No chain pill: the TopBar ChainSelector is the single network selector,
        // and chain.unsupported is near-unreachable now that the wagmi config
        // bundles every viem chain — so we render the account pill only.
        return (
          <button
            type="button"
            onClick={openAccountModal}
            className="inline-flex h-9 items-center gap-2.5 rounded-[11px] border border-border-strong bg-elev-2 pl-3 pr-1.5 hover:bg-elev-3"
          >
            {account.displayBalance && (
              <span className="font-mono text-[13px] font-medium text-fg">
                {account.displayBalance}
              </span>
            )}
            <span className="inline-flex h-[26px] items-center gap-1.5 rounded-[8px] bg-elev-4 pl-1 pr-[9px] text-[13px] font-medium">
              <Ident seed={account.address} size={18} />
              <span className="font-mono">{trunc(account.address, 4)}</span>
            </span>
          </button>
        );
      }}
    </ConnectButton.Custom>
  );
}
