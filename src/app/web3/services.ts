import { createViemRpc } from '@/shared/adapters/viem-rpc';
import { createSourcifyAbiSource } from '@/shared/adapters/sourcify';
import { createEtherscanAbiSource } from '@/shared/adapters/etherscan';
import { createAbiResolver } from '@/shared/adapters/abi-resolver';
import { useSettingsStore } from '@/entities/settings/model/store';

export const viemRpc = createViemRpc(
  () => useSettingsStore.getState().rpcOverrides,
);

export const abiResolver = createAbiResolver([
  createSourcifyAbiSource(),
  createEtherscanAbiSource(() => useSettingsStore.getState().etherscanApiKey),
]);
