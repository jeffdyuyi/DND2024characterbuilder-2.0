import { CatalogEntry } from '@/catalog/types';

/**
 * 仅为规则文本完全无法推导的底层机制提供补充覆盖（如特定等级同调上限突破、特殊数学公式等）。
 * 严禁在此穷举专精、武器精通等常规法条选择，所有标准规则文本必须由 featureChoicesParser 动态解析。
 */
const FEATURE_MECHANICS: Record<string, Record<string, unknown>> = {
  // 盗贼 13 级 使用魔法装置：同调上限由 3 变为 4
  'subclassfeature|xphb|rogue|thief|usemagicdevice|13': { attunementLimit: 4 },
};

const key = (value: unknown) => String(value || '').toLowerCase().replace(/[-_\s']/g, '');

export function getFeatureMechanicsOverlay(entry: CatalogEntry): Record<string, unknown> | undefined {
  const raw = (entry.raw || {}) as any;
  const identity = [
    key(entry.kind),
    key(entry.source),
    key(raw.className),
    key(raw.subclassShortName || raw.subclassName),
    key(entry.englishName || entry.name),
    key(raw.level),
  ].join('|');

  return FEATURE_MECHANICS[identity];
}
