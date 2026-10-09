/**
 * 5etools Background Normalizer
 * 对应《DND5R_5etools_rules_engine_agent_spec.md》规范 §8、§9、§18
 */

import { CatalogEntry } from '@/catalog/types';
import { makeEntryId, inferEditionFromSource } from '@/catalog/identity';
import { flattenEntries } from '../utils';

export function normalizeBackground(raw: Record<string, any>, packId = '5etools-cn'): CatalogEntry {
  const name = raw.name || raw.ENG_name || '未命名背景';
  const englishName = raw.ENG_name || (raw.name !== name ? raw.name : undefined);
  const source = raw.source || 'PHB';
  const edition = inferEditionFromSource(source);

  const id = makeEntryId({
    packId,
    kind: 'background',
    source,
    name: englishName || name,
  });

  const description = flattenEntries(raw.fluff?.entries || raw.entries);

  return {
    id,
    kind: 'background',
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
