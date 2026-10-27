import { expect, it } from 'vitest';
import { defaultCatalog } from '@/catalog/catalog';
import { normalizeClass, normalizeSubclass } from '@/source/fiveetools-cn/normalizers/class';
import { normalizeSpell } from '@/source/fiveetools-cn/normalizers/spell';
import {
  computeSpellcasting,
  computeSpellProgression,
  deriveCharacterSpellSelection,
} from '../spellcasting';
import { getClassDefinition } from '../characterData';
import type { CharacterState } from '@/types/characterState';

it.each([
  ['XPHB', 'preparedSpellsProgression'],
  ['PHB', 'spellsKnownProgression'],
] as const)('原生三分之一施法 %s 逐级、兼职与来源法表', (source, countField) => {
  const parent = normalizeClass({ name: '测试战士', ENG_name: 'Fixture Fighter', source });
  const child = normalizeSubclass({
    name: '测试奥法骑士',
    ENG_name: 'Fixture Knight',
    shortName: 'Fixture Knight',
    source,
    className: 'Fixture Fighter',
    classSource: source,
    subclassFeatures: [`子职入口|Fixture Fighter|${source}|Fixture Knight|${source}|3`],
    casterProgression: '1/3',
    spellcastingAbility: 'int',
    cantripProgression: [0, 0, 2, 2, 2, 2, 2, 2],
    [countField]: [0, 0, 3, 4, 4, 4, 5, 6],
    subclassTableGroups: [{ rowsSpellProgression: [[0], [0], [2], [3], [3], [3], [4, 2], [4, 2]] }],
    additionalSpells: {
      expanded: { 3: [{ all: 'level=0|class=法师' }] },
      ...(source === 'PHB' ? { known: { 3: ['法师之手|PHB#c'] } } : {}),
    },
  });
  const mageHand = normalizeSpell({ name: '法师之手', source: 'PHB', level: 0, classes: ['法师'] });
  defaultCatalog.registerMany([
    parent,
    child,
    mageHand,
    {
      ...parent,
      id: `fixture:subclass-feature:${source}`,
      kind: 'subclassFeature',
      name: '子职入口',
      raw: {
        name: '子职入口',
        source,
        className: 'Fixture Fighter',
        classSource: source,
        subclassShortName: 'Fixture Knight',
        subclassSource: source,
        level: 3,
        entries:
          source === 'PHB'
            ? [
                '你习得三个自选的1环法师法术，其中两个必须从防护系和塑能系中选择。',
                '你只能选择防护系或塑能系法术。',
                '在第8、14和20级时，你可以学习任何学派的法术。',
              ]
            : [],
      },
    },
  ]);
  const character = (level: number): CharacterState =>
    ({
      id: 'third-caster-test',
      name: '测试角色',
      playerName: '',
      classes: [{ classId: parent.id, source, level, subclassId: child.id, isMulticlass: false }],
      baseAbilityScores: { str: 10, dex: 10, con: 10, int: 16, wis: 10, cha: 10 },
      backgroundAbilityBonuses: {},
      selectedFeats: [],
      selectedSkills: [],
      expertiseSkills: [],
      selectedLanguages: [],
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
    }) as CharacterState;
  expect(getClassDefinition(parent.id)?.subClassInfo?.options[0].spellcasting?.listClasses).toEqual(
    ['法师'],
  );
  expect(computeSpellcasting(character(2)).spellSlots).toEqual({});
  expect(computeSpellProgression(character(2), parent.id)).toEqual([]);
  expect(computeSpellcasting(character(3))).toMatchObject({
    casterLevel: 1,
    cantripsKnown: 2,
    spellsPrepared: 3,
    spellSlots: { 1: 2 },
    abilityKey: 'int',
  });
  expect(
    computeSpellProgression(character(3), parent.id).find((step) => step.level === 3),
  ).toMatchObject({
    newCantrips: source === 'PHB' ? 1 : 2,
    newSpells: source === 'PHB' ? 2 : 3,
    maxSpellLevel: 1,
    allowedClasses: expect.arrayContaining(['法师']),
  });
  const level3 = computeSpellProgression(character(3), parent.id).find((step) => step.level === 3)!;
  if (source === 'PHB') {
    expect(level3.filter).toBe('school:防护系,塑能系');
    expect(level3.extraChoices).toMatchObject([
      { numToChoose: 1, ignoreStepFilter: true, filter: 'class:法师;level:1-1' },
    ]);
    expect(level3.nativeAlwaysPreparedSpells).toEqual([mageHand.id]);
    expect(deriveCharacterSpellSelection(character(3)).cantripIds).toContain(mageHand.id);
    expect(
      computeSpellProgression(character(8), parent.id).find((step) => step.level === 8),
    ).toMatchObject({ newSpells: 0, extraChoices: [{ numToChoose: 1, ignoreStepFilter: true }] });
  } else {
    expect(level3.filter).toBeUndefined();
    expect(level3.extraChoices).toEqual([]);
  }
  expect(computeSpellcasting(character(7))).toMatchObject({
    casterLevel: 2,
    spellsPrepared: 5,
    spellSlots: { 1: 4, 2: 2 },
  });
  const wizard = normalizeClass({
    name: '法师',
    ENG_name: 'Wizard',
    source,
    casterProgression: 'full',
    classTableGroups: [{ rowsSpellProgression: [[2]] }],
    preparedSpellsProgression: [1],
  });
  defaultCatalog.register(wizard);
  const multiclass = character(3);
  multiclass.classes.push({ classId: wizard.id, source, level: 1, isMulticlass: true });
  expect(computeSpellcasting(multiclass)).toMatchObject({ casterLevel: 2, spellSlots: { 1: 3 } });
});
