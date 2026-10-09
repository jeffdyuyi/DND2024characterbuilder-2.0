import { describe, it, expect } from 'vitest';
import { computeAbilityScores } from '../ability';
import { CharacterState } from '@/types/characterState';
import { defaultCatalog } from '@/catalog';
import { parseAbilityScoreData } from '@/catalog/adapters/species';
import { CatalogEntry } from '@/catalog/types';

describe('Phase D: 2024 / 5etools 种族 ASI 动态分配与引擎计算', () => {
  describe('parseAbilityScoreData 工具函数', () => {
    it('正确解析 2014 固定加成 (abilityScoreIncrease)', () => {
      const raw = {
        abilityScoreIncrease: { str: 2, con: 1 },
      };
      const result = parseAbilityScoreData(raw);
      expect(result.abilityScoreIncrease).toEqual({ str: 2, con: 1 });
      expect(result.abilityChoices).toBeUndefined();
    });

    it('正确解析 5etools choose 格式: 半精灵 (cha: 2, choose 2 of 5)', () => {
      const raw = {
        ability: [
          {
            cha: 2,
            choose: {
              from: ['str', 'dex', 'con', 'int', 'wis'],
              count: 2,
            },
          },
        ],
      };
      const result = parseAbilityScoreData(raw);
      expect(result.abilityScoreIncrease).toEqual({ cha: 2 });
      expect(result.abilityChoices).toHaveLength(1);
      expect(result.abilityChoices![0]).toEqual({
        from: ['str', 'dex', 'con', 'int', 'wis'],
        count: 2,
        amount: 1,
        weights: undefined,
      });
    });

    it('正确解析 5etools 2024 / TCE 定制血统 choose +2 格式', () => {
      const raw = {
        ability: [
          {
            choose: {
              from: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
              amount: 2,
            },
          },
        ],
      };
      const result = parseAbilityScoreData(raw);
      expect(result.abilityScoreIncrease).toBeUndefined();
      expect(result.abilityChoices).toHaveLength(1);
      expect(result.abilityChoices![0]).toEqual({
        from: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
        count: 1,
        amount: 2,
        weights: undefined,
      });
    });
  });

  describe('computeAbilityScores 动态加成计算', () => {
    it('固定加成种族：正确计算基础 + 种族固定加值', () => {
      const dwarfEntry: CatalogEntry = {
        id: 'species:test-dwarf',
        kind: 'race',
        name: '测试矮人',
        englishName: 'Test Dwarf',
        source: 'PHB',
        edition: '2014',
        sourcePackId: '5etools-cn',
        raw: {
          name: '测试矮人',
          ENG_name: 'Test Dwarf',
          abilityScoreIncrease: { con: 2 },
        },
      };
      defaultCatalog.register(dwarfEntry);

      const state = {
        id: 'char-1',
        name: 'Dwarf Fighter',
        speciesId: 'species:test-dwarf',
        classes: [],
        baseAbilityScores: { str: 15, dex: 10, con: 14, int: 8, wis: 12, cha: 8 },
        backgroundAbilityBonuses: {},
      } as unknown as CharacterState;

      const result = computeAbilityScores(state);
      expect(result.breakdown.species.con).toBe(2);
      expect(result.scores.con).toBe(16); // 14 + 2
      expect(result.scores.str).toBe(15);
    });

    it('5etools 半精灵：固定魅+2，通过 speciesSelections 动态选择力量+1、敏捷+1', () => {
      const halfElfEntry: CatalogEntry = {
        id: 'species:test-half-elf',
        kind: 'race',
        name: '测试半精灵',
        englishName: 'Test Half-Elf',
        source: 'PHB',
        edition: '2014',
        sourcePackId: '5etools-cn',
        raw: {
          name: '测试半精灵',
          ENG_name: 'Test Half-Elf',
          ability: [
            {
              cha: 2,
              choose: {
                from: ['str', 'dex', 'con', 'int', 'wis'],
                count: 2,
              },
            },
          ],
        },
      };
      defaultCatalog.register(halfElfEntry);

      const state = {
        id: 'char-2',
        name: 'Half-Elf Bard',
        speciesId: 'species:test-half-elf',
        classes: [],
        baseAbilityScores: { str: 10, dex: 13, con: 12, int: 10, wis: 8, cha: 15 },
        backgroundAbilityBonuses: {},
        speciesSelections: {
          'ability-score-increase-choice-0': ['力量 (+1)', '敏捷 (+1)'],
        },
      } as unknown as CharacterState;

      const result = computeAbilityScores(state);
      // 魅力 +2 固定
      expect(result.breakdown.species.cha).toBe(2);
      expect(result.scores.cha).toBe(17);
      // 力量 +1，敏捷 +1 动态分配
      expect(result.breakdown.species.str).toBe(1);
      expect(result.scores.str).toBe(11);
      expect(result.breakdown.species.dex).toBe(1);
      expect(result.scores.dex).toBe(14);
    });

    it('2024 / TCE 自由分配：通过 speciesAbilityBonuses 直接指定 +2 智力', () => {
      const customLineageEntry: CatalogEntry = {
        id: 'species:test-custom-lineage',
        kind: 'race',
        name: '测试定制血统',
        englishName: 'Test Custom Lineage',
        source: 'TCE',
        edition: '2014',
        sourcePackId: '5etools-cn',
        raw: {
          name: '测试定制血统',
          ENG_name: 'Test Custom Lineage',
          ability: [
            {
              choose: {
                from: ['str', 'dex', 'con', 'int', 'wis', 'cha'],
                amount: 2,
              },
            },
          ],
        },
      };
      defaultCatalog.register(customLineageEntry);

      const state = {
        id: 'char-3',
        name: 'Custom Lineage Wizard',
        speciesId: 'species:test-custom-lineage',
        classes: [],
        baseAbilityScores: { str: 8, dex: 14, con: 12, int: 15, wis: 13, cha: 10 },
        backgroundAbilityBonuses: {},
        speciesAbilityBonuses: { int: 2 },
      } as unknown as CharacterState;

      const result = computeAbilityScores(state);
      expect(result.breakdown.species.int).toBe(2);
      expect(result.scores.int).toBe(17); // 15 + 2
    });

    it('种族 ASI 开关：当 useSpeciesASI 为 false 时，所有种族加值归零', () => {
      const halfElfEntry: CatalogEntry = {
        id: 'species:test-half-elf-2',
        kind: 'race',
        name: '测试半精灵2',
        englishName: 'Test Half-Elf 2',
        source: 'PHB',
        edition: '2014',
        sourcePackId: '5etools-cn',
        raw: {
          name: '测试半精灵2',
          ENG_name: 'Test Half-Elf 2',
          ability: [
            {
              cha: 2,
              choose: {
                from: ['str', 'dex', 'con', 'int', 'wis'],
                count: 2,
              },
            },
          ],
        },
      };
      defaultCatalog.register(halfElfEntry);

      const state = {
        id: 'char-4',
        name: 'Half-Elf with disabled ASI',
        speciesId: 'species:test-half-elf-2',
        useSpeciesASI: false, // 关闭种族加值
        classes: [],
        baseAbilityScores: { str: 10, dex: 13, con: 12, int: 10, wis: 8, cha: 15 },
        backgroundAbilityBonuses: { cha: 2, con: 1 }, // 采用 2024 背景 ASI
        speciesSelections: {
          'ability-score-increase-choice-0': ['力量 (+1)', '敏捷 (+1)'],
        },
      } as unknown as CharacterState;

      const result = computeAbilityScores(state);
      // 种族加值全部为 0
      expect(result.breakdown.species.cha).toBe(0);
      expect(result.breakdown.species.str).toBe(0);
      expect(result.breakdown.species.dex).toBe(0);
      // 背景加成正常生效
      expect(result.breakdown.background.cha).toBe(2);
      expect(result.breakdown.background.con).toBe(1);
      expect(result.scores.cha).toBe(17); // 15 + 2 (背景)
      expect(result.scores.con).toBe(13); // 12 + 1 (背景)
    });

    it('种族与亚种双重加成（如矮人·警戒龙纹）：开启时母种族与亚种全部计入，关闭时全部归零', () => {
      const dwarfMarkOfWardingEntry: CatalogEntry = {
        id: 'species:test-dwarf-warding',
        kind: 'race',
        name: '矮人·警戒龙纹',
        englishName: 'Dwarf (Mark of Warding)',
        source: 'ERLW',
        edition: '2014',
        sourcePackId: '5etools-cn',
        raw: {
          name: '测试矮人',
          ENG_name: 'Test Dwarf',
          abilityScoreIncrease: { con: 2 },
          subSpecies: {
            name: '警戒龙纹',
            options: [
              {
                id: 'subspecies:warding',
                name: '警戒龙纹',
                nameEn: 'Mark of Warding',
                abilityScoreIncrease: { int: 1 }
              }
            ]
          }
        },
      };
      defaultCatalog.register(dwarfMarkOfWardingEntry);

      // 1. 开启状态（默认或 useSpeciesASI: true）：体质 +2 与 智力 +1 全部计入
      const stateEnabled = {
        id: 'char-warding-enabled',
        name: 'Mark of Warding Dwarf - Enabled',
        speciesId: 'species:test-dwarf-warding',
        subspeciesId: 'subspecies:warding',
        useSpeciesASI: true,
        classes: [],
        baseAbilityScores: { str: 10, dex: 10, con: 14, int: 15, wis: 10, cha: 10 },
        backgroundAbilityBonuses: {},
      } as unknown as CharacterState;

      const resultEnabled = computeAbilityScores(stateEnabled);
      expect(resultEnabled.breakdown.species.con).toBe(2);
      expect(resultEnabled.breakdown.species.int).toBe(1);
      expect(resultEnabled.scores.con).toBe(16); // 14 + 2
      expect(resultEnabled.scores.int).toBe(16); // 15 + 1

      // 2. 关闭状态（useSpeciesASI: false）：母种族与亚种加值一键全清，不参与计算
      const stateDisabled = {
        id: 'char-warding-disabled',
        name: 'Mark of Warding Dwarf - Disabled',
        speciesId: 'species:test-dwarf-warding',
        subspeciesId: 'subspecies:warding',
        useSpeciesASI: false,
        classes: [],
        baseAbilityScores: { str: 10, dex: 10, con: 14, int: 15, wis: 10, cha: 10 },
        backgroundAbilityBonuses: { con: 1, int: 2 }, // 2024 背景替代
      } as unknown as CharacterState;

      const resultDisabled = computeAbilityScores(stateDisabled);
      expect(resultDisabled.breakdown.species.con).toBe(0);
      expect(resultDisabled.breakdown.species.int).toBe(0);
      expect(resultDisabled.scores.con).toBe(15); // 14 + 1 (背景)
      expect(resultDisabled.scores.int).toBe(17); // 15 + 2 (背景)
    });
  });
});

