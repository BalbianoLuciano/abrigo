/**
 * Web: IndexedDB (no localStorage, que es más visible y sincrónico).
 * Nada de lo guardado acá es legible para la persona en la interfaz.
 */
const DB_NAME = "abrigo";
const STORE = "kv";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    req.onsuccess = () => resolve(req.result as T);
    req.onerror = () => reject(req.error);
  }).finally(() => db.close());
}

export const secureStorage = {
  get: async (key: string): Promise<string | null> =>
    (await run<string | undefined>("readonly", (s) => s.get(key))) ?? null,
  set: async (key: string, value: string) => {
    await run("readwrite", (s) => s.put(value, key));
  },
  remove: async (key: string) => {
    await run("readwrite", (s) => s.delete(key));
  },
};
