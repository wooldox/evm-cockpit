import { createServer } from "node:net";
import {
  startAnvil,
  ensureMulticall3,
  type AnvilHandle,
} from "../src/test/anvil";

const ANVIL_PORT = 8545;
const ANVIL_URL = `http://127.0.0.1:${ANVIL_PORT}`;

let handle: AnvilHandle | null = null;

/** Reject fast with a clear message if the e2e Anvil port is already taken. */
async function assertPortFree(port: number): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const srv = createServer();
    srv.once("error", (err: NodeJS.ErrnoException) => {
      if (err.code === "EADDRINUSE") {
        reject(
          new Error(
            `port ${port} is already in use — stop the process bound to it ` +
              `before running e2e (the mock connector forwards transactions to ${ANVIL_URL}).`,
          ),
        );
      } else {
        reject(err);
      }
    });
    srv.once("listening", () => srv.close(() => resolve()));
    srv.listen(port, "127.0.0.1");
  });
}

/**
 * Playwright globalSetup. Spawns Anvil on the fixed port 8545 (the URL baked
 * into the Localhost · Anvil chain and the mock connector), installs Multicall3,
 * and returns a teardown closure that stops the node.
 */
export default async function globalSetup(): Promise<() => Promise<void>> {
  await assertPortFree(ANVIL_PORT);
  handle = await startAnvil({ port: ANVIL_PORT });
  await ensureMulticall3(ANVIL_URL);

  return async () => {
    if (handle) {
      await handle.stop();
      handle = null;
    }
  };
}
