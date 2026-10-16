import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { beforeEach, expect, it, vi } from 'vitest';
import { defaultCatalog } from '@/catalog/catalog';
import { catalogEntryToBackground } from '@/catalog/adapters/backgrounds';
import { catalogEntryToSpell } from '@/catalog/adapters/spells';
import { parseBackgroundSpellList } from '@/catalog/adapters/backgroundSpells';
import { normalizeBackground } from '@/source/fiveetools-cn/normalizers/background';
import { normalizeSpell } from '@/source/fiveetools-cn/normalizers/spell';
import { normalizeClass } from '@/source/fiveetools-cn/normalizers/class';
import { getSpellDefinition } from '@/engine/characterData';
import { computeSpellProgression, deriveCharacterSpellSelection } from '@/engine/spellcasting';
import { resolveBackgroundSpellList } from '../backgroundSpellList';
import { createBuilderChoices } from '@/catalog/builderChoices';

const control = vi.hoisted(() => ({ state: {} as any, activeClassId: '' }));
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>();
  return {
    ...actual,
    useState: (initial: any) =>
      initial === null
        ? [control.activeClassId, () => {}]
        : initial === '2024 玩家手册'
          ? [null, () => {}]
          : actual.useState(initial),
  };
});
vi.mock('@/platform/useBuilderChoices', () => ({
  useBuilderChoices: () => createBuilderChoices(control.state),
}));
vi.mock('@/platform/CatalogProvider', () => ({ useCatalog: () => ({ status: 'ready' }) }));
vi.mock('@/store/characterStore', () => ({
  useCharacterStore: () => ({ updateActiveCharacter() {} }),
}));
import SpellList from '@/app/builder/spells/SpellList';
import SpellsTab from '@/app/sheet/[id]/tabs/SpellsTab';

const fixture = JSON.parse(
  readFileSync(
    'src/source/__fixtures__/fiveetools-cn/background-expanded-spells.json',
    'utf8',
  ).replace(/^\uFEFF/, ''),
);
const bgEntry = normalizeBackground(fixture.background[0]);
const background = catalogEntryToBackground(bgEntry);
const spell = (name: string, level = 1, source = 'PHB', pack = '5etools-cn') => {
  const entry = normalizeSpell(
    { name, source, level, school: 'E', entries: [`正文-${name}`] },
    pack,
  );
  defaultCatalog.register(entry);
  return catalogEntryToSpell(entry);
};
const caster = (name: string, source = 'PHB') => {
  const entry = normalizeClass({
    name,
    ENG_name: name,
    source,
    casterProgression: 'full',
    spellcastingAbility: 'int',
    preparedSpellsProgression: [2, 3],
    cantripProgression: [2, 2],
    classTableGroups: [
      {
        rowsSpellProgression: [
          [2, 0],
          [3, 0],
        ],
      },
    ],
  });
  defaultCatalog.register(entry);
  return entry;
};
const primary = caster('Background Audit Caster');
const secondary = caster('Background Second Caster', 'XPHB');
let command: ReturnType<typeof spell>;
let friends: ReturnType<typeof spell>;
const renderBuilder = () =>
  renderToStaticMarkup(
    <SpellList
      character={control.state}
      casterLevel={1}
      spellSlots={{ 1: 2 }}
      cantripsKnown={2}
      spellsPrepared={2}
    />,
  );

beforeEach(() => {
  defaultCatalog.register(bgEntry);
  command = spell('命令术');
  friends = spell('交友术', 0);
  spell('秘法锁', 2);
  control.activeClassId = primary.id;
  control.state = {
    id: 'background-spells',
    name: '测试角色',
    backgroundId: bgEntry.id,
    backgroundSource: bgEntry.source,
    classes: [{ classId: primary.id, level: 1 }],
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
    selectedFeats: [],
    equipmentIds: [],
    classSelections: {},
    speciesSelections: {},
    cantripIds: [],
    preparedSpellIds: [],
    spellbookIds: [],
    spellsByLevel: {},
    allowHomebrew: false,
  };
});

it.each(fixture.background as Record<string, any>[])(
  '原生 $ENG_name 扩展引用完整提取且不改写raw',
  (raw) => {
    const original = JSON.stringify(raw);
    const result = catalogEntryToBackground(normalizeBackground(raw));
    const refs = Object.values(raw.additionalSpells[0].expanded).flat();
    expect(result.expandedSpells).toHaveLength(refs.length);
    expect(result.spellListDiagnostics).toEqual([]);
    expect(JSON.stringify(raw)).toBe(original);
  },
);
it('缺省出处严格为PHB，保留显式书籍与戏法标记，不混入2024同名法术或第三方同名书籍', () => {
  const newer = spell('命令术', 1, 'XPHB');
  const homebrew = spell('命令术', 1, 'PHB', 'homebrew-other');
  const result = resolveBackgroundSpellList(background, [command, friends, newer, homebrew]);
  expect([...result.spellIds]).toEqual([friends.id, command.id]);
  const dimir = catalogEntryToBackground(
    normalizeBackground(fixture.background.find((b: any) => b.ENG_name === 'Dimir Operative')),
  );
  const encode = spell('思想编码', 0, 'GGR');
  expect(resolveBackgroundSpellList(dimir, [encode]).spellIds.has(encode.id)).toBe(true);
});
it('候选进入实际选法页面；高环法术仍锁定，扩展不自动习得', () => {
  const html = renderBuilder();
  expect(html).toContain('命令术');
  expect(html).toContain('交友术');
  expect(html).not.toContain('>秘法锁<');
  expect(deriveCharacterSpellSelection(control.state)).toEqual({
    cantripIds: [],
    preparedSpellIds: [],
    spellbookIds: [],
  });
  expect(computeSpellProgression(control.state, primary.id)[0].newSpells).toBe(2);
});
it('移除背景立即退出候选，不删除已经保存的选择', () => {
  control.state.backgroundId = undefined;
  control.state.spellsByLevel = {
    [primary.id]: { 1: { cantrips: [friends.id], spells: [command.id] } },
  };
  expect(renderBuilder()).not.toMatch(/<button[^>]*>命令术<\/button>/);
  expect(deriveCharacterSpellSelection(control.state).preparedSpellIds).toEqual([command.id]);
});

it('失效额外槽位与未来等级的已选法术不禁用实际页面候选', () => {
  const baseline = renderBuilder();
  control.state.spellsByLevel = {
    [primary.id]: {
      1: { cantrips: [], spells: [], extra: { removed_choice: [command.id, friends.id] } },
      4: { cantrips: [friends.id], spells: [command.id] },
    },
  };
  const before = JSON.stringify(control.state);
  expect(renderBuilder()).toBe(baseline);
  expect(deriveCharacterSpellSelection(control.state)).toEqual({
    cantripIds: [],
    preparedSpellIds: [],
    spellbookIds: [],
  });
  expect(JSON.stringify(control.state)).toBe(before);
});

it('未来法术书记录不提前解除准备限制，降级后页面与法表一致', () => {
  const wizard = caster('Wizard');
  control.activeClassId = wizard.id;
  control.state.classes = [{ classId: wizard.id, level: 1 }];
  const baseline = renderBuilder();
  control.state.spellsByLevel = {
    [wizard.id]: {
      4: { cantrips: [], spells: [], extra: { wizard_spellbook_lvl4: [command.id] } },
    },
  };
  expect(renderBuilder()).toBe(baseline);
  expect(deriveCharacterSpellSelection(control.state).spellbookIds).toEqual([]);
  expect(control.state.spellsByLevel[wizard.id][4].extra.wizard_spellbook_lvl4).toEqual([
    command.id,
  ]);
});
it('多职业分别可选，同一法术汇总去重且额度不增加', () => {
  control.state.classes.push({ classId: secondary.id, level: 1 });
  for (const cls of control.state.classes) {
    control.activeClassId = cls.classId;
    expect(renderBuilder()).toContain('命令术');
    control.state.spellsByLevel[cls.classId] = {
      1: { cantrips: [friends.id], spells: [command.id] },
    };
    expect(computeSpellProgression(control.state, cls.classId)[0].newSpells).toBe(2);
  }
  expect(deriveCharacterSpellSelection(control.state).preparedSpellIds).toEqual([command.id]);
});
it('法师的法术书选择也包含背景扩展；存档重开后可显示在正式法术页', () => {
  const wizard = caster('Wizard');
  control.activeClassId = wizard.id;
  control.state.classes = [{ classId: wizard.id, level: 1 }];
  const buttons = renderBuilder().match(/<button\b[^>]*>[\s\S]*?<\/button>/g) || [];
  expect(buttons.filter((button) => button.includes('命令术'))).toHaveLength(2);
  expect(
    buttons.filter((button) => button.includes('命令术') && button.includes('disabled')),
  ).toHaveLength(1);
  const step = computeSpellProgression(control.state, wizard.id)[0];
  const bookChoice = step.extraChoices.find((c) => c.id.startsWith('wizard_spellbook'))!;
  expect(bookChoice).toBeDefined();
  control.state.spellsByLevel = {
    [wizard.id]: {
      1: { cantrips: [friends.id], spells: [command.id], extra: { [bookChoice.id]: [command.id] } },
    },
  };
  const saved = JSON.parse(JSON.stringify(control.state));
  const derived = deriveCharacterSpellSelection(saved);
  expect(derived.spellbookIds).toEqual([command.id]);
  const html = renderToStaticMarkup(
    <SpellsTab
      character={{ ...saved, ...derived }}
      spellcasting={{ spellSlots: { 1: 2 }, cantripsKnown: 2, spellsPrepared: 2 }}
      primaryClass={{ nameEn: 'Wizard' }}
      cantripDetails={derived.cantripIds.map(getSpellDefinition)}
      spellDetails={derived.preparedSpellIds.map(getSpellDefinition)}
      spellbookDetails={derived.spellbookIds.map(getSpellDefinition)}
      spellSourceMap={{}}
      spellSlotUsage={{}}
      updateActiveCharacter={() => {}}
      router={{ push() {} }}
      id={saved.id}
    />,
  );
  expect(html).toContain('命令术');
  expect(html).toContain('交友术');
});
it('来源白名单保持生效，缺失引用有诊断而不是静态补入', () => {
  control.state.sourceSelection = {
    mode: 'selected',
    books: [{ source: 'GGR', sourcePackId: '5etools-cn' }],
  };
  const html = renderBuilder();
  expect(html).not.toContain('>命令术<');
  expect(html).toContain('未加载或未启用对应来源');
});
it('第三方背景仅引用自身包或官方包，不跨第三方借用同名内容', () => {
  const custom = catalogEntryToBackground(
    normalizeBackground(
      {
        name: 'Custom BG',
        source: 'CUSTOM',
        additionalSpells: [{ expanded: { s1: ['独有法术|CUSTOM', '命令术'] } }],
      },
      'homebrew-a',
    ),
  );
  const own = spell('独有法术', 1, 'CUSTOM', 'homebrew-a');
  const other = spell('独有法术', 1, 'CUSTOM', 'homebrew-b');
  expect([...resolveBackgroundSpellList(custom, [own, other, command]).spellIds]).toEqual([
    own.id,
    command.id,
  ]);
  expect(resolveBackgroundSpellList(custom, [other]).spellIds.size).toBe(0);
});
it('不把known/prepared/innate误作扩展，未知结构保留诊断且不崩溃', () => {
  const raw = [
    {
      known: { '1': ['命令术'] },
      prepared: { '1': ['命令术'] },
      innate: { '1': ['命令术'] },
      expanded: { s1: [{ choose: { from: ['命令术'] } }], bad: ['命令术'] },
    },
  ];
  const original = JSON.stringify(raw);
  const result = parseBackgroundSpellList(raw);
  expect(result.expandedSpells).toEqual([]);
  expect(result.spellListDiagnostics).toHaveLength(2);
  expect(JSON.stringify(raw)).toBe(original);
});
it('不施法的职业不能因背景产生施法与免费法术', () => {
  const fighter = normalizeClass({
    name: 'Background Noncaster',
    source: 'PHB',
    classFeatures: [],
    progression: [{ level: 1, proficiencyBonus: 2, features: [] }],
  });
  defaultCatalog.register(fighter);
  control.activeClassId = fighter.id;
  control.state.classes = [{ classId: fighter.id, level: 1 }];
  expect(renderBuilder()).toContain('尚未具备施法能力');
  expect(deriveCharacterSpellSelection(control.state).preparedSpellIds).toEqual([]);
});
it('第三方同名书籍未加载时不改用官方同名书籍', () => {
  const custom = { ...background, source: 'PHB', sourcePackId: 'homebrew-shadow' };
  expect(resolveBackgroundSpellList(custom, [command]).spellIds.size).toBe(0);
});
it('去重引用；多组关系不明时提示核对，不合并为全部法术', () => {
  expect(
    parseBackgroundSpellList([{ expanded: { s1: ['命令术', '命令术'] } }]).expandedSpells,
  ).toHaveLength(1);
  const result = parseBackgroundSpellList([
    { expanded: { s1: ['命令术'] } },
    { expanded: { s1: ['诱捕打击'] } },
  ]);
  expect(result.expandedSpells).toEqual([]);
  expect(result.spellListDiagnostics).toHaveLength(1);
});

it.each([
  { filter: 'class:restricted caster;school:E;level:1', count: 2 },
  { filter: 'class:restricted caster;school:V;level:1', count: 1 },
  { filter: 'class:another caster;school:E;level:1', count: 1 },
])('扩展不绕过特性选择约束：$filter', ({ filter, count }) => {
  const base = caster('Restricted Caster');
  defaultCatalog.register({
    ...base,
    raw: {
      ...base.raw,
      features: [
        {
          name: '受限额外选择',
          level: 1,
          description: '',
          mechanics: {
            choices: [
              {
                id: 'restricted-extra',
                type: 'spell',
                numToChoose: 1,
                filter,
              },
            ],
          },
        },
      ],
    },
  });
  control.activeClassId = base.id;
  control.state.classes = [{ classId: base.id, level: 1 }];
  const buttons = renderBuilder().match(/<button\b[^>]*>[\s\S]*?<\/button>/g) || [];
  expect(buttons.filter((button) => button.includes('命令术'))).toHaveLength(count);
});
