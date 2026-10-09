import { flattenEntries, clean5eTags } from '@/source/fiveetools-cn/utils';
import { FlavorTable } from '@/types/background';

const mechanicalLabels = new Set([
  'ability scores',
  'feat',
  'skill proficiencies',
  'tool proficiencies',
  'languages',
  'equipment',
  '属性值',
  '专长',
  '技能熟练项',
  '技能熟练',
  '工具熟练',
  '工具熟练项',
  '语言',
  '装备',
]);
const labelKey = (name: unknown) =>
  String(name || '')
    .replace(/[：:]$/, '')
    .trim()
    .toLowerCase();

/** 保留原文段落；机械摘要另有结构化展示，二列表格递归提取到风味表区。 */
export function collectBackgroundContent(raw: Record<string, any>) {
  const flavorTables: FlavorTable[] = [...(raw.flavorTables || [])];
  const tableKeys = new Set(flavorTables.map((table) => JSON.stringify(table)));
  const visit = (node: any, parentName = ''): any => {
    if (typeof node === 'string') {
      const summary = node.match(/^【([^】]+)】/);
      return summary && mechanicalLabels.has(labelKey(summary[1])) ? undefined : node;
    }
    if (!node || typeof node !== 'object') return undefined;
    const names = [node.name, node.ENG_name].map(labelKey);
    if (node.data?.isFeature || names.some((n) => /^(?:feature|特性)[:：]/i.test(n)))
      return undefined;
    if (names.some((n) => mechanicalLabels.has(n))) return undefined;
    if (node.type === 'table' && Array.isArray(node.rows)) {
      // 更复杂的表格保留完整 AST，交给通用 Markdown 渲染，不能截掉额外列。
      if (
        node.colLabels?.length !== 2 ||
        !node.rows.every((row: any) => Array.isArray(row) && row.length === 2)
      )
        return node;
      const colName = clean5eTags(String(node.colLabels[1]));
      const table: FlavorTable = {
        name: clean5eTags(node.caption || colName || parentName || '风味表格'),
        dice: String(node.colLabels[0]).match(/d(\d+)/i)?.[1] || String(node.rows.length),
        rows: node.rows.map((row: any[]) => ({
          id: Number(row[0]),
          content: flattenEntries([row[1]]),
        })),
      };
      // 非单整数骰值（范围、roll 对象等）留在正文，避免将骰值改写为行号。
      if (!table.rows.every((row) => Number.isFinite(row.id))) return node;
      const key = JSON.stringify(table);
      if (!tableKeys.has(key)) {
        tableKeys.add(key);
        flavorTables.push(table);
      }
      return undefined;
    }
    const copy = { ...node };
    for (const field of ['entries', 'items']) {
      if (Array.isArray(node[field]))
        copy[field] = node[field]
          .map((child: any) => visit(child, node.name || parentName))
          .filter((child: any) => child !== undefined);
    }
    if (
      ['entries', 'items'].some(
        (field) => Array.isArray(copy[field]) && copy[field].length === 0,
      ) &&
      !copy.entry
    )
      return undefined;
    return copy;
  };
  const seen = new Set<string>();
  const paragraphs: string[] = [];
  for (const node of [...(raw.fluff?.entries || []), ...(raw.entries || [])]) {
    const filtered = visit(node);
    const text = filtered === undefined ? '' : flattenEntries([filtered]);
    if (text && !seen.has(text)) {
      seen.add(text);
      paragraphs.push(text);
    }
  }
  return {
    description: paragraphs.join('\n\n'),
    flavorTables: flavorTables.length ? flavorTables : undefined,
  };
}
