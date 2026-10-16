import { beforeAll, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { defaultCatalog } from '@/catalog/catalog';
import { makeEntryId } from '@/catalog/identity';
import { classContentParent } from '@/catalog/classIdentity';
import { normalizeClass, normalizeSubclass } from '@/source/fiveetools-cn/normalizers/class';
import { normalizeItem } from '@/source/fiveetools-cn/normalizers/item';
import { flattenEntries } from '@/source/fiveetools-cn/utils';
import { catalogEntryToClass } from '@/catalog/adapters/classes';
import { assembleCatalogClass } from '@/catalog/adapters/classAssembly';
import { applyClassFeatureMechanics } from '@/mechanics-overlay/classFeatures';
import { computeCombatStats } from '@/engine/combat';
import { computeAbilityScores } from '@/engine/ability';
import type { CatalogEntry } from '@/catalog/types';
import type { CharacterState } from '@/types/characterState';

const fixture = JSON.parse(
  readFileSync('src/source/__fixtures__/fiveetools-cn/barbarian-class.json', 'utf8'),
);
const originals = JSON.stringify(fixture);
const classes = new Map<string, CatalogEntry>();
let plateId: string;
let shieldId: string;
let monk: CatalogEntry;

beforeAll(() => {
  for (const raw of fixture.class) {
    const entry = normalizeClass(raw);
    classes.set(entry.source, entry);
    defaultCatalog.register(entry);
  }
  for (const raw of fixture.subclass) defaultCatalog.register(normalizeSubclass(raw));
  for (const kind of ['classFeature', 'subclassFeature'] as const) {
    for (const raw of fixture[kind]) {
      const parent = classContentParent(raw, true);
      defaultCatalog.register({
        id: makeEntryId({
          packId: '5etools-cn',
          kind,
          source: raw.source,
          name: raw.ENG_name || raw.name,
          parent,
          level: raw.level,
        }),
        kind,
        name: raw.name,
        englishName: raw.ENG_name,
        source: raw.source,
        edition: raw.source === 'XPHB' ? '2024' : '2014',
        sourcePackId: '5etools-cn',
        parent,
        description: flattenEntries(raw.entries),
        raw,
      });
    }
  }
  monk = normalizeClass({
    name: '武僧',
    ENG_name: 'Monk',
    source: 'PHB',
    edition: 'classic',
    hd: { faces: 8 },
    classFeature: [
      { name: '无甲防御', nameEn: 'Unarmored Defense', description: '测试原文', level: 1 },
    ],
  });
  defaultCatalog.register(monk);
  const plate = normalizeItem({
    name: '回归板甲',
    ENG_name: 'Regression Plate',
    source: 'XPHB',
    type: 'HA',
    ac: 18,
  });
  const shield = normalizeItem({
    name: '回归盾牌',
    ENG_name: 'Regression Shield',
    source: 'XPHB',
    type: 'S',
    ac: 2,
  });
  defaultCatalog.register(plate);
  defaultCatalog.register(shield);
  plateId = plate.id;
  shieldId = shield.id;
});

function character(entry: CatalogEntry, level = 1): CharacterState {
  return {
    id: 'class-content-regression',
    name: '回归角色',
    playerName: '',
    classes: [{ classId: entry.id, source: entry.source, level, isMulticlass: false }],
    baseAbilityScores: { str: 20, dex: 20, con: 20, int: 10, wis: 20, cha: 10 },
    backgroundAbilityBonuses: {},
    selectedFeats: [],
    selectedSkills: [],
    expertiseSkills: [],
    selectedLanguages: [],
    equipmentChoiceMode: 'package',
    equipmentIds: [],
    inventoryEntries: [],
    equippedWeaponIds: [],
    attunedItemIds: [],
    resourceUsage: {},
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    deathSaves: { success: 0, failure: 0 },
    conditions: [],
    preparedSpellIds: [],
    cantripIds: [],
    knownSpellIds: [],
    spellbookIds: [],
    spellSlotUsage: {},
  };
}
function equip(state: CharacterState, armor: boolean, shield: boolean) {
  state.inventoryEntries = [
    ...(armor
      ? [
          {
            id: 'plate-instance',
            itemId: plateId,
            name: '回归板甲',
            quantity: 1,
            category: 'armor',
            equipped: true,
          },
        ]
      : []),
    ...(shield
      ? [
          {
            id: 'shield-instance',
            itemId: shieldId,
            name: '回归盾牌',
            quantity: 1,
            category: 'shield',
            equipped: true,
          },
        ]
      : []),
  ];
  state.equippedArmorId = armor ? 'plate-instance' : undefined;
  state.equippedShieldId = shield ? 'shield-instance' : undefined;
}

it.each([
  { source: 'PHB', count: 25 },
  { source: 'XPHB', count: 26 },
])('真实 $source 职业保留全部 $count 项特性、原文、来源和原始raw', ({ source, count }) => {
  const entry = classes.get(source)!;
  const raw = fixture.class.find((c: any) => c.source === source);
  expect(entry.raw).toBe(raw);
  const assembled = assembleCatalogClass(entry, defaultCatalog);
  const result = catalogEntryToClass(entry);
  expect(result.features).toHaveLength(count);
  expect(
    result.features.map(({ name, nameEn, level, description, source }) => ({
      name,
      nameEn,
      level,
      description,
      source,
    })),
  ).toEqual(
    assembled.features.map(({ name, nameEn, level, description, source }) => ({
      name,
      nameEn,
      level,
      description,
      source,
    })),
  );
  expect(result.features.some((f) => f.nameEn === 'Rage')).toBe(true);
  expect(result.features.find((f) => f.nameEn === 'Primal Champion')?.name).toBe('原初斗士');
  expect(JSON.stringify(fixture)).toBe(originals);
  expect(entry.raw).not.toHaveProperty('features');
});

it('公共引用优先于旧格式的残留特性数组；缺失引用不生成占位特性', () => {
  const base = classes.get('XPHB')!;
  const residual = { ...base, raw: { ...base.raw, features: [{ name: '旧占位', level: 1 }] } };
  expect(catalogEntryToClass(residual).features).toHaveLength(26);
  const missing = { ...base, raw: { ...base.raw, classFeatures: ['不存在|Barbarian|XPHB|1'] } };
  expect(catalogEntryToClass(missing).features).toEqual([]);
  expect(assembleCatalogClass(missing, defaultCatalog).referenceFailures).toHaveLength(1);
});

it.each([
  { source: 'AUDIT', edition: '2024', sourcePackId: 'homebrew-audit' },
  { source: 'XPHB', edition: '2024', sourcePackId: 'homebrew-audit' },
  { source: 'PHB', edition: '2024', sourcePackId: '5etools-cn' },
])('计算补丁不会按同名跨来源或版本套用：%j', (identity) => {
  const native = {
    name: '无甲防御',
    nameEn: 'Unarmored Defense',
    description: '原生原文',
    level: 1,
  };
  const entry = { ...classes.get('XPHB')!, ...identity } as CatalogEntry;
  const result = applyClassFeatureMechanics(entry, [native]);
  expect(result).toEqual([native]);
  expect(result[0]).not.toHaveProperty('mechanics');
});

it('保留无公共引用的自定义内嵌特性，兼容入口不改写用户内容', () => {
  const feature = {
    name: '用户特性',
    nameEn: 'User Feature',
    level: 1,
    description: '用户保留的完整正文',
    mechanics: { acBonus: 1 },
  };
  const raw = {
    name: '自定义职业',
    ENG_name: 'Custom Class',
    source: 'USER',
    classFeatures: [],
    features: [feature],
  };
  const before = JSON.stringify(raw);
  const entry = normalizeClass(raw, 'homebrew-user');
  expect(catalogEntryToClass(entry).features).toEqual([feature]);
  expect(entry.raw).toBe(raw);
  expect(JSON.stringify(raw)).toBe(before);
});

it('同名职业的显式施法属性和类型不被本地模板覆盖，缺失信息不按名称猜测', () => {
  const raw = {
    name: '同名法师',
    ENG_name: 'Wizard',
    source: 'XPHB',
    edition: 'one',
    spellcastingType: 'half',
    spellcastingAbility: 'wis',
    classFeatures: [],
  };
  const entry = normalizeClass(raw, 'homebrew-audit');
  expect(entry.raw).toBe(raw);
  expect(catalogEntryToClass(entry)).toMatchObject({
    spellcastingType: 'half',
    spellcastingAbility: 'wis',
  });
  const unknown = normalizeClass({
    name: '法师',
    ENG_name: 'Wizard',
    source: 'XPHB',
    edition: 'one',
    classFeatures: [],
  });
  expect(catalogEntryToClass(unknown).spellcastingType).toBeUndefined();
  expect(catalogEntryToClass(unknown).spellcastingAbility).toBeUndefined();
});

it('只补匹配等级和出处的现有特性，并保留原生显式机制', () => {
  const entry = classes.get('XPHB')!;
  const native = {
    name: '无甲防御',
    nameEn: 'Unarmored Defense',
    description: '原文',
    level: 1,
    source: 'XPHB',
    mechanics: {
      acCalculation: {
        base: 12,
        modifiers: ['wis'],
        canUseShield: false,
        condition: 'custom-condition',
      },
    },
  };
  const before = JSON.stringify(native);
  expect(applyClassFeatureMechanics(entry, [native])[0].mechanics).toEqual(native.mechanics);
  expect(JSON.stringify(native)).toBe(before);
  for (const wrong of [
    { ...native, source: 'PHB', mechanics: undefined },
    { ...native, level: 2, mechanics: undefined },
  ]) {
    expect(applyClassFeatureMechanics(entry, [wrong])[0].mechanics).toBeUndefined();
  }
  expect(applyClassFeatureMechanics(entry, [])).toEqual([]);
  const missingSource = { ...entry, raw: { ...entry.raw, source: undefined } };
  const unstructured = { ...native, mechanics: undefined };
  expect(applyClassFeatureMechanics(missingSource, [unstructured])[0].mechanics).toBeUndefined();
});

it.each([
  { armor: false, shield: false, ac: 20 },
  { armor: false, shield: true, ac: 22 },
  { armor: true, shield: false, ac: 18 },
  { armor: true, shield: true, ac: 20 },
])('真实野蛮人着装矩阵 %j', ({ armor, shield, ac }) => {
  const state = character(classes.get('XPHB')!);
  // 旧手动状态不能使穿甲角色绕过真实着装条件。
  state.activeConditions = ['未着装护甲'];
  equip(state, armor, shield);
  const result = computeCombatStats(state);
  expect(result.ac).toBe(ac);
  expect(result.acTrace.some((t) => t.includes('替代护甲计算 [无甲防御]'))).toBe(!armor);
});

it.each([
  { armor: false, shield: false, ac: 20 },
  { armor: false, shield: true, ac: 17 },
  { armor: true, shield: false, ac: 18 },
])('武僧着装矩阵 %j', ({ armor, shield, ac }) => {
  const state = character(monk);
  equip(state, armor, shield);
  const result = computeCombatStats(state);
  expect(result.ac).toBe(ac);
  expect(result.acTrace.some((t) => t.includes('替代护甲计算 [无甲防御]'))).toBe(!armor && !shield);
});

it.each([
  { source: 'PHB', cap: 24 },
  { source: 'XPHB', cap: 25 },
])('按真实 $source 文本保留20级属性上限 $cap，且每项属性只增加一次4点', ({ source, cap }) => {
  const entry = classes.get(source)!;
  const state = character(entry, 20);
  const result = computeAbilityScores(state);
  expect(result.breakdown.class.str).toBe(4);
  expect(result.breakdown.class.con).toBe(4);
  expect(result.scores.str).toBe(24);
  state.baseAbilityScores.str = 23;
  expect(computeAbilityScores(state).scores.str).toBe(cap);
  const below = character(entry, 19);
  expect(computeAbilityScores(below).breakdown.class.str).toBe(0);
});
