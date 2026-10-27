import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { buildCharacterFeatSlots } from '../featSlots';
import type { FeatSlotDefinitions } from '../featSlots';
import type { CharacterState } from '@/types/characterState';
import type { ClassFeature } from '@/types/class';
import { defaultCatalog } from '@/catalog/catalog';
import { normalizeClass } from '@/source/fiveetools-cn/normalizers/class';
import { normalizeBackground } from '@/source/fiveetools-cn/normalizers/background';
import { normalizeFeat } from '@/source/fiveetools-cn/normalizers/feat';
import { normalizeSpell } from '@/source/fiveetools-cn/normalizers/spell';
import { createBuilderChoices } from '@/catalog/builderChoices';
import { getBackgroundDefinition, getClassDefinition } from '../characterData';

const control = vi.hoisted(() => ({ state: {} as CharacterState, update: vi.fn() }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams({ id: control.state.id }),
}));
vi.mock('@/store/characterStore', () => ({
  useCharacterStore: () => ({
    characters: { [control.state.id]: control.state },
    updateActiveCharacter: control.update,
    loadCharacter() {},
  }),
}));
vi.mock('@/platform/CatalogProvider', () => ({ useCatalog: () => ({ status: 'ready' }) }));
vi.mock('@/platform/useBuilderChoices', () => ({
  useBuilderChoices: () => createBuilderChoices(control.state),
}));
import FeatsPage from '@/app/builder/feats/page';

function state(overrides: Partial<CharacterState> = {}): CharacterState {
  return {
    id: 'feat-slot-regression',
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
const feature = (name: string, level: number, options: string[] = []): ClassFeature => ({
  name,
  level,
  description: '',
  mechanics: { choices: [{ id: `${name}-choice`, type: 'feat', numToChoose: 1, options }] },
});
const noClass = () => undefined;

it('实际专长页使用共享候选且保留已有环阶选择和其他专长配置', () => {
  const background = normalizeBackground({ name: '共享选法背景', source: 'XPHB', entries: [] });
  const feat = normalizeFeat({
    name: '共享选法专长',
    source: 'XPHB',
    category: 'O',
    entries: [],
    mechanics: { spells: [{ count: 1, level: 0, listOptions: ['wizard'] }] },
  });
  const cantrip = normalizeSpell({
    name: '共享法师候选',
    source: 'XPHB',
    level: 0,
    classes: ['法师'],
    entries: [],
  });
  const other = normalizeSpell({
    name: '不应显示的牧师候选',
    source: 'XPHB',
    level: 0,
    classes: ['牧师'],
    entries: [],
  });
  defaultCatalog.registerMany([background, feat, cantrip, other]);
  control.state = state({
    backgroundId: background.id,
    originFeatId: feat.id,
    featSelections: {
      'background-feat': { featId: feat.id, ability: 'wis', spells: [cantrip.id] },
    },
  });
  control.update.mockClear();
  const snapshot = JSON.stringify(control.state);
  const html = renderToStaticMarkup(<FeatsPage />);
  expect(html).toContain('共享法师候选');
  expect(html).not.toContain('不应显示的牧师候选');
  expect(JSON.stringify(control.state)).toBe(snapshot);
  expect(control.update).not.toHaveBeenCalled();
});

const species: NonNullable<FeatSlotDefinitions['species']> = {
  name: '槽位种族',
  traits: [{ id: 'versatile', name: '多才多艺', nameEn: 'Versatile', description: '' }],
};

it('槽位ID、背景/种族/职业顺序和保存优先级保持既有契约', () => {
  const character = state({
    speciesId: 'race-id',
    originFeatId: 'old-background',
    classes: [{ classId: 'class:id', source: 'PHB', level: 4, isMulticlass: false }],
    featSelections: {
      'background-feat': { featId: 'saved-background' },
      'species-versatile': { featId: 'saved-species' },
      'cls:class:id:feat:升级专长:升级专长-choice': { featId: 'saved-class' },
    },
    classSelections: { 'cls:class:id:feat:升级专长:升级专长-choice': ['old-class'] },
  });
  const slots = buildCharacterFeatSlots(character, {
    background: { name: '槽位背景' },
    species,
    getClass: () => ({
      name: '槽位职业',
      features: [feature('升级专长', 4), feature('未来专长', 8)],
    }),
  });
  expect(slots).toEqual([
    {
      id: 'background-feat',
      level: 1,
      name: '背景专长 (Origin Feat)',
      allowedCategories: ['Origin'],
      grantingSource: '背景: 槽位背景',
      currentFeatId: 'saved-background',
    },
    {
      id: 'species-versatile',
      level: 1,
      name: '种族加成专长 (Origin Feat)',
      allowedCategories: ['Origin'],
      grantingSource: '种族: 槽位种族 (多才多艺)',
      currentFeatId: 'saved-species',
    },
    {
      id: 'cls:class:id:feat:升级专长:升级专长-choice',
      level: 4,
      classId: 'class:id',
      name: '升级专长 (专长选择)',
      allowedCategories: ['General', 'Legacy'],
      grantingSource: '职业: 槽位职业 (等级 4)',
      currentFeatId: 'saved-class',
    },
  ]);
});

it.each(['species-versatile', 'versatile', '多才多艺', 'sp:race-id:trait:versatile'])(
  '旧种族选择键%s仍能读回原槽位',
  (key) => {
    const slots = buildCharacterFeatSlots(
      state({ speciesId: 'race-id', speciesSelections: { [key]: ['old-feat'] } }),
      { species, getClass: noClass },
    );
    expect(slots[0].id).toBe('species-versatile');
    expect(slots[0].currentFeatId).toBe('old-feat');
  },
);

it('旧种族键同时存在时保持原读取顺序，包括显式空数组', () => {
  const character = state({
    speciesId: 'race-id',
    speciesSelections: {
      'species-versatile': [],
      versatile: ['old-feat'],
      多才多艺: ['older-feat'],
    },
  });
  expect(
    buildCharacterFeatSlots(character, { species, getClass: noClass })[0].currentFeatId,
  ).toBeUndefined();
});

it.each(['type:origin', 'custom-filter'])('结构化起源专长选择沿用原filter分类：%s', (filter) => {
  const slots = buildCharacterFeatSlots(state(), {
    getClass: noClass,
    species: {
      name: '结构化种族',
      traits: [
        {
          id: 'data-driven-choice',
          name: '原生选择',
          description: '',
          features: { originFeats: { numToChoose: 1, options: [], filter } },
        },
      ],
    },
  });
  expect(slots[0].id).toBe('species-data-driven-choice');
  expect(slots[0].allowedCategories).toEqual(
    filter === 'type:origin'
      ? ['Origin']
      : ['Origin', 'General', 'Fighting Style', 'Legacy', 'Epic Boon'],
  );
});

it.each([
  [[], ['General', 'Legacy']],
  [['Fighting Style'], ['Fighting Style']],
  [['Epic Boon'], ['Epic Boon']],
  [['Origin Feat'], ['Origin']],
])('职业槽位沿用原分类约束：%j', (options, expected) => {
  const slots = buildCharacterFeatSlots(
    state({ classes: [{ classId: 'class', source: 'PHB', level: 4, isMulticlass: false }] }),
    {
      getClass: () => ({ name: '职业', features: [feature('特性', 4, options)] }),
    },
  );
  expect(slots[0].allowedCategories).toEqual(expected);
});

it('5etools 战斗风格专长法条生成专长页专属槽位', () => {
  const parent = normalizeClass({
    name: '测试战士',
    ENG_name: 'Fixture Fighter',
    source: 'XPHB',
    classFeatures: ['战斗风格|Fixture Fighter|XPHB|1'],
  });
  defaultCatalog.registerMany([
    parent,
    {
      ...parent,
      id: 'fixture:fighting-style-feature',
      kind: 'classFeature',
      name: '战斗风格',
      englishName: 'Fighting Style',
      raw: {
        name: '战斗风格',
        ENG_name: 'Fighting Style',
        className: 'Fixture Fighter',
        classSource: 'XPHB',
        source: 'XPHB',
        level: 1,
        entries: ['你获得一项你选择的{@filter 战斗风格专长|feats|category=FS}。'],
      },
    },
  ]);
  const character = state({
    classes: [{ classId: parent.id, source: 'XPHB', level: 1, isMulticlass: false }],
  });
  const slots = buildCharacterFeatSlots(character, { getClass: getClassDefinition });
  expect(slots).toMatchObject([
    { classId: parent.id, allowedCategories: ['Fighting Style'], level: 1 },
  ]);
});

it('非专长选择不变成专长槽位，兼职按各自职业等级，旧职业选择仍可读回', () => {
  const character = state({
    classes: [
      { classId: 'first', source: 'PHB', level: 8, isMulticlass: false },
      { classId: 'second', source: 'PHB', level: 3, isMulticlass: true },
    ],
    classSelections: { 'cls:first:feat:专长:专长-choice': ['legacy-class-feat'] },
  });
  const slots = buildCharacterFeatSlots(character, {
    getClass: () => ({
      name: '职业',
      features: [
        feature('专长', 4),
        {
          name: '法术',
          level: 1,
          description: '',
          mechanics: { choices: [{ id: 'spell', type: 'spell', numToChoose: 1, options: [] }] },
        },
      ],
    }),
  });
  expect(slots.map((slot) => slot.id)).toEqual(['cls:first:feat:专长:专长-choice']);
  expect(slots[0].currentFeatId).toBe('legacy-class-feat');
});

it('源切换和等级回退后只重建槽位，不删除历史选择和逐级法术记录', () => {
  const character = state({
    classes: [{ classId: 'class', source: 'PHB', level: 3, isMulticlass: false }],
    featSelections: {
      'cls:class:feat:专长:专长-choice': { featId: 'saved-feat', spells: ['saved-spell'] },
    },
    spellsByLevel: {
      class: {
        4: {
          cantrips: [],
          spells: ['level-spell'],
          replacedSpell: 'old-spell',
          extra: { wizard_spellbook: ['book-spell'] },
        },
      },
    },
  });
  const before = JSON.stringify(character);
  expect(
    buildCharacterFeatSlots(character, {
      getClass: () => ({ name: '职业', features: [feature('专长', 4)] }),
    }),
  ).toEqual([]);
  expect(JSON.stringify(character)).toBe(before);
  expect(buildCharacterFeatSlots(character, { getClass: noClass })).toEqual([]);
  expect(JSON.stringify(character)).toBe(before);
});

it('保留职业内和兼职之间原有槽位顺序，避免改变逐槽属性计算顺序', () => {
  const slots = buildCharacterFeatSlots(
    state({
      classes: [
        { classId: 'first', source: 'PHB', level: 8, isMulticlass: false },
        { classId: 'second', source: 'PHB', level: 4, isMulticlass: true },
      ],
    }),
    { getClass: () => ({ name: '职业', features: [feature('四级', 4), feature('八级', 8)] }) },
  );
  expect(slots.map((slot) => slot.id)).toEqual([
    'cls:first:feat:四级:四级-choice',
    'cls:first:feat:八级:八级-choice',
    'cls:second:feat:四级:四级-choice',
  ]);
});

it('旧额外专长分类与背景快捷选择保留；没有来源时不凭残留生成槽位', () => {
  const character = state({
    originFeatId: 'old-origin',
    featSelections: { unknown: { featId: 'stale' } },
  });
  const slots = buildCharacterFeatSlots(character, {
    background: { name: '背景' },
    species: {
      name: '旧种族',
      traits: [{ id: 'bonus-feat', name: '额外专长', nameEn: 'Bonus Feat', description: '' }],
    },
    getClass: noClass,
  });
  expect(slots[0].currentFeatId).toBe('old-origin');
  expect(slots[1].allowedCategories).toEqual([
    'Origin',
    'General',
    'Fighting Style',
    'Legacy',
    'Epic Boon',
  ]);
  expect(buildCharacterFeatSlots(character, { getClass: noClass })).toEqual([]);
});

it('JSON往返后槽位身份、既有属性/法术选择及逐级替换记录不变', () => {
  const character = state({
    originFeatId: 'origin',
    featSelections: {
      'background-feat': {
        featId: 'origin',
        ability: 'int',
        spellList: 'Wizard',
        spells: ['chosen-spell'],
      },
    },
    spellsByLevel: {
      class: { 2: { cantrips: [], spells: ['new-spell'], replacedSpell: 'old-spell' } },
    },
  });
  const definitions = { background: { name: '背景' }, getClass: noClass };
  const saved = JSON.parse(JSON.stringify(character));
  expect(buildCharacterFeatSlots(saved, definitions)).toEqual(
    buildCharacterFeatSlots(character, definitions),
  );
  expect(saved).toEqual(character);
});

it('实际专长页读回原背景槽位并保留解绑入口，渲染不写角色记录', () => {
  const feat = normalizeFeat({
    name: '槽位页面专长',
    source: 'XPHB',
    category: 'O',
    entries: ['完整专长正文'],
  });
  const background = normalizeBackground({ name: '槽位页面背景', source: 'XPHB', entries: [] });
  defaultCatalog.registerMany([feat, background]);
  control.state = state({
    backgroundId: background.id,
    originFeatId: feat.id,
    featSelections: {
      'background-feat': { featId: feat.id, ability: 'wis', spells: ['existing-choice'] },
    },
  });
  const before = JSON.stringify(control.state);
  control.update.mockClear();
  const html = renderToStaticMarkup(<FeatsPage />);
  expect(html).toContain('背景专长 (Origin Feat)');
  expect(html).toContain('槽位页面专长');
  expect(html).toContain('完整专长正文');
  expect(html).toContain('起源专长解绑');
  expect(JSON.stringify(control.state)).toBe(before);
  expect(control.update).not.toHaveBeenCalled();
  expect(
    buildCharacterFeatSlots(control.state, {
      background: getBackgroundDefinition(control.state),
      getClass: getClassDefinition,
    })[0].currentFeatId,
  ).toBe(feat.id);
});

it('实际专长页按职业等级生成旧槽位，读取已有专长且不显示未来槽位', () => {
  const feat = normalizeFeat({ name: '职业页面专长', source: 'PHB', category: 'G', entries: [] });
  const parent = normalizeClass({
    name: '槽位页面职业',
    source: 'PHB',
    features: [feature('四级选择', 4), feature('八级选择', 8)],
  });
  defaultCatalog.registerMany([feat, parent]);
  control.state = state({
    classes: [{ classId: parent.id, source: 'PHB', level: 4, isMulticlass: false }],
    featSelections: { [`cls:${parent.id}:feat:四级选择:四级选择-choice`]: { featId: feat.id } },
  });
  const html = renderToStaticMarkup(<FeatsPage />);
  expect(html).toContain('四级选择 (专长选择)');
  expect(html).toContain('职业页面专长');
  expect(html).not.toContain('八级选择 (专长选择)');
});
