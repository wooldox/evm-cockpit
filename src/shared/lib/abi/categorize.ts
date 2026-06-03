import type { Abi, AbiFunction } from "abitype";
import type { TAbiCategories } from "@/entities/contract/model/types";

const isReadable = (f: AbiFunction) =>
  f.stateMutability === "view" || f.stateMutability === "pure";

export function categorizeAbi(abi: Abi): TAbiCategories {
  const result: TAbiCategories = {
    properties: [],
    getters: [],
    operations: [],
    events: [],
    errors: [],
    constructor: undefined,
    hasFallback: false,
    hasReceive: false,
  };

  for (const item of abi) {
    switch (item.type) {
      case "function": {
        if (isReadable(item)) {
          if (item.inputs.length === 0) result.properties.push(item);
          else result.getters.push(item);
        } else {
          result.operations.push(item);
        }
        break;
      }
      case "event":
        result.events.push(item);
        break;
      case "error":
        result.errors.push(item);
        break;
      case "constructor":
        result.constructor = item;
        break;
      case "fallback":
        result.hasFallback = true;
        break;
      case "receive":
        result.hasReceive = true;
        break;
    }
  }

  return result;
}
