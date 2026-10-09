import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCache, readCache, writeCache } from '@/platform/catalogCache';
import { FiveEToolsCnSource } from '@/source/fiveetools-cn/client';

const baseUrl = 'https://primary.example/repo';
const mirrorUrl = 'https://mirror.example/repo';
const config = (overrides: Record<string, unknown> = {}) => ({
  id: 'test', name: 'test', kind: '5etools-cn' as const, enabled: true,
  baseUrl, mirrorUrls: [mirrorUrl], maxRetries: 0, timeoutMs: 100, ...overrides,
});

describe('公共数据源高可用链路', () => {
  beforeEach(async () => { await clearCache(); vi.restoreAllMocks(); });

  it('热缓存不发起网络请求', async () => {
    await writeCache(`${baseUrl}/data/test.json`, { body: { value: 1 }, revision: 'r1', cachedAt: Date.now() });
    const fetcher = vi.fn();
    const source = new FiveEToolsCnSource(config(), fetcher as any);
    const result = await source.fetchJson<any>('data/test.json');
    expect(result).toMatchObject({ body: { value: 1 }, revision: 'r1', cached: true });
    expect(fetcher).not.toHaveBeenCalled();
    expect(source.getDiagnostics().freshCacheHits).toBe(1);
  });

  it('主源限流时切换到独立镜像', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 429 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ value: 2 }), { status: 200, headers: { ETag: 'mirror-r2', 'Content-Length': '11' } }));
    const source = new FiveEToolsCnSource(config(), fetcher as any);
    const result = await source.fetchJson<any>('data/test.json');
    expect(result.body.value).toBe(2);
    expect(fetcher.mock.calls[1][0]).toBe(`${mirrorUrl}/data/test.json`);
    expect(source.getDiagnostics()).toMatchObject({ mirrorHits: 1, networkRequests: 2, downloadedBytes: 11 });
  });

  it('主源返回损坏 JSON 时由镜像恢复', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('{bad json', { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const source = new FiveEToolsCnSource(config(), fetcher as any);
    await expect(source.fetchJson<any>('data/test.json')).resolves.toMatchObject({ body: { ok: true } });
    expect(source.getDiagnostics().mirrorHits).toBe(1);
  });

  it('无缓存且所有端点断网时明确失败', async () => {
    const source = new FiveEToolsCnSource(config(), vi.fn().mockRejectedValue(new Error('offline')) as any);
    await expect(source.fetchJson('data/test.json')).rejects.toThrow('primary.example');
    expect(source.getDiagnostics().failures).toBe(1);
  });

  it('过期缓存立即可用，后台刷新后通知 Catalog 重载并更新修订', async () => {
    const url = `${baseUrl}/data/test.json`;
    await writeCache(url, { body: { value: 1 }, revision: 'old', cachedAt: 0 });
    const source = new FiveEToolsCnSource(config(), vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ value: 2 }), { status: 200, headers: { ETag: 'new' } })
    ) as any);
    const refreshed = new Promise<string>((resolve) => source.subscribeRefresh((_path, result) => resolve(result.revision)));
    const stale = await source.fetchJson<any>('data/test.json');
    expect(stale).toMatchObject({ body: { value: 1 }, revision: 'old', cached: true });
    await expect(refreshed).resolves.toBe('new');
    await vi.waitFor(async () => expect((await readCache(url))?.revision).toBe('new'));
    expect(source.getDiagnostics().staleCacheHits).toBe(1);
  });

  it('请求超过上限会终止并尝试下一个端点', async () => {
    const fetcher = vi.fn((_url: string, init: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener('abort', () => reject(new Error('aborted')));
    }));
    const source = new FiveEToolsCnSource(config({ timeoutMs: 5 }), fetcher as any);
    await expect(source.fetchJson('data/test.json')).rejects.toThrow('aborted');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});
