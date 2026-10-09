/**
 * Catalog Item & Equipment Adapter
 * 对应《DND5R_5etools_rules_engine_agent_spec.md》规范 §8、§9、§18、§51
 *
 * 职责：
 * 1. 将 CatalogEntry (5etools / Legacy) 统一转为 UI 和规则引擎使用的 AnyItem 接口；
 * 2. 提供 getCatalogItems() 检索装备全集，按 5etools 优先、Legacy 兜底策略去重；
 * 3. 维护稳定全局 ID 与旧版短 ID、英文名、中文名别名映射。
 */

import { CatalogEntry, Edition } from '../types';
import { defaultCatalog } from '../catalog';
import type { AnyItem } from '@/types/equipment';
import { makeEntryId, inferEditionFromSource } from '../identity';
import { flattenEntries } from '@/source/fiveetools-cn/utils';

function numericBonus(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/^\+/, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function matchesVariantCondition(raw: Record<string, any>, condition: Record<string, any>): boolean {
  return Object.entries(condition).every(([key, expected]) => {
    const actual = raw[key];
    return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
  });
}

/** 将 magicvariant 模板与符合 requires/excludes 的基础物品组合为可持有的实际物品。 */
export function instantiateMagicVariants(catalog: import('../types').CatalogService, sourcePackId?: string): CatalogEntry[] {
  const bases = [...catalog.list('baseitem'), ...catalog.list('item')].filter((entry) =>
    entry.sourcePackId !== 'legacy' && !(entry.raw as any)?.magicVariantId
  );
  const variants = catalog.list('magicvariant').filter((entry) => !sourcePackId || entry.sourcePackId === sourcePackId);
  const instances: CatalogEntry[] = [];
  for (const variant of variants) {
    const variantRaw = variant.raw as any;
    const requirements = Array.isArray(variantRaw.requires) ? variantRaw.requires : [];
    const exclusions = Array.isArray(variantRaw.excludes) ? variantRaw.excludes : variantRaw.excludes ? [variantRaw.excludes] : [];
    for (const base of bases) {
      const baseRaw = base.raw as any;
      if (requirements.length && !requirements.some((condition: any) => matchesVariantCondition(baseRaw, condition))) continue;
      if (exclusions.some((condition: any) => matchesVariantCondition(baseRaw, condition))) continue;
      const inherits = variantRaw.inherits || {};
      const name = `${inherits.namePrefix || ''}${base.name}${inherits.nameSuffix || ''}`.trim();
      const englishBase = base.englishName || base.name;
      const englishName = `${inherits.ENG_namePrefix || inherits.namePrefix || ''}${englishBase}${inherits.ENG_nameSuffix || inherits.nameSuffix || ''}`.trim();
      const source = inherits.source || variant.source;

      let properties: string[] = Array.isArray(baseRaw.property)
        ? [...baseRaw.property]
        : Array.isArray(baseRaw.properties)
          ? [...baseRaw.properties]
          : [];
      if (inherits.propertyAdd) {
        const toAdd = Array.isArray(inherits.propertyAdd) ? inherits.propertyAdd : [inherits.propertyAdd];
        for (const p of toAdd) {
          if (p && !properties.includes(p)) properties.push(p);
        }
      }
      if (inherits.propertyRemove) {
        const toRemove = Array.isArray(inherits.propertyRemove) ? inherits.propertyRemove : [inherits.propertyRemove];
        properties = properties.filter((p) => !toRemove.includes(p));
      }

      let resist: string[] = Array.isArray(baseRaw.resist) ? [...baseRaw.resist] : [];
      if (inherits.resist) {
        const toAdd = Array.isArray(inherits.resist) ? inherits.resist : [inherits.resist];
        for (const r of toAdd) {
          if (r && !resist.includes(r)) resist.push(r);
        }
      }

      const raw = {
        ...baseRaw,
        ...inherits,
        name,
        ENG_name: englishName,
        source,
        rarity: inherits.rarity || baseRaw.rarity,
        property: properties,
        properties,
        ...(resist.length ? { resist } : {}),
        baseItemId: base.id,
        magicVariantId: variant.id,
        entries: [...(Array.isArray(baseRaw.entries) ? baseRaw.entries : []), ...(Array.isArray(inherits.entries) ? inherits.entries : [])],
      };
      instances.push({
        id: makeEntryId({ packId: variant.sourcePackId, kind: 'item', source, name: englishName || name, parent: base.id }),
        kind: 'item', name, englishName, source, edition: inferEditionFromSource(source),
        sourcePackId: variant.sourcePackId, isHomebrew: variant.isHomebrew,
        description: [base.description, flattenEntries(inherits.entries)].filter(Boolean).join('\n\n'),
        entries: raw.entries, raw,
      });
    }
  }
  catalog.registerMany(instances);
  return instances;
}

/**
 * 将 CatalogEntry 规范化为 UI 期望的标准 AnyItem 接口
 */
export function catalogEntryToItem(entry: CatalogEntry): AnyItem {
  // 1. 若原始对象已是完整的旧版 Item/Weapon/Armor/Gear/Tool，直接保留原汁原味
  if (entry.sourcePackId === 'legacy' && entry.raw && typeof entry.raw === 'object') {
    return entry.raw as unknown as AnyItem;
  }

  // 2. 5etools-cn 格式适配
  const raw = (entry.raw || {}) as any;

  // 5etools uses short armor type codes and stores AC as either a number or
  // an object. The combat engine consumes the structured form below.
  const armorCategory = ({ LA: 'Light', MA: 'Medium', HA: 'Heavy', S: 'Shield' } as Record<string, string>)[raw.type] || raw.armorCategory;
  const rawAc = typeof raw.ac === 'number' ? raw.ac : raw.ac?.ac;
  const acStructured = armorCategory === 'Shield'
    ? { base: 0, dexModEnabled: false, bonus: typeof rawAc === 'number' ? rawAc : 2 }
    : typeof rawAc === 'number' && armorCategory
      ? {
          base: rawAc,
          dexModEnabled: armorCategory !== 'Heavy',
          ...(armorCategory === 'Medium' ? { dexModMax: 2 } : {}),
        }
      : raw.acStructured;
  const abilitySet = raw.abilitySet || raw.ability?.static || raw.ability;
  const category = raw.category || (armorCategory === 'Shield'
    ? 'shield'
    : armorCategory
      ? 'armor'
      : ['AT', 'GS', 'INS', 'T'].includes(raw.type)
        ? 'tool'
        : ['MNT', 'VEH', 'SHP'].includes(raw.type)
          ? 'vehicle'
      : raw.weaponCategory || raw.dmg1
        ? 'weapon'
        : 'gear');

  let costStr = '';
  if (typeof raw.value === 'number') {
    costStr = `${raw.value / 100} GP`;
  } else if (raw.cost) {
    costStr = String(raw.cost);
  }

  let weightStr = '';
  if (typeof raw.weight === 'number') {
    weightStr = `${raw.weight} 磅`;
  } else if (raw.weight) {
    weightStr = String(raw.weight);
  }

  return {
    ...raw,
    id: entry.id,
    source: entry.source,
    name: entry.name,
    nameEn: entry.englishName || entry.name,
    description: entry.description || '',
    cost: costStr || raw.cost,
    weight: weightStr || raw.weight,
    category,
    weaponCategory: raw.weaponCategory,
    armorCategory,
    acStructured,
    strengthRequirement: raw.strengthRequirement ?? raw.strength,
    stealthDisadvantage: raw.stealthDisadvantage ?? raw.stealth ?? false,
    bonusAc: numericBonus(raw.bonusAc),
    bonusWeapon: numericBonus(raw.bonusWeapon),
    bonusSavingThrow: numericBonus(raw.bonusSavingThrow),
    bonusSpellSaveDc: numericBonus(raw.bonusSpellSaveDc),
    bonusSpellAttack: numericBonus(raw.bonusSpellAttack),
    abilitySet: abilitySet && typeof abilitySet === 'object' && !Array.isArray(abilitySet) ? abilitySet : undefined,
    requiresAttunement: Boolean(raw.requiresAttunement ?? raw.reqAttune),
    attunementRequirement: typeof (raw.requiresAttunement ?? raw.reqAttune) === 'string' ? (raw.requiresAttunement ?? raw.reqAttune) : undefined,
    baseItemId: raw.baseItemId,
    magicVariantId: raw.magicVariantId,
    damage: raw.damage || raw.dmg1,
    damageType: raw.damageType || raw.dmgType,
    ac: raw.ac,
    properties: raw.properties || raw.property,
  } as unknown as AnyItem;
}

/** 判断标准化条目是否属于魔法物品；不依赖本地备注文本。 */
export function isMagicItemDefinition(item: AnyItem | undefined): boolean {
  if (!item) return false;
  const value = item as any;
  return Boolean(
    value.magicVariantId || value.rarity || value.requiresAttunement ||
    value.bonusAc || value.bonusWeapon || value.bonusSavingThrow ||
    value.bonusSpellSaveDc || value.bonusSpellAttack || value.abilitySet
  );
}

/**
 * 获取 Catalog 中注册的所有装备与物品
 * 合并策略：按英文原名/规范化标识去重，5etools 来源优先，Legacy 作为兜底
 */
export function getCatalogItems(options?: {
  edition?: Edition;
  source?: string;
  kind?: string;
}): AnyItem[] {
  const entries = [
    ...defaultCatalog.list('item', options),
    ...defaultCatalog.list('baseitem', options),
    ...defaultCatalog.list('magicvariant', options),
  ];

  const items: AnyItem[] = [];
  const seenKeys = new Set<string>();

  // 1. 优先放入 5etools / homebrew 条目
  for (const entry of entries) {
    if (entry.sourcePackId !== 'legacy') {
      const item = catalogEntryToItem(entry);
      const key = `${entry.source}:${(item.nameEn || item.name).toLowerCase().replace(/[-_\s]+/g, '')}`;
      seenKeys.add(key);
      items.push(item);
    }
  }

  // 2. 补充放入 Legacy 条目
  for (const entry of entries) {
    if (entry.sourcePackId === 'legacy') {
      const item = catalogEntryToItem(entry);
      const key = `${entry.source}:${(item.nameEn || item.name).toLowerCase().replace(/[-_\s]+/g, '')}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        items.push(item);
      }
    }
  }


  return items;
}

/**
 * 将旧版静态装备与物品列表预先注册至 defaultCatalog
 */
