"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { Icon } from "@/shared/icons";
import { ChainGlyph } from "@/shared/ui";
import { Ident } from "@/shared/ui/copyable";
import { trunc } from "@/shared/lib/format";
import { getChainDisplay } from "@/entities/chain/model/chains";

export function WalletButton() {
  return (
    <ConnectButton.Custom>
      {({
        account,
        chain,
        openConnectModal,
        openChainModal,
        openAccountModal,
        mounted,
      }) => {
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

        // Wrong / unsupported network
        if (chain.unsupported) {
          return (
            <button
              type="button"
              onClick={openChainModal}
              className="inline-flex h-9 items-center gap-2 rounded-[11px] border border-red-500/60 bg-red-500/10 px-[15px] text-[13px] font-semibold text-red-400 transition-colors hover:bg-red-500/20"
            >
              <Icon.alert size={15} /> Wrong network
            </button>
          );
        }

        // Connected — chain pill + account pill
        const chainDisplay = getChainDisplay(chain.id);
        return (
          <div className="inline-flex items-stretch gap-1.5">
            {/* Chain pill */}
            <button
              type="button"
              onClick={openChainModal}
              title={chain.name}
              className="inline-flex h-9 items-center gap-[7px] rounded-[11px] border border-border-strong bg-elev-2 px-[11px] text-[13px] font-medium text-fg hover:bg-elev-3"
            >
              <ChainGlyph chain={chainDisplay} size={16} />
              {chain.name ?? chainDisplay.name}
              <Icon.chevD size={13} className="opacity-60" />
            </button>

            {/* Account pill */}
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
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}
