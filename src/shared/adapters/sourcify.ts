import type { Abi } from 'abitype';
import type { AbiSource, AbiFetchResult } from '@/shared/ports/abi-source';

const BASE = 'https://repo.sourcify.dev/contracts/full_match';

export function createSourcifyAbiSource(): AbiSource {
  return {
    async fetchAbi(chainId: number, address: string): Promise<AbiFetchResult> {
      const url = `${BASE}/${chainId}/${address}/metadata.json`;
      try {
        const res = await fetch(url);
        if (!res.ok) {
          return {
            ok: false,
            error: `Sourcify HTTP ${res.status}: ${res.statusText}`,
          };
        }
        const metadata: unknown = await res.json();
        const abi = extractAbi(metadata);
        if (!abi) {
          return {
            ok: false,
            error: 'Sourcify metadata missing output.abi array',
          };
        }
        return { ok: true, abi, source: 'sourcify' };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
}

function extractAbi(metadata: unknown): Abi | null {
  if (
    metadata !== null &&
    typeof metadata === 'object' &&
    'output' in metadata &&
    metadata.output !== null &&
    typeof metadata.output === 'object' &&
    'abi' in metadata.output &&
    Array.isArray((metadata.output as { abi: unknown }).abi)
  ) {
    return (metadata.output as { abi: Abi }).abi;
  }
  return null;
}
