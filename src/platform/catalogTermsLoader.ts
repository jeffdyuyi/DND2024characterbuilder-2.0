import { catalogTerms } from '@/catalog/terms';
import { isCacheValid, readCache, writeCache } from './catalogCache';

export const TERMS_SCRIPT_URL = 'https://5e.kiwee.top/js/terms.js';
// 日期变更仍覆盖同一资源记录，避免每版术语表积累一份缓存。
export const TERMS_CACHE_KEY = 'https://5e.kiwee.top/terms.html';
interface TermsSnapshot {
  url: string;
  version: string;
  items: unknown[];
}
const validSnapshot = (value: unknown): value is TermsSnapshot => {
  const data = value as Partial<TermsSnapshot> | null;
  return Boolean(
    data &&
    typeof data.version === 'string' &&
    data.version &&
    typeof data.url === 'string' &&
    /^https:\/\/5e\.kiwee\.top\/docs\/terms-\d{8}-\d{6}\.json$/.test(data.url) &&
    Array.isArray(data.items),
  );
};

let pending: Promise<boolean> | undefined;
/** 失败沿用原搜索；读取脚本仅提取受限路径，绝不执行远端脚本。 */
export function loadCatalogTerms(fetcher: typeof fetch = fetch): Promise<boolean> {
  if (pending) return pending;
  pending = (async () => {
    const cached = await readCache(TERMS_CACHE_KEY);
    if (cached && validSnapshot(cached.body)) {
      catalogTerms.replace(cached.body.items);
      if (isCacheValid(cached)) return true;
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const script = await fetcher(TERMS_SCRIPT_URL, { signal: controller.signal });
      if (!script.ok) throw new Error('术语索引入口不可用');
      const path = (await script.text()).match(
        /_TERMS_DATA_URL\s*=\s*["'](docs\/terms-\d{8}-\d{6}\.json)["']/,
      )?.[1];
      if (!path) throw new Error('术语索引路径未识别');
      const url = new URL(path, TERMS_CACHE_KEY).href;
      const response = await fetcher(url, { signal: controller.signal });
      if (!response.ok) throw new Error('术语索引不可用');
      const data = await response.json();
      const snapshot = { url, version: data?.version, items: data?.items };
      if (!validSnapshot(snapshot)) throw new Error('术语索引格式不兼容');
      catalogTerms.replace(snapshot.items);
      await writeCache(TERMS_CACHE_KEY, {
        body: snapshot,
        revision: snapshot.version,
        cachedAt: Date.now(),
      });
      return true;
    } catch {
      return Boolean(cached && validSnapshot(cached.body));
    } finally {
      clearTimeout(timeout);
    }
  })().finally(() => {
    pending = undefined;
  });
  return pending;
}
