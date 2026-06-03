import type { Abi } from "abitype";

/** Minimal ERC20-like ABI plus an overloaded function and fallback/receive. */
export const erc20Abi: Abi = [
  { type: "constructor", stateMutability: "nonpayable", inputs: [{ name: "supply", type: "uint256" }] },
  { type: "function", name: "name", stateMutability: "view", inputs: [], outputs: [{ type: "string" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "totalSupply", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "transfer", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "deposit", stateMutability: "payable", inputs: [], outputs: [] },
  // overloaded: two `mint` signatures
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "amount", type: "uint256" }], outputs: [] },
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
  { type: "event", name: "Transfer", inputs: [{ name: "from", type: "address", indexed: true }, { name: "to", type: "address", indexed: true }, { name: "value", type: "uint256", indexed: false }], anonymous: false },
  { type: "error", name: "InsufficientBalance", inputs: [{ name: "available", type: "uint256" }, { name: "required", type: "uint256" }] },
  { type: "fallback", stateMutability: "payable" },
  { type: "receive", stateMutability: "payable" },
];
