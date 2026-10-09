/**
 * 5etools-cn 数据加载器 (Loader)
 * 对应《DND5R_5etools_rules_engine_agent_spec.md》规范 §6、§12、§13、§18
 *
 * 职责：
 * 1. 动态读取 index.json 获取分文件清单（严禁硬编码文件名）
 * 2. 依次加载并解析原始 JSON
 * 3. 运行 resolveEntries 展开 _copy 继承与 _mod 修改
 * 4. 调用对应 Normalizer 归一化为 CatalogEntry
 * 5. 注入 CatalogService，提供统一对外数据
 */

import { CatalogService, EntryKind } from '@/catalog/types';
import { makeEntryId, inferEditionFromSource } from '@/catalog/identity';
import { classContentParent } from '@/catalog/classIdentity';
import { defaultCatalog } from '@/catalog/catalog';
import { FiveEToolsCnSource, createDefaultFiveEToolsSource } from './client';
import { getEntryKeys, resolveEntries, ResolverWarning } from '../resolver/copy';
import { createClassAliases } from '../resolver/classAliases';
import { flattenEntries } from './utils';
import {
  normalizeSpell,
  normalizeClass,
  normalizeSubclass,
  normalizeFeat,
  normalizeRace,
  normalizeSubrace,
  normalizeBackground,
  normalizeItem,
  normalizeCharacterOption,
  normalizeLanguage,
  normalizeCondition,
  normalizeItemProperty,
  normalizeItemMastery,
} from './normalizers';
import { instantiateMagicVariants } from '@/catalog/adapters/items';

const FILE_FETCH_CONCURRENCY = 6;
const fluffKey = (name: unknown, source: unknown) =>
  `${String(name || '')
    .trim()
    .toLowerCase()}::${String(source || '')
    .trim()
    .toUpperCase()}`;

export function extractExclusiveFluff(rawFluff: any): string {
  if (!rawFluff || typeof rawFluff !== 'object') return '';
  // 1. 若含有 _copy，专属描述必须来自于 _copy._mod.entries（如 5etools 亚种风味专属前置段落）
  if (rawFluff._copy) {
    const modEntries = rawFluff._copy._mod?.entries;
    if (!modEntries) return '';
    const items = modEntries.items || modEntries;
    return flattenEntries(Array.isArray(items) ? items : [items]);
  }
  // 2. 若没有 _copy，本身就是独立的专属词条
  if (Array.isArray(rawFluff.entries) && rawFluff.entries.length > 0) {
    return flattenEntries(rawFluff.entries);
  }
  return '';
}

function indexFluff(entries: any[], rawEntries: any[] = []): Map<string, any> {
  const index = new Map<string, any>();
  const rawMap = new Map<string, any>();
  for (const raw of rawEntries) {
    if (!raw || typeof raw !== 'object') continue;
    for (const name of [raw.ENG_name, raw.name]) {
      if (name) rawMap.set(fluffKey(name, raw.source), raw);
    }
  }

  for (const entry of entries) {
    if (!entry || typeof entry !== 'object') continue;
    for (const name of [entry.ENG_name, entry.name]) {
      if (name) {
        const key = fluffKey(name, entry.source);
        const originalRaw = rawMap.get(key) || entry;
        const exclusiveDesc = extractExclusiveFluff(originalRaw);
        index.set(key, { ...entry, _exclusiveFluff: exclusiveDesc });
      }
    }
  }
  return index;
}

function attachFluff(
  raw: any,
  fluff: Map<string, any>,
  provenance?: { path: string; revision?: string },
): any {
  const candidates: (string | undefined)[] = [raw.ENG_name, raw.name];
  if (raw.raceName) {
    candidates.push(
      `${raw.raceName} (${raw.name})`,
      `${raw.raceName} (${raw.ENG_name})`,
      raw.raceENG_name ? `${raw.raceENG_name} (${raw.ENG_name})` : undefined,
      raw.raceENG_name ? `${raw.raceENG_name} (${raw.name})` : undefined,
    );
  }
  const validCandidates = candidates.filter((c): c is string => Boolean(c));
  const match = validCandidates.map((name) => fluff.get(fluffKey(name, raw.source))).find(Boolean);
  return match ? { ...raw, fluff: match, _fluffProvenance: provenance } : raw;
}

async function mapConcurrent<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (cursor < items.length) {
        const index = cursor++;
        results[index] = await worker(items[index]);
      }
    }),
  );
  return results;
}

export interface LoadSummary {
  kind: string;
  count: number;
  warnings: ResolverWarning[];
  durationMs: number;
  expectedFiles?: number;
  loadedFiles?: number;
  failedFiles?: number;
}

export class FiveEToolsCnLoader {
  private client: FiveEToolsCnSource;
  private catalog: CatalogService;

  constructor(client?: FiveEToolsCnSource, catalog?: CatalogService) {
    this.client = client || createDefaultFiveEToolsSource();
    this.catalog = catalog || defaultCatalog;
  }

  public getSourceDiagnostics() {
    return this.client.getDiagnostics();
  }

  public subscribeSourceRefresh(listener: (path: string) => void): () => void {
    return this.client.subscribeRefresh((path) => listener(path));
  }

  private registerEntry(
    entry: import('@/catalog/types').CatalogEntry,
    path: string,
    revision?: string,
  ) {
    this.catalog.register({
      ...entry,
      revision,
      isHomebrew: this.client.kind === 'homebrew' || entry.isHomebrew,
      raw: { ...entry.raw, _provenance: { packId: this.client.id, path, revision } },
    });
  }

  /**
   * 加载法术库
   * 遵循规范 §6：从 data/spells/index.json 发现所有分卷文件 (spells-phb.json, spells-xphb.json 等)
   */
  public async loadSpells(options?: {
    signal?: AbortSignal;
    refresh?: boolean;
  }): Promise<LoadSummary> {
    const startTime = performance.now();
    const warnings: ResolverWarning[] = [];
    let count = 0;
    let expectedFiles = 0;
    let loadedFiles = 0;
    let failedFiles = 0;
    let sourceLookup: Record<string, Record<string, any>> = {};

    try {
      const fileNames = await this.client.listIndexedFiles('data/spells/index.json', options);
      expectedFiles = fileNames.length;
      try {
        const lookup = await this.client.fetchJson<Record<string, Record<string, any>>>(
          'data/generated/gendata-spell-source-lookup.json',
          options,
        );
        sourceLookup = lookup.body;
        expectedFiles++;
        loadedFiles++;
      } catch (lookupErr) {
        expectedFiles++;
        failedFiles++;
        warnings.push({
          code: 'RESOLVE_ERROR',
          message: `加载法术职业归属索引失败: ${(lookupErr as Error).message}`,
        });
      }

      for (const fileName of fileNames) {
        try {
          const res = await this.client.fetchJson<{ spell?: any[] }>(
            `data/spells/${fileName}`,
            options,
          );
          const rawSpells = res.body.spell || [];
          if (!rawSpells.length) continue;

          // 展开 _copy 和 _mod
          const { resolved, warnings: modWarnings } = resolveEntries(rawSpells);
          warnings.push(...modWarnings);

          // 归一化并注册至 Catalog
          for (const raw of resolved) {
            const srcKey = String(raw.source || '').toLowerCase();
            const lookupEntry =
              sourceLookup[srcKey]?.[raw.name] || sourceLookup[srcKey]?.[raw.ENG_name];
            const grants: Array<{ name: string; source: string }> = [];
            for (const category of ['class', 'classVariant'] as const) {
              const classObj = (lookupEntry as any)?.[category];
              if (classObj && typeof classObj === 'object') {
                for (const [source, classes] of Object.entries(classObj)) {
                  for (const name of Object.keys((classes as any) || {})) {
                    grants.push({ name, source });
                  }
                }
              }
            }
            // 注意：subclass 归属仅属于特定子职业特性扩充，绝不能注入基础职业法术列表（如大地结社扩充戏法不能让全部德鲁伊可选）
            if (grants.length > 0) {
              raw._classGrants = grants;
            }
            const entry = normalizeSpell(raw, this.client.id);
            this.registerEntry(entry, `data/spells/${fileName}`, res.revision);
            count++;
          }
          loadedFiles++;
        } catch (fileErr) {
          failedFiles++;
          warnings.push({
            code: 'RESOLVE_ERROR',
            message: `加载法术分卷 "${fileName}" 失败: ${(fileErr as Error).message}`,
          });
        }
      }
    } catch (err) {
      warnings.push({
        code: 'RESOLVE_ERROR',
        message: `读取法术索引 data/spells/index.json 失败: ${(err as Error).message}`,
      });
    }

    return {
      kind: 'spell',
      count,
      warnings,
      durationMs: Math.round(performance.now() - startTime),
      expectedFiles,
      loadedFiles,
      failedFiles,
    };
  }

  /**
   * 加载职业与子职业库
   * 遵循规范 §6：从 data/class/index.json 发现职业分卷文件
   */
  public async loadClasses(options?: {
    signal?: AbortSignal;
    refresh?: boolean;
  }): Promise<LoadSummary> {
    const startTime = performance.now();
    const warnings: ResolverWarning[] = [];
    let count = 0;
    let expectedFiles = 0;
    let loadedFiles = 0;
    let failedFiles = 0;

    try {
      const fileNames = await this.client.listIndexedFiles('data/class/index.json', options);
      expectedFiles = fileNames.length;

      for (const fileName of fileNames) {
        try {
          const res = await this.client.fetchJson<{
            class?: any[];
            subclass?: any[];
            classFeature?: any[];
            subclassFeature?: any[];
          }>(`data/class/${fileName}`, options);

          if (res.body.class && Array.isArray(res.body.class)) {
            const { resolved, warnings: modWarnings } = resolveEntries(res.body.class);
            warnings.push(...modWarnings);

            for (const raw of resolved) {
              const entry = normalizeClass(raw, this.client.id);
              this.registerEntry(entry, `data/class/${fileName}`, res.revision);
              count++;
            }
          }

          if (res.body.subclass && Array.isArray(res.body.subclass)) {
            const { resolved, warnings: modWarnings } = resolveEntries(res.body.subclass);
            warnings.push(...modWarnings);

            for (const raw of resolved) {
              const entry = normalizeSubclass(raw, this.client.id);
              this.registerEntry(entry, `data/class/${fileName}`, res.revision);
              count++;
            }
          }

          for (const kind of ['classFeature', 'subclassFeature'] as const) {
            const features = res.body[kind];
            if (!Array.isArray(features)) continue;
            const { resolved, warnings: featureWarnings } = resolveEntries(
              features.filter((feature) => feature && typeof feature === 'object'),
            );
            warnings.push(...featureWarnings);
            for (const raw of resolved) {
              try {
                const name = raw.name || raw.ENG_name;
                if (!name) continue;
                const source = raw.source || 'CUSTOM';
                const parent = classContentParent(raw, true);
                this.registerEntry(
                  {
                    id: makeEntryId({
                      packId: this.client.id,
                      kind,
                      source,
                      name: raw.ENG_name || name,
                      parent,
                      level: raw.level,
                    }),
                    kind: kind as EntryKind,
                    name,
                    englishName: raw.ENG_name,
                    source,
                    edition: inferEditionFromSource(source),
                    sourcePackId: this.client.id,
                    parent,
                    description: flattenEntries(raw.entries),
                    entries: raw.entries,
                    raw,
                  },
                  `data/class/${fileName}`,
                  res.revision,
                );
                count++;
              } catch (featureErr) {
                warnings.push({
                  code: 'RESOLVE_ERROR',
                  entry: raw?.name,
                  message: `解析职业特性失败: ${(featureErr as Error).message}`,
                });
              }
            }
          }
          loadedFiles++;
        } catch (fileErr) {
          failedFiles++;
          warnings.push({
            code: 'RESOLVE_ERROR',
            message: `加载职业分卷 "${fileName}" 失败: ${(fileErr as Error).message}`,
          });
        }
      }
    } catch (err) {
      warnings.push({
        code: 'RESOLVE_ERROR',
        message: `读取职业索引 data/class/index.json 失败: ${(err as Error).message}`,
      });
    }

    return {
      kind: 'class',
      count,
      warnings,
      durationMs: Math.round(performance.now() - startTime),
      expectedFiles,
      loadedFiles,
      failedFiles,
    };
  }

  /** 加载外部清单发现的同构文件；支持一个文件中混合多个 5etools 顶层集合。 */
  public async loadClassFiles(
    paths: string[],
    options?: { signal?: AbortSignal; refresh?: boolean },
  ): Promise<LoadSummary> {
    const startTime = performance.now();
    const warnings: ResolverWarning[] = [];
    let count = 0;
    let loadedFiles = 0;
    let failedFiles = 0;
    const fetchedDocuments = await mapConcurrent(paths, FILE_FETCH_CONCURRENCY, async (path) => {
      try {
        const res = await this.client.fetchJson<Record<string, any[]>>(path, options);
        return { ok: true as const, path, body: res.body, revision: res.revision };
      } catch (error) {
        return { ok: false as const, path, error: error as Error };
      }
    });
    const documents: Array<{ path: string; body: Record<string, any[]>; revision?: string }> = [];
    for (const result of fetchedDocuments) {
      if (!result.ok) {
        failedFiles++;
        warnings.push({
          code: 'RESOLVE_ERROR',
          message: `加载扩展文件 "${result.path}" 失败: ${result.error.message}`,
        });
      } else {
        documents.push({ path: result.path, body: result.body, revision: result.revision });
        loadedFiles++;
      }
    }

    const classAliases = createClassAliases(
      [
        ...this.catalog.list('class').map((entry) => entry.raw),
        ...documents.flatMap((document) => document.body.class || []),
      ],
      [
        ...this.catalog.list('subclass').map((entry) => entry.raw),
        ...documents.flatMap((document) => document.body.subclass || []),
      ],
      [
        ...this.catalog.list('subclassFeature').map((entry) => entry.raw),
        ...documents.flatMap((document) => document.body.subclassFeature || []),
      ],
    );
    // 先汇总全部文件，再解析 _copy，确保跨文件继承不受文件遍历顺序影响。
    for (const kind of [
      'class',
      'subclass',
      'classFeature',
      'subclassFeature',
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
      'cult',
    ] as const) {
      const globalEntries = new Map<string, any>();
      // 注入 Catalog 中已登记的全部官方与已加载条目，打通跨库继承查找
      for (const entry of this.catalog.list(kind as any)) {
        const raw = (entry.raw as any) || entry;
        for (const key of getEntryKeys({
          ...raw,
          source: raw.source || entry.source,
          name: raw.name || entry.name,
          ENG_name: raw.ENG_name || entry.englishName,
        }))
          globalEntries.set(key, raw);
      }
      for (const document of documents) {
        const entries = Array.isArray(document.body[kind]) ? document.body[kind] : [];
        for (const raw of entries) {
          if (raw && typeof raw === 'object')
            for (const key of getEntryKeys(raw)) globalEntries.set(key, raw);
        }
      }

      for (const document of documents) {
        const supplied = Array.isArray(document.body[kind]) ? document.body[kind] : [];
        const { resolved, warnings: resolveWarnings } = resolveEntries(
          supplied.filter((entry) => entry && typeof entry === 'object'),
          globalEntries,
          ['class', 'subclass', 'classFeature', 'subclassFeature'].includes(kind)
            ? classAliases.matchesCopyScope
            : undefined,
        );
        warnings.push(
          ...resolveWarnings.map((warning) => ({ ...warning, filePath: document.path, kind })),
        );
        for (const raw of resolved) {
          try {
            const register = (entry: import('@/catalog/types').CatalogEntry) =>
              this.registerEntry(entry, document.path, document.revision);
            if (kind === 'class') register(normalizeClass(raw, this.client.id));
            else if (kind === 'subclass') register(normalizeSubclass(raw, this.client.id));
            else if (kind === 'spell') register(normalizeSpell(raw, this.client.id));
            else if (kind === 'item' || kind === 'baseitem' || kind === 'magicvariant')
              register(normalizeItem(raw, this.client.id, kind));
            else if (kind === 'race') register(normalizeRace(raw, this.client.id));
            else if (kind === 'subrace') register(normalizeSubrace(raw, this.client.id));
            else if (kind === 'background') register(normalizeBackground(raw, this.client.id));
            else if (kind === 'feat') register(normalizeFeat(raw, this.client.id));
            else if (
              kind === 'optionalfeature' ||
              kind === 'charoption' ||
              kind === 'reward' ||
              kind === 'boon' ||
              kind === 'cult'
            ) {
              register(normalizeCharacterOption(raw, kind, this.client.id));
            } else {
              const name = raw.name || raw.ENG_name;
              if (!name) continue;
              const source = raw.source || 'CUSTOM';
              const parent = classContentParent(raw, true);
              this.registerEntry(
                {
                  id: makeEntryId({
                    packId: this.client.id,
                    kind,
                    source,
                    name: raw.ENG_name || name,
                    parent,
                    level: raw.level,
                  }),
                  kind,
                  name,
                  englishName: raw.ENG_name,
                  source,
                  edition: inferEditionFromSource(source),
                  sourcePackId: this.client.id,
                  isHomebrew: this.client.kind === 'homebrew',
                  parent,
                  description: flattenEntries(raw.entries),
                  entries: raw.entries,
                  raw,
                },
                document.path,
                document.revision,
              );
            }
            count++;
          } catch (entryErr) {
            warnings.push({
              code: 'RESOLVE_ERROR',
              entry: raw?.name,
              message: `解析 ${document.path} 条目失败: ${(entryErr as Error).message}`,
            });
          }
        }
      }
    }

    count += instantiateMagicVariants(this.catalog, this.client.id).length;

    return {
      kind: 'class',
      count,
      warnings,
      durationMs: Math.round(performance.now() - startTime),
      expectedFiles: paths.length,
      loadedFiles,
      failedFiles,
    };
  }

  /**
   * 加载专长库
   */
  public async loadFeats(options?: {
    signal?: AbortSignal;
    refresh?: boolean;
  }): Promise<LoadSummary> {
    const startTime = performance.now();
    const warnings: ResolverWarning[] = [];
    let count = 0;

    try {
      const res = await this.client.fetchJson<{ feat?: any[] }>('data/feats.json', options);
      const rawFeats = res.body.feat || [];

      const { resolved, warnings: modWarnings } = resolveEntries(rawFeats);
      warnings.push(...modWarnings);

      for (const raw of resolved) {
        const entry = normalizeFeat(raw, this.client.id);
        this.registerEntry(entry, 'data/feats.json', res.revision);
        count++;
      }
    } catch (err) {
      warnings.push({
        code: 'RESOLVE_ERROR',
        message: `加载专长库 data/feats.json 失败: ${(err as Error).message}`,
      });
    }

    return {
      kind: 'feat',
      count,
      warnings,
      durationMs: Math.round(performance.now() - startTime),
    };
  }

  /**
   * 加载种族与亚种库
   */
  public async loadRaces(options?: {
    signal?: AbortSignal;
    refresh?: boolean;
  }): Promise<LoadSummary> {
    const startTime = performance.now();
    const warnings: ResolverWarning[] = [];
    let count = 0;
    let loadedFiles = 0;
    let failedFiles = 0;

    try {
      const [mainResult, fluffResult] = await Promise.allSettled([
        this.client.fetchJson<{ race?: any[]; subrace?: any[] }>('data/races.json', options),
        this.client.fetchJson<{ raceFluff?: any[] }>('data/fluff-races.json', options),
      ]);
      if (mainResult.status === 'rejected') {
        failedFiles++;
        if (fluffResult.status === 'fulfilled') loadedFiles++;
        else failedFiles++;
        throw mainResult.reason;
      }
      loadedFiles++;
      const res = mainResult.value;
      let fluff = new Map<string, any>();
      let fluffRevision: string | undefined;
      if (fluffResult.status === 'fulfilled') {
        loadedFiles++;
        const rawFluffList = fluffResult.value.body.raceFluff || [];
        const resolvedFluff = resolveEntries(rawFluffList);
        fluff = indexFluff(resolvedFluff.resolved, rawFluffList);
        fluffRevision = fluffResult.value.revision;
        warnings.push(...resolvedFluff.warnings);
      } else {
        failedFiles++;
        warnings.push({
          code: 'RESOLVE_ERROR',
          message: `加载种族风味文本 data/fluff-races.json 失败: ${fluffResult.reason instanceof Error ? fluffResult.reason.message : String(fluffResult.reason)}`,
        });
      }

      if (res.body.race && Array.isArray(res.body.race)) {
        const { resolved, warnings: modWarnings } = resolveEntries(res.body.race);
        warnings.push(...modWarnings);
        for (const raw of resolved) {
          const merged = attachFluff(raw, fluff, {
            path: 'data/fluff-races.json',
            revision: fluffRevision,
          });
          this.registerEntry(
            normalizeRace(merged, this.client.id),
            'data/races.json',
            res.revision,
          );
          count++;
        }
      }

      if (res.body.subrace && Array.isArray(res.body.subrace)) {
        const { resolved, warnings: modWarnings } = resolveEntries(res.body.subrace);
        warnings.push(...modWarnings);
        for (const raw of resolved) {
          const merged = attachFluff(raw, fluff, {
            path: 'data/fluff-races.json',
            revision: fluffRevision,
          });
          this.registerEntry(
            normalizeSubrace(merged, this.client.id),
            'data/races.json',
            res.revision,
          );
          count++;
        }
      }
    } catch (err) {
      warnings.push({
        code: 'RESOLVE_ERROR',
        message: `加载种族库 data/races.json 失败: ${(err as Error).message}`,
      });
    }

    return {
      kind: 'race',
      count,
      warnings,
      durationMs: Math.round(performance.now() - startTime),
      expectedFiles: 2,
      loadedFiles,
      failedFiles,
    };
  }

  /**
   * 加载背景库
   */
  public async loadBackgrounds(options?: {
    signal?: AbortSignal;
    refresh?: boolean;
  }): Promise<LoadSummary> {
    const startTime = performance.now();
    const warnings: ResolverWarning[] = [];
    let count = 0;
    let loadedFiles = 0;
    let failedFiles = 0;

    try {
      const [mainResult, fluffResult] = await Promise.allSettled([
        this.client.fetchJson<{ background?: any[] }>('data/backgrounds.json', options),
        this.client.fetchJson<{ backgroundFluff?: any[] }>('data/fluff-backgrounds.json', options),
      ]);
      if (mainResult.status === 'rejected') {
        failedFiles++;
        if (fluffResult.status === 'fulfilled') loadedFiles++;
        else failedFiles++;
        throw mainResult.reason;
      }
      loadedFiles++;
      const res = mainResult.value;
      let fluff = new Map<string, any>();
      let fluffRevision: string | undefined;
      if (fluffResult.status === 'fulfilled') {
        loadedFiles++;
        const resolvedFluff = resolveEntries(fluffResult.value.body.backgroundFluff || []);
        fluff = indexFluff(resolvedFluff.resolved);
        fluffRevision = fluffResult.value.revision;
        warnings.push(...resolvedFluff.warnings);
      } else {
        failedFiles++;
        warnings.push({
          code: 'RESOLVE_ERROR',
          message: `加载背景风味文本 data/fluff-backgrounds.json 失败: ${fluffResult.reason instanceof Error ? fluffResult.reason.message : String(fluffResult.reason)}`,
        });
      }
      const rawBackgrounds = res.body.background || [];

      const { resolved, warnings: modWarnings } = resolveEntries(rawBackgrounds);
      warnings.push(...modWarnings);

      for (const raw of resolved) {
        const merged = attachFluff(raw, fluff, {
          path: 'data/fluff-backgrounds.json',
          revision: fluffRevision,
        });
        this.registerEntry(
          normalizeBackground(merged, this.client.id),
          'data/backgrounds.json',
          res.revision,
        );
        count++;
      }
    } catch (err) {
      warnings.push({
        code: 'RESOLVE_ERROR',
        message: `加载背景库 data/backgrounds.json 失败: ${(err as Error).message}`,
      });
    }

    return {
      kind: 'background',
      count,
      warnings,
      durationMs: Math.round(performance.now() - startTime),
      expectedFiles: 2,
      loadedFiles,
      failedFiles,
    };
  }

  /** 加载角色可选特性、角色创建选项、祝福/恩惠等奖励、语言及异常状态。 */
  public async loadCharacterOptions(options?: {
    signal?: AbortSignal;
    refresh?: boolean;
  }): Promise<LoadSummary> {
    const startTime = performance.now();
    const warnings: ResolverWarning[] = [];
    let count = 0;
    let loadedFiles = 0;
    let failedFiles = 0;
    const files = [
      { path: 'data/optionalfeatures.json', collections: [['optionalfeature', 'optionalfeature']] },
      { path: 'data/charcreationoptions.json', collections: [['charoption', 'charoption']] },
      { path: 'data/rewards.json', collections: [['reward', 'reward']] },
      {
        path: 'data/cultsboons.json',
        collections: [
          ['cult', 'cult'],
          ['boon', 'boon'],
        ],
      },
      { path: 'data/languages.json', collections: [['language', 'language']] },
      { path: 'data/conditionsdiseases.json', collections: [['condition', 'condition']] },
    ] as const;

    for (const file of files) {
      try {
        const res = await this.client.fetchJson<Record<string, any[]>>(file.path, options);
        for (const [key, kind] of file.collections) {
          const supplied = Array.isArray(res.body[key]) ? res.body[key] : [];
          const { resolved, warnings: resolveWarnings } = resolveEntries(
            supplied.filter((entry) => entry && typeof entry === 'object'),
          );
          warnings.push(...resolveWarnings);
          for (const raw of resolved) {
            try {
              let entry: import('@/catalog/types').CatalogEntry;
              if (kind === 'language') {
                entry = normalizeLanguage(raw, this.client.id);
              } else if (kind === 'condition') {
                entry = normalizeCondition(raw, this.client.id);
              } else {
                entry = normalizeCharacterOption(raw, kind, this.client.id);
              }
              this.registerEntry(entry, file.path, res.revision);
              count++;
            } catch (entryErr) {
              warnings.push({
                code: 'RESOLVE_ERROR',
                entry: raw?.name,
                message: `解析 ${file.path} 条目失败: ${(entryErr as Error).message}`,
              });
            }
          }
        }
        loadedFiles++;
      } catch (fileErr) {
        failedFiles++;
        warnings.push({
          code: 'RESOLVE_ERROR',
          message: `加载角色选项库 ${file.path} 失败: ${(fileErr as Error).message}`,
        });
      }
    }
    return {
      kind: 'characterOptions',
      count,
      warnings,
      durationMs: Math.round(performance.now() - startTime),
      expectedFiles: files.length,
      loadedFiles,
      failedFiles,
    };
  }

  /** 单独加载全量语言库 */
  public async loadLanguages(options?: {
    signal?: AbortSignal;
    refresh?: boolean;
  }): Promise<LoadSummary> {
    const startTime = performance.now();
    const warnings: ResolverWarning[] = [];
    let count = 0;
    try {
      const res = await this.client.fetchJson<{ language?: any[] }>('data/languages.json', options);
      const rawLanguages = Array.isArray(res.body?.language) ? res.body.language : [];
      const { resolved, warnings: resolveWarnings } = resolveEntries(
        rawLanguages.filter((e) => e && typeof e === 'object'),
      );
      warnings.push(...resolveWarnings);
      for (const raw of resolved) {
        const entry = normalizeLanguage(raw, this.client.id);
        this.registerEntry(entry, 'data/languages.json', res.revision);
        count++;
      }
      return {
        kind: 'language',
        count,
        warnings,
        durationMs: Math.round(performance.now() - startTime),
        expectedFiles: 1,
        loadedFiles: 1,
        failedFiles: 0,
      };
    } catch (err) {
      warnings.push({
        code: 'RESOLVE_ERROR',
        message: `加载语言库 data/languages.json 失败: ${(err as Error).message}`,
      });
      return {
        kind: 'language',
        count,
        warnings,
        durationMs: Math.round(performance.now() - startTime),
        expectedFiles: 1,
        loadedFiles: 0,
        failedFiles: 1,
      };
    }
  }

  /** 单独加载全量异常状态与疾病库 */
  public async loadConditions(options?: {
    signal?: AbortSignal;
    refresh?: boolean;
  }): Promise<LoadSummary> {
    const startTime = performance.now();
    const warnings: ResolverWarning[] = [];
    let count = 0;
    try {
      const res = await this.client.fetchJson<{ condition?: any[] }>(
        'data/conditionsdiseases.json',
        options,
      );
      const rawConditions = Array.isArray(res.body?.condition) ? res.body.condition : [];
      const { resolved, warnings: resolveWarnings } = resolveEntries(
        rawConditions.filter((e) => e && typeof e === 'object'),
      );
      warnings.push(...resolveWarnings);
      for (const raw of resolved) {
        const entry = normalizeCondition(raw, this.client.id);
        this.registerEntry(entry, 'data/conditionsdiseases.json', res.revision);
        count++;
      }
      return {
        kind: 'condition',
        count,
        warnings,
        durationMs: Math.round(performance.now() - startTime),
        expectedFiles: 1,
        loadedFiles: 1,
        failedFiles: 0,
      };
    } catch (err) {
      warnings.push({
        code: 'RESOLVE_ERROR',
        message: `加载异常状态库 data/conditionsdiseases.json 失败: ${(err as Error).message}`,
      });
      return {
        kind: 'condition',
        count,
        warnings,
        durationMs: Math.round(performance.now() - startTime),
        expectedFiles: 1,
        loadedFiles: 0,
        failedFiles: 1,
      };
    }
  }

  /**
   * 加载基础物品/装备库
   */
  public async loadItems(options?: {
    signal?: AbortSignal;
    refresh?: boolean;
  }): Promise<LoadSummary> {
    const startTime = performance.now();
    const warnings: ResolverWarning[] = [];
    let count = 0;
    let loadedFiles = 0;
    let failedFiles = 0;

    const fileConfigs: Array<{
      path: string;
      collections: Array<{ key: string; kind: 'item' | 'baseitem' | 'magicvariant' }>;
    }> = [
      {
        path: 'data/items-base.json',
        collections: [
          { key: 'baseitem', kind: 'baseitem' },
          { key: 'item', kind: 'item' },
        ],
      },
      { path: 'data/items.json', collections: [{ key: 'item', kind: 'item' }] },
      {
        path: 'data/magicvariants.json',
        collections: [
          { key: 'variant', kind: 'magicvariant' },
          { key: 'magicvariant', kind: 'magicvariant' },
        ],
      },
    ];

    interface LoadedItemBatch {
      path: string;
      revision?: string;
      collections: Array<{ kind: 'item' | 'baseitem' | 'magicvariant'; rawItems: any[] }>;
    }

    const loadedBatches: LoadedItemBatch[] = [];

    for (const file of fileConfigs) {
      try {
        const res = await this.client.fetchJson<Record<string, any[]>>(file.path, options);
        const batchCollections: LoadedItemBatch['collections'] = [];

        for (const collection of file.collections) {
          const suppliedItems = Array.isArray(res.body[collection.key])
            ? res.body[collection.key]
            : [];
          const rawItems = suppliedItems.filter((raw) => {
            const valid = raw !== null && typeof raw === 'object' && !Array.isArray(raw);
            if (!valid) {
              warnings.push({
                code: 'RESOLVE_ERROR',
                message: `跳过 ${file.path} 中的非对象物品条目`,
              });
            }
            return valid;
          });
          batchCollections.push({ kind: collection.kind, rawItems });
        }

        if (file.path === 'data/items-base.json') {
          const rawProps = Array.isArray(res.body.itemProperty) ? res.body.itemProperty : [];
          for (const raw of rawProps) {
            try {
              this.registerEntry(
                normalizeItemProperty(raw, this.client.id),
                file.path,
                res.revision,
              );
            } catch (err) {
              // ignore
            }
          }
          const rawMasteries = Array.isArray(res.body.itemMastery) ? res.body.itemMastery : [];
          for (const raw of rawMasteries) {
            try {
              this.registerEntry(
                normalizeItemMastery(raw, this.client.id),
                file.path,
                res.revision,
              );
            } catch (err) {
              // ignore
            }
          }
        }

        loadedBatches.push({
          path: file.path,
          revision: res.revision,
          collections: batchCollections,
        });
        loadedFiles++;
      } catch (fileErr) {
        failedFiles++;
        warnings.push({
          code: 'RESOLVE_ERROR',
          message: `加载物品库 ${file.path} 失败: ${(fileErr as Error).message}`,
        });
      }
    }

    // 建立跨三文件的全集全局查找池
    const globalEntries = new Map<string, any>();
    for (const kind of ['item', 'baseitem', 'magicvariant'] as const) {
      for (const entry of this.catalog.list(kind)) {
        const raw = entry.raw as any;
        const rawSource = raw?.source || entry.source;
        if (raw?.name && rawSource) globalEntries.set(`${raw.name}::${rawSource}`, raw);
        if (raw?.ENG_name && rawSource) globalEntries.set(`${raw.ENG_name}::${rawSource}`, raw);
      }
    }
    for (const batch of loadedBatches) {
      for (const col of batch.collections) {
        for (const raw of col.rawItems) {
          const source =
            raw.source ||
            raw.inherits?.source ||
            (typeof raw.type === 'string' && raw.type.includes('|')
              ? raw.type.split('|').at(-1)
              : undefined);
          if (raw.name && source) globalEntries.set(`${raw.name}::${source}`, raw);
          if (raw.ENG_name && source) globalEntries.set(`${raw.ENG_name}::${source}`, raw);
        }
      }
    }

    // 统一展开继承与注册
    for (const batch of loadedBatches) {
      for (const col of batch.collections) {
        const { resolved, warnings: modWarnings } = resolveEntries(col.rawItems, globalEntries);
        warnings.push(...modWarnings);

        for (const raw of resolved) {
          try {
            this.registerEntry(
              normalizeItem(raw, this.client.id, col.kind),
              batch.path,
              batch.revision,
            );
            count++;
          } catch (entryErr) {
            warnings.push({
              code: 'RESOLVE_ERROR',
              entry: raw?.name,
              message: `跳过无法解析的物品“${raw?.name || '未命名'}”: ${(entryErr as Error).message}`,
            });
          }
        }
      }
    }

    count += instantiateMagicVariants(this.catalog, this.client.id).length;

    return {
      kind: 'item',
      count,
      warnings,
      durationMs: Math.round(performance.now() - startTime),
      expectedFiles: fileConfigs.length,
      loadedFiles,
      failedFiles,
    };
  }

  /**
   * 一键加载核心规则集（法术、职业、专长、种族、背景、基础物品）
   */
  public async loadAllCore(options?: {
    signal?: AbortSignal;
    refresh?: boolean;
  }): Promise<LoadSummary[]> {
    return Promise.all([
      this.loadSpells(options),
      this.loadClasses(options),
      this.loadFeats(options),
      this.loadRaces(options),
      this.loadBackgrounds(options),
      this.loadItems(options),
      this.loadCharacterOptions(options),
    ]);
  }
}
