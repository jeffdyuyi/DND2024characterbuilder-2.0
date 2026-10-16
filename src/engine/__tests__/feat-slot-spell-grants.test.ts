import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { InMemoryCatalogService, defaultCatalog } from '@/catalog/catalog';
import { makeEntryId } from '@/catalog/identity';
import type { CatalogEntry } from '@/catalog/types';
import type { CharacterState } from '@/types/characterState';
import type { ClassFeature } from '@/types/class';
import type { FeatSlotDefinitions } from '../featSlots';
import { buildCharacterFeatSlots } from '../featSlots';
import { collectFeatSlotSpellGrantSources } from '../featSlotSpellGrants';
import { getClassDefinition } from '../characterData';
import { normalizeClass } from '@/source/fiveetools-cn/normalizers/class';

const fixture = JSON.parse(
  readFileSync('src/source/__fixtures__/fiveetools-cn/spell-grants.json', 'utf8'),
);
function setup() {
  const catalog = new InMemoryCatalogService();
  const row = fixture.entries.find((row: any) => row.raw.ENG_name === 'Strixhaven Initiate');
  const feat: CatalogEntry = {
    id: makeEntryId({
      packId: '5etools-cn',
      kind: 'feat',
      name: row.raw.ENG_name,
      source: row.raw.source,
    }),
    kind: 'feat',
    name: row.raw.name,
    englishName: row.raw.ENG_name,
    source: row.raw.source,
    edition: '2014',
    sourcePackId: '5etools-cn',
    raw: row.raw,
  };
  catalog.register(feat);
  return { catalog, feat };
}
function state(overrides: Partial<CharacterState> = {}): CharacterState {
  return {
    id: 'slot-grants',
    name: '测试',
    playerName: '',
    classes: [],
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    backgroundAbilityBonuses: {},
    selectedFeats: [],
    selectedSkills: [],
    expertiseSkills: [],
    equipmentIds: [],
    inventoryEntries: [],
    equippedWeaponIds: [],
    attunedItemIds: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    preparedSpellIds: ['manual'],
    cantripIds: [],
    knownSpellIds: [],
    spellbookIds: [],
    spellSlotUsage: {},
    resourceUsage: {},
    selectedLanguages: [],
    ...overrides,
  };
}
const feature = (name: string, level: number): ClassFeature => ({
  name,
  level,
  description: '',
  mechanics: { choices: [{ id: `${name}-choice`, type: 'feat', numToChoose: 1, options: [] }] },
});
const species: NonNullable<FeatSlotDefinitions['species']> = {
  name: '种族',
  traits: [
    {
      id: 'native-choice',
      name: '原生专长选择',
      description: '',
      features: { originFeats: { numToChoose: 1, options: [], filter: 'type:origin' } },
    },
  ],
};
const noClass = () => undefined;

it('实际已选背景专长关联原槽位，原生15组合、属性和次数保留但不自动选择', () => {
  const { catalog, feat } = setup();
  const character = state({
    backgroundId: 'bg',
    originFeatId: feat.id,
    featSelections: {
      'background-feat': {
        featId: feat.id,
        ability: 'wis',
        spellList: 'Cleric',
        spells: ['old-spell'],
      },
    },
  });
  const before = JSON.stringify({ character, raw: feat.raw });
  const definitions = { background: { name: '背景' }, getClass: noClass };
  const result = collectFeatSlotSpellGrantSources(character, definitions, catalog);
  expect(result.diagnostics).toEqual([]);
  expect(result.sources[0].slot).toEqual(buildCharacterFeatSlots(character, definitions)[0]);
  expect(result.sources[0].slot.id).toBe('background-feat');
  expect(result.sources[0].grants.blocks).toHaveLength(15);
  expect(result.sources[0].grants.blockRelationship).toBe('unspecified');
  expect(result.sources[0].grants.blocks[0].ability).toMatchObject({ kind: 'choose' });
  expect(result.sources[0].grants.blocks[0].rules.some((rule) => rule.usage.kind === 'daily')).toBe(
    true,
  );
  expect(JSON.stringify({ character, raw: feat.raw })).toBe(before);
});

it.each(['species-native-choice', 'native-choice', '原生专长选择', 'sp:race:trait:native-choice'])(
  '种族原兼容键%s关联到同一个槽位',
  (key) => {
    const { catalog, feat } = setup();
    const result = collectFeatSlotSpellGrantSources(
      state({ speciesId: 'race', speciesSelections: { [key]: [feat.id] } }),
      { species, getClass: noClass },
      catalog,
    );
    expect(result.sources[0].slot.id).toBe('species-native-choice');
    expect(result.sources[0].grants.origin.id).toBe(feat.id);
    expect(result.diagnostics).toEqual([]);
  },
);

it('详细槽位选择沿用页面优先级，不被旧种族快捷选择覆盖', () => {
  const { catalog, feat } = setup();
  const result = collectFeatSlotSpellGrantSources(
    state({
      speciesId: 'race',
      speciesSelections: { 'native-choice': ['stale-choice'] },
      featSelections: { 'species-native-choice': { featId: feat.id } },
    }),
    { species, getClass: noClass },
    catalog,
  );
  expect(result.sources).toHaveLength(1);
  expect(result.sources[0].grants.origin.id).toBe(feat.id);
});

it('职业槽位保留原职业键和取得等级；法术解锁上下文用角色总等级', () => {
  const { catalog, feat } = setup();
  const key = 'cls:class:second:feat:四级专长:四级专长-choice';
  const character = state({
    classes: [
      { classId: 'first', source: 'PHB', level: 5, isMulticlass: false },
      { classId: 'class:second', source: 'PHB', level: 4, isMulticlass: true },
    ],
    featSelections: { [key]: { featId: feat.id } },
  });
  const definitions: FeatSlotDefinitions = {
    getClass: (id) =>
      id === 'class:second' ? { name: '兼职', features: [feature('四级专长', 4)] } : undefined,
  };
  const result = collectFeatSlotSpellGrantSources(character, definitions, catalog);
  expect(result.sources[0].slot).toMatchObject({ id: key, classId: 'class:second', level: 4 });
  expect(result.sources[0].characterLevel).toBe(9);
  character.classes[1].level = 3;
  expect(collectFeatSlotSpellGrantSources(character, definitions, catalog).sources).toEqual([]);
  character.classes = [character.classes[0]];
  expect(collectFeatSlotSpellGrantSources(character, definitions, catalog).sources).toEqual([]);
});

it('旧classSelections读回原职业槽位，不要求改写成新记录', () => {
  const { catalog, feat } = setup();
  const key = 'cls:class:feat:升级:升级-choice';
  const character = state({
    classes: [{ classId: 'class', source: 'PHB', level: 4, isMulticlass: false }],
    classSelections: { [key]: [feat.id] },
  });
  const before = JSON.stringify(character);
  const result = collectFeatSlotSpellGrantSources(
    character,
    { getClass: () => ({ name: '职业', features: [feature('升级', 4)] }) },
    catalog,
  );
  expect(result.sources[0].slot.id).toBe(key);
  expect(JSON.stringify(character)).toBe(before);
});

it('不同等级槽位选择同一专长时保留两条槽位关联，不按专长ID提前合并', () => {
  const { catalog, feat } = setup();
  const character = state({
    classes: [{ classId: 'class', source: 'PHB', level: 8, isMulticlass: false }],
    featSelections: {
      'cls:class:feat:四级:四级-choice': { featId: feat.id },
      'cls:class:feat:八级:八级-choice': { featId: feat.id },
    },
  });
  const result = collectFeatSlotSpellGrantSources(
    character,
    { getClass: () => ({ name: '职业', features: [feature('四级', 4), feature('八级', 8)] }) },
    catalog,
  );
  expect(result.sources.map((source) => source.slot.level)).toEqual([4, 8]);
  expect(new Set(result.sources.map((source) => source.slot.id)).size).toBe(2);
  expect(new Set(result.sources.map((source) => source.grants.origin.id)).size).toBe(1);
});

it('背景两份记录不一致或快捷记录缺失时诊断，不把旧槽位当成新授予', () => {
  const { catalog, feat } = setup();
  const other = { ...feat, id: 'other:feat', name: '另一个专长', englishName: 'Other Feat' };
  catalog.register(other);
  const character = state({
    originFeatId: other.id,
    featSelections: { 'background-feat': { featId: feat.id } },
  });
  const definitions = { background: { name: '背景' }, getClass: noClass };
  const before = JSON.stringify(character);
  const result = collectFeatSlotSpellGrantSources(character, definitions, catalog);
  expect(result.sources).toEqual([]);
  expect(result.diagnostics[0].code).toBe('conflicting-background-feat');
  expect(JSON.stringify(character)).toBe(before);
  character.originFeatId = undefined;
  expect(
    collectFeatSlotSpellGrantSources(character, definitions, catalog).diagnostics[0].code,
  ).toBe('unverified-background-feat');
});

it('缺失/歧义专长引用不借用其他出处，完整ID仍能明确解析', () => {
  const { catalog, feat } = setup();
  catalog.register({ ...feat, id: 'homebrew:feat', sourcePackId: 'homebrew-other' });
  const character = state({
    speciesId: 'race',
    featSelections: { 'species-native-choice': { featId: feat.name } },
  });
  expect(
    collectFeatSlotSpellGrantSources(character, { species, getClass: noClass }, catalog).sources,
  ).toEqual([]);
  character.featSelections!['species-native-choice'].featId = feat.id;
  expect(
    collectFeatSlotSpellGrantSources(character, { species, getClass: noClass }, catalog).sources[0]
      .grants.origin.id,
  ).toBe(feat.id);
});

it('重复槽位ID不能误绑定两次；空槽、非原生旧专长不凭空制造授予', () => {
  const { catalog, feat } = setup();
  const character = state({
    speciesId: 'race',
    featSelections: { 'species-native-choice': { featId: feat.id } },
  });
  const result = collectFeatSlotSpellGrantSources(
    character,
    { species: { ...species, traits: [...species.traits, ...species.traits] }, getClass: noClass },
    catalog,
  );
  expect(result.sources).toEqual([]);
  expect(result.diagnostics.map((d) => d.code)).toContain('ambiguous-feat-slot');
  expect(
    collectFeatSlotSpellGrantSources(state(), { species, getClass: noClass }, catalog).sources,
  ).toEqual([]);
  catalog.register({ ...feat, raw: { name: feat.name, mechanics: { spells: [] } } });
  expect(
    collectFeatSlotSpellGrantSources(character, { species, getClass: noClass }, catalog).sources,
  ).toEqual([]);
});

it('JSON往返和来源移除不删除已有细选、手动法术和逐级替换/抄录记录', () => {
  const { catalog, feat } = setup();
  const character = state({
    speciesId: 'race',
    featSelections: {
      'species-native-choice': { featId: feat.id, spells: ['saved'], spellList: 'Wizard' },
    },
    spellsByLevel: {
      class: {
        4: {
          cantrips: [],
          spells: ['new'],
          replacedSpell: 'old',
          extra: { wizard_spellbook: ['book'] },
        },
      },
    },
  });
  const saved = JSON.parse(JSON.stringify(character));
  const result = collectFeatSlotSpellGrantSources(saved, { species, getClass: noClass }, catalog);
  expect(result.sources[0].slot.id).toBe('species-native-choice');
  expect(collectFeatSlotSpellGrantSources(saved, { getClass: noClass }, catalog).sources).toEqual(
    [],
  );
  expect(saved).toEqual(character);
});

it('成熟职业适配器产生的实际槽位可直接关联，身份与页面共享函数一致', () => {
  const { feat } = setup();
  const parent = normalizeClass({
    name: '实际关联职业',
    source: 'PHB',
    features: [feature('升级专长', 4)],
  });
  defaultCatalog.registerMany([parent, feat]);
  const character = state({
    classes: [{ classId: parent.id, source: 'PHB', level: 4, isMulticlass: false }],
    featSelections: { [`cls:${parent.id}:feat:升级专长:升级专长-choice`]: { featId: feat.id } },
  });
  const definitions = { getClass: getClassDefinition };
  const result = collectFeatSlotSpellGrantSources(character, definitions);
  expect(result.sources[0].slot).toEqual(buildCharacterFeatSlots(character, definitions)[0]);
  expect(result.sources[0].slot.classId).toBe(parent.id);
});

it('非法职业等级不给专长法术建立伪造的角色等级上下文', () => {
  const { catalog, feat } = setup();
  const result = collectFeatSlotSpellGrantSources(
    state({
      classes: [{ classId: 'class', source: 'PHB', level: -1, isMulticlass: false }],
      speciesSelections: { 'native-choice': [feat.id] },
    }),
    { species, getClass: noClass },
    catalog,
  );
  expect(result.sources).toEqual([]);
  expect(result.diagnostics[0].code).toBe('unresolved-character-level');
});
