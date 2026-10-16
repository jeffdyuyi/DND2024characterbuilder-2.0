/** 与种族页相同的槽位优先级；空数组表示明确取消，不能回退到旧记录。 */
export function getSpeciesSpellSelections(
  selections: Record<string, string[]> | undefined,
  speciesId: string | undefined,
  subspeciesId: string | undefined,
  traitId: string,
  spellIndex: number,
  choiceCount: number,
): string[] {
  const keys = [
    `sp:${speciesId}:trait:${traitId}:spell-${spellIndex}`,
    ...(subspeciesId ? [`sp:${speciesId}:sub:${subspeciesId}:spell-${spellIndex}`] : []),
    `sp:${speciesId}:trait:innate-spells:spell-${spellIndex}`,
    `${traitId}:spell-${spellIndex}`,
    // 无槽位编号的历史记录只在归属唯一时可确认。
    ...(choiceCount === 1 ? [traitId] : []),
  ];
  for (const key of keys) {
    const values = selections?.[key];
    if (Array.isArray(values)) return [...new Set(values)];
  }
  return [];
}
