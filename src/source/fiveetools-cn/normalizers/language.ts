/**
 * 5etools Language Normalizer
 * 规范化 5etools languages.json 条目为 CatalogEntry
 */

import { CatalogEntry } from '@/catalog/types';
import { makeEntryId, inferEditionFromSource } from '@/catalog/identity';
import { flattenEntries } from '../utils';

export function normalizeLanguage(raw: Record<string, any>, packId = '5etools-cn'): CatalogEntry {
  const name = raw.name || raw.ENG_name || '未命名语言';
  const englishName = raw.ENG_name || (raw.name !== name ? raw.name : undefined);
  const source = raw.source || 'PHB';
  const edition = inferEditionFromSource(source);

  const id = makeEntryId({
    packId,
    kind: 'language',
    source,
    name: englishName || name,
  });

  const description = raw.entries ? flattenEntries(raw.entries) : (raw.origin || '');

  return {
    id,
    kind: 'language',
    name,
    englishName,
    source,
    edition,
    page: raw.page,
    sourcePackId: packId,
    description,
    entries: raw.entries,
    raw,
  };
}
