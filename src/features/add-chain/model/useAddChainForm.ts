"use client";

import { useState } from "react";
import { useChainCatalog } from "@/entities/chain/model/catalogStore";
import type { TCatalogChain } from "@/entities/chain/model/catalog";

/** Accent swatches for custom chains (from the design). */
export const CHAIN_COLORS = [
  "#627eea",
  "#0052ff",
  "#28a0f0",
  "#ff0420",
  "#8247e5",
  "#f3ba2f",
  "#e84142",
  "#22c55e",
] as const;

/** Normalize an explorer input to a full base URL: trim, prepend https://
 *  when schemeless, strip the trailing slash. Returns undefined when empty. */
function normalizeExplorer(raw: string): string | undefined {
  const s = raw.trim();
  if (!s) return undefined;
  const url = /^https?:\/\//i.test(s) ? s : `https://${s}`;
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

export function useAddChainForm() {
  const [name, setName] = useState("");
  const [idStr, setIdStr] = useState("");
  const [rpc, setRpc] = useState("");
  const [symbol, setSymbol] = useState("");
  const [explorer, setExplorer] = useState("");
  const [color, setColor] = useState<string>(CHAIN_COLORS[0]);
  // Reactive: a chain added elsewhere mid-edit must flip the dup check.
  const byId = useChainCatalog((s) => s.byId);

  const idNum = Number(idStr);
  const idValid = /^\d+$/.test(idStr.trim()) && idNum > 0;
  const idDup = idValid && byId.has(idNum);
  const rpcValid = /^https?:\/\/.+/i.test(rpc.trim());

  let idError: string | undefined;
  if (idStr && !idValid) idError = "Must be a positive integer";
  else if (idDup) idError = "This chain ID already exists";
  const rpcError = rpc && !rpcValid ? "Must start with http(s)://" : undefined;

  const canSave =
    Boolean(name.trim()) &&
    idValid &&
    !idDup &&
    rpcValid &&
    Boolean(symbol.trim());

  /** The character previewed in the accent glyph. */
  const glyphChar = (symbol.trim() || name.trim() || "N")
    .charAt(0)
    .toUpperCase();

  function buildEntry(): TCatalogChain {
    const sym = symbol.trim();
    const entry: TCatalogChain = {
      id: idNum,
      name: name.trim(),
      short: (sym || name.trim()).slice(0, 5).toUpperCase(),
      color,
      rpcUrls: [rpc.trim()],
      nativeSymbol: sym.toUpperCase(),
      source: "custom",
    };
    const explorerUrl = normalizeExplorer(explorer);
    if (explorerUrl) entry.explorerUrl = explorerUrl;
    return entry;
  }

  return {
    name,
    setName,
    idStr,
    setIdStr,
    rpc,
    setRpc,
    symbol,
    setSymbol,
    explorer,
    setExplorer,
    color,
    setColor,
    idValid,
    idDup,
    idError,
    rpcValid,
    rpcError,
    canSave,
    glyphChar,
    buildEntry,
  };
}
