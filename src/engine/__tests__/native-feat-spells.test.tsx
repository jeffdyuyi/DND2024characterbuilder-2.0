import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { defaultCatalog } from '@/catalog/catalog';
import { createBuilderChoices } from '@/catalog/builderChoices';
import { normalizeFeat } from '@/source/fiveetools-cn/normalizers/feat';
import { normalizeBackground } from '@/source/fiveetools-cn/normalizers/background';
import { normalizeSpell } from '@/source/fiveetools-cn/normalizers/spell';
import {
  getNativeFeatSpellPlans,
  getNativeFeatSpellGrants,
  requiresDistinctNativeFeatBlocks,
  allowsNativeFeatLevelReplacement,
} from '../nativeFeatSpells';
import {
  getInnateSpells,
  deriveCharacterSpellSelection,
  buildSpellSourceMap,
} from '../spellcasting';
import { getSpellDefinition } from '../characterData';
import { exportToJSON, importFromJSON } from '../importExport';
import NativeFeatSpellChoices from '@/app/builder/spells/NativeFeatSpellChoices';
import SpellsTab from '@/app/sheet/[id]/tabs/SpellsTab';
import type { CharacterState } from '@/types/characterState';

const buttons = vi.hoisted(() => [] as any[]);
vi.mock('@/components/PillButton', () => ({
  default: (props: any) => {
    buttons.push(props);
    return <button>{props.children}</button>;
  },
}));

const fixture = JSON.parse(
  readFileSync('src/source/__fixtures__/fiveetools-cn/spell-grants.json', 'utf8'),
);
const raw = fixture.entries.find(
  (row: any) => row.raw.ENG_name === 'Magic Initiate' && row.raw.source === 'XPHB',
).raw;
const links = ['牧师', '德鲁伊', '法师']
  .map((name) => `{@filter ${name}|spells|level=0;1|class=${name}}`)
  .join('、');
const feat = normalizeFeat({
  ...raw,
  repeatable: true,
  entries: [
    { type: 'entries', entries: [`从${links}法术列表中选择一个列表。`] },
    '你可以无需法术位地施展该法术一次，并在完成长休后重获以此法施展该法术的能力。',
    '你可多次选择本专长，但是你每次都必须选择一个不同的法术列表。',
    '每当你获得一级新等级，你都能将通过本专长习得的一道法术替换为同法术列表中同环阶的另一道法术。',
  ],
});
const background = normalizeBackground({
  name: '测试背景',
  ENG_name: 'Test Native Feat Background',
  source: 'XPHB',
});
const spells = [
  normalizeSpell({
    name: '测试戏法一',
    ENG_name: 'Test Cantrip One',
    source: 'XPHB',
    level: 0,
    classes: ['牧师'],
  }),
  normalizeSpell({
    name: '测试戏法二',
    ENG_name: 'Test Cantrip Two',
    source: 'XPHB',
    level: 0,
    classes: ['牧师'],
  }),
  normalizeSpell({
    name: '测试一环',
    ENG_name: 'Test First Spell',
    source: 'XPHB',
    level: 1,
    classes: ['牧师'],
  }),
  normalizeSpell({
    name: '其他列表戏法',
    ENG_name: 'Other List Cantrip',
    source: 'XPHB',
    level: 0,
    classes: ['法师'],
  }),
  normalizeSpell({
    name: '测试戏法三',
    ENG_name: 'Test Cantrip Three',
    source: 'XPHB',
    level: 0,
    classes: ['牧师'],
  }),
];
function state(): CharacterState {
  return {
    id: 'native-feat',
    name: '原生专长',
    playerName: '',
    backgroundId: background.id,
    originFeatId: feat.id,
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
    preparedSpellIds: [],
    cantripIds: [],
    knownSpellIds: [],
    spellbookIds: [],
    spellSlotUsage: {},
    resourceUsage: {},
    selectedLanguages: [],
  };
}

it('原生专长在两个页面共用槽位记录，重开后派生三道且移除来源退出', async () => {
  defaultCatalog.registerMany([feat, background, ...spells]);
  const character = state();
  const plan = getNativeFeatSpellPlans(character)[0];
  expect(plan.grants.blockRelationship).toBe('exclusive');
  expect(requiresDistinctNativeFeatBlocks(feat.id)).toBe(true);
  const block = plan.grants.blocks.find((entry) => entry.nameEn === 'Cleric Spells')!;
  const known = block.rules.find((rule) => rule.mode === 'known')!;
  const innate = block.rules.find((rule) => rule.mode === 'innate')!;
  character.featSelections = {
    'background-feat': {
      featId: feat.id,
      nativeSpellGrants: {
        originId: feat.id,
        blockId: block.id,
        ability: 'wis',
        selections: {
          [known.id]: [spells[0].id, spells[1].id],
          [innate.id]: [spells[2].id],
        },
      },
    },
  };
  const candidates = createBuilderChoices(character).getCatalogSpells();
  const html = renderToStaticMarkup(
    <NativeFeatSpellChoices character={character} candidates={candidates} onChange={() => {}} />,
  );
  expect(html).toContain('选择一个法术列表');
  expect(html).toContain('测试戏法一');
  expect(getNativeFeatSpellGrants(character).map((entry) => entry.spellId)).toEqual(
    spells.slice(0, 3).map((entry) => entry.id),
  );
  expect(getNativeFeatSpellGrants(character)[2].freeCastsPerLongRest).toBe(1);
  expect(deriveCharacterSpellSelection(character).cantripIds).toEqual(
    spells.slice(0, 2).map((entry) => entry.id),
  );
  expect(getInnateSpells(character).map((entry) => entry.spellId)).toEqual(
    spells.slice(0, 3).map((entry) => entry.id),
  );
  expect(getInnateSpells(character)[2]).toMatchObject({
    source: expect.stringContaining('感知'),
    freeCastsPerLongRest: 1,
  });
  const grants = getInnateSpells(character);
  const resourceId = grants[2].freeCastResourceId!;
  expect(resourceId).toContain('background-feat');
  const renderTracker = (slots: Record<number, number> = {}) => {
    buttons.length = 0;
    return renderToStaticMarkup(
      <SpellsTab
        character={character}
        spellcasting={{ spellSlots: slots, cantripsKnown: 2, spellsPrepared: 1 }}
        primaryClass={undefined}
        cantripDetails={grants.slice(0, 2).map((entry) => getSpellDefinition(entry.spellId))}
        spellDetails={[getSpellDefinition(grants[2].spellId)]}
        spellSourceMap={buildSpellSourceMap(grants, [], '专长')}
        freeCastGrants={[grants[2]]}
        spellSlotUsage={character.spellSlotUsage}
        updateActiveCharacter={(patch) => Object.assign(character, patch)}
        router={{ push() {} }}
        id={character.id}
      />,
    );
  };
  expect(renderTracker()).toContain('免费施法 1 / 1');
  expect(renderTracker({ 1: 2 })).toContain('来源免费施法');
  expect(renderTracker({ 1: 2 })).toContain('2 / 2');
  buttons.find((button) => button.children === '消耗免费次数').onClick();
  expect(character.resourceUsage[resourceId]).toBe(1);
  expect(renderTracker({ 1: 2 })).toContain('免费施法 0 / 1');
  expect(renderTracker({ 1: 2 })).toContain('2 / 2');
  buttons.find((button) => button.children === '消耗一枚').onClick();
  expect(renderTracker({ 1: 2 })).toContain('1 / 2');
  expect(renderTracker({ 1: 2 })).toContain('免费施法 0 / 1');
  buttons.find((button) => button.children === '消耗一枚').onClick();
  expect(renderTracker({ 1: 2 })).toContain('0 / 2');
  expect(buttons.find((button) => button.children === '消耗一枚').disabled).toBe(true);
  const saved = await importFromJSON(exportToJSON(character));
  expect(saved.resourceUsage[resourceId]).toBe(1);
  expect(saved.spellSlotUsage[1]).toBe(2);
  buttons.find((button) => button.children === '恢复一枚').onClick();
  expect(renderTracker({ 1: 2 })).toContain('1 / 2');
  buttons.find((button) => button.children === '长休恢复').onClick();
  expect(character.resourceUsage[resourceId]).toBe(0);
  expect(renderTracker({ 1: 2 })).toContain('1 / 2');
  const sheet = renderToStaticMarkup(
    <SpellsTab
      character={character}
      spellcasting={{ spellSlots: {}, cantripsKnown: 2, spellsPrepared: 1 }}
      primaryClass={undefined}
      cantripDetails={grants.slice(0, 2).map((entry) => getSpellDefinition(entry.spellId))}
      spellDetails={[getSpellDefinition(grants[2].spellId)]}
      spellbookDetails={[]}
      spellSourceMap={buildSpellSourceMap(grants, [], '专长')}
      spellSlotUsage={{}}
      updateActiveCharacter={() => {}}
      router={{ push() {} }}
      id={character.id}
    />,
  );
  expect(sheet).toContain('测试一环');
  expect(sheet).toContain('专长: 魔法学徒');
  expect(sheet).toContain('感知');
  const wizard = plan.grants.blocks.find((entry) => entry.nameEn === 'Wizard Spells')!;
  character.featSelections['background-feat'].nativeSpellGrants!.blockId = wizard.id;
  expect(getNativeFeatSpellGrants(character)).toEqual([]);
  character.featSelections['background-feat'].nativeSpellGrants!.blockId = block.id;
  character.featSelections['background-feat'].nativeSpellGrants!.ability = undefined;
  expect(getNativeFeatSpellGrants(character)).toEqual([]);
  character.featSelections['background-feat'].nativeSpellGrants!.ability = 'wis';
  const reopened = await importFromJSON(exportToJSON(character));
  expect(getNativeFeatSpellGrants(reopened).map((entry) => entry.spellId)).toEqual(
    spells.slice(0, 3).map((entry) => entry.id),
  );
  reopened.originFeatId = undefined;
  expect(getNativeFeatSpellGrants(reopened)).toEqual([]);
  expect(reopened.featSelections?.['background-feat']?.nativeSpellGrants).toBeDefined();
});

it('禁用已选专长书籍只收紧新候选，JSON重开后原生授法仍在卡面', async () => {
  defaultCatalog.registerMany([feat, background, ...spells]);
  const character = state();
  const block = getNativeFeatSpellPlans(character)[0].grants.blocks.find(
    (entry) => entry.nameEn === 'Cleric Spells',
  )!;
  const known = block.rules.find((rule) => rule.mode === 'known')!;
  const innate = block.rules.find((rule) => rule.mode === 'innate')!;
  character.featSelections = {
    'background-feat': {
      featId: feat.id,
      nativeSpellGrants: {
        originId: feat.id,
        blockId: block.id,
        ability: 'wis',
        selections: { [known.id]: [spells[0].id, spells[1].id], [innate.id]: [spells[2].id] },
      },
    },
  };
  character.sourceSelection = {
    mode: 'selected',
    books: [{ sourcePackId: '5etools-cn', source: 'PHB' }],
  };
  expect(
    createBuilderChoices(character)
      .getCatalogSpells()
      .some((spell) => spell.id === spells[0].id),
  ).toBe(false);
  const reopened = await importFromJSON(exportToJSON(character));
  const grants = getInnateSpells(reopened);
  expect(grants.map((grant) => grant.spellId)).toEqual(spells.slice(0, 3).map((spell) => spell.id));
  expect(grants[2].freeCastsPerLongRest).toBe(1);
  expect(deriveCharacterSpellSelection(reopened).cantripIds).toEqual([spells[0].id, spells[1].id]);
  expect(buildSpellSourceMap(grants, [], '职业')[spells[2].id]).toContain('专长: 魔法学徒');
  expect(reopened).toEqual(character);
});

it('来源页与法术页共用选择控件和记录，玩家手选后立即可派生', () => {
  defaultCatalog.registerMany([feat, background, ...spells]);
  let character = state();
  const render = (slotId?: string) => {
    buttons.length = 0;
    renderToStaticMarkup(
      <NativeFeatSpellChoices
        character={character}
        candidates={createBuilderChoices(character).getCatalogSpells()}
        slotId={slotId}
        onChange={(featSelections) => {
          character = { ...character, featSelections };
        }}
      />,
    );
  };
  const click = (label: string) => {
    const button = buttons.find((entry) => entry.children === label);
    expect(button, label).toBeDefined();
    button.onClick();
  };
  render('background-feat');
  click('牧师法术');
  render();
  click('感知');
  render();
  click('测试戏法一');
  render('background-feat');
  click('测试戏法二');
  render();
  click('测试一环');
  expect(getNativeFeatSpellGrants(character).map((entry) => entry.spellId)).toEqual(
    spells.slice(0, 3).map((entry) => entry.id),
  );
  character.featSelections!['other-slot'] = {
    featId: feat.id,
    nativeSpellGrants: {
      originId: feat.id,
      blockId: character.featSelections!['background-feat'].nativeSpellGrants!.blockId,
      selections: {},
    },
  };
  render('background-feat');
  expect(buttons.find((entry) => entry.children === '牧师法术')?.disabled).toBe(true);
});

it('PHB 原生职业法表沿用固定施法属性与独立来源身份', () => {
  const legacyRaw = fixture.entries.find(
    (row: any) => row.raw.ENG_name === 'Magic Initiate' && row.raw.source === 'PHB',
  ).raw;
  const classNames = ['吟游诗人', '牧师', '德鲁伊', '术士', '魔契师', '法师'];
  const legacyFeat = normalizeFeat({
    ...legacyRaw,
    entries: [
      `指定一个职业：${classNames.map((name) => `{@filter ${name}|spells|level=0;1|class=${name}}`).join('、')}。`,
    ],
  });
  const legacySpells = spells.slice(0, 3).map((entry) =>
    normalizeSpell({
      ...entry.raw,
      source: 'PHB',
    }),
  );
  defaultCatalog.registerMany([legacyFeat, ...legacySpells, background]);
  const character = state();
  character.originFeatId = legacyFeat.id;
  const block = getNativeFeatSpellPlans(character)[0].grants.blocks.find(
    (entry) => entry.nameEn === 'Cleric Spells',
  )!;
  const known = block.rules.find((rule) => rule.mode === 'known')!;
  const innate = block.rules.find((rule) => rule.mode === 'innate')!;
  character.featSelections = {
    'background-feat': {
      featId: legacyFeat.id,
      nativeSpellGrants: {
        originId: legacyFeat.id,
        blockId: block.id,
        selections: {
          [known.id]: legacySpells.slice(0, 2).map((entry) => entry.id),
          [innate.id]: [legacySpells[2].id],
        },
      },
    },
  };
  const grants = getNativeFeatSpellGrants(character);
  expect(grants.map((entry) => entry.spellId)).toEqual(legacySpells.map((entry) => entry.id));
  expect(grants[0].source).toContain('感知');
  expect(grants.every((entry) => entry.sourceId === legacyFeat.id)).toBe(true);
});

it('XPHB 原生专长升级替换逐级生效，降级保留初始记录且再次升级恢复', async () => {
  defaultCatalog.registerMany([feat, background, ...spells]);
  expect(allowsNativeFeatLevelReplacement(feat.id)).toBe(true);
  const character = state();
  const block = getNativeFeatSpellPlans(character)[0].grants.blocks.find(
    (entry) => entry.nameEn === 'Cleric Spells',
  )!;
  const known = block.rules.find((rule) => rule.mode === 'known')!;
  character.featSelections = {
    'background-feat': {
      featId: feat.id,
      nativeSpellGrants: {
        originId: feat.id,
        blockId: block.id,
        ability: 'wis',
        selections: { [known.id]: [spells[0].id, spells[1].id] },
        replacements: { 2: { ruleId: known.id, from: spells[0].id, to: spells[4].id } },
      },
    },
  };
  expect(getNativeFeatSpellGrants(character).map((entry) => entry.spellId)).toEqual([
    spells[0].id,
    spells[1].id,
  ]);
  character.classes = [{ classId: 'test-class', source: 'XPHB', level: 2, isMulticlass: false }];
  expect(getNativeFeatSpellGrants(character).map((entry) => entry.spellId)).toEqual([
    spells[4].id,
    spells[1].id,
  ]);
  const reopened = await importFromJSON(exportToJSON(character));
  expect(getNativeFeatSpellGrants(reopened).map((entry) => entry.spellId)).toEqual([
    spells[4].id,
    spells[1].id,
  ]);
  const html = renderToStaticMarkup(
    <NativeFeatSpellChoices
      character={character}
      candidates={createBuilderChoices(character).getCatalogSpells()}
      onChange={() => {}}
    />,
  );
  expect(html).toContain('角色 2 级');
  character.classes[0].level = 1;
  expect(getNativeFeatSpellGrants(character).map((entry) => entry.spellId)).toEqual([
    spells[0].id,
    spells[1].id,
  ]);
  character.classes[0].level = 2;
  expect(getNativeFeatSpellGrants(character).map((entry) => entry.spellId)).toEqual([
    spells[4].id,
    spells[1].id,
  ]);
  expect(
    character.featSelections['background-feat'].nativeSpellGrants!.selections[known.id],
  ).toEqual([spells[0].id, spells[1].id]);
});
