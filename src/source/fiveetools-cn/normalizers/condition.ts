/**
 * 5etools Condition Normalizer
 * 规范化 conditionsdiseases.json 状态条目为 CatalogEntry
 */

import { CatalogEntry } from '@/catalog/types';
import { makeEntryId, inferEditionFromSource } from '@/catalog/identity';
import { flattenEntries } from '../utils';

export function normalizeCondition(raw: Record<string, any>, packId = '5etools-cn'): CatalogEntry {
  const name = raw.name || raw.ENG_name || '未命名状态';
  const englishName = raw.ENG_name || (raw.name !== name ? raw.name : undefined);
  const source = raw.source || 'PHB';
  const edition = inferEditionFromSource(source);

  const id = makeEntryId({
    packId,
    kind: 'condition',
    source,
    name: englishName || name,
  });

  const description = raw.entries ? flattenEntries(raw.entries) : '';

  return {
    id,
    kind: 'condition',
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
