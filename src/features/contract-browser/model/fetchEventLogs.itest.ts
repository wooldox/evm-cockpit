import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AbiEvent } from 'abitype';
import type { TContract } from '@/entities/contract/model/types';
import {
  ANVIL_ACCOUNTS,
  clientsFor,
  deployArtifact,
  loadArtifact,
  startAnvil,
  type AnvilHandle,
} from '@/test/anvil';
import { createViemRpc } from '@/shared/adapters/viem-rpc';
import { fetchEventLogs } from './fetchEventLogs';

/**
 * Exercises {@link fetchEventLogs} against a live Anvil node through the REAL
 * viem-rpc adapter. The fixture token emits a `Transfer` from the constructor
 * mint, one per `transfer`, and one more from the `deposit` mint (plus a
 * `Deposit` event), so we can assert exact log counts and decoded args.
 */
describe('fetchEventLogs (integration)', () => {
  let anvil: AnvilHandle;
  const INITIAL_SUPPLY = 1000n * 10n ** 18n;
  const DEPOSIT_VALUE = 10n ** 18n;
  const TRANSFER_AMOUNT = 10n ** 18n;
  const TRANSFER_COUNT = 4;

  let contract: TContract;
  let rpc: ReturnType<typeof createViemRpc>;

  // Block number of the deploy tx (constructor Transfer lives here).
  let deployBlock: bigint;
  // Block of the 2nd transfer (used to narrow the range past it).
  let secondTransferBlock: bigint;
  let latestBlock: bigint;

  function eventByName(name: string): AbiEvent {
    const ev = contract.abi.find(
      (e): e is AbiEvent => e.type === 'event' && e.name === name,
    );
    if (!ev) throw new Error(`no event ${name} in ABI`);
    return ev;
  }

  beforeAll(async () => {
    anvil = await startAnvil();
    const address = await deployArtifact(anvil.rpcUrl, 'TestToken', [
      'Cockpit Token',
      'CKPT',
      INITIAL_SUPPLY,
    ]);

    const { abi } = loadArtifact('TestToken');
    rpc = createViemRpc(() => ({ 31337: anvil.rpcUrl }));
    contract = {
      id: 't1',
      name: 'Cockpit Token',
      chainId: 31337,
      address,
      abi,
      source: 'manual',
      addedAt: 0,
    };

    const { wallet, pub } = clientsFor(anvil.rpcUrl);
    // viem caches getBlockNumber (default cacheTime), which would pin every
    // later read to the deploy block; force a fresh read each time.
    deployBlock = await pub.getBlockNumber({ cacheTime: 0 });

    // Emit TRANSFER_COUNT transfers, one per block (Anvil automines per tx).
    for (let i = 0; i < TRANSFER_COUNT; i++) {
      const hash = await wallet.writeContract({
        address,
        abi,
        functionName: 'transfer',
        args: [ANVIL_ACCOUNTS[1], TRANSFER_AMOUNT],
        account: wallet.account ?? null,
        chain: null,
      });
      const receipt = await pub.waitForTransactionReceipt({ hash });
      if (i === 1) secondTransferBlock = receipt.blockNumber;
    }

    // One payable deposit: mints (a Transfer from 0x0) AND emits Deposit.
    const depositHash = await wallet.writeContract({
      address,
      abi,
      functionName: 'deposit',
      args: [],
      value: DEPOSIT_VALUE,
      account: wallet.account ?? null,
      chain: null,
    });
    await pub.waitForTransactionReceipt({ hash: depositHash });

    latestBlock = await pub.getBlockNumber({ cacheTime: 0 });
  }, 30_000);

  afterAll(async () => {
    await anvil?.stop();
  });

  it('fetches all Transfer logs over the full block range', async () => {
    const res = await fetchEventLogs(
      { rpc },
      {
        contract,
        event: eventByName('Transfer'),
        fromBlock: 0n,
        toBlock: latestBlock,
      },
    );

    // 1 (constructor mint) + TRANSFER_COUNT (transfers) + 1 (deposit mint).
    const expected = 1 + TRANSFER_COUNT + 1;
    expect(res.logs).toHaveLength(expected);
    expect(res.truncated).toBe(false);

    // The constructor mint is the first Transfer: from 0x0 → deployer.
    const first = res.logs[0];
    expect(first?.blockNumber).toBe(deployBlock);
    expect(first?.args).toMatchObject({
      from: '0x0000000000000000000000000000000000000000',
      to: ANVIL_ACCOUNTS[0],
      value: INITIAL_SUPPLY,
    });

    // A user transfer carries the deployer → account1 args we sent.
    const userTransfer = res.logs.find(
      (l) => l.args.from === ANVIL_ACCOUNTS[0],
    );
    expect(userTransfer?.args).toMatchObject({
      from: ANVIL_ACCOUNTS[0],
      to: ANVIL_ACCOUNTS[1],
      value: TRANSFER_AMOUNT,
    });
  });

  it('narrows the range to logs after the 2nd transfer', async () => {
    const res = await fetchEventLogs(
      { rpc },
      {
        contract,
        event: eventByName('Transfer'),
        fromBlock: secondTransferBlock + 1n,
        toBlock: latestBlock,
      },
    );

    // After the 2nd transfer: transfers 3 & 4 (2) + the deposit mint (1) = 3.
    expect(res.logs).toHaveLength(3);
  });

  it('fetches the single Deposit log with decoded args', async () => {
    const res = await fetchEventLogs(
      { rpc },
      {
        contract,
        event: eventByName('Deposit'),
        fromBlock: 0n,
        toBlock: latestBlock,
      },
    );

    expect(res.logs).toHaveLength(1);
    expect(res.logs[0]?.args.from).toBe(ANVIL_ACCOUNTS[0]);
    expect(res.logs[0]?.args.amount).toBe(DEPOSIT_VALUE);
  });

  it('returns logs in ascending block order across a single chunk', async () => {
    const res = await fetchEventLogs(
      { rpc },
      {
        contract,
        event: eventByName('Transfer'),
        fromBlock: 0n,
        toBlock: latestBlock,
      },
    );

    const blocks = res.logs.map((l) => l.blockNumber);
    const sorted = [...blocks].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    expect(blocks).toEqual(sorted);

    // The whole range fits in one CHUNK_SIZE window, so exactly one round-trip.
    expect(res.chunks).toBe(1);
    expect(res.truncated).toBe(false);
  });
});
