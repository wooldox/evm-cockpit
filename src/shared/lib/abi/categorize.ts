import type { Abi, AbiFunction, AbiEvent, AbiError, AbiConstructor } from "abitype";
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
        const fn = item as AbiFunction;
        if (isReadable(fn)) {
          if (fn.inputs.length === 0) result.properties.push(fn);
          else result.getters.push(fn);
        } else {
          result.operations.push(fn);
        }
        break;
      }
      case "event":
        result.events.push(item as AbiEvent);
        break;
      case "error":
        result.errors.push(item as AbiError);
        break;
      case "constructor":
        result.constructor = item as AbiConstructor;
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
