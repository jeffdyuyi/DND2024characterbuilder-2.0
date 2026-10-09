/**
 * 职业与子职业机制覆盖层
 * 对应《5etools全量数据接入与引擎保留实施路线图》Phase B
 *
 * 维护核心职业的施法类型（full, half, third, warlock）、
 * 无甲防御公式以及属性突破特性。中英文名称双映射支持。
 */

import { ClassMechanicsOverlay, SubclassMechanicsOverlay } from './types';

export const CLASS_OVERLAYS: Record<string, ClassMechanicsOverlay> = {
  // ─── 纯施法者 (Full Casters) ──────────────────────────────────────────────
  wizard: {
    spellcastingType: 'full',
    spellcastingAbility: 'Intelligence',
  },
  法师: {
    spellcastingType: 'full',
    spellcastingAbility: 'Intelligence',
  },

  sorcerer: {
    spellcastingType: 'full',
    spellcastingAbility: 'Charisma',
  },
  术士: {
    spellcastingType: 'full',
    spellcastingAbility: 'Charisma',
  },

  bard: {
    spellcastingType: 'full',
    spellcastingAbility: 'Charisma',
  },
  吟游诗人: {
    spellcastingType: 'full',
    spellcastingAbility: 'Charisma',
  },

  cleric: {
    spellcastingType: 'full',
    spellcastingAbility: 'Wisdom',
  },
  牧师: {
    spellcastingType: 'full',
    spellcastingAbility: 'Wisdom',
  },

  druid: {
    spellcastingType: 'full',
    spellcastingAbility: 'Wisdom',
  },
  德鲁伊: {
    spellcastingType: 'full',
    spellcastingAbility: 'Wisdom',
  },

  // ─── 半施法者 (Half Casters) ──────────────────────────────────────────────
  ranger: {
    spellcastingType: 'half',
    spellcastingAbility: 'Wisdom',
  },
  游侠: {
    spellcastingType: 'half',
    spellcastingAbility: 'Wisdom',
  },

  paladin: {
    spellcastingType: 'half',
    spellcastingAbility: 'Charisma',
  },
  圣武士: {
    spellcastingType: 'half',
    spellcastingAbility: 'Charisma',
  },

  artificer: {
    spellcastingType: 'half',
    spellcastingAbility: 'Intelligence',
  },
  炼金术师: {
    spellcastingType: 'half',
    spellcastingAbility: 'Intelligence',
  },
  奇械师: {
    spellcastingType: 'half',
    spellcastingAbility: 'Intelligence',
  },

  // ─── 契约魔法 (Pact Magic) ──────────────────────────────────────────────
  warlock: {
    spellcastingType: 'warlock',
    spellcastingAbility: 'Charisma',
  },
  邪术师: {
    spellcastingType: 'warlock',
    spellcastingAbility: 'Charisma',
  },

  // ─── 近战与无甲防御职业 ──────────────────────────────────────────────────
  barbarian: {
    features: [
      {
        name: '无甲防御',
        nameEn: 'Unarmored Defense',
        level: 1,
        mechanics: {
          acCalculation: {
            base: 10,
            modifiers: ['dex', 'con'],
            canUseShield: true,
          },
        },
      },
      {
        name: '原始勇士',
        nameEn: 'Primal Champion',
        level: 20,
        mechanics: {
          statBonus: { str: 4, con: 4, 力量: 4, 体质: 4 },
          statMaxIncrease: { str: 24, con: 24, 力量: 24, 体质: 24 },
        },
      },
    ],
  },
  野蛮人: {
    features: [
      {
        name: '无甲防御',
        nameEn: 'Unarmored Defense',
        level: 1,
        mechanics: {
          acCalculation: {
            base: 10,
            modifiers: ['dex', 'con'],
            canUseShield: true,
          },
        },
      },
      {
        name: '原始勇士',
        nameEn: 'Primal Champion',
        level: 20,
        mechanics: {
          statBonus: { str: 4, con: 4, 力量: 4, 体质: 4 },
          statMaxIncrease: { str: 24, con: 24, 力量: 24, 体质: 24 },
        },
      },
    ],
  },

  monk: {
    features: [
      {
        name: '无甲防御',
        nameEn: 'Unarmored Defense',
        level: 1,
        mechanics: {
          acCalculation: {
            base: 10,
            modifiers: ['dex', 'wis'],
            canUseShield: false,
          },
        },
      },
    ],
  },
  武僧: {
    features: [
      {
        name: '无甲防御',
        nameEn: 'Unarmored Defense',
        level: 1,
        mechanics: {
          acCalculation: {
            base: 10,
            modifiers: ['dex', 'wis'],
            canUseShield: false,
          },
        },
      },
    ],
  },
};

export const SUBCLASS_OVERLAYS: Record<string, SubclassMechanicsOverlay> = {
  // ─── 战士子职：奥术骑士 (Eldritch Knight) ────────────────────────────────
  'eldritch knight': {
    className: 'Fighter',
    spellcastingType: 'third',
    spellcastingAbility: 'Intelligence',
    traits: [
      {
        name: '施法',
        nameEn: 'Spellcasting',
        level: 3,
        mechanics: {
          spellcastingType: '1/3',
          spellcastingAbility: 'Intelligence',
        },
      },
    ],
  },
  奥术骑士: {
    className: 'Fighter',
    spellcastingType: 'third',
    spellcastingAbility: 'Intelligence',
    traits: [
      {
        name: '施法',
        nameEn: 'Spellcasting',
        level: 3,
        mechanics: {
          spellcastingType: '1/3',
          spellcastingAbility: 'Intelligence',
        },
      },
    ],
  },
  奥法骑士: {
    className: 'Fighter',
    spellcastingType: 'third',
    spellcastingAbility: 'Intelligence',
    traits: [
      {
        name: '施法',
        nameEn: 'Spellcasting',
        level: 3,
        mechanics: {
          spellcastingType: '1/3',
          spellcastingAbility: 'Intelligence',
        },
      },
    ],
  },

  // ─── 游侠子职：诡术盗贼 / 诡术师 (Arcane Trickster) ──────────────────────
  'arcane trickster': {
    className: 'Rogue',
    spellcastingType: 'third',
    spellcastingAbility: 'Intelligence',
    traits: [
      {
        name: '施法',
        nameEn: 'Spellcasting',
        level: 3,
        mechanics: {
          spellcastingType: '1/3',
          spellcastingAbility: 'Intelligence',
        },
      },
    ],
  },
  诡术盗贼: {
    className: 'Rogue',
    spellcastingType: 'third',
    spellcastingAbility: 'Intelligence',
    traits: [
      {
        name: '施法',
        nameEn: 'Spellcasting',
        level: 3,
        mechanics: {
          spellcastingType: '1/3',
          spellcastingAbility: 'Intelligence',
        },
      },
    ],
  },
  诡术师: {
    className: 'Rogue',
    spellcastingType: 'third',
    spellcastingAbility: 'Intelligence',
    traits: [
      {
        name: '施法',
        nameEn: 'Spellcasting',
        level: 3,
        mechanics: {
          spellcastingType: '1/3',
          spellcastingAbility: 'Intelligence',
        },
      },
    ],
  },

  // ─── 术士子职：龙族血统 / 龙族术士 (Draconic Sorcerer / Bloodline) ────────
  'draconic sorcery': {
    className: 'Sorcerer',
    traits: [
      {
        name: '龙族体质',
        nameEn: 'Draconic Resilience',
        level: 3,
        mechanics: {
          acCalculation: {
            base: 13,
            modifiers: ['dex'],
            canUseShield: true,
          },
        },
      },
    ],
  },
  'draconic bloodline': {
    className: 'Sorcerer',
    traits: [
      {
        name: '龙族体质',
        nameEn: 'Draconic Resilience',
        level: 1,
        mechanics: {
          acCalculation: {
            base: 13,
            modifiers: ['dex'],
            canUseShield: true,
          },
        },
      },
    ],
  },
  龙族血统: {
    className: 'Sorcerer',
    traits: [
      {
        name: '龙族体质',
        nameEn: 'Draconic Resilience',
        level: 1,
        mechanics: {
          acCalculation: {
            base: 13,
            modifiers: ['dex'],
            canUseShield: true,
          },
        },
      },
    ],
  },
  龙族术士: {
    className: 'Sorcerer',
    traits: [
      {
        name: '龙族体质',
        nameEn: 'Draconic Resilience',
        level: 3,
        mechanics: {
          acCalculation: {
            base: 13,
            modifiers: ['dex'],
            canUseShield: true,
          },
        },
      },
    ],
  },
};
