import { describe, it, expect } from 'vitest';
import { getClassOverlay, getSubclassOverlay, getRaceOverlay, mergeOverlay } from '../index';
import { CatalogEntry } from '@/catalog/types';
import { defaultCatalog } from '@/catalog/catalog';
import { catalogEntryToClass } from '@/catalog/adapters/classes';
import { catalogEntryToSpecies } from '@/catalog/adapters/species';
import { computeCombatStats } from '@/engine/combat';
import { computeSpellcasting } from '@/engine/spellcasting';
import { CharacterState } from '@/types/characterState';

const baseCharacterState = (): Omit<
  CharacterState,
  'id' | 'name' | 'playerName' | 'classes' | 'baseAbilityScores'
> => ({
  backgroundAbilityBonuses: {},
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

describe('Phase B: Mechanics Overlay 覆盖层与机制注入', () => {
  describe('1. 职业与子职业施法类型标注（中英文双映射）', () => {
    const expectations = [
      { name: 'Wizard', zh: '法师', type: 'full', ability: 'Intelligence' },
      { name: 'Sorcerer', zh: '术士', type: 'full', ability: 'Charisma' },
      { name: 'Bard', zh: '吟游诗人', type: 'full', ability: 'Charisma' },
      { name: 'Cleric', zh: '牧师', type: 'full', ability: 'Wisdom' },
      { name: 'Druid', zh: '德鲁伊', type: 'full', ability: 'Wisdom' },
      { name: 'Ranger', zh: '游侠', type: 'half', ability: 'Wisdom' },
      { name: 'Paladin', zh: '圣武士', type: 'half', ability: 'Charisma' },
      { name: 'Artificer', zh: '奇械师', type: 'half', ability: 'Intelligence' },
      { name: 'Warlock', zh: '邪术师', type: 'warlock', ability: 'Charisma' },
    ];

    for (const exp of expectations) {
      it(`正确识别核心职业施法类型: ${exp.name} / ${exp.zh}`, () => {
        const enOverlay = getClassOverlay(exp.name);
        const zhOverlay = getClassOverlay(exp.zh);

        expect(enOverlay?.spellcastingType).toBe(exp.type);
        expect(zhOverlay?.spellcastingType).toBe(exp.type);
        expect(enOverlay?.spellcastingAbility).toBe(exp.ability);
      });
    }

    it('正确识别战士子职奥术骑士 (Eldritch Knight) 为 1/3 施法者', () => {
      const en = getSubclassOverlay('Eldritch Knight');
      const zh = getSubclassOverlay('奥术骑士');
      expect(en?.spellcastingType).toBe('third');
      expect(zh?.spellcastingType).toBe('third');
      expect(en?.spellcastingAbility).toBe('Intelligence');
    });

    it('正确识别游荡者子职诡术师 (Arcane Trickster) 为 1/3 施法者', () => {
      const en = getSubclassOverlay('Arcane Trickster');
      const zh = getSubclassOverlay('诡术盗贼');
      expect(en?.spellcastingType).toBe('third');
      expect(zh?.spellcastingType).toBe('third');
      expect(en?.spellcastingAbility).toBe('Intelligence');
    });
  });

  describe('2. 特殊无甲防御公式覆盖（5个关键来源）', () => {
    it('野蛮人 (Barbarian) 无甲防御 = 10 + 敏 + 体', () => {
      const overlay = getClassOverlay('Barbarian');
      const trait = overlay?.features?.find((f) => f.nameEn === 'Unarmored Defense');
      expect(trait).toBeDefined();
      expect(trait?.mechanics.acCalculation?.base).toBe(10);
      expect(trait?.mechanics.acCalculation?.modifiers).toContain('dex');
      expect(trait?.mechanics.acCalculation?.modifiers).toContain('con');
      expect(trait?.mechanics.acCalculation?.canUseShield).toBe(true);
    });

    it('武僧 (Monk) 无甲防御 = 10 + 敏 + 感，且不可用盾牌', () => {
      const overlay = getClassOverlay('Monk');
      const trait = overlay?.features?.find((f) => f.nameEn === 'Unarmored Defense');
      expect(trait).toBeDefined();
      expect(trait?.mechanics.acCalculation?.base).toBe(10);
      expect(trait?.mechanics.acCalculation?.modifiers).toContain('dex');
      expect(trait?.mechanics.acCalculation?.modifiers).toContain('wis');
      expect(trait?.mechanics.acCalculation?.canUseShield).toBe(false);
    });

    it('龙族血统术士 (Draconic Resilience) = 13 + 敏', () => {
      const overlay = getSubclassOverlay('Draconic Sorcery');
      const trait = overlay?.traits?.find((t) => t.nameEn === 'Draconic Resilience');
      expect(trait).toBeDefined();
      expect(trait?.mechanics.acCalculation?.base).toBe(13);
      expect(trait?.mechanics.acCalculation?.modifiers).toContain('dex');
      expect(trait?.mechanics.acCalculation?.canUseShield).toBe(true);
    });

    it('蜥蜴人 (Lizardfolk) 天然护甲 = 13 + 敏', () => {
      const overlay = getRaceOverlay('Lizardfolk');
      const trait = overlay?.traits?.find((t) => t.nameEn === 'Natural Armor');
      expect(trait).toBeDefined();
      expect(trait?.mechanics.acCalculation?.base).toBe(13);
      expect(trait?.mechanics.acCalculation?.modifiers).toContain('dex');
    });

    it('龟人 (Tortle) 天然护甲 = 17 固定', () => {
      const overlay = getRaceOverlay('Tortle');
      const trait = overlay?.traits?.find((t) => t.nameEn === 'Natural Armor');
      expect(trait).toBeDefined();
      expect(trait?.mechanics.acCalculation?.base).toBe(17);
      expect(trait?.mechanics.acCalculation?.modifiers).toEqual([]);
    });
  });

  describe('3. 属性上限突破覆盖 (Barbarian Primal Champion)', () => {
    it('野蛮人 20 级特性突破 STR/CON 上限至 24', () => {
      const overlay = getClassOverlay('Barbarian');
      const capstone = overlay?.features?.find((f) => f.nameEn === 'Primal Champion');
      expect(capstone).toBeDefined();
      expect(capstone?.mechanics.statMaxIncrease?.str).toBe(24);
      expect(capstone?.mechanics.statMaxIncrease?.con).toBe(24);
      expect(capstone?.mechanics.statBonus?.str).toBe(4);
    });
  });

  describe('4. 端到端规则引擎计算回归验证 (防退化基石)', () => {
    it('野蛮人无甲防御计算验证: 敏捷14(+2) + 体质16(+3) -> AC 15', () => {
      const rawEntry: CatalogEntry = {
        id: '5etools:class:phb:barbarian',
        kind: 'class',
        name: '野蛮人',
        englishName: 'Barbarian',
        source: 'PHB',
        edition: '2024',
        sourcePackId: '5etools-cn',
        raw: {
          name: 'Barbarian',
          hd: { faces: 12 },
          classFeature: [{ name: 'Unarmored Defense', nameEn: 'Unarmored Defense', level: 1 }],
        },
      };

      const merged = mergeOverlay(rawEntry);
      defaultCatalog.register(merged);
      (defaultCatalog as any).registerAlias('barbarian', merged.id);

      const classDef = catalogEntryToClass(merged);
      const uDef = classDef.features.find(
        (f) => f.nameEn === 'Unarmored Defense' || f.name === '无甲防御',
      );
      expect(uDef?.mechanics?.acCalculation).toBeDefined();
      expect(uDef?.mechanics?.acCalculation?.base).toBe(10);
      expect(uDef?.mechanics?.acCalculation?.modifiers).toContain('dex');
      expect(uDef?.mechanics?.acCalculation?.modifiers).toContain('con');

      const state: CharacterState = {
        id: '1',
        name: 'Conan',
        playerName: '',
        baseAbilityScores: { str: 16, dex: 14, con: 16, int: 8, wis: 10, cha: 10 },
        activeConditions: ['未着装护甲'],
        classes: [{ classId: 'Barbarian', level: 1, source: 'PHB', isMulticlass: false }],
        ...baseCharacterState(),
      };

      const combat = computeCombatStats(state);
      expect(combat.ac).toBe(15);
    });

    it('武僧无甲防御计算验证: 敏捷16(+3) + 感知16(+3) -> AC 16', () => {
      const rawEntry: CatalogEntry = {
        id: '5etools:class:phb:monk',
        kind: 'class',
        name: '武僧',
        englishName: 'Monk',
        source: 'PHB',
        edition: '2024',
        sourcePackId: '5etools-cn',
        raw: {
          name: 'Monk',
          hd: { faces: 8 },
          classFeature: [{ name: 'Unarmored Defense', nameEn: 'Unarmored Defense', level: 1 }],
        },
      };

      const merged = mergeOverlay(rawEntry);
      defaultCatalog.register(merged);
      (defaultCatalog as any).registerAlias('monk', merged.id);

      const classDef = catalogEntryToClass(merged);
      const uDef = classDef.features.find(
        (f) => f.nameEn === 'Unarmored Defense' || f.name === '无甲防御',
      );
      expect(uDef?.mechanics?.acCalculation?.modifiers).toContain('wis');

      const state: CharacterState = {
        id: '2',
        name: 'Lee',
        playerName: '',
        baseAbilityScores: { str: 10, dex: 16, con: 12, int: 10, wis: 16, cha: 8 },
        activeConditions: ['未着装护甲'],
        classes: [{ classId: 'Monk', level: 1, source: 'PHB', isMulticlass: false }],
        ...baseCharacterState(),
      };

      const combat = computeCombatStats(state);
      expect(combat.ac).toBe(16);
    });

    it('龙族血统术士计算验证: 敏捷16(+3) -> AC 16 (13 + 3)', () => {
      const rawSubEntry: CatalogEntry = {
        id: '5etools:subclass:phb:draconic-sorcery',
        kind: 'subclass',
        name: '龙族术法',
        englishName: 'Draconic Sorcery',
        source: 'PHB',
        edition: '2024',
        sourcePackId: '5etools-cn',
        raw: {
          className: 'Sorcerer',
        },
      };

      const mergedSub = mergeOverlay(rawSubEntry);
      defaultCatalog.register(mergedSub);
      defaultCatalog.register({
        id: 'test:class:phb:sorcerer',
        kind: 'class',
        name: '术士',
        englishName: 'Sorcerer',
        source: 'PHB',
        edition: '2024',
        sourcePackId: 'overlay-test',
        raw: {
          hd: { faces: 6 },
          progression: [],
          features: [],
          subClassInfo: {
            unlockLevel: 3,
            options: [
              {
                catalogId: mergedSub.id,
                name: mergedSub.name,
                nameEn: mergedSub.englishName,
                traits: (mergedSub.raw as any).traits || [],
              },
            ],
          },
        },
      });
      (defaultCatalog as any).registerAlias('draconic sorcery', mergedSub.id);
      (defaultCatalog as any).registerAlias('draconic-sorcery', mergedSub.id);

      const subTraits = (mergedSub.raw as any)?.traits || [];
      expect(subTraits.length).toBeGreaterThan(0);
      const trait = subTraits[0];
      expect(trait.mechanics?.acCalculation?.base).toBe(13);

      const state: CharacterState = {
        id: '3',
        name: 'Draco',
        playerName: '',
        baseAbilityScores: { str: 8, dex: 16, con: 14, int: 10, wis: 12, cha: 16 },
        classes: [
          {
            classId: 'Sorcerer',
            subclassId: 'draconic-sorcery',
            level: 3,
            source: 'PHB',
            isMulticlass: false,
          },
        ],
        ...baseCharacterState(),
      };

      const combat = computeCombatStats(state);
      expect(combat.ac).toBe(16); // 13 + 3
    });

    it('蜥蜴人天然护甲计算验证: 敏捷16(+3) -> AC 16 (13 + 3)', () => {
      const rawRace: CatalogEntry = {
        id: '5etools:race:phb:lizardfolk',
        kind: 'race',
        name: '蜥蜴人',
        englishName: 'Lizardfolk',
        source: 'PHB',
        edition: '2024',
        sourcePackId: '5etools-cn',
        raw: {
          name: 'Lizardfolk',
        },
      };

      const merged = mergeOverlay(rawRace);
      defaultCatalog.register(merged);
      (defaultCatalog as any).registerAlias('lizardfolk', merged.id);

      const sp = catalogEntryToSpecies(merged);
      const natArmor = sp.traits.find((t) => t.nameEn === 'Natural Armor' || t.name === '天然护甲');
      expect(natArmor?.mechanics?.acCalculation?.base).toBe(13);

      const state: CharacterState = {
        id: '4',
        name: 'Saurian',
        playerName: '',
        speciesId: 'lizardfolk',
        baseAbilityScores: { str: 14, dex: 16, con: 14, int: 10, wis: 12, cha: 8 },
        classes: [{ classId: 'Fighter', level: 1, source: 'PHB', isMulticlass: false }],
        ...baseCharacterState(),
      };

      const combat = computeCombatStats(state);
      expect(combat.ac).toBe(16); // 13 + 3
    });

    it('龟人天然护甲计算验证: 固定 AC 17 (不受敏捷影响)', () => {
      const rawRace: CatalogEntry = {
        id: '5etools:race:phb:tortle',
        kind: 'race',
        name: '龟人',
        englishName: 'Tortle',
        source: 'PHB',
        edition: '2024',
        sourcePackId: '5etools-cn',
        raw: {
          name: 'Tortle',
        },
      };

      const merged = mergeOverlay(rawRace);
      defaultCatalog.register(merged);
      (defaultCatalog as any).registerAlias('tortle', merged.id);

      const state: CharacterState = {
        id: '5',
        name: 'Oogway',
        playerName: '',
        speciesId: 'tortle',
        baseAbilityScores: { str: 14, dex: 10, con: 14, int: 10, wis: 16, cha: 8 },
        classes: [{ classId: 'Cleric', level: 1, source: 'PHB', isMulticlass: false }],
        ...baseCharacterState(),
      };

      const combat = computeCombatStats(state);
      expect(combat.ac).toBe(17);
    });

    it('奥法骑士在 3 级时能正确获得 1/3 施法槽 (2个 1 环法术槽)', () => {
      defaultCatalog.register({
        id: 'test:class:phb:fighter',
        kind: 'class',
        name: '战士',
        englishName: 'Fighter',
        source: 'PHB',
        edition: '2024',
        sourcePackId: 'overlay-test',
        raw: {
          hd: { faces: 10 },
          features: [],
          progression: [],
          subClassInfo: {
            unlockLevel: 3,
            options: [
              {
                name: '奥术骑士',
                nameEn: 'Eldritch Knight',
                traits: [
                  {
                    name: '施法',
                    nameEn: 'Spellcasting',
                    level: 3,
                    mechanics: { spellcastingType: '1/3', spellcastingAbility: 'Intelligence' },
                  },
                ],
              },
            ],
          },
        },
      });
      const state: CharacterState = {
        id: '6',
        name: 'Spellblade',
        playerName: '',
        baseAbilityScores: { str: 16, dex: 12, con: 14, int: 14, wis: 10, cha: 8 },
        classes: [
          {
            classId: 'Fighter',
            subclassId: 'Eldritch Knight',
            level: 3,
            source: 'PHB',
            isMulticlass: false,
          },
        ],
        ...baseCharacterState(),
      };

      const spellcasting = computeSpellcasting(state);
      expect(spellcasting.spellSlots[1]).toBe(2);
      expect(spellcasting.cantripsKnown).toBe(2);
      expect(spellcasting.spellsPrepared).toBe(3);
    });

    it('游侠在 2 级时能正确获得半施法者法术槽 (2个 1 环法术槽)', () => {
      defaultCatalog.register({
        id: 'test:class:phb:ranger',
        kind: 'class',
        name: '游侠',
        englishName: 'Ranger',
        source: 'PHB',
        edition: '2024',
        sourcePackId: 'overlay-test',
        raw: {
          hd: { faces: 10 },
          casterProgression: 'half',
          spellcastingAbility: 'Wisdom',
          features: [],
          progression: [
            { level: 1, featuresUnlocked: [] },
            {
              level: 2,
              featuresUnlocked: [],
              spellcasting: { spellsPrepared: 2, spellSlots: { level1: 2 } },
            },
          ],
        },
      });
      const state: CharacterState = {
        id: '7',
        name: 'Strider',
        playerName: '',
        baseAbilityScores: { str: 10, dex: 16, con: 14, int: 10, wis: 14, cha: 8 },
        classes: [{ classId: 'Ranger', level: 2, source: 'PHB', isMulticlass: false }],
        ...baseCharacterState(),
      };

      const spellcasting = computeSpellcasting(state);
      expect(spellcasting.spellSlots[1]).toBe(2);
    });
  });
});
