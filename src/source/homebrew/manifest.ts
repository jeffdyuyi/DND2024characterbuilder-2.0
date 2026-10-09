import { readCache, writeCache, isCacheValid } from '@/platform/catalogCache';

export const HOMEBREW_MANIFEST_URL =
  process.env.NEXT_PUBLIC_HOMEBREW_MANIFEST_URL ||
  'https://api.github.com/repos/tjliqy/homebrew/git/trees/master?recursive=1';

export const HOMEBREW_CATEGORIES = [
  'background', 'baseitem', 'boon', 'charoption', 'class', 'collection',
  'condition', 'feat', 'item', 'magicvariant', 'optionalfeature', 'race',
  'reward', 'spell', 'subclass', 'subrace',
] as const;

export interface HomebrewManifestEntry {
  path: string;
  category: string;
}

interface GitTreeResponse {
  tree?: Array<{ path?: string; type?: string }>;
  truncated?: boolean;
  entries?: HomebrewManifestEntry[];
}

const HOMEBREW_API_ROOT = 'https://api.github.com/repos/tjliqy/homebrew';

async function discoverFromCategoryTrees(fetcher: typeof fetch, signal?: AbortSignal): Promise<HomebrewManifestEntry[]> {
  const rootResponse = await fetcher(`${HOMEBREW_API_ROOT}/contents?ref=master`, {
    signal,
    headers: { Accept: 'application/vnd.github+json' },
  });
  if (!rootResponse.ok) throw new Error(`Homebrew 根目录请求失败: HTTP ${rootResponse.status}`);
  const root = await rootResponse.json() as Array<{ name?: string; type?: string; sha?: string }>;
  const allowed = new Set<string>(HOMEBREW_CATEGORIES);
  const directories = root.filter((entry) => entry.type === 'dir' && entry.name && entry.sha && allowed.has(entry.name));
  const entries: HomebrewManifestEntry[] = [];

  for (const directory of directories) {
    const response = await fetcher(`${HOMEBREW_API_ROOT}/git/trees/${directory.sha}?recursive=1`, {
      signal,
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) throw new Error(`Homebrew 分类 ${directory.name} 请求失败: HTTP ${response.status}`);
    const body = await response.json() as GitTreeResponse;
    if (body.truncated) throw new Error(`Homebrew 分类 ${directory.name} 的仓库树被 GitHub 截断`);
    for (const node of body.tree || []) {
      if (node.type !== 'blob' || !node.path?.toLowerCase().endsWith('.json')) continue;
      entries.push({ path: `${directory.name}/${node.path}`, category: directory.name! });
    }
  }
  return entries;
}

export interface HomebrewManifest {
  entries: HomebrewManifestEntry[];
  revision: string;
  cached: boolean;
  stale?: boolean;
}

function safeFetch(fetcher?: typeof fetch): typeof fetch {
  if (fetcher && fetcher !== fetch) {
    return (url, init) => fetcher(url, init);
  }
  return (url, init) => {
    if (typeof window !== 'undefined') {
      return window.fetch(url, init);
    }
    return globalThis.fetch(url, init);
  };
}

/** 从仓库树动态发现资源，避免维护易失效的硬编码文件清单。 */
export async function discoverHomebrewManifest(options?: {
  signal?: AbortSignal;
  refresh?: boolean;
  fetcher?: typeof fetch;
}): Promise<HomebrewManifest> {
  const cached = await readCache(HOMEBREW_MANIFEST_URL);
  if (cached && isCacheValid(cached) && !options?.refresh) {
    return { entries: cached.body as HomebrewManifestEntry[], revision: cached.revision, cached: true };
  }

  const doFetch = safeFetch(options?.fetcher);
  let response: Response;
  let body: GitTreeResponse;
  try {
    response = await doFetch(HOMEBREW_MANIFEST_URL, {
      signal: options?.signal,
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!response.ok) {
      if (response.status >= 500 && HOMEBREW_MANIFEST_URL.includes('api.github.com/repos/tjliqy/homebrew/git/trees/')) {
        const entries = await discoverFromCategoryTrees(doFetch, options?.signal);
        body = { entries };
      } else {
        throw new Error(`Homebrew 清单请求失败: HTTP ${response.status}`);
      }
    } else {
      const parsed = await response.json();
      body = Array.isArray(parsed) ? { entries: parsed } : parsed as GitTreeResponse;
    }
  } catch (error) {
    if (cached) {
      return { entries: cached.body as HomebrewManifestEntry[], revision: cached.revision, cached: true, stale: true };
    }
    throw error;
  }
  if (body.truncated) throw new Error('Homebrew 仓库树被 GitHub 截断，拒绝把不完整清单标记为成功');

  const allowed = new Set<string>(HOMEBREW_CATEGORIES);
  const entries = body.entries ? body.entries.filter((entry) => allowed.has(entry.category)) : (body.tree || [])
    .filter((node) => node.type === 'blob' && node.path?.toLowerCase().endsWith('.json'))
    .map((node) => {
      const path = node.path!;
      return { path, category: path.split('/')[0] };
    })
    .filter((entry) => allowed.has(entry.category));
  if (!entries.length) throw new Error('Homebrew 清单中没有发现可加载资源');

  const revision = response.headers.get('ETag') || `fetched-${Date.now()}`;
  await writeCache(HOMEBREW_MANIFEST_URL, { body: entries, revision, cachedAt: Date.now() });
  return { entries, revision, cached: false };
}
