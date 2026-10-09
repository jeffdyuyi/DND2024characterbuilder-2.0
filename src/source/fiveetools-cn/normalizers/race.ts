/**
 * 5etools Race & Subrace Normalizer
 * 对应《DND5R_5etools_rules_engine_agent_spec.md》规范 §8、§9、§18
 */

import { CatalogEntry } from '@/catalog/types';
import { makeEntryId, inferEditionFromSource } from '@/catalog/identity';
import { flattenEntries } from '../utils';
import { mergeOverlay } from '@/mechanics-overlay';

export function normalizeRace(raw: Record<string, any>, packId = '5etools-cn'): CatalogEntry {
  const name = raw.name || raw.ENG_name || '未命名种族';
  const englishName = raw.ENG_name || (raw.name !== name ? raw.name : undefined);
  const source = raw.source || 'PHB';
  const edition = inferEditionFromSource(source);

  const id = makeEntryId({
    packId,
    kind: 'race',
    source,
    name: englishName || name,
  });

  const description = flattenEntries(raw.fluff?.entries || raw.entries);

  const entry: CatalogEntry = {
    id,
    kind: 'race',
    name,
    englishName,
    source,
    edition,
    page: raw.page,
    sourcePackId: packId,
    description,
    entries: raw.entries,
    raw,
  };

  return mergeOverlay(entry);
}

function extractSubraceFluffDescription(raw: Record<string, any>): string {
  const fluff = raw.fluff;
  if (!fluff) return '';

  // 1. 优先使用专属描述字段（由 loader 解析原始条目精准提取）
  if (typeof fluff._exclusiveFluff === 'string') {
    return fluff._exclusiveFluff;
  }

  // 2. 如果存在 _copy._mod 专属覆盖（如 5etools 亚种风味专属前置段落）
  const modItems = fluff._copy?._mod?.entries?.items || fluff._copy?._mod?.entries;
  if (modItems) {
    return flattenEntries(Array.isArray(modItems) ? modItems : [modItems]);
  }

  // 3. 仅当该 fluff 条目未采用 _copy（即本身为独立原生条目）时，其 entries 才被视为专属描述
  if (!fluff._copy && Array.isArray(fluff.entries) && fluff.entries.length > 0) {
    return flattenEntries(fluff.entries);
  }

  // 若无独立专属描述，坚决返回空字符串，绝不拿母种族通用长文硬凑，更绝不拿规则特性充数
  return '';
}

export function normalizeSubrace(raw: Record<string, any>, packId = '5etools-cn'): CatalogEntry {
  const fallbackAbstractName = raw._versions?.[0]?._abstract?.name ? String(raw._versions[0]._abstract.name).replace(/\{\{.*?\}\}/g, '变体') : undefined;
  const fallbackAbstractEn = raw._versions?.[0]?._abstract?.ENG_name ? String(raw._versions[0]._abstract.ENG_name).replace(/\{\{.*?\}\}/g, 'Variant') : undefined;
  const name = raw.name || raw.ENG_name || fallbackAbstractName || '亚种变体';
  const englishName = raw.ENG_name || fallbackAbstractEn || (raw.name !== name ? raw.name : undefined);
  const raceName = raw.raceName || '';
  const source = raw.source || 'PHB';
  const edition = inferEditionFromSource(source);

  const id = makeEntryId({
    packId,
    kind: 'subrace',
    source,
    name: englishName || name,
    parent: raceName,
  });

  // 严禁将规则特性（raw.entries）当作描述文本提取；优先解析专属风味背景
  const description = extractSubraceFluffDescription(raw);

  const entry: CatalogEntry = {
    id,
    kind: 'subrace',
    name,
    englishName,
    source,
    edition,
    page: raw.page,
    sourcePackId: packId,
    description,
    parent: raceName,
    entries: raw.entries,
    raw,
  };

  return mergeOverlay(entry);
}
