import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { defaultCatalog } from '@/catalog/catalog';
import { createBuilderChoices } from '@/catalog/builderChoices';
import { normalizeRace } from '@/source/fiveetools-cn/normalizers/race';
import { normalizeClass } from '@/source/fiveetools-cn/normalizers/class';
import { normalizeSpell } from '@/source/fiveetools-cn/normalizers/spell';
import { getSpeciesSpellChoiceSlots } from '../speciesSpellChoiceSlots';
import { getSpeciesSpellAbility } from '../speciesSpellSelections';
import { getInnateSpells } from '../spellcasting';
import { exportToJSON, importFromJSON } from '../importExport';
import type { CharacterState } from '@/types/characterState';

const control = vi.hoisted(() => ({
  state: {} as CharacterState,
  sheet: false,
  classId: '',
  buttons: [] as any[],
  sheetProps: undefined as any,
}));
vi.mock('react', async (load) => ({
  ...(await load<typeof import('react')>()),
  useState: (initial: any) => [
    initial === null ? control.classId : control.sheet && initial === 0 ? 1 : initial,
    () => {},
  ],
}));
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams({ id: control.state.id }),
  useRouter: () => ({ push() {} }),
}));
vi.mock('@/platform/useBuilderChoices', () => ({
  useBuilderChoices: () => createBuilderChoices(control.state),
}));
vi.mock('@/platform/CatalogProvider', () => ({
  useCatalog: () => ({ status: 'ready', stats: {} }),
}));
vi.mock('@/store/characterStore', () => ({
  useCharacterStore: () => ({
    characters: { [control.state.id]: control.state },
    updateActiveCharacter: (patch: any) => {
      control.state = { ...control.state, ...patch };
    },
  }),
}));
vi.mock('@/components/GlassNav', () => ({ default: () => null }));
vi.mock('@/components/PillButton', () => ({
  default: (props: any) => {
    control.buttons.push(props);
    return <button>{props.children}</button>;
  },
}));
vi.mock('@/app/sheet/[id]/tabs/SpellsTab', () => ({
  default: (props: any) => {
    control.sheetProps = props;
    return <div>{props.cantripDetails.map((spell: any) => spell.name).join('；')}</div>;
  },
}));
import SpellList from '@/app/builder/spells/SpellList';
import CharacterSheet from '@/app/sheet/view/CharacterSheet';

const race = normalizeRace(
  JSON.parse(readFileSync('src/source/__fixtures__/fiveetools-cn/astral-elf-release.json', 'utf8'))
    .raw,
);
const caster = normalizeClass({
  name: '牧师',
  ENG_name: 'Cleric',
  source: 'PHB',
  casterProgression: 'full',
  spellcastingAbility: 'wis',
  cantripProgression: Array(20).fill(1),
  preparedSpellsProgression: Array(20).fill(1),
  classTableGroups: [{ rowsSpellProgression: Array(20).fill([2, 0]) }],
});
const spell = (name: string, level = 0) =>
  normalizeSpell({
    name,
    source: 'PHB',
    level,
    _classGrants: [{ name: '牧师', source: 'PHB' }],
    entries: [],
  });
const light = spell('光亮术');
const others = [spell('舞光术'), spell('圣火术')];
const ordinary = spell('职业选择样本');
const manual = spell('手动准备样本', 1);
const text = (node: any): string =>
  typeof node === 'string'
    ? node
    : Array.isArray(node)
      ? node.map(text).join('')
      : React.isValidElement(node)
        ? text((node.props as any).children)
        : '';
function renderBuilder() {
  control.sheet = false;
  control.buttons = [];
  return renderToStaticMarkup(
    <SpellList
      character={control.state}
      casterLevel={1}
      spellSlots={{ 1: 2 }}
      cantripsKnown={1}
      spellsPrepared={1}
    />,
  );
}
function renderSheet() {
  control.sheet = true;
  return renderToStaticMarkup(<CharacterSheet />);
}
beforeEach(() => {
  defaultCatalog.registerMany([race, caster, light, ...others, ordinary, manual]);
  control.classId = caster.id;
  control.sheet = false;
  control.state = {
    id: 'release-chain',
    name: '发布验收',
    playerName: '',
    speciesId: race.id,
    classes: [{ classId: caster.id, level: 1, source: 'PHB', isMulticlass: false }],
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

it('真实种族选择—职业选法保存—来源取消—JSON重开—实际卡面装配不残留来源法术', async () => {
  const slot = getSpeciesSpellChoiceSlots(control.state)[0];
  expect(slot.optionIds).toContain(light.id);
  control.state.speciesSelections = { [slot.key]: [light.id] };
  renderBuilder();
  control.buttons.find((button) => text(button.children).includes(ordinary.name)).onClick();
  expect(control.state.cantripIds).toEqual([ordinary.id]);
  expect(renderSheet()).toContain(light.name);
  control.state.speciesSelections[slot.key] = [];
  control.state = await importFromJSON(exportToJSON(control.state));
  expect(renderSheet()).not.toContain(light.name);
  expect(control.sheetProps.cantripDetails.map((entry: any) => entry.id)).toEqual([ordinary.id]);
});

it('独立职业选择同一法术时，撤销种族来源仍保留职业法术；渲染不写存档', () => {
  const slot = getSpeciesSpellChoiceSlots(control.state)[0];
  control.state.speciesSelections = { [slot.key]: [] };
  control.state.cantripIds = [light.id];
  control.state.spellsByLevel = { [caster.id]: { 1: { cantrips: [light.id], spells: [] } } };
  const snapshot = JSON.stringify(control.state);
  expect(renderSheet()).toContain(light.name);
  expect(JSON.stringify(control.state)).toBe(snapshot);
});

it('旧聚合记录和正式卡手动准备保留，不猜测来源而删除用户数据', () => {
  control.state.cantripIds = [light.id];
  control.state.preparedSpellIds = [manual.id];
  const snapshot = JSON.stringify(control.state);
  renderSheet();
  expect(control.sheetProps.cantripDetails.map((entry: any) => entry.id)).toEqual([light.id]);
  expect(control.sheetProps.spellDetails.map((entry: any) => entry.id)).toEqual([manual.id]);
  expect(JSON.stringify(control.state)).toBe(snapshot);
});

it('无职业施法属性时不显示伪造的概览 DC，仍尊重手动覆盖', () => {
  control.state.classes = [];
  control.state.cantripIds = [light.id];
  renderSheet();
  expect(control.sheetProps.spellcasting.spellDC).toBeUndefined();
  expect(control.sheetProps.spellcasting.spellAttack).toBeUndefined();

  control.state.manualOverrides = { spellSaveDc: 13, spellAttackBonus: 5 };
  renderSheet();
  expect(control.sheetProps.spellcasting.spellDC).toBe(13);
  expect(control.sheetProps.spellcasting.spellAttack).toBe(5);

  control.state.classes = [{ classId: caster.id, level: 1, source: 'PHB', isMulticlass: false }];
  control.state.manualOverrides = undefined;
  renderSheet();
  expect(control.sheetProps.spellcasting.spellDC).toBe(13);
  expect(control.sheetProps.spellcasting.spellAttack).toBe(5);
});

it('真实种族属性在来源页读法、授予描述与实际卡面一致，清空不复活旧镜像', async () => {
  const slot = getSpeciesSpellChoiceSlots(control.state)[0];
  const traitKey = slot.key.replace(/:spell-\d+$/, '');
  control.state.speciesSelections = {
    [slot.key]: [light.id],
    [`${traitKey}:ability`]: ['wis'],
    [`sp:${race.id}:trait:innate-spellcasting-ability`]: ['cha'],
    'sp:previous:trait:other:ability': ['int'],
  };
  expect(
    getSpeciesSpellAbility(control.state.speciesSelections, race.id, undefined, traitKey),
  ).toBe('wis');
  expect(getInnateSpells(control.state)[0].source).toContain('感知');
  renderSheet();
  expect(control.sheetProps.spellSourceMap[light.id]).toContain('感知');
  control.state.speciesSelections[`${traitKey}:ability`] = [];
  control.state = await importFromJSON(exportToJSON(control.state));
  expect(
    getSpeciesSpellAbility(control.state.speciesSelections, race.id, undefined, traitKey),
  ).toBe('');
  expect(getInnateSpells(control.state)[0].source).toBe('种族');
  renderSheet();
  expect(control.sheetProps.spellSourceMap[light.id]).toBe('种族');
});

it('不把其他特质或旧种族的属性当作当前施法属性，保留当前种族旧键兼容', () => {
  const selections = {
    'sp:old:trait:magic:ability': ['int'],
    'sp:current:trait:other:ability': ['cha'],
  };
  expect(getSpeciesSpellAbility(selections, 'current', undefined, 'magic')).toBe('');
  const legacy = { ...selections, 'sp:current:trait:innate-spellcasting-ability': ['wis'] };
  expect(getSpeciesSpellAbility(legacy, 'current', undefined, 'magic')).toBe('wis');
  expect(
    getSpeciesSpellAbility(
      { ...legacy, 'sp:current:sub:lineage:ability': ['int'] },
      'current',
      'lineage',
      'magic',
    ),
  ).toBe('int');
});
