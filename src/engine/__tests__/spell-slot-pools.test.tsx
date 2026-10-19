import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { defaultCatalog } from '@/catalog/catalog';
import { normalizeClass } from '@/source/fiveetools-cn/normalizers/class';
import type { CharacterState } from '@/types/characterState';
import { computeSpellcasting } from '../spellcasting';
import { getSpellSlotResources } from '../spellSlotUsage';
import { exportToJSON, importFromJSON } from '../importExport';
import { exportToFVTT } from '../fvttExport';
import SpellSlotResources from '@/app/sheet/[id]/tabs/SpellSlotResources';

const buttons = vi.hoisted(() => [] as any[]);
vi.mock('@/components/PillButton', () => ({
  default: (props: any) => {
    buttons.push(props);
    return <button disabled={props.disabled}>{props.children}</button>;
  },
}));

// 原生表格形态：PHB 使用 filter 环阶，XPHB 使用数值环阶。
function setup(source: 'PHB' | 'XPHB') {
  const pact = normalizeClass({
    name: '魔契师',
    ENG_name: 'Warlock',
    source,
    casterProgression: 'pact',
    spellcastingAbility: 'cha',
    classFeatures: [],
    classTableGroups: [
      {
        colLabels: ['法术位', '法术位环阶'],
        rows: [
          [1, source === 'PHB' ? '{@filter 1环|spells|level=1|class=魔契师}' : 1],
          [2, source === 'PHB' ? '{@filter 1环|spells|level=1|class=魔契师}' : 1],
          [2, source === 'PHB' ? '{@filter 2环|spells|level=2|class=魔契师}' : 2],
        ],
      },
    ],
  });
  const wizard = normalizeClass({
    name: '法师',
    ENG_name: 'Wizard',
    source,
    casterProgression: 'full',
    spellcastingAbility: 'int',
    classFeatures: [],
    classTableGroups: [{ rowsSpellProgression: [[2], [3], [4, 2]] }],
  });
  defaultCatalog.registerMany([pact, wizard]);
  const character: CharacterState = {
    id: 'pools',
    name: '资源池验收',
    playerName: '',
    classes: [wizard, pact].map((entry, index) => ({
      classId: entry.id,
      source,
      level: 1,
      isMulticlass: index > 0,
    })),
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 14, wis: 10, cha: 14 },
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
    resourceUsage: { unrelated: 1 },
    selectedLanguages: [],
  };
  return character;
}

it.each(['PHB', 'XPHB'] as const)(
  '%s 原生契约槽与通常槽分别派生，兼职顺序和等级不串池',
  (source) => {
    const character = setup(source);
    const stats = computeSpellcasting(character);
    expect(stats.standardSpellSlots).toEqual({ 1: 2 });
    expect(stats.pactMagicSlots).toEqual({ 1: 1 });
    expect(stats.spellSlots).toEqual({ 1: 3 });
    character.classes.reverse();
    expect(computeSpellcasting(character).pactMagicSlots).toEqual({ 1: 1 });
    expect(computeSpellcasting(character).standardSpellSlots).toEqual({ 1: 2 });
    character.classes[0].level = 3;
    expect(computeSpellcasting(character).pactMagicSlots).toMatchObject({ 2: 2 });
    character.classes = [character.classes[0]];
    expect(Object.values(computeSpellcasting(character).standardSpellSlots!)).toHaveLength(0);
  },
);

it('两池实际按钮分别耗用和恢复，JSON及等级回退保留记录，导出不读取旧镜像', async () => {
  const character = setup('XPHB');
  const render = () => {
    buttons.length = 0;
    return renderToStaticMarkup(
      <SpellSlotResources
        character={character}
        spellcasting={computeSpellcasting(character)}
        spellSlotUsage={character.spellSlotUsage}
        onChange={(patch) => Object.assign(character, patch)}
      />,
    );
  };
  expect(render()).toContain('契约魔法法术位');
  buttons.filter((button) => button.children === '消耗一枚')[1].onClick();
  expect(character.spellSlotUsageByPool).toEqual({ standard: {}, pact: { 1: 1 } });
  render();
  buttons.filter((button) => button.children === '消耗一枚')[0].onClick();
  expect(character.spellSlotUsageByPool!.standard[1]).toBe(1);
  render();
  buttons.filter((button) => button.children === '恢复一枚')[1].onClick();
  expect(character.spellSlotUsageByPool).toEqual({ standard: { 1: 1 }, pact: { 1: 0 } });
  expect(character.resourceUsage).toEqual({ unrelated: 1 });
  const saved = await importFromJSON(exportToJSON(character));
  expect(saved.spellSlotUsageByPool).toEqual(character.spellSlotUsageByPool);
  saved.spellSlotUsageByPool!.pact[1] = 1;
  saved.classes[1].level = 3;
  expect(getSpellSlotResources(saved, computeSpellcasting(saved)).usage.pact[1]).toBe(1);
  expect(JSON.parse(exportToFVTT(saved)).system.spells.spell1.value).toBe(1);
  saved.classes[1].level = 1;
  saved.spellSlotUsageByPool!.pact[1] = 0;
  expect(getSpellSlotResources(saved, computeSpellcasting(saved)).usage.standard[1]).toBe(1);
  const exported = JSON.parse(exportToFVTT(saved));
  expect(exported.system.spells.spell1.value).toBe(2);
  expect(exported.flags.codex.spellSlotUsageByPool).toEqual(saved.spellSlotUsageByPool);
});

it('旧合并消耗先保留，只有玩家确认恢复才启用独立记录，旧值不被清零', () => {
  const character = setup('PHB');
  character.spellSlotUsage = { 1: 2 };
  const render = () =>
    renderToStaticMarkup(
      <SpellSlotResources
        character={character}
        spellcasting={computeSpellcasting(character)}
        spellSlotUsage={character.spellSlotUsage}
        onChange={(patch) => Object.assign(character, patch)}
      />,
    );
  expect(render()).toContain('旧法术位消耗未区分');
  expect(character.spellSlotUsageByPool).toBeUndefined();
  buttons.find((button) => button.children === '确认两类法术位已恢复，分别记录').onClick();
  expect(character.spellSlotUsage).toEqual({ 1: 2 });
  expect(render()).not.toContain('旧法术位消耗未区分');
  expect(character.spellSlotUsageByPool).toEqual({ standard: {}, pact: {} });
});
