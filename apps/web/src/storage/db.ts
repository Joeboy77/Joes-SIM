/**
 * Everything the learner makes is kept on this device, in IndexedDB (brief: no accounts, no
 * database). One database, two stores: workspace files, and small records such as progress and
 * settings. Nothing here makes a network request.
 */
const NAME = "joes-sim";
const VERSION = 1;
export const FILES = "files";
export const RECORDS = "records";

let opening: Promise<IDBDatabase> | null = null;

export function openDb(): Promise<IDBDatabase> {
  if (opening) return opening;
  opening = new Promise((resolve, reject) => {
    const request = indexedDB.open(NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(FILES)) db.createObjectStore(FILES, { keyPath: "id" });
      if (!db.objectStoreNames.contains(RECORDS)) db.createObjectStore(RECORDS);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      opening = null;
      reject(request.error);
    };
  });
  return opening;
}

/** For tests: forget the open connection so the next call opens a fresh database. */
export function closeDb(): void {
  void opening?.then((db) => db.close());
  opening = null;
}

function done<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function getAll<T>(store: string): Promise<T[]> {
  const db = await openDb();
  return done(db.transaction(store).objectStore(store).getAll() as IDBRequest<T[]>);
}

export async function get<T>(store: string, key: string): Promise<T | undefined> {
  const db = await openDb();
  return done(db.transaction(store).objectStore(store).get(key) as IDBRequest<T | undefined>);
}

export async function put<T>(store: string, value: T, key?: string): Promise<void> {
  const db = await openDb();
  const os = db.transaction(store, "readwrite").objectStore(store);
  await done(key === undefined ? os.put(value) : os.put(value, key));
}

export async function remove(store: string, key: string): Promise<void> {
  const db = await openDb();
  await done(db.transaction(store, "readwrite").objectStore(store).delete(key));
}

export async function clear(store: string): Promise<void> {
  const db = await openDb();
  await done(db.transaction(store, "readwrite").objectStore(store).clear());
}
