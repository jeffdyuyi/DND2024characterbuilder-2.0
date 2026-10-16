import { defaultCatalog } from '@/catalog/catalog';
import { getCatalogSpells, catalogEntryToSpell } from '@/catalog/adapters/spells';
import { collectClassSpellGrantSources } from './classSpellGrants';
import { resolveSpellGrantCandidates } from './spellGrantCandidates';
import type { CatalogService } from '@/catalog/types';
import type { CharacterState } from '@/types/characterState';
import type { Spell } from '@/types/spell';

/** 首个生产接入范围：职业根条目、单块、固定prepared，无次数或选法条件。 */
export function getNativeClassPreparedSpells(
  character: CharacterState,
  candidates?: Spell[],
  catalog: CatalogService = defaultCatalog,
) {
  const grants: {
    spellId: string;
    classId: string;
    className: string;
    sourceBook: string;
    sourceId: string;
    ruleId: string;
    unlockLevel: number;
  }[] = [];
  const diagnostics: { sourceId: string; reference: string; message: string }[] = [];
  let pool = candidates;
  const sources = collectClassSpellGrantSources(character, catalog).sources;
  for (const source of sources) {
    const parsed = source.grants;
    if (parsed.origin.kind !== 'class') continue;
    const block = parsed.blocks[0];
    if (!block) {
      if (parsed.diagnostics.some((entry) => entry.code === 'invalid-additional-spells'))
        diagnostics.push({
          sourceId: parsed.origin.id,
          reference: parsed.origin.name,
          message: '职业额外法术结构未解析，请按原文核对。',
        });
      continue; // attachedSpells不是授予。
    }
    if (
      parsed.blockRelationship !== 'single' ||
      parsed.blocks.length !== 1 ||
      block.requiresReview ||
      (block.ability !== undefined && block.ability.kind !== 'inherit') ||
      block.resourceName !== undefined ||
      block.rules.some(
        (rule) =>
          rule.mode !== 'prepared' ||
          rule.selection.kind !== 'fixed' ||
          rule.usage.kind !== 'unspecified' ||
          !['none', 'level'].includes(rule.gate.kind),
      )
    ) {
      diagnostics.push({
        sourceId: parsed.origin.id,
        reference: parsed.origin.name,
        message: '职业额外法术含尚未接入的分支、选择或使用条件，请按原文核对。',
      });
      continue;
    }
    for (const rule of block.rules) {
      const unlockLevel = rule.gate.kind === 'level' ? rule.gate.value! : 0;
      if (unlockLevel > source.classLevel) continue;
      // 没有已解锁且支持的授予时，不额外装配整份法术目录。
      pool ??=
        catalog === defaultCatalog
          ? getCatalogSpells()
          : catalog.list('spell').map(catalogEntryToSpell);
      const resolved = resolveSpellGrantCandidates(parsed.origin, rule, pool);
      for (const diagnostic of resolved.diagnostics)
        diagnostics.push({
          sourceId: parsed.origin.id,
          reference: diagnostic.reference,
          message: '职业固定法术未加载、引用不唯一或标记尚未支持。',
        });
      for (const spellId of resolved.spellIds)
        grants.push({
          spellId,
          classId: source.classId,
          className: parsed.origin.name,
          sourceBook: parsed.origin.source,
          sourceId: parsed.origin.id,
          ruleId: rule.id,
          unlockLevel,
        });
    }
  }
  return { grants, diagnostics };
}
