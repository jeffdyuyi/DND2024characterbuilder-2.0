import { CharacterState, AbilityScores } from '../types/characterState';
import { computeAbilityScores } from './ability';
import { computeCombatStats } from './combat';
import { computeProficiencies } from './proficiency';
import { computeSpellcasting } from './spellcasting';

/**
 * 角色卡展示数据视图接口
 * 该结构将自动计算值 (computed) 与玩家手动覆盖值 (overrides) 分离开来，
 * 并提供最终合并后的值 (final) 以及状态标记 (flags)。
 */
export interface CalculationTraces {
  ac: string[];
  hp: string[];
  initiative: string[];
  speed: string[];
  passivePerception: string[];
  spellSaveDc: string[];
  spellAttack: string[];
  abilities: Record<keyof AbilityScores, string[]>;
}

/**
 * 角色卡展示数据视图接口
 * 该结构将自动计算值 (computed) 与玩家手动覆盖值 (overrides) 分离开来，
 * 并提供最终合并后的值 (final) 以及状态标记 (flags)。
 */
export interface CharacterSheetView {
  // 引擎自动计算的原始结果
  computed: {
    ability: any;
    combat: any;
    proficiencies: any;
    spellcasting: any;
    proficiencyBonus: number;
    totalLevel: number;
    passivePerception: number;
    traces: CalculationTraces;
  };

  // 存储在 character 中的原始覆盖数据
  overrides: CharacterState['manualOverrides'];

  // 最终展示给用户的值 (优先取 overrides，否则取 computed)
  final: {
    ability: AbilityScores;
    modifiers: AbilityScores;
    ac: number;
    maxHp: number;
    currentHp: number;
    tempHp: number;
    initiative: number;
    speed: number;
    proficiencyBonus: number;
    passivePerception: number;
    spellSaveDc: number;
    spellAttackBonus: number;
    traces: CalculationTraces;
  };

  // 状态标记，用于 UI 显示“手动”标签
  flags: {
    isAcManual: boolean;
    isMaxHpManual: boolean;
    isSpeedManual: boolean;
    isInitiativeManual: boolean;
    isPbManual: boolean;
    isPassivePerceptionManual: boolean;
    isSpellSaveDcManual: boolean;
    isSpellAttackBonusManual: boolean;
    manualAbilityScores: (keyof AbilityScores)[];
  };
}

/**
 * 核心适配器函数：构建角色卡展示所需的完整视图数据。
 * 该函数是“非破坏性”原则的核心实现点。
 */
export function buildCharacterSheetView(character: CharacterState): CharacterSheetView {
  // 1. 触发引擎自动计算
  const abilityRes = computeAbilityScores(character);
  const combatRes = computeCombatStats(character);
  const profRes = computeProficiencies(character);
  const spellRes = computeSpellcasting(character);

  const totalLevel = character.classes.reduce((acc, c) => acc + c.level, 0) || 1;
  const pb = Math.floor((totalLevel - 1) / 4) + 2;

  // 计算自动被动察觉
  const isPerceptionProf =
    character.proficiencies?.skills?.includes('perception') ||
    character.selectedSkills?.includes('perception') ||
    profRes.skills.some((s) => s.id === 'perception');
  const isPerceptionExpert = character.expertiseSkills?.includes('perception');
  const perceptionBonus =
    abilityRes.modifiers.wis + (isPerceptionProf ? pb : 0) + (isPerceptionExpert ? pb : 0);
  const computedPassivePerception = 10 + perceptionBonus;

  // 构造被动察觉追溯
  const passivePerceptionTrace: string[] = ['基础值: 10'];
  passivePerceptionTrace.push(
    `感知修正: ${abilityRes.modifiers.wis >= 0 ? '+' : ''}${abilityRes.modifiers.wis}`,
  );
  if (isPerceptionProf) passivePerceptionTrace.push(`察觉熟练: +${pb}`);
  if (isPerceptionExpert) passivePerceptionTrace.push(`察觉专精: +${pb}`);
  passivePerceptionTrace.push(`最终被动察觉: ${computedPassivePerception}`);

  const computedTraces: CalculationTraces = {
    ac: [...combatRes.acTrace],
    hp: [...combatRes.hpTrace],
    initiative: [...combatRes.initiativeTrace],
    speed: [...combatRes.speedTrace],
    passivePerception: passivePerceptionTrace,
    spellSaveDc: [...(spellRes.spellDcTrace || [])],
    spellAttack: [...(spellRes.spellAttackTrace || [])],
    abilities: { ...abilityRes.trace },
  };

  // 2. 准备覆盖层数据
  const ov = character.manualOverrides || {};

  // 3. 构建 Final 与 Flags
  const finalAbility = { ...abilityRes.scores };
  const manualAbilityScores: (keyof AbilityScores)[] = [];

  if (ov.abilityScores) {
    Object.entries(ov.abilityScores).forEach(([key, val]) => {
      const k = key as keyof AbilityScores;
      if (val !== undefined) {
        finalAbility[k] = val;
        manualAbilityScores.push(k);
      }
    });
  }

  const finalModifiers: AbilityScores = {
    str: Math.floor((finalAbility.str - 10) / 2),
    dex: Math.floor((finalAbility.dex - 10) / 2),
    con: Math.floor((finalAbility.con - 10) / 2),
    int: Math.floor((finalAbility.int - 10) / 2),
    wis: Math.floor((finalAbility.wis - 10) / 2),
    cha: Math.floor((finalAbility.cha - 10) / 2),
  };

  // 构建带有人工覆盖注记的 finalTraces
  const finalTraces: CalculationTraces = {
    ac:
      ov.ac !== undefined
        ? [...computedTraces.ac, `玩家手动设定 (覆盖生效): ${ov.ac}`]
        : [...computedTraces.ac],
    hp:
      ov.maxHp !== undefined
        ? [...computedTraces.hp, `玩家手动设定 (覆盖生效): ${ov.maxHp}`]
        : [...computedTraces.hp],
    initiative:
      ov.initiative !== undefined
        ? [...computedTraces.initiative, `玩家手动设定 (覆盖生效): ${ov.initiative}`]
        : [...computedTraces.initiative],
    speed:
      ov.speed !== undefined
        ? [...computedTraces.speed, `玩家手动设定 (覆盖生效): ${ov.speed}`]
        : [...computedTraces.speed],
    passivePerception:
      ov.passivePerception !== undefined
        ? [...computedTraces.passivePerception, `玩家手动设定 (覆盖生效): ${ov.passivePerception}`]
        : [...computedTraces.passivePerception],
    spellSaveDc:
      ov.spellSaveDc !== undefined
        ? [...computedTraces.spellSaveDc, `玩家手动设定 (覆盖生效): ${ov.spellSaveDc}`]
        : [...computedTraces.spellSaveDc],
    spellAttack:
      ov.spellAttackBonus !== undefined
        ? [...computedTraces.spellAttack, `玩家手动设定 (覆盖生效): ${ov.spellAttackBonus}`]
        : [...computedTraces.spellAttack],
    abilities: { ...computedTraces.abilities },
  };

  if (ov.abilityScores) {
    Object.entries(ov.abilityScores).forEach(([k, val]) => {
      const key = k as keyof AbilityScores;
      if (val !== undefined) {
        finalTraces.abilities[key] = [
          ...(finalTraces.abilities[key] || []),
          `玩家手动设定 (覆盖生效): ${val}`,
        ];
      }
    });
  }

  return {
    computed: {
      ability: abilityRes,
      combat: combatRes,
      proficiencies: profRes,
      spellcasting: spellRes,
      proficiencyBonus: pb,
      totalLevel,
      passivePerception: computedPassivePerception,
      traces: computedTraces,
    },
    overrides: ov,
    final: {
      ability: finalAbility,
      modifiers: finalModifiers,
      ac: ov.ac ?? combatRes.ac,
      maxHp: ov.maxHp ?? combatRes.hp.max,
      currentHp: character.currentHp ?? combatRes.hp.current,
      tempHp: character.tempHp ?? combatRes.hp.temp,
      initiative: ov.initiative ?? combatRes.initiative,
      speed: ov.speed ?? combatRes.speed,
      proficiencyBonus: ov.proficiencyBonus ?? pb,
      passivePerception: ov.passivePerception ?? computedPassivePerception,
      spellSaveDc:
        ov.spellSaveDc ??
        8 +
          pb +
          (spellRes.abilityKey ? (finalModifiers as any)[spellRes.abilityKey] || 0 : 0) +
          (spellRes.spellSaveDcBonus || 0),
      spellAttackBonus:
        ov.spellAttackBonus ??
        pb +
          (spellRes.abilityKey ? (finalModifiers as any)[spellRes.abilityKey] || 0 : 0) +
          (spellRes.spellAttackBonus || 0),
      traces: finalTraces,
    },
    flags: {
      isAcManual: ov.ac !== undefined,
      isMaxHpManual: ov.maxHp !== undefined,
      isSpeedManual: ov.speed !== undefined,
      isInitiativeManual: ov.initiative !== undefined,
      isPbManual: ov.proficiencyBonus !== undefined,
      isPassivePerceptionManual: ov.passivePerception !== undefined,
      isSpellSaveDcManual: ov.spellSaveDc !== undefined,
      isSpellAttackBonusManual: ov.spellAttackBonus !== undefined,
      manualAbilityScores,
    },
  };
}
