import { useState, useRef } from "react";
import { isValidAddress } from "@/shared/lib/web3/address";
import { categorizeAbi } from "@/shared/lib/abi/categorize";
import { detectProxy } from "@/entities/contract/model/proxy";
import { useContractsStore } from "@/entities/contract/model/store";
import {
  abiResolver as defaultAbiResolver,
  viemRpc as defaultViemRpc,
} from "@/app/web3/services";
import type {
  TContract,
  TProxyInfo,
  TAddress,
  TAbiSource,
} from "@/entities/contract/model/types";
import type { AbiSource } from "@/shared/ports/abi-source";
import type { RpcProvider } from "@/shared/ports/rpc";
import type { Abi } from "abitype";

// ─── Deps ────────────────────────────────────────────────────────────────────

export type Deps = {
  abiResolver: AbiSource;
  rpc: RpcProvider;
  addContract: (c: TContract) => void;
  updateContract: (id: string, patch: Partial<TContract>) => void;
  detectProxy: (
    rpc: RpcProvider,
    chainId: number,
    address: `0x${string}`,
  ) => Promise<{
    kind: "eip1967" | "beacon";
    implAddress: `0x${string}`;
  } | null>;
};

function buildDefaultDeps(): Deps {
  const state = useContractsStore.getState();
  return {
    abiResolver: defaultAbiResolver,
    rpc: defaultViemRpc,
    addContract: state.add,
    updateContract: state.update,
    detectProxy,
  };
}

// ─── Types ───────────────────────────────────────────────────────────────────

export type FetchStatus = "idle" | "loading" | "done" | "error";

export type FetchCategories = {
  properties: number;
  getters: number;
  operations: number;
  events: number;
};

export type FetchState = {
  status: FetchStatus;
  error?: string;
  categories?: FetchCategories;
  proxy?: TProxyInfo;
};

export type FormErrors = {
  name?: string;
  address?: string;
  abi?: string;
};

export type AddContractFormResult = {
  // Fields
  name: string;
  setName: (v: string) => void;
  chainId: number;
  setChainId: (v: number) => void;
  address: string;
  setAddress: (v: string) => void;
  abiText: string;
  setAbiText: (v: string) => void;
  mode: "fetch" | "manual";
  setMode: (v: "fetch" | "manual") => void;
  // Derived
  addrValid: boolean;
  fetch: FetchState;
  errors: FormErrors;
  canSubmit: boolean;
  // Actions
  fetchAbi: () => Promise<void>;
  submit: () => boolean;
};

// ─── Resolved data ref ───────────────────────────────────────────────────────

type ResolvedData = {
  abi: Abi;
  source: TAbiSource;
  proxy?: TProxyInfo;
};

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useAddContractForm(opts?: {
  editing?: TContract | null;
  deps?: Partial<Deps>;
}): AddContractFormResult {
  const editing = opts?.editing ?? null;

  const deps: Deps = {
    ...buildDefaultDeps(),
    ...opts?.deps,
  };

  // ── Field state ─────────────────────────────────────────────────────────
  const [name, setName] = useState<string>(editing?.name ?? "");
  const [chainId, setChainId] = useState<number>(editing?.chainId ?? 1);
  const [address, setAddress] = useState<string>(editing?.address ?? "");
  const [abiText, setAbiText] = useState<string>(
    editing?.abi ? JSON.stringify(editing.abi, null, 2) : "",
  );
  const [mode, setMode] = useState<"fetch" | "manual">("fetch");
  const [fetchState, setFetchState] = useState<FetchState>({ status: "idle" });
  const [abiError, setAbiError] = useState<string | undefined>(undefined);

  // Store resolved fetch data across renders without triggering re-renders
  const resolvedRef = useRef<ResolvedData | null>(null);

  // ── Derived ─────────────────────────────────────────────────────────────
  const addrValid = address.length > 0 && isValidAddress(address);

  const errors: FormErrors = {};
  if (address.length > 0 && !addrValid) {
    errors.address = "Invalid Ethereum address";
  }
  if (abiError) {
    errors.abi = abiError;
  } else if (mode === "manual" && abiText.trim().length > 0) {
    try {
      const parsed = JSON.parse(abiText);
      if (!Array.isArray(parsed)) {
        errors.abi = "ABI must be a JSON array";
      }
    } catch {
      errors.abi = "ABI must be valid JSON";
    }
  }

  const canSubmit: boolean = (() => {
    if (!name.trim()) return false;
    if (!addrValid) return false;
    if (mode === "fetch") {
      return fetchState.status === "done";
    }
    // manual
    if (abiText.trim().length === 0) return false;
    if (errors.abi) return false;
    return true;
  })();

  // ── Actions ─────────────────────────────────────────────────────────────

  async function fetchAbi(): Promise<void> {
    if (!addrValid) return;
    setFetchState({ status: "loading" });
    resolvedRef.current = null;

    const r = await deps.abiResolver.fetchAbi(chainId, address);

    if (!r.ok) {
      setFetchState({ status: "error", error: r.error });
      return;
    }

    const abi: Abi = r.abi;
    const source: TAbiSource = r.source;
    let proxy: TProxyInfo | undefined;
    let effective: Abi = abi;

    const p = await deps.detectProxy(
      deps.rpc,
      chainId,
      address as `0x${string}`,
    );
    if (p) {
      const ri = await deps.abiResolver.fetchAbi(chainId, p.implAddress);
      if (ri.ok) {
        proxy = {
          kind: p.kind,
          implAddress: p.implAddress as TAddress,
          implAbi: ri.abi,
        };
        effective = [...abi, ...ri.abi];
      }
    }

    const cats = categorizeAbi(effective);
    const categories: FetchCategories = {
      properties: cats.properties.length,
      getters: cats.getters.length,
      operations: cats.operations.length,
      events: cats.events.length,
    };

    resolvedRef.current = { abi, source, proxy };

    setFetchState({ status: "done", categories, proxy });
  }

  function submit(): boolean {
    // Clear any previous abi error
    setAbiError(undefined);

    let abi: Abi;
    let source: TAbiSource;
    let proxy: TProxyInfo | undefined;

    if (mode === "manual") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(abiText);
      } catch {
        setAbiError("ABI must be valid JSON");
        return false;
      }
      if (!Array.isArray(parsed)) {
        setAbiError("ABI must be a JSON array");
        return false;
      }
      abi = parsed as Abi;
      source = "manual";
      proxy = undefined;
    } else {
      // fetch mode
      if (fetchState.status !== "done" || !resolvedRef.current) {
        return false;
      }
      abi = resolvedRef.current.abi;
      source = resolvedRef.current.source;
      proxy = resolvedRef.current.proxy;
    }

    const contract: TContract = {
      id: editing?.id ?? crypto.randomUUID(),
      name: name.trim(),
      chainId,
      address: address as TAddress,
      abi,
      source,
      proxy,
      addedAt: editing?.addedAt ?? Date.now(),
    };

    if (editing) {
      deps.updateContract(editing.id, contract);
    } else {
      deps.addContract(contract);
    }

    return true;
  }

  return {
    name,
    setName,
    chainId,
    setChainId,
    address,
    setAddress,
    abiText,
    setAbiText,
    mode,
    setMode,
    addrValid,
    fetch: fetchState,
    errors,
    canSubmit,
    fetchAbi,
    submit,
  };
}
