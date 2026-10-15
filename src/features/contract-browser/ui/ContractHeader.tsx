'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useChainDisplay } from '@/entities/chain/model/catalogStore';
import { addressUrl } from '@/entities/chain/model/explorer';
import type { TContract } from '@/entities/contract/model/types';
import { useContractsStore } from '@/entities/contract/model/store';
import { Icon } from '@/shared/icons';
import { trunc } from '@/shared/lib/format';
import { Badge, Button, ChainBadge, useConfirm, useToast } from '@/shared/ui';
import { Address, Copyable } from '@/shared/ui/copyable';
import { ShareModal } from '@/features/share/ui/ShareModal';
import { useAppShell } from '@/widgets/app-shell/AppShellProvider';

/* ── ContractHeader ─────────────────────────────────────── */
export function ContractHeader({
  contract,
  onRemoved,
}: {
  contract: TContract;
  onRemoved: () => void;
}) {
  const toast = useToast();
  const confirm = useConfirm();
  const router = useRouter();
  const { openEdit } = useAppShell();
  const [shareOpen, setShareOpen] = useState(false);
  const chain = useChainDisplay(contract.chainId);
  const addrLink = addressUrl(contract.chainId, contract.address);

  const handleShare = () => {
    setShareOpen(true);
  };

  const handleHistory = () => {
    router.push(`/history?c=${contract.id}`);
  };

  const handleEdit = () => {
    openEdit(contract);
  };

  const handleRemove = async () => {
    const ok = await confirm({
      title: `Delete ${contract.name}?`,
      description:
        'It will be removed from your saved contracts. Its history entries stay.',
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!ok) return;
    useContractsStore.getState().remove(contract.id);
    toast({ kind: 'success', title: 'Contract removed', msg: contract.name });
    onRemoved();
  };

  return (
    <div
      data-cc="ch-head"
      className="flex items-start justify-between gap-4 border-b border-border bg-elev-1 px-7 pb-[18px] pt-[22px]"
    >
      <div>
        <div className="flex flex-wrap items-center gap-[9px]">
          <h1 className="text-[21px] font-semibold tracking-[-0.02em]">
            {contract.name}
          </h1>
          <Badge size="sm" variant="neutral">
            {contract.source}
          </Badge>
          {contract.proxy && (
            <Badge size="sm" variant="read">
              Proxy
            </Badge>
          )}
        </div>
        <div className="mt-[11px] flex flex-wrap items-center gap-3">
          <ChainBadge chain={chain} />
          <Address
            value={contract.address}
            short
            withIdent={false}
            link={addrLink}
          />
        </div>
        {contract.proxy && (
          <div className="mt-[11px] flex w-fit flex-wrap items-center gap-[9px] rounded-sm border border-read-border bg-read-bg px-[11px] py-[7px]">
            <span className="inline-flex items-center gap-[5px] rounded-xs border border-read-border bg-read-bg px-[7px] py-0.5 text-[11px] text-read-fg">
              <Icon.layers size={12} /> {contract.proxy.kind} proxy
            </span>
            <Copyable
              value={contract.proxy.implAddress}
              display={trunc(contract.proxy.implAddress, 6)}
              link={addressUrl(contract.chainId, contract.proxy.implAddress)}
            />
            {contract.proxy.implAbi ? (
              <span className="text-xs text-fg-3">
                · ABI merged from implementation
              </span>
            ) : (
              <span className="text-xs text-fg-3">
                · implementation ABI unavailable
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-none gap-1">
        <Button
          variant="ghost"
          size="sm"
          icon={<Icon.history size={15} />}
          onClick={handleHistory}
        >
          History
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<Icon.share size={15} />}
          onClick={handleShare}
        >
          Share
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<Icon.edit size={15} />}
          onClick={handleEdit}
        >
          Edit
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<Icon.trash size={15} />}
          onClick={handleRemove}
          title="Remove"
        />
      </div>
      {shareOpen && (
        <ShareModal contract={contract} onClose={() => setShareOpen(false)} />
      )}
    </div>
  );
}
