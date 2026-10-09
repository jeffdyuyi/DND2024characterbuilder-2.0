import { describe, expect, it } from 'vitest';
import { defaultCatalog, InMemoryCatalogService } from '../catalog';
import type { CatalogEntry, EntryKind } from '../types';
import type { CharacterSourcePolicy, SourceSelection } from '@/types/sourceSelection';
import {
  createSourcePredicate,
  getCharacterSourcePolicy,
  getLoadedSourceBooks,
  getSourceReferenceStatus,
  validateSourceSelection,
} from '../sourcePolicy';
import { getCatalogClasses, getCatalogSubclasses } from '../adapters/classes';
import { getCatalogSpecies, getCatalogSubspecies } from '../adapters/species';
import { getCatalogBackgrounds } from '../adapters/backgrounds';
import { getCatalogFeats } from '../adapters/feats';
import { getCatalogSpells } from '../adapters/spells';
import { getCatalogItems } from '../adapters/items';
import {
  getCatalogCharacterOptions,
  getCatalogOptionalFeatures,
} from '../adapters/characterOptions';
import { getCatalogLanguages } from '../adapters/languages';
import { getCatalogToolEntries, getCatalogTools, invalidateCatalogToolCache } from '../tools';
import { getClassDefinition, getSpellDefinition } from '@/engine/characterData';
import { useCharacterStore } from '@/store/characterStore';
import { exportToJSON, importFromJSON } from '@/engine/importExport';
import { migrateCharacterCatalogReferences } from '../references';

const selection: SourceSelection = {
  mode: 'selected',
  books: [{ sourcePackId: '5etools-cn', source: 'XPHB' }],
};
const policy: CharacterSourcePolicy = { selection, allowHomebrew: false };
const none: CharacterSourcePolicy = {
  selection: { mode: 'selected', books: [] },
  allowHomebrew: true,
};
const kinds: EntryKind[] = [
  'class',
  'subclass',
  'classFeature',
  'subclassFeature',
  'race',
  'subrace',
  'background',
  'feat',
  'spell',
  'item',
  'baseitem',
  'magicvariant',
  'optionalfeature',
  'charoption',
  'reward',
  'boon',
  'cult',
  'language',
  'condition',
  'rule',
];

function entry(kind: EntryKind, source = 'XPHB', pack = '5etools-cn'): CatalogEntry {
  const name = `Source Policy ${kind}`;
  return {
    id: `${pack}:${source.toLowerCase()}:${kind}:source-policy`,
    kind,
    name,
    englishName: name,
    source,
    sourcePackId: pack,
    edition: source === 'XPHB' ? '2024' : '2014',
    raw: { name, ENG_name: name, source, entries: ['原文不应被筛选改写。'], featureType: ['EI'] },
  };
}

describe('角色书籍范围：显式查询、不污染完整目录', () => {
  it.each(kinds)('%s 候选同时遵守书籍白名单、数据包与第三方开关', (kind) => {
    const catalog = new InMemoryCatalogService();
    const allowed = entry(kind);
    catalog.registerMany([entry(kind, 'PHB'), entry(kind, 'XPHB', 'homebrew-a'), allowed]);
    expect(catalog.list(kind, { sourcePolicy: policy })).toEqual([allowed]);
    expect(catalog.list(kind, { sourcePolicy: none })).toEqual([]);
    expect(catalog.list(kind)).toHaveLength(3);
    expect(catalog.get(allowed.id)).toBe(allowed);
  });

  it('搜索先筛来源再应用 limit，且与规则版本过滤取交集', () => {
    const catalog = new InMemoryCatalogService();
    catalog.registerMany([entry('spell', 'PHB'), entry('spell')]);
    expect(catalog.search('Source Policy', { sourcePolicy: policy, limit: 1 })).toEqual([
      entry('spell'),
    ]);
    expect(catalog.list('spell', { edition: '2014', sourcePolicy: policy })).toEqual([]);
    expect(catalog.search('Source Policy', { source: 'PHB', sourcePolicy: policy })).toEqual([]);
  });

  it('缺省书籍范围兼容旧角色，Homebrew 开关独立生效', () => {
    const allows = createSourcePredicate(getCharacterSourcePolicy({}));
    expect(allows(entry('feat', 'PHB'))).toBe(true);
    expect(allows(entry('feat', 'XPHB'))).toBe(true);
    expect(allows(entry('feat', 'XPHB', 'homebrew-a'))).toBe(false);
    const selectedBrew = {
      selection: {
        mode: 'selected',
        books: [{ source: 'XPHB', sourcePackId: 'homebrew-a' }],
      } as SourceSelection,
    };
    expect(
      createSourcePredicate({ ...selectedBrew, allowHomebrew: true })(
        entry('feat', 'XPHB', 'homebrew-a'),
      ),
    ).toBe(true);
    expect(
      createSourcePredicate({ ...selectedBrew, allowHomebrew: false })(
        entry('feat', 'XPHB', 'homebrew-a'),
      ),
    ).toBe(false);
    expect(
      createSourcePredicate({ selection: { mode: 'all' }, allowHomebrew: false })({
        ...entry('feat'),
        isHomebrew: true,
      }),
    ).toBe(false);
  });

  it('官方历史代码归一化，但不合并规则版本或不同数据包', () => {
    expect(createSourcePredicate(policy)(entry('spell', ' phb2024 '))).toBe(true);
    expect(createSourcePredicate(policy)(entry('spell', 'PHB'))).toBe(false);
    expect(createSourcePredicate(policy)(entry('spell', 'XPHB', 'legacy'))).toBe(false);
    expect(
      validateSourceSelection({
        mode: 'selected',
        books: [
          { sourcePackId: '5etools-cn', source: 'XPHB' },
          { sourcePackId: '5etools-cn', source: 'phb2024' },
        ],
      }),
    ).toEqual({ mode: 'selected', books: [{ sourcePackId: '5etools-cn', source: 'phb2024' }] });
  });

  it('非法配置拒绝写入；读取错误导入配置不会崩溃或开放全部来源', () => {
    expect(() => validateSourceSelection({ mode: 'selected', books: [null] } as any)).toThrow();
    expect(
      createSourcePredicate({ selection: { mode: 'selected' } as any, allowHomebrew: true })(
        entry('feat'),
      ),
    ).toBe(false);
  });

  it('书籍清单按数据包分离，跨类别累加条目数，不把已加载清单视为远程全量', () => {
    const catalog = new InMemoryCatalogService();
    catalog.registerMany([entry('feat'), entry('spell'), entry('feat', 'XPHB', 'homebrew-a')]);
    const books = getLoadedSourceBooks(catalog);
    expect(books).toHaveLength(2);
    expect(books.find((book) => book.sourcePackId === '5etools-cn')?.entryCount).toBe(2);
    expect(books.find((book) => book.sourcePackId === 'homebrew-a')?.isHomebrew).toBe(true);
  });

  it('已有引用仅标记 excluded/unresolved，不删除原条目、原文或原引用', () => {
    const catalog = new InMemoryCatalogService();
    const old = entry('spell', 'PHB');
    catalog.register(old);
    expect(getSourceReferenceStatus(old.id, catalog, policy).status).toBe('excluded');
    expect(getSourceReferenceStatus('not-loaded', catalog, policy).status).toBe('unresolved');
    expect(catalog.get(old.id)).toBe(old);
    expect(old.raw.entries).toEqual(['原文不应被筛选改写。']);
  });
});

describe('业务适配器的候选查询', () => {
  it('主列表、法术、附加选项、语言和装备共用同一策略；空白名单不漏出本地兜底', () => {
    for (const kind of kinds) defaultCatalog.registerMany([entry(kind), entry(kind, 'PHB')]);
    const queries = [
      getCatalogClasses,
      getCatalogSpecies,
      getCatalogBackgrounds,
      getCatalogFeats,
      getCatalogSpells,
      getCatalogItems,
      getCatalogCharacterOptions,
      getCatalogLanguages,
    ];
    for (const query of queries) {
      const results = query({ sourcePolicy: policy });
      expect(results.length).toBeGreaterThan(0);
      expect(results.every((result) => result.source === 'XPHB')).toBe(true);
      expect(query({ sourcePolicy: none })).toEqual([]);
    }
    expect(
      getCatalogOptionalFeatures('EI', undefined, { sourcePolicy: policy }).every(
        (v) => v.source === 'XPHB',
      ),
    ).toBe(true);
    // 明确保留引擎的完整解析能力。
    expect(getClassDefinition(entry('class', 'PHB').id)).toBeDefined();
    expect(getSpellDefinition(entry('spell', 'PHB').id)).toBeDefined();
  });

  it('子职业和亚种嵌套候选按各自出处筛选，原始定义和固定特性不变', () => {
    const cls = entry('class');
    cls.raw.subClassInfo = {
      unlockLevel: 3,
      options: [
        { name: '允许子职', source: 'XPHB', traits: [] },
        { name: '排除子职', source: 'PHB', traits: [] },
      ],
    };
    const race = entry('race');
    race.raw.subSpecies = {
      numToChoose: 1,
      options: [
        { id: 'inline-allowed', name: '同书血系', traits: [] },
        { id: 'inline-excluded', name: '扩展血系', source: 'PHB', traits: [] },
      ],
    };
    defaultCatalog.registerMany([cls, race]);
    const before = JSON.stringify([cls, race]);
    expect(
      getCatalogClasses({ sourcePolicy: policy })
        .find((v) => v.catalogId === cls.id)
        ?.subClassInfo?.options.map((v) => v.name),
    ).toEqual(['允许子职']);
    expect(
      getCatalogSpecies({ sourcePolicy: policy })
        .find((v) => v.id === race.id)
        ?.subSpecies?.options.map((v) => v.name),
    ).toEqual(['同书血系']);
    expect(getCatalogSubclasses(undefined, { sourcePolicy: none })).toEqual([]);
    expect(getCatalogSubspecies(undefined, { sourcePolicy: none })).toEqual([]);
    expect(JSON.stringify([cls, race])).toBe(before);
    expect(getClassDefinition(cls.id)?.subClassInfo?.options).toHaveLength(2);
  });

  it('工具查询保留来源身份，跨包同名工具可独立筛选', () => {
    const official = entry('item');
    official.raw.type = 'AT';
    const brew = entry('item', 'XPHB', 'homebrew-a');
    brew.raw.type = 'AT';
    defaultCatalog.registerMany([official, brew]);
    invalidateCatalogToolCache();
    expect(getCatalogToolEntries({ sourcePolicy: policy }).map((v) => v.catalogId)).toEqual([
      official.id,
    ]);
    const brewPolicy: CharacterSourcePolicy = {
      allowHomebrew: true,
      selection: { mode: 'selected', books: [{ source: 'XPHB', sourcePackId: 'homebrew-a' }] },
    };
    expect(getCatalogToolEntries({ sourcePolicy: brewPolicy }).map((v) => v.catalogId)).toEqual([
      brew.id,
    ]);
    expect(getCatalogTools('Artisan', { sourcePolicy: none })).toEqual([]);
  });
});

describe('书籍配置持久化与角色隔离', () => {
  it('创建、复制、JSON 导出导入和引用迁移均保留配置；更新指定角色不清除其选择', async () => {
    const store = useCharacterStore.getState();
    const firstId = store.createCharacter({ sourceSelection: selection, allowHomebrew: true });
    store.updateActiveCharacter({
      knownSpellIds: [entry('spell', 'PHB').id],
      backgroundSelections: { test: ['原始选项'] },
    });
    const secondId = store.createCharacter();
    const before = structuredClone(useCharacterStore.getState().characters[firstId]);
    store.updateCharacterSources(firstId, {
      sourceSelection: { mode: 'selected', books: [] },
      allowHomebrew: false,
    });
    const after = useCharacterStore.getState().characters[firstId];
    expect(after).toEqual({
      ...before,
      sourceSelection: { mode: 'selected', books: [] },
      allowHomebrew: false,
    });
    expect(useCharacterStore.getState().characters[secondId].sourceSelection).toBeUndefined();
    expect(useCharacterStore.getState().activeCharacterId).toBe(secondId);
    const cloneId = store.cloneCharacter(firstId);
    const clone = useCharacterStore.getState().characters[cloneId];
    expect(clone.sourceSelection).toEqual(after.sourceSelection);
    expect(clone.sourceSelection).not.toBe(after.sourceSelection);
    expect(await importFromJSON(exportToJSON(after))).toEqual(after);
    expect(migrateCharacterCatalogReferences(after, new InMemoryCatalogService())).toMatchObject({
      sourceSelection: after.sourceSelection,
      knownSpellIds: before.knownSpellIds,
    });
    [firstId, secondId, cloneId].forEach((id) => store.deleteCharacter(id));
  });
});
