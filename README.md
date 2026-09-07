# EVM Cockpit

A client-side web tool to **read and write any EVM smart contract, on any chain** — built for developers and auditors.

EVM Cockpit runs entirely in your browser. There is no backend: it talks directly to RPC endpoints and your wallet, and ships as a static export you can host anywhere.

## Why

Block explorers let you call contracts, but they're tied to one chain, gate writes behind their own UX, and rarely show you what a transaction will actually do before you sign it. EVM Cockpit's safety centerpiece is **simulate-before-sign**: every write is simulated against current chain state, the decoded outcome (success, revert reason, gas) is shown, and **Sign is gated on a passing simulation**. Reads are blue and free; writes are amber and send a transaction — the UI never lets the two blur together.

## Features

- **Any contract, any chain** — a full catalog of ~2,900 networks (sourced from [chainlist.org](https://chainlist.org)), each with a fallback list of RPC endpoints, plus add-your-own custom chains.
- **ABI resolution** — auto-fetch verified ABIs via Sourcify → Etherscan V2, with automatic proxy detection (EIP-1967 / beacon) and implementation-ABI merging. Or paste an ABI manually.
- **Reads** — properties and getters rendered with typed inputs, batched via Multicall3 where available (sequential fallback otherwise).
- **Writes** — typed argument inputs and payable ETH value, an explicit **Simulate** step with a will-succeed / will-revert verdict and decoded custom-error reverts, then **Sign & Send** gated on the simulation. An **Execute** path is available for direct send when you want to review the raw transaction and skip simulation.
- **Deploy** — paste a Hardhat/Foundry artifact (or ABI + bytecode), fill the constructor, and deploy.
- **Sign** — sign messages, verify signed messages (off-chain ecrecover), and parse/preview/broadcast raw transactions.
- **Events** — pick an event, set a block range, and get a decoded log table (auto-chunked with bisect-on-failure).
- **History** — every read, simulation, and write is recorded locally and re-runnable.
- **Share** — export a contract as a link or JSON file and import it back.

Everything is stored locally in IndexedDB. No accounts, no telemetry.

## Tech stack

Next.js 16 (App Router, static export) · React 19 · TypeScript (strict) · viem · wagmi · RainbowKit · TanStack Query · zustand · Tailwind CSS v4 · Vitest + Testing Library · Playwright.

## Getting started

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Configuration

All configuration is optional — injected wallets (e.g. MetaMask) and public RPCs work out of the box. Copy `.env.example` to `.env.local` to set:

- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` — a [Reown](https://cloud.reown.com) project id, for WalletConnect-based wallets.

An Etherscan API key (for the explorer ABI-fetch fallback) and per-chain RPC overrides are configured in-app under Settings.

## Building

```bash
npm run build      # static export to ./out
```

The contents of `out/` are fully static and can be served by any static host or CDN.

## Testing

```bash
npm run test           # unit + component (Vitest, jsdom)
npm run test:cov       # with coverage thresholds
npm run test:integration   # integration tests against a local Anvil node
npm run test:e2e       # Playwright end-to-end (mock wallet + Anvil)
npm run typecheck
npm run lint
npm run format:check
```

The integration and e2e layers spin up a local [Anvil](https://book.getfoundry.sh/anvil/) node; see `scripts/` and `e2e/` for details.

## License

[MIT](./LICENSE)
