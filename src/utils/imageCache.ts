// 本地图片缓存引擎（IndexedDB）
// 参考 4E-NEXT 架构：大体积图片数据（头像、立绘、自定义背景图）存储在 IndexedDB 中，
// 避免占用 localStorage 约 5MB 的配额限制。

const DB_NAME = 'dnd2024-image-cache';
const STORE = 'images';
const DB_VERSION = 1;

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB 在当前环境下不可用'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('打开 IndexedDB 失败'));
  });
  return dbPromise;
}

/** 写入图片缓存（Data URL 或 Base64 字符串） */
export async function cachePutImage(key: string, dataUrl: string): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(dataUrl, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('写入图片缓存失败'));
  });
}

/** 读取图片缓存；不存在或失败返回 null */
export async function cacheGetImage(key: string): Promise<string | null> {
  try {
    const db = await openDb();
    return await new Promise<string | null>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = () => resolve((req.result as string) ?? null);
      req.onerror = () => reject(req.error ?? new Error('读取图片缓存失败'));
    });
  } catch {
    return null;
  }
}

/** 删除单张图片缓存 */
export async function cacheDeleteImage(key: string): Promise<void> {
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).delete(key);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error('删除图片缓存失败'));
    });
  } catch {
    // 忽略删除未命中错误
  }
}

/** 清空整个图片缓存库 */
export async function clearImageCache(): Promise<void> {
  try {
    const db = await dbPromise;
    db?.close();
  } catch {
    // 忽略关闭错误
  }
  dbPromise = null;
  await new Promise<void>((resolve) => {
    if (typeof window === 'undefined' || typeof indexedDB === 'undefined') {
      resolve();
      return;
    }
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => resolve();
    req.onblocked = () => resolve();
  });
}
