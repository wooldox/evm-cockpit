#!/usr/bin/env bash
#
# Compiles the Solidity fixtures in contracts/ and extracts {abi, bytecode}
# into src/test/artifacts/<Contract>.json for the integration test layer.
#
# IMPORTANT: this machine's `forge` on PATH is forge-zksync (a different
# toolchain). Always use standard Foundry. Resolve the binary as:
#   FORGE_BIN env  ->  ~/.foundry-standard/bin/forge (fallback)
#
# Usage:  FORGE_BIN=/path/to/forge ./scripts/build-artifacts.sh
#     or  ./scripts/build-artifacts.sh   (uses the fallback)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

FORGE="${FORGE_BIN:-$HOME/.foundry-standard/bin/forge}"

if [[ ! -x "$FORGE" ]]; then
  echo "error: forge not found/executable at: $FORGE" >&2
  echo "set FORGE_BIN to a standard Foundry forge (NOT forge-zksync)." >&2
  exit 1
fi

echo "Using forge: $FORGE"
"$FORGE" --version

cd "$ROOT_DIR/contracts"
"$FORGE" build

OUT_DIR="$ROOT_DIR/contracts/out"
ART_DIR="$ROOT_DIR/src/test/artifacts"
mkdir -p "$ART_DIR"

# <SourceFile.sol>:<ContractName> pairs to extract.
PAIRS=(
  "TestToken.sol:TestToken"
  "Counter.sol:CounterV1"
  "SlimProxy.sol:SlimProxy"
)

for pair in "${PAIRS[@]}"; do
  file="${pair%%:*}"
  contract="${pair##*:}"
  src="$OUT_DIR/$file/$contract.json"
  dest="$ART_DIR/$contract.json"

  if [[ ! -f "$src" ]]; then
    echo "error: expected build artifact missing: $src" >&2
    exit 1
  fi

  SRC="$src" DEST="$dest" node -e '
    const fs = require("node:fs");
    const src = JSON.parse(fs.readFileSync(process.env.SRC, "utf8"));
    const out = {
      abi: src.abi,
      bytecode: src.bytecode.object,
    };
    fs.writeFileSync(process.env.DEST, JSON.stringify(out, null, 2) + "\n");
  '
  echo "wrote $dest"
done

echo "done."
