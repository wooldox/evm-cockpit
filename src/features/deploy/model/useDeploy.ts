'use client';

import { useRef, useState } from 'react';
import { useAccount, useChainId, useDeployContract } from 'wagmi';
import type { Abi, AbiParameter } from 'abitype';
import type { RpcProvider } from '@/shared/ports/rpc';
import { viemRpc } from '@/app/web3/services';
import { categorizeAbi } from '@/shared/lib/abi/categorize';
import { paramSchema } from '@/shared/lib/values/paramSchema';
import { toBaseUnits, type EthUnit } from '@/shared/lib/units/units';

export type DeployArtifact = {
  abi: Abi;
  bytecode: `0x${string}`;
  constructorInputs: readonly AbiParameter[];
  payable: boolean;
};

export type ArtifactState =
  | { status: 'empty' }
  | { status: 'invalid'; abiError?: string; bytecodeError?: string }
  | { status: 'ready'; artifact: DeployArtifact };

export type DeployState =
  | { status: 'idle' }
  | { status: 'wallet' } // awaiting signature in wallet
  | { status: 'pending'; hash: `0x${string}` }
  | {
      status: 'confirmed';
      hash: `0x${string}`;
      contractAddress: `0x${string}`;
      gasUsed: bigint;
    }
  | { status: 'failed'; error: string };

export type UseDeployResult = {
  artifact: ArtifactState;
  /** Synchronous: parse ABI + bytecode and set `artifact`. */
  parseArtifact: (abiRaw: string, bytecodeRaw: string) => void;
  deployState: DeployState;
  argErrors: Record<string, string>;
  valueError?: string;
  /**
   * Resolves with the terminal DeployState so an event handler can fire
   * success/failure toasts without reading stale closure state. A no-op
   * re-entrant call resolves with the current state.
   */
  deploy: (
    rawArgs: Record<string, string>,
    rawValue?: { amount: string; unit: EthUnit },
  ) => Promise<DeployState>;
  resetDeploy: () => void;
};

type Deps = { rpc: RpcProvider };

const defaultDeps: Deps = { rpc: viemRpc };

const HEX_RE = /^0x[0-9a-fA-F]+$/;

/** Pull a bytecode string from a Hardhat/Foundry artifact's `bytecode` field. */
function readEmbeddedBytecode(bytecode: unknown): string | undefined {
  if (typeof bytecode === 'string') return bytecode;
  if (
    bytecode !== null &&
    typeof bytecode === 'object' &&
    'object' in bytecode &&
    typeof (bytecode as { object: unknown }).object === 'string'
  ) {
    return (bytecode as { object: string }).object;
  }
  return undefined;
}

export function useDeploy(deps: Deps = defaultDeps): UseDeployResult {
  const [artifact, setArtifact] = useState<ArtifactState>({ status: 'empty' });
  const [deployState, setDeployState] = useState<DeployState>({
    status: 'idle',
  });
  const [argErrors, setArgErrors] = useState<Record<string, string>>({});
  const [valueError, setValueError] = useState<string | undefined>(undefined);
  // Re-entrancy guard. A ref, not `deployState`, because the state value
  // captured in this closure can be stale across overlapping deploy() calls.
  const inFlight = useRef(false);

  const { address, isConnected } = useAccount();
  // Deploys target the WALLET's current chain — there is no per-deploy target
  // chain and no chain switching. The receipt is fetched on this same chain.
  const walletChainId = useChainId();
  const { deployContractAsync } = useDeployContract();

  function parseArtifact(abiRaw: string, bytecodeRaw: string): void {
    // A new artifact is a new world: drop any prior deploy result + errors.
    setDeployState({ status: 'idle' });
    setArgErrors({});
    setValueError(undefined);

    const abiTrimmed = abiRaw.trim();
    let bytecodeTrimmed = bytecodeRaw.trim();

    if (abiTrimmed === '' && bytecodeTrimmed === '') {
      setArtifact({ status: 'empty' });
      return;
    }

    let abiError: string | undefined;
    let bytecodeError: string | undefined;
    let abi: Abi | undefined;

    // --- ABI ---
    if (abiTrimmed === '') {
      abiError = 'ABI must be a JSON array (or an artifact object with .abi)';
    } else {
      let parsed: unknown;
      try {
        parsed = JSON.parse(abiTrimmed);
      } catch {
        abiError = 'invalid JSON';
      }

      if (abiError === undefined) {
        if (Array.isArray(parsed)) {
          abi = parsed as Abi;
        } else if (
          parsed !== null &&
          typeof parsed === 'object' &&
          Array.isArray((parsed as { abi?: unknown }).abi)
        ) {
          // Convenience: accept a full Hardhat/Foundry artifact object. Use its
          // `.abi`, and when no explicit bytecode was supplied, pull bytecode
          // from `.bytecode.object` (Foundry) or `.bytecode` (Hardhat string).
          abi = (parsed as { abi: Abi }).abi;
          if (bytecodeTrimmed === '') {
            const embedded = readEmbeddedBytecode(
              (parsed as { bytecode?: unknown }).bytecode,
            );
            if (embedded !== undefined) bytecodeTrimmed = embedded.trim();
          }
        } else {
          abiError =
            'ABI must be a JSON array (or an artifact object with .abi)';
        }
      }

      if (abiError === undefined && abi !== undefined && abi.length === 0) {
        abiError = 'ABI is empty';
        abi = undefined;
      }
    }

    // --- Bytecode (after the artifact-object fallback above) ---
    if (bytecodeTrimmed === '') {
      bytecodeError = 'bytecode required';
    } else if (
      !HEX_RE.test(bytecodeTrimmed) ||
      bytecodeTrimmed.length % 2 !== 0
    ) {
      bytecodeError = 'bytecode must be 0x-prefixed hex';
    }

    if (abiError !== undefined || bytecodeError !== undefined) {
      setArtifact({ status: 'invalid', abiError, bytecodeError });
      return;
    }

    const ctor = categorizeAbi(abi!).constructor;
    setArtifact({
      status: 'ready',
      artifact: {
        abi: abi!,
        bytecode: bytecodeTrimmed as `0x${string}`,
        constructorInputs: ctor?.inputs ?? [],
        payable: ctor?.stateMutability === 'payable',
      },
    });
  }

  function resetDeploy(): void {
    setDeployState({ status: 'idle' });
    setArgErrors({});
    setValueError(undefined);
  }

  async function deploy(
    rawArgs: Record<string, string>,
    rawValue?: { amount: string; unit: EthUnit },
  ): Promise<DeployState> {
    // Defensive: UI gates this on a ready artifact.
    if (artifact.status !== 'ready') return deployState;

    // Ignore overlapping deploys while one is awaiting the wallet or pending.
    if (inFlight.current) return deployState;

    // Defensive: UI should prevent deploying without a wallet. Deploys record
    // NO history — a history entry is keyed by contractId, which does not yet
    // exist for an undeployed contract.
    if (!isConnected || !address) {
      const failed: DeployState = {
        status: 'failed',
        error: 'connect a wallet to deploy',
      };
      setDeployState(failed);
      return failed;
    }

    const { abi, bytecode, constructorInputs, payable } = artifact.artifact;

    // Validate constructor args (same pattern as useSimulation).
    const nextArgErrors: Record<string, string> = {};
    const parsedArgs: unknown[] = [];
    for (let i = 0; i < constructorInputs.length; i++) {
      const input = constructorInputs[i]!;
      const key = input.name ?? String(i);
      const raw = rawArgs[key] ?? '';
      const parsed = paramSchema(input.type).safeParse(raw);
      if (!parsed.success) {
        nextArgErrors[key] = parsed.error.issues[0]?.message ?? 'invalid value';
      } else {
        parsedArgs.push(parsed.data);
      }
    }

    // Validate payable value.
    let value: bigint | undefined;
    let nextValueError: string | undefined;
    if (payable && rawValue) {
      const amount = rawValue.amount.trim();
      if (amount !== '' && amount !== '0') {
        try {
          value = toBaseUnits(amount, rawValue.unit);
        } catch (e) {
          nextValueError = e instanceof Error ? e.message : String(e);
        }
      }
    }

    if (Object.keys(nextArgErrors).length > 0 || nextValueError !== undefined) {
      setArgErrors(nextArgErrors);
      setValueError(nextValueError);
      // Stay at the current (idle/terminal) state; make no on-chain calls.
      return deployState;
    }

    setArgErrors({});
    setValueError(undefined);
    inFlight.current = true;

    try {
      setDeployState({ status: 'wallet' });

      let hash: `0x${string}`;
      try {
        hash = await deployContractAsync({
          abi,
          bytecode,
          args: parsedArgs,
          value,
        });
      } catch (e) {
        const err = e as { shortMessage?: string; message?: string };
        const msg = err.shortMessage ?? err.message ?? 'deployment failed';
        const failed: DeployState = { status: 'failed', error: msg };
        setDeployState(failed);
        return failed;
      }

      setDeployState({ status: 'pending', hash });

      let receipt: {
        status: 'success' | 'reverted';
        contractAddress: `0x${string}` | null | undefined;
        gasUsed: bigint;
      };
      try {
        receipt = (await deps.rpc
          .getClient(walletChainId)
          .waitForTransactionReceipt({ hash })) as {
          status: 'success' | 'reverted';
          contractAddress: `0x${string}` | null | undefined;
          gasUsed: bigint;
        };
      } catch (e) {
        const err = e as { shortMessage?: string; message?: string };
        const msg = err.shortMessage ?? err.message ?? 'deployment failed';
        const failed: DeployState = { status: 'failed', error: msg };
        setDeployState(failed);
        return failed;
      }

      if (receipt.status === 'reverted') {
        const failed: DeployState = {
          status: 'failed',
          error: 'deployment reverted on-chain',
        };
        setDeployState(failed);
        return failed;
      }

      if (!receipt.contractAddress) {
        const failed: DeployState = {
          status: 'failed',
          error: 'no contract address in receipt',
        };
        setDeployState(failed);
        return failed;
      }

      const confirmed: DeployState = {
        status: 'confirmed',
        hash,
        contractAddress: receipt.contractAddress,
        gasUsed: receipt.gasUsed,
      };
      setDeployState(confirmed);
      return confirmed;
    } finally {
      // Released at every terminal state so a subsequent deploy() can proceed.
      inFlight.current = false;
    }
  }

  return {
    artifact,
    parseArtifact,
    deployState,
    argErrors,
    valueError,
    deploy,
    resetDeploy,
  };
}
