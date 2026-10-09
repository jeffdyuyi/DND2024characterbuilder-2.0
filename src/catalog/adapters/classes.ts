/**
 * Catalog Class & Subclass Adapter
 * 对应《DND5R_5etools_rules_engine_agent_spec.md》规范 §8、§9、§18、§51
 *
 * 职责：
 * 1. 将 CatalogEntry (5etools / Legacy) 统一转为 UI 和角色引擎使用的 ClassData 接口；
 * 2. 提供 getCatalogClasses() 检索职业全集，按 5etools 优先、Legacy 兜底策略去重；
 * 3. 提供 getCatalogSubclasses() 按父职业检索子职业列表；
 * 4. 维护稳定全局 ID 与原有类名、英名、中文名别名映射。
 */

import { CatalogEntry, Edition } from '../types';
import { defaultCatalog } from '../catalog';
import { ClassData } from '@/types/class';
import { mergeOverlay } from '@/mechanics-overlay';
import { assembleCatalogClass } from './classAssembly';
import { belongsToClass, classKeyPart, classNames } from './classReferences';
import { inferEditionFromSource } from '../identity';

const ABILITY_KEYS = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha']);

function normalizePrimaryAbilities(value: unknown): string[] {
  const abilities: string[] = [];
  const visit = (candidate: unknown) => {
    if (typeof candidate === 'string') {
      const normalized = candidate.trim().toLowerCase();
      if (normalized) abilities.push(normalized);
      return;
    }
    if (Array.isArray(candidate)) {
      candidate.forEach(visit);
      return;
    }
    if (!candidate || typeof candidate !== 'object') return;
    Object.entries(candidate as Record<string, unknown>).forEach(([key, enabled]) => {
      if (ABILITY_KEYS.has(key.toLowerCase()) && enabled) abilities.push(key.toLowerCase());
      else if (!ABILITY_KEYS.has(key.toLowerCase())) visit(enabled);
    });
  };
  visit(value);
  return Array.from(new Set(abilities));
}

function renderFiveEToolsTag(tag: string, body: string): string {
  const parts = body.split('|');
  if (tag === 'dice') return parts[2] || parts[1] || parts[0];
  return parts[2] || parts[0];
}

function equipmentText(value: unknown): string {
  if (typeof value === 'string') {
    const tagged = value
      .replace(/\{@(item|filter|dice|i)\s+([^}]+)\}/gi, (_, tag: string, body: string) =>
        tag.toLowerCase() === 'i' ? body : renderFiveEToolsTag(tag.toLowerCase(), body),
      )
      .trim();
    const reference = tagged.match(/^([^|]+)\|[^|]+(?:\|([^|]+))?$/);
    return reference ? (reference[2] || reference[1]).trim() : tagged;
  }
  if (!value || typeof value !== 'object') return '';
  const record = value as Record<string, unknown>;
  if (typeof record.item === 'string') {
    const name = equipmentText(record.item.split('|')[0]);
    const quantity = Number(record.quantity || 1);
    return quantity > 1 ? `${quantity} ${name}` : name;
  }
  if (typeof record.value === 'number') {
    const copper = record.value;
    return copper % 100 === 0 ? `${copper / 100} GP` : `${copper} CP`;
  }
  if (typeof record.equipmentType === 'string') return `自选${record.equipmentType}`;
  if (typeof record.special === 'string') return equipmentText(record.special);
  return '';
}

function equipmentOption(value: unknown): string {
  const values = Array.isArray(value) ? value : [value];
  return values.map(equipmentText).filter(Boolean).join('，');
}

function normalizeStartingEquipment(value: unknown): ClassData['startingEquipment'] {
  const raw = value && typeof value === 'object' ? (value as Record<string, any>) : {};
  if (Array.isArray(raw.choiceA) && typeof raw.choiceB === 'string')
    return raw as ClassData['startingEquipment'];

  const rows = Array.isArray(raw.defaultData) ? raw.defaultData : [];
  const first =
    rows[0] && typeof rows[0] === 'object' ? (rows[0] as Record<string, unknown>) : undefined;
  const upperCasePackages = first && ['A', 'B', 'C'].some((key) => key in first);

  if (upperCasePackages && first) {
    const packages = ['A', 'B'].map((key) => equipmentOption(first[key])).filter(Boolean);
    const alternative = equipmentOption(first.C) || equipmentText(raw.goldAlternative);
    return {
      choiceA: packages.length > 1 ? [{ options: packages }] : packages,
      choiceB: alternative,
    };
  }

  const choiceA: ClassData['startingEquipment']['choiceA'] = [];
  rows.forEach((row: unknown) => {
    if (!row || typeof row !== 'object') return;
    const options = Object.entries(row as Record<string, unknown>)
      .filter(([key]) => key !== '_')
      .map(([, option]) => equipmentOption(option))
      .filter(Boolean);
    const fixed = equipmentOption((row as Record<string, unknown>)._);
    if (fixed) choiceA.push(fixed);
    if (options.length === 1) choiceA.push(options[0]);
    else if (options.length > 1) choiceA.push({ options });
  });

  if (choiceA.length === 0 && Array.isArray(raw.default)) {
    choiceA.push(...raw.default.map(equipmentText).filter(Boolean));
  }

  return {
    choiceA,
    choiceB: equipmentText(raw.goldAlternative),
  };
}

function normalizeProficiencyList(items: unknown): string[] {
  if (!Array.isArray(items)) return [];
  const result: string[] = [];
  for (const item of items) {
    if (!item) continue;
    if (typeof item === 'string') {
      const trimmed = item.trim();
      if (trimmed) result.push(trimmed);
    } else if (typeof item === 'object') {
      const obj = item as Record<string, any>;
      const prof =
        typeof obj.proficiency === 'string'
          ? obj.proficiency.trim()
          : typeof obj.name === 'string'
            ? obj.name.trim()
            : '';
      if (prof) {
        result.push(obj.optional ? `${prof}（可选）` : prof);
      }
    }
  }
  return result;
}

function normalizeProficiencyChoice(value: unknown, fallbackCount = 0) {
  const entries = Array.isArray(value) ? value : [];
  const choice = entries.find(
    (entry) => entry && typeof entry === 'object' && (entry as any).choose,
  )?.choose;
  return {
    numToChoose: Number(choice?.count || fallbackCount),
    options: Array.isArray(choice?.from)
      ? choice.from.filter((item: unknown): item is string => typeof item === 'string')
      : [],
  };
}

/**
 * 将 CatalogEntry 规范化为 UI 期望的标准 ClassData 接口
 */
export function catalogEntryToClass(entry: CatalogEntry): ClassData {
  // 1. 若原始对象已是完整的旧版 ClassData，直接保留原汁原味
  if (entry.sourcePackId === 'legacy' && entry.raw && (entry.raw as any).hitPointDie) {
    return entry.raw as unknown as ClassData;
  }

  // 2. 5etools-cn 格式适配并应用机制覆盖层
  const mergedEntry = mergeOverlay(entry);
  const raw = (mergedEntry.raw || {}) as any;
  const hdFaces = raw.hd?.faces || raw.hitPointDie || 8;
  const savingThrows = Array.isArray(raw.proficiency) ? raw.proficiency : [];
  const startProf = raw.startingProficiencies || {};
  const primaryAbility = normalizePrimaryAbilities(raw.primaryAbility);
  const multiclassProf = raw.multiclassing?.proficienciesGained || {};
  const assembled = assembleCatalogClass(mergedEntry, defaultCatalog);

  // 收集并装配该职业的子职业选项
  const subOptions: any[] = [...(raw.subClassInfo?.options || assembled.subclasses || [])];
  if (subOptions.length === 0) {
    const parentName = (mergedEntry.englishName || mergedEntry.name).toLowerCase().trim();
    const catalogSubs = defaultCatalog.list('subclass');
    for (const subEntry of catalogSubs) {
      const mergedSub = mergeOverlay(subEntry);
      const subRaw = mergedSub.raw || {};
      const subParent = (subRaw.className || (mergedSub as any).parent || '').toLowerCase().trim();
      if (
        subParent === parentName ||
        subParent.includes(parentName) ||
        parentName.includes(subParent)
      ) {
        subOptions.push({
          name: mergedSub.name,
          nameEn: mergedSub.englishName || mergedSub.name,
          description: mergedSub.description || '',
          traits: subRaw.traits || [],
          mechanics: subRaw.mechanics,
        });
      }
    }
  }

  return {
    catalogId: mergedEntry.id,
    source: mergedEntry.source,
    name: mergedEntry.name,
    nameEn: mergedEntry.englishName || mergedEntry.name,
    description: mergedEntry.description || '',
    primaryAbility: primaryAbility.length > 0 ? primaryAbility : ['str'],
    hitPointDie: hdFaces,
    proficiencies: {
      savingThrows,
      skills: normalizeProficiencyChoice(startProf.skills, 2),
      weapons: normalizeProficiencyList(startProf.weapons),
      armor: normalizeProficiencyList(startProf.armor),
      tools: Array.isArray(startProf.tools)
        ? normalizeProficiencyList(startProf.tools)
        : startProf.tools || [],
    },
    startingEquipment: normalizeStartingEquipment(raw.startingEquipment),
    becomingAClass: raw.becomingAClass,
    progression: raw.progression || assembled.progression,
    features: raw.features || raw.classFeature || assembled.features,
    subClassInfo: {
      unlockLevel: raw.subClassInfo?.unlockLevel || assembled.subclassUnlockLevel || 3,
      options: subOptions,
    },
    spellcastingType: raw.spellcastingType,
    spellcastingAbility: raw.spellcastingAbility,
    casterProgression: raw.casterProgression,
    preparedSpellsFormula: raw.preparedSpells,
    spellList: Array.isArray(raw.classSpells) ? raw.classSpells : [],
    multiclassProficiencies: {
      skills: normalizeProficiencyChoice(multiclassProf.skills),
      weapons: normalizeProficiencyList(multiclassProf.weapons),
      armor: normalizeProficiencyList(multiclassProf.armor),
      tools: Array.isArray(multiclassProf.tools)
        ? normalizeProficiencyList(multiclassProf.tools)
        : multiclassProf.tools || [],
    },
  } as ClassData;
}

/**
 * 获取 Catalog 中注册的所有职业
 * 合并策略：按英文原名/规范化标识去重，5etools 来源优先，Legacy 作为兜底
 */
export function getCatalogClasses(options?: { edition?: Edition; source?: string }): ClassData[] {
  const entries = defaultCatalog.list('class', options);
  const classes: ClassData[] = [];
  const seenKeys = new Set<string>();

  // 1. 优先放入 5etools / homebrew 条目
  for (const entry of entries) {
    if (entry.sourcePackId !== 'legacy') {
      const cls = catalogEntryToClass(entry);
      const key = `${entry.source}:${(cls.nameEn || cls.name).toLowerCase().replace(/[-_\s]+/g, '')}`;
      seenKeys.add(key);
      classes.push(cls);
    }
  }

  // 2. 补充放入 Legacy 条目
  for (const entry of entries) {
    if (entry.sourcePackId === 'legacy') {
      const cls = catalogEntryToClass(entry);
      const key = `${entry.source}:${(cls.nameEn || cls.name).toLowerCase().replace(/[-_\s]+/g, '')}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        classes.push(cls);
      }
    }
  }

  return classes;
}

/**
 * 获取 Catalog 中注册的子职业列表，可按父职业名称筛选
 */
export function getCatalogSubclasses(
  parentClassName?: string,
  options?: { edition?: Edition; source?: string; parentSource?: string },
): CatalogEntry[] {
  const entries = defaultCatalog
    .list('subclass', { source: options?.source })
    .filter(
      (entry) =>
        !options?.edition ||
        options.edition === 'both' ||
        inferEditionFromSource(String(entry.raw.classSource || 'PHB')) === options.edition,
    );
  if (!parentClassName) return entries;

  const parent = defaultCatalog.get(parentClassName);
  const parents =
    parent?.kind === 'class'
      ? [parent]
      : defaultCatalog
          .list('class', { edition: options?.edition })
          .filter(
            (entry) =>
              classNames(entry).includes(classKeyPart(parentClassName)) &&
              (!options?.parentSource ||
                classKeyPart(entry.source) === classKeyPart(options.parentSource)),
          );
  if (parents.length)
    return entries.filter((entry) => parents.some((parent) => belongsToClass(entry, parent)));
  return entries.filter(
    (entry) =>
      classKeyPart(entry.raw.className || entry.parent) === classKeyPart(parentClassName) &&
      (!options?.parentSource ||
        classKeyPart(entry.raw.classSource || 'PHB') === classKeyPart(options.parentSource)),
  );
}
