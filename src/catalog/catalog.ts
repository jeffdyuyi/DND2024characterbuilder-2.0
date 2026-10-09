/**
 * 统一目录服务实现 (In-Memory Catalog Service)
 * 对应《DND5R_5etools_rules_engine_agent_spec.md》规范 §18
 */

import { CatalogEntry, CatalogService, EntryKind, Edition } from './types';

export class InMemoryCatalogService implements CatalogService {
  /** 稳定 ID -> 条目映射 */
  private entriesById: Map<string, CatalogEntry> = new Map();

  /** 类别 -> 条目列表映射 */
  private entriesByKind: Map<EntryKind, CatalogEntry[]> = new Map();

  /** 别名与历史 ID 映射 (例如旧版 ID -> 稳定 ID) */
  private aliasMap: Map<string, string> = new Map();

  public register(entry: CatalogEntry): void {
    this.entriesById.set(entry.id, entry);

    if (!this.entriesByKind.has(entry.kind)) {
      this.entriesByKind.set(entry.kind, []);
    }
    const list = this.entriesByKind.get(entry.kind)!;
    const existingIndex = list.findIndex((e) => e.id === entry.id);
    if (existingIndex >= 0) {
      list[existingIndex] = entry;
    } else {
      list.push(entry);
    }
  }

  public registerMany(entries: CatalogEntry[]): void {
    for (const entry of entries) {
      this.register(entry);
    }
  }

  /** 注册旧版 ID 别名映射 */
  public registerAlias(oldId: string, stableId: string): void {
    this.aliasMap.set(oldId.toLowerCase(), stableId);
  }

  public get(id: string): CatalogEntry | undefined {
    if (!id) return undefined;
    // 1. 直查稳定 ID
    const entry = this.entriesById.get(id);
    if (entry) return entry;

    // 2. 查别名 (兼容旧 ID)
    const aliasedId = this.aliasMap.get(id.toLowerCase());
    if (aliasedId) {
      return this.entriesById.get(aliasedId);
    }

    return undefined;
  }

  public list(kind: EntryKind, options?: { edition?: Edition; source?: string }): CatalogEntry[] {
    const all = this.entriesByKind.get(kind) || [];
    if (!options?.edition && !options?.source) {
      return all;
    }

    return all.filter((item) => {
      if (options.edition && options.edition !== 'both') {
        if (item.edition !== 'both' && item.edition !== options.edition) {
          return false;
        }
      }
      if (options.source && item.source.toLowerCase() !== options.source.toLowerCase()) {
        return false;
      }
      return true;
    });
  }

  public search(
    query: string,
    options?: { kind?: EntryKind; edition?: Edition; limit?: number },
  ): CatalogEntry[] {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    let pool: CatalogEntry[] = [];
    if (options?.kind) {
      pool = this.entriesByKind.get(options.kind) || [];
    } else {
      pool = Array.from(this.entriesById.values());
    }

    const limit = options?.limit ?? 50;
    const results: CatalogEntry[] = [];

    for (const item of pool) {
      if (options?.edition && options.edition !== 'both') {
        if (item.edition !== 'both' && item.edition !== options.edition) {
          continue;
        }
      }

      // 匹配中文名、英文名或来源
      const matchName = item.name.toLowerCase().includes(q);
      const matchEnName = item.englishName?.toLowerCase().includes(q);
      const matchSource = item.source.toLowerCase().includes(q);

      if (matchName || matchEnName || matchSource) {
        results.push(item);
        if (results.length >= limit) break;
      }
    }

    return results;
  }
}

/** 单例目录服务 */
export const defaultCatalog: CatalogService = new InMemoryCatalogService();
