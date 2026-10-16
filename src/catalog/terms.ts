import type { CatalogEntry } from './types';

interface TermRow {
  en: string;
  cn: string;
  category: string;
  source: string;
  to_be_discussed: number;
}

const normalize = (value: string) => value.trim().toLowerCase();
const key = (category: string, source: string, name: string) =>
  JSON.stringify([category, normalize(source), normalize(name)]);

/** 术语只补充搜索词；不注册稳定 ID 别名，也不参与授予或存档迁移。 */
export class CatalogTermsIndex {
  private aliases = new Map<string, Set<string>>();

  replace(rows: unknown[]): void {
    const next = new Map<string, Set<string>>();
    for (const value of rows) {
      const row = value as Partial<TermRow> | null;
      if (
        !row ||
        row.to_be_discussed !== 0 ||
        !['spell', 'feat', 'item', 'race', 'background', 'class'].includes(row.category || '') ||
        typeof row.source !== 'string' ||
        !row.source.trim() ||
        ['words', 'words-sync'].includes(normalize(row.source)) ||
        typeof row.en !== 'string' ||
        !row.en.trim() ||
        typeof row.cn !== 'string' ||
        !row.cn.trim()
      )
        continue;
      for (const name of [row.en, row.cn]) {
        const id = key(row.category!, row.source, name);
        const aliases = next.get(id) || new Set<string>();
        aliases.add(normalize(row.en));
        aliases.add(normalize(row.cn));
        next.set(id, aliases);
      }
    }
    this.aliases = next;
  }

  matches(entry: CatalogEntry, query: string): boolean {
    if (entry.sourcePackId !== '5etools-cn' || entry.isHomebrew) return false;
    const q = normalize(query);
    if (!q) return false;
    return [entry.name, entry.englishName].some((name) => {
      if (!name) return false;
      const aliases = this.aliases.get(key(entry.kind, entry.source, name));
      return aliases ? [...aliases].some((alias) => alias.includes(q)) : false;
    });
  }
}

export const catalogTerms = new CatalogTermsIndex();
