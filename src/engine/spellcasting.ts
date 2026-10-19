import { CharacterState, ClassSpellSelection } from '../types/characterState';
import {
  getActiveItemDefinitions,
  getClassDefinition,
  getClassProgression,
  getSpeciesDefinition,
  getSubspeciesDefinition,
  getFeatDefinition,
  getSpellDefinition,
  getSubclassDefinition,
} from './characterData';
import { normalizeAbilityKey, translateAbilityKey, translateClass } from './terminology';
import { getCatalogSpells } from '@/catalog';
import { computeAbilityScores } from './ability';
import { WarlockInvocations2024 } from '@/mechanics-overlay/warlockInvocations';
import { ClassData } from '@/types/class';
import { Spell } from '@/types/spell';
import { getNativeClassPreparedSpells } from './nativeClassPreparedSpells';
import { getNativeSubclassSpellPlans, getNativeSubclassSpellGrants } from './nativeSubclassSpells';
import { resolveSpellGrantCandidates } from './spellGrantCandidates';
import { getNativeFeatSpellGrants } from './nativeFeatSpells';
import type { ParsedSpellGrants, SpellGrantRule } from '@/types/spellGrant';
import { getSpeciesSpellAbility, getSpeciesSpellSelections } from './speciesSpellSelections';

export interface SpellcastingStats {
  casterLevel: number;
  spellSlots: Record<number, number>; // level -> count
  standardSpellSlots?: Record<number, number>;
  pactMagicSlots?: Record<number, number>;
  cantripsKnown: number;
  spellsPrepared: number;
  featCapacity: number;
  spellcastingAbility?: string;
  abilityKey?: string;
  spellDcTrace?: string[];
  spellAttackTrace?: string[];
  slotsTrace?: string[];
  spellSaveDcBonus?: number;
  spellAttackBonus?: number;
}

export interface SpellChoiceSlot {
  id: string; // 对应 choice.id，用于持久化存储键
  label: string; // 显示名称（如"玄奥秘法 6环"）
  numToChoose: number; // 选择数量
  filter: string; // 筛选规则
  source: string; // 来源描述
  isOptional: boolean; // 是否依赖玩家的前置选择
  nativeRule?: { origin: ParsedSpellGrants['origin']; rule: SpellGrantRule };
}

export interface SpellProgressionStep {
  level: number; // 职业等级
  newCantrips: number; // 本级新增戏法数
  newSpells: number; // 本级新增法术数
  canReplace: boolean; // 是否可替换一道已知法术
  allowedClasses: string[]; // 允许选择的法术列表（魔法奥秘等）
  maxSpellLevel: number; // 本级可学最高环阶
  specialFeatures: string[]; // 特殊提示 (如'魔法奥秘解锁!')
  extraChoices: SpellChoiceSlot[]; // 新增：特性提供的额外选择
  alwaysPreparedSpells?: string[]; // 新增：该等级自动获得的法术 (Q3)
  nativeAlwaysPreparedSpells?: string[];
  filter?: string; // 新增：针对基础法术选择的额外筛选器
}

const MULTICLASS_SLOTS: Record<number, Record<number, number>> = {
  1: { 1: 2 },
  2: { 1: 3 },
  3: { 1: 4, 2: 2 },
  4: { 1: 4, 2: 3 },
  5: { 1: 4, 2: 3, 3: 2 },
  6: { 1: 4, 2: 3, 3: 3 },
  7: { 1: 4, 2: 3, 3: 3, 4: 1 },
  8: { 1: 4, 2: 3, 3: 3, 4: 2 },
  9: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 1 },
  10: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2 },
  11: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  12: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1 },
  13: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  14: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1 },
  15: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  16: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1 },
  17: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 2, 6: 1, 7: 1, 8: 1, 9: 1 },
  18: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 1, 7: 1, 8: 1, 9: 1 },
  19: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 1, 8: 1, 9: 1 },
  20: { 1: 4, 2: 3, 3: 3, 4: 3, 5: 3, 6: 2, 7: 2, 8: 1, 9: 1 },
};

/**
 * 标准 1/3 施法者进度表 (如奥法骑士、诡术师)
 * 对应 2024 规则：准备法术制，无学派限制
 */
const THIRD_CASTER_TABLE: Record<
  number,
  { cantripsKnown: number; spellsPrepared: number; spellSlots: Record<string, number> }
> = {
  3: { cantripsKnown: 2, spellsPrepared: 3, spellSlots: { level1: 2 } },
  4: { cantripsKnown: 2, spellsPrepared: 4, spellSlots: { level1: 3 } },
  5: { cantripsKnown: 2, spellsPrepared: 4, spellSlots: { level1: 3 } },
  6: { cantripsKnown: 2, spellsPrepared: 4, spellSlots: { level1: 3 } },
  7: { cantripsKnown: 2, spellsPrepared: 5, spellSlots: { level1: 4, level2: 2 } },
  8: { cantripsKnown: 2, spellsPrepared: 6, spellSlots: { level1: 4, level2: 2 } },
  9: { cantripsKnown: 2, spellsPrepared: 6, spellSlots: { level1: 4, level2: 2 } },
  10: { cantripsKnown: 3, spellsPrepared: 7, spellSlots: { level1: 4, level2: 3 } },
  11: { cantripsKnown: 3, spellsPrepared: 8, spellSlots: { level1: 4, level2: 3 } },
  12: { cantripsKnown: 3, spellsPrepared: 8, spellSlots: { level1: 4, level2: 3 } },
  13: { cantripsKnown: 3, spellsPrepared: 9, spellSlots: { level1: 4, level2: 3, level3: 2 } },
  14: { cantripsKnown: 3, spellsPrepared: 10, spellSlots: { level1: 4, level2: 3, level3: 2 } },
  15: { cantripsKnown: 3, spellsPrepared: 10, spellSlots: { level1: 4, level2: 3, level3: 2 } },
  16: { cantripsKnown: 3, spellsPrepared: 11, spellSlots: { level1: 4, level2: 3, level3: 3 } },
  17: { cantripsKnown: 3, spellsPrepared: 11, spellSlots: { level1: 4, level2: 3, level3: 3 } },
  18: { cantripsKnown: 3, spellsPrepared: 11, spellSlots: { level1: 4, level2: 3, level3: 3 } },
  19: {
    cantripsKnown: 3,
    spellsPrepared: 12,
    spellSlots: { level1: 4, level2: 3, level3: 3, level4: 1 },
  },
  20: {
    cantripsKnown: 3,
    spellsPrepared: 13,
    spellSlots: { level1: 4, level2: 3, level3: 3, level4: 1 },
  },
};

/**
 * 标准 1/2 施法者进度表 (如 2024 版游侠、圣武士)
 */
const HALF_CASTER_TABLE: Record<
  number,
  { cantripsKnown: number; spellsPrepared: number; spellSlots: Record<string, number> }
> = {
  1: { cantripsKnown: 0, spellsPrepared: 2, spellSlots: { level1: 2 } },
  2: { cantripsKnown: 0, spellsPrepared: 3, spellSlots: { level1: 2 } },
  3: { cantripsKnown: 0, spellsPrepared: 4, spellSlots: { level1: 3 } },
  4: { cantripsKnown: 0, spellsPrepared: 5, spellSlots: { level1: 3 } },
  5: { cantripsKnown: 0, spellsPrepared: 6, spellSlots: { level1: 4, level2: 2 } },
  6: { cantripsKnown: 0, spellsPrepared: 6, spellSlots: { level1: 4, level2: 2 } },
  7: { cantripsKnown: 0, spellsPrepared: 7, spellSlots: { level1: 4, level2: 3 } },
  8: { cantripsKnown: 0, spellsPrepared: 7, spellSlots: { level1: 4, level2: 3 } },
  9: { cantripsKnown: 0, spellsPrepared: 9, spellSlots: { level1: 4, level2: 3, level3: 2 } },
  10: { cantripsKnown: 0, spellsPrepared: 9, spellSlots: { level1: 4, level2: 3, level3: 2 } },
  11: { cantripsKnown: 0, spellsPrepared: 10, spellSlots: { level1: 4, level2: 3, level3: 3 } },
  12: { cantripsKnown: 0, spellsPrepared: 10, spellSlots: { level1: 4, level2: 3, level3: 3 } },
  13: {
    cantripsKnown: 0,
    spellsPrepared: 11,
    spellSlots: { level1: 4, level2: 3, level3: 3, level4: 1 },
  },
  14: {
    cantripsKnown: 0,
    spellsPrepared: 11,
    spellSlots: { level1: 4, level2: 3, level3: 3, level4: 1 },
  },
  15: {
    cantripsKnown: 0,
    spellsPrepared: 12,
    spellSlots: { level1: 4, level2: 3, level3: 3, level4: 2 },
  },
  16: {
    cantripsKnown: 0,
    spellsPrepared: 12,
    spellSlots: { level1: 4, level2: 3, level3: 3, level4: 2 },
  },
  17: {
    cantripsKnown: 0,
    spellsPrepared: 14,
    spellSlots: { level1: 4, level2: 3, level3: 3, level4: 3, level5: 1 },
  },
  18: {
    cantripsKnown: 0,
    spellsPrepared: 14,
    spellSlots: { level1: 4, level2: 3, level3: 3, level4: 3, level5: 1 },
  },
  19: {
    cantripsKnown: 0,
    spellsPrepared: 15,
    spellSlots: { level1: 4, level2: 3, level3: 3, level4: 3, level5: 2 },
  },
  20: {
    cantripsKnown: 0,
    spellsPrepared: 15,
    spellSlots: { level1: 4, level2: 3, level3: 3, level4: 3, level5: 2 },
  },
};

const normalizedName = (value: unknown) =>
  String(value || '')
    .toLowerCase()
    .replace(/[-_\s]+/g, '');

export function isSpellAvailableToClass(spell: Spell, classDef: ClassData): boolean {
  const classNames = new Set([classDef.name, classDef.nameEn].map(normalizedName));
  if (spell.classGrants?.length) {
    const classSource = classDef.source.toUpperCase().replace('PHB2024', 'XPHB');
    if (
      spell.classGrants.some(
        (grant) =>
          classNames.has(normalizedName(grant.name)) &&
          (!grant.source || grant.source.toUpperCase().replace('PHB2024', 'XPHB') === classSource),
      )
    )
      return true;
  } else if (spell.classes.some((name) => classNames.has(normalizedName(name)))) return true;
  return (classDef.spellList || []).some((reference) => {
    const [name, source] = String(reference).split('|');
    const nameMatches =
      normalizedName(name) === normalizedName(spell.name) ||
      normalizedName(name) === normalizedName(spell.nameEn);
    return nameMatches && (!source || source.toLowerCase() === spell.source.toLowerCase());
  });
}

function evaluatePreparedFormula(
  formula: string | undefined,
  level: number,
  modifiers: Record<string, number>,
): number | undefined {
  if (!formula) return undefined;
  const expression = formula
    .replace(
      /<\$(level|str_mod|dex_mod|con_mod|int_mod|wis_mod|cha_mod)\$>/gi,
      (_, token: string) => {
        if (token.toLowerCase() === 'level') return String(level);
        return String(modifiers[token.slice(0, 3).toLowerCase()] || 0);
      },
    )
    .replace(/\s+/g, '');
  if (!/^[\d+\-*/().]+$/.test(expression)) return undefined;
  const terms = expression.match(/[+-]?[^+-]+/g);
  if (!terms) return undefined;
  let total = 0;
  for (const signedTerm of terms) {
    const sign = signedTerm.startsWith('-') ? -1 : 1;
    const term = signedTerm.replace(/^[+-]/, '').replace(/[()]/g, '');
    const factors = term.split(/([*/])/);
    let value = Number(factors[0]);
    if (!Number.isFinite(value)) return undefined;
    for (let index = 1; index < factors.length; index += 2) {
      const operand = Number(factors[index + 1]);
      if (!Number.isFinite(operand)) return undefined;
      value = factors[index] === '*' ? value * operand : value / operand;
    }
    total += sign * value;
  }
  return Math.max(1, Math.floor(total));
}

export function computeSpellcasting(state: CharacterState): SpellcastingStats {
  if (!state.classes || state.classes.length === 0) {
    return { casterLevel: 0, spellSlots: {}, cantripsKnown: 0, spellsPrepared: 0, featCapacity: 0 };
  }

  let totalCasterLevel = 0;
  let totalCantrips = 0;
  let totalPrepared = 0;
  let primaryAbility: string | undefined;
  let pactMagicSlots: Record<number, number> = {};
  let singleClassSlots: Record<number, number> | undefined;
  const abilityModifiers = computeAbilityScores(state).modifiers as unknown as Record<
    string,
    number
  >;

  state.classes.forEach((cEntry, index) => {
    const classDef = getClassDefinition(cEntry.classId);
    if (!classDef) return;

    const progression = getClassProgression(classDef, cEntry.level);
    let sc = progression?.spellcasting;
    const subclassDef = classDef.subClassInfo?.options.find(
      (option) =>
        option.catalogId === cEntry.subclassId ||
        option.nameEn === cEntry.subclassId ||
        option.name === cEntry.subclassId,
    );

    // Fallback: 如果 progression 中没有定义施法数据，尝试寻找子职定义的施法类型并使用标准表
    if (!sc) {
      const scTrait = subclassDef?.traits.find((t) => t.mechanics?.spellcastingType);
      const scType = scTrait?.mechanics?.spellcastingType;

      if (scType === '1/3') {
        sc = THIRD_CASTER_TABLE[cEntry.level] as any;
      } else if (scType === '1/2' || scType === 'half') {
        sc = HALF_CASTER_TABLE[cEntry.level] as any;
      }
    }

    // 2024 Multiclassing Caster Level Rules
    const nameLow = normalizedName(classDef.nameEn || classDef.name);
    const casterProgression =
      classDef.casterProgression ||
      (['bard', 'cleric', 'druid', 'sorcerer', 'wizard'].includes(nameLow)
        ? 'full'
        : ['paladin', 'ranger'].includes(nameLow)
          ? 'half'
          : undefined);
    if (casterProgression === 'full') {
      totalCasterLevel += cEntry.level;
    } else if (casterProgression === 'half') {
      const roundUp = cEntry.source.toUpperCase().startsWith('X') || nameLow === 'artificer';
      totalCasterLevel += roundUp ? Math.ceil(cEntry.level / 2) : Math.floor(cEntry.level / 2);
    } else if (casterProgression === 'third') {
      totalCasterLevel += Math.floor(cEntry.level / 3);
    }

    if (sc) {
      totalCantrips += sc.cantripsKnown || 0;
      const formulaPrepared = evaluatePreparedFormula(
        classDef.preparedSpellsFormula,
        cEntry.level,
        abilityModifiers,
      );
      totalPrepared += formulaPrepared ?? sc.spellsPrepared ?? 0;
      if (index === 0)
        primaryAbility =
          classDef.spellcastingAbility ||
          subclassDef?.traits.find((t) => t.mechanics?.spellcastingAbility)?.mechanics
            ?.spellcastingAbility;

      // Pact Magic handling
      if (casterProgression === 'pact' || nameLow === 'warlock') {
        Object.entries(sc.spellSlots || {}).forEach(([lvl, count]) => {
          const l = parseInt(lvl.replace('level', ''));
          pactMagicSlots[l] = (pactMagicSlots[l] || 0) + (count as number);
        });
      } else if (state.classes.length === 1) {
        // Single class (non-warlock) direct slots
        const slots: Record<number, number> = {};
        Object.entries(sc.spellSlots || {}).forEach(([lvl, count]) => {
          const l = parseInt(lvl.replace('level', ''));
          slots[l] = count as number;
        });
        singleClassSlots = slots;
      }
    }
  });

  let slots: Record<number, number> = {};
  if (state.classes.length === 1 && singleClassSlots) {
    slots = singleClassSlots;
  } else if (totalCasterLevel > 0) {
    slots = { ...(MULTICLASS_SLOTS[Math.min(20, totalCasterLevel)] || {}) };
  }

  const standardSpellSlots = { ...slots };
  // 合并视图供已有候选/摘要消费者使用，资源记录使用独立池。
  Object.entries(pactMagicSlots).forEach(([lvl, count]) => {
    const l = parseInt(lvl);
    slots[l] = (slots[l] || 0) + count;
  });

  const abilityKey = primaryAbility ? normalizeAbilityKey(primaryAbility) : undefined;

  const innateSpells = getInnateSpells(state);
  const innateCantrips = new Set(
    innateSpells.filter((s) => getSpellDefinition(s.spellId)?.level === 0).map((s) => s.spellId),
  ).size;
  const innatePrepared = new Set(
    innateSpells
      .filter((s) => s.isPrepared && (getSpellDefinition(s.spellId)?.level || 0) !== 0)
      .map((s) => s.spellId),
  ).size;

  // Calculate Feat Capacity
  let featCapacity = 0;
  if (state.backgroundId) featCapacity += 1;
  const species = getSpeciesDefinition(state);
  if (species?.traits.some((t) => t.id === 'versatile' || t.name === '多才多艺')) {
    featCapacity += 1;
  }
  state.classes.forEach((cEntry) => {
    const classDef = getClassDefinition(cEntry.classId);
    if (!classDef) return;
    for (let l = 1; l <= cEntry.level; l++) {
      const prog = classDef.progression.find((p) => p.level === l);
      if (
        prog?.featuresUnlocked?.some(
          (f) =>
            f.includes('属性值提升') ||
            f.includes('专长') ||
            f.includes('Ability Score Improvement') ||
            f.includes('Feat') ||
            f.includes('传奇恩惠'),
        )
      ) {
        featCapacity += 1;
      }
    }
  });

  const spellDcTrace: string[] = [];
  const spellAttackTrace: string[] = [];
  const slotsTrace: string[] = [];
  let spellSaveDcBonus = 0;
  let spellAttackBonus = 0;

  getActiveItemDefinitions(state).forEach((item) => {
    const dcBonus = Number((item as any).bonusSpellSaveDc) || 0;
    const attackBonus = Number((item as any).bonusSpellAttack) || 0;
    if (dcBonus) {
      spellSaveDcBonus += dcBonus;
      spellDcTrace.push(`${item.name}: +${dcBonus}`);
    }
    if (attackBonus) {
      spellAttackBonus += attackBonus;
      spellAttackTrace.push(`${item.name}: +${attackBonus}`);
    }
  });

  const totalLevel = state.classes?.reduce((acc, c) => acc + c.level, 0) || 1;
  const pb = Math.floor((totalLevel - 1) / 4) + 2;

  if (abilityKey) {
    const { modifiers } = computeAbilityScores(state);
    const abilityMod = (modifiers as any)[abilityKey] || 0;
    const abilityName = translateAbilityKey(abilityKey);

    spellDcTrace.push('基础值: 8');
    spellDcTrace.push(`熟练加值: +${pb}`);
    spellDcTrace.push(`${abilityName}修正: ${abilityMod >= 0 ? '+' : ''}${abilityMod}`);
    spellDcTrace.push(`法术豁免 DC: ${8 + pb + abilityMod + spellSaveDcBonus}`);

    const atkTotal = pb + abilityMod + spellAttackBonus;
    spellAttackTrace.push(
      `熟练加值 (+${pb}) + ${abilityName}修正 (${abilityMod >= 0 ? '+' : ''}${abilityMod}) = ${atkTotal >= 0 ? '+' : ''}${atkTotal}`,
    );
  }

  if (totalCasterLevel > 0) {
    slotsTrace.push(`有效施法者等级: ${totalCasterLevel}`);
  }
  if (Object.keys(pactMagicSlots).length > 0) {
    Object.entries(pactMagicSlots).forEach(([lvl, count]) => {
      slotsTrace.push(`契约魔法: ${lvl}环 × ${count}`);
    });
  }

  return {
    casterLevel: totalCasterLevel,
    spellSlots: slots,
    standardSpellSlots,
    pactMagicSlots,
    cantripsKnown: totalCantrips + innateCantrips,
    spellsPrepared: totalPrepared + innatePrepared,
    featCapacity: featCapacity,
    spellcastingAbility: abilityKey ? translateAbilityKey(abilityKey) : primaryAbility,
    abilityKey,
    spellDcTrace,
    spellAttackTrace,
    slotsTrace,
    spellSaveDcBonus,
    spellAttackBonus,
  };
}

export function getInnateSpells(state: CharacterState): InnateSpellSource[] {
  const result: InnateSpellSource[] = [];
  const totalLevel = state.classes?.reduce((acc, c) => acc + c.level, 0) || 1;
  const modifiers = computeAbilityScores(state).modifiers;

  const processTraitSpells = (traits: any[] | undefined, sourceLabel: string) => {
    if (!traits) return;
    traits.forEach((trait) => {
      if (trait.level && trait.level > totalLevel) return;

      const spells = trait.features?.spells || trait.mechanics?.spells;
      if (!spells) return;

      const traitId = trait.id || trait.name;
      const selectedAbility = getSpeciesSpellAbility(
        state.speciesSelections,
        state.speciesId,
        state.subspeciesId,
        traitId,
      );
      const abilityKey = normalizeAbilityKey(
        trait.mechanics?.spellcastingAbility || selectedAbility || '',
      );
      const modifier = abilityKey ? modifiers[abilityKey as keyof typeof modifiers] : undefined;
      const pb = Math.floor((totalLevel - 1) / 4) + 2;
      const spellSource =
        sourceLabel === '种族' && abilityKey && modifier !== undefined
          ? `${sourceLabel}（${translateAbilityKey(abilityKey)}；豁免 DC ${8 + pb + modifier}，攻击 ${pb + modifier >= 0 ? '+' : ''}${pb + modifier}）`
          : sourceLabel;

      spells.forEach((s: any, spellIndex: number) => {
        if ('numToChoose' in s) {
          const selections = getSpeciesSpellSelections(
            state.speciesSelections,
            state.speciesId,
            state.subspeciesId,
            traitId,
            spellIndex,
            spells.filter((entry: any) => 'numToChoose' in entry).length,
          );
          selections.forEach((selId) => {
            const opt =
              s.options.find((o: any) => o.spellId === selId) ||
              (s.filter && getSpellDefinition(selId)
                ? { spellId: selId, level: 1, isPrepared: true, freeCastsPerLongRest: 0 }
                : undefined);
            if (opt && opt.level <= totalLevel) {
              result.push({
                spellId: opt.spellId,
                source: spellSource,
                unlockLevel: opt.level,
                isPrepared: opt.isPrepared,
                freeCastsPerLongRest: opt.freeCastsPerLongRest,
              });
            }
          });
        } else {
          const spellList =
            s.spells || (s.spellId ? [s.spellId] : s.spellName ? [s.spellName] : []);
          spellList.forEach((sp: string) => {
            const def = getSpellDefinition(sp);
            const resolvedId = def?.id || s.spellId || s.spellName || sp;
            if ((s.level || 0) <= totalLevel) {
              result.push({
                spellId: resolvedId,
                source: spellSource,
                unlockLevel: s.level || 0,
                isPrepared: s.prepared !== false,
                freeCastsPerLongRest: s.freeCastsPerLongRest,
              });
            }
          });
        }
      });
    });
  };

  const species = getSpeciesDefinition(state);
  const subspecies = getSubspeciesDefinition(state);

  // 收集所有被亚种特质替换掉的母特质名称
  const overwrittenTraitNames = new Set<string>();
  if (subspecies?.traits) {
    subspecies.traits.forEach((st: any) => {
      if (st.overwrite) {
        overwrittenTraitNames.add(st.overwrite.toLowerCase().replace(/[-_\s]+/g, ''));
      }
    });
  }

  if (species) {
    // 过滤掉已被亚种特质替换的母特质，杜绝母特质法术残存或重复展示
    const activeBaseTraits = subspecies
      ? species.traits.filter((t) => {
          const tName = (t.name || '').toLowerCase().replace(/[-_\s]+/g, '');
          const tNameEn = (t.nameEn || '').toLowerCase().replace(/[-_\s]+/g, '');
          return (
            !overwrittenTraitNames.has(tName) && (!tNameEn || !overwrittenTraitNames.has(tNameEn))
          );
        })
      : species.traits;
    processTraitSpells(activeBaseTraits, '种族');
  }

  if (subspecies) processTraitSpells(subspecies.traits, '种族');

  state.selectedFeats?.forEach((fEntry) => {
    const selections = state.speciesSelections?.[fEntry.featId] || [];
    selections.forEach((selId) => {
      if (getSpellDefinition(selId)) {
        result.push({
          spellId: selId,
          source: '专长',
          grantSourceId: JSON.stringify([
            'selected-feat',
            fEntry.classId,
            fEntry.level,
            fEntry.featId,
          ]),
          unlockLevel: 0,
          isPrepared: true,
        });
      }
    });
  });

  Object.entries(state.featSelections || {}).forEach(([slotId, choices]) => {
    const feat = getFeatDefinition(choices.featId);
    if (!feat) return;

    choices.spells?.forEach((spellId) => {
      result.push({
        spellId: spellId,
        source: `专长: ${feat.name}`,
        grantSourceId: JSON.stringify(['feat-slot', slotId, feat.id]),
        unlockLevel: 0,
        isPrepared: true,
      });
    });
  });

  for (const grant of getNativeFeatSpellGrants(state)) {
    result.push({
      spellId: grant.spellId,
      source: grant.source,
      grantSourceId: JSON.stringify(['native-feat', grant.slotId, grant.sourceId, grant.ruleId]),
      unlockLevel: grant.level,
      isPrepared: true,
      freeCastsPerLongRest: grant.freeCastsPerLongRest,
      freeCastResourceId: grant.freeCastsPerLongRest
        ? JSON.stringify(['native-feat-free-cast', grant.slotId, grant.sourceId, grant.ruleId])
        : undefined,
    });
  }

  const legacyPreparedByClass = new Map<string, Set<string>>();
  const legacyPreparedBySubclass = new Map<string, Set<string>>();
  state.classes?.forEach((cEntry) => {
    const classDef = getClassDefinition(cEntry.classId);
    if (!classDef) return;

    const activeFeatures = classDef.features.filter((f) => f.level <= cEntry.level);
    const startIndex = result.length;
    processTraitSpells(activeFeatures, `职业: ${classDef.name}`);
    legacyPreparedByClass.set(
      classDef.catalogId || cEntry.classId,
      new Set(
        result
          .slice(startIndex)
          .filter((entry) => entry.isPrepared)
          .map((entry) => entry.spellId),
      ),
    );

    if (cEntry.subclassId) {
      const subclassDef = getSubclassDefinition({ ...state, classes: [cEntry] });
      if (subclassDef) {
        const activeSubTraits = subclassDef.traits.filter((t) => t.level <= cEntry.level);
        const subStart = result.length;
        processTraitSpells(activeSubTraits, `子职业: ${subclassDef.name}`);
        legacyPreparedBySubclass.set(
          JSON.stringify([
            classDef.catalogId || cEntry.classId,
            subclassDef.catalogId || cEntry.subclassId,
          ]),
          new Set(
            result
              .slice(subStart)
              .filter((entry) => entry.isPrepared)
              .map((entry) => entry.spellId),
          ),
        );
      }
    }

    Object.entries(state.classSelections || {}).forEach(([choiceId, selection]) => {
      const featureWithChoice = classDef.features.find((f) =>
        f.mechanics?.choices?.some((c: any) => c.id === choiceId),
      );
      if (!featureWithChoice || featureWithChoice.level > cEntry.level) return;

      const selectedIds = Array.isArray(selection) ? selection : [selection];
      selectedIds.forEach((selId) => {
        const option =
          featureWithChoice.options?.find((o: any) => o.nameEn === selId || o.name === selId) ||
          WarlockInvocations2024.find((i) => i.nameEn === selId || i.name === selId);

        if (option) {
          processTraitSpells([option], `特性: ${option.name}`);
        }
      });
    });
  });

  for (const grant of getNativeClassPreparedSpells(state).grants) {
    const source = `职业: ${grant.className}`;
    // 同职业的成熟特性适配器已提供同一道固定准备法术时，保留原记录及其使用信息。
    if (legacyPreparedByClass.get(grant.classId)?.has(grant.spellId)) continue;
    result.push({
      spellId: grant.spellId,
      source,
      grantSourceId: JSON.stringify([
        'native-class-prepared',
        grant.classId,
        grant.sourceId,
        grant.ruleId,
      ]),
      unlockLevel: grant.unlockLevel,
      isPrepared: true,
      nativeClassPrepared: true,
    });
  }

  for (const grant of getNativeSubclassSpellGrants(state)) {
    if (
      grant.mode === 'prepared' &&
      legacyPreparedBySubclass
        .get(JSON.stringify([grant.classId, grant.sourceId]))
        ?.has(grant.spellId)
    )
      continue;
    result.push({
      spellId: grant.spellId,
      source: grant.source,
      grantSourceId: JSON.stringify([
        'native-subclass',
        grant.classId,
        grant.sourceId,
        grant.ruleId,
      ]),
      unlockLevel: grant.level,
      isPrepared: true,
      nativeSubclassGrant: true,
    });
  }

  // 只合并同来源同机制的重复记录；法术条目在汇总/显示层另行去重。
  const seenSpellKeys = new Set<string>();
  const deduplicatedResult: InnateSpellSource[] = [];
  for (const item of result) {
    const key = JSON.stringify([
      item.spellId,
      item.grantSourceId || item.source,
      item.unlockLevel ?? 0,
      item.isPrepared,
      item.freeCastsPerLongRest,
    ]);
    if (!seenSpellKeys.has(key)) {
      seenSpellKeys.add(key);
      deduplicatedResult.push(item);
    }
  }

  return deduplicatedResult;
}

export function computeSpellProgression(
  state: CharacterState,
  classId: string,
): SpellProgressionStep[] {
  const steps: SpellProgressionStep[] = [];
  const classEntry = state.classes?.find((c) => c.classId === classId);
  if (!classEntry) return steps;

  const classDef = getClassDefinition(classId);
  if (!classDef) return steps;
  const abilityModifiers = computeAbilityScores(state).modifiers as unknown as Record<
    string,
    number
  >;

  let prevCantrips = 0;
  let prevSpells = 0;

  let subclassDef: any = null;
  if (classEntry.subclassId && classDef.subClassInfo) {
    subclassDef = classDef.subClassInfo.options.find(
      (o) =>
        o.catalogId === classEntry.subclassId ||
        o.nameEn === classEntry.subclassId ||
        o.name === classEntry.subclassId,
    );
  }

  let baseAllowedClasses = [classDef.name, classDef.nameEn];

  const nativePlans = getNativeSubclassSpellPlans(state).plans.filter(
    (plan) => plan.storageClassId === classId,
  );
  let nativeSpellPool: Spell[] | undefined;
  for (let lvl = 1; lvl <= classEntry.level; lvl++) {
    const prog = classDef.progression.find((p) => p.level === lvl);
    if (!prog) continue;

    let sc = prog.spellcasting;

    // Fallback: 如果职业进度中没有施法数据，尝试寻找子职定义的施法类型并使用标准表
    if (!sc && subclassDef) {
      const scTrait = subclassDef.traits.find((t: any) => t.mechanics?.spellcastingType);
      const scType = scTrait?.mechanics?.spellcastingType;
      if (scType === '1/3') {
        sc = THIRD_CASTER_TABLE[lvl] as any;
      } else if (scType === '1/2' || scType === 'half') {
        sc = HALF_CASTER_TABLE[lvl] as any;
      }
    }

    let currentCantrips = sc?.cantripsKnown || 0;
    let currentSpells =
      evaluatePreparedFormula(classDef.preparedSpellsFormula, lvl, abilityModifiers) ??
      sc?.spellsPrepared ??
      0;

    let newCantrips = Math.max(0, currentCantrips - prevCantrips);
    let newSpells = Math.max(0, currentSpells - prevSpells);

    let allowedClasses = [...baseAllowedClasses];

    // 如果有子职提供的法术列表来源，则优先加入
    if (subclassDef) {
      const scTrait = subclassDef.traits.find((t: any) => t.mechanics?.spellListSource);
      if (scTrait) {
        const source = scTrait.mechanics.spellListSource;
        [source, translateClass(source)].forEach((item) => {
          if (item && !allowedClasses.includes(item)) {
            allowedClasses.push(item);
          }
        });
      }
    }
    let specialFeatures: string[] = [];
    let canReplace = lvl > 1;

    const features = classDef.features.filter((f) => f.level === lvl);
    for (const f of features) {
      if (f.name === '魔法奥秘' || f.nameEn === 'Magical Secrets') {
        allowedClasses.push('牧师', '德鲁伊', '法师', 'Cleric', 'Druid', 'Wizard');
        specialFeatures.push('魔法奥秘：可从牧师、德鲁伊或法师法术列表中选择法术。');
        baseAllowedClasses = [...allowedClasses];
      }
    }

    if (subclassDef) {
      const subFeatures = subclassDef.traits.filter((t: any) => t.level === lvl);
      for (const f of subFeatures) {
        if (f.name === '魔法探秘' || f.nameEn === 'Magical Discoveries') {
          newSpells += 2;
          allowedClasses.push('牧师', '德鲁伊', '法师', 'Cleric', 'Druid', 'Wizard');
          specialFeatures.push('魔法探秘：额外习得两道自选法术（牧师、德鲁伊或法师列表）。');
        }
      }
    }

    let stepFilter: string | undefined = undefined;
    if (subclassDef) {
      const scTrait = subclassDef.traits.find((t: any) => t.mechanics?.spellcastingType);
      if (scTrait?.mechanics?.spellFilter) {
        stepFilter = scTrait.mechanics.spellFilter;
      }
    }

    let maxSpellLevel = 0;
    if (sc?.spellSlots) {
      const levels = Object.entries(sc.spellSlots)
        .filter(([, slots]) => Number(slots) > 0)
        .map(([key]) => parseInt(key.replace('level', '')));
      maxSpellLevel = Math.max(0, ...levels);
    }

    const extraChoices: SpellChoiceSlot[] = [];
    const alwaysPreparedSpells: string[] = [];

    const scanFeaturesForSpells = (featureList: any[], sourcePrefix: string) => {
      featureList.forEach((f) => {
        const fixedSpells = f.mechanics?.spells;
        if (fixedSpells) {
          fixedSpells.forEach((fs: any) => {
            const isUnlockedAtThisLvl = (f.level === lvl && !fs.level) || fs.level === lvl;
            if (fs.prepared && fs.spells && isUnlockedAtThisLvl) {
              alwaysPreparedSpells.push(...fs.spells);
            }
          });
        }

        if (f.level === lvl) {
          const choices = f.mechanics?.choices || [];
          choices.forEach((c: any) => {
            if (c.type === 'spell') {
              extraChoices.push({
                id: c.id,
                label: f.name,
                numToChoose: c.numToChoose,
                filter: c.filter || '',
                source: `${sourcePrefix}: ${f.name}`,
                isOptional: false,
              });
            }
          });

          const featureChoices = f.mechanics?.choices || [];
          featureChoices.forEach((fc: any) => {
            const selectionKey = fc.id;
            const userSelection = state.classSelections?.[selectionKey] || [];
            const selectedIds = Array.isArray(userSelection)
              ? userSelection
              : userSelection
                ? [userSelection]
                : [];

            selectedIds.forEach((selId: string) => {
              const selectedOpt =
                (f.options || []).find((opt: any) => opt.name === selId || opt.nameEn === selId) ||
                WarlockInvocations2024.find((i) => i.nameEn === selId || i.name === selId);

              if (selectedOpt) {
                const optSpells = selectedOpt.mechanics?.spells;
                if (optSpells) {
                  optSpells.forEach((fs: any) => {
                    if (fs.prepared && fs.spells) {
                      alwaysPreparedSpells.push(...fs.spells);
                    }
                  });
                }
                const optChoices = selectedOpt.mechanics?.choices || [];
                optChoices.forEach((c: any) => {
                  if (c.type === 'spell') {
                    extraChoices.push({
                      id: c.id,
                      label: `${f.name}: ${selectedOpt.name}`,
                      numToChoose: c.numToChoose,
                      filter: c.filter || '',
                      source: `${sourcePrefix}: ${f.name}`,
                      isOptional: true,
                    });
                  }
                });
              }
            });
          });
        }
      });
    };

    scanFeaturesForSpells(classDef.features, '职业');
    if (subclassDef) {
      scanFeaturesForSpells(subclassDef.traits, '子职业');
    }

    const nativeAlwaysPreparedSpells: string[] = [];
    for (const plan of nativePlans)
      for (const entry of plan.rules) {
        if (entry.level !== lvl) continue;
        if (entry.rule.selection.kind === 'choose')
          extraChoices.push({
            id: entry.id,
            label: `${plan.origin.name}：额外戏法`,
            numToChoose: entry.rule.selection.count,
            filter: '',
            source: `子职业: ${plan.origin.name}`,
            isOptional: false,
            nativeRule: { origin: plan.origin, rule: entry.rule },
          });
        else {
          nativeSpellPool ??= getCatalogSpells();
          nativeAlwaysPreparedSpells.push(
            ...resolveSpellGrantCandidates(plan.origin, entry.rule, nativeSpellPool).spellIds,
          );
        }
      }

    if (classDef.nameEn === 'Wizard') {
      const wizardBookCount = lvl === 1 ? 6 : 2;
      extraChoices.push({
        id: `wizard_spellbook_lvl${lvl}`,
        label: lvl === 1 ? '初始法术书习得' : `法术书习得 (等级 ${lvl})`,
        numToChoose: wizardBookCount,
        filter: `class:wizard;level:1-${maxSpellLevel}`,
        source: '法师: 法术书',
        isOptional: false,
      });
    }

    if (
      newCantrips > 0 ||
      newSpells > 0 ||
      (canReplace && lvl > 1) ||
      specialFeatures.length > 0 ||
      extraChoices.length > 0 ||
      alwaysPreparedSpells.length > 0 ||
      nativeAlwaysPreparedSpells.length > 0
    ) {
      steps.push({
        level: lvl,
        newCantrips,
        newSpells,
        canReplace,
        allowedClasses,
        maxSpellLevel,
        specialFeatures,
        extraChoices,
        alwaysPreparedSpells: alwaysPreparedSpells.length > 0 ? alwaysPreparedSpells : undefined,
        ...(nativeAlwaysPreparedSpells.length
          ? { nativeAlwaysPreparedSpells: [...new Set(nativeAlwaysPreparedSpells)] }
          : {}),
        filter: stepFilter,
      });
    }

    prevCantrips = currentCantrips;
    prevSpells = currentSpells;
  }

  return steps;
}

export interface InnateSpellSource {
  spellId: string;
  source: string;
  /** 已有专长选择槽位的来源身份；不是新的原生法术配置存档。 */
  grantSourceId?: string;
  unlockLevel: number;
  isPrepared: boolean;
  freeCastsPerLongRest?: number | string;
  /** 原生专长明确一次长休免费施法的稳定计数身份。 */
  freeCastResourceId?: string;
  /** 新原生职业固定准备由职业记录实时派生，不混入无来源的持久化ID。 */
  nativeClassPrepared?: true;
  nativeSubclassGrant?: true;
}

/** 卡面单一法术行保留所有已知来源；不增加法术或推断尚未记录的施法机制。 */
export function buildSpellSourceMap(
  grants: InnateSpellSource[],
  classSpellIds: string[],
  classLabel: string,
  character?: CharacterState,
): Record<string, string> {
  const sources = new Map<string, Set<string>>();
  grants.forEach((grant) => {
    const labels = sources.get(grant.spellId) || new Set<string>();
    labels.add(grant.source);
    sources.set(grant.spellId, labels);
  });
  if (character?.spellsByLevel) {
    const displayed = new Set(classSpellIds);
    for (const entry of character.classes) {
      const owned = deriveCharacterSpellSelection(character, {
        classId: entry.classId,
        includeInnateSpells: false,
        includeNativeSubclassGrants: false,
      });
      const label = getClassDefinition(entry.classId)?.name || entry.classId;
      for (const id of [...owned.cantripIds, ...owned.preparedSpellIds]) {
        if (!displayed.has(id)) continue;
        const labels = sources.get(id) || new Set<string>();
        labels.add(label);
        sources.set(id, labels);
      }
    }
  }
  // 最终ID列表也包含先天授予，不能仅凭它们再伪造一个职业来源。
  classSpellIds.forEach((id) => {
    if (!sources.has(id)) sources.set(id, new Set([classLabel]));
  });
  return Object.fromEntries([...sources].map(([id, labels]) => [id, [...labels].join('；')]));
}

export interface DerivedSpellSelection {
  cantripIds: string[];
  preparedSpellIds: string[];
  spellbookIds: string[];
}

/** 页面与最终法表共用有效记录视图；只过滤派生结果，不清理历史存档。 */
export function getActiveClassSpellSelections(
  state: CharacterState,
  classId: string,
  steps: SpellProgressionStep[] = computeSpellProgression(state, classId),
): Record<number, ClassSpellSelection> {
  const owner = state.classes.find((entry) => entry.classId === classId);
  if (!owner) return {};
  let nativePool: Spell[] | undefined;
  return Object.fromEntries(
    Object.entries(state.spellsByLevel?.[classId] || {})
      .filter(([level]) => Number(level) <= owner.level)
      .map(([level, selection]) => {
        const stepChoices = steps.find((step) => step.level === Number(level))?.extraChoices || [];
        const validExtraIds = new Set(stepChoices.map((choice) => choice.id));
        return [
          level,
          {
            ...selection,
            extra: Object.fromEntries(
              Object.entries(selection.extra || {})
                .filter(
                  ([choiceId]) =>
                    choiceId.startsWith('wizard_spellbook') || validExtraIds.has(choiceId),
                )
                .map(([choiceId, ids]) => {
                  const choice = stepChoices.find((entry) => entry.id === choiceId);
                  if (!choice?.nativeRule) return [choiceId, ids];
                  if (ids.length > choice.numToChoose) return [choiceId, []];
                  nativePool ??= getCatalogSpells();
                  const valid = new Set(
                    resolveSpellGrantCandidates(
                      choice.nativeRule.origin,
                      choice.nativeRule.rule,
                      nativePool,
                    ).spellIds,
                  );
                  return [choiceId, [...new Set(ids)].filter((id) => valid.has(id))];
                }),
            ),
          },
        ];
      }),
  );
}

/** 从逐级选择记录重建最终法表，保存重开或职业升级后可重复得到同一结果。 */
export function deriveCharacterSpellSelection(
  state: CharacterState,
  options: {
    /** 仅收集此职业的记录，规则计算仍使用完整角色上下文。 */
    classId?: string;
    includeNativeClassPrepared?: boolean;
    includeNativeSubclassGrants?: boolean;
    /** 持久化职业选择时不混入由其他来源实时派生的授予。 */
    includeInnateSpells?: boolean;
  } = {},
): DerivedSpellSelection {
  const cantrips = new Set<string>();
  const prepared = new Set<string>();
  const spellbook = new Set<string>();

  for (const classEntry of state.classes || []) {
    if (options.classId && classEntry.classId !== options.classId) continue;
    const steps = computeSpellProgression(state, classEntry.classId);
    const selections = getActiveClassSpellSelections(state, classEntry.classId, steps);
    const replaced = new Set<string>();
    Object.entries(selections).forEach(([level, selection]) => {
      if (Number(level) > classEntry.level) return;
      if (selection.replacedCantrip) replaced.add(selection.replacedCantrip);
      if (selection.replacedSpell) replaced.add(selection.replacedSpell);
      if (selection.replaced) replaced.add(selection.replaced);
    });
    Object.entries(selections).forEach(([level, selection]) => {
      if (Number(level) > classEntry.level) return;
      selection.cantrips.forEach((id) => {
        if (!replaced.has(id)) cantrips.add(id);
      });
      selection.spells.forEach((id) => {
        if (!replaced.has(id)) prepared.add(id);
      });
      Object.entries(selection.extra || {}).forEach(([choiceId, ids]) => {
        if (choiceId.startsWith('wizard_spellbook')) {
          ids.forEach((id) => spellbook.add(id));
          return;
        }
        // 新原生槽位由所属来源及候选验证后统一汇入；不把任意保存ID直接当授予。
        if (
          steps
            .find((step) => step.level === Number(level))
            ?.extraChoices.some((choice) => choice.id === choiceId && choice.nativeRule)
        )
          return;
        ids.forEach((id) => {
          if (replaced.has(id)) return;
          if (getSpellDefinition(id)?.level === 0) cantrips.add(id);
          else prepared.add(id);
        });
      });
    });
    steps
      .filter((step) => step.level <= classEntry.level)
      .flatMap((step) => [
        ...(step.alwaysPreparedSpells || []),
        ...(options.includeNativeSubclassGrants === false
          ? []
          : step.nativeAlwaysPreparedSpells || []),
      ])
      .forEach((reference) => {
        const spell = getSpellDefinition(reference);
        if (!spell) return;
        if (spell.level === 0) cantrips.add(spell.id);
        else prepared.add(spell.id);
      });
  }

  (options.includeInnateSpells === false ? [] : getInnateSpells(state)).forEach((grant) => {
    if (grant.nativeClassPrepared && options.includeNativeClassPrepared === false) return;
    if (grant.nativeSubclassGrant && options.includeNativeSubclassGrants === false) return;
    const spell = getSpellDefinition(grant.spellId);
    if (!spell) return;
    if (spell.level === 0) cantrips.add(spell.id);
    else if (grant.isPrepared) prepared.add(spell.id);
  });

  return {
    cantripIds: [...cantrips],
    preparedSpellIds: [...prepared],
    spellbookIds: [...spellbook],
  };
}

/** 职业变化只同步生效记录的差量，保留手动取消准备及归属不明的旧记录。 */
export function reconcileClassSpellSelection(
  previous: CharacterState,
  next: CharacterState,
): DerivedSpellSelection {
  const options = { includeInnateSpells: false, includeNativeSubclassGrants: false };
  const before = deriveCharacterSpellSelection(previous, options);
  const after = deriveCharacterSpellSelection(next, options);
  const merge = (field: keyof DerivedSpellSelection) => {
    const oldIds = new Set(before[field]);
    const activeIds = new Set(after[field]);
    return [
      ...new Set([
        ...(next[field] || []).filter((id) => !oldIds.has(id) || activeIds.has(id)),
        ...after[field].filter((id) => !oldIds.has(id)),
      ]),
    ];
  };
  return {
    cantripIds: merge('cantripIds'),
    preparedSpellIds: merge('preparedSpellIds'),
    spellbookIds: merge('spellbookIds'),
  };
}
