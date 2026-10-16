import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';
import { defaultCatalog, InMemoryCatalogService } from '@/catalog/catalog';
import { normalizeClass } from '@/source/fiveetools-cn/normalizers/class';
import { normalizeSpell } from '@/source/fiveetools-cn/normalizers/spell';
import { normalizeFeat } from '@/source/fiveetools-cn/normalizers/feat';
import { catalogEntryToSpell } from '@/catalog/adapters/spells';
import { getNativeClassPreparedSpells } from '../nativeClassPreparedSpells';
import { getSpellDefinition } from '../characterData';
import {
  getInnateSpells,
  deriveCharacterSpellSelection,
  buildSpellSourceMap,
  computeSpellProgression,
  computeSpellcasting,
} from '../spellcasting';
import { exportToJSON, importFromJSON } from '../importExport';
import type { CharacterState } from '@/types/characterState';
import { createBuilderChoices } from '@/catalog/builderChoices';

vi.mock('@/platform/useBuilderChoices', () => ({
  useBuilderChoices: () => createBuilderChoices({}),
}));
vi.mock('@/platform/CatalogProvider', () => ({ useCatalog: () => ({ status: 'ready' }) }));
const update = vi.hoisted(() => vi.fn());
vi.mock('@/store/characterStore', () => ({
  useCharacterStore: () => ({ updateActiveCharacter: update }),
}));
import SpellList from '@/app/builder/spells/SpellList';
import SpellsTab from '@/app/sheet/[id]/tabs/SpellsTab';

const fixture = JSON.parse(
  readFileSync('src/source/__fixtures__/fiveetools-cn/spell-grants.json', 'utf8'),
);
const raw = fixture.entries.find(
  (row: any) => row.kind === 'class' && row.raw.ENG_name === 'Warlock' && row.raw.source === 'XPHB',
).raw;
const caster = normalizeClass(raw);
const spell = normalizeSpell({
  name: '异界探知',
  source: 'XPHB',
  level: 5,
  entries: ['测试法术正文'],
});
function state(level = 9): CharacterState {
  return {
    id: 'native-fixed',
    name: '固定授予角色',
    playerName: '',
    classes: [{ classId: caster.id, source: 'XPHB', level, isMulticlass: false }],
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
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
function setup() {
  defaultCatalog.registerMany([caster, spell]);
}

it('档案原生魔契师固定prepared实际进入生产派生链，按职业9级解锁', () => {
  setup();
  const character = state(8);
  const before = JSON.stringify(character);
  expect(getInnateSpells(character)).toEqual([]);
  expect(JSON.stringify(character)).toBe(before);
  character.classes[0].level = 9;
  expect(getNativeClassPreparedSpells(character).grants[0]).toMatchObject({
    spellId: spell.id,
    classId: caster.id,
    sourceId: caster.id,
    unlockLevel: 9,
  });
  expect(getInnateSpells(character)).toEqual([
    expect.objectContaining({ spellId: spell.id, source: '职业: 魔契师', isPrepared: true }),
  ]);
  expect(deriveCharacterSpellSelection(character).preparedSpellIds).toEqual([spell.id]);
  expect(character.preparedSpellIds).toEqual([]);
});

it('总等级不冒充兼职等级；降级、职业移除不删存档或手动法术', () => {
  setup();
  const other = normalizeClass({ name: '另一职业', source: 'PHB' });
  defaultCatalog.register(other);
  const character = state(1);
  character.classes.unshift({ classId: other.id, source: 'PHB', level: 10, isMulticlass: false });
  character.preparedSpellIds = ['manual'];
  character.spellsByLevel = { [caster.id]: { 9: { cantrips: [], spells: ['saved-selection'] } } };
  expect(getInnateSpells(character)).toEqual([]);
  character.classes[1].level = 9;
  expect(getInnateSpells(character).map((grant) => grant.spellId)).toEqual([spell.id]);
  character.classes[1].level = 8;
  expect(getInnateSpells(character)).toEqual([]);
  character.classes.pop();
  expect(getInnateSpells(character)).toEqual([]);
  expect(character.preparedSpellIds).toEqual(['manual']);
  expect(character.spellsByLevel[caster.id][9].spells).toEqual(['saved-selection']);
});

it('缺失候选或出处不符不从其他版本补入，歧义有诊断', () => {
  const catalog = new InMemoryCatalogService();
  catalog.register(caster);
  const character = state();
  const candidate = catalogEntryToSpell(spell);
  expect(getNativeClassPreparedSpells(character, [], catalog).diagnostics).toHaveLength(1);
  expect(
    getNativeClassPreparedSpells(character, [{ ...candidate, source: 'PHB' }], catalog).grants,
  ).toEqual([]);
  expect(
    getNativeClassPreparedSpells(
      character,
      [candidate, { ...candidate, id: 'other-stable-id' }],
      catalog,
    ).diagnostics,
  ).toHaveLength(1);
  character.classes[0].source = 'PHB';
  expect(getNativeClassPreparedSpells(character, [candidate], catalog).grants).toEqual([]);
});

it('多块、选法、次数、施法属性自选及expanded仍不自动激活', () => {
  const catalog = new InMemoryCatalogService();
  for (const additionalSpells of [
    [raw.additionalSpells[0], raw.additionalSpells[0]],
    [{ prepared: { 1: [{ choose: 'level=1|class=法师' }] } }],
    [{ prepared: { 1: { daily: { 1: ['异界探知|XPHB'] } } } }],
    [{ ability: { choose: ['int', 'wis'] }, prepared: { 1: ['异界探知|XPHB'] } }],
    [{ ability: 'int', prepared: { 1: ['异界探知|XPHB'] } }],
    [{ resourceName: '待确认资源池', prepared: { 1: ['异界探知|XPHB'] } }],
    [{ expanded: { s5: ['异界探知|XPHB'] } }],
  ]) {
    catalog.register({ ...caster, raw: { ...raw, additionalSpells } });
    const result = getNativeClassPreparedSpells(state(), [], catalog);
    expect(result.grants).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
  }
  catalog.register({
    ...caster,
    raw: { ...raw, additionalSpells: undefined, attachedSpells: ['异界探知|XPHB'] },
  });
  expect(getNativeClassPreparedSpells(state(), [], catalog).grants).toEqual([]);
});

it('已有职业特性提供相同准备法术时保留成熟记录及次数，不再添加根条目镜像', () => {
  setup();
  defaultCatalog.register(
    normalizeClass({
      ...raw,
      features: [
        {
          name: '已有职业授予',
          level: 9,
          mechanics: { spells: [{ spells: [spell.id], prepared: true, freeCastsPerLongRest: 1 }] },
        },
      ],
    }),
  );
  const grants = getInnateSpells(state());
  expect(grants).toHaveLength(1);
  expect(grants[0].freeCastsPerLongRest).toBe(1);
  expect(grants[0].grantSourceId).toBeUndefined();
});

it('同法术的专长来源继续保留；职业基础选法名额和法术位不增加', () => {
  setup();
  const feat = normalizeFeat({ name: '独立专长来源', source: 'XPHB' });
  defaultCatalog.register(feat);
  const character = state();
  character.featSelections = { saved: { featId: feat.id, spells: [spell.id] } };
  const grants = getInnateSpells(character);
  expect(grants).toHaveLength(2);
  expect(buildSpellSourceMap(grants, [], '职业')[spell.id]).toContain('专长: 独立专长来源');
  expect(buildSpellSourceMap(grants, [], '职业')[spell.id]).toContain('职业: 魔契师');
  expect(deriveCharacterSpellSelection(character).preparedSpellIds).toEqual([spell.id]);
  const withProgression = {
    ...raw,
    casterProgression: 'pact',
    spellcastingAbility: 'cha',
    preparedSpellsProgression: Array(20).fill(2),
    cantripProgression: Array(20).fill(0),
    classTableGroups: [{ rowsSpellProgression: Array(20).fill([0, 0, 0, 0, 2]) }],
  };
  defaultCatalog.register(normalizeClass(withProgression));
  const steps = computeSpellProgression(character, caster.id);
  const slots = computeSpellcasting(character).spellSlots;
  defaultCatalog.register(normalizeClass({ ...withProgression, additionalSpells: undefined }));
  expect(computeSpellProgression(character, caster.id)).toEqual(steps);
  expect(computeSpellcasting(character).spellSlots).toEqual(slots);
});

it('同名不同数据包的两个职业授予不能仅因显示名相同而相互覆盖', () => {
  setup();
  const custom = normalizeClass({ ...raw, source: 'CUSTOM' }, 'homebrew-own');
  defaultCatalog.register(custom);
  const character = state();
  character.classes.push({ classId: custom.id, source: 'CUSTOM', level: 9, isMulticlass: true });
  const grants = getInnateSpells(character);
  expect(grants).toHaveLength(2);
  expect(new Set(grants.map((entry) => entry.grantSourceId)).size).toBe(2);
  expect(deriveCharacterSpellSelection(character).preparedSpellIds).toEqual([spell.id]);
});

it('同职业多个等级重复固定准备同一道法术时，页面与最终法表只显示一项', () => {
  setup();
  defaultCatalog.register(
    normalizeClass({
      ...raw,
      additionalSpells: [
        {
          prepared: {
            1: ['异界探知|XPHB'],
            9: ['异界探知|XPHB'],
          },
        },
      ],
    }),
  );
  expect(getInnateSpells(state())).toHaveLength(2); // 两条原生规则的身份仍可追溯。
  expect(deriveCharacterSpellSelection(state()).preparedSpellIds).toEqual([spell.id]);
  const html = renderToStaticMarkup(
    <SpellList
      character={state()}
      casterLevel={0}
      spellSlots={{}}
      cantripsKnown={0}
      spellsPrepared={0}
    />,
  );
  expect(html.split('异界探知')).toHaveLength(2);
});

it('逐级保存不把自动授予变成无来源ID，重开降级后可撤销而独立选择继续保留', async () => {
  setup();
  const character = state();
  character.spellsByLevel = { [caster.id]: { 1: { cantrips: [], spells: ['manual-choice'] } } };
  const saved = await importFromJSON(
    exportToJSON({
      ...character,
      ...deriveCharacterSpellSelection(character, { includeNativeClassPrepared: false }),
    }),
  );
  expect(saved.preparedSpellIds).toEqual(['manual-choice']);
  expect(deriveCharacterSpellSelection(saved).preparedSpellIds).toEqual([
    'manual-choice',
    spell.id,
  ]);
  saved.classes[0].level = 8;
  expect(getInnateSpells(saved)).toEqual([]);
  expect(saved.preparedSpellIds).toEqual(['manual-choice']);
  expect(deriveCharacterSpellSelection(saved).preparedSpellIds).toEqual(['manual-choice']);
  saved.classes[0].level = 9;
  saved.spellsByLevel![caster.id][1].spells.push(spell.id);
  expect(
    deriveCharacterSpellSelection(saved, { includeNativeClassPrepared: false }).preparedSpellIds,
  ).toContain(spell.id);
  saved.classes[0].level = 8;
  expect(deriveCharacterSpellSelection(saved).preparedSpellIds).toContain(spell.id);
});

it('导出重开后固定法术进入实际配置页及卡面，渲染不写角色记录', async () => {
  setup();
  update.mockClear();
  const saved = await importFromJSON(exportToJSON(state()));
  const before = JSON.stringify(saved);
  const html = renderToStaticMarkup(
    <SpellList
      character={saved}
      casterLevel={0}
      spellSlots={{}}
      cantripsKnown={0}
      spellsPrepared={0}
    />,
  );
  expect(html).toContain('职业固定准备法术');
  expect(html).toContain('异界探知');
  expect(html).not.toContain('尚未具备施法能力');
  expect(update).not.toHaveBeenCalled();
  expect(deriveCharacterSpellSelection(saved).preparedSpellIds).toEqual([spell.id]);
  const sources = buildSpellSourceMap(getInnateSpells(saved), [], '职业');
  const sheet = renderToStaticMarkup(
    <SpellsTab
      character={saved}
      spellcasting={{ spellSlots: {}, cantripsKnown: 0, spellsPrepared: 1 }}
      primaryClass={undefined}
      cantripDetails={[]}
      spellDetails={getInnateSpells(saved).map((grant) => getSpellDefinition(grant.spellId))}
      spellbookDetails={[]}
      spellSourceMap={sources}
      spellSlotUsage={{}}
      updateActiveCharacter={() => {}}
      router={{ push() {} }}
      id={saved.id}
    />,
  );
  expect(sheet).toContain('异界探知');
  expect(sheet).toContain('职业: 魔契师');
  expect(JSON.stringify(saved)).toBe(before);
});
