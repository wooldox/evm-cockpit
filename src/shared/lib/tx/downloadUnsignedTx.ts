import { stringifyWithBigint } from "@/shared/lib/json/stringify";

export type UnsignedTx = {
  chainId: number;
  to: `0x${string}`;
  data: `0x${string}`;
  value?: bigint;
  gas?: bigint;
  nonce?: number;
  maxFeePerGas?: bigint;
  maxPriorityFeePerGas?: bigint;
  from?: `0x${string}`;
};

/** Pretty JSON for the unsigned tx; bigints as decimal strings; undefined keys omitted. */
export function buildUnsignedTxJson(tx: UnsignedTx): string {
  return stringifyWithBigint(tx, 2);
}

/** Trigger a browser download of `json` as `filename` (Blob + object URL + temporary <a download> click + revoke). */
export function downloadJson(filename: string, json: string): void {
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
