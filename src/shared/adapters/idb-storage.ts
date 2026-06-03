import { openDB, type IDBPDatabase } from "idb";
import type { Storage } from "@/shared/ports/storage";

const DB_NAME = "evm-cockpit";
const STORES = ["contracts", "settings", "customChains", "history"] as const;
let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  return (dbp ??= openDB(DB_NAME, 1, {
    upgrade(d) {
      for (const s of STORES)
        if (!d.objectStoreNames.contains(s)) d.createObjectStore(s);
    },
  }));
}
export function createIdbStorage<T>(storeName: string): Storage<T> {
  return {
    async get(key) {
      return (await (await db()).get(storeName, key)) as T | undefined;
    },
    async set(key, value) {
      await (await db()).put(storeName, value, key);
    },
    async delete(key) {
      await (await db()).delete(storeName, key);
    },
    async keys() {
      return (await (await db()).getAllKeys(storeName)).map(String);
    },
  };
}
