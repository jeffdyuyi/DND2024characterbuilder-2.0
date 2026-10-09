import { describe, it, expect } from 'vitest';
import { computeAbilityScores } from '../ability';
import { computeCombatStats } from '../combat';
import { computeProficiencies } from '../proficiency';
import { computeSpellcasting } from '../spellcasting';
import { CharacterState } from '../../types/characterState';
import { defaultCatalog } from '@/catalog';
import { normalizeItem } from '@/source/fiveetools-cn/normalizers/item';
import { getAttunementStatus } from '../characterData';
import { makeEntryId } from '@/catalog/identity';

const baseCharacterState = (): Omit<CharacterState, 'id' | 'name' | 'playerName' | 'classes' | 'baseAbilityScores' | 'backgroundAbilityBonuses'> => ({
  selectedFeats: [],
  selectedSkills: [],
  expertiseSkills: [],
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
  selectedLanguages: [],
});

describe('Engine: Ability Scores', () => {
  it('should compute default ability scores correctly', () => {
    const defaultState: CharacterState = {
      id: '1',
      name: 'Test',
      playerName: '',
      classes: [],
      baseAbilityScores: { str: 10, dex: 12, con: 14, int: 8, wis: 15, cha: 16 },
      backgroundAbilityBonuses: { str: 2, dex: 1 },
      ...baseCharacterState(),
    };

    const result = computeAbilityScores(defaultState);

    expect(result.scores.str).toBe(12); // 10 + 2
    expect(result.scores.dex).toBe(13); // 12 + 1
    expect(result.scores.con).toBe(14);
    
    // Modifiers: (score - 10) / 2 floored
    expect(result.modifiers.str).toBe(1);
    expect(result.modifiers.dex).toBe(1);
    expect(result.modifiers.con).toBe(2);
    expect(result.modifiers.int).toBe(-1); // 8 -> -1
    expect(result.modifiers.wis).toBe(2);  // 15 -> 2
    expect(result.modifiers.cha).toBe(3);  // 16 -> 3
  });

  it('should cap ability scores at 20', () => {
    const maxedState: CharacterState = {
      id: '2',
      name: 'Maxed',
      playerName: '',
      classes: [],
      baseAbilityScores: { str: 18, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      backgroundAbilityBonuses: { str: 4 }, // 18 + 4 = 22 -> 20
      ...baseCharacterState(),
    };

    const result = computeAbilityScores(maxedState);
    expect(result.scores.str).toBe(20);
    expect(result.modifiers.str).toBe(5);
  });

  it('applies attuned magic item ability settings and AC bonuses', () => {
    const itemEntry = normalizeItem({
      name: '测试巨力护符', ENG_name: 'Test Strength Charm', source: 'DMG',
      ability: { str: 19 }, bonusAc: '+1', reqAttune: true,
    }, 'engine-test');
    defaultCatalog.register(itemEntry);
    const state: CharacterState = {
      id: 'magic-item-test', name: 'Magic', playerName: '', classes: [],
      baseAbilityScores: { str: 8, dex: 14, con: 10, int: 10, wis: 10, cha: 10 },
      backgroundAbilityBonuses: {}, ...baseCharacterState(),
      inventoryEntries: [{ id: 'inventory-charm', name: '测试巨力护符', itemId: itemEntry.id, equipped: true }],
      attunedItemIds: ['inventory-charm'],
    };

    expect(computeAbilityScores(state).scores.str).toBe(19);
    expect(computeCombatStats(state).ac).toBe(13);

    state.attunedItemIds = [];
    expect(computeAbilityScores(state).scores.str).toBe(8);
    expect(computeCombatStats(state).ac).toBe(12);
  });
});

describe('Engine: Combat Stats', () => {
  it('should compute initiative based on dexterity', () => {
    const dexState: CharacterState = {
      id: '3',
      name: 'Rogue',
      playerName: '',
      classes: [],
      baseAbilityScores: { str: 8, dex: 18, con: 14, int: 8, wis: 10, cha: 12 },
      backgroundAbilityBonuses: {},
      ...baseCharacterState(),
    };

    const stats = computeCombatStats(dexState);
    expect(stats.initiative).toBe(4); // dex 18 -> mod 4
    expect(stats.ac).toBe(14); // 10 + 4
  });

  it('should compute default HP fallback when no classes', () => {
    const noClassState: CharacterState = {
      id: '4',
      name: 'Commoner',
      playerName: '',
      classes: [],
      baseAbilityScores: { str: 10, dex: 10, con: 12, int: 10, wis: 10, cha: 10 },
      backgroundAbilityBonuses: {},
      ...baseCharacterState(),
    };

    const stats = computeCombatStats(noClassState);
    expect(stats.hp.max).toBe(11); // 10 + con(1)
  });

  it('should compute basic multi-level HP assuming d8 for now', () => {
    const lvState: CharacterState = {
      id: '5',
      name: 'Cleric',
      playerName: '',
      classes: [
        { classId: 'cleric', level: 3, isMulticlass: false, source: 'PHB2024' }
      ],
      baseAbilityScores: { str: 10, dex: 10, con: 16, int: 10, wis: 10, cha: 10 },
      backgroundAbilityBonuses: {},
      ...baseCharacterState(),
    };

    const stats = computeCombatStats(lvState);
    // d8职业：1级 8+3，2/3级按平均值 5+3，共 27
    expect(stats.hp.max).toBe(27);
  });
});

describe('Engine: Proficiencies', () => {
  it('should aggregate skills and detect duplicates', () => {
    const profState: CharacterState = {
      id: '6',
      name: 'Skillful',
      playerName: '',
      classes: [],
      baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      backgroundAbilityBonuses: {},
      ...baseCharacterState(),
      selectedSkills: ['stealth', 'stealth', 'acrobatics'],
    };

    const result = computeProficiencies(profState);
    
    expect(result.skills.length).toBe(2);
    expect(result.duplicates['skills:stealth']).toBeDefined();
    expect(result.duplicates['skills:stealth'].length).toBe(2);
  });
});

describe('Engine: Spellcasting', () => {
  it('should use class progression spell slots for core casters', () => {
    defaultCatalog.register({
      id: 'test:class:xphb:wizard', kind: 'class', name: '法师', englishName: 'Wizard',
      source: 'XPHB', edition: '2024', sourcePackId: 'engine-test',
      raw: { hd: { faces: 6 }, spellcastingAbility: 'Intelligence', casterProgression: 'full', features: [], progression: [
        { level: 1, featuresUnlocked: [], spellcasting: { cantripsKnown: 3, spellSlots: { level1: 2 } } },
        { level: 2, featuresUnlocked: [], spellcasting: { cantripsKnown: 3, spellSlots: { level1: 3 } } },
        { level: 3, featuresUnlocked: [], spellcasting: { cantripsKnown: 3, spellSlots: { level1: 4, level2: 2 } } },
      ] },
    });
    const wizardState: CharacterState = {
      id: '7',
      name: 'Wizard',
      playerName: '',
      classes: [{ classId: 'Wizard', level: 3, isMulticlass: false, source: 'XPHB' }],
      baseAbilityScores: { str: 8, dex: 14, con: 12, int: 16, wis: 10, cha: 10 },
      backgroundAbilityBonuses: {},
      ...baseCharacterState(),
    };

    const stats = computeSpellcasting(wizardState);
    expect(stats.casterLevel).toBe(3);
    expect(stats.cantripsKnown).toBe(3);
    expect(stats.spellSlots[1]).toBe(4);
    expect(stats.spellSlots[2]).toBe(2);
  });

  it('applies spell DC and attack bonuses from attuned items', () => {
    const focus = normalizeItem({
      name: '测试奥术法器', ENG_name: 'Test Arcane Focus', source: 'DMG',
      bonusSpellSaveDc: '+2', bonusSpellAttack: '+1', reqAttune: true,
    }, 'engine-test');
    defaultCatalog.register(focus);
    const state: CharacterState = {
      id: 'spell-item-test', name: 'Wizard', playerName: '',
      classes: [{ classId: 'Wizard', level: 3, isMulticlass: false, source: 'XPHB' }],
      baseAbilityScores: { str: 8, dex: 14, con: 12, int: 16, wis: 10, cha: 10 },
      backgroundAbilityBonuses: {}, ...baseCharacterState(),
      inventoryEntries: [{ id: 'inventory-focus', name: '测试奥术法器', itemId: focus.id, equipped: true }],
      attunedItemIds: ['inventory-focus'],
    };

    const stats = computeSpellcasting(state);
    expect(stats.spellSaveDcBonus).toBe(2);
    expect(stats.spellAttackBonus).toBe(1);
    expect(stats.spellDcTrace).toContain('测试奥术法器: +2');
    expect(stats.spellAttackTrace).toContain('测试奥术法器: +1');

    state.inventoryEntries[0].equipped = false;
    expect(computeSpellcasting(state).spellSaveDcBonus).toBe(0);
  });
});

describe('Engine: Attunement', () => {
  it('counts only attunement-required magic items and applies feature limits', () => {
    defaultCatalog.register({
      id: 'test:class:xphb:rogue', kind: 'class', name: '游荡者', englishName: 'Rogue',
      source: 'XPHB', edition: '2024', sourcePackId: 'engine-test',
      raw: { hd: { faces: 8 }, progression: [], features: [{ name: '使用魔法装置', nameEn: 'Use Magic Device', level: 13, mechanics: { attunementLimit: 4 } }] },
    });
    defaultCatalog.register({
      id: makeEntryId({ packId: 'test-public', kind: 'subclassFeature', source: 'XPHB', name: 'Use Magic Device', parent: 'Rogue:Thief', level: 13 }),
      kind: 'subclassFeature', name: '使用魔法装置', englishName: 'Use Magic Device',
      source: 'XPHB', edition: '2024', sourcePackId: 'test-public',
      raw: { className: '游荡者', classSource: 'XPHB', subclassShortName: '盗贼', level: 13 },
      entries: [{ name: '同调', entries: ['你最多可以同时同调于四个魔法物品。'] }],
    });
    const requiredItems = [1, 2, 3, 4].map((index) => normalizeItem({
      name: `测试同调物品 ${index}`, source: 'DMG', reqAttune: true,
    }, 'attunement-test'));
    const freeItem = normalizeItem({ name: '测试无需同调物品', source: 'DMG' }, 'attunement-test');
    requiredItems.forEach((entry) => defaultCatalog.register(entry));
    defaultCatalog.register(freeItem);

    const inventoryEntries = [...requiredItems, freeItem].map((entry, index) => ({
      id: `inventory-${index}`, name: entry.name, itemId: entry.id,
    }));
    const state: CharacterState = {
      id: 'attunement-test', name: 'Thief', playerName: '',
      classes: [{ classId: 'Rogue', subclassId: 'Thief', level: 12, isMulticlass: false, source: 'XPHB' }],
      baseAbilityScores: { str: 10, dex: 16, con: 12, int: 10, wis: 10, cha: 10 },
      backgroundAbilityBonuses: {}, ...baseCharacterState(), inventoryEntries,
      attunedItemIds: inventoryEntries.map((entry) => entry.id),
    };

    expect(getAttunementStatus(state)).toEqual({ limit: 3, count: 4, overLimit: true });
    state.classes[0].level = 13;
    expect(getAttunementStatus(state)).toEqual({ limit: 4, count: 4, overLimit: false });
  });

  it('recognizes expertise from classSelections in computeProficiencies', () => {
    const state: CharacterState = {
      id: 'test-exp',
      name: 'Rogue',
      playerName: '',
      classes: [{ classId: 'Rogue', level: 1, isMulticlass: false, source: 'XPHB' }],
      baseAbilityScores: { str: 10, dex: 16, con: 12, int: 10, wis: 10, cha: 10 },
      backgroundAbilityBonuses: {},
      ...baseCharacterState(),
      selectedSkills: ['stealth', 'sleightOfHand'],
      classSelections: {
        'cls:rogue:feat:专精:expertise-rogue-1': ['stealth', 'sleightOfHand'],
      },
    };

    const profs = computeProficiencies(state);
    const stealthProfs = profs.skills.filter(s => s.id === 'stealth');
    expect(stealthProfs.some(s => s.sources.includes('Expertise Selection'))).toBe(true);
  });
});

