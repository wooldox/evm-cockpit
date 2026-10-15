'use client';

import type { TContract } from '@/entities/contract/model/types';
import { useContractsStore } from '@/entities/contract/model/store';
import { useHistoryStore } from '@/entities/history/model/store';
import { useConfirm, useToast } from '@/shared/ui';

/** Names shown in a bulk-delete confirmation before "and N more". */
const LISTED = 5;

const entries = (n: number) => `${n} history ${n === 1 ? 'entry' : 'entries'}`;

/**
 * Confirm-then-delete for one or more contracts. The dialog offers (unchecked
 * by default) to also clear their history entries, when there are any; a bulk
 * delete lists the names so nothing is removed by surprise. Resolves true when
 * the contracts were deleted.
 */
export function useDeleteContracts(): (
  contracts: TContract[],
) => Promise<boolean> {
  const confirm = useConfirm();
  const toast = useToast();

  return async (contracts) => {
    if (contracts.length === 0) return false;
    const ids = new Set(contracts.map((c) => c.id));
    const single = contracts.length === 1 ? contracts[0]! : null;
    const historyCount = useHistoryStore
      .getState()
      .entries.filter((e) => ids.has(e.contractId)).length;

    const names = contracts.slice(0, LISTED).map((c) => c.name);
    const more = contracts.length - names.length;

    const result = await confirm({
      title: single
        ? `Delete ${single.name}?`
        : `Delete ${contracts.length} contracts?`,
      description: single ? (
        'It will be removed from your saved contracts.'
      ) : (
        <>
          {names.join(', ')}
          {more > 0 && ` and ${more} more`} will be removed from your saved
          contracts.
        </>
      ),
      checkbox:
        historyCount > 0
          ? {
              label: `Also delete ${single ? 'its' : 'their'} ${entries(historyCount)}`,
            }
          : undefined,
      confirmLabel: single ? 'Delete' : `Delete ${contracts.length}`,
      tone: 'danger',
    });
    if (!result) return false;

    const { remove } = useContractsStore.getState();
    const { clearForContract } = useHistoryStore.getState();
    for (const c of contracts) {
      remove(c.id);
      if (result.checked) clearForContract(c.id);
    }
    toast({
      kind: 'success',
      title: single
        ? 'Contract removed'
        : `Removed ${contracts.length} contracts`,
      msg: single
        ? result.checked
          ? `${single.name} and its history`
          : single.name
        : result.checked
          ? 'Their history entries too'
          : undefined,
    });
    return true;
  };
}
