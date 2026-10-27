/** Adapt source-backed 5etools language entries for character choices. */
import type { CatalogEntry, CatalogQueryOptions } from '../types';
import { defaultCatalog } from '../catalog';
import type { Language, LanguageCategory } from '@/types/language';

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

export function getCatalogLanguages(options?: CatalogQueryOptions): Language[] {
  return defaultCatalog.list('language', options).map(catalogEntryToLanguage);
}
