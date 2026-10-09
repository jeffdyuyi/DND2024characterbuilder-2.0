import { CharacterState, AbilityScores } from '../types/characterState';
import { getCatalogSpecies } from '@/catalog';
import { normalizeAbilityKey } from './terminology';
import {
  getActiveItemDefinitions,
  getClassDefinition,
  getSubclassDefinition,
} from './characterData';

export function calculateAbilityModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function computeAbilityScores(state: CharacterState): {
  scores: AbilityScores;
  modifiers: AbilityScores;
  breakdown: {
    base: AbilityScores;
    background: AbilityScores;
    species: AbilityScores;
    feats: AbilityScores;
    class: AbilityScores;
  };
  caps: AbilityScores;
  trace: Record<keyof AbilityScores, string[]>;
} {
  const base = state.baseAbilityScores || { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 };
  const bgBonus = state.backgroundAbilityBonuses || {};

  const breakdown = {
    base: { ...base },
    background: {
      str: bgBonus.str || 0,
      dex: bgBonus.dex || 0,
      con: bgBonus.con || 0,
      int: bgBonus.int || 0,
      wis: bgBonus.wis || 0,
      cha: bgBonus.cha || 0,
    },
    species: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    feats: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
    class: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
  };

  const maxScores = { str: 20, dex: 20, con: 20, int: 20, wis: 20, cha: 20 };

  // Add bonuses from species (controlled by switch)
  if (state.useSpeciesASI !== false) {
    const speciesList = getCatalogSpecies();
    const species =
      speciesList.find(
        (s: any) =>
          (s.id === state.speciesId ||
            s.nameEn === state.speciesId ||
            s.name === state.speciesId) &&
          (!state.speciesSource || s.source === state.speciesSource),
      ) ||
      speciesList.find(
        (s: any) =>
          s.id === state.speciesId || s.nameEn === state.speciesId || s.name === state.speciesId,
      );

    if (species) {
      const applySpeciesBonus = (bonusObj: any) => {
        if (!bonusObj) return;
        Object.entries(bonusObj).forEach(([key, val]) => {
          const normalizedKey = normalizeAbilityKey(key) as keyof AbilityScores;
          if (normalizedKey && typeof val === 'number') {
            breakdown.species[normalizedKey] += val;
          }
        });
      };

      // 1. 固定属性加成 (PHB 2014 等)
      let selectedSub: any = undefined;
      if (state.subspeciesId && species.subSpecies?.options) {
        const normSubId = state.subspeciesId.toLowerCase().replace(/[-_\s]+/g, '');
        selectedSub = species.subSpecies.options.find(
          (ss: any) =>
            ss.id === state.subspeciesId ||
            ss.id.toLowerCase().replace(/[-_\s]+/g, '') === normSubId ||
            ss.nameEn.toLowerCase().replace(/[-_\s]+/g, '') === normSubId ||
            ss.name.toLowerCase().replace(/[-_\s]+/g, '') === normSubId,
        );
      }

      const shouldOverwriteAbility = Boolean(selectedSub?.overwrite?.ability);

      if (shouldOverwriteAbility) {
        // 当亚种声明了 overwrite.ability 时，母种族 ASI 被完全替换，只应用亚种加值
        if (selectedSub?.abilityScoreIncrease) {
          applySpeciesBonus(selectedSub.abilityScoreIncrease);
        }
      } else {
        // 增量式亚种或常规亚种：母种族加值 + 亚种加值累加
        applySpeciesBonus(species.abilityScoreIncrease);
        if (selectedSub?.abilityScoreIncrease) {
          applySpeciesBonus(selectedSub.abilityScoreIncrease);
        }
      }

      // 2. 动态/自由属性分配 (Phase D: 2024 / 5etools choose 格式)
      // 方案 A: 角色显式指定了 speciesAbilityBonuses (如 { str: 1, dex: 1 } 或 { int: 2 })
      const hasExplicitSpeciesBonuses =
        state.speciesAbilityBonuses &&
        Object.values(state.speciesAbilityBonuses).some((v) => typeof v === 'number' && v !== 0);

      if (hasExplicitSpeciesBonuses) {
        Object.entries(state.speciesAbilityBonuses!).forEach(([key, val]) => {
          const normalizedKey = normalizeAbilityKey(key) as keyof AbilityScores;
          if (normalizedKey && typeof val === 'number') {
            breakdown.species[normalizedKey] += val;
          }
        });
      } else {
        // 方案 B: 角色通过 speciesSelections 选择 (如人类自选、半精灵自选、5etools choose)
        Object.entries(state.speciesSelections || {}).forEach(([traitId, values]) => {
          const lowerTraitId = traitId.toLowerCase();
          const isASITrait =
            lowerTraitId.includes('ability-score-increase') ||
            lowerTraitId.includes('asi') ||
            lowerTraitId.includes('属性值') ||
            lowerTraitId.includes('choose');

          if (isASITrait && Array.isArray(values)) {
            // 若亚种全面覆盖了属性值提升，且当前选项不属于亚种作用域，则母种族的自选加成被抑制
            if (shouldOverwriteAbility && selectedSub) {
              const isSubTrait =
                traitId.includes(`:sub:${selectedSub.id}:`) ||
                (selectedSub.traits &&
                  selectedSub.traits.some((st: any) =>
                    traitId.includes(`:trait:${st.id || st.name}:`),
                  ));
              if (!isSubTrait) return;
            }

            values.forEach((val) => {
              if (typeof val === 'string') {
                // 支持 "str:+2", "dex:2", "力量 (+1)" 格式
                let bonus = 1;
                let statPart = val;

                if (val.includes(':')) {
                  const [k, b] = val.split(':');
                  statPart = k;
                  const parsed = parseInt(b, 10);
                  if (!isNaN(parsed)) bonus = parsed;
                } else if (val.includes('+')) {
                  const match = val.match(/\+(\d+)/);
                  if (match) bonus = parseInt(match[1], 10);
                  statPart = val.split(/[\s(]/)[0];
                } else {
                  statPart = val.split(/[\s(]/)[0];
                }

                const normalizedKey = normalizeAbilityKey(statPart) as keyof AbilityScores;
                if (normalizedKey) {
                  breakdown.species[normalizedKey] += bonus;
                }
              }
            });
          }
        });
      }
    }
  }

  // Add bonuses from feats
  Object.values(state.featSelections || {}).forEach((choice) => {
    // Handle single choice (Legacy/Simple)
    if (choice.ability) {
      const key = choice.ability as keyof AbilityScores;
      breakdown.feats[key] += 1;
    }
    // Handle detailed ASI object (2024 Fine-tuning)
    if (choice.asi) {
      Object.entries(choice.asi).forEach(([key, val]) => {
        const k = key as keyof AbilityScores;
        if (breakdown.feats[k] !== undefined) {
          breakdown.feats[k] += val as number;
        }
      });
    }
  });

  // Add bonuses from class features (e.g. Primal Champion)
  state.classes?.forEach((cEntry) => {
    const classDef = getClassDefinition(cEntry.classId);
    if (!classDef) return;

    const activeFeatures = classDef.features.filter((f) => f.level <= cEntry.level);
    activeFeatures.forEach((f) => {
      if (f.mechanics?.statBonus) {
        Object.entries(f.mechanics.statBonus).forEach(([key, val]) => {
          const k = normalizeAbilityKey(key) as keyof AbilityScores;
          if (k && typeof val === 'number') breakdown.class[k] += val;
        });
      }
      if (f.mechanics?.statMaxIncrease) {
        Object.entries(f.mechanics.statMaxIncrease).forEach(([key, val]) => {
          const k = normalizeAbilityKey(key) as keyof AbilityScores;
          if (k && typeof val === 'number') maxScores[k] = Math.max(maxScores[k], val);
        });
      }
    });

    if (cEntry.subclassId) {
      const subclassDef = getSubclassDefinition(state);
      if (subclassDef) {
        subclassDef.traits
          .filter((t) => t.level <= cEntry.level)
          .forEach((t) => {
            if (t.mechanics?.statBonus) {
              Object.entries(t.mechanics.statBonus).forEach(([key, val]) => {
                const k = normalizeAbilityKey(key) as keyof AbilityScores;
                if (k && typeof val === 'number') breakdown.class[k] += val;
              });
            }
            if (t.mechanics?.statMaxIncrease) {
              Object.entries(t.mechanics.statMaxIncrease).forEach(([key, val]) => {
                const k = normalizeAbilityKey(key) as keyof AbilityScores;
                if (k && typeof val === 'number') maxScores[k] = Math.max(maxScores[k], val);
              });
            }
          });
      }
    }
  });

  const rawScores: AbilityScores = {
    str:
      breakdown.base.str +
      breakdown.background.str +
      breakdown.species.str +
      breakdown.feats.str +
      breakdown.class.str,
    dex:
      breakdown.base.dex +
      breakdown.background.dex +
      breakdown.species.dex +
      breakdown.feats.dex +
      breakdown.class.dex,
    con:
      breakdown.base.con +
      breakdown.background.con +
      breakdown.species.con +
      breakdown.feats.con +
      breakdown.class.con,
    int:
      breakdown.base.int +
      breakdown.background.int +
      breakdown.species.int +
      breakdown.feats.int +
      breakdown.class.int,
    wis:
      breakdown.base.wis +
      breakdown.background.wis +
      breakdown.species.wis +
      breakdown.feats.wis +
      breakdown.class.wis,
    cha:
      breakdown.base.cha +
      breakdown.background.cha +
      breakdown.species.cha +
      breakdown.feats.cha +
      breakdown.class.cha,
  };

  const scores: AbilityScores = {
    str: Math.min(rawScores.str, maxScores.str),
    dex: Math.min(rawScores.dex, maxScores.dex),
    con: Math.min(rawScores.con, maxScores.con),
    int: Math.min(rawScores.int, maxScores.int),
    wis: Math.min(rawScores.wis, maxScores.wis),
    cha: Math.min(rawScores.cha, maxScores.cha),
  };

  const itemSetTraces: Partial<Record<keyof AbilityScores, string[]>> = {};
  getActiveItemDefinitions(state).forEach((item) => {
    const abilitySet = (item as any).abilitySet;
    if (!abilitySet || typeof abilitySet !== 'object') return;
    Object.entries(abilitySet).forEach(([key, value]) => {
      const abilityKey = normalizeAbilityKey(key) as keyof AbilityScores;
      if (!abilityKey || typeof value !== 'number' || value <= scores[abilityKey]) return;
      scores[abilityKey] = value;
      (itemSetTraces[abilityKey] ??= []).push(
        `${item.name} 将${abilityKey.toUpperCase()}设为 ${value}`,
      );
    });
  });

  const modifiers: AbilityScores = {
    str: calculateAbilityModifier(scores.str),
    dex: calculateAbilityModifier(scores.dex),
    con: calculateAbilityModifier(scores.con),
    int: calculateAbilityModifier(scores.int),
    wis: calculateAbilityModifier(scores.wis),
    cha: calculateAbilityModifier(scores.cha),
  };

  const statLabels: Record<keyof AbilityScores, string> = {
    str: '力量',
    dex: '敏捷',
    con: '体质',
    int: '智力',
    wis: '感知',
    cha: '魅力',
  };

  const trace: Record<keyof AbilityScores, string[]> = {
    str: [],
    dex: [],
    con: [],
    int: [],
    wis: [],
    cha: [],
  };

  (Object.keys(statLabels) as (keyof AbilityScores)[]).forEach((k) => {
    const list: string[] = [];
    list.push(`基础购买/掷骰: ${breakdown.base[k]}`);
    if (breakdown.background[k] > 0) list.push(`背景加成: +${breakdown.background[k]}`);
    if (breakdown.species[k] > 0) list.push(`种族加成: +${breakdown.species[k]}`);
    if (breakdown.feats[k] > 0) list.push(`专长加成: +${breakdown.feats[k]}`);
    if (breakdown.class[k] > 0) list.push(`职业特性加成: +${breakdown.class[k]}`);
    if (rawScores[k] > maxScores[k]) {
      list.push(`达到上限约束 (当前上限 ${maxScores[k]}): 溢出削减至 ${scores[k]}`);
    } else if (maxScores[k] !== 20) {
      list.push(`特性突破上限至: ${maxScores[k]}`);
    }
    list.push(...(itemSetTraces[k] || []));
    const modStr = modifiers[k] >= 0 ? `+${modifiers[k]}` : `${modifiers[k]}`;
    list.push(`最终值: ${scores[k]} (修正值 ${modStr})`);
    trace[k] = list;
  });

  return {
    scores,
    modifiers,
    breakdown,
    caps: maxScores,
    trace,
  };
}
