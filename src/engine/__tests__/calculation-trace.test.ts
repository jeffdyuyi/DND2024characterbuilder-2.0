import { describe, it, expect, beforeEach } from 'vitest';
import { computeCombatStats } from '../combat';
import { computeAbilityScores } from '../ability';
import { computeSpellcasting } from '../spellcasting';
import { buildCharacterSheetView } from '../viewAdapter';
import { CharacterState } from '@/types/characterState';
import { defaultCatalog } from '@/catalog';
import { CatalogEntry } from '@/catalog/types';
import { normalizeItem } from '@/source/fiveetools-cn/normalizers/item';

describe('Phase E: Calculation Trace 追溯链路测试', () => {

  describe('AC 追溯链路 (acTrace)', () => {
    it('无甲角色生成基础 10 + 敏捷修正追溯', () => {
      const state = {
        id: 'char-1',
        name: 'Monk Unarmored',
        classes: [],
        baseAbilityScores: { str: 10, dex: 16, con: 12, int: 10, wis: 10, cha: 10 },
        backgroundAbilityBonuses: {},
      } as unknown as CharacterState;

      const combat = computeCombatStats(state);
      expect(combat.ac).toBe(13); // 10 + 3
      expect(combat.acTrace.length).toBeGreaterThan(0);
      expect(combat.acTrace.some(t => t.includes('无甲基础: 10 + 敏捷修正 (+3) = 13'))).toBe(true);
      expect(combat.acTrace.some(t => t.includes('最终护甲等级 (AC): 13'))).toBe(true);
    });

    it('穿戴皮甲与盾牌的角色生成护甲加值与盾牌加成追溯', () => {
      const leather = normalizeItem({ name: '皮甲', ENG_name: 'Leather', source: 'XPHB', type: 'LA', ac: 11 }, 'trace-test');
      const shield = normalizeItem({ name: '盾牌', ENG_name: 'Shield', source: 'XPHB', type: 'S', ac: 2 }, 'trace-test');
      defaultCatalog.register(leather);
      defaultCatalog.register(shield);
      const state = {
        id: 'char-2',
        name: 'Leather Fighter',
        classes: [
          { classId: 'fighter', level: 1, isMulticlass: false, source: 'PHB2024' }
        ],
        baseAbilityScores: { str: 15, dex: 14, con: 14, int: 8, wis: 10, cha: 10 },
        backgroundAbilityBonuses: {},
        equippedArmorId: leather.id,
        equippedShieldId: shield.id,
      } as unknown as CharacterState;

      const combat = computeCombatStats(state);
      // 皮甲 11 + 敏捷 2 = 13；盾牌 +2 = 15
      expect(combat.ac).toBe(15);
      expect(combat.acTrace.some(t => t.includes('皮甲') && t.includes('基础 11'))).toBe(true);
      expect(combat.acTrace.some(t => t.includes('盾牌: +2'))).toBe(true);
      expect(combat.acTrace.some(t => t.includes('最终护甲等级 (AC): 15'))).toBe(true);
    });

    it('野蛮人无甲防御替代基础防御时，准确生成替代追溯', () => {
      // 注册野蛮人
      const barbClass: CatalogEntry = {
        id: 'class:barbarian',
        kind: 'class',
        name: '野蛮人',
        englishName: 'Barbarian',
        source: 'PHB2024',
        edition: '2024',
        sourcePackId: '5etools-cn',
        raw: {
          name: '野蛮人',
          nameEn: 'Barbarian',
          features: [
            {
              name: '无甲防御',
              nameEn: 'Unarmored Defense',
              level: 1,
              mechanics: {
                acCalculation: {
                  base: 10,
                  modifiers: ['dex', 'con'],
                },
              },
            },
          ],
        },
      };
      defaultCatalog.register(barbClass);

      const state = {
        id: 'char-3',
        name: 'Conan',
        classes: [
          { classId: 'Barbarian', level: 1, isMulticlass: false, source: 'PHB2024' }
        ],
        baseAbilityScores: { str: 16, dex: 14, con: 16, int: 8, wis: 10, cha: 8 },
        backgroundAbilityBonuses: {},
      } as unknown as CharacterState;

      const combat = computeCombatStats(state);
      // 10 + 敏捷 2 + 体质 3 = 15
      expect(combat.ac).toBe(15);
      expect(combat.acTrace.some(t => t.includes('无甲防御') && t.includes('15'))).toBe(true);
      expect(combat.acTrace.some(t => t.includes('最终护甲等级 (AC): 15'))).toBe(true);
    });
  });

  describe('HP 追溯链路 (hpTrace)', () => {
    it('精确记录 1 级满生命骰及多等级固定均值提升与体质修正', () => {
      const fighterClass: CatalogEntry = {
        id: 'class:fighter',
        kind: 'class',
        name: '战士',
        englishName: 'Fighter',
        source: 'PHB2024',
        edition: '2024',
        sourcePackId: '5etools-cn',
        raw: {
          name: '战士',
          nameEn: 'Fighter',
          hd: { faces: 10 },
          features: [],
        },
      };
      defaultCatalog.register(fighterClass);

      const state = {
        id: 'char-4',
        name: 'Fighter Lvl 3',
        classes: [
          { classId: 'Fighter', level: 3, isMulticlass: false, source: 'PHB2024' }
        ],
        baseAbilityScores: { str: 16, dex: 12, con: 14, int: 8, wis: 10, cha: 8 }, // conMod = +2
        backgroundAbilityBonuses: {},
      } as unknown as CharacterState;

      const combat = computeCombatStats(state);
      // 1级: 10 + 2 = 12
      // 2级: 6 + 2 = 8
      // 3级: 6 + 2 = 8
      // 总 HP: 28
      expect(combat.hp.max).toBe(28);
      expect(combat.hpTrace.length).toBeGreaterThan(0);
      expect(combat.hpTrace.some(t => t.includes('1级') && t.includes('满生命骰 (10) + 体质修正 (+2) = 12'))).toBe(true);
      expect(combat.hpTrace.some(t => t.includes('2级') && t.includes('固定均值 (6) + 体质修正 (+2) = 8'))).toBe(true);
      expect(combat.hpTrace.some(t => t.includes('3级') && t.includes('固定均值 (6) + 体质修正 (+2) = 8'))).toBe(true);
      expect(combat.hpTrace.some(t => t.includes('生命值上限 (HP Max): 28'))).toBe(true);
    });
  });

  describe('属性值追溯链路 (ability.trace)', () => {
    it('准确输出六大属性各来源项与最终修正', () => {
      const state = {
        id: 'char-5',
        name: 'Wizard',
        classes: [],
        baseAbilityScores: { str: 8, dex: 14, con: 13, int: 15, wis: 12, cha: 10 },
        backgroundAbilityBonuses: { int: 2, con: 1 },
      } as unknown as CharacterState;

      const ability = computeAbilityScores(state);
      expect(ability.scores.int).toBe(17);
      expect(ability.modifiers.int).toBe(3);

      const intTrace = ability.trace.int;
      expect(intTrace.some(t => t.includes('基础购买/掷骰: 15'))).toBe(true);
      expect(intTrace.some(t => t.includes('背景加成: +2'))).toBe(true);
      expect(intTrace.some(t => t.includes('最终值: 17 (修正值 +3)'))).toBe(true);
    });
  });

  describe('法术与施法 DC / 攻击追溯链路 (spellcasting)', () => {
    it('准确生成 8 + PB + 施法属性的 DC 追溯与攻击加值追溯', () => {
      const wizardClass: CatalogEntry = {
        id: 'class:wizard',
        kind: 'class',
        name: '法师',
        englishName: 'Wizard',
        source: 'PHB2024',
        edition: '2024',
        sourcePackId: '5etools-cn',
        raw: {
          name: '法师',
          nameEn: 'Wizard',
          spellcastingAbility: 'Intelligence',
          progression: [
            { level: 1, spellcasting: { cantripsKnown: 3, spellsPrepared: 4, spellSlots: { level1: 2 } } }
          ],
          features: [],
        },
      };
      defaultCatalog.register(wizardClass);

      const state = {
        id: 'char-6',
        name: 'Novice Mage',
        classes: [
          { classId: 'Wizard', level: 1, isMulticlass: false, source: 'PHB2024' }
        ],
        baseAbilityScores: { str: 8, dex: 12, con: 12, int: 16, wis: 13, cha: 10 }, // intMod = +3, PB = 2
        backgroundAbilityBonuses: {},
      } as unknown as CharacterState;

      const spellcasting = computeSpellcasting(state);
      // DC = 8 + 2 + 3 = 13
      // Attack = 2 + 3 = +5
      expect(spellcasting.spellDcTrace).toBeDefined();
      expect(spellcasting.spellDcTrace!.some(t => t.includes('基础值: 8'))).toBe(true);
      expect(spellcasting.spellDcTrace!.some(t => t.includes('熟练加值: +2'))).toBe(true);
      expect(spellcasting.spellDcTrace!.some(t => t.includes('智力修正: +3'))).toBe(true);
      expect(spellcasting.spellDcTrace!.some(t => t.includes('法术豁免 DC: 13'))).toBe(true);

      expect(spellcasting.spellAttackTrace).toBeDefined();
      expect(spellcasting.spellAttackTrace!.some(t => t.includes('熟练加值 (+2) + 智力修正 (+3) = +5'))).toBe(true);
    });
  });

  describe('ViewAdapter 视图适配与人工覆盖标记联动', () => {
    it('当玩家手动设定覆盖值时，final.traces 中清晰追加手动覆盖注记', () => {
      const state = {
        id: 'char-7',
        name: 'Overridden Hero',
        classes: [],
        baseAbilityScores: { str: 10, dex: 14, con: 12, int: 10, wis: 10, cha: 10 },
        backgroundAbilityBonuses: {},
        manualOverrides: {
          ac: 18, // 手动把 AC 设为 18
          maxHp: 50, // 手动把 HP 设为 50
        },
      } as unknown as CharacterState;

      const view = buildCharacterSheetView(state);

      // 验证 flags
      expect(view.flags.isAcManual).toBe(true);
      expect(view.flags.isMaxHpManual).toBe(true);

      // 验证 computed 保持纯洁的自动计算值
      expect(view.computed.combat.ac).toBe(12); // 10 + 2
      expect(view.computed.traces.ac.some(t => t.includes('无甲基础'))).toBe(true);

      // 验证 final 获取到覆盖值
      expect(view.final.ac).toBe(18);
      expect(view.final.maxHp).toBe(50);

      // 验证 final.traces 中具备覆盖标记说明
      expect(view.final.traces.ac.some(t => t.includes('玩家手动设定 (覆盖生效): 18'))).toBe(true);
      expect(view.final.traces.hp.some(t => t.includes('玩家手动设定 (覆盖生效): 50'))).toBe(true);
    });
  });
});
