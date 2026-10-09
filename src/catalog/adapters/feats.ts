/**
 * Catalog Feat Adapter
 * 对应《DND5R_5etools_rules_engine_agent_spec.md》规范 §8、§9、§18、§51
 *
 * 职责：
 * 1. 将 CatalogEntry (5etools / Legacy) 统一转为 UI 和规则引擎使用的 Feat 接口；
 * 2. 提供 getCatalogFeats() 检索专长全集，按 5etools 优先、Legacy 兜底策略去重；
 * 3. 维护稳定全局 ID 与旧版短 ID、英文名、中文名别名映射。
 */

import { CatalogEntry, Edition } from '../types';
import { defaultCatalog } from '../catalog';
import { Feat } from '@/types/feat';

/**
 * 推导专长分类类别
 */
function inferFeatCategory(
  raw: any,
): 'Origin' | 'General' | 'Epic Boon' | 'Fighting Style' | 'Legacy' {
  if (raw.category) {
    const c = String(raw.category).toUpperCase();
    if (c === 'O' || c === 'ORIGIN') return 'Origin';
    if (c === 'FS' || c.includes('FIGHTING')) return 'Fighting Style';
    if (c === 'EB' || c.includes('EPIC') || c.includes('BOON')) return 'Epic Boon';
    if (c === 'LEGACY') return 'Legacy';
    return 'General';
  }

  // 根据 prerequisite 规则粗略推断
  if (Array.isArray(raw.prerequisite)) {
    const prereqStr = JSON.stringify(raw.prerequisite).toLowerCase();
    if (prereqStr.includes('level 1') || prereqStr.includes('1st level')) return 'Origin';
    if (prereqStr.includes('level 19') || prereqStr.includes('level 20')) return 'Epic Boon';
    if (prereqStr.includes('fighting style')) return 'Fighting Style';
  }

  return 'General';
}

/**
 * 将 CatalogEntry 规范化为 UI 期望的标准 Feat 接口
 */
export function catalogEntryToFeat(entry: CatalogEntry): Feat {
  // 1. 若原始对象已是完整的旧版 Feat，直接保留原汁原味
  if (entry.sourcePackId === 'legacy' && entry.raw && (entry.raw as any).category) {
    return entry.raw as unknown as Feat;
  }

  // 2. 5etools-cn 格式适配
  const raw = (entry.raw || {}) as any;
  const category = inferFeatCategory(raw);

  let prerequisiteStr: string | undefined = undefined;
  if (Array.isArray(raw.prerequisite) && raw.prerequisite.length > 0) {
    const p = raw.prerequisite[0];
    const parts: string[] = [];
    if (p.level) parts.push(`等级 ${p.level}+`);
    if (p.ability) {
      const abs = Object.entries(p.ability)
        .map(([k, v]) => `${k.toUpperCase()} ${v}+`)
        .join(' 或 ');
      parts.push(abs);
    }
    if (p.proficiency) {
      parts.push(`熟练于 ${p.proficiency.join(', ')}`);
    }
    if (parts.length > 0) {
      prerequisiteStr = parts.join('; ');
    }
  }

  return {
    id: entry.id,
    source: entry.source,
    name: entry.name,
    nameEn: entry.englishName || entry.name,
    category,
    description: entry.description || '',
    prerequisite: prerequisiteStr,
    repeatable: Boolean(raw.repeatable),
    mechanics: raw.mechanics || {},
  } as Feat;
}

/**
 * 获取 Catalog 中注册的所有专长
 * 合并策略：按英文原名/规范化标识去重，5etools 来源优先，Legacy 作为兜底
 */
export function getCatalogFeats(options?: {
  edition?: Edition;
  category?: string;
  source?: string;
}): Feat[] {
  const entries = defaultCatalog.list('feat', options);
  const feats: Feat[] = [];
  const seenKeys = new Set<string>();

  // 1. 优先放入 5etools / homebrew 条目
  for (const entry of entries) {
    if (entry.sourcePackId !== 'legacy') {
      const feat = catalogEntryToFeat(entry);
      if (options?.category && feat.category !== options.category) continue;
      const key = `${entry.source}:${(feat.nameEn || feat.name).toLowerCase().replace(/[-_\s]+/g, '')}`;
      seenKeys.add(key);
      feats.push(feat);
    }
  }

  // 2. 补充放入 Legacy 条目
  for (const entry of entries) {
    if (entry.sourcePackId === 'legacy') {
      const feat = catalogEntryToFeat(entry);
      if (options?.category && feat.category !== options.category) continue;
      const key = `${entry.source}:${(feat.nameEn || feat.name).toLowerCase().replace(/[-_\s]+/g, '')}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        feats.push(feat);
      }
    }
  }

  return feats;
}
