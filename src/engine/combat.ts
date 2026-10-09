import { CharacterState } from '../types/characterState';
import { computeAbilityScores } from './ability';
import { getActiveItemDefinitions, getClassDefinition, getSpeciesDefinition, getSubspeciesDefinition, getSubclassDefinition, isProficientWithArmor, resolveInventoryItem } from './characterData';
import type { Armor } from '@/types/equipment';
import { normalizeAbilityKey } from './terminology';

export interface CombatStats {
  ac: number;
  acSources: { name: string; value: number; type: 'base' | 'trait' | 'bonus' | 'shield' }[];
  acTrace: string[];
  hp: {
    max: number;
    current: number;
    temp: number;
  };
  hpTrace: string[];
  initiative: number;
  initiativeTrace: string[];
  speed: number;
  speedTrace: string[];
}

export function computeCombatStats(state: CharacterState): CombatStats {
  const { modifiers } = computeAbilityScores(state);
  const species = getSpeciesDefinition(state);
  const subspecies = getSubspeciesDefinition(state);

  const armor = resolveInventoryItem(state, state.equippedArmorId) as Armor | undefined;
  const shield = resolveInventoryItem(state, state.equippedShieldId) as Armor | undefined;

  const activeConditions = state.activeConditions || [];

  const acTrace: string[] = [];
  const hpTrace: string[] = [];
  const initiativeTrace: string[] = [];
  const speedTrace: string[] = [];

  // Base AC Calculation
  let baseAc = 10 + modifiers.dex;
  if (armor?.acStructured) {
    const armorDex =
      armor.acStructured.dexModEnabled
        ? armor.acStructured.dexModMax !== undefined
          ? Math.min(modifiers.dex, armor.acStructured.dexModMax)
          : modifiers.dex
        : 0;
    baseAc = armor.acStructured.base + armorDex + (armor.acStructured.bonus ?? 0);
    const dexDesc = armor.acStructured.dexModEnabled
      ? (armor.acStructured.dexModMax !== undefined
          ? `敏捷修正 (+${armorDex}，上限 +${armor.acStructured.dexModMax})`
          : `敏捷修正 (+${armorDex})`)
      : '无敏捷加成';
    const bonusDesc = armor.acStructured.bonus ? ` + 强化 (+${armor.acStructured.bonus})` : '';
    acTrace.push(`${armor.name || '护甲'} (基础 ${armor.acStructured.base}) + ${dexDesc}${bonusDesc} = ${baseAc}`);
  } else {
    acTrace.push(`无甲基础: 10 + 敏捷修正 (${modifiers.dex >= 0 ? '+' : ''}${modifiers.dex}) = ${baseAc}`);
  }

  // Trait-based Base AC (e.g., Draconic Resilience, Barbarian, Monk, Tortle)
  const traitBaseCalculations: { val: number; name: string; traceText: string }[] = [];
  const traitBonusCalculations: { val: number; name: string }[] = [];
  const isUnarmored = !armor || armor.armorCategory?.toLowerCase() === 'shield';
  
  const processMechanicsForAc = (mechanics: any, sourceName: string) => {
    if (!mechanics) return;
    
    // 1. Base AC Setting (acCalculation)
    if (mechanics.acCalculation) {
      const calc = mechanics.acCalculation;
      let isActive = false;
      if (!calc.condition) {
        isActive = true;
      } else if (calc.condition === '未着装护甲' || calc.condition.toLowerCase() === 'unarmored') {
        isActive = isUnarmored;
      } else {
        isActive = activeConditions.includes(calc.condition);
      }

      // 如果特性要求不能使用盾牌且此时装备了盾牌，则不生效 (如武僧无甲防御)
      if (calc.canUseShield === false && shield) {
        isActive = false;
      }

      if (isActive) {
        let val = calc.base;
        const seenKeys = new Set<string>();
        const parts: string[] = [`基础 ${calc.base}`];

        calc.modifiers?.forEach((m: string) => {
          const normKey = normalizeAbilityKey(m);
          if (normKey && !seenKeys.has(normKey)) {
            seenKeys.add(normKey);
            const modVal = modifiers[normKey as keyof typeof modifiers] || 0;
            val += modVal;
            parts.push(`${normKey.toUpperCase()}修正 (${modVal >= 0 ? '+' : ''}${modVal})`);
          }
        });

        const traceText = `${sourceName}: ${parts.join(' + ')} = ${val}`;
        traitBaseCalculations.push({ val, name: sourceName, traceText });
      }
    }

    // 2. Fixed Bonus (acBonus)
    if (mechanics.acBonus) {
      const isActive = !mechanics.acBonusCondition || activeConditions.includes(mechanics.acBonusCondition);
      if (isActive) {
        acBonusTotal += mechanics.acBonus;
        traitBonusCalculations.push({ val: mechanics.acBonus, name: sourceName });
      }
    }
  };

  let acBonusTotal = 0;

  // Species & Subspecies
  [species, subspecies].forEach(entry => {
    entry?.traits?.forEach(trait => {
      processMechanicsForAc(trait.features, trait.name);
      processMechanicsForAc(trait.mechanics, trait.name);
    });
  });

  // Class & Subclass Features
  state.classes?.forEach(cEntry => {
    const classDef = getClassDefinition(cEntry.classId);
    if (!classDef) return;

    classDef.features?.forEach(f => {
      if (f.level <= cEntry.level) {
        processMechanicsForAc(f.mechanics, f.name);
        
        // Choices (e.g., Draconic Sorcerer AC)
        if (f.mechanics?.choices) {
          f.mechanics.choices.forEach((choice: any) => {
            const selectionId = `${cEntry.classId}:${f.name}:${choice.id}`;
            const selections = state.classSelections?.[selectionId] || [];
            selections.forEach(sel => {
              const opt = choice.options.find((o: any) => o.name === sel || o.nameEn === sel);
              processMechanicsForAc(opt?.mechanics, opt?.name);
            });
          });
        }
      }
    });

    if (cEntry.subclassId) {
      const subDef = classDef.subClassInfo?.options.find(o => o.catalogId === cEntry.subclassId || o.nameEn === cEntry.subclassId || o.name === cEntry.subclassId) || getSubclassDefinition(state);
      subDef?.traits?.forEach(t => {
        if (t.level === undefined || t.level <= cEntry.level) {
          processMechanicsForAc(t.mechanics, t.name);
        }
      });
    }
  });

  const acSources: { name: string; value: number; type: 'base' | 'trait' | 'bonus' | 'shield' }[] = [];

  // Track Base/Armor AC
  if (armor?.acStructured) {
    const armorDex = armor.acStructured.dexModEnabled
      ? armor.acStructured.dexModMax !== undefined
        ? Math.min(modifiers.dex, armor.acStructured.dexModMax)
        : modifiers.dex
      : 0;
    acSources.push({ name: armor.name || '护甲', value: armor.acStructured.base + armorDex, type: 'base' });
  } else {
    acSources.push({ name: '无甲 (10 + 敏捷)', value: 10 + modifiers.dex, type: 'base' });
  }

  // Handle Trait Bases
  if (traitBaseCalculations.length > 0) {
    const bestTrait = traitBaseCalculations.reduce((best, curr) => curr.val > best.val ? curr : best, traitBaseCalculations[0]);
    if (bestTrait.val > baseAc) {
      baseAc = bestTrait.val;
      acSources.length = 0; // Clear base armor if trait is higher
      acSources.push({ name: bestTrait.name, value: bestTrait.val, type: 'trait' });
      acTrace.push(`替代护甲计算 [${bestTrait.name}]: ${bestTrait.traceText}`);
    }
  }

  // Add Bonus Sources
  traitBonusCalculations.forEach(b => {
    acTrace.push(`${b.name}: +${b.val}`);
  });

  if (acBonusTotal > 0) {
    acSources.push({ name: '特性加值', value: acBonusTotal, type: 'bonus' });
  }

  let ac = baseAc + acBonusTotal;

  getActiveItemDefinitions(state).forEach((item) => {
    const bonus = Number((item as any).bonusAc) || 0;
    if (bonus <= 0) return;
    ac += bonus;
    acSources.push({ name: item.name, value: bonus, type: 'bonus' });
    acTrace.push(`${item.name}: AC +${bonus}`);
  });

  if (shield?.acStructured?.bonus) {
    const shieldAc = shield.acStructured.bonus;
    const isProf = isProficientWithArmor(state, shield);
    ac += shieldAc;
    acSources.push({ name: shield.name || '盾牌', value: shieldAc, type: 'shield' });
    acTrace.push(`${shield.name || '盾牌'}: +${shieldAc}${!isProf ? ' (未受训)' : ''}`);
  }

  acTrace.push(`最终护甲等级 (AC): ${ac}`);

  // Initiative (Dex + Bonuses)
  let initiative = modifiers.dex;
  initiativeTrace.push(`敏捷修正: ${modifiers.dex >= 0 ? '+' : ''}${modifiers.dex}`);
  initiativeTrace.push(`最终先攻: ${initiative >= 0 ? '+' : ''}${initiative}`);

  // HP Calculation
  let maxHp = 0;
  const conMod = modifiers.con;
  const hpLevelRolls = state.hpLevelRolls || {};

  if (state.hpCalculationMode === 'custom' && state.customMaxHp !== undefined) {
    maxHp = state.customMaxHp;
    hpTrace.push(`玩家自定义生命值上限: ${maxHp}`);
  } else {
    let totalLevel = 0;
    if (state.classes && state.classes.length > 0) {
      state.classes.forEach((entry, classIndex) => {
        const classDefinition = getClassDefinition(entry.classId);
        const hitDie = classDefinition?.hitPointDie ?? 8;
        const averageGain = Math.floor(hitDie / 2) + 1;
        const clsName = classDefinition?.name || entry.classId;

        for (let l = 1; l <= entry.level; l++) {
          totalLevel++;
          let base = 0;
          if (totalLevel === 1) {
            base = hitDie;
            const lvlHp = Math.max(1, base + conMod);
            maxHp += lvlHp;
            hpTrace.push(`1级 ${clsName}: 满生命骰 (${hitDie}) + 体质修正 (${conMod >= 0 ? '+' : ''}${conMod}) = ${lvlHp}`);
          } else {
            const roll = hpLevelRolls[totalLevel];
            let rollLabel = '固定均值';
            if (typeof roll === 'number') {
              base = roll;
              rollLabel = '掷骰';
            } else {
              base = averageGain;
            }
            const lvlHp = Math.max(1, base + conMod);
            maxHp += lvlHp;
            hpTrace.push(`${totalLevel}级 ${clsName}: ${rollLabel} (${base}) + 体质修正 (${conMod >= 0 ? '+' : ''}${conMod}) = ${lvlHp}`);
          }
        }
      });
    } else {
      maxHp = 10 + conMod;
      totalLevel = 1;
      hpTrace.push(`默认基础生命值: 10 + 体质修正 (${conMod >= 0 ? '+' : ''}${conMod}) = ${maxHp}`);
    }

    // Add trait-based bonuses (like Hill Dwarf or Tough feat)
    const hpBonusPerLevel = [species, subspecies].flatMap((entry) =>
      (entry?.traits ?? []).map((trait) => {
        const b = trait.features?.hpBonusPerLevel ?? 0;
        if (b > 0) {
          hpTrace.push(`${trait.name}: 每级 +${b} (共 +${b * totalLevel})`);
        }
        return b;
      })
    );
    const traitHpTotal = hpBonusPerLevel.reduce((sum, bonus) => sum + bonus, 0) * totalLevel;
    maxHp += traitHpTotal;

    hpTrace.push(`生命值上限 (HP Max): ${maxHp}`);
  }

  // Speed Calculation
  const baseSpeed = species?.speed ?? 30;
  speedTrace.push(`种族基础速度: ${baseSpeed} 尺`);

  const speedBonus = [species, subspecies].flatMap((entry) =>
    (entry?.traits ?? []).map((trait) => {
      const b = trait.features?.speedBonus ?? 0;
      if (b > 0) {
        speedTrace.push(`${trait.name}: +${b} 尺`);
      }
      return b;
    })
  ).reduce((sum, bonus) => sum + bonus, 0);

  const finalSpeed = baseSpeed + speedBonus;
  speedTrace.push(`最终步行速度: ${finalSpeed} 尺`);

  return {
    ac,
    acSources,
    acTrace,
    hp: {
      max: maxHp,
      current: state.currentHp ?? maxHp,
      temp: state.tempHp ?? 0,
    },
    hpTrace,
    initiative,
    initiativeTrace,
    speed: finalSpeed,
    speedTrace,
  };
}
