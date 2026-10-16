import type { ParsedSpellGrants, SpellGrantRule, SpellReference } from '@/types/spellGrant';
import type { Spell } from '@/types/spell';

export interface SpellGrantCandidates {
  spellIds: string[];
  diagnostics: { code: string; reference: string }[];
}

const normalize = (value: string) => value.trim().toLowerCase();

/** 仅解析候选，不激活等级/分支、不授予法术或修改存档。
 * candidates必须由调用方按启用来源筛选；不从全局目录补齐被禁用资源。
 */
export function resolveSpellGrantCandidates(
  origin: ParsedSpellGrants['origin'],
  rule: SpellGrantRule,
  candidates: Spell[],
): SpellGrantCandidates {
  const result: SpellGrantCandidates = { spellIds: [], diagnostics: [] };
  const report = (code: string, reference: string) => result.diagnostics.push({ code, reference });
  const pool = [...new Map(candidates.map((spell) => [spell.id, spell])).values()];
  const resolve = (ref: SpellReference) => {
    if (ref.suffix !== undefined && ref.suffix !== 'c') {
      report('unsupported-spell-suffix', ref.raw);
      return;
    }
    const matches = pool.filter(
      (spell) =>
        normalize(spell.source) === normalize(ref.source) &&
        [spell.name, spell.nameEn].some((name) => normalize(name) === normalize(ref.name)) &&
        (ref.suffix !== 'c' || spell.level === 0),
    );
    const own = matches.filter((spell) => spell.sourcePackId === origin.sourcePackId);
    const resolved = own.length
      ? own
      : origin.sourcePackId !== '5etools-cn' && normalize(ref.source) !== normalize(origin.source)
        ? matches.filter((spell) => spell.sourcePackId === '5etools-cn')
        : [];
    if (resolved.length === 1) result.spellIds.push(resolved[0].id);
    else
      report(resolved.length ? 'ambiguous-spell-reference' : 'unresolved-spell-reference', ref.raw);
  };
  if (rule.selection.kind === 'fixed') resolve(rule.selection.spell);
  else if (rule.selection.kind === 'choose' && rule.selection.from) {
    rule.selection.from.forEach(resolve);
  } else {
    const filter = rule.selection.filter;
    if (!filter) {
      report('missing-spell-filter', rule.id);
      return result;
    }
    const predicates: ((spell: Spell) => boolean)[] = [];
    const fields = new Set<string>();
    for (const clause of filter.split('|')) {
      const match = clause.trim().match(/^(level|class)=([^=|]+)$/);
      if (!match || fields.has(match[1])) {
        report('unsupported-spell-filter', filter);
        return result;
      }
      const [, field, value] = match;
      fields.add(field);
      const values = value.split(';').map(normalize);
      if (values.some((part) => !part) || (field === 'level' && !/^[0-9]$/.test(value.trim()))) {
        report('unsupported-spell-filter', filter);
        return result;
      }
      if (field === 'level') predicates.push((spell) => values.includes(String(spell.level)));
      else
        predicates.push((spell) => spell.classes.some((name) => values.includes(normalize(name))));
    }
    result.spellIds = pool
      .filter((spell) => predicates.every((predicate) => predicate(spell)))
      .map((spell) => spell.id);
  }
  result.spellIds = [...new Set(result.spellIds)];
  if (!result.spellIds.length && !result.diagnostics.length)
    report('no-loaded-spell-candidates', rule.id);
  return result;
}
