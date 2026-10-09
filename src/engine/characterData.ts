import { CharacterState, MulticlassEntry } from '../types/characterState';
import {
  defaultCatalog,
  catalogEntryToSpell,
  catalogEntryToClass,
  catalogEntryToFeat,
  catalogEntryToBackground,
  catalogEntryToSpecies,
  catalogEntryToSubspecies,
  catalogEntryToItem,
} from '../catalog';
import type { AnyItem, Armor } from '../types/equipment';
import { Background, ClassData, Feat, Species, Spell, SubSpecies, SubClass } from '../types';

export type { AnyItem } from '../types/equipment';

const normalizeReference = (value: string) => value.toLowerCase().replace(/[-_\s]+/g, '');
const normalizeSource = (value?: string) => {
  const source = (value || '').toUpperCase();
  return (
    ({ PHB2024: 'XPHB', DMG2024: 'XDMG', MM2024: 'XMM' } as Record<string, string>)[source] ||
    source
  );
};

function findCatalogEntry(kinds: string[], reference: string, source?: string) {
  const direct = defaultCatalog.get(reference);
  if (direct && kinds.includes(direct.kind)) return direct;
  const target = normalizeReference(reference);
  const matches = kinds
    .flatMap((kind) => defaultCatalog.list(kind as any))
    .filter((entry) => {
      if (source && normalizeSource(entry.source) !== normalizeSource(source)) return false;
      return [entry.id, entry.name, entry.englishName || ''].some(
        (value) => normalizeReference(value) === target,
      );
    });
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    return matches.find((m) => m.edition === '2024' || m.source === 'XPHB') || matches[0];
  }
  return undefined;
}

export function getPrimaryClassEntry(character: CharacterState): MulticlassEntry | undefined {
  return character.classes?.[0];
}

export function getClassDefinition(classId?: string): ClassData | undefined {
  if (!classId) return undefined;

  // 1. 优先通过 Catalog 稳定 ID / 别名检索
  const catEntry = findCatalogEntry(['class'], classId);
  if (catEntry && catEntry.kind === 'class') {
    return catalogEntryToClass(catEntry);
  }

  return undefined;
}

export function getPrimaryClassDefinition(character: CharacterState): ClassData | undefined {
  return getClassDefinition(getPrimaryClassEntry(character)?.classId);
}

export function getClassProgression(definition: ClassData | undefined, level: number) {
  if (!definition) return undefined;
  return definition.progression.find((entry) => entry.level === level);
}

export function getBackgroundDefinition(character: CharacterState): Background | undefined {
  if (!character.backgroundId) return undefined;

  // 1. 优先通过 Catalog 稳定 ID / 别名检索
  const catEntry = findCatalogEntry(
    ['background'],
    character.backgroundId,
    character.backgroundSource,
  );
  if (catEntry && catEntry.kind === 'background') {
    return catalogEntryToBackground(catEntry);
  }

  return undefined;
}

export function getSpeciesDefinition(character: CharacterState): Species | undefined {
  if (!character.speciesId) return undefined;

  // 1. 优先通过 Catalog 稳定 ID / 别名检索
  const catEntry = findCatalogEntry(['race'], character.speciesId, character.speciesSource);
  if (catEntry && catEntry.kind === 'race') {
    return catalogEntryToSpecies(catEntry);
  }

  return undefined;
}

export function getSubspeciesDefinition(character: CharacterState): SubSpecies | undefined {
  if (!character.subspeciesId) return undefined;

  // 1. 优先通过 Catalog 稳定 ID / 别名检索
  const catEntry = defaultCatalog.get(character.subspeciesId);
  if (catEntry && catEntry.kind === 'subrace') {
    const parent = character.speciesId
      ? findCatalogEntry(['race'], character.speciesId, character.speciesSource)
      : undefined;
    return catalogEntryToSubspecies(catEntry, parent?.raw);
  }

  // 2. 尝试从所属 Species 的 subSpecies 选项中查找
  const species = getSpeciesDefinition(character);
  if (species?.subSpecies?.options) {
    const normalized = character.subspeciesId.toLowerCase().replace(/[-_\s]+/g, '');
    const found = species.subSpecies.options.find((item) => {
      return (
        item.id === character.subspeciesId ||
        item.id.toLowerCase().replace(/[-_\s]+/g, '') === normalized ||
        item.nameEn.toLowerCase().replace(/[-_\s]+/g, '') === normalized ||
        item.name.toLowerCase().replace(/[-_\s]+/g, '') === normalized
      );
    });
    if (found) return found;
  }

  return undefined;
}

export function getSubclassDefinition(character: CharacterState): SubClass | undefined {
  const primaryClass = getPrimaryClassEntry(character);
  const definition = getPrimaryClassDefinition(character);
  if (!primaryClass?.subclassId) return undefined;

  // 1. 优先从已组装职业树按稳定 ID 检索，确保返回完整 traits。
  const catEntry = defaultCatalog.get(primaryClass.subclassId);
  if (catEntry && catEntry.kind === 'subclass' && definition?.subClassInfo) {
    const assembled = definition.subClassInfo.options.find(
      (item) => item.catalogId === catEntry.id,
    );
    if (assembled) return assembled;
  }
  if (catEntry && catEntry.kind === 'subclass' && Array.isArray((catEntry.raw as any)?.traits)) {
    const raw = catEntry.raw as any;
    return {
      catalogId: catEntry.id,
      name: catEntry.name,
      nameEn: catEntry.englishName || catEntry.name,
      description: catEntry.description || raw.description || '',
      source: catEntry.source,
      traits: raw.traits,
    };
  }

  // 2. 兼容旧名称存档，从所属职业定义检索。
  if (!definition?.subClassInfo) return undefined;
  const target = primaryClass.subclassId.toLowerCase().replace(/[-_\s]+/g, '');
  return definition.subClassInfo.options.find((item) => {
    const en = (item.nameEn || '').toLowerCase().replace(/[-_\s]+/g, '');
    const zh = (item.name || '').toLowerCase().replace(/[-_\s]+/g, '');
    return (
      item.catalogId === primaryClass.subclassId ||
      en === target ||
      zh === target ||
      en.includes(target) ||
      target.includes(en) ||
      zh.includes(target) ||
      target.includes(zh)
    );
  });
}

export function getFeatDefinition(featId?: string): Feat | undefined {
  if (!featId) return undefined;

  // 1. 优先通过 Catalog 稳定 ID / 别名检索
  const catEntry = findCatalogEntry(['feat'], featId);
  if (catEntry && catEntry.kind === 'feat') {
    return catalogEntryToFeat(catEntry);
  }

  return undefined;
}

export function getSpellDefinition(spellId?: string): Spell | undefined {
  if (!spellId) return undefined;

  // 1. 优先从统一 Catalog 服务检索（支持稳定全局 ID 及已注册的历史别名）
  const catEntry = findCatalogEntry(['spell'], spellId);
  if (catEntry && catEntry.kind === 'spell') {
    return catalogEntryToSpell(catEntry);
  }

  return undefined;
}

export function findItemById(itemId?: string): AnyItem | undefined {
  if (!itemId) return undefined;

  let cleanId = itemId;
  let source: string | undefined = undefined;
  if (itemId.includes('|')) {
    const parts = itemId.split('|');
    cleanId = parts[0];
    source = parts[1];
  }

  // 1. 优先通过 Catalog 稳定 ID / 别名检索 (若带 source 则优先匹配指定版本)
  const catEntry =
    (source
      ? findCatalogEntry(['item', 'baseitem', 'magicvariant'], cleanId, source)
      : undefined) ||
    findCatalogEntry(['item', 'baseitem', 'magicvariant'], cleanId) ||
    findCatalogEntry(['item', 'baseitem', 'magicvariant'], itemId);
  if (
    catEntry &&
    (catEntry.kind === 'item' || catEntry.kind === 'baseitem' || catEntry.kind === 'magicvariant')
  ) {
    return catalogEntryToItem(catEntry);
  }

  return undefined;
}

export function findItemByName(name?: string): AnyItem | undefined {
  if (!name) return undefined;

  let cleanName = name;
  let source: string | undefined = undefined;
  const bracketMatch = name.match(/^(.*?)\s*\[(.*?)\]$/);
  if (bracketMatch) {
    cleanName = bracketMatch[1].trim();
  } else if (name.includes('|')) {
    const parts = name.split('|');
    cleanName = parts[0].trim();
    source = parts[1].trim();
  }

  // 1. 优先通过 Catalog 检索
  const catEntry =
    (source
      ? findCatalogEntry(['item', 'baseitem', 'magicvariant'], cleanName, source)
      : undefined) ||
    findCatalogEntry(['item', 'baseitem', 'magicvariant'], cleanName) ||
    findCatalogEntry(['item', 'baseitem', 'magicvariant'], name);
  if (
    catEntry &&
    (catEntry.kind === 'item' || catEntry.kind === 'baseitem' || catEntry.kind === 'magicvariant')
  ) {
    return catalogEntryToItem(catEntry);
  }

  return undefined;
}

/** 将角色清单实例 ID 解析为其 Catalog 物品定义。 */
export function resolveInventoryItem(
  character: CharacterState,
  instanceOrItemId?: string,
): AnyItem | undefined {
  if (!instanceOrItemId) return undefined;
  const inventory = character.inventoryEntries?.find(
    (entry) => entry.id === instanceOrItemId || entry.itemId === instanceOrItemId,
  );
  return findItemById(inventory?.itemId || instanceOrItemId);
}

/** 返回当前已装备或已同调、能够影响派生数值的物品定义。 */
export function getActiveItemDefinitions(character: CharacterState): AnyItem[] {
  const attunedIds = new Set(character.attunedItemIds || []);
  const equippedEntryIds = new Set<string>([
    ...(character.equippedWeaponIds || []),
    ...(character.equippedArmorId ? [character.equippedArmorId] : []),
    ...(character.equippedShieldId ? [character.equippedShieldId] : []),
  ]);

  const items = new Map<string, AnyItem>();
  for (const entry of character.inventoryEntries || []) {
    const itemId = entry.itemId || entry.id;
    const item = findItemById(itemId);
    if (!item) continue;
    const isAttuned = attunedIds.has(entry.id) || attunedIds.has(itemId);
    const isEquipped =
      Boolean(entry.equipped) || equippedEntryIds.has(entry.id) || equippedEntryIds.has(itemId);
    const isActive = (item as any).requiresAttunement ? isAttuned && isEquipped : isEquipped;
    if (isActive) items.set(itemId, item);
  }
  // 兼容旧角色：旧存档可能直接保存物品库 ID，没有对应 InventoryEntry。
  for (const id of new Set([...attunedIds, ...equippedEntryIds])) {
    const entry = character.inventoryEntries?.find((candidate) => candidate.id === id);
    const itemId = entry?.itemId || id;
    if (items.has(itemId)) continue;
    const item = findItemById(itemId);
    if (!item) continue;
    const isAttuned = attunedIds.has(id) || attunedIds.has(itemId);
    const isEquipped = equippedEntryIds.has(id) || equippedEntryIds.has(itemId);
    if ((item as any).requiresAttunement ? isAttuned && isEquipped : isEquipped)
      items.set(itemId, item);
  }

  return Array.from(items.values());
}

export interface AttunementStatus {
  limit: number;
  count: number;
  overLimit: boolean;
}

/** 计算角色的同调槽位以及实际占用；只有要求同调的魔法物品占用槽位。 */
export function getAttunementStatus(character: CharacterState): AttunementStatus {
  let fixedLimit = 3;
  let bonus = 0;
  const applyMechanics = (mechanics: any) => {
    if (!mechanics) return;
    if (typeof mechanics.attunementLimit === 'number')
      fixedLimit = Math.max(fixedLimit, mechanics.attunementLimit);
    if (typeof mechanics.attunementLimitBonus === 'number') bonus += mechanics.attunementLimitBonus;
  };

  character.classes?.forEach((classEntry) => {
    const classDef = getClassDefinition(classEntry.classId);
    const subclass = classDef?.subClassInfo?.options.find(
      (option) =>
        option.catalogId === classEntry.subclassId ||
        option.nameEn === classEntry.subclassId ||
        option.name === classEntry.subclassId,
    );
    classDef?.features
      .filter((feature) => feature.level <= classEntry.level)
      .forEach((feature) => applyMechanics(feature.mechanics));
    subclass?.traits
      .filter((trait) => trait.level <= classEntry.level)
      .forEach((trait) => applyMechanics(trait.mechanics));
  });
  character.selectedFeats?.forEach((feat) =>
    applyMechanics(getFeatDefinition(feat.featId)?.mechanics),
  );
  character.selectedCharacterOptionIds?.forEach((id) =>
    applyMechanics((defaultCatalog.get(id)?.raw as any)?.mechanics),
  );
  getSpeciesDefinition(character)?.traits.forEach((trait) => applyMechanics(trait.mechanics));
  getSubspeciesDefinition(character)?.traits.forEach((trait) => applyMechanics(trait.mechanics));

  const counted = new Set<string>();
  for (const attunedId of character.attunedItemIds || []) {
    const inventoryEntry = character.inventoryEntries?.find(
      (entry) => entry.id === attunedId || entry.itemId === attunedId,
    );
    const itemId = inventoryEntry?.itemId || attunedId;
    const item = findItemById(itemId) as any;
    if (item?.requiresAttunement) counted.add(inventoryEntry?.id || itemId);
  }

  const limit = fixedLimit + bonus;
  return { limit, count: counted.size, overLimit: counted.size > limit };
}

export function resolveDisplayName(item?: { name?: string; nameEn?: string }) {
  if (!item) return '';
  return item.nameEn ? `${item.name} (${item.nameEn})` : (item.name ?? '');
}

/**
 * 获取角色所有的护甲熟练 (受训)
 */
export function getArmorProficiencies(character: CharacterState): string[] {
  const profs = new Set<string>();

  // 1. 职业提供的熟练
  character.classes.forEach((c, idx) => {
    const def = getClassDefinition(c.classId);
    if (!def) return;
    if (idx === 0) {
      // 初始职业
      def.proficiencies.armor?.forEach((p) => profs.add(p));
    } else {
      // 兼职
      def.multiclassProficiencies?.armor?.forEach((p) => profs.add(p));
    }
  });

  // 2. 专长提供的熟练
  character.selectedFeats?.forEach((f) => {
    const def = getFeatDefinition(f.featId);
    if (def?.mechanics?.armorProficiencies) {
      def.mechanics.armorProficiencies.forEach((p: string) => profs.add(p));
    }
  });

  return Array.from(profs);
}

/**
 * 检查角色是否对特定护甲具有熟练
 */
export function isProficientWithArmor(character: CharacterState, armor: Armor): boolean {
  const profs = getArmorProficiencies(character).map((p) => p.toLowerCase());
  const category = armor.armorCategory.toLowerCase(); // 'light', 'medium', 'heavy', 'shield'

  // 映射定义
  const map: Record<string, string[]> = {
    light: ['light', 'light armor', 'lightarmor'],
    medium: ['medium', 'medium armor', 'mediumarmor'],
    heavy: ['heavy', 'heavy armor', 'heavyarmor'],
    shield: ['shield'],
  };

  const keys = map[category] || [category];
  return profs.some((p) => keys.includes(p));
}
