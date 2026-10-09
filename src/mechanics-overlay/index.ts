/**
 * Mechanics Overlay (机制覆盖层) 统一入口
 * 对应《5etools全量数据接入与引擎保留实施路线图》Phase B
 *
 * 职责：
 * 在 5etools 数据加载与归一化时，自动为条目注入计算机可读的机制描述
 * （如施法类型、无甲防御公式、属性上限突破等），保证规则引擎 100% 精确运算。
 */

import { CatalogEntry } from '@/catalog/types';
import { ClassMechanicsOverlay, SubclassMechanicsOverlay, RaceMechanicsOverlay } from './types';
import { CLASS_OVERLAYS, SUBCLASS_OVERLAYS } from './classes';
import { RACE_OVERLAYS } from './races';

export * from './types';
export * from './classes';
export * from './races';
export * from './features';
export * from './warlockInvocations';

function normalizeKey(str?: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[-_\s]+/g, '')
    .trim();
}

/** 检索职业机制覆盖 */
export function getClassOverlay(nameOrEn?: string): ClassMechanicsOverlay | undefined {
  if (!nameOrEn) return undefined;
  if (CLASS_OVERLAYS[nameOrEn]) return CLASS_OVERLAYS[nameOrEn];
  const low = nameOrEn.toLowerCase().trim();
  if (CLASS_OVERLAYS[low]) return CLASS_OVERLAYS[low];

  const norm = normalizeKey(nameOrEn);
  for (const [k, v] of Object.entries(CLASS_OVERLAYS)) {
    if (normalizeKey(k) === norm) return v;
  }
  return undefined;
}

/** 检索子职业机制覆盖 */
export function getSubclassOverlay(nameOrEn?: string): SubclassMechanicsOverlay | undefined {
  if (!nameOrEn) return undefined;
  if (SUBCLASS_OVERLAYS[nameOrEn]) return SUBCLASS_OVERLAYS[nameOrEn];
  const low = nameOrEn.toLowerCase().trim();
  if (SUBCLASS_OVERLAYS[low]) return SUBCLASS_OVERLAYS[low];

  const norm = normalizeKey(nameOrEn);
  for (const [k, v] of Object.entries(SUBCLASS_OVERLAYS)) {
    if (normalizeKey(k) === norm) return v;
  }
  return undefined;
}

/** 检索种族机制覆盖 */
export function getRaceOverlay(nameOrEn?: string): RaceMechanicsOverlay | undefined {
  if (!nameOrEn) return undefined;
  if (RACE_OVERLAYS[nameOrEn]) return RACE_OVERLAYS[nameOrEn];
  const low = nameOrEn.toLowerCase().trim();
  if (RACE_OVERLAYS[low]) return RACE_OVERLAYS[low];

  const norm = normalizeKey(nameOrEn);
  for (const [k, v] of Object.entries(RACE_OVERLAYS)) {
    if (normalizeKey(k) === norm) return v;
  }
  return undefined;
}

/**
 * 将机制覆盖层数据深度融合进 CatalogEntry
 */
export function mergeOverlay(entry: CatalogEntry): CatalogEntry {
  if (!entry || !entry.kind) return entry;

  // 浅拷贝 entry 及其 raw，避免副作用
  const raw = { ...(entry.raw || {}) };
  let modified = false;

  // 1. 职业 (Class)
  if (entry.kind === 'class') {
    const overlay = getClassOverlay(entry.englishName) || getClassOverlay(entry.name);
    if (overlay) {
      modified = true;
      if (overlay.spellcastingType) raw.spellcastingType = overlay.spellcastingType;
      if (overlay.spellcastingAbility) raw.spellcastingAbility = overlay.spellcastingAbility;

      if (overlay.features && overlay.features.length > 0) {
        const existingFeatures: any[] = Array.isArray(raw.features)
          ? [...raw.features]
          : Array.isArray(raw.classFeature)
            ? [...raw.classFeature]
            : [];

        for (const featOverlay of overlay.features) {
          const matchIdx = existingFeatures.findIndex(
            (f) =>
              normalizeKey(f.name) === normalizeKey(featOverlay.name) ||
              normalizeKey(f.nameEn) === normalizeKey(featOverlay.nameEn),
          );
          if (matchIdx >= 0) {
            existingFeatures[matchIdx] = {
              ...existingFeatures[matchIdx],
              mechanics: {
                ...(existingFeatures[matchIdx].mechanics || {}),
                ...featOverlay.mechanics,
              },
            };
          } else {
            existingFeatures.push({
              name: featOverlay.name,
              nameEn: featOverlay.nameEn,
              level: featOverlay.level || 1,
              description: '',
              mechanics: featOverlay.mechanics,
            });
          }
        }
        raw.features = existingFeatures;
        raw.classFeature = existingFeatures;
      }
    }
  }

  // 2. 子职业 (Subclass)
  if (entry.kind === 'subclass') {
    const overlay = getSubclassOverlay(entry.englishName) || getSubclassOverlay(entry.name);
    if (overlay) {
      modified = true;
      if (overlay.spellcastingType) raw.spellcastingType = overlay.spellcastingType;
      if (overlay.spellcastingAbility) raw.spellcastingAbility = overlay.spellcastingAbility;

      const existingTraits: any[] = Array.isArray(raw.traits) ? [...raw.traits] : [];
      if (overlay.traits) {
        for (const traitOverlay of overlay.traits) {
          const matchIdx = existingTraits.findIndex(
            (t) =>
              normalizeKey(t.name) === normalizeKey(traitOverlay.name) ||
              normalizeKey(t.nameEn) === normalizeKey(traitOverlay.nameEn),
          );
          if (matchIdx >= 0) {
            existingTraits[matchIdx] = {
              ...existingTraits[matchIdx],
              mechanics: {
                ...(existingTraits[matchIdx].mechanics || {}),
                ...traitOverlay.mechanics,
              },
            };
          } else {
            existingTraits.push({
              name: traitOverlay.name,
              nameEn: traitOverlay.nameEn,
              level: traitOverlay.level || 1,
              description: '',
              mechanics: traitOverlay.mechanics,
            });
          }
        }
      }
      raw.traits = existingTraits;
    }
  }

  // 3. 种族与亚种 (Race / Subrace)
  if (entry.kind === 'race' || entry.kind === 'subrace') {
    const overlay = getRaceOverlay(entry.englishName) || getRaceOverlay(entry.name);
    if (overlay) {
      modified = true;
      const existingTraits: any[] = Array.isArray(raw.traits) ? [...raw.traits] : [];

      if (overlay.traits) {
        for (const traitOverlay of overlay.traits) {
          const matchIdx = existingTraits.findIndex(
            (t) =>
              normalizeKey(t.name) === normalizeKey(traitOverlay.name) ||
              normalizeKey(t.nameEn) === normalizeKey(traitOverlay.nameEn),
          );
          if (matchIdx >= 0) {
            existingTraits[matchIdx] = {
              ...existingTraits[matchIdx],
              mechanics: {
                ...(existingTraits[matchIdx].mechanics || {}),
                ...traitOverlay.mechanics,
              },
            };
          } else {
            existingTraits.push({
              id: normalizeKey(traitOverlay.nameEn || traitOverlay.name),
              name: traitOverlay.name,
              nameEn: traitOverlay.nameEn,
              description: '',
              mechanics: traitOverlay.mechanics,
            });
          }
        }
      }
      raw.traits = existingTraits;
    }
  }

  if (!modified) return entry;

  return {
    ...entry,
    raw,
  };
}
