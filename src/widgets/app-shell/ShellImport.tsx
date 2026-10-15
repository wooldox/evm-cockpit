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
  dedupeItems,
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

/**
 * Read one or more exported `.json` files and send their contracts (merged,
 * duplicates dropped) to the review step. Files that aren't valid exports are
 * reported in a toast; the rest still import. Used by the file picker and by
 * dropping files on the sidebar.
 */
export function useImportFiles(): (files: File[]) => Promise<void> {
  const { startImport } = useAppShell();
  const toast = useToast();
  return async (files) => {
    if (files.length === 0) return;
    const results = await Promise.all(files.map(readShareFile));
    const items = dedupeItems(results.flatMap((r) => (r.ok ? r.items : [])));
    const bad = files.filter((_, i) => !results[i]!.ok);
    if (bad.length)
      toast({
        kind: 'error',
        title: 'Import failed',
        msg: (
          <>
            <Mono>{bad.map((f) => f.name).join(', ')}</Mono>{' '}
            {bad.length === 1 ? 'is not a' : 'are not'} valid contract export
            {bad.length === 1 ? '' : 's'}
          </>
        ),
      });
    if (items.length) startImport(items);
  };
}

/** Import entry points owned by the shell: `#import=` links, the shared file
 *  input (opened via `openImportFile`), and the review step for both. */
export function ShellImport() {
  const { importing, startImport, closeImport } = useAppShell();
  const importFiles = useImportFiles();

  return (
    <>
      <input
        id={IMPORT_FILE_INPUT_ID}
        type="file"
        accept=".json,application/json"
        multiple
        className="hidden"
        aria-label="Import contract export file"
        onChange={(e) => {
          const files = [...(e.target.files ?? [])];
          // Reset so re-selecting the same file re-fires onChange.
          e.target.value = '';
          void importFiles(files);
        }}
      />
      <HashImport onImport={startImport} />
      {importing && <ImportFlow items={importing} onClose={closeImport} />}
    </>
  );
}
