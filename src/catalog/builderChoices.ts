import * as catalog from './index';
import type { CharacterState } from '@/types/characterState';
import type { CatalogEntry, EntryKind } from './types';

const normalize = (value: string) => value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
const selectionKinds: Record<string, EntryKind[]> = {
  spell: ['spell'],
  feat: ['feat'],
  language: ['language'],
  tool: ['item', 'baseitem'],
  item: ['item', 'baseitem', 'magicvariant'],
  weapon: ['item', 'baseitem'],
  weaponMastery: ['item', 'baseitem'],
  mastery: ['item', 'baseitem'],
  armor: ['item', 'baseitem'],
  subclass: ['subclass'],
  subrace: ['subrace'],
};

/** 仅供候选显示使用。已有选择详情和规则计算继续读取完整目录。 */
export function createBuilderChoices(
  character: Pick<CharacterState, 'sourceSelection' | 'allowHomebrew'>,
) {
  const sourcePolicy = catalog.getCharacterSourcePolicy(character);
  const predicate = catalog.createSourcePredicate(sourcePolicy);
  const pool = new Map<string, CatalogEntry[]>();
  const allows = (
    value:
      string | { id?: string; catalogId?: string; name?: string; nameEn?: string; source?: string },
    kinds: EntryKind[],
  ) => {
    const ref =
      typeof value === 'string'
        ? value
        : value.catalogId || value.id || value.nameEn || value.name || '';
    const direct = catalog.defaultCatalog.get(ref);
    if (direct && kinds.includes(direct.kind)) return predicate(direct);
    const [base, taggedSource] = ref.split('|');
    const source = typeof value === 'string' ? taggedSource : value.source || taggedSource;
    const key = kinds.join(',');
    if (!pool.has(key))
      pool.set(
        key,
        kinds.flatMap((kind) => catalog.defaultCatalog.list(kind)),
      );
    const target = normalize(base);
    return (
      Boolean(target) &&
      pool
        .get(key)!
        .some(
          (entry) =>
            (!source || entry.source.toLowerCase() === source.toLowerCase()) &&
            [entry.id, entry.name, entry.englishName || '', String(entry.raw.id || '')].some(
              (name) => normalize(name) === target,
            ) &&
            predicate(entry),
        )
    );
  };
  return {
    sourcePolicy,
    allows,
    filterNested<T extends { id?: string; catalogId?: string; source?: string }>(
      options: T[] = [],
      parentId?: string,
    ): T[] {
      const parent = parentId ? catalog.defaultCatalog.get(parentId) : undefined;
      return parent
        ? catalog.filterNestedSourceChoices(options, parent, catalog.defaultCatalog, sourcePolicy)
        : options;
    },
    filterOptions<T extends string>(options: T[], category?: string): T[] {
      const kinds = selectionKinds[category || ''];
      if (!kinds) return options;
      return options.filter((value) => allows(value, kinds));
    },
    getCatalogClasses: (options?: Parameters<typeof catalog.getCatalogClasses>[0]) =>
      catalog.getCatalogClasses({ ...options, sourcePolicy }),
    getCatalogSpecies: (options?: Parameters<typeof catalog.getCatalogSpecies>[0]) =>
      catalog.getCatalogSpecies({ ...options, sourcePolicy }),
    getCatalogBackgrounds: (options?: Parameters<typeof catalog.getCatalogBackgrounds>[0]) =>
      catalog.getCatalogBackgrounds({ ...options, sourcePolicy }),
    getCatalogFeats: (options?: Parameters<typeof catalog.getCatalogFeats>[0]) =>
      catalog.getCatalogFeats({ ...options, sourcePolicy }),
    getCatalogSpells: (options?: Parameters<typeof catalog.getCatalogSpells>[0]) =>
      catalog.getCatalogSpells({ ...options, sourcePolicy }),
    getCatalogItems: (options?: Parameters<typeof catalog.getCatalogItems>[0]) =>
      catalog.getCatalogItems({ ...options, sourcePolicy }),
    getCatalogCharacterOptions: (
      options?: Parameters<typeof catalog.getCatalogCharacterOptions>[0],
    ) => catalog.getCatalogCharacterOptions({ ...options, sourcePolicy }),
    getCatalogTools: (category?: Parameters<typeof catalog.getCatalogTools>[0]) =>
      catalog.getCatalogTools(category, { sourcePolicy }),
    getCatalogLanguages: () => catalog.getCatalogLanguages({ sourcePolicy }),
  };
}

/** 仅检查选择字段中的引用，不扫描角色姓名、笔记和用户正文。 */
export function getExcludedCharacterChoices(character: CharacterState) {
  const allows = catalog.createSourcePredicate(catalog.getCharacterSourcePolicy(character));
  const found = new Map<string, CatalogEntry>();
  const visit = (value: unknown) => {
    if (typeof value === 'string') {
      const entry = catalog.defaultCatalog.get(value);
      if (entry && !allows(entry)) found.set(entry.id, entry);
    } else if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') Object.values(value).forEach(visit);
  };
  [
    character.speciesId,
    character.subspeciesId,
    character.backgroundId,
    character.originFeatId,
    character.classes,
    character.selectedFeats,
    character.featSelections,
    character.speciesSelections,
    character.backgroundSelections,
    character.classSelections,
    character.selectedCharacterOptionIds,
    character.knownSpellIds,
    character.preparedSpellIds,
    character.cantripIds,
    character.spellbookIds,
    character.spellsByLevel,
    character.equipmentIds,
    (character.inventoryEntries || []).map((item) => item.itemId),
  ].forEach(visit);
  return [...found.values()];
}
