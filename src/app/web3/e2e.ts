import type { Address } from "viem";

/**
 * Anvil's first well-known prefunded account (deterministic). Used as the mock
 * connector's account in E2E builds. Mirrors ANVIL_ACCOUNTS[0] in the
 * integration harness (src/test/anvil.ts) without importing test-only code into
 * the app bundle.
 */
export const ANVIL_ACCOUNT_0: Address =
  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";

/** True only in the inlined-at-build-time E2E build. */
export const IS_E2E = process.env.NEXT_PUBLIC_E2E === "1";
