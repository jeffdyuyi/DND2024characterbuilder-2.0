import { defaultCatalog } from '@/catalog/catalog';
import { getCatalogSpells } from '@/catalog/adapters/spells';
import { resolveCatalogReference } from '@/catalog/references';
import { collectClassSpellGrantSources } from './classSpellGrants';
import { getSubclassDefinition } from './characterData';
import { resolveSpellGrantCandidates } from './spellGrantCandidates';
import type { CharacterState } from '@/types/characterState';
import type { ParsedSpellGrants, SpellGrantRule } from '@/types/spellGrant';
import type { Spell } from '@/types/spell';

export interface NativeSubclassSpellPlan {
  classId: string;
  storageClassId: string;
  origin: ParsedSpellGrants['origin'];
  rules: { id: string; level: number; rule: SpellGrantRule }[];
}

/** 只接入单块、无资源/特殊属性、固定准备与明确自选戏法组合；不推断多块关系。 */
export function getNativeSubclassSpellPlans(character: CharacterState) {
  const plans: NativeSubclassSpellPlan[] = [];
  const diagnostics: { sourceId: string; code: string }[] = [];
  if (!character.classes.some((entry) => entry.subclassId)) return { plans, diagnostics };
  for (const source of collectClassSpellGrantSources(character).sources) {
    const parsed = source.grants;
    if (parsed.origin.kind !== 'subclass') continue;
    const selected = character.classes.find(
      (entry) =>
        resolveCatalogReference(defaultCatalog, entry.classId, ['class'], { source: entry.source })
          ?.id === source.classId,
    );
    if (!selected) continue;
    const legacy = getSubclassDefinition({ ...character, classes: [selected] });
    // 已有成熟选法机制继续独占其槽位，避免两套逻辑同时提供同一选择。
    if (
      legacy?.traits.some(
        (trait) =>
          trait.mechanics?.choices?.some((choice: any) => choice.type === 'spell') ||
          trait.mechanics?.spells?.some(
            (entry: any) => entry && typeof entry === 'object' && 'numToChoose' in entry,
          ),
      )
    )
      continue;
    const block = parsed.blocks[0];
    const supported =
      block &&
      parsed.blocks.length === 1 &&
      parsed.blockRelationship === 'single' &&
      !block.requiresReview &&
      !block.resourceName &&
      (!block.ability || block.ability.kind === 'inherit') &&
      block.rules.every((rule) => {
        if (!['none', 'level'].includes(rule.gate.kind) || rule.usage.kind !== 'unspecified')
          return false;
        if (rule.mode === 'prepared')
          return (
            rule.selection.kind === 'fixed' &&
            (!rule.selection.spell.suffix || rule.selection.spell.suffix === 'c')
          );
        if (rule.mode !== 'known' || rule.selection.kind !== 'choose' || !rule.selection.filter)
          return false;
        return (
          // 候选解析能力扩展不应自动扩大已验收的授予范围。
          rule.selection.filter.split('|').every((part) => /^(level|class)=/.test(part.trim())) &&
          rule.selection.filter.split('|').some((part) => part.trim() === 'level=0') &&
          resolveSpellGrantCandidates(parsed.origin, rule, []).diagnostics.every(
            (entry) => entry.code === 'no-loaded-spell-candidates',
          )
        );
      });
    if (!supported || source.unlockLevel === undefined) {
      diagnostics.push({ sourceId: parsed.origin.id, code: 'unsupported-native-subclass-spells' });
      continue;
    }
    plans.push({
      classId: source.classId,
      storageClassId: selected.classId,
      origin: parsed.origin,
      rules: block.rules.map((rule) => ({
        id: `native-subclass:${rule.id}`,
        rule,
        level: Math.max(source.unlockLevel!, rule.gate.kind === 'level' ? rule.gate.value! : 1),
      })),
    });
  }
  return { plans, diagnostics };
}

/** 从原有每职业/等级extra读回；不改写记录，不把失效槽位当成授予。 */
export function getNativeSubclassSpellGrants(character: CharacterState, candidates?: Spell[]) {
  const grants: {
    spellId: string;
    classId: string;
    sourceId: string;
    ruleId: string;
    source: string;
    level: number;
    mode: SpellGrantRule['mode'];
  }[] = [];
  let pool = candidates;
  for (const plan of getNativeSubclassSpellPlans(character).plans) {
    const owner = character.classes.find((entry) => entry.classId === plan.storageClassId)!;
    const selections = character.spellsByLevel?.[plan.storageClassId] || {};
    const replaced = new Set(
      Object.entries(selections)
        .filter(([level]) => Number(level) <= owner.level)
        .flatMap(([, selection]) =>
          [selection.replacedCantrip, selection.replacedSpell, selection.replaced].filter(Boolean),
        ),
    );
    for (const entry of plan.rules) {
      if (entry.level > owner.level) continue;
      const saved = selections[entry.level]?.extra?.[entry.id] || [];
      if (
        entry.rule.selection.kind === 'choose' &&
        (!saved.length || saved.length > entry.rule.selection.count)
      )
        continue;
      pool ??= getCatalogSpells();
      const resolved = resolveSpellGrantCandidates(plan.origin, entry.rule, pool);
      const ids =
        entry.rule.selection.kind === 'fixed'
          ? resolved.spellIds
          : [...new Set(saved)].filter((id) => resolved.spellIds.includes(id) && !replaced.has(id));
      for (const spellId of ids)
        grants.push({
          spellId,
          classId: plan.classId,
          sourceId: plan.origin.id,
          ruleId: entry.rule.id,
          source: `子职业: ${plan.origin.name}`,
          level: entry.level,
          mode: entry.rule.mode,
        });
    }
  }
  return grants;
}
