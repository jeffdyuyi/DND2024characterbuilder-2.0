import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCache, writeCache } from '@/platform/catalogCache';
import { discoverHomebrewManifest, HOMEBREW_MANIFEST_URL } from '@/source/homebrew/manifest';

describe('Homebrew 动态清单', () => {
  beforeEach(async () => clearCache());

  it('只收录支持目录中的 JSON 文件', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      truncated: false,
      tree: [
        { path: 'class/example.json', type: 'blob' },
        { path: 'subclass/example.json', type: 'blob' },
        { path: 'README.md', type: 'blob' },
        { path: 'unknown/example.json', type: 'blob' },
      ],
    }), { status: 200, headers: { ETag: 'tree-v1' } }));
    const result = await discoverHomebrewManifest({ fetcher });
    expect(result.entries).toEqual([
      { path: 'class/example.json', category: 'class' },
      { path: 'subclass/example.json', category: 'subclass' },
    ]);
  });

  it('拒绝把 GitHub 截断的仓库树当作完整清单', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ truncated: true, tree: [] }), { status: 200 }));
    await expect(discoverHomebrewManifest({ fetcher })).rejects.toThrow('截断');
  });

  it('断网时使用已有的过期清单并明确标记 stale', async () => {
    await writeCache(HOMEBREW_MANIFEST_URL, {
      body: [{ path: 'feat/offline.json', category: 'feat' }], revision: 'old-tree', cachedAt: 0,
    });
    const result = await discoverHomebrewManifest({ fetcher: vi.fn().mockRejectedValue(new Error('offline')) as any });
    expect(result).toMatchObject({ revision: 'old-tree', cached: true, stale: true });
    expect(result.entries).toHaveLength(1);
  });

  it('首次访问无缓存且被限流时明确失败', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('{}', { status: 429 }));
    await expect(discoverHomebrewManifest({ fetcher })).rejects.toThrow('HTTP 429');
  });

  it('全仓递归树返回 5xx 时按支持的分类子树完成发现', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify([
        { name: 'class', type: 'dir', sha: 'class-sha' },
        { name: 'unknown', type: 'dir', sha: 'unknown-sha' },
      ]), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ truncated: false, tree: [
        { path: 'extension.json', type: 'blob' },
      ] }), { status: 200 }));
    const result = await discoverHomebrewManifest({ fetcher: fetcher as any });
    expect(result.entries).toEqual([{ path: 'class/extension.json', category: 'class' }]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });

  it('接受自托管清单的 entries 格式并过滤未知类别', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ entries: [
      { path: 'race/a.json', category: 'race' }, { path: 'unknown/b.json', category: 'unknown' },
    ] }), { status: 200 }));
    const result = await discoverHomebrewManifest({ fetcher });
    expect(result.entries).toEqual([{ path: 'race/a.json', category: 'race' }]);
  });
});
