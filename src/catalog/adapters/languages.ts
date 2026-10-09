import type { CatalogQueryOptions } from '../types';
/**
 * Catalog Language Adapter
 * 统一将 CatalogEntry (5etools) 与本地兜底转为 UI 和规则引擎使用的 Language 接口。
 */

import { CatalogEntry } from '../types';
import { defaultCatalog } from '../catalog';
import { Language, LanguageCategory } from '@/types/language';
import { PHB_LANGUAGES } from '@/rules/languages/phb_languages';
import { THIRD_PARTY_LANGUAGES } from '@/rules/languages/third_party_languages';

const FALLBACK_LANGUAGES: Language[] = [...PHB_LANGUAGES, ...THIRD_PARTY_LANGUAGES];

function normalizeCategory(type?: string): LanguageCategory {
  const low = String(type || '').toLowerCase();
  if (low === 'standard') return 'Standard';
  if (low === 'exotic') return 'Exotic';
  if (low === 'rare') return 'Rare';
  return 'Standard';
}

export function catalogEntryToLanguage(entry: CatalogEntry): Language {
  const raw = (entry.raw || {}) as any;
  const name = entry.name;
  const nameEn = entry.englishName || raw.ENG_name || entry.name;
  const id =
    nameEn
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') || entry.id;

  return {
    id,
    name,
    nameEn,
    type: normalizeCategory(raw.type),
    source: entry.source,
    typicalSpeakers: Array.isArray(raw.typicalSpeakers)
      ? raw.typicalSpeakers.map((s: any) =>
          typeof s === 'string' ? s.replace(/\{@[^}]+ ([^}|]+)(\|[^}]+)?\}/g, '$1') : String(s),
        )
      : undefined,
    script: raw.script,
    origin: raw.origin || entry.description,
    dialects: Array.isArray(raw.dialects) ? raw.dialects : undefined,
  };
}

/**
 * 获取全量语言清单
 * 融合 5etools Catalog 动态条目与本地权威兜底列表，确保语言库完整且中文译名不丢失。
 */
export function getCatalogLanguages(options?: CatalogQueryOptions): Language[] {
  if (options?.sourcePolicy || options?.source || options?.edition) {
    return defaultCatalog.list('language', options).map(catalogEntryToLanguage);
  }
  const map = new Map<string, Language>();

  // 1. 先载入本地完备的权威兜底字典 (覆盖所有 PHB/XPHB/方言/第三方语言，译名完备)
  for (const lang of FALLBACK_LANGUAGES) {
    const key = (lang.nameEn || lang.id).toLowerCase();
    map.set(key, lang);
    map.set(lang.id.toLowerCase(), lang);
  }

  // 2. 融合 5etools Catalog 动态条目 (增补新语言或按规则更新)
  const catalogEntries = defaultCatalog.list('language');
  if (catalogEntries && catalogEntries.length > 0) {
    for (const entry of catalogEntries) {
      const dynamicLang = catalogEntryToLanguage(entry);
      const key = (dynamicLang.nameEn || dynamicLang.id).toLowerCase();
      const existing = map.get(key) || map.get(dynamicLang.id.toLowerCase());

      if (existing) {
        // 如果 catalog 条目有有效的中文名称（不是纯英文），则更新；否则保留本地权威中文名
        const isEntryTranslated =
          entry.name &&
          entry.name !== entry.englishName &&
          entry.name !== (entry.raw as any)?.ENG_name &&
          /[\u4e00-\u9fa5]/.test(entry.name);

        const shouldOverrideSource =
          entry.source === 'XPHB' || (entry.source === 'PHB' && existing.source !== 'XPHB');

        map.set(key, {
          ...existing,
          ...dynamicLang,
          name: isEntryTranslated ? dynamicLang.name : existing.name,
          source: shouldOverrideSource ? dynamicLang.source : existing.source,
          type: dynamicLang.type || existing.type,
        });
      } else {
        map.set(key, dynamicLang);
      }
    }
  }

  return Array.from(new Set(map.values()));
}
