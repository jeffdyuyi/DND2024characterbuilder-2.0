import { describe, expect, it } from 'vitest';
import { InMemoryCatalogService } from '../catalog';
import { CatalogEntry, EntryKind } from '../types';
import { migrateCharacterCatalogReferences, resolveCatalogReference } from '../references';
import { normalizeClass, normalizeSubclass } from '@/source/fiveetools-cn/normalizers/class';
import { makeEntryId } from '../identity';

const entry = (
  id: string,
  kind: EntryKind,
  name: string,
  source: string,
  extra: Partial<CatalogEntry> = {},
): CatalogEntry => ({
  id,
  kind,
  name,
  englishName: name,
  source,
  edition: source.startsWith('X') ? '2024' : '2014',
  sourcePackId: '5etools-cn',
  revision: 'r2',
  raw: {},
  ...extra,
});

const character = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'old-save',
    name: '旧角色',
    playerName: '',
    classes: [],
    baseAbilityScores: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
    backgroundAbilityBonuses: {},
    selectedFeats: [],
    selectedSkills: [],
    expertiseSkills: [],
    equipmentIds: [],
    inventoryEntries: [],
    equippedWeaponIds: [],
    attunedItemIds: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    preparedSpellIds: [],
    cantripIds: [],
    knownSpellIds: [],
    spellbookIds: [],
    spellSlotUsage: {},
    resourceUsage: {},
    selectedLanguages: [],
    ...overrides,
  }) as any;

describe('Catalog 稳定引用与存档迁移', () => {
  it('新版子职业身份迁移使用父来源，保留原存档及旧快照', () => {
    const catalog = new InMemoryCatalogService();
    const parent = normalizeClass({ name: 'Class', source: 'XPHB' });
    const old = normalizeSubclass({
      name: 'Path',
      source: 'BOOK',
      className: 'Class',
      classSource: 'PHB',
    });
    const modern = normalizeSubclass({
      name: 'Path',
      source: 'BOOK',
      className: 'Class',
      classSource: 'XPHB',
    });
    [parent, old, modern].forEach((value) => catalog.register(value));
    const legacyId = makeEntryId({
      packId: modern.sourcePackId,
      kind: 'subclass',
      name: 'Path',
      source: 'BOOK',
      parent: 'Class',
    });
    const snapshot = {
      id: legacyId,
      kind: 'subclass',
      name: 'Path',
      source: 'BOOK',
      sourcePackId: modern.sourcePackId,
    };
    const saved = character({
      classes: [{ classId: parent.id, subclassId: legacyId, source: 'XPHB', level: 5 }],
      contentSnapshots: { [legacyId]: snapshot },
    });
    const migrated = migrateCharacterCatalogReferences(saved, catalog);
    expect(migrated.classes[0].subclassId).toBe(modern.id);
    expect(migrated.contentSnapshots?.[legacyId]).toEqual(snapshot);
    expect(migrated.contentSnapshots?.[modern.id]?.source).toBe('BOOK');
    expect(saved.classes[0].subclassId).toBe(legacyId);
    expect(migrateCharacterCatalogReferences(migrated, catalog).classes[0].subclassId).toBe(
      modern.id,
    );
  });
  it('按来源消歧旧职业名称并迁移职业、子职业和分类变化的物品', () => {
    const catalog = new InMemoryCatalogService();
    catalog.register(entry('5etools-cn:class:xphb:wizard', 'class', 'Wizard', 'XPHB'));
    catalog.register(
      entry('homebrew:class:custom:wizard', 'class', 'Wizard', 'CUSTOM', {
        sourcePackId: 'homebrew-tjliqy',
      }),
    );
    catalog.register(
      entry('5etools-cn:subclass:xphb:evoker:wizard', 'subclass', 'Evoker', 'XPHB', {
        parent: 'Wizard',
        raw: { className: 'Wizard', classSource: 'XPHB' },
      }),
    );
    catalog.register(entry('5etools-cn:baseitem:phb:longsword', 'baseitem', 'Longsword', 'PHB'));

    const migrated = migrateCharacterCatalogReferences(
      character({
        classes: [
          {
            classId: 'Wizard',
            subclassId: 'Evoker',
            source: 'PHB2024',
            level: 5,
            isMulticlass: false,
          },
        ],
        equipmentIds: ['Longsword'],
      }),
      catalog,
    );

    expect(migrated.classes[0]).toMatchObject({
      classId: '5etools-cn:class:xphb:wizard',
      subclassId: '5etools-cn:subclass:xphb:evoker:wizard',
      source: 'XPHB',
    });
    expect(migrated.equipmentIds).toEqual(['5etools-cn:baseitem:phb:longsword']);
    expect(migrated.contentSnapshots?.['5etools-cn:class:xphb:wizard']).toMatchObject({
      name: 'Wizard',
      revision: 'r2',
    });
    expect(migrated.schemaVersion).toBe(2);
  });

  it('没有来源可消歧时保留旧引用', () => {
    const catalog = new InMemoryCatalogService();
    catalog.register(entry('pack-a:feat:a:twin', 'feat', 'Twin', 'A'));
    catalog.register(entry('pack-b:feat:b:twin', 'feat', 'Twin', 'B'));
    expect(resolveCatalogReference(catalog, 'Twin', ['feat'])).toBeUndefined();
    const migrated = migrateCharacterCatalogReferences(
      character({ selectedFeats: [{ classId: 'x', level: 4, featId: 'Twin' }] }),
      catalog,
    );
    expect(migrated.selectedFeats[0].featId).toBe('Twin');
  });

  it('上游条目缺失时保留稳定 ID 和最后已知快照', () => {
    const missingId = 'homebrew-tjliqy:spell:custom:lost-spell';
    const saved = character({
      knownSpellIds: [missingId],
      contentSnapshots: {
        [missingId]: {
          id: missingId,
          kind: 'spell',
          name: '失落法术',
          source: 'CUSTOM',
          sourcePackId: 'homebrew-tjliqy',
        },
      },
    });
    const migrated = migrateCharacterCatalogReferences(saved, new InMemoryCatalogService());
    expect(migrated.knownSpellIds).toEqual([missingId]);
    expect(migrated.contentSnapshots?.[missingId]?.name).toBe('失落法术');
  });

  it('迁移附加角色选项并保存来源快照', () => {
    const catalog = new InMemoryCatalogService();
    catalog.register(entry('5etools-cn:reward:xdmg:blessing', 'reward', 'Blessing', 'XDMG'));
    const migrated = migrateCharacterCatalogReferences(
      character({ selectedCharacterOptionIds: ['Blessing'] }),
      catalog,
    );
    expect(migrated.selectedCharacterOptionIds).toEqual(['5etools-cn:reward:xdmg:blessing']);
    expect(migrated.contentSnapshots?.['5etools-cn:reward:xdmg:blessing']).toMatchObject({
      kind: 'reward',
      source: 'XDMG',
    });
  });

  it('缓存刷新后以相同稳定 ID 更新快照修订和显示名', () => {
    const catalog = new InMemoryCatalogService();
    const id = '5etools-cn:spell:xphb:example';
    catalog.register(entry(id, 'spell', '旧译名', 'XPHB', { revision: 'r1' }));
    const first = migrateCharacterCatalogReferences(character({ knownSpellIds: [id] }), catalog);
    catalog.register(entry(id, 'spell', '新译名', 'XPHB', { revision: 'r2' }));
    const refreshed = migrateCharacterCatalogReferences(first, catalog);
    expect(refreshed.knownSpellIds).toEqual([id]);
    expect(refreshed.contentSnapshots?.[id]).toMatchObject({ name: '新译名', revision: 'r2' });
  });
});
