/**
 * Anvil integration-test harness.
 *
 * Spawns a local Anvil node, exposes viem clients bound to its well-known
 * prefunded accounts, and deploys the committed Solidity fixture artifacts
 * (see contracts/ and src/test/artifacts/).
 *
 * Binary resolution (Anvil): ANVIL_BIN env -> ~/.foundry-standard/bin/anvil
 * (if it exists) -> "anvil" on PATH. On this machine PATH `forge` is
 * forge-zksync, so we never rely on PATH for forge; anvil is fine to try last.
 *
 * Integration tests run from the repo root, so artifacts are resolved via
 * process.cwd().
 */
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createServer } from "node:net";
import { homedir } from "node:os";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  type Abi,
  type PublicClient,
  type WalletClient,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { foundry } from "viem/chains";

export type ArtifactName = "TestToken" | "CounterV1" | "SlimProxy";

export type AnvilHandle = {
  rpcUrl: string;
  port: number;
  stop: () => Promise<void>;
};

/** Anvil's first three well-known prefunded accounts (deterministic). */
export const ANVIL_ACCOUNTS: readonly `0x${string}`[] = [
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
] as const;

/** Matching private keys for {@link ANVIL_ACCOUNTS} (public test constants). */
export const ANVIL_KEYS: readonly `0x${string}`[] = [
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d",
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a",
] as const;

const FALLBACK_ANVIL = path.join(
  homedir(),
  ".foundry-standard",
  "bin",
  "anvil",
);

function resolveAnvilBin(): string {
  const fromEnv = process.env.ANVIL_BIN;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  if (existsSync(FALLBACK_ANVIL)) return FALLBACK_ANVIL;
  return "anvil";
}

/** Bind to port 0 to obtain a free port, then release it. */
async function getFreePort(): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    const srv = createServer();
    srv.unref();
    srv.on("error", reject);
    srv.listen(0, "127.0.0.1", () => {
      const addr = srv.address();
      if (addr === null || typeof addr === "string") {
        srv.close();
        reject(new Error("could not determine a free port"));
        return;
      }
      const { port } = addr;
      srv.close(() => resolve(port));
    });
  });
}

async function waitForRpc(rpcUrl: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(rpcUrl, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "eth_chainId",
          params: [],
        }),
      });
      if (res.ok) {
        const json = (await res.json()) as { result?: string };
        if (typeof json.result === "string") return;
      }
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  throw new Error(`anvil did not become ready within ${timeoutMs}ms`);
}

export async function startAnvil(opts?: {
  port?: number;
}): Promise<AnvilHandle> {
  const port = opts?.port ?? (await getFreePort());
  const bin = resolveAnvilBin();
  const rpcUrl = `http://127.0.0.1:${port}`;

  const child: ChildProcess = spawn(bin, ["--port", String(port), "--silent"], {
    stdio: ["ignore", "ignore", "pipe"],
  });

  let stderr = "";
  child.stderr?.on("data", (chunk: Buffer) => {
    stderr += chunk.toString();
  });

  const spawnError = new Promise<never>((_, reject) => {
    child.once("error", (err) => {
      reject(new Error(`failed to spawn anvil (${bin}): ${err.message}`));
    });
    child.once("exit", (code) => {
      reject(
        new Error(
          `anvil exited early with code ${String(code)}${stderr ? `: ${stderr}` : ""}`,
        ),
      );
    });
  });

  try {
    await Promise.race([waitForRpc(rpcUrl, 15_000), spawnError]);
  } catch (err) {
    child.kill("SIGKILL");
    throw err;
  }

  // Remove the early-exit rejector now that startup succeeded; otherwise a
  // later (intentional) exit would surface as an unhandled rejection.
  child.removeAllListeners("exit");
  child.removeAllListeners("error");

  const stop = (): Promise<void> =>
    new Promise<void>((resolve) => {
      if (child.exitCode !== null || child.signalCode !== null) {
        resolve();
        return;
      }
      const killTimer = setTimeout(() => child.kill("SIGKILL"), 3_000);
      killTimer.unref();
      child.once("exit", () => {
        clearTimeout(killTimer);
        resolve();
      });
      child.kill("SIGTERM");
    });

  return { rpcUrl, port, stop };
}

export function clientsFor(
  rpcUrl: string,
  keyIndex = 0,
): { pub: PublicClient; wallet: WalletClient } {
  const key = ANVIL_KEYS[keyIndex];
  if (key === undefined) {
    throw new Error(`no anvil key at index ${keyIndex}`);
  }
  const account = privateKeyToAccount(key);
  const transport = http(rpcUrl);
  const pub = createPublicClient({ chain: foundry, transport });
  const wallet = createWalletClient({ account, chain: foundry, transport });
  return { pub, wallet };
}

export function loadArtifact(name: ArtifactName): {
  abi: Abi;
  bytecode: `0x${string}`;
} {
  const file = path.join(
    process.cwd(),
    "src",
    "test",
    "artifacts",
    `${name}.json`,
  );
  const raw = readFileSync(file, "utf8");
  const parsed = JSON.parse(raw) as { abi: Abi; bytecode: string };
  const bytecode = parsed.bytecode.startsWith("0x")
    ? (parsed.bytecode as `0x${string}`)
    : (`0x${parsed.bytecode}` as `0x${string}`);
  return { abi: parsed.abi, bytecode };
}

export async function deployArtifact(
  rpcUrl: string,
  name: ArtifactName,
  args?: readonly unknown[],
): Promise<`0x${string}`> {
  const { abi, bytecode } = loadArtifact(name);
  const { pub, wallet } = clientsFor(rpcUrl);
  const hash = await wallet.deployContract({
    abi,
    bytecode,
    account: wallet.account ?? null,
    chain: foundry,
    args: args as unknown[] | undefined,
  });
  const receipt = await pub.waitForTransactionReceipt({ hash });
  if (receipt.contractAddress == null) {
    throw new Error(`deployment of ${name} produced no contract address`);
  }
  return receipt.contractAddress;
}
