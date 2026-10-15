'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useContractsStore } from '@/entities/contract/model/store';
import type { TShareContract } from '@/shared/lib/share/codec';
import { Mono, useToast } from '@/shared/ui';
import { AddContractModal } from '@/features/add-contract/ui/AddContractModal';
import { HashImport } from '@/features/share/ui/HashImport';
import { ImportReviewModal } from '@/features/share/ui/ImportReviewModal';
import {
  findSaved,
  readShareFile,
  toNewContract,
} from '@/features/share/model/importItems';
import {
  IMPORT_FILE_INPUT_ID,
  useAppShell,
} from '@/widgets/app-shell/AppShellProvider';

/** Single contract already saved: nothing to review — just open it. */
function OpenSaved({ id, onDone }: { id: string; onDone: () => void }) {
  const toast = useToast();
  const router = useRouter();
  useEffect(() => {
    toast({ kind: 'success', title: 'Already saved — opening' });
    router.push(`/?c=${id}`);
    onDone();
  }, [id, onDone, router, toast]);
  return null;
}

/**
 * Routes contracts from a share link or file to the right review step:
 *  - one new contract → the add modal, prefilled, titled "Import contract"
 *  - one already saved (same chain + address) → open it
 *  - several → the review list
 */
function ImportFlow({
  items,
  onClose,
}: {
  items: TShareContract[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [savedId] = useState(() =>
    items.length === 1
      ? findSaved(items[0]!, useContractsStore.getState().contracts)?.id
      : undefined,
  );

  if (items.length > 1)
    return <ImportReviewModal items={items} onClose={onClose} />;
  if (savedId) return <OpenSaved id={savedId} onDone={onClose} />;

  // id/addedAt are assigned on save.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id: _id, addedAt: _addedAt, ...prefill } = toNewContract(items[0]!);
  return (
    <AddContractModal
      importing
      prefill={prefill}
      onClose={onClose}
      onSaved={(c) => router.push(`/?c=${c.id}`)}
    />
  );
}

/** Import entry points owned by the shell: `#import=` links, the shared file
 *  input (opened via `openImportFile`), and the review step for both. */
export function ShellImport() {
  const { importing, startImport, closeImport } = useAppShell();
  const toast = useToast();

  return (
    <>
      <input
        id={IMPORT_FILE_INPUT_ID}
        type="file"
        accept=".json,application/json"
        className="hidden"
        aria-label="Import contract export file"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          // Reset so re-selecting the same file re-fires onChange.
          e.target.value = '';
          if (!file) return;
          const r = await readShareFile(file);
          if (r.ok) startImport(r.items);
          else
            toast({
              kind: 'error',
              title: 'Import failed',
              msg: (
                <>
                  <Mono>{file.name}</Mono> is {r.error}
                </>
              ),
            });
        }}
      />
      <HashImport onImport={startImport} />
      {importing && <ImportFlow items={importing} onClose={closeImport} />}
    </>
  );
}
