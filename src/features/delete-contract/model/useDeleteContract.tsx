'use client';

import type { TContract } from '@/entities/contract/model/types';
import { useContractsStore } from '@/entities/contract/model/store';
import { useHistoryStore } from '@/entities/history/model/store';
import { useConfirm, useToast } from '@/shared/ui';

/**
 * Confirm-then-delete for one contract. The dialog offers (unchecked by
 * default) to also clear the contract's history entries, when it has any.
 * Resolves true when the contract was deleted.
 */
export function useDeleteContract(): (contract: TContract) => Promise<boolean> {
  const confirm = useConfirm();
  const toast = useToast();

  return async (contract) => {
    const historyCount = useHistoryStore
      .getState()
      .entries.filter((e) => e.contractId === contract.id).length;

    const result = await confirm({
      title: `Delete ${contract.name}?`,
      description: 'It will be removed from your saved contracts.',
      checkbox:
        historyCount > 0
          ? {
              label: `Also delete its ${historyCount} history ${historyCount === 1 ? 'entry' : 'entries'}`,
            }
          : undefined,
      confirmLabel: 'Delete',
      tone: 'danger',
    });
    if (!result) return false;

    useContractsStore.getState().remove(contract.id);
    if (result.checked)
      useHistoryStore.getState().clearForContract(contract.id);
    toast({
      kind: 'success',
      title: 'Contract removed',
      msg: result.checked ? `${contract.name} and its history` : contract.name,
    });
    return true;
  };
}
