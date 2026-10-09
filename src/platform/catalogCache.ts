/**
 * IndexedDB 缓存管理器
 * 对应《5etools全量数据接入与引擎保留实施路线图》Phase A-1
 *
 * 数据库名：dnd-catalog-v1
 * 键：完整请求 URL
 * 缓存有效期：7 天 (CACHE_TTL_MS)
 * 环境兜底：在 SSR 或 Node.js (Vitest) 无 window.indexedDB 环境下自动降级为内存 Map
 */

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
export const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 天
export const CACHE_SCHEMA_VERSION = 1;

/** Node/SSR 内存兜底存储 */
const memoryFallback = new Map<string, CacheRecord>();

function getIndexedDB(): IDBFactory | null {
  if (typeof window !== 'undefined' && window.indexedDB) {
    return window.indexedDB;
  }
  if (typeof globalThis !== 'undefined' && (globalThis as any).indexedDB) {
    return (globalThis as any).indexedDB;
  }
  return null;
}

function openDatabase(): Promise<IDBDatabase> {
  const idb = getIndexedDB();
  if (!idb) {
    return Promise.reject(new Error('IndexedDB is not available in current environment.'));
  }

  return new Promise((resolve, reject) => {
    const request = idb.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'url' });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Failed to open IndexedDB'));
  });
}

/**
 * 校验缓存记录是否在有效期内
 */
export function isCacheValid(record: CacheRecord, ttlMs: number = CACHE_TTL_MS): boolean {
  if (!record || typeof record.cachedAt !== 'number') return false;
  if ((record.schemaVersion ?? CACHE_SCHEMA_VERSION) !== CACHE_SCHEMA_VERSION) return false;
  return Date.now() - record.cachedAt < ttlMs;
}

/**
 * 读取缓存
 */
export async function readCache(url: string): Promise<CacheRecord | null> {
  const idb = getIndexedDB();
  if (!idb) {
    return memoryFallback.get(url) || null;
  }

  try {
    const db = await openDatabase();
    return await new Promise<CacheRecord | null>((resolve) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(url);

      req.onsuccess = () => {
        const result = req.result as StoredEntry | undefined;
        if (!result) {
          resolve(null);
          return;
        }
        resolve({
          body: result.body,
          revision: result.revision,
          cachedAt: result.cachedAt,
          schemaVersion: result.schemaVersion,
        });
      };

      req.onerror = () => {
        resolve(null);
      };
    });
  } catch (err) {
    console.warn(`[catalogCache] 读取 IndexedDB 失败，降级读取内存: ${url}`, err);
    return memoryFallback.get(url) || null;
  }
}

/**
 * 写入缓存
 */
export async function writeCache(url: string, record: CacheRecord): Promise<void> {
  // 无论 IndexedDB 是否成功，内存兜底保持一份
  memoryFallback.set(url, record);

  const idb = getIndexedDB();
  if (!idb) return;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const entry: StoredEntry = {
        url,
        body: record.body,
        revision: record.revision,
        cachedAt: record.cachedAt,
        schemaVersion: record.schemaVersion ?? CACHE_SCHEMA_VERSION,
      };
      const req = store.put(entry);

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('Failed to put record'));
    });
  } catch (err) {
    console.warn(`[catalogCache] 写入 IndexedDB 失败: ${url}`, err);
  }
}

/**
 * 清除所有缓存
 */
export async function clearCache(): Promise<void> {
  memoryFallback.clear();

  const idb = getIndexedDB();
  if (!idb) return;

  try {
    const db = await openDatabase();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.clear();

      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error || new Error('Failed to clear objectStore'));
    });
  } catch (err) {
    console.warn(`[catalogCache] 清空 IndexedDB 失败`, err);
  }
}
