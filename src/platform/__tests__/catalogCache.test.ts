import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readCache, writeCache, clearCache, isCacheValid, CACHE_TTL_MS } from '../catalogCache';
import { CatalogLoaderService } from '../catalogLoader';
import { InMemoryCatalogService } from '@/catalog/catalog';

describe('Phase A-1: catalogCache (IndexedDB & Memory Fallback)', () => {
  beforeEach(async () => {
    await clearCache();
  });

  it('能够正常写入和读取缓存数据', async () => {
    const testUrl = 'https://raw.githubusercontent.com/tjliqy/5etools-cn/cn2.0/data/races.json';
    const mockRecord = {
      body: { race: [{ name: 'Test Elf' }] },
      revision: 'etag-12345',
      cachedAt: Date.now(),
    };

    await writeCache(testUrl, mockRecord);
    const result = await readCache(testUrl);

    expect(result).not.toBeNull();
    expect(result?.revision).toBe('etag-12345');
    expect((result?.body as any).race[0].name).toBe('Test Elf');
  });

  it('能正确识别缓存有效性与过期', () => {
    const freshRecord = {
      body: {},
      revision: 'v1',
      cachedAt: Date.now(),
    };
    expect(isCacheValid(freshRecord)).toBe(true);

    const expiredRecord = {
      body: {},
      revision: 'v1',
      cachedAt: Date.now() - (CACHE_TTL_MS + 1000),
    };
    expect(isCacheValid(expiredRecord)).toBe(false);
    expect(isCacheValid({ ...freshRecord, schemaVersion: 999 })).toBe(false);
  });

  it('clearCache 能够彻底清空缓存条目', async () => {
    const testUrl = 'https://raw.githubusercontent.com/test/data.json';
    await writeCache(testUrl, { body: 'data', revision: 'r1', cachedAt: Date.now() });
    expect(await readCache(testUrl)).not.toBeNull();

    await clearCache();
    expect(await readCache(testUrl)).toBeNull();
  });
});

describe('Phase A-2: catalogLoader (数据加载服务与状态机)', () => {
  it('init 能驱动生命周期流转 (idle -> loading -> ready -> complete)', async () => {
    const testCatalog = new InMemoryCatalogService();
    const mockLoader: any = {
      loadRaces: vi.fn().mockResolvedValue({ count: 10 }),
      loadBackgrounds: vi.fn().mockResolvedValue({ count: 5 }),
      loadFeats: vi.fn().mockResolvedValue({ count: 8 }),
      loadClasses: vi.fn().mockResolvedValue({ count: 12 }),
      loadSpells: vi.fn().mockResolvedValue({ count: 50 }),
      loadItems: vi.fn().mockResolvedValue({ count: 30 }),
      loadCharacterOptions: vi.fn().mockResolvedValue({ count: 20 }),
    };

    const service = new CatalogLoaderService(testCatalog, mockLoader);
    const statuses: string[] = [];

    const unsub = service.subscribe((s) => {
      statuses.push(s.status);
    });

    await service.init();

    expect(statuses).toContain('ready');
    expect(service.getStats().status).toBe('complete');
    expect(mockLoader.loadRaces).toHaveBeenCalled();
    expect(mockLoader.loadSpells).toHaveBeenCalled();
    expect(mockLoader.loadItems).toHaveBeenCalled();

    unsub();
  });

  it('当网络与缓存都不可用时，如实标记 partial 且不注入旧语料', async () => {
    const testCatalog = new InMemoryCatalogService();
    const failingLoader: any = {
      loadRaces: vi.fn().mockRejectedValue(new Error('Network Offline')),
      loadBackgrounds: vi.fn().mockRejectedValue(new Error('Network Offline')),
      loadFeats: vi.fn().mockRejectedValue(new Error('Network Offline')),
      loadClasses: vi.fn().mockRejectedValue(new Error('Network Offline')),
      loadSpells: vi.fn().mockRejectedValue(new Error('Network Offline')),
      loadItems: vi.fn().mockRejectedValue(new Error('Network Offline')),
      loadCharacterOptions: vi.fn().mockRejectedValue(new Error('Network Offline')),
    };

    const service = new CatalogLoaderService(testCatalog, failingLoader);
    await service.init();

    const stats = service.getStats();
    expect(stats.status).toBe('error');
    expect(stats.error).toBeTruthy();
    expect(testCatalog.list('class')).toHaveLength(0);
  });

  it('任一主源阶段返回零条目时不会误报 complete', async () => {
    const testCatalog = new InMemoryCatalogService();
    const mockLoader: any = {
      loadRaces: vi.fn().mockResolvedValue({ count: 10 }),
      loadBackgrounds: vi.fn().mockResolvedValue({ count: 5 }),
      loadFeats: vi.fn().mockResolvedValue({ count: 8 }),
      loadClasses: vi.fn().mockResolvedValue({ count: 12 }),
      loadSpells: vi.fn().mockResolvedValue({ count: 0 }),
      loadItems: vi.fn().mockResolvedValue({ count: 30 }),
      loadCharacterOptions: vi.fn().mockResolvedValue({ count: 20 }),
    };
    const service = new CatalogLoaderService(testCatalog, mockLoader);
    await service.init();
    expect(service.getStats().status).toBe('partial');
    expect(service.getStats().sources.fiveetoolsCn.failedFiles).toBeGreaterThan(0);
  });
});
