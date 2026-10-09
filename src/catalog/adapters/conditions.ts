/**
 * Catalog Condition Adapter
 * 统一将 5etools conditionsdiseases.json 状态与 Mechanics 覆盖层转为 UI 和规则引擎使用的 Condition 接口。
 */

import { CatalogEntry } from '../types';
import { defaultCatalog } from '../catalog';
import { Condition } from '@/types/condition';

export const CONDITION_MECHANICS_OVERLAY: Record<string, Condition['mechanics']> = {
  blinded: {
    disadvantageOnAttacks: true,
    advantageToBeHit: true,
    special: '自动失败需要视觉的属性检定',
  },
  charmed: {
    special: '无法伤害魅惑源，魅惑源对其社交检定具有优势',
  },
  deafened: {
    special: '自动失败依赖听觉的属性检定',
  },
  exhaustion: {
    special: 'D20检定减去等级*2，速度减去等级*5，6级死亡',
  },
  frightened: {
    disadvantageOnAttacks: true,
    special: '看见恐惧源时属性检定与攻击检定劣势，无法向其靠近',
  },
  grappled: {
    speedZero: true,
    disadvantageOnAttacks: true,
    special: '对除擒抱者外的目标攻击劣势',
  },
  incapacitated: {
    incapacitated: true,
    special: '无法采取动作或反应，失神，专注中断',
  },
  invisible: {
    special: '攻击时具有优势，被攻击时具有劣势，隐匿不会被视线阻断',
  },
  paralyzed: {
    incapacitated: true,
    speedZero: true,
    advantageToBeHit: true,
    failSavingThrows: ['力量', '敏捷'],
    special: '自动失败力量/敏捷豁免，5尺内攻击命中必重击',
  },
  petrified: {
    incapacitated: true,
    speedZero: true,
    advantageToBeHit: true,
    failSavingThrows: ['力量', '敏捷'],
    special: '重量*10，阻断毒素/疾病，抗全部伤害',
  },
  poisoned: {
    disadvantageOnAttacks: true,
    special: '攻击检定与属性检定具有劣势',
  },
  prone: {
    disadvantageOnAttacks: true,
    special: '爬行每尺需花费额外1尺移动力，5尺内被攻击优势，5尺外被攻击劣势',
  },
  restrained: {
    speedZero: true,
    disadvantageOnAttacks: true,
    advantageToBeHit: true,
    failSavingThrows: ['敏捷'],
    special: '敏捷豁免劣势',
  },
  stunned: {
    incapacitated: true,
    advantageToBeHit: true,
    failSavingThrows: ['力量', '敏捷'],
    special: '仅能微弱自保，自动失败力量/敏捷豁免',
  },
  unconscious: {
    incapacitated: true,
    speedZero: true,
    advantageToBeHit: true,
    failSavingThrows: ['力量', '敏捷'],
    special: '失能，倒地，失察，5尺内命中必重击',
  },
};

function normalizeConditionId(nameEnOrName: string): string {
  return nameEnOrName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function catalogEntryToCondition(entry: CatalogEntry): Condition {
  const raw = (entry.raw || {}) as any;
  const name = entry.name;
  const nameEn = entry.englishName || raw.ENG_name || entry.name;
  const id = normalizeConditionId(nameEn);
  const mechanics = CONDITION_MECHANICS_OVERLAY[id] || undefined;

  return {
    id,
    name,
    description: entry.description || '',
    mechanics,
  };
}

/**
 * 检索全量异常状态
 * 优先从 5etools Catalog 自省提取，未加载时平滑回退到静态兜底列表。
 */
export function getCatalogConditions(fallback: Condition[] = []): Condition[] {
  const entries = defaultCatalog.list('condition');
  if (entries && entries.length > 0) {
    const map = new Map<string, Condition>();
    for (const entry of entries) {
      const cond = catalogEntryToCondition(entry);
      // XPHB 优先，其次 PHB
      if (!map.has(cond.id) || entry.source === 'XPHB' || (entry.source === 'PHB' && !map.get(cond.id))) {
        map.set(cond.id, cond);
      }
    }
    return Array.from(map.values());
  }

  return fallback;
}
