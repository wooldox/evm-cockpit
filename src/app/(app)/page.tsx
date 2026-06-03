"use client";

import { Icon } from "@/shared/icons";
import { Button, Empty } from "@/shared/ui";
import { useContractsStore } from "@/entities/contract/model/store";
import { useAppShell } from "@/widgets/app-shell/AppShellProvider";

export default function BrowserPage() {
  const contracts = useContractsStore((s) => s.contracts);
  const { openAdd } = useAppShell();

  if (contracts.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[1080px] px-7 py-16">
        <Empty
          className="min-h-[70vh]"
          icon={<Icon.book size={26} />}
          title="No contracts yet"
          actions={
            <div className="flex flex-col items-center gap-2">
              <Button
                variant="primary"
                icon={<Icon.plus size={15} />}
                onClick={openAdd}
              >
                Add your first contract
              </Button>
              <span className="mt-2 text-xs text-fg-4">
                Works with any EVM chain · ERC-20, ERC-721, proxies &amp; custom
                ABIs
              </span>
            </div>
          }
        >
          Add a smart contract by address — we&apos;ll fetch its verified ABI
          and build a full read/write interface automatically.
        </Empty>
      </div>
    );
  }

  // contracts exist but none selected — M2e will handle contract browsing
  return (
    <div className="mx-auto w-full max-w-[1080px] px-7 py-16">
      <Empty title="Select a contract">
        Choose a contract from the sidebar to read its state and send
        transactions.
      </Empty>
    </div>
  );
}
