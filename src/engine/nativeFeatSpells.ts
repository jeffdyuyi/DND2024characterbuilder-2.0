import { createBuilderChoices } from '@/catalog/builderChoices';
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
            !block.rules.some((rule) => rule.selection.kind === 'choose') ||
            block.ability?.kind === 'inherit' ||
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

export function getNativeFeatSpellGrants(character: CharacterState, candidates?: Spell[]) {
  if (!Object.values(character.featSelections || {}).some((choice) => choice.nativeSpellGrants))
    return [];
  const plans = getNativeFeatSpellPlans(character);
  if (!plans.length) return [];
  const pool =
    candidates ??
    createBuilderChoices(character).getCatalogSpells({
      allowHomebrew: Boolean(character.allowHomebrew),
    });
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
    const saved = character.featSelections?.[slot.id]?.nativeSpellGrants;
    if (!saved || saved.originId !== grants.origin.id) continue;
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
    const ability = block.ability?.kind === 'fixed' ? block.ability.value : saved.ability;
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
    for (const rule of block.rules) {
      if (rule.gate.kind === 'level' && rule.gate.value! > characterLevel) continue;
      const resolved = resolveSpellGrantCandidates(grants.origin, rule, pool);
      if (resolved.diagnostics.length) continue;
      const ids =
        rule.selection.kind === 'fixed'
          ? resolved.spellIds
          : rule.selection.kind === 'choose'
            ? (saved.selections[rule.id] || [])
                .filter((id) => resolved.spellIds.includes(id))
                .slice(0, rule.selection.count)
            : [];
      for (const spellId of new Set(ids))
        result.push({
          spellId,
          slotId: slot.id,
          sourceId: grants.origin.id,
          ruleId: rule.id,
          source,
          level: rule.gate.value || slot.level || 1,
          freeCastsPerLongRest: onePerLongRest && rule === daily[0] ? 1 : undefined,
        });
    }
  }
  return result;
}
