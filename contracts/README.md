# Solidity test fixtures

These contracts are **integration-test fixtures only**. They are compiled
once, and their `{abi, bytecode}` are committed to `src/test/artifacts/` as
deterministic inputs for the Anvil integration tests (`src/**/*.itest.ts`).
They are not part of the shipped app.

## Contracts

- **`src/TestToken.sol`** — an ERC20-like token. Exercises a custom error
  (`InsufficientBalance`), a plain `Error(string)` revert path (`burnFrom`),
  an overloaded function (`mint(address,uint256)` / `mint(uint256)`), a
  `payable` function (`deposit`), and `Transfer`/`Approval`/`Deposit` events.
- **`src/Counter.sol`** — `CounterV1`, a tiny upgradeable-style implementation
  (`initialize` / `increment` / `count` / `version`) used behind the proxy.
- **`src/SlimProxy.sol`** — a minimal EIP-1967 proxy storing its
  implementation at slot
  `0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc` and
  delegatecalling to it from `fallback`/`receive`.

## Regenerating artifacts

> ⚠️ **WARNING:** On this machine, the `forge` on `PATH` is **forge-zksync**,
> a different toolchain that produces incompatible artifacts. Do **not** run
> bare `forge`. Use standard Foundry (installed at
> `~/.foundry-standard/bin/`).

From the repo root:

```bash
FORGE_BIN=~/.foundry-standard/bin/forge ./scripts/build-artifacts.sh
```

The script runs `forge build` (letting forge auto-download solc 0.8.24),
then extracts `{abi, bytecode}` into `src/test/artifacts/<Contract>.json`.
Commit the regenerated artifacts — they are deterministic test inputs and
are **not** gitignored. The build outputs in `contracts/out/` and
`contracts/cache/` are gitignored.
