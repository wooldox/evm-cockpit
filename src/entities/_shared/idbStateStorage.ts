import type { StateStorage } from "zustand/middleware";
import { createIdbStorage } from "@/shared/adapters/idb-storage";

export function idbStateStorage(storeName: string): StateStorage {
  const s = createIdbStorage<string>(storeName);
  return {
    getItem: async (name) => (await s.get(name)) ?? null,
    setItem: async (name, value) => {
      await s.set(name, value);
    },
    removeItem: async (name) => {
      await s.delete(name);
    },
  };
}
