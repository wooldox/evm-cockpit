'use client';

import { useState } from 'react';
import {
  catalogDisplay,
  useChainCatalog,
} from '@/entities/chain/model/catalogStore';
import { useContractsStore } from '@/entities/contract/model/store';
import type { TShareContract } from '@/shared/lib/share/codec';
import { trunc } from '@/shared/lib/format';
import {
  Badge,
  Button,
  ChainGlyph,
  Checkbox,
  Modal,
  Muted,
  useToast,
} from '@/shared/ui';
import { Ident } from '@/shared/ui/copyable';
import { findSaved, toNewContract } from '../model/importItems';

/**
 * Review step for importing several contracts (from a share link or file).
 * Everything new starts checked; contracts already saved (same chain +
 * address) are shown but can't be selected. Contracts on a chain the app
 * doesn't know are flagged — they import fine, but need the chain added.
 */
export function ImportReviewModal({
  items,
  onClose,
}: {
  items: TShareContract[];
  onClose: () => void;
}) {
  const toast = useToast();
  const byId = useChainCatalog((s) => s.byId);
  // Snapshot at open: what's already saved shouldn't shift while reviewing.
  const [saved] = useState(() => {
    const contracts = useContractsStore.getState().contracts;
    return items.map((i) => !!findSaved(i, contracts));
  });
  const [checked, setChecked] = useState(() => saved.map((s) => !s));

  const selectable = saved.filter((s) => !s).length;
  const count = checked.filter(Boolean).length;
  const allChecked = selectable > 0 && count === selectable;

  const toggleAll = () => setChecked(saved.map((s) => !s && !allChecked));
  const toggle = (i: number) =>
    setChecked((c) => c.map((v, j) => (j === i ? !v : v)));

  const handleImport = () => {
    const add = useContractsStore.getState().add;
    items.forEach((item, i) => {
      if (checked[i]) add(toNewContract(item));
    });
    toast({
      kind: 'success',
      title: `Imported ${count} contract${count === 1 ? '' : 's'}`,
    });
    onClose();
  };

  return (
    <Modal
      lg
      title={`Import ${items.length} contracts`}
      onClose={onClose}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={count === 0}
            onClick={handleImport}
          >
            {count === 0
              ? 'Import'
              : `Import ${count} contract${count === 1 ? '' : 's'}`}
          </Button>
        </>
      }
    >
      <div className="flex items-center justify-between gap-3 pb-2.5">
        <Checkbox
          label={allChecked ? 'Deselect all' : 'Select all'}
          checked={allChecked}
          indeterminate={count > 0 && !allChecked}
          disabled={selectable === 0}
          onChange={toggleAll}
        />
        <Muted className="text-xs">
          {count} of {selectable} selected
          {selectable < items.length &&
            ` · ${items.length - selectable} already saved`}
        </Muted>
      </div>
      <ul className="flex flex-col overflow-hidden rounded-sm border border-border">
        {items.map((item, i) => {
          const known = byId.has(item.chainId);
          const chain = catalogDisplay(item.chainId);
          return (
            <li
              key={`${item.chainId}:${item.address}`}
              className="border-b border-border last:border-b-0"
            >
              <label
                className={
                  saved[i]
                    ? 'flex items-center gap-3 px-3 py-2.5 opacity-60'
                    : 'flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-elev-3'
                }
              >
                <Checkbox
                  checked={checked[i]}
                  disabled={saved[i]}
                  onChange={() => toggle(i)}
                  aria-label={`Import ${item.name}`}
                />
                <Ident seed={item.address} size={22} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium text-fg">
                    {item.name}
                  </div>
                  <div className="mt-px flex items-center gap-1.5 text-[11.5px] text-fg-3">
                    <ChainGlyph chain={chain} size={12} />
                    <span className="truncate">
                      {known ? chain.name : `Chain ${item.chainId}`}
                    </span>
                    <span className="font-mono">
                      · {trunc(item.address, 5)}
                    </span>
                  </div>
                </div>
                {saved[i] ? (
                  <Badge size="sm" variant="neutral">
                    already saved
                  </Badge>
                ) : (
                  !known && (
                    <span title="This chain isn't in your list — add it (network selector → Add custom chain) to use this contract.">
                      <Badge size="sm" variant="write">
                        unknown chain
                      </Badge>
                    </span>
                  )
                )}
              </label>
            </li>
          );
        })}
      </ul>
    </Modal>
  );
}
