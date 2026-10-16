/**
 * 稳定 ID 生成器
 * 对应《DND5R_5etools_rules_engine_agent_spec.md》规范 §9
 * 规则：禁止使用数组 index、随机 UUID 或单纯中文名作为主键；
 * 采用 [packId, kind, source, name, parent, level] 组合编码。
 */

export interface MakeEntryIdInput {
  packId: string;
  kind: string;
  source?: string;
  name?: string;
  parent?: string;
  level?: number;
}

export function makeEntryId(input: MakeEntryIdInput): string {
  const parts = [
    input.packId,
    input.kind,
    input.source,
    input.name,
    input.parent,
    input.level !== undefined ? String(input.level) : undefined,
  ]
    .filter((v): v is string => v !== undefined && v !== '')
    .map((v) => encodeURIComponent(String(v).trim().toLowerCase().replace(/\s+/g, '-')));

  return parts.join(':');
}

/**
 * 判断规则书版本归属 (2014 vs 2024)
 * 原生版本字段优先，其次使用解析出版物元数据得到的版本；未知来源保留双轨可见。
 */
export function inferEditionFromSource(
  source: string,
  raw: Record<string, unknown> = {},
  publicationEdition?: '2014' | '2024',
): '2014' | '2024' | 'both' {
  if (raw.edition === 'classic' || raw.edition === '2014') return '2014';
  if (raw.edition === 'one' || raw.edition === '2024') return '2024';
  if (raw.edition === 'both') return 'both';
  return publicationEdition ?? 'both';
}
