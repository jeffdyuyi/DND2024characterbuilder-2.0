/**
 * 5etools Class & Subclass Normalizer
 * 对应《DND5R_5etools_rules_engine_agent_spec.md》规范 §8、§9、§18
 */

import { CatalogEntry } from '@/catalog/types';
import { makeEntryId, inferEditionFromSource } from '@/catalog/identity';
import { flattenEntries } from '../utils';
import { mergeOverlay } from '@/mechanics-overlay';
import { classContentParent } from '@/catalog/classIdentity';

export function normalizeClass(raw: Record<string, any>, packId = '5etools-cn'): CatalogEntry {
  const name = raw.name || raw.ENG_name || '未命名职业';
  const englishName = raw.ENG_name || (raw.name !== name ? raw.name : undefined);
  const source = raw.source || 'PHB';
  const edition = inferEditionFromSource(source);

  const id = makeEntryId({
    packId,
    kind: 'class',
    source,
    name: englishName || name,
  });

  const description = flattenEntries(raw.fluff?.entries || raw.entries);

  const entry: CatalogEntry = {
    id,
    kind: 'class',
    name,
    englishName,
    source,
    edition,
    page: raw.page,
    sourcePackId: packId,
    isHomebrew: packId.startsWith('homebrew'),
    description,
    entries: raw.entries,
    raw,
  };

  return mergeOverlay(entry);
}

export function normalizeSubclass(raw: Record<string, any>, packId = '5etools-cn'): CatalogEntry {
  const name = raw.name || raw.ENG_name || '未命名子职业';
  const englishName = raw.ENG_name || (raw.name !== name ? raw.name : undefined);
  const source = raw.source || 'PHB';
  const edition = inferEditionFromSource(source);

  const id = makeEntryId({
    packId,
    kind: 'subclass',
    source,
    name: englishName || name,
    parent: classContentParent(raw),
  });

  const description = flattenEntries(raw.fluff?.entries || raw.entries);

  const entry: CatalogEntry = {
    id,
    kind: 'subclass',
    name,
    englishName,
    source,
    edition,
    page: raw.page,
    sourcePackId: packId,
    isHomebrew: packId.startsWith('homebrew'),
    description,
    entries: raw.entries,
    raw,
  };

  return mergeOverlay(entry);
}
