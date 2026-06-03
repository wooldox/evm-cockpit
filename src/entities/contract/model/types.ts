import type {
  Abi,
  AbiFunction,
  AbiEvent,
  AbiError,
  AbiConstructor,
} from "abitype";

export type TAddress = `0x${string}`;
export type TChainId = number;
export type TUid = string;

export type TAbiSource = "manual" | "sourcify" | "etherscan";

export type TProxyKind = "eip1967" | "beacon";

export type TProxyInfo = {
  kind: TProxyKind;
  implAddress: TAddress;
  implAbi?: Abi;
};

export type TContract = {
  id: TUid;
  name: string;
  chainId: TChainId;
  address: TAddress;
  abi: Abi;
  source: TAbiSource;
  proxy?: TProxyInfo;
  addedAt: number;
};

export type TContractWithoutId = Omit<TContract, "id" | "addedAt">;

/** Result of splitting an ABI into the app's surfaces. */
export type TAbiCategories = {
  properties: AbiFunction[]; // view/pure, zero inputs
  getters: AbiFunction[]; // view/pure, >=1 input
  operations: AbiFunction[]; // nonpayable/payable
  events: AbiEvent[];
  errors: AbiError[];
  constructor?: AbiConstructor;
  hasFallback: boolean;
  hasReceive: boolean;
};
