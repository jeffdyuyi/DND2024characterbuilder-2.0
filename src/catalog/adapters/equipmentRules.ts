/**
 * Catalog Equipment Rules Adapter
 * 统一将 5etools items-base.json 中的 itemProperty 与 itemMastery 动态转为 UI 消费的字典结构。
 */

import { defaultCatalog } from '../catalog';
import { WeaponMastery } from '@/rules/equipment';

export function getCatalogMasteryData(
  fallback: Record<WeaponMastery['nameEn'], WeaponMastery>
): Record<WeaponMastery['nameEn'], WeaponMastery> {
  const rules = defaultCatalog.list('rule');
  const masteryEntries = rules.filter(r => r.id.includes(':mastery:') || (r.raw as any)?.srd52 || (r.raw as any)?.basicRules2024 && (r.englishName && ['Slow', 'Nick', 'Vex', 'Push', 'Sap', 'Cleave', 'Graze', 'Topple'].includes(r.englishName as any)));

  if (!masteryEntries || masteryEntries.length === 0) {
    return fallback;
  }

  const result = { ...fallback };
  for (const entry of masteryEntries) {
    const raw = (entry.raw || {}) as any;
    const nameEn = (entry.englishName || raw.ENG_name) as WeaponMastery['nameEn'];
    if (nameEn && ['Slow', 'Nick', 'Vex', 'Push', 'Sap', 'Cleave', 'Graze', 'Topple'].includes(nameEn)) {
      result[nameEn] = {
        name: entry.name,
        nameEn,
        description: entry.description || '',
      };
    }
  }

  return result;
}

export function getCatalogPropertyData(
  fallback: Record<string, { name: string; description: string }>
): Record<string, { name: string; description: string }> {
  const rules = defaultCatalog.list('rule');
  const propertyEntries = rules.filter(r => r.id.includes(':property:'));

  if (!propertyEntries || propertyEntries.length === 0) {
    return fallback;
  }

  const result = { ...fallback };
  for (const entry of propertyEntries) {
    const raw = (entry.raw || {}) as any;
    const abbr = raw.abbreviation || entry.id.split(':property:')[1];
    if (abbr) {
      result[abbr] = {
        name: `${entry.name} ${entry.englishName || ''}`.trim(),
        description: entry.description || '',
      };
    }
  }

  return result;
}
