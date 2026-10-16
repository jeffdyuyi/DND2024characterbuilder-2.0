import { expect, it, afterEach, vi } from 'vitest';
import { CatalogTermsIndex, catalogTerms } from '../terms';
import { InMemoryCatalogService, defaultCatalog } from '../catalog';
import { normalizeSpell } from '@/source/fiveetools-cn/normalizers/spell';
import { searchAll } from '@/platform/searchIndexer';
import type { CatalogEntry } from '../types';
import { loadCatalogTerms, TERMS_CACHE_KEY } from '@/platform/catalogTermsLoader';
import { removeCacheFile, readCache } from '@/platform/catalogCache';

const entry: CatalogEntry = {
  id: '5etools:spell:test',
  kind: 'spell',
  name: '原译名',
  englishName: 'Test Spell',
  source: 'PHB',
  sourcePackId: '5etools-cn',
  edition: '2014',
  raw: { name: '原译名' },
};
const row = {
  en: 'Test Spell',
  cn: '检索译名',
  category: 'spell',
  source: 'PHB',
  to_be_discussed: 0,
};
afterEach(async () => {
  catalogTerms.replace([]);
  await removeCacheFile(TERMS_CACHE_KEY);
});

it('检索补词限定数据包、类型、出处，不更改原文与稳定引用', () => {
  const index = new CatalogTermsIndex();
  index.replace([row]);
  expect(index.matches(entry, '检索')).toBe(true);
  for (const other of [
    { ...entry, kind: 'feat' as const },
    { ...entry, source: 'XPHB' },
    { ...entry, sourcePackId: 'homebrew-x' },
    { ...entry, isHomebrew: true },
  ])
    expect(index.matches(other, '检索')).toBe(false);
  catalogTerms.replace([row]);
  const catalog = new InMemoryCatalogService();
  catalog.register(entry);
  expect(catalog.search('检索')).toEqual([entry]);
  expect(catalog.search('检索', { source: 'XPHB' })).toEqual([]);
  expect(catalog.get('检索译名')).toBeUndefined();
  expect(entry.raw.name).toBe('原译名');
});

it('未确认、无分类、同步伪来源、无英文对照的术语不参与补词', () => {
  const index = new CatalogTermsIndex();
  for (const invalid of [
    { ...row, to_be_discussed: 1 },
    { ...row, category: '' },
    { ...row, source: 'words-sync' },
    { ...row, source: '' },
    { ...row, en: '' },
  ]) {
    index.replace([invalid]);
    expect(index.matches(entry, '检索')).toBe(false);
  }
});

it('全局搜索仍遵守版本与类别筛选，术语补词不生成独立资源', () => {
  const spell = normalizeSpell({
    name: '原译名',
    ENG_name: 'Test Spell',
    source: 'PHB',
    level: 1,
    entries: [],
  });
  defaultCatalog.register(spell);
  catalogTerms.replace([row]);
  expect(searchAll('检索译名', 'all', 'spell').map((item) => item.id)).toContain(spell.id);
  expect(searchAll('检索译名', '2024', 'spell')).toEqual([]);
  expect(searchAll('检索译名', 'all', 'feat')).toEqual([]);
});

it('发现日期文件、并发只请求一次、缓存保留实际地址与修订且只占一条记录', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response('const _TERMS_DATA_URL = "docs/terms-20261015-105551.json";'),
    )
    .mockResolvedValueOnce(Response.json({ version: 'revision', items: [row] }));
  expect(await Promise.all([loadCatalogTerms(fetcher), loadCatalogTerms(fetcher)])).toEqual([
    true,
    true,
  ]);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(catalogTerms.matches(entry, '检索')).toBe(true);
  expect((await readCache(TERMS_CACHE_KEY))?.body).toMatchObject({
    url: 'https://5e.kiwee.top/docs/terms-20261015-105551.json',
    version: 'revision',
  });
  await loadCatalogTerms(fetcher);
  expect(fetcher).toHaveBeenCalledTimes(2);
});

it('入口改变或网络失败不影响已有搜索，不执行脚本或请求任意地址', async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response('const _TERMS_DATA_URL = "https://other.test/payload.json";'));
  expect(await loadCatalogTerms(fetcher)).toBe(false);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(await readCache(TERMS_CACHE_KEY)).toBeNull();
  expect(await loadCatalogTerms(vi.fn().mockRejectedValue(new Error('offline')))).toBe(false);
  const catalog = new InMemoryCatalogService();
  catalog.register(entry);
  expect(catalog.search('原译名')).toEqual([entry]);
});
