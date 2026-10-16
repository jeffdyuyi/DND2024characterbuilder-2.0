import type { Background } from '@/types/background';

/** 解析原生 additionalSpells.expanded；结果独立于 raw，不将扩展误作授予。 */
export function parseBackgroundSpellList(value: unknown): {
  expandedSpells: NonNullable<Background['expandedSpells']>;
  spellListDiagnostics: string[];
} {
  const expandedSpells: NonNullable<Background['expandedSpells']> = [];
  const diagnostics = new Set<string>();
  if (value === undefined) return { expandedSpells, spellListDiagnostics: [] };
  if (!Array.isArray(value)) {
    return {
      expandedSpells,
      spellListDiagnostics: ['背景 additionalSpells 不是数组，扩展法表未解析。'],
    };
  }
  if (value.filter((block) => block?.expanded !== undefined).length > 1) {
    return {
      expandedSpells,
      spellListDiagnostics: ['背景含多组扩展法表，需按原文核对组间选择关系。'],
    };
  }
  for (const block of value) {
    if (!block || typeof block !== 'object' || block.expanded === undefined) continue;
    if (!block.expanded || typeof block.expanded !== 'object' || Array.isArray(block.expanded)) {
      diagnostics.add('背景 expanded 结构未识别，请按原文手动核对。');
      continue;
    }
    for (const [key, refs] of Object.entries(block.expanded)) {
      if (!/^s[0-9]$/.test(key) || !Array.isArray(refs)) {
        diagnostics.add(`背景扩展法表 ${key} 未解析，请按原文手动核对。`);
        continue;
      }
      const level = Number(key.slice(1));
      for (const ref of refs) {
        if (typeof ref !== 'string') {
          diagnostics.add(`背景扩展法表 ${key} 含未支持的选择结构，请按原文手动核对。`);
          continue;
        }
        const match = ref.trim().match(/^([^|#]+)(?:\|([^|#]+))?(#c)?$/i);
        if (!match || !match[1].trim() || (match[3] && level !== 0)) {
          diagnostics.add(`背景法术引用 ${ref} 未解析，请按原文手动核对。`);
          continue;
        }
        const spell = { name: match[1].trim(), source: (match[2] || 'PHB').trim(), level };
        if (
          !expandedSpells.some(
            (s) =>
              s.name === spell.name &&
              s.source.toLowerCase() === spell.source.toLowerCase() &&
              s.level === level,
          )
        ) {
          expandedSpells.push(spell);
        }
      }
    }
  }
  return { expandedSpells, spellListDiagnostics: [...diagnostics] };
}
