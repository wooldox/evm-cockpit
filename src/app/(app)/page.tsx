"use client";

import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Icon } from "@/shared/icons";
import { Button, Empty } from "@/shared/ui";
import { useContractsStore } from "@/entities/contract/model/store";
import { useAppShell } from "@/widgets/app-shell/AppShellProvider";
import { ContractBrowser } from "@/features/contract-browser/ui/ContractBrowser";

function BrowserRoute() {
  const router = useRouter();
  const id = useSearchParams().get("c");
  const contracts = useContractsStore((s) => s.contracts);
  const contract = useContractsStore((s) =>
    s.contracts.find((c) => c.id === id),
  );
  const { openAdd } = useAppShell();

  if (id && contract) {
    return (
      <ContractBrowser contract={contract} onRemoved={() => router.push("/")} />
    );
  }

  if (id && !contract) {
    return (
      <div className="mx-auto w-full max-w-[1080px] px-7 py-16">
        <Empty
          className="min-h-[70vh]"
          icon={<Icon.book size={26} />}
          title="Contract not found"
          actions={
            <Button variant="subtle" onClick={() => router.push("/")}>
              Back to contracts
            </Button>
          }
        >
          This contract may have been removed.
        </Empty>
      </div>
    );
  }

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

  return (
    <div className="mx-auto w-full max-w-[1080px] px-7 py-16">
      <Empty title="Select a contract">
        Choose a contract from the sidebar to read its state and send
        transactions.
      </Empty>
    </div>
  );
}

export default function BrowserPage() {
  return (
    <Suspense fallback={null}>
      <BrowserRoute />
    </Suspense>
  );
}
