import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { defaultCatalog } from '@/catalog/catalog';
import { normalizeClass, normalizeSubclass } from '@/source/fiveetools-cn/normalizers/class';
import { normalizeSpell } from '@/source/fiveetools-cn/normalizers/spell';
import type { CatalogEntry } from '@/catalog/types';
import type { CharacterState } from '@/types/characterState';
import { getSpellDefinition, getSubclassDefinition } from '../characterData';
import {
  buildSpellSourceMap,
  computeSpellcasting,
  deriveCharacterSpellSelection,
  getInnateSpells,
} from '../spellcasting';
import { exportToJSON, importFromJSON } from '../importExport';
import SpellsTab from '@/app/sheet/[id]/tabs/SpellsTab';

function setup(mode: 'native' | 'inline') {
  const spells = ['首职法术', '兼职法术', '兼职后续法术'].map((name) =>
    normalizeSpell({
      name: `${mode}${name}`,
      source: 'TST',
      level: 1,
      school: 'E',
      entries: [],
    }),
  );
  defaultCatalog.registerMany(spells);
  const classes = [0, 1].map((index) => {
    const className = `${mode}职业${index}`;
    const childName = `${mode}子职业${index}`;
    const levels = index === 0 ? [1] : [1, 3];
    const traits = levels.map((level, featureIndex) => ({
      name: `${childName}特性${level}`,
      nameEn: `${childName}特性${level}`,
      level,
      description: '',
      mechanics: {
        spells: [
          {
            spells: [spells[index + featureIndex].id],
            prepared: true,
          },
        ],
      },
    }));
    const child = normalizeSubclass({
      name: childName,
      source: 'PHB',
      className,
      classSource: 'PHB',
      shortName: childName,
      ...(mode === 'native'
        ? {
            subclassFeatures: traits.map(
              (trait) => `${trait.name}|${className}|PHB|${childName}|PHB|${trait.level}`,
            ),
          }
        : { traits }),
    });
    const parent = normalizeClass({
      name: className,
      source: 'PHB',
      ...(mode === 'inline'
        ? {
            subClassInfo: {
              unlockLevel: 1,
              options: [
                {
                  catalogId: child.id,
                  name: childName,
                  nameEn: childName,
                  description: '',
                  source: 'PHB',
                  traits,
                },
              ],
            },
          }
        : {}),
    });
    defaultCatalog.registerMany([parent, child]);
    if (mode === 'native')
      traits.forEach((trait) =>
        defaultCatalog.register({
          id: `test:${mode}:subclassFeature:${index}:${trait.level}`,
          kind: 'subclassFeature',
          name: trait.name,
          source: 'PHB',
          edition: '2014',
          sourcePackId: '5etools-cn',
          raw: {
            ...trait,
            source: 'PHB',
            className,
            classSource: 'PHB',
            subclassShortName: childName,
            subclassSource: 'PHB',
          },
        } satisfies CatalogEntry),
      );
    return {
      classId: parent.id,
      source: 'PHB',
      level: index === 0 ? 10 : 1,
      isMulticlass: index > 0,
      subclassId: child.id,
    };
  });
  const state: CharacterState = {
    id: `subclass-spells-${mode}`,
    name: '测试',
    playerName: '',
    classes,
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
    cantripIds: [],
    preparedSpellIds: [],
    knownSpellIds: [],
    spellbookIds: [],
    spellSlotUsage: {},
    resourceUsage: {},
    selectedLanguages: [],
  };
  return { state, spells };
}

it.each(['native', 'inline'] as const)('%s双职业分别使用各自子职业及其职业等级', (mode) => {
  const { state, spells } = setup(mode);
  const before = JSON.stringify(state);
  const grants = getInnateSpells(state);
  expect(grants.map((grant) => grant.spellId)).toEqual([spells[0].id, spells[1].id]);
  expect(grants.map((grant) => grant.source)).toEqual([
    `子职业: ${mode}子职业0`,
    `子职业: ${mode}子职业1`,
  ]);
  expect(grants.map((grant) => grant.spellId)).not.toContain(spells[2].id);
  expect(JSON.stringify(state)).toBe(before);
  // 成熟的单参数查询继续代表首职业，卡面和其他原有调用语义不变。
  expect(getSubclassDefinition(state)?.name).toBe(`${mode}子职业0`);
});

it.each(['native', 'inline'] as const)('%s首职业无子职业时仍能解析兼职子职业', (mode) => {
  const { state, spells } = setup(mode);
  delete state.classes[0].subclassId;
  expect(getInnateSpells(state).map((grant) => grant.spellId)).toEqual([spells[1].id]);
  expect(getSubclassDefinition(state)).toBeUndefined();
});

it.each(['native', 'inline'] as const)('%s兼职升级、回退、移除均按现有记录重算', (mode) => {
  const { state, spells } = setup(mode);
  state.classes[1].level = 3;
  expect(deriveCharacterSpellSelection(state).preparedSpellIds).toEqual(
    spells.map((spell) => spell.id),
  );
  state.classes[1].level = 1;
  expect(deriveCharacterSpellSelection(state).preparedSpellIds).toEqual([
    spells[0].id,
    spells[1].id,
  ]);
  state.classes = [state.classes[0]];
  expect(deriveCharacterSpellSelection(state).preparedSpellIds).toEqual([spells[0].id]);
});

it.each(['native', 'inline'] as const)('%s单职业兼容且职业顺序变化不互相套用子职业', (mode) => {
  const { state, spells } = setup(mode);
  const single = { ...state, classes: [state.classes[1]] };
  expect(getInnateSpells(single).map((grant) => grant.spellId)).toEqual([spells[1].id]);
  state.classes.reverse();
  expect(getInnateSpells(state).map((grant) => grant.spellId)).toEqual([
    spells[1].id,
    spells[0].id,
  ]);
});

it('JSON往返后兼职法术进入最终唯一ID及实际法术卡面，手动列表不被修改', async () => {
  const { state, spells } = setup('native');
  state.preparedSpellIds = ['manual-unresolved-spell'];
  const saved = await importFromJSON(exportToJSON(state));
  const before = JSON.stringify(saved);
  const derived = deriveCharacterSpellSelection(saved);
  expect(JSON.stringify(saved)).toBe(before);
  expect(saved.preparedSpellIds).toEqual(['manual-unresolved-spell']);
  const map = buildSpellSourceMap(getInnateSpells(saved), derived.preparedSpellIds, '职业');
  const html = renderToStaticMarkup(
    <SpellsTab
      character={{ ...saved, ...derived }}
      spellcasting={computeSpellcasting(saved)}
      primaryClass={undefined}
      cantripDetails={[]}
      spellDetails={derived.preparedSpellIds.map(getSpellDefinition)}
      spellbookDetails={[]}
      spellSourceMap={map}
      spellSlotUsage={{}}
      updateActiveCharacter={() => {}}
      router={{ push() {} }}
      id={saved.id}
    />,
  );
  expect(html.split(spells[0].name)).toHaveLength(2);
  expect(html.split(spells[1].name)).toHaveLength(2);
  expect(html).not.toContain(spells[2].name);
  expect(html).toContain('子职业: native子职业1');
});
