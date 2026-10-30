import { clean5eTags, flattenEntries } from '@/source/fiveetools-cn/utils';

/** 只处理明确不占已知法术额度、以职业等级为门槛的固定授予表。 */
export function parseClassSpellTables(raw: Record<string, any>) {
  const result: {
    spells: { level: number; spells: string[]; prepared: boolean; freeCastsPerLongRest?: number }[];
    diagnostics: string[];
  } = { spells: [], diagnostics: [] };
  if (raw.additionalSpells || raw.mechanics?.spells) return result;
  const hasTable = (node: any): boolean =>
    Array.isArray(node)
      ? node.some(hasTable)
      : Boolean(
          node && typeof node === 'object' && (node.type === 'table' || hasTable(node.entries)),
        );
  if (!hasTable(raw.entries)) return result;
  const text = flattenEntries(raw.entries);
  if (!/(?:学会|习得)/.test(text) || !/不占用[^。]{0,30}已知法术/.test(text)) return result;
  const visit = (node: any) => {
    if (Array.isArray(node)) return node.forEach(visit);
    if (!node || typeof node !== 'object') return;
    if (node.type === 'table' && Array.isArray(node.rows)) {
      const labels = (node.colLabels || []).map((label: string) => clean5eTags(label));
      if (labels.length !== 2 || !/等级/.test(labels[0]) || !/法术/.test(labels[1])) return;
      const rows = node.rows.map((row: any) => {
        if (
          !Array.isArray(row) ||
          row.length !== 2 ||
          typeof row[0] !== 'string' ||
          typeof row[1] !== 'string'
        )
          return undefined;
        const level = Number(row[0].match(/^\s*(\d+)/)?.[1]);
        if (row[1].replace(/\{@spell\s+[^}]+}/g, '').replace(/[、，,;；\s]/g, '')) return undefined;
        const refs = [...row[1].matchAll(/\{@spell\s+([^}]+)/g)].map((match) => {
          const [name, source = 'PHB'] = match[1].split('|');
          return `${name}|${source}`;
        });
        return Number.isInteger(level) && level > 0 && level <= 20 && refs.length
          ? {
              level,
              spells: refs,
              prepared: false,
              ...(/(?:每个|各)(?:一次|1次)/.test(text) && /长休/.test(text)
                ? { freeCastsPerLongRest: 1 }
                : {}),
            }
          : undefined;
      });
      if (rows.some((row: unknown) => !row))
        result.diagnostics.push('固定法术等级表含未识别行，未自动授予。');
      else result.spells.push(...rows);
      return;
    }
    if (node.entries) visit(node.entries);
  };
  visit(raw.entries);
  return result;
}
