export type THistoryType = 'read' | 'simulate' | 'write';
export type THistoryEntry = {
  id: string;
  contractId: string;
  chainId: number;
  type: THistoryType;
  fnName: string;
  /** Raw input strings as typed (re-runnable later). */
  args: Record<string, string>;
  status: 'ok' | 'error';
  /** stringifyWithBigint'd result (reads) or sim summary — NEVER raw bigint (persisted as JSON). */
  result?: string;
  txHash?: `0x${string}`;
  error?: string;
  from?: `0x${string}`;
  timestamp: number;
};
