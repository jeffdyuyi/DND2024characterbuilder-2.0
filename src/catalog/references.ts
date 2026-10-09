import { CatalogEntry, CatalogService, EntryKind } from './types';
import { CharacterState, ContentReferenceSnapshot } from '@/types/characterState';
import { makeEntryId } from './identity';

const normalized = (value: unknown) => String(value || '').trim().toLowerCase().replace(/[-_\s]+/g, '');
const sourceFamily = (source: string) => {
  const value = source.toUpperCase();
  if (value === 'PHB2024' || value === 'XPHB') return 'XPHB';
  if (value === 'DMG2024' || value === 'XDMG') return 'XDMG';
  if (value === 'MM2024' || value === 'XMM') return 'XMM';
  return value;
};

export interface ResolveReferenceOptions {
  source?: string;
  parentNames?: string[];
  parentSource?: string;
}

/** 只在来源和父级足以消歧时迁移旧名称；歧义引用保持原值。 */
export function resolveCatalogReference(
  catalog: CatalogService,
  reference: string | undefined,
  kinds: EntryKind[],
  options: ResolveReferenceOptions = {}
): CatalogEntry | undefined {
  if (!reference) return undefined;
  const direct = catalog.get(reference);
  if (reference.includes(':') && direct && kinds.includes(direct.kind)) {
    if (options.parentSource && sourceFamily(String(direct.raw.classSource || 'PHB')) !== sourceFamily(options.parentSource)) return undefined;
    if (options.parentNames?.length && !options.parentNames.map(normalized).includes(normalized(direct.raw.className || direct.parent))) return undefined;
    return direct;
  }

  const needle = normalized(reference);
  let candidates = kinds.flatMap((kind) => catalog.list(kind)).filter((entry) =>
    normalized(entry.id) === needle || normalized(entry.name) === needle || normalized(entry.englishName) === needle ||
    (entry.kind === 'subclass' && normalized(makeEntryId({
      packId: entry.sourcePackId, kind: entry.kind, source: entry.source,
      name: entry.englishName || entry.name, parent: String(entry.raw.className || ''),
    })) === needle)
  );
  if (options.parentNames?.length) {
    const parents = new Set(options.parentNames.map(normalized));
    candidates = candidates.filter((entry) => {
      const raw = entry.raw as any;
      return parents.has(normalized(raw.className || entry.parent));
    });
  }
  if (options.parentSource) {
    candidates = candidates.filter(entry => sourceFamily(String(entry.raw.classSource || 'PHB')) === sourceFamily(options.parentSource!));
  }
  if (options.source) {
    const sameSource = candidates.filter((entry) => sourceFamily(entry.source) === sourceFamily(options.source!));
    if (sameSource.length) candidates = sameSource;
  }
  const publicCandidates = candidates.filter((entry) => entry.sourcePackId !== 'legacy');
  if (publicCandidates.length === 1) return publicCandidates[0];
  if (candidates.length === 1) return candidates[0];
  return undefined;
}

const snapshotOf = (entry: CatalogEntry): ContentReferenceSnapshot => ({
  id: entry.id,
  kind: entry.kind,
  name: entry.name,
  englishName: entry.englishName,
  source: entry.source,
  sourcePackId: entry.sourcePackId,
  revision: entry.revision,
});

/** 返回迁移后的新对象；无法解析的引用和已有快照原样保留。 */
export function migrateCharacterCatalogReferences(character: CharacterState, catalog: CatalogService): CharacterState {
  const next = structuredClone(character);
  const snapshots = { ...(next.contentSnapshots || {}) };
  const save = (entry?: CatalogEntry) => {
    if (entry) snapshots[entry.id] = snapshotOf(entry);
    return entry?.id;
  };
  const migrateList = (values: string[], kinds: EntryKind[], source?: string) => values.map((value) =>
    save(resolveCatalogReference(catalog, value, kinds, { source })) || value
  );

  const species = resolveCatalogReference(catalog, next.speciesId, ['race'], { source: next.speciesSource });
  if (species) { next.speciesId = save(species); next.speciesSource = species.source; }
  const subrace = resolveCatalogReference(catalog, next.subspeciesId, ['subrace'], { source: next.speciesSource });
  if (subrace) next.subspeciesId = save(subrace);
  const background = resolveCatalogReference(catalog, next.backgroundId, ['background'], { source: next.backgroundSource });
  if (background) { next.backgroundId = save(background); next.backgroundSource = background.source; }
  const originFeat = resolveCatalogReference(catalog, next.originFeatId, ['feat']);
  if (originFeat) next.originFeatId = save(originFeat);

  const classIdAliases = new Map<string, string>();
  next.classes = next.classes.map((classChoice) => {
    const classEntry = resolveCatalogReference(catalog, classChoice.classId, ['class'], { source: classChoice.source });
    const migrated = { ...classChoice };
    if (classEntry) {
      migrated.classId = save(classEntry)!;
      classIdAliases.set(classChoice.classId, migrated.classId);
      migrated.source = classEntry.source;
    }
    const parentNames = classEntry
      ? [classEntry.name, classEntry.englishName, (classEntry.raw as any).name, (classEntry.raw as any).ENG_name].filter(Boolean) as string[]
      : [classChoice.classId];
    const subclass = resolveCatalogReference(catalog, classChoice.subclassId, ['subclass'], {
      parentNames, parentSource: classEntry?.source || classChoice.source,
    });
    if (subclass) migrated.subclassId = save(subclass);
    return migrated;
  });

  next.selectedFeats = next.selectedFeats.map((selection) => ({
    ...selection,
    classId: classIdAliases.get(selection.classId) || selection.classId,
    featId: save(resolveCatalogReference(catalog, selection.featId, ['feat'])) || selection.featId,
  }));
  if (next.featSelections) {
    next.featSelections = Object.fromEntries(Object.entries(next.featSelections).map(([slot, selection]) => {
      const feat = resolveCatalogReference(catalog, selection.featId, ['feat']);
      return [slot, {
        ...selection,
        featId: save(feat) || selection.featId,
        spells: selection.spells ? migrateList(selection.spells, ['spell']) : selection.spells,
      }];
    }));
  }
  next.preparedSpellIds = migrateList(next.preparedSpellIds, ['spell']);
  next.cantripIds = migrateList(next.cantripIds, ['spell']);
  next.knownSpellIds = migrateList(next.knownSpellIds, ['spell']);
  next.spellbookIds = migrateList(next.spellbookIds, ['spell']);
  if (next.spellsByLevel) {
    next.spellsByLevel = Object.fromEntries(Object.entries(next.spellsByLevel).map(([classId, levels]) => [
      classIdAliases.get(classId) || classId,
      Object.fromEntries(Object.entries(levels).map(([level, selection]) => [level, {
        ...selection,
        cantrips: migrateList(selection.cantrips, ['spell']),
        spells: migrateList(selection.spells, ['spell']),
        replaced: save(resolveCatalogReference(catalog, selection.replaced, ['spell'])) || selection.replaced,
        replacedCantrip: save(resolveCatalogReference(catalog, selection.replacedCantrip, ['spell'])) || selection.replacedCantrip,
        replacedSpell: save(resolveCatalogReference(catalog, selection.replacedSpell, ['spell'])) || selection.replacedSpell,
      }])),
    ]));
  }
  next.equipmentIds = migrateList(next.equipmentIds, ['item', 'baseitem', 'magicvariant']);
  next.selectedCharacterOptionIds = migrateList(next.selectedCharacterOptionIds || [], [
    'optionalfeature', 'charoption', 'reward', 'boon', 'cult',
  ]);
  next.inventoryEntries = next.inventoryEntries.map((inventory) => {
    const item = resolveCatalogReference(catalog, inventory.itemId, ['item', 'baseitem', 'magicvariant'], { source: inventory.source });
    return item ? { ...inventory, itemId: save(item), source: item.source, name: inventory.name || item.name } : inventory;
  });
  next.contentSnapshots = snapshots;
  next.schemaVersion = 2;
  return next;
}

export function getReferenceSnapshot(character: CharacterState, id?: string): ContentReferenceSnapshot | undefined {
  return id ? character.contentSnapshots?.[id] : undefined;
}
