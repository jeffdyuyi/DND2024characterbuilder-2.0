import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CACHE_TTL_MS,
  clearCache,
  clearExpiredCache,
  getCacheInventory,
  readCache,
  removeCacheFile,
  writeCache,
} from '../catalogCache';

beforeEach(async () => {
  vi.unstubAllGlobals();
  await clearCache();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

// 可控事务：模拟请求已成功但提交随后中止，不能把 request success 当作提交。
function databaseHarness() {
  const request: any = {};
  const tx: any = { error: null };
  const store = {
    clear: vi.fn(() => request),
    put: vi.fn(() => request),
    delete: vi.fn(() => request),
  };
  tx.objectStore = vi.fn(() => store);
  const db = { close: vi.fn(), transaction: vi.fn(() => tx) };
  const open: any = { result: db };
  vi.stubGlobal('indexedDB', {
    open: vi.fn(() => {
      queueMicrotask(() => open.onsuccess());
      return open;
    }),
  });
  return { request, tx, db, store };
}

describe('资源缓存管理边界', () => {
  it('统计 UTF-8 JSON 字节并标记内存降级、版本失效', async () => {
    const body = { name: '中文' };
    await writeCache('a', { body, revision: 'r1', cachedAt: Date.now() });
    await writeCache('b', { body: [], revision: 'r2', cachedAt: Date.now(), schemaVersion: 999 });
    const inventory = await getCacheInventory();
    expect(inventory.storage).toBe('memory');
    expect(inventory.files[0].bytes).toBe(new TextEncoder().encode(JSON.stringify(body)).length);
    expect(inventory.files.map((file) => file.expired)).toEqual([false, true]);
  });
  it('清理过期记录保留有效文件与角色存储', async () => {
    const clear = vi.fn();
    vi.stubGlobal('localStorage', { clear, removeItem: clear });
    await writeCache('fresh', { body: {}, revision: 'r', cachedAt: Date.now() });
    await writeCache('old', { body: {}, revision: 'r', cachedAt: Date.now() - CACHE_TTL_MS - 1 });
    expect(await clearExpiredCache()).toBe(1);
    expect(await readCache('fresh')).not.toBeNull();
    expect(await readCache('old')).toBeNull();
    await clearCache();
    expect(clear).not.toHaveBeenCalled();
  });
  it('单文件删除不影响其他资料', async () => {
    for (const url of ['a', 'b'])
      await writeCache(url, { body: {}, revision: 'r', cachedAt: Date.now() });
    await removeCacheFile('a');
    expect((await getCacheInventory()).files.map((file) => file.url)).toEqual(['b']);
  });
  it('请求成功后等待事务提交，完成后关闭连接', async () => {
    const { request, tx, db } = databaseHarness();
    let done = false;
    const task = clearCache().then(() => {
      done = true;
    });
    await vi.waitFor(() => expect(request.onsuccess).toBeTypeOf('function'));
    request.onsuccess();
    await Promise.resolve();
    expect(done).toBe(false);
    tx.oncomplete();
    await task;
    expect(done).toBe(true);
    expect(db.close).toHaveBeenCalledOnce();
  });
  it('事务中止上报清理失败并保留内存副本', async () => {
    await writeCache('a', { body: {}, revision: 'r', cachedAt: Date.now() });
    const { tx, db, request } = databaseHarness();
    const task = clearCache();
    const rejected = expect(task).rejects.toThrow('资源缓存事务已中止');
    await vi.waitFor(() => expect(request.onsuccess).toBeTypeOf('function'));
    request.onsuccess();
    tx.onabort();
    await rejected;
    expect(db.close).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
    expect(await readCache('a')).not.toBeNull();
  });
  it('写入失败可诊断，下载内容仍供会话使用', async () => {
    const { tx, request } = databaseHarness();
    const task = writeCache('failed', { body: { value: 1 }, revision: 'r', cachedAt: Date.now() });
    await vi.waitFor(() => expect(request.onsuccess).toBeTypeOf('function'));
    tx.error = new Error('QuotaExceededError');
    tx.onabort();
    await task;
    vi.unstubAllGlobals();
    expect((await getCacheInventory()).writeFailures).toEqual([
      { url: 'failed', message: 'QuotaExceededError' },
    ]);
    expect((await readCache('failed'))?.body).toEqual({ value: 1 });
  });
});
