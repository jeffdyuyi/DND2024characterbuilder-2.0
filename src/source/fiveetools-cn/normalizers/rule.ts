/**
 * 5etools Rule / Equipment Property & Mastery Normalizer
 * 规范化 items-base.json 中的 itemProperty 与 itemMastery 为 CatalogEntry
 */

import { CatalogEntry } from '@/catalog/types';
import { makeEntryId, inferEditionFromSource } from '@/catalog/identity';
import { flattenEntries } from '../utils';

export function normalizeItemProperty(
  raw: Record<string, any>,
  packId = '5etools-cn',
): CatalogEntry {
  const abbreviation = raw.abbreviation || '';
  const firstEntry =
    Array.isArray(raw.entries) && typeof raw.entries[0] === 'object' ? raw.entries[0] : {};
  const name = firstEntry.name || raw.name || abbreviation;
  const englishName = firstEntry.ENG_name || raw.ENG_name || abbreviation;
  const source = raw.source || 'XPHB';
  const edition = inferEditionFromSource(source);

  const id = makeEntryId({
    packId,
    kind: 'rule',
    source,
    name: `property:${abbreviation}`,
  });

  const description = raw.entries ? flattenEntries(raw.entries) : '';

  return {
    id,
    kind: 'rule',
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

export function normalizeItemMastery(
  raw: Record<string, any>,
  packId = '5etools-cn',
): CatalogEntry {
  const name = raw.name || raw.ENG_name || '未命名精通';
  const englishName = raw.ENG_name || raw.name;
  const source = raw.source || 'XPHB';
  const edition = inferEditionFromSource(source);

  const id = makeEntryId({
    packId,
    kind: 'rule',
    source,
    name: `mastery:${englishName}`,
  });

  const description = raw.entries ? flattenEntries(raw.entries) : '';

  return {
    id,
    kind: 'rule',
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
