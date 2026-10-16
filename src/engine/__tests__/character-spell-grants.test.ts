import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { InMemoryCatalogService } from '@/catalog/catalog';
import { makeEntryId } from '@/catalog/identity';
import type { CatalogEntry, EntryKind } from '@/catalog/types';
import type { CharacterState } from '@/types/characterState';
import { collectCharacterSpellGrantSources } from '../characterSpellGrants';

const fixture = JSON.parse(
  readFileSync('src/source/__fixtures__/fiveetools-cn/spell-grants.json', 'utf8'),
);
function entry(kind: EntryKind, raw: Record<string, any>, pack = '5etools-cn'): CatalogEntry {
  return {
    id: makeEntryId({ packId: pack, kind, source: raw.source, name: raw.ENG_name || raw.name }),
    kind,
    name: raw.name,
    englishName: raw.ENG_name,
    source: raw.source,
    sourcePackId: pack,
    edition: raw.source === 'XPHB' ? '2024' : '2014',
    raw,
  };
}
function state(overrides: Partial<CharacterState> = {}): CharacterState {
  return {
    id: 'personal-spells',
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
function setup() {
  const catalog = new InMemoryCatalogService();
  const sample = (name: string, source: string) => {
    const row = fixture.entries.find(
      (row: any) => row.raw.ENG_name === name && row.raw.source === source,
    );
    const value = entry(row.kind, row.raw);
    catalog.register(value);
    return value;
  };
  const race = sample('Astral Elf', 'AAG');
  const background = sample('Lorehold Student', 'SCC');
  const feat = sample('Strixhaven Initiate', 'SCC');
  const otherFeat = sample('Magic Initiate', 'PHB');
  return { catalog, sample, race, background, feat, otherFeat };
}
const ids = (result: ReturnType<typeof collectCharacterSpellGrantSources>) =>
  result.sources.map((source) => source.grants.origin.id);

it('真实种族/背景/已选专长接入同一原生模型，保留分支而不全部授予', () => {
  const { catalog, race, background, feat } = setup();
  const character = state({
    speciesId: race.id,
    speciesSource: 'AAG',
    backgroundId: background.id,
    backgroundSource: 'SCC',
    originFeatId: feat.id,
    featSelections: { 'background-feat': { featId: feat.id } },
  });
  const before = JSON.stringify({ character, rows: [race.raw, background.raw, feat.raw] });
  const result = collectCharacterSpellGrantSources(character, catalog);
  expect(ids(result)).toEqual([race.id, background.id, feat.id]);
  expect(result.diagnostics).toEqual([]);
  expect(result.sources[0].grants.blocks).toHaveLength(3);
  expect(result.sources[2].grants.blocks).toHaveLength(15);
  expect(result.sources[2].grants.blockRelationship).toBe('unspecified');
  expect(JSON.stringify({ character, rows: [race.raw, background.raw, feat.raw] })).toBe(before);
  expect(character.preparedSpellIds).toEqual(['manual']);
});

it('复用职业收集器，保留职业等级和来源身份', () => {
  const { catalog, sample } = setup();
  const parent = sample('Warlock', 'XPHB');
  const result = collectCharacterSpellGrantSources(
    state({ classes: [{ classId: parent.id, source: 'XPHB', level: 9, isMulticlass: false }] }),
    catalog,
  );
  expect(result.sources[0]).toMatchObject({
    classId: parent.id,
    level: 9,
    grants: { origin: { id: parent.id } },
  });
  expect(result.diagnostics).toEqual([]);
});

it('已保存的手动背景专长保留，不再额外自动选中原生固定专长', () => {
  const { catalog, background, otherFeat, feat } = setup();
  const result = collectCharacterSpellGrantSources(
    state({
      backgroundId: background.id,
      originFeatId: otherFeat.id,
      featSelections: { 'background-feat': { featId: otherFeat.id } },
    }),
    catalog,
  );
  expect(ids(result)).toContain(otherFeat.id);
  expect(ids(result)).not.toContain(feat.id);
});

it('背景快捷字段与详细槽位冲突时不猜测有效专长，两份原记录均保留', () => {
  const { catalog, background, otherFeat, feat } = setup();
  const character = state({
    backgroundId: background.id,
    originFeatId: otherFeat.id,
    featSelections: { 'background-feat': { featId: feat.id } },
  });
  const before = JSON.stringify(character);
  const result = collectCharacterSpellGrantSources(character, catalog);
  expect(ids(result)).toEqual([background.id]);
  expect(result.diagnostics[0].code).toBe('conflicting-background-feat');
  expect(JSON.stringify(character)).toBe(before);
});

it('只有详细背景槽位而缺少当前背景快捷引用时保留记录并待核对', () => {
  const { catalog, background, feat } = setup();
  const character = state({
    backgroundId: background.id,
    featSelections: { 'background-feat': { featId: feat.id } },
  });
  const before = JSON.stringify(character);
  const result = collectCharacterSpellGrantSources(character, catalog);
  expect(ids(result)).toEqual([background.id]);
  expect(result.diagnostics[0].code).toBe('unverified-background-feat');
  expect(JSON.stringify(character)).toBe(before);
});

it('未选原生背景专长只给诊断，不把所有专长/法术选中', () => {
  const { catalog, background, feat } = setup();
  catalog.register({
    ...background,
    raw: { ...background.raw, feats: [{ [`${feat.name}|SCC`]: true }] },
  });
  const result = collectCharacterSpellGrantSources(state({ backgroundId: background.id }), catalog);
  expect(ids(result)).toEqual([background.id]);
  expect(result.diagnostics[0].code).toBe('background-feat-selection-required');
});

it('移除种族/背景后孤立选择不会成为来源，不删除旧选择或手动法术', () => {
  const { catalog, feat } = setup();
  const character = state({
    originFeatId: feat.id,
    featSelections: { 'background-feat': { featId: feat.id }, 'species-old': { featId: feat.id } },
  });
  const before = JSON.stringify(character);
  const result = collectCharacterSpellGrantSources(character, catalog);
  expect(result.sources).toEqual([]);
  expect(result.diagnostics.map((d) => d.code)).toEqual([
    'orphan-background-feat',
    'unverified-feat-slot',
  ]);
  expect(JSON.stringify(character)).toBe(before);
});

it('来源开关限制候选，不删除已有完整ID引用', () => {
  const { catalog, race } = setup();
  const result = collectCharacterSpellGrantSources(
    state({
      speciesId: race.id,
      allowHomebrew: false,
      sourceSelection: { mode: 'selected', books: [] },
    }),
    catalog,
  );
  expect(ids(result)).toEqual([race.id]);
});

it('旧名称仅在唯一来源可确认时解析，显式出处不符不能借用其他版本', () => {
  const { catalog, race } = setup();
  expect(
    ids(
      collectCharacterSpellGrantSources(
        state({ speciesId: race.englishName, speciesSource: 'AAG' }),
        catalog,
      ),
    ),
  ).toEqual([race.id]);
  const result = collectCharacterSpellGrantSources(
    state({ speciesId: race.id, speciesSource: 'XPHB' }),
    catalog,
  );
  expect(result.sources).toEqual([]);
  expect(result.diagnostics[0].code).toBe('mismatched-source');
});

it('同名官方/第三方歧义不按插入顺序解析', () => {
  const { catalog, race } = setup();
  catalog.register(entry('race', race.raw, 'homebrew-other'));
  const result = collectCharacterSpellGrantSources(state({ speciesId: race.name }), catalog);
  expect(result.sources).toEqual([]);
  expect(result.diagnostics[0].code).toBe('unresolved-source');
  expect(ids(collectCharacterSpellGrantSources(state({ speciesId: race.id }), catalog))).toEqual([
    race.id,
  ]);
});

it('父亚种关系匹配后才收集，父子法术覆盖关系留待处理而非自动累加', () => {
  const { catalog, race } = setup();
  const child = entry('subrace', {
    name: '测试亚种',
    source: 'TST',
    raceName: race.englishName,
    raceSource: 'AAG',
    additionalSpells: [{ known: { 1: ['光亮术#c'] } }],
  });
  catalog.register(child);
  const result = collectCharacterSpellGrantSources(
    state({ speciesId: race.id, subspeciesId: child.id }),
    catalog,
  );
  expect(ids(result)).toEqual([race.id, child.id]);
  expect(result.diagnostics[0].code).toBe('subrace-inheritance-review');
  catalog.register({ ...child, raw: { ...child.raw, raceSource: 'PHB' } });
  expect(
    ids(
      collectCharacterSpellGrantSources(
        state({ speciesId: race.id, subspeciesId: child.id }),
        catalog,
      ),
    ),
  ).toEqual([race.id]);
});

it('明确选中的第三方亚种可以扩展官方种族，不被新增包限制误伤', () => {
  const { catalog, race } = setup();
  const child = entry(
    'subrace',
    {
      name: '第三方亚种',
      source: 'HB',
      raceName: race.name,
      raceSource: 'AAG',
      additionalSpells: [{ known: { _: ['光亮术#c'] } }],
    },
    'homebrew-extension',
  );
  catalog.register(child);
  expect(
    ids(
      collectCharacterSpellGrantSources(
        state({ speciesId: race.id, subspeciesId: child.id }),
        catalog,
      ),
    ),
  ).toEqual([race.id, child.id]);
});

it('职业已选专长随所属职业等级解锁，法术授予门槛使用角色总等级', () => {
  const { catalog, feat } = setup();
  const first = entry('class', { name: 'Primary', source: 'PHB' });
  const second = entry('class', { name: 'Secondary', source: 'PHB' });
  catalog.registerMany([first, second]);
  const character = state({
    classes: [
      { classId: first.id, source: 'PHB', level: 5, isMulticlass: false },
      { classId: second.id, source: 'PHB', level: 4, isMulticlass: true },
    ],
    selectedFeats: [{ classId: second.id, level: 4, featId: feat.id }],
  });
  const result = collectCharacterSpellGrantSources(character, catalog);
  expect(result.sources).toHaveLength(1);
  expect(result.sources[0]).toMatchObject({ level: 9, classId: second.id });
  character.classes[1].level = 3;
  expect(collectCharacterSpellGrantSources(character, catalog).sources).toEqual([]);
  character.classes = [character.classes[0]];
  expect(collectCharacterSpellGrantSources(character, catalog).sources).toEqual([]);
});

it('JSON往返收集身份一致，不凭不明详细槽位授予专长', () => {
  const { catalog, background, feat } = setup();
  const character = state({
    backgroundId: background.id,
    originFeatId: feat.id,
    featSelections: { 'cls:old:feat:removed': { featId: feat.id } },
  });
  const original = collectCharacterSpellGrantSources(character, catalog);
  const saved = collectCharacterSpellGrantSources(JSON.parse(JSON.stringify(character)), catalog);
  expect(saved.sources.map((source) => source.selectionKey)).toEqual(
    original.sources.map((source) => source.selectionKey),
  );
  expect(saved.sources).toHaveLength(2);
  expect(saved.diagnostics[0].code).toBe('unverified-feat-slot');
});

it('非法等级不以伪造角色总等级激活个人来源', () => {
  const { catalog, race } = setup();
  const result = collectCharacterSpellGrantSources(
    state({
      speciesId: race.id,
      classes: [{ classId: 'missing', source: 'PHB', level: -1, isMulticlass: false }],
    }),
    catalog,
  );
  expect(result.sources).toEqual([]);
  expect(result.diagnostics.map((d) => d.code)).toContain('unresolved-character-level');
});
