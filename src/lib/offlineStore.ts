const DB_NAME = 'nautium-offline';
const DB_VERSION = 1;
const DATA_STORE = 'cached-data';
const SYNC_STORE = 'sync-queue';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DATA_STORE)) {
        db.createObjectStore(DATA_STORE);
      }
      if (!db.objectStoreNames.contains(SYNC_STORE)) {
        db.createObjectStore(SYNC_STORE, { keyPath: 'id', autoIncrement: true });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

function tx(store: string, mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDB().then(db => db.transaction(store, mode).objectStore(store));
}

// ── Cached data (reads) ──────────────────────────────────────────────────────

export function buildCacheKey(table: string, companyId: string, extra?: Record<string, any>): string {
  const base = `${table}::${companyId}`;
  if (!extra) return base;
  const sorted = Object.keys(extra).sort().map(k => `${k}=${extra[k]}`).join('&');
  return sorted ? `${base}::${sorted}` : base;
}

export async function getCachedData<T = any>(key: string): Promise<{ data: T; timestamp: number } | null> {
  try {
    const store = await tx(DATA_STORE, 'readonly');
    return new Promise((resolve) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result ?? null);
      req.onerror = () => resolve(null);
    });
  } catch { return null; }
}

export async function setCachedData(key: string, data: any): Promise<void> {
  try {
    const store = await tx(DATA_STORE, 'readwrite');
    await new Promise<void>((resolve) => {
      const req = store.put({ data, timestamp: Date.now() }, key);
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch { /* best-effort */ }
}

export async function clearCachedData(): Promise<void> {
  try {
    const store = await tx(DATA_STORE, 'readwrite');
    store.clear();
  } catch { /* best-effort */ }
}

// ── Optimistic cache updates (apply offline writes to cached reads) ──────────

export async function updateCachedRecord(table: string, id: string, updates: Record<string, any>): Promise<void> {
  try {
    const store = await tx(DATA_STORE, 'readwrite');
    const allKeys: string[] = await new Promise((resolve) => {
      const req = store.getAllKeys();
      req.onsuccess = () => resolve((req.result as string[]) || []);
      req.onerror = () => resolve([]);
    });

    for (const key of allKeys) {
      if (!key.startsWith(`${table}::`)) continue;
      const entry = await new Promise<any>((resolve) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });
      if (!entry?.data || !Array.isArray(entry.data)) continue;
      const idx = entry.data.findIndex((r: any) => r.id === id);
      if (idx === -1) continue;
      entry.data[idx] = { ...entry.data[idx], ...updates };
      store.put(entry, key);
    }
  } catch { /* best-effort */ }
}

export async function insertCachedRecord(table: string, record: Record<string, any>): Promise<void> {
  try {
    const store = await tx(DATA_STORE, 'readwrite');
    const allKeys: string[] = await new Promise((resolve) => {
      const req = store.getAllKeys();
      req.onsuccess = () => resolve((req.result as string[]) || []);
      req.onerror = () => resolve([]);
    });

    for (const key of allKeys) {
      if (!key.startsWith(`${table}::`)) continue;
      const entry = await new Promise<any>((resolve) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });
      if (!entry?.data || !Array.isArray(entry.data)) continue;
      const companyId = key.split('::')[1];
      if (record.company_id && record.company_id !== companyId) continue;
      entry.data.unshift(record);
      store.put(entry, key);
    }
  } catch { /* best-effort */ }
}

export async function deleteCachedRecord(table: string, id: string): Promise<void> {
  try {
    const store = await tx(DATA_STORE, 'readwrite');
    const allKeys: string[] = await new Promise((resolve) => {
      const req = store.getAllKeys();
      req.onsuccess = () => resolve((req.result as string[]) || []);
      req.onerror = () => resolve([]);
    });

    for (const key of allKeys) {
      if (!key.startsWith(`${table}::`)) continue;
      const entry = await new Promise<any>((resolve) => {
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
      });
      if (!entry?.data || !Array.isArray(entry.data)) continue;
      const before = entry.data.length;
      entry.data = entry.data.filter((r: any) => r.id !== id);
      if (entry.data.length < before) store.put(entry, key);
    }
  } catch { /* best-effort */ }
}

// ── Sync queue (offline mutations) ───────────────────────────────────────────

export interface SyncEntry {
  id?: number;
  action: 'insert' | 'update' | 'delete' | 'delete_where';
  table: string;
  payload: Record<string, any>;
  createdAt: number;
  retries: number;
}

export async function addToSyncQueue(entry: Omit<SyncEntry, 'id' | 'createdAt' | 'retries'>): Promise<void> {
  try {
    const store = await tx(SYNC_STORE, 'readwrite');
    await new Promise<void>((resolve) => {
      const req = store.add({ ...entry, createdAt: Date.now(), retries: 0 });
      req.onsuccess = () => resolve();
      req.onerror = () => resolve();
    });
  } catch { /* best-effort */ }
}

export async function getSyncQueue(): Promise<SyncEntry[]> {
  try {
    const store = await tx(SYNC_STORE, 'readonly');
    return new Promise((resolve) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result ?? []);
      req.onerror = () => resolve([]);
    });
  } catch { return []; }
}

export async function removeSyncEntry(id: number): Promise<void> {
  try {
    const store = await tx(SYNC_STORE, 'readwrite');
    store.delete(id);
  } catch { /* best-effort */ }
}

export async function updateSyncEntry(id: number, updates: Partial<SyncEntry>): Promise<void> {
  try {
    const store = await tx(SYNC_STORE, 'readwrite');
    const req = store.get(id);
    req.onsuccess = () => {
      if (req.result) {
        store.put({ ...req.result, ...updates });
      }
    };
  } catch { /* best-effort */ }
}

export async function getSyncQueueCount(): Promise<number> {
  try {
    const store = await tx(SYNC_STORE, 'readonly');
    return new Promise((resolve) => {
      const req = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(0);
    });
  } catch { return 0; }
}
