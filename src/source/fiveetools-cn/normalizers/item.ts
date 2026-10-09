/**
 * 5etools Item & Equipment Normalizer
 * 对应《DND5R_5etools_rules_engine_agent_spec.md》规范 §8、§9、§18
 */

import { CatalogEntry, EntryKind } from '@/catalog/types';
import { makeEntryId, inferEditionFromSource } from '@/catalog/identity';
import { flattenEntries } from '../utils';

export function normalizeItem(
  raw: Record<string, any>,
  packId = '5etools-cn',
  kind: Extract<EntryKind, 'item' | 'baseitem' | 'magicvariant'> = 'item'
): CatalogEntry {
  const name = raw.name || raw.ENG_name || '未命名物品';
  const englishName = raw.ENG_name || (raw.name !== name ? raw.name : undefined);
  const source = raw.source || 'PHB';
  const edition = inferEditionFromSource(source);

  const id = makeEntryId({
    packId,
    kind,
    source,
    name: englishName || name,
  });

  const description = flattenEntries(raw.entries);

  return {
    id,
    kind,
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
