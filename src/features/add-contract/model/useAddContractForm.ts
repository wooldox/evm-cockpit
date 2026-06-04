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
  importedProxy: TProxyInfo | undefined;
  setImportedProxy: (v: TProxyInfo | undefined) => void;
  // Derived
  addrValid: boolean;
  fetch: FetchState;
  errors: FormErrors;
  canSubmit: boolean;
  // Actions
  fetchAbi: () => Promise<void>;
  submit: () => boolean;
};

// ─── Internal fetch state (includes key for staleness detection) ─────────────

/** Internal shape stored in state — extends the public FetchState with a key
 *  that records which address+chainId the fetch was performed for. */
type InternalFetchState = FetchState & { _fetchKey?: string };

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
  const [chainId, setChainIdState] = useState<number>(editing?.chainId ?? 1);
  const [address, setAddressState] = useState<string>(editing?.address ?? "");
  const [abiText, setAbiText] = useState<string>(
    editing?.abi ? JSON.stringify(editing.abi, null, 2) : "",
  );
  const [mode, setMode] = useState<"fetch" | "manual">("fetch");
  // Proxy info carried in from a file import (manual mode). Belongs to one exact
  // address+chainId, so it is cleared whenever either of those is edited below.
  const [importedProxy, setImportedProxy] = useState<TProxyInfo | undefined>(
    undefined,
  );

  // Editing the address or chain invalidates a file-imported proxy (it was
  // detected for that specific address on that specific chain).
  function setAddress(v: string): void {
    setAddressState(v);
    setImportedProxy(undefined);
  }
  function setChainId(v: number): void {
    setChainIdState(v);
    setImportedProxy(undefined);
  }
  const [fetchState, setFetchState] = useState<InternalFetchState>({
    status: "idle",
  });
  const [abiError, setAbiError] = useState<string | undefined>(undefined);

  // Store resolved fetch data across renders without triggering re-renders
  const resolvedRef = useRef<ResolvedData | null>(null);

  // ── Derived ─────────────────────────────────────────────────────────────
  // A key uniquely identifying what the current fetch would be for.
  // When address or chainId changes, the key drifts from what resolvedRef recorded,
  // making the previous fetch result stale without needing a useEffect.
  const currentFetchKey = `${chainId}:${address}`;
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

  // Effective fetch state exposed to consumers: if the fetch was done for a
  // different address/chainId, the result is stale — expose "idle" so the UI
  // correctly requires a fresh fetch for the current inputs.
  // We compare purely against state (_fetchKey stored in the state object) to
  // avoid reading refs during render, which the project's linting rules forbid.
  const fetchResultIsStale =
    fetchState.status === "done" && fetchState._fetchKey !== currentFetchKey;

  // Strip the internal _fetchKey before exposing to consumers
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { _fetchKey: _stripped, ...publicFetchState } = fetchState;
  const effectiveFetchState: FetchState = fetchResultIsStale
    ? { status: "idle" }
    : publicFetchState;

  const canSubmit: boolean = (() => {
    if (!name.trim()) return false;
    if (!addrValid) return false;
    if (mode === "fetch") {
      return effectiveFetchState.status === "done";
    }
    // manual
    if (abiText.trim().length === 0) return false;
    if (errors.abi) return false;
    return true;
  })();

  // ── Actions ─────────────────────────────────────────────────────────────

  async function fetchAbi(): Promise<void> {
    if (!addrValid) return;
    // Snapshot the key at the moment of initiating the fetch
    const fetchKey = currentFetchKey;
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
      } else {
        // Proxy detected but impl ABI unavailable — record the proxy without implAbi
        proxy = {
          kind: p.kind,
          implAddress: p.implAddress as TAddress,
        };
        // effective stays as proxy's own ABI
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

    setFetchState({ status: "done", categories, proxy, _fetchKey: fetchKey });
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
      // Preserve proxy info carried in from a file import. setImportedProxy is
      // cleared when the user edits the address/chain, so a stale proxy can't
      // attach to a different target.
      proxy = importedProxy;
    } else {
      // fetch mode — effectiveFetchState is already "idle" when stale,
      // so this guard also rejects stale results.
      if (effectiveFetchState.status !== "done" || !resolvedRef.current) {
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
    importedProxy,
    setImportedProxy,
    addrValid,
    fetch: effectiveFetchState,
    errors,
    canSubmit,
    fetchAbi,
    submit,
  };
}
