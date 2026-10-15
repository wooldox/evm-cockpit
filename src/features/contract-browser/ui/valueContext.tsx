'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { toFunctionSelector, toFunctionSignature } from 'viem';
import type { TContract } from '@/entities/contract/model/types';
import { useChainCatalog } from '@/entities/chain/model/catalogStore';
import { useContractsStore } from '@/entities/contract/model/store';
import { getEffectiveAbi } from '@/features/contract-browser/model/effectiveAbi';
import { useProperties } from '@/features/contract-browser/model/useProperties';

/** Contract-level facts the value renderers use to interpret raw values. */
export type TValueContext = {
  contractId: string;
  chainId: number;
  nativeSymbol: string;
  /** The contract's own ERC-20 decimals()/symbol(), when it has them. */
  token?: { decimals: number; symbol?: string };
  /** 4-byte selector → `fn(sig)` / `error Err(sig)` from this contract's ABI. */
  selectors: Map<string, string>;
  /** Lowercased address → name of a contract saved on this chain. */
  savedNames: Map<string, string>;
};

const Ctx = createContext<TValueContext | null>(null);

export function useValueContext(): TValueContext | null {
  return useContext(Ctx);
}

export function ValueContextProvider({
  contract,
  children,
}: {
  contract: TContract;
  children: ReactNode;
}) {
  const nativeSymbol =
    useChainCatalog((s) => s.byId.get(contract.chainId)?.nativeSymbol) ?? 'ETH';
  // Same query PropertiesSection runs — react-query dedupes it.
  const { rows } = useProperties(contract);

  const decimalsRow = rows.find(
    (r) => r.fn.name === 'decimals' && r.fn.outputs[0]?.type === 'uint8',
  );
  const symbolRow = rows.find(
    (r) => r.fn.name === 'symbol' && r.fn.outputs[0]?.type === 'string',
  );
  const decimals =
    decimalsRow?.status === 'ok' ? Number(decimalsRow.value) : undefined;
  const symbol =
    symbolRow?.status === 'ok' ? String(symbolRow.value) : undefined;

  // Built once here rather than subscribed per address cell (event tables can
  // render thousands of them).
  const contracts = useContractsStore((s) => s.contracts);
  const savedNames = useMemo(
    () =>
      new Map(
        contracts
          .filter((c) => c.chainId === contract.chainId)
          .map((c) => [c.address.toLowerCase(), c.name]),
      ),
    [contracts, contract.chainId],
  );

  const selectors = useMemo(() => {
    const m = new Map<string, string>();
    for (const item of getEffectiveAbi(contract)) {
      if (item.type !== 'function' && item.type !== 'error') continue;
      // viem prefixes error signatures with "error ", which would hash to the
      // wrong selector — strip it.
      const sig = toFunctionSignature(item as never).replace(/^error /, '');
      const prefix = item.type === 'error' ? 'error ' : '';
      m.set(toFunctionSelector(sig), `${prefix}${sig}`);
    }
    return m;
  }, [contract]);

  const value = useMemo<TValueContext>(
    () => ({
      contractId: contract.id,
      chainId: contract.chainId,
      nativeSymbol,
      token:
        decimals !== undefined && decimals <= 36
          ? { decimals, symbol }
          : undefined,
      selectors,
      savedNames,
    }),
    [
      contract.id,
      contract.chainId,
      nativeSymbol,
      decimals,
      symbol,
      selectors,
      savedNames,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
