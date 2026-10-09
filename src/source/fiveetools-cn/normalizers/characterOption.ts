import { CatalogEntry, EntryKind } from '@/catalog/types';
import { makeEntryId, inferEditionFromSource } from '@/catalog/identity';
import { flattenEntries } from '../utils';

export type CharacterOptionKind = Extract<EntryKind, 'optionalfeature' | 'charoption' | 'reward' | 'boon' | 'cult'>;

/** 保留公共数据原始分类和前提；未知机制只展示原文，不生成猜测规则。 */
export function normalizeCharacterOption(
  raw: Record<string, any>,
  kind: CharacterOptionKind,
  packId = '5etools-cn'
): CatalogEntry {
  const name = raw.name || raw.ENG_name || '未命名角色选项';
  const englishName = raw.ENG_name || (raw.name !== name ? raw.name : undefined);
  const source = raw.source || 'UNKNOWN';
  return {
    id: makeEntryId({ packId, kind, source, name: englishName || name }),
    kind,
    name,
    englishName,
    source,
    edition: inferEditionFromSource(source),
    page: raw.page,
    sourcePackId: packId,
    description: flattenEntries(raw.entries),
    entries: raw.entries,
    raw,
  };
}
