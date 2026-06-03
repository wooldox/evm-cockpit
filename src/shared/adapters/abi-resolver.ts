import type { AbiSource, AbiFetchResult } from "@/shared/ports/abi-source";

export function createAbiResolver(sources: AbiSource[]): AbiSource {
  return {
    async fetchAbi(chainId: number, address: string): Promise<AbiFetchResult> {
      const errors: string[] = [];

      for (const source of sources) {
        const result = await source.fetchAbi(chainId, address);
        if (result.ok) {
          return result;
        }
        errors.push(result.error);
      }

      return {
        ok: false,
        error:
          errors.length > 0 ? errors.join("; ") : "no ABI sources configured",
      };
    },
  };
}
