export interface CacheRecord {
  body: unknown;
  revision: string;
  cachedAt: number;
  schemaVersion?: number;
}
interface StoredEntry extends CacheRecord {
  url: string;
}
export const DB_NAME = 'dnd-catalog-v1';
export const DB_VERSION = 1;
export const STORE_NAME = 'entries';
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const CACHE_SCHEMA_VERSION = 1;
const memoryFallback = new Map<string, CacheRecord>();
const writeFailures = new Map<string, string>();

function getIndexedDB(): IDBFactory | undefined {
  return typeof globalThis.indexedDB === 'undefined' ? undefined : globalThis.indexedDB;
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const idb = getIndexedDB();
    if (!idb) {
      reject(new Error('当前环境不支持 IndexedDB'));
      return;
    }
    const request = idb.open(DB_NAME, DB_VERSION);
    let blocked = false;
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME))
        request.result.createObjectStore(STORE_NAME, { keyPath: 'url' });
    };
    request.onblocked = () => {
      blocked = true;
      reject(new Error('资源数据库被其他标签页占用，请关闭旧页面后重试'));
    };
    request.onsuccess = () => {
      if (blocked) {
        request.result.close();
        return;
      }
      resolve(request.result);
    };
    request.onerror = () => reject(request.error || new Error('无法打开资源数据库'));
  });
}

/** 请求成功不代表事务提交成功；所有连接都在事务结束后关闭。 */
async function transaction<T>(
  mode: IDBTransactionMode,
  action: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDatabase();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, mode);
      let result: T;
      tx.oncomplete = () => resolve(result);
      tx.onabort = () => reject(tx.error || new Error('资源缓存事务已中止'));
      tx.onerror = () => reject(tx.error || new Error('资源缓存事务失败'));
      const request = action(tx.objectStore(STORE_NAME));
      request.onsuccess = () => {
        result = request.result;
      };
    });
  } finally {
    db.close();
  }
}

export function isCacheValid(record: CacheRecord, ttlMs = CACHE_TTL_MS): boolean {
  if (!record || !Number.isFinite(record.cachedAt)) return false;
  if ((record.schemaVersion ?? CACHE_SCHEMA_VERSION) !== CACHE_SCHEMA_VERSION) return false;
  const age = Date.now() - record.cachedAt;
  return age >= 0 && age < ttlMs;
}
export async function readCache(url: string): Promise<CacheRecord | null> {
  if (!getIndexedDB()) return memoryFallback.get(url) || null;
  try {
    return (
      (await transaction<StoredEntry | undefined>('readonly', (store) => store.get(url))) ||
      memoryFallback.get(url) ||
      null
    );
  } catch {
    return memoryFallback.get(url) || null;
  }
}
export async function writeCache(url: string, record: CacheRecord): Promise<void> {
  memoryFallback.set(url, record);
  if (!getIndexedDB()) return;
  try {
    await transaction('readwrite', (store) =>
      store.put({ ...record, url, schemaVersion: record.schemaVersion ?? CACHE_SCHEMA_VERSION }),
    );
    writeFailures.delete(url);
  } catch (error) {
    // 下载仍可在本次会话使用，但管理面板必须明确显示未落盘。
    writeFailures.set(url, error instanceof Error ? error.message : String(error));
    console.warn('[catalogCache] 缓存未持久保存，仅本次会话可用', error);
  }
}

export interface CacheFile {
  url: string;
  revision: string;
  cachedAt: number;
  bytes: number;
  expired: boolean;
}
export interface CacheInventory {
  storage: 'indexeddb' | 'memory';
  files: CacheFile[];
  writeFailures: { url: string; message: string }[];
}
function describe(url: string, record: CacheRecord): CacheFile {
  return {
    url,
    revision: record.revision,
    cachedAt: record.cachedAt,
    bytes: new TextEncoder().encode(JSON.stringify(record.body) ?? '').byteLength,
    expired: !isCacheValid(record),
  };
}
export async function getCacheInventory(): Promise<CacheInventory> {
  const files: CacheFile[] = [];
  const persistent = Boolean(getIndexedDB());
  if (persistent) {
    const db = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => reject(tx.error || new Error('无法读取缓存清单'));
        const request = tx.objectStore(STORE_NAME).openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;
          const entry = cursor.value as StoredEntry;
          files.push(describe(entry.url, entry));
          cursor.continue();
        };
      });
    } finally {
      db.close();
    }
  } else {
    memoryFallback.forEach((record, url) => files.push(describe(url, record)));
  }
  return {
    storage: persistent ? 'indexeddb' : 'memory',
    files: files.sort((a, b) => a.url.localeCompare(b.url)),
    writeFailures: [...writeFailures].map(([url, message]) => ({ url, message })),
  };
}

/** 只操作本项目 entries，不碰 localStorage 或其他数据库。失败必须传给调用者。 */
export async function removeCacheFile(url: string): Promise<void> {
  if (getIndexedDB()) await transaction('readwrite', (store) => store.delete(url));
  memoryFallback.delete(url);
  writeFailures.delete(url);
}
export async function clearCache(): Promise<void> {
  if (getIndexedDB()) await transaction('readwrite', (store) => store.clear());
  memoryFallback.clear();
  writeFailures.clear();
}
export async function clearExpiredCache(): Promise<number> {
  let count = 0;
  if (getIndexedDB()) {
    const db = await openDatabase();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.oncomplete = () => resolve();
        tx.onerror = tx.onabort = () => reject(tx.error || new Error('清理过期缓存失败'));
        const request = tx.objectStore(STORE_NAME).openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return;
          if (!isCacheValid(cursor.value)) {
            cursor.delete();
            count++;
          }
          cursor.continue();
        };
      });
    } finally {
      db.close();
    }
  }
  for (const [url, record] of memoryFallback)
    if (!isCacheValid(record)) {
      memoryFallback.delete(url);
      writeFailures.delete(url);
      if (!getIndexedDB()) count++;
    }
  return count;
}
