import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { defaultCatalog } from '@/catalog/catalog';
import { normalizeClass, normalizeSubclass } from '@/source/fiveetools-cn/normalizers/class';
import { normalizeSpell } from '@/source/fiveetools-cn/normalizers/spell';
import { createBuilderChoices } from '@/catalog/builderChoices';
import { getNativeSubclassSpellPlans, getNativeSubclassSpellGrants } from '../nativeSubclassSpells';
import {
  computeSpellProgression,
  deriveCharacterSpellSelection,
  getInnateSpells,
  buildSpellSourceMap,
} from '../spellcasting';
import { exportToJSON, importFromJSON } from '../importExport';
import { getSpellDefinition } from '../characterData';

const control = vi.hoisted(() => ({ state: {} as any, activeClassId: '', buttons: [] as any[] }));
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>();
  return {
    ...actual,
    useState: (initial: any) => [
      initial === null
        ? control.activeClassId
        : typeof initial === 'function'
          ? initial()
          : initial,
      () => {},
    ],
  };
});
vi.mock('@/platform/useBuilderChoices', () => ({
  useBuilderChoices: () => createBuilderChoices(control.state),
}));
vi.mock('@/platform/CatalogProvider', () => ({ useCatalog: () => ({ status: 'ready' }) }));
vi.mock('@/store/characterStore', () => ({
  useCharacterStore: () => ({
    updateActiveCharacter(patch: any) {
      control.state = { ...control.state, ...patch };
    },
  }),
}));
vi.mock('@/components/PillButton', () => ({
  default: (props: any) => {
    control.buttons.push(props);
    return <button disabled={props.disabled}>{props.children}</button>;
  },
}));
import SpellList from '@/app/builder/spells/SpellList';
import SpellsTab from '@/app/sheet/[id]/tabs/SpellsTab';

const fixture = JSON.parse(
  readFileSync('src/source/__fixtures__/fiveetools-cn/spell-grants.json', 'utf8'),
);
const raw = fixture.entries.find((row: any) => row.raw.ENG_name === 'Nature Domain').raw;
const parent = normalizeClass({
  name: '牧师',
  ENG_name: 'Cleric',
  source: 'PHB',
  casterProgression: 'full',
  spellcastingAbility: 'wis',
  preparedSpellsProgression: Array(20).fill(2),
  cantripProgression: Array(20).fill(1),
  classTableGroups: [{ rowsSpellProgression: Array(20).fill([2, 0]) }],
});
const child = normalizeSubclass({
  ...raw,
  className: '牧师',
  classSource: 'PHB',
  shortName: '自然领域',
  subclassFeatures: ['领域入门|牧师|PHB|自然领域|PHB|1'],
});
const feature = {
  id: 'test:nature:entry',
  kind: 'subclassFeature' as const,
  name: '领域入门',
  source: 'PHB',
  sourcePackId: '5etools-cn',
  edition: '2014' as const,
  raw: {
    name: '领域入门',
    source: 'PHB',
    className: '牧师',
    classSource: 'PHB',
    subclassShortName: '自然领域',
    subclassSource: 'PHB',
    level: 1,
    entries: [],
  },
};
const makeSpell = (name: string, level = 0, classes = ['德鲁伊']) =>
  normalizeSpell({ name, source: 'PHB', level, classes, entries: ['样本正文'] });
const first = makeSpell('领域自选戏法甲');
const second = makeSpell('领域自选戏法乙');
const wrong = makeSpell('其他职业戏法', 0, ['术士']);
const fixed = [makeSpell('化兽为友', 1), makeSpell('动物交谈', 1)];
const plainText = (value: any): string =>
  typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : Array.isArray(value)
      ? value.map(plainText).join('')
      : React.isValidElement(value)
        ? plainText((value.props as any).children)
        : '';
const renderBuilder = () => {
  control.buttons = [];
  return renderToStaticMarkup(
    <SpellList
      character={control.state}
      casterLevel={1}
      spellSlots={{ 1: 2 }}
      cantripsKnown={1}
      spellsPrepared={2}
    />,
  );
};
const choice = () =>
  computeSpellProgression(control.state, parent.id)
    .flatMap((step) => step.extraChoices)
    .find((entry) => entry.nativeRule)!;

beforeEach(() => {
  defaultCatalog.registerMany([parent, child, feature, first, second, wrong, ...fixed]);
  control.activeClassId = parent.id;
  control.state = {
    id: 'native-nature',
    name: '自然领域测试',
    playerName: '',
    classes: [
      { classId: parent.id, source: 'PHB', subclassId: child.id, level: 1, isMulticlass: false },
    ],
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 16, cha: 10 },
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
    spellsByLevel: {},
  };
});

it('真实自然领域原生选择接入实际逐级额外槽位，不增加基础名额', () => {
  const slot = choice();
  expect(slot).toBeDefined();
  expect(slot.numToChoose).toBe(1);
  expect(slot.id).toContain(child.id);
  const step = computeSpellProgression(control.state, parent.id)[0];
  expect(step.newCantrips).toBe(1);
  expect(step.newSpells).toBe(2);
  const html = renderBuilder();
  expect(html).toContain('自然领域：额外戏法');
  expect(control.buttons.some((button) => plainText(button.children).includes(first.name))).toBe(
    true,
  );
  expect(control.buttons.some((button) => plainText(button.children).includes(wrong.name))).toBe(
    false,
  );
  expect(deriveCharacterSpellSelection(control.state).cantripIds).toEqual([]);
  expect(getNativeSubclassSpellGrants(control.state).map((grant) => grant.spellId)).toEqual(
    fixed.map((entry) => entry.id),
  );
});

it('点击实际选择控件按原extra字段保存，JSON重开后卡面读回且自动授予不混入聚合ID', async () => {
  renderBuilder();
  const button = control.buttons.find((entry) => plainText(entry.children).includes(first.name));
  expect(button.disabled).toBe(false);
  button.onClick();
  const slot = choice();
  expect(control.state.spellsByLevel[parent.id][1].extra[slot.id]).toEqual([first.id]);
  expect(control.state.cantripIds).toEqual([]);
  expect(control.state.preparedSpellIds).toEqual([]);
  control.state = await importFromJSON(exportToJSON(control.state));
  expect(deriveCharacterSpellSelection(control.state).cantripIds).toEqual([first.id]);
  expect(renderBuilder()).toContain(first.name);
  const before = JSON.stringify(control.state);
  const grants = getInnateSpells(control.state);
  const sheet = renderToStaticMarkup(
    <SpellsTab
      character={control.state}
      spellcasting={{ spellSlots: { 1: 2 }, cantripsKnown: 2, spellsPrepared: 4 }}
      primaryClass={undefined}
      cantripDetails={[getSpellDefinition(first.id)]}
      spellDetails={fixed.map((entry) => getSpellDefinition(entry.id))}
      spellbookDetails={[]}
      spellSourceMap={buildSpellSourceMap(grants, [], '职业')}
      spellSlotUsage={{}}
      updateActiveCharacter={() => {}}
      router={{ push() {} }}
      id={control.state.id}
    />,
  );
  expect(sheet).toContain(first.name);
  expect(sheet).toContain('子职业: 自然领域');
  expect(JSON.stringify(control.state)).toBe(before);
});

it('超额旧记录可通过正常点击收敛到限额；不允许不合格或错误等级的保存ID直接授予', () => {
  const slot = choice();
  control.state.spellsByLevel = {
    [parent.id]: { 1: { cantrips: [], spells: [], extra: { [slot.id]: ['old-a', 'old-b'] } } },
  };
  renderBuilder();
  control.buttons.find((entry) => plainText(entry.children).includes(first.name)).onClick();
  expect(control.state.spellsByLevel[parent.id][1].extra[slot.id]).toEqual([first.id]);
  control.state.spellsByLevel[parent.id][1].extra[slot.id] = [wrong.id];
  expect(renderBuilder()).toContain('已选 0 / 1');
  expect(deriveCharacterSpellSelection(control.state).cantripIds).toEqual([]);
  control.state.spellsByLevel[parent.id] = {
    2: { cantrips: [], spells: [], extra: { [slot.id]: [first.id] } },
  };
  control.state.classes[0].level = 2;
  expect(deriveCharacterSpellSelection(control.state).cantripIds).toEqual([]);
});

it('不合格原生记录不干扰普通职业候选，也不删除原始记录', () => {
  const ordinary = makeSpell('普通牧师戏法', 0, ['牧师']);
  defaultCatalog.register(ordinary);
  const slot = choice();
  control.state.spellsByLevel = {
    [parent.id]: { 1: { cantrips: [], spells: [], extra: { [slot.id]: [ordinary.id] } } },
  };
  renderBuilder();
  const button = control.buttons.find((entry) => plainText(entry.children).includes(ordinary.name));
  expect(button.disabled).toBe(false);
  expect(deriveCharacterSpellSelection(control.state).cantripIds).toEqual([]);
  expect(control.state.spellsByLevel[parent.id][1].extra[slot.id]).toEqual([ordinary.id]);
});

it('子职业移除、换源或等级回退撤销新来源效果，不删除手选与历史extra', () => {
  const slot = choice();
  control.state.spellsByLevel = {
    [parent.id]: {
      1: { cantrips: ['manual-cantrip'], spells: [], extra: { [slot.id]: [first.id] } },
    },
  };
  expect(deriveCharacterSpellSelection(control.state).cantripIds).toEqual([
    'manual-cantrip',
    first.id,
  ]);
  const saved = JSON.stringify(control.state.spellsByLevel);
  delete control.state.classes[0].subclassId;
  expect(deriveCharacterSpellSelection(control.state).cantripIds).toEqual(['manual-cantrip']);
  expect(JSON.stringify(control.state.spellsByLevel)).toBe(saved);
  control.state.classes[0].subclassId = child.id;
  control.state.classes[0].source = 'XPHB';
  expect(getNativeSubclassSpellPlans(control.state).plans).toEqual([]);
  control.state.classes[0].source = 'PHB';
  control.state.classes[0].level = 0;
  expect(getNativeSubclassSpellPlans(control.state).plans).toEqual([]);
});

it('已有成熟子职业选法机制仍独占界面，不叠加原生第二套选择器', () => {
  defaultCatalog.register({
    ...feature,
    raw: {
      ...feature.raw,
      mechanics: {
        choices: [
          { id: 'mature-choice', type: 'spell', numToChoose: 1, filter: 'level:0;class:druid' },
        ],
      },
    },
  });
  expect(getNativeSubclassSpellPlans(control.state).plans).toEqual([]);
  const slots = computeSpellProgression(control.state, parent.id).flatMap(
    (step) => step.extraChoices,
  );
  expect(slots.map((entry) => entry.id)).toEqual(['mature-choice']);
});

it('来源白名单约束新候选，但不删已经保存的完整身份选择', () => {
  const slot = choice();
  control.state.spellsByLevel = {
    [parent.id]: { 1: { cantrips: [], spells: [], extra: { [slot.id]: [first.id] } } },
  };
  control.state.sourceSelection = {
    mode: 'selected',
    books: [{ sourcePackId: '5etools-cn', source: 'DMG' }],
  };
  renderBuilder();
  expect(control.buttons.some((button) => plainText(button.children).includes(first.name))).toBe(
    false,
  );
  expect(deriveCharacterSpellSelection(control.state).cantripIds).toEqual([first.id]);
  expect(control.state.spellsByLevel[parent.id][1].extra[slot.id]).toEqual([first.id]);
});

it('由UID确认的子职业解锁等级决定存放位置，等级回退后不读取未来记录', () => {
  defaultCatalog.register(
    normalizeSubclass({ ...child.raw, subclassFeatures: ['领域入门|牧师|PHB|自然领域|PHB|3'] }),
  );
  defaultCatalog.register({ ...feature, raw: { ...feature.raw, level: 3 } });
  control.state.classes[0].level = 2;
  expect(getNativeSubclassSpellPlans(control.state).plans).toEqual([]);
  control.state.classes[0].level = 3;
  const steps = computeSpellProgression(control.state, parent.id);
  const entry = steps.find((step) => step.extraChoices.some((choice) => choice.nativeRule))!;
  expect(entry.level).toBe(3);
  const slot = entry.extraChoices.find((choice) => choice.nativeRule)!;
  control.state.spellsByLevel = {
    [parent.id]: { 3: { cantrips: [], spells: [], extra: { [slot.id]: [first.id] } } },
  };
  expect(deriveCharacterSpellSelection(control.state).cantripIds).toEqual([first.id]);
  control.state.classes[0].level = 2;
  expect(deriveCharacterSpellSelection(control.state).cantripIds).toEqual([]);
  expect(control.state.spellsByLevel[parent.id][3].extra[slot.id]).toEqual([first.id]);
});

it('未支持的多块、学派或资源条件不通过截断解析扩大选择', () => {
  for (const additionalSpells of [
    [...raw.additionalSpells, ...raw.additionalSpells],
    [{ known: { 1: [{ choose: 'level=0|school=N' }] } }],
    [{ resourceName: '待确认', known: { 1: [{ choose: 'level=0|class=德鲁伊' }] } }],
  ]) {
    defaultCatalog.register({ ...child, raw: { ...child.raw, additionalSpells } });
    const result = getNativeSubclassSpellPlans(control.state);
    expect(result.plans).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
    expect(
      computeSpellProgression(control.state, parent.id)
        .flatMap((step) => step.extraChoices)
        .some((choice) => choice.nativeRule),
    ).toBe(false);
  }
});

it('选择可与独立普通选法来源共存；旧子职业固定法术机制及逐级替换保留', () => {
  const slot = choice();
  control.state.spellsByLevel = {
    [parent.id]: { 1: { cantrips: [first.id], spells: [], extra: { [slot.id]: [] } } },
  };
  renderBuilder();
  const candidateButtons = control.buttons.filter((button) =>
    plainText(button.children).includes(first.name),
  );
  expect(candidateButtons).toHaveLength(1);
  expect(candidateButtons[0].disabled).toBe(false);
  candidateButtons[0].onClick();
  expect(deriveCharacterSpellSelection(control.state).cantripIds).toEqual([first.id]);
  defaultCatalog.register({
    ...feature,
    raw: {
      ...feature.raw,
      mechanics: { spells: [{ spells: [fixed[0].id], prepared: true, freeCastsPerLongRest: 1 }] },
    },
  });
  const grants = getInnateSpells(control.state).filter((grant) => grant.spellId === fixed[0].id);
  expect(grants).toHaveLength(1);
  expect(grants[0].freeCastsPerLongRest).toBe(1);
  control.state.classes[0].level = 2;
  control.state.spellsByLevel[parent.id][1].cantrips = [];
  control.state.spellsByLevel[parent.id][2] = {
    cantrips: [second.id],
    spells: [],
    replacedCantrip: first.id,
  };
  expect(deriveCharacterSpellSelection(control.state).cantripIds).toEqual([second.id]);
});

it('兼职放在首职业之后或调换顺序，仍保存到所属职业原键', () => {
  const other = normalizeClass({ name: '另一个职业', source: 'PHB' });
  defaultCatalog.register(other);
  control.state.classes.unshift({
    classId: other.id,
    source: 'PHB',
    level: 5,
    isMulticlass: false,
  });
  renderBuilder();
  control.buttons.find((entry) => plainText(entry.children).includes(first.name)).onClick();
  expect(control.state.spellsByLevel[other.id]).toBeUndefined();
  expect(control.state.spellsByLevel[parent.id][1].extra[choice().id]).toEqual([first.id]);
  control.state.classes.reverse();
  expect(
    getNativeSubclassSpellGrants(control.state).some(
      (grant) => grant.classId === parent.id && grant.spellId === first.id,
    ),
  ).toBe(true);
});

it('原生count=2沿用多选限额，不提前完成或覆盖其他环阶记录', () => {
  defaultCatalog.register({
    ...child,
    raw: {
      ...child.raw,
      additionalSpells: [
        {
          known: { 1: [{ choose: 'level=0|class=德鲁伊', count: 2 }] },
        },
      ],
    },
  });
  control.state.spellsByLevel = {
    [parent.id]: { 1: { cantrips: [], spells: ['ordinary-saved'] } },
  };
  renderBuilder();
  control.buttons.find((entry) => plainText(entry.children).includes(first.name)).onClick();
  renderBuilder();
  control.buttons.find((entry) => plainText(entry.children).includes(second.name)).onClick();
  const slot = choice();
  expect(slot.numToChoose).toBe(2);
  expect(control.state.spellsByLevel[parent.id][1].extra[slot.id]).toEqual([first.id, second.id]);
  expect(control.state.spellsByLevel[parent.id][1].spells).toEqual(['ordinary-saved']);
  expect(deriveCharacterSpellSelection(control.state).cantripIds).toEqual([first.id, second.id]);
});
