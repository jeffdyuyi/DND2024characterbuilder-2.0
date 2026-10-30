import { getCatalogSpells } from '@/catalog';
import { collectFeatSlotSpellGrantSources } from './featSlotSpellGrants';
import {
  getBackgroundDefinition,
  getClassDefinition,
  getFeatDefinition,
  getSpeciesDefinition,
} from './characterData';
import { resolveSpellGrantCandidates } from './spellGrantCandidates';
import { computeAbilityScores } from './ability';
import { translateAbilityKey } from './terminology';
import { defaultCatalog } from '@/catalog/catalog';
import type { CharacterState } from '@/types/characterState';
import type { Spell } from '@/types/spell';
import type { SpellGrantRule } from '@/types/spellGrant';
import type { CharacterFeatSlot } from './featSlots';

/** 只有原文明确要求复选时使用不同法表，才限制同一专长的其他槽位。 */
export function requiresDistinctNativeFeatBlocks(originId: string): boolean {
  const raw = defaultCatalog.get(originId)?.raw;
  return Boolean(
    raw?.repeatable &&
    /每次.{0,30}不同的法术列表|each time.{0,60}different spell list/i.test(
      JSON.stringify(raw.entries || []),
    ),
  );
}

export function allowsNativeFeatLevelReplacement(originId: string): boolean {
  const prose = JSON.stringify(defaultCatalog.get(originId)?.raw.entries || []);
  return /每当你获得一级新等级.{0,100}替换.{0,30}一道法术|whenever you gain a new level.{0,100}replace one spell/i.test(
    prose,
  );
}

export function canRecordNativeFeatLevelReplacement(
  character: CharacterState,
  slot: CharacterFeatSlot,
  originId: string,
): boolean {
  return (
    allowsNativeFeatLevelReplacement(originId) && (!slot.classId || character.classes.length === 1)
  );
}

export function getActiveNativeFeatRuleSelections(
  saved: NonNullable<NonNullable<CharacterState['featSelections']>[string]['nativeSpellGrants']>,
  rule: SpellGrantRule,
  candidates: string[],
  level: number,
  acquiredLevel: number,
  allowReplacement: boolean,
): string[] {
  if (rule.selection.kind !== 'choose') return [];
  const selected = [
    ...new Set(
      (saved.selections[rule.id] || [])
        .filter((id) => candidates.includes(id))
        .slice(0, rule.selection.count),
    ),
  ];
  if (!allowReplacement) return selected;
  for (const [step, replacement] of Object.entries(saved.replacements || {})
    .map(([key, value]) => [Number(key), value] as const)
    .filter(([step]) => Number.isInteger(step) && step > acquiredLevel && step <= level)
    .sort(([a], [b]) => a - b)) {
    if (replacement.ruleId !== rule.id) continue;
    const index = selected.indexOf(replacement.from);
    if (index >= 0 && candidates.includes(replacement.to) && !selected.includes(replacement.to))
      selected[index] = replacement.to;
  }
  return selected;
}

export function getNativeFeatSpellPlans(character: CharacterState) {
  const definitions = {
    background: getBackgroundDefinition(character),
    species: getSpeciesDefinition(character),
    getClass: getClassDefinition,
  };
  return collectFeatSlotSpellGrantSources(character, definitions).sources.flatMap(
    ({ slot, characterLevel, grants }) => {
      const feat = getFeatDefinition(slot.currentFeatId);
      if (feat?.mechanics?.spells?.length) return []; // 成熟配置保留原路径。
      if (
        !grants.blocks.length ||
        grants.blockRelationship === 'unspecified' ||
        grants.blocks.some(
          (block) =>
            block.requiresReview ||
            block.resourceName ||
            block.rules.some(
              (rule) =>
                rule.mode === 'expanded' ||
                !['none', 'level'].includes(rule.gate.kind) ||
                !['unspecified', 'daily'].includes(rule.usage.kind) ||
                rule.selection.kind === 'all',
            ),
        )
      )
        return [];
      return [{ slot, characterLevel, grants }];
    },
  );
}

/** inherit 关联同一专长槽位的属性提升，不借用职业施法属性。 */
export function getInheritedFeatSpellAbility(
  character: CharacterState,
  slotId: string,
  originId: string,
) {
  const choices = character.featSelections?.[slotId];
  if (choices?.featId !== originId) return undefined;
  const allocations = Object.entries(choices.asi || {}).filter(([, amount]) => amount !== 0);
  const ability =
    allocations.length === 1 ? allocations[0][0] : allocations.length ? undefined : choices.ability;
  if (!ability) return undefined;
  const improvements = defaultCatalog.get(originId)?.raw.ability;
  if (!Array.isArray(improvements)) return undefined;
  return improvements.some(
    (entry: any) =>
      (entry?.choose?.from?.includes(ability) &&
        (entry.choose.count ?? 1) === 1 &&
        (!allocations.length || allocations[0][1] === (entry.choose.amount ?? 1))) ||
      (Number(entry?.[ability]) > 0 &&
        (!allocations.length || allocations[0][1] === entry[ability])),
  )
    ? ability
    : undefined;
}

export function getNativeFeatSpellGrants(character: CharacterState, candidates?: Spell[]) {
  const plans = getNativeFeatSpellPlans(character);
  if (!plans.length) return [];
  // 来源范围只限制新候选；已保存的选择仍须按完整目录验证并派生。
  const pool = candidates ?? getCatalogSpells();
  const result: {
    spellId: string;
    slotId: string;
    sourceId: string;
    ruleId: string;
    source: string;
    level: number;
    freeCastsPerLongRest?: number;
  }[] = [];
  const usedBlocks = new Set<string>();
  for (const { slot, characterLevel, grants } of plans) {
    const recorded = character.featSelections?.[slot.id]?.nativeSpellGrants;
    const saved =
      recorded?.originId === grants.origin.id
        ? recorded
        : { originId: grants.origin.id, selections: {} };
    const block =
      grants.blockRelationship === 'single'
        ? grants.blocks[0]
        : grants.blocks.find((entry) => entry.id === saved.blockId);
    if (!block) continue;
    const blockKey = JSON.stringify([grants.origin.id, block.id]);
    if (requiresDistinctNativeFeatBlocks(grants.origin.id)) {
      if (usedBlocks.has(blockKey)) continue;
      usedBlocks.add(blockKey);
    }
    if (block.ability?.kind === 'choose' && !block.ability.from.includes(saved.ability || ''))
      continue;
    const ability =
      block.ability?.kind === 'inherit'
        ? getInheritedFeatSpellAbility(character, slot.id, grants.origin.id)
        : block.ability?.kind === 'fixed'
          ? block.ability.value
          : saved.ability;
    if (block.ability?.kind === 'inherit' && !ability) continue;
    const modifier = ability
      ? computeAbilityScores(character).modifiers[
          ability as keyof ReturnType<typeof computeAbilityScores>['modifiers']
        ]
      : undefined;
    const pb = Math.floor((characterLevel - 1) / 4) + 2;
    const source =
      ability && modifier !== undefined
        ? `专长: ${grants.origin.name}（${translateAbilityKey(ability)}；豁免 DC ${8 + pb + modifier}，攻击 ${pb + modifier >= 0 ? '+' : ''}${pb + modifier}）`
        : `专长: ${grants.origin.name}`;
    const daily = block.rules.filter((rule) => rule.usage.kind === 'daily');
    const prose = JSON.stringify(defaultCatalog.get(grants.origin.id)?.raw.entries || []);
    const onePerLongRest =
      daily.length === 1 &&
      daily[0].usage.key === '1' &&
      /一次.{0,120}长休|长休.{0,120}一次|once.{0,120}long rest/i.test(prose);
    const allowReplacement = canRecordNativeFeatLevelReplacement(character, slot, grants.origin.id);
    for (const rule of block.rules) {
      if (rule.gate.kind === 'level' && rule.gate.value! > characterLevel) continue;
      const resolved = resolveSpellGrantCandidates(grants.origin, rule, pool);
      if (resolved.diagnostics.length) continue;
      const ids =
        rule.selection.kind === 'fixed'
          ? resolved.spellIds
          : rule.selection.kind === 'choose'
            ? getActiveNativeFeatRuleSelections(
                saved,
                rule,
                resolved.spellIds,
                characterLevel,
                slot.level || 1,
                allowReplacement,
              )
            : [];
      for (const spellId of new Set(ids))
        result.push({
          spellId,
          slotId: slot.id,
          sourceId: grants.origin.id,
          ruleId: rule.id,
          source,
          level: rule.gate.value || slot.level || 1,
          freeCastsPerLongRest:
            onePerLongRest && rule === daily[0] && ids.length === 1 ? 1 : undefined,
        });
    }
  }
  return result;
}
