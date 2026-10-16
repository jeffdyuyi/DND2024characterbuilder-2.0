import type { Background } from '@/types/background';
import type { Spell } from '@/types/spell';

const normalize = (value: string) => value.trim().toLowerCase();

/** 候选应由调用方按角色启用来源过滤；不创建法术，也不改写角色选择。 */
export function resolveBackgroundSpellList(
  background: Background | undefined,
  candidates: Spell[],
) {
  const spellIds = new Set<string>();
  const diagnostics = new Set(background?.spellListDiagnostics || []);
  for (const ref of background?.expandedSpells || []) {
    const matches = candidates.filter(
      (spell) =>
        spell.level === ref.level &&
        normalize(spell.source) === normalize(ref.source) &&
        [spell.name, spell.nameEn].some((name) => normalize(name) === normalize(ref.name)),
    );
    // 自定义来源优先引用自身包；跨包只允许明确的官方法术，不借用其他第三方同名内容。
    const own = matches.filter((spell) => spell.sourcePackId === background?.sourcePackId);
    const resolved = own.length
      ? own
      : background?.sourcePackId !== '5etools-cn' &&
          normalize(ref.source) !== normalize(background?.source || '')
        ? matches.filter((spell) => spell.sourcePackId === '5etools-cn')
        : [];
    if (resolved.length === 1) spellIds.add(resolved[0].id);
    else
      diagnostics.add(
        `背景扩展法术 ${ref.name}|${ref.source}：${resolved.length ? '引用不唯一' : '未加载或未启用对应来源'}。`,
      );
  }
  return { spellIds, diagnostics: [...diagnostics] };
}
