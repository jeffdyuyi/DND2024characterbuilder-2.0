/**
 * 5etools-cn 数据加载客户端
 * 对应规范 §5（RuleSource 接口）、§6（数据加载策略）、§47（CORS 处理）
 * 以及路线图 Phase A-1、A-2（IndexedDB 运行时缓存与静默更新策略）
 *
 * 默认指向 tjliqy/5etools-cn 的 GitHub Raw 地址，
 * 附带 jsDelivr CDN 高速镜像自动兜底，
 * 同时支持 process.env.NEXT_PUBLIC_5ETOOLS_BASE_URL 环境变量注入。
 */

import { RuleSource, FetchResult, DataSourceConfig } from '../types';
import { readCache, writeCache, isCacheValid } from '@/platform/catalogCache';

const CDN_FALLBACK_BASE_URL = 'https://cdn.jsdelivr.net/gh/tjliqy/5etools-cn@cn2.0';
const configuredMirrors = (value?: string) =>
  (value || '')
    .split(',')
    .map((item) => item.trim().replace(/\/$/, ''))
    .filter(Boolean);

export interface SourceDiagnostics {
  requests: number;
  freshCacheHits: number;
  staleCacheHits: number;
  networkRequests: number;
  mirrorHits: number;
  failures: number;
  downloadedBytes: number;
  revisions: Record<string, string>;
}

function normalizeFetcher(fetcher?: typeof fetch): typeof fetch {
  if (fetcher && fetcher !== fetch) {
    return (url: RequestInfo | URL, init?: RequestInit) => fetcher(url, init);
  }
  return (url: RequestInfo | URL, init?: RequestInit) => {
    if (typeof window !== 'undefined') {
      return window.fetch(url, init);
    }
    return globalThis.fetch(url, init);
  };
}

export class FiveEToolsCnSource implements RuleSource {
  public readonly id: string;
  public readonly name: string;
  public readonly kind: DataSourceConfig['kind'];

  private readonly baseUrl: string;
  private readonly mirrorUrls: string[];
  private readonly timeoutMs: number;
  private readonly maxRetries: number;
  private readonly fetcher: typeof fetch;
  private refreshListeners = new Set<(path: string, result: FetchResult<unknown>) => void>();
  private diagnostics: SourceDiagnostics = {
    requests: 0,
    freshCacheHits: 0,
    staleCacheHits: 0,
    networkRequests: 0,
    mirrorHits: 0,
    failures: 0,
    downloadedBytes: 0,
    revisions: {},
  };

  /** 简单内存 revision 缓存：path -> revision string */
  private revisionCache: Map<string, string> = new Map();

  constructor(config: DataSourceConfig, fetcher: typeof fetch = fetch) {
    this.id = config.id;
    this.name = config.name;
    this.kind = config.kind;
    this.baseUrl = config.baseUrl.replace(/\/$/, '');
    this.mirrorUrls = (config.mirrorUrls || [])
      .map((url) => url.replace(/\/$/, ''))
      .filter((url) => url !== this.baseUrl);
    this.timeoutMs = config.timeoutMs ?? 15_000;
    this.maxRetries = Math.max(0, config.maxRetries ?? 1);
    this.fetcher = normalizeFetcher(fetcher);
  }

  public getDiagnostics(): SourceDiagnostics {
    return { ...this.diagnostics, revisions: { ...this.diagnostics.revisions } };
  }

  public subscribeRefresh(
    listener: (path: string, result: FetchResult<unknown>) => void,
  ): () => void {
    this.refreshListeners.add(listener);
    return () => this.refreshListeners.delete(listener);
  }

  public async fetchJson<T>(
    path: string,
    options?: { signal?: AbortSignal; refresh?: boolean },
  ): Promise<FetchResult<T>> {
    const cleanPath = path.replace(/^\//, '');
    const primaryUrl = `${this.baseUrl}/${cleanPath}`;
    this.diagnostics.requests++;

    // 1. 尝试从 IndexedDB 读取缓存
    const cached = await readCache(primaryUrl);
    if (cached) {
      const valid = isCacheValid(cached);
      if (valid && !options?.refresh) {
        this.diagnostics.freshCacheHits++;
        this.revisionCache.set(cleanPath, cached.revision);
        return {
          body: cached.body as T,
          revision: cached.revision,
          cached: true,
          fetchedAt: cached.cachedAt,
        };
      }

      // 缓存过期但存在：先用旧缓存返回，后台发起静默更新
      if (!options?.refresh) {
        this.diagnostics.staleCacheHits++;
        this.fetchAndCache<T>(primaryUrl, cleanPath)
          .then((result) => {
            for (const listener of this.refreshListeners)
              listener(cleanPath, result as FetchResult<unknown>);
          })
          .catch((err) => {
            console.warn(`[FiveEToolsCnSource] 后台刷新 "${cleanPath}" 失败:`, err);
          });
        return {
          body: cached.body as T,
          revision: cached.revision,
          cached: true,
          fetchedAt: cached.cachedAt,
        };
      }
    }

    // 2. 无缓存或强制刷新：向网络拉取
    return this.fetchAndCache<T>(primaryUrl, cleanPath, options?.signal);
  }

  /** 从网络拉取并写入 IndexedDB，带 CDN 降级兜底 */
  private async fetchAndCache<T>(
    primaryUrl: string,
    cleanPath: string,
    signal?: AbortSignal,
  ): Promise<FetchResult<T>> {
    const bases = [this.baseUrl, ...this.mirrorUrls];
    const errors: string[] = [];
    let response: Response | undefined;
    let body: T | undefined;
    for (let baseIndex = 0; baseIndex < bases.length && body === undefined; baseIndex++) {
      const url = `${bases[baseIndex]}/${cleanPath}`;
      for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
        const abort = () => controller.abort();
        signal?.addEventListener('abort', abort, { once: true });
        try {
          this.diagnostics.networkRequests++;
          const candidate = await this.fetcher(url, { signal: controller.signal });
          if (!candidate.ok) throw new Error(`HTTP ${candidate.status}`);
          const parsed = await candidate.json();
          if (parsed === null || typeof parsed !== 'object')
            throw new Error('响应不是 JSON 对象或数组');
          response = candidate;
          body = parsed as T;
          if (baseIndex > 0) this.diagnostics.mirrorHits++;
          break;
        } catch (error) {
          errors.push(`${url}#${attempt + 1}: ${(error as Error).message}`);
          if (signal?.aborted) throw error;
        } finally {
          clearTimeout(timeout);
          signal?.removeEventListener('abort', abort);
        }
      }
    }
    if (!response || body === undefined) {
      this.diagnostics.failures++;
      throw new Error(`[FiveEToolsCnSource] 拉取 "${cleanPath}" 失败 (${errors.join('; ')})`);
    }
    const revision =
      response.headers.get('ETag') ||
      response.headers.get('Last-Modified') ||
      `fetched-${Date.now()}`;

    const fetchedAt = Date.now();
    this.revisionCache.set(cleanPath, revision);
    this.diagnostics.revisions[cleanPath] = revision;
    const contentLength = Number(response.headers.get('Content-Length'));
    if (Number.isFinite(contentLength)) this.diagnostics.downloadedBytes += contentLength;

    // 异步写入缓存（按 primaryUrl 存储作为规范 key）
    writeCache(primaryUrl, {
      body,
      revision,
      cachedAt: fetchedAt,
    }).catch((err) => {
      console.warn(`[FiveEToolsCnSource] 写入 IndexedDB 失败:`, err);
    });

    return {
      body,
      revision,
      cached: false,
      fetchedAt,
    };
  }

  /** 按规范 §6，通过 index.json 动态发现所有分文件，绝不硬编码文件名 */
  public async listIndexedFiles(
    indexPath: string,
    options?: { signal?: AbortSignal; refresh?: boolean },
  ): Promise<string[]> {
    const result = await this.fetchJson<Record<string, string>>(indexPath, options);
    return Object.values(result.body);
  }
}

// ─── 默认配置 ───────────────────────────────────────────────────────────────

/**
 * 数据源配置
 * 支持本地环境变量覆盖，默认指向 tjliqy/5etools-cn 中文镜像
 */
export const FIVEETOOLS_CN_CONFIG: DataSourceConfig = {
  id: '5etools-cn',
  name: '5etools 中文镜像 (tjliqy)',
  baseUrl:
    process.env.NEXT_PUBLIC_5ETOOLS_BASE_URL ||
    'https://raw.githubusercontent.com/tjliqy/5etools-cn/cn2.0',
  kind: '5etools-cn',
  enabled: true,
  mirrorUrls: [
    ...configuredMirrors(process.env.NEXT_PUBLIC_5ETOOLS_MIRROR_URLS),
    CDN_FALLBACK_BASE_URL,
  ],
};

export function createDefaultFiveEToolsSource(): FiveEToolsCnSource {
  return new FiveEToolsCnSource(FIVEETOOLS_CN_CONFIG);
}

/**
 * tjliqy/homebrew 第三方与原创内容数据源配置
 * 对应关键决策 Q1 与 Q2
 */
export const TJLIQY_HOMEBREW_CONFIG: DataSourceConfig = {
  id: 'homebrew-tjliqy',
  name: 'tjliqy Homebrew 扩展库',
  baseUrl:
    process.env.NEXT_PUBLIC_HOMEBREW_BASE_URL ||
    'https://raw.githubusercontent.com/tjliqy/homebrew/master',
  kind: 'homebrew',
  enabled: true,
  mirrorUrls: configuredMirrors(process.env.NEXT_PUBLIC_HOMEBREW_MIRROR_URLS),
};

export function createDefaultHomebrewSource(): FiveEToolsCnSource {
  return new FiveEToolsCnSource(TJLIQY_HOMEBREW_CONFIG);
}
