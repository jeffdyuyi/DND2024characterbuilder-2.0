/**
 * 种族与亚种机制覆盖层
 * 对应《5etools全量数据接入与引擎保留实施路线图》Phase B
 *
 * 覆盖蜥蜴人、龟人等天然护甲公式。
 */

import { RaceMechanicsOverlay } from './types';

export const RACE_OVERLAYS: Record<string, RaceMechanicsOverlay> = {
  // ─── 蜥蜴人 (Lizardfolk) ──────────────────────────────────────────────────
  lizardfolk: {
    traits: [
      {
        name: '天然护甲',
        nameEn: 'Natural Armor',
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
  蜥蜴人: {
    traits: [
      {
        name: '天然护甲',
        nameEn: 'Natural Armor',
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

  // ─── 龟人 (Tortle) ────────────────────────────────────────────────────────
  tortle: {
    traits: [
      {
        name: '天然护甲',
        nameEn: 'Natural Armor',
        mechanics: {
          acCalculation: {
            base: 17,
            modifiers: [],
            canUseShield: true,
          },
        },
      },
    ],
  },
  龟人: {
    traits: [
      {
        name: '天然护甲',
        nameEn: 'Natural Armor',
        mechanics: {
          acCalculation: {
            base: 17,
            modifiers: [],
            canUseShield: true,
          },
        },
      },
    ],
  },
  尖角龟人: {
    traits: [
      {
        name: '天然护甲',
        nameEn: 'Natural Armor',
        mechanics: {
          acCalculation: {
            base: 17,
            modifiers: [],
            canUseShield: true,
          },
        },
      },
    ],
  },
};
