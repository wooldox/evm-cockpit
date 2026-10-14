'use client';

import { useQuery } from '@tanstack/react-query';
import { useChainCatalog } from '@/entities/chain/model/catalogStore';
import { fetchUsdPrice, nativeCoinId } from '@/shared/adapters/coingecko';
import { cx } from '@/shared/lib/cx';

/** $3,421.55 · $0.5123 · $0.00001234 — 2 decimals at ≥ $1, else 4 sig. digits. */
export function formatUsd(n: number): string {
  return n >= 1
    ? n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
    : n.toLocaleString('en-US', {
        style: 'currency',
        currency: 'USD',
        maximumSignificantDigits: 4,
      });
}

/* ============================================================
   NativePrice — USD price of the selected chain's native currency
   (ETH on Ethereum/Base/Arbitrum, POL on Polygon, BNB on BSC…).
   Hidden on chains CoinGecko has no market for (testnets, custom).
   ============================================================ */
export function NativePrice({ chainId }: { chainId: number }) {
  const symbol = useChainCatalog((s) => s.byId.get(chainId)?.nativeSymbol);
  const coinId = nativeCoinId(chainId);

  const price = useQuery({
    queryKey: ['coingecko', 'usdPrice', coinId],
    queryFn: () => fetchUsdPrice(coinId!),
    enabled: !!coinId,
    // Keyless CoinGecko is rate-limited per IP — poll gently, keep showing
    // the last price through a transient 429.
    staleTime: 120_000,
    refetchInterval: 120_000,
    retry: 1,
  });

  if (!coinId || !price.data) return null;

  const { usd, change24h } = price.data;
  const up = (change24h ?? 0) >= 0;

  return (
    <div
      aria-label={`${symbol ?? 'Native currency'} price`}
      title={`${symbol ?? coinId} price in USD (CoinGecko)`}
      className="inline-flex h-[34px] items-center gap-1.5 rounded-sm border border-border bg-elev-2 px-2.5 text-[13px]"
    >
      <span className="text-fg-3">{symbol}</span>
      <span className="font-mono font-medium text-fg">{formatUsd(usd)}</span>
      {change24h !== undefined && (
        <span
          className={cx(
            'font-mono text-[11.5px]',
            up ? 'text-success-fg' : 'text-danger-fg',
          )}
        >
          {up ? '+' : ''}
          {change24h.toFixed(2)}%
        </span>
      )}
    </div>
  );
}
