/**
 * 数据加载服务 (CatalogLoader Service)
 * 对应《5etools全量数据接入与引擎保留实施路线图》Phase A-2
 *
 * 加载策略：
 * 1. 首批（阻塞首屏）：races.json, backgrounds.json, feats.json, class/index.json + class/*.json
 * 2. 次批（非阻塞后台）：spells/index.json + spells/*.json
 * 3. 末批（非阻塞后台）：items-base.json, items.json
 *
 * 缓存策略（由 client.ts + catalogCache.ts 联合驱动）：
 * - 有缓存且未过期 → 0 网络请求，直接从 IndexedDB 返回
 * - 有缓存但需刷新 → 先用旧缓存快速渲染，后台静默更新
 * - 无缓存 → 从 5etools-cn (带 jsDelivr CDN 兜底) 拉取并写入 IndexedDB
 */

import { defaultCatalog } from '@/catalog/catalog';
import { CatalogService } from '@/catalog/types';
import { FiveEToolsCnLoader, LoadSummary } from '@/source/fiveetools-cn/loader';
import {
  createDefaultFiveEToolsSource,
  createDefaultHomebrewSource,
} from '@/source/fiveetools-cn/client';
import { discoverHomebrewManifest, HomebrewManifest } from '@/source/homebrew/manifest';

export type CatalogStatus = 'idle' | 'loading' | 'ready' | 'partial' | 'complete' | 'error';

export interface SourceDiagnostic {
  state: 'idle' | 'loading' | 'ready' | 'complete' | 'partial' | 'error' | 'disabled' | 'empty';
  expectedFiles: number;
  loadedFiles: number;
  failedFiles: number;
  entries: number;
  message?: string;
  cacheHits?: number;
  staleCacheHits?: number;
  networkRequests?: number;
  mirrorHits?: number;
  downloadedBytes?: number;
  revisions?: Record<string, string>;
}

export interface CatalogStats {
  status: CatalogStatus;
  coreLoaded: boolean;
  secondaryLoaded: boolean;
  completeLoaded: boolean;
  counts: {
    races: number;
    backgrounds: number;
    feats: number;
    classes: number;
    subclasses: number;
    spells: number;
    items: number;
    characterOptions: number;
    subraces: number;
    tools: number;
    optionalFeatures: number;
    charOptions: number;
    rewards: number;
    boons: number;
    cults: number;
  };
  durationMs: number;
  sources: Record<'fiveetoolsCn' | 'homebrew', SourceDiagnostic>;
  error?: string;
}

class CatalogLoaderService {
  private loader: FiveEToolsCnLoader;
  private homebrewLoader?: FiveEToolsCnLoader;
  private discoverHomebrew: (options?: {
    signal?: AbortSignal;
    refresh?: boolean;
  }) => Promise<HomebrewManifest>;
  private catalog: CatalogService;
  private status: CatalogStatus = 'idle';
  private listeners: Set<(stats: CatalogStats) => void> = new Set();
  private initPromise: Promise<void> | null = null;
  private startTime: number = 0;
  private error?: string;
  private refreshTimer?: ReturnType<typeof setTimeout>;

  private counts = {
    races: 0,
    backgrounds: 0,
    feats: 0,
    classes: 0,
    subclasses: 0,
    spells: 0,
    items: 0,
    characterOptions: 0,
    subraces: 0,
    tools: 0,
    optionalFeatures: 0,
    charOptions: 0,
    rewards: 0,
    boons: 0,
    cults: 0,
  };

  private coreLoaded = false;
  private secondaryLoaded = false;
  private completeLoaded = false;

  private sources: CatalogStats['sources'] = {
    fiveetoolsCn: { state: 'idle', expectedFiles: 6, loadedFiles: 0, failedFiles: 0, entries: 0 },
    homebrew: { state: 'idle', expectedFiles: 0, loadedFiles: 0, failedFiles: 0, entries: 0 },
  };
  constructor(
    catalog?: CatalogService,
    loader?: FiveEToolsCnLoader,
    homebrewLoader?: FiveEToolsCnLoader,
    manifestDiscoverer = discoverHomebrewManifest,
  ) {
    this.catalog = catalog || defaultCatalog;
    const client = createDefaultFiveEToolsSource();
    this.loader = loader || new FiveEToolsCnLoader(client, this.catalog);
    // 显式注入主加载器通常表示单元测试；生产单例则自动启用 Homebrew。
    this.homebrewLoader =
      homebrewLoader ||
      (!loader ? new FiveEToolsCnLoader(createDefaultHomebrewSource(), this.catalog) : undefined);
    this.discoverHomebrew = manifestDiscoverer;
    if (!this.homebrewLoader) {
      this.sources.homebrew.state = 'disabled';
      this.sources.homebrew.message = '扩展数据源未启用';
    }
    this.loader.subscribeSourceRefresh?.(() => this.scheduleCatalogRefresh());
    this.homebrewLoader?.subscribeSourceRefresh?.(() => this.scheduleCatalogRefresh());
  }

  private scheduleCatalogRefresh() {
    if (this.refreshTimer) clearTimeout(this.refreshTimer);
    this.refreshTimer = setTimeout(async () => {
      const active = this.initPromise;
      if (active) await active.catch(() => undefined);
      await this.init({ force: true, fromCacheRefresh: true });
    }, 250);
  }

  /** 获取当前统计状态 */
  public getStats(): CatalogStats {
    this.updateLiveCounts();
    return {
      status: this.status,
      coreLoaded: this.coreLoaded,
      secondaryLoaded: this.secondaryLoaded,
      completeLoaded: this.completeLoaded,
      counts: { ...this.counts },
      durationMs: this.startTime > 0 ? Math.round(performance.now() - this.startTime) : 0,
      sources: {
        fiveetoolsCn: { ...this.sources.fiveetoolsCn },
        homebrew: { ...this.sources.homebrew },
      },
      error: this.error,
    };
  }

  /** 订阅加载状态变更 */
  public subscribe(listener: (stats: CatalogStats) => void): () => void {
    this.listeners.add(listener);
    listener(this.getStats());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const stats = this.getStats();
    for (const listener of this.listeners) {
      try {
        listener(stats);
      } catch (err) {
        console.error('[CatalogLoaderService] Listener error:', err);
      }
    }
  }

  private updateLiveCounts() {
    this.counts.races = this.catalog.list('race').length;
    this.counts.backgrounds = this.catalog.list('background').length;
    this.counts.feats = this.catalog.list('feat').length;
    this.counts.classes = this.catalog.list('class').length;
    this.counts.subclasses = this.catalog.list('subclass').length;
    this.counts.spells = this.catalog.list('spell').length;
    this.counts.items = this.catalog.list('item').length;
    this.counts.characterOptions = [
      'optionalfeature',
      'charoption',
      'reward',
      'boon',
      'cult',
    ].reduce((total, kind) => total + this.catalog.list(kind as any).length, 0);
    this.counts.subraces = this.catalog.list('subrace').length;
    this.counts.tools = [...this.catalog.list('item'), ...this.catalog.list('baseitem')].filter(
      (entry) => ['AT', 'GS', 'INS', 'T'].includes(String((entry.raw as any).type)),
    ).length;
    this.counts.optionalFeatures = this.catalog.list('optionalfeature').length;
    this.counts.charOptions = this.catalog.list('charoption').length;
    this.counts.rewards = this.catalog.list('reward').length;
    this.counts.boons = this.catalog.list('boon').length;
    this.counts.cults = this.catalog.list('cult').length;
    for (const [key, loader] of [
      ['fiveetoolsCn', this.loader],
      ['homebrew', this.homebrewLoader],
    ] as const) {
      if (!loader) continue;
      const diagnostic = loader.getSourceDiagnostics?.();
      if (!diagnostic) continue;
      Object.assign(this.sources[key], {
        cacheHits: diagnostic.freshCacheHits,
        staleCacheHits: diagnostic.staleCacheHits,
        networkRequests: diagnostic.networkRequests,
        mirrorHits: diagnostic.mirrorHits,
        downloadedBytes: diagnostic.downloadedBytes,
        revisions: diagnostic.revisions,
      });
    }
  }

  /**
   * 首批核心数据加载（阻塞首屏渲染）
   * 包括：种族、背景、专长、职业
   */
  public async loadCoreData(options?: { signal?: AbortSignal; refresh?: boolean }): Promise<void> {
    this.sources.fiveetoolsCn.state = 'loading';
    const results = await Promise.allSettled([
      this.loader.loadRaces(options),
      this.loader.loadBackgrounds(options),
      this.loader.loadFeats(options),
      this.loader.loadClasses(options),
    ]);

    let loaded = 0;
    let entries = 0;
    let failed = 0;
    for (const res of results) {
      if (res.status === 'fulfilled' && res.value.count > 0) {
        loaded++;
        entries += res.value.count;
        failed += res.value.failedFiles || 0;
      } else failed++;
    }

    Object.assign(this.sources.fiveetoolsCn, { loadedFiles: loaded, failedFiles: failed, entries });
    if (loaded !== results.length || failed > 0) {
      this.sources.fiveetoolsCn.state = loaded > 0 ? 'partial' : 'error';
      throw new Error(`首批核心数据仅成功 ${loaded}/${results.length} 类`);
    }

    this.coreLoaded = true;
    this.sources.fiveetoolsCn.state = 'complete';
  }

  /**
   * 次批数据加载（法术库，后台非阻塞）
   */
  public async loadSecondaryData(options?: {
    signal?: AbortSignal;
    refresh?: boolean;
  }): Promise<void> {
    try {
      const result = await this.loader.loadSpells(options);
      this.secondaryLoaded = result.count > 0 && (result.failedFiles || 0) === 0;
      this.sources.fiveetoolsCn.entries += result.count;
      if (this.secondaryLoaded) this.sources.fiveetoolsCn.loadedFiles++;
      else this.sources.fiveetoolsCn.failedFiles++;
    } catch (err) {
      this.sources.fiveetoolsCn.state = 'partial';
      this.sources.fiveetoolsCn.failedFiles++;
      console.warn('[CatalogLoaderService] 次批法术加载异常 (降级使用现有数据):', err);
    }
  }

  /**
   * 末批数据加载（物品与装备，后台非阻塞）
   */
  public async loadRemainingData(options?: {
    signal?: AbortSignal;
    refresh?: boolean;
  }): Promise<void> {
    try {
      const [items, characterOptions] = await Promise.all([
        this.loader.loadItems(options),
        this.loader.loadCharacterOptions(options),
      ]);
      this.completeLoaded =
        items.count > 0 &&
        characterOptions.count > 0 &&
        (items.failedFiles || 0) === 0 &&
        (characterOptions.failedFiles || 0) === 0;
      this.sources.fiveetoolsCn.entries += items.count + characterOptions.count;
      if (this.completeLoaded) this.sources.fiveetoolsCn.loadedFiles++;
      else this.sources.fiveetoolsCn.failedFiles++;
    } catch (err) {
      this.sources.fiveetoolsCn.state = 'partial';
      this.sources.fiveetoolsCn.failedFiles++;
      console.warn('[CatalogLoaderService] 末批物品加载异常:', err);
    }
  }

  /** 发现并加载 Homebrew 中角色构建需要的全部目标类别。 */
  public async loadHomebrewData(options?: {
    signal?: AbortSignal;
    refresh?: boolean;
    fullDownload?: boolean;
    includeCollections?: boolean;
  }): Promise<void> {
    if (!this.homebrewLoader) return;
    this.sources.homebrew.state = 'loading';
    this.notify();
    try {
      const manifest = await this.discoverHomebrew(options);
      const shouldFullDownload =
        options?.fullDownload || process.env.NEXT_PUBLIC_HOMEBREW_AUTOLOAD === 'true';

      if (!shouldFullDownload) {
        Object.assign(this.sources.homebrew, {
          state: 'ready',
          loadedFiles: 0,
          expectedFiles: manifest.entries.length,
          entries: 0,
          message: `扩展清单就绪（${manifest.entries.length} 个文件，按需即时载入）`,
        });
        return;
      }

      const defaultCategories = [
        'class',
        'subclass',
        'spell',
        'item',
        'baseitem',
        'magicvariant',
        'race',
        'subrace',
        'background',
        'feat',
        'optionalfeature',
        'charoption',
        'reward',
        'boon',
      ];
      const configuredCategories = (process.env.NEXT_PUBLIC_HOMEBREW_AUTOLOAD_CATEGORIES || '')
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      const enabledCategories = new Set(
        configuredCategories.length ? configuredCategories : defaultCategories,
      );
      if (
        process.env.NEXT_PUBLIC_HOMEBREW_INCLUDE_COLLECTIONS === 'true' ||
        options?.includeCollections ||
        options?.fullDownload
      ) {
        enabledCategories.add('collection');
      }
      const paths = manifest.entries
        .filter((entry) => enabledCategories.has(entry.category))
        .map((entry) => entry.path);
      const excludedFiles = manifest.entries.length - paths.length;
      this.sources.homebrew.expectedFiles = paths.length;
      if (paths.length === 0) {
        Object.assign(this.sources.homebrew, {
          state: 'empty',
          loadedFiles: 0,
          failedFiles: 0,
          entries: 0,
          message: '清单可用，但没有启用范围内的资源',
        });
        return;
      }
      const result = await this.homebrewLoader.loadClassFiles(paths, options);
      this.counts.spells = this.catalog.list('spell').length;
      this.counts.classes = this.catalog.list('class').length;
      this.counts.subclasses = this.catalog.list('subclass').length;
      this.counts.feats = this.catalog.list('feat').length;
      Object.assign(this.sources.homebrew, {
        loadedFiles: result.loadedFiles || 0,
        failedFiles: result.failedFiles || 0,
        entries: result.count,
        state:
          result.count > 0 && (result.failedFiles || 0) === 0 && result.warnings.length === 0
            ? 'complete'
            : result.count > 0
              ? 'partial'
              : 'error',
        message: (() => {
          const parts: string[] = [];
          if (excludedFiles > 0)
            parts.push(`${excludedFiles} 个未启用范围文件未自动下载（collection 默认需显式启用）`);
          if (result.warnings.length > 0) {
            if (result.warnings.length <= 3) {
              parts.push(...result.warnings.map((w) => w.message));
            } else {
              parts.push(...result.warnings.slice(0, 3).map((w) => w.message));
              parts.push(
                `...（另有 ${result.warnings.length - 3} 条告警，可在开发者控制台查看完整日志）`,
              );
            }
          }
          return parts.join('; ') || undefined;
        })(),
      });
    } catch (err) {
      this.sources.homebrew.state = (err as Error).message.includes('没有发现可加载资源')
        ? 'empty'
        : 'error';
      this.sources.homebrew.message = (err as Error).message;
    } finally {
      this.notify();
    }
  }

  /**
   * 运行时总调度入口
   */
  public async init(options?: { force?: boolean; fromCacheRefresh?: boolean }): Promise<void> {
    if (this.initPromise) {
      return this.initPromise;
    }

    const run = (async () => {
      this.startTime = performance.now();
      this.status = 'loading';
      this.error = undefined;
      this.sources = {
        fiveetoolsCn: {
          state: 'idle',
          expectedFiles: 6,
          loadedFiles: 0,
          failedFiles: 0,
          entries: 0,
        },
        homebrew: this.homebrewLoader
          ? { state: 'idle', expectedFiles: 0, loadedFiles: 0, failedFiles: 0, entries: 0 }
          : {
              state: 'disabled',
              expectedFiles: 0,
              loadedFiles: 0,
              failedFiles: 0,
              entries: 0,
              message: '扩展数据源未启用',
            },
      };

      // 1. 加载首批核心（种族、背景、专长、职业）。离线场景由版本化缓存承担，
      // 不再静默注入本地旧语料，以免掩盖上游缺失或版本冲突。
      try {
        const requestOptions = { refresh: Boolean(options?.force && !options?.fromCacheRefresh) };
        await this.loadCoreData(requestOptions);
        this.status = 'ready'; // 首批核心就绪，立即可交互！
        this.notify();
      } catch (err) {
        console.error('[CatalogLoaderService] 核心数据加载失败:', err);
        // 如果 Legacy 种子已在，维持 ready 状态但记录警告
        if (this.catalog.list('class').length > 0) {
          this.status = 'partial';
          this.error = `网络拉取失败，已使用离线保底: ${(err as Error).message}`;
        } else {
          this.status = 'error';
          this.error = (err as Error).message;
        }
        this.notify();
      }

      // 3. 后台异步执行次批与末批（不阻塞当前 UI）
      try {
        const requestOptions = { refresh: Boolean(options?.force && !options?.fromCacheRefresh) };
        await this.loadSecondaryData(requestOptions);
        this.notify();
        await this.loadRemainingData(requestOptions);
        await this.loadHomebrewData(requestOptions);
        const allComplete =
          this.coreLoaded &&
          this.secondaryLoaded &&
          this.completeLoaded &&
          (!this.homebrewLoader ||
            this.sources.homebrew.state === 'complete' ||
            this.sources.homebrew.state === 'ready');
        if (allComplete && !this.error) {
          this.status = 'complete';
        } else if (this.status !== 'error') {
          this.status = 'partial';
        }
        this.notify();
      } catch (err) {
        console.warn('[CatalogLoaderService] 后台增量数据加载告警:', err);
      }
    })();
    this.initPromise = run;
    try {
      await run;
    } finally {
      if (this.initPromise === run) this.initPromise = null;
    }
  }
}

/** 单例数据加载服务 */
export const catalogLoader = new CatalogLoaderService();
export { CatalogLoaderService };

export async function initCatalog(options?: {
  force?: boolean;
  fromCacheRefresh?: boolean;
}): Promise<void> {
  return catalogLoader.init(options);
}

export function subscribeCatalog(listener: (stats: CatalogStats) => void): () => void {
  return catalogLoader.subscribe(listener);
}

export function getCatalogStats(): CatalogStats {
  return catalogLoader.getStats();
}

export async function loadHomebrewAll(options?: {
  signal?: AbortSignal;
  refresh?: boolean;
  includeCollections?: boolean;
}): Promise<void> {
  return catalogLoader.loadHomebrewData({
    ...options,
    fullDownload: true,
    includeCollections: options?.includeCollections ?? true,
  });
}
