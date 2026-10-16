import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { defaultCatalog } from '@/catalog/catalog';
import { normalizeFeat } from '@/source/fiveetools-cn/normalizers/feat';
import { normalizeSpell } from '@/source/fiveetools-cn/normalizers/spell';
import { normalizeClass } from '@/source/fiveetools-cn/normalizers/class';
import { getSpellDefinition } from '../characterData';
import { exportToJSON, importFromJSON } from '../importExport';
import {
  buildSpellSourceMap,
  computeSpellcasting,
  deriveCharacterSpellSelection,
  getInnateSpells,
} from '../spellcasting';
import SpellsTab from '@/app/sheet/[id]/tabs/SpellsTab';
import type { CharacterState } from '@/types/characterState';

const command = normalizeSpell({
  name: '链路命令术',
  source: 'TST',
  level: 1,
  school: 'E',
  entries: [],
});
const light = normalizeSpell({
  name: '链路光亮术',
  source: 'TST',
  level: 0,
  school: 'V',
  entries: [],
});
const first = normalizeFeat({ name: '链路专长甲', source: 'TST' });
const second = normalizeFeat({ name: '链路专长乙', source: 'TST' });
const noncaster = normalizeClass({ name: '链路非施法职业', source: 'TST' });
defaultCatalog.registerMany([command, light, first, second, noncaster]);
function character(): CharacterState {
  return {
    id: 'spell-source-chain',
    name: '测试',
    playerName: '',
    classes: [{ classId: noncaster.id, source: 'TST', level: 1, isMulticlass: false }],
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
    preparedSpellIds: [],
    cantripIds: [],
    knownSpellIds: [],
    spellbookIds: [],
    spellSlotUsage: {},
    resourceUsage: {},
    selectedLanguages: [],
    featSelections: {
      first: { featId: first.id, spells: [command.id, light.id] },
      second: { featId: second.id, spells: [command.id, light.id] },
    },
  };
}

it('已有选择JSON往返后保留两个专长来源，最终法术ID仍唯一', async () => {
  const original = character();
  const saved = await importFromJSON(exportToJSON(original));
  const before = JSON.stringify(saved);
  const grants = getInnateSpells(saved);
  expect(
    grants.filter((grant) => grant.spellId === command.id).map((grant) => grant.source),
  ).toEqual(['专长: 链路专长甲', '专长: 链路专长乙']);
  expect(new Set(grants.map((grant) => grant.grantSourceId)).size).toBe(2);
  expect(deriveCharacterSpellSelection(saved)).toEqual({
    cantripIds: [light.id],
    preparedSpellIds: [command.id],
    spellbookIds: [],
  });
  expect(JSON.stringify(saved)).toBe(before);
  expect(saved).toEqual(original);
});

it('多来源保留后不重复增加戏法和准备数量', () => {
  const state = character();
  const single = { ...state, featSelections: { first: state.featSelections!.first } };
  const multiStats = computeSpellcasting(state);
  const singleStats = computeSpellcasting(single);
  expect(multiStats.cantripsKnown).toBe(1);
  expect(multiStats.spellsPrepared).toBe(1);
  expect(multiStats.cantripsKnown).toBe(singleStats.cantripsKnown);
  expect(multiStats.spellsPrepared).toBe(singleStats.spellsPrepared);
  expect(multiStats.spellSlots).toEqual(singleStats.spellSlots);
});

it('同槽重复ID去重，不同槽的相同专长保留独立身份，显示文字不重复', () => {
  const state = character();
  state.featSelections = {
    first: { featId: first.id, spells: [command.id, command.id] },
    second: { featId: first.id, spells: [command.id] },
  };
  const grants = getInnateSpells(state);
  expect(grants).toHaveLength(2);
  expect(new Set(grants.map((grant) => grant.grantSourceId)).size).toBe(2);
  expect(buildSpellSourceMap(grants, [], '职业')[command.id]).toBe('专长: 链路专长甲');
});

it('移除一个已有选择来源后另一个保留；全部移除后不残留派生法术', () => {
  const state = character();
  delete state.featSelections!.first;
  expect(getInnateSpells(state).map((grant) => grant.source)).toEqual([
    '专长: 链路专长乙',
    '专长: 链路专长乙',
  ]);
  expect(deriveCharacterSpellSelection(state).preparedSpellIds).toEqual([command.id]);
  state.featSelections = {};
  expect(getInnateSpells(state)).toEqual([]);
  expect(deriveCharacterSpellSelection(state).preparedSpellIds).toEqual([]);
});

it('卡面实际法术组件同一法术只渲染一项且展示两种来源', async () => {
  const saved = await importFromJSON(exportToJSON(character()));
  const derived = deriveCharacterSpellSelection(saved);
  const grants = getInnateSpells(saved);
  const map = buildSpellSourceMap(
    grants,
    [...derived.cantripIds, ...derived.preparedSpellIds],
    '职业',
  );
  const html = renderToStaticMarkup(
    <SpellsTab
      character={{ ...saved, ...derived }}
      spellcasting={computeSpellcasting(saved)}
      primaryClass={undefined}
      cantripDetails={derived.cantripIds.map(getSpellDefinition)}
      spellDetails={derived.preparedSpellIds.map(getSpellDefinition)}
      spellbookDetails={[]}
      spellSourceMap={map}
      spellSlotUsage={{}}
      updateActiveCharacter={() => {}}
      router={{ push() {} }}
      id={saved.id}
    />,
  );
  expect(html.split('链路命令术')).toHaveLength(2);
  expect(html.split('链路光亮术')).toHaveLength(2);
  expect(html).toContain('专长: 链路专长甲；专长: 链路专长乙');
  expect(map[command.id]).not.toContain('职业');
});

it('仅有职业最终ID的旧角色继续显示职业来源，不伪造新授予记录', () => {
  expect(buildSpellSourceMap([], [command.id, command.id], '法师')).toEqual({
    [command.id]: '法师',
  });
  expect(buildSpellSourceMap([], [], '职业')).toEqual({});
});

it('相同法术不同免费次数机制不被早期去重丢失；数量仍按唯一法术计算', () => {
  const parent = normalizeClass({
    name: '链路机制测试职业',
    source: 'TST',
    features: [
      {
        name: '机制甲',
        level: 1,
        description: '',
        mechanics: { spells: [{ spellId: command.id, level: 1, freeCastsPerLongRest: 1 }] },
      },
      {
        name: '机制乙',
        level: 1,
        description: '',
        mechanics: { spells: [{ spellId: command.id, level: 1, freeCastsPerLongRest: 2 }] },
      },
    ],
  });
  defaultCatalog.register(parent);
  const state = character();
  state.featSelections = {};
  state.classes = [{ classId: parent.id, source: 'TST', level: 1, isMulticlass: false }];
  expect(getInnateSpells(state).map((grant) => grant.freeCastsPerLongRest)).toEqual([1, 2]);
  expect(deriveCharacterSpellSelection(state).preparedSpellIds).toEqual([command.id]);
  expect(computeSpellcasting(state).spellsPrepared).toBe(1);
});

it('先遇到未准备来源不应吞掉后续准备来源，保留各自状态', () => {
  const parent = normalizeClass({
    name: '链路准备状态职业',
    source: 'TST',
    features: [
      {
        name: '只习得',
        level: 1,
        description: '',
        mechanics: { spells: [{ spellId: command.id, prepared: false }] },
      },
      {
        name: '自动准备',
        level: 1,
        description: '',
        mechanics: { spells: [{ spellId: command.id, prepared: true }] },
      },
    ],
  });
  defaultCatalog.register(parent);
  const state = character();
  state.featSelections = {};
  state.classes = [{ classId: parent.id, source: 'TST', level: 1, isMulticlass: false }];
  expect(getInnateSpells(state).map((grant) => grant.isPrepared)).toEqual([false, true]);
  expect(deriveCharacterSpellSelection(state).preparedSpellIds).toEqual([command.id]);
  expect(computeSpellcasting(state).spellsPrepared).toBe(1);
});
