import type { Abi } from "abitype";
import type { AbiSource, AbiFetchResult } from "@/shared/ports/abi-source";

const BASE = "https://api.etherscan.io/v2/api";

interface EtherscanResponse {
  status: "1" | "0";
  message: string;
  result: string;
}

export function createEtherscanAbiSource(getApiKey: () => string): AbiSource {
  return {
    async fetchAbi(chainId: number, address: string): Promise<AbiFetchResult> {
      const apiKey = getApiKey();
      if (!apiKey) {
        return { ok: false, error: "no Etherscan API key" };
      }

      const url = `${BASE}?chainid=${chainId}&module=contract&action=getabi&address=${address}&apikey=${apiKey}`;

      try {
        const res = await fetch(url);
        if (!res.ok) {
          return {
            ok: false,
            error: `Etherscan HTTP ${res.status}: ${res.statusText}`,
          };
        }
        const data = (await res.json()) as EtherscanResponse;
        if (data.status === "1") {
          const abi = JSON.parse(data.result) as Abi;
          if (!Array.isArray(abi)) {
            return {
              ok: false,
              error: "Etherscan result.abi is not an array",
            };
          }
          return { ok: true, abi, source: "etherscan" };
        }
        return {
          ok: false,
          error: data.result || data.message || "unknown Etherscan error",
        };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    },
  };
}
