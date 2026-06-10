import { BaseError, ContractFunctionRevertedError, type Abi } from 'viem';
import { decodeRevert } from './decodeRevert';

export type WriteErrorKind = 'revert' | 'rpc';
export type ClassifiedWriteError = { kind: WriteErrorKind; message: string };

/**
 * Classify a thrown error from a write simulation/estimation into either a
 * contract revert (decoded against the ABI) or a generic RPC/transport failure.
 */
export function classifyWriteError(
  abi: Abi,
  error: unknown,
): ClassifiedWriteError {
  if (error instanceof BaseError) {
    const revertErr = error.walk(
      (e) => e instanceof ContractFunctionRevertedError,
    );
    if (revertErr instanceof ContractFunctionRevertedError) {
      const message = revertErr.raw
        ? decodeRevert(abi, revertErr.raw)
        : (revertErr.reason ?? revertErr.shortMessage);
      return { kind: 'revert', message };
    }
    return { kind: 'rpc', message: error.shortMessage ?? error.message };
  }
  // Duck-typed error-likes (viem-shaped mocks, cross-realm errors): honor
  // shortMessage/message before falling back to String().
  if (error && typeof error === 'object') {
    const o = error as { shortMessage?: unknown; message?: unknown };
    if (typeof o.shortMessage === 'string') {
      return { kind: 'rpc', message: o.shortMessage };
    }
    if (typeof o.message === 'string') {
      return { kind: 'rpc', message: o.message };
    }
  }
  return { kind: 'rpc', message: String(error) };
}

/**
 * Compact one-line form of a failed contract CALL (read or write) for inline
 * display: a decoded revert ("reverted: Foo(...)") or the transport error's
 * short message — never viem's multi-line dump (Contract Call / Docs /
 * Version). E.g. a UUPS `proxiableUUID()` read through a proxy renders as
 * "reverted: UnauthorizedCallContext()".
 */
export function formatCallError(abi: Abi, error: unknown): string {
  const { kind, message } = classifyWriteError(abi, error);
  // decodeRevert already prefixes some shapes (`reverted: "msg"`, `panic(n)`,
  // `execution reverted (…)`) — only prefix bare custom-error names.
  const alreadyMarked = /reverted|panic\(/i.test(message);
  return kind === 'revert' && !alreadyMarked ? `reverted: ${message}` : message;
}
