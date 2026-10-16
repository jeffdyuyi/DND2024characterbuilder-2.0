/** 与种族页相同的槽位优先级；空数组表示明确取消，不能回退到旧记录。 */
export function getSpeciesSpellSelections(
  selections: Record<string, string[]> | undefined,
  speciesId: string | undefined,
  subspeciesId: string | undefined,
  traitId: string,
  spellIndex: number,
  choiceCount: number,
): string[] {
  const prefix = `sp:${speciesId}:trait:`;
  const shortTraitId = traitId.startsWith(prefix) ? traitId.slice(prefix.length) : traitId;
  const keys = [
    traitId.startsWith('sp:')
      ? `${traitId}:spell-${spellIndex}`
      : `sp:${speciesId}:trait:${traitId}:spell-${spellIndex}`,
    ...(subspeciesId ? [`sp:${speciesId}:sub:${subspeciesId}:spell-${spellIndex}`] : []),
    `sp:${speciesId}:trait:innate-spells:spell-${spellIndex}`,
    `${traitId}:spell-${spellIndex}`,
    `${shortTraitId}:spell-${spellIndex}`,
    // 无槽位编号的历史记录只在归属唯一时可确认。
    ...(choiceCount === 1 ? [traitId, shortTraitId] : []),
  ];
  for (const key of keys) {
    const values = selections?.[key];
    if (Array.isArray(values)) return [...new Set(values)];
  }
  return [];
}

/** 当前槽位优先；明确清空不能回退到旧镜像或其他特质。 */
export function getSpeciesSpellAbility(
  selections: Record<string, string[]> | undefined,
  speciesId: string | undefined,
  subspeciesId: string | undefined,
  traitId: string,
): string {
  const traitKey = traitId.startsWith('sp:') ? traitId : `sp:${speciesId}:trait:${traitId}`;
  const keys = [
    `${traitKey}:ability`,
    ...(subspeciesId ? [`sp:${speciesId}:sub:${subspeciesId}:ability`] : []),
    `sp:${speciesId}:trait:innate-spellcasting-ability`,
  ];
  for (const key of keys) {
    const values = selections?.[key];
    if (Array.isArray(values)) return values[0] || '';
  }
  return '';
}
