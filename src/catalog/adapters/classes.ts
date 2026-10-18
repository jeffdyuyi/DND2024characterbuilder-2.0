import { equipmentTypeLabel } from '../equipmentChoices';
import { filterNestedSourceChoices } from '../sourcePolicy';
import type { CatalogQueryOptions } from '../types';
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

import { CatalogEntry } from '../types';
import { defaultCatalog } from '../catalog';
import { ClassData, EquipmentRecord, EquipmentChoiceRow } from '@/types/class';
import { mergeOverlay } from '@/mechanics-overlay';
import { assembleCatalogClass } from './classAssembly';
import { applyClassFeatureMechanics } from '@/mechanics-overlay/classFeatures';
import { belongsToClass, classKeyPart, classNames } from './classReferences';
import { parseMulticlassRequirements } from '../multiclassRequirements';

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

function goldAlternativeFormula(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const formula = value.match(/\{@dice\s+([^|}]+)/i)?.[1]?.trim();
  return formula || undefined;
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
  if (typeof record.equipmentType === 'string') return equipmentTypeLabel(record.equipmentType);
  if (typeof record.special === 'string') return equipmentText(record.special);
  return '';
}

function equipmentOption(value: unknown): string {
  const values = Array.isArray(value) ? value : [value];
  return values.map(equipmentText).filter(Boolean).join('，');
}

function equipmentRecords(
  value: unknown,
  sourcePackId: string,
  selectionPrefix?: string,
  equipmentSource?: string,
  equipmentFilterUnresolved = false,
): EquipmentRecord[] {
  return (Array.isArray(value) ? value : [value]).flatMap((element, index): EquipmentRecord[] => {
    if (!element) return [];
    const record = typeof element === 'object' ? (element as Record<string, unknown>) : undefined;
    const uid = typeof element === 'string' ? element : record?.item;
    if (typeof uid === 'string') {
      const [name, source] = uid.split('|');
      return [
        {
          kind: 'item',
          label: name.trim(),
          quantity: typeof record?.quantity === 'number' ? record.quantity : 1,
          itemReference: { name: name.trim(), source: source?.trim(), sourcePackId },
        },
      ];
    }
    if (typeof record?.value === 'number') {
      return [{ kind: 'currency', label: equipmentText(record), currency: { cp: record.value } }];
    }
    if (typeof record?.equipmentType === 'string' && selectionPrefix) {
      const count = typeof record.quantity === 'number' ? record.quantity : 1;
      return Array.from(
        { length: Number.isInteger(count) && count > 0 ? count : 1 },
        (_, slot) => ({
          kind: 'unresolved' as const,
          label:
            equipmentTypeLabel(record.equipmentType as string) +
            (count > 1 ? `（${slot + 1}/${count}）` : ''),
          quantity: 1,
          equipmentType: record.equipmentType as string,
          equipmentSource,
          ...(equipmentFilterUnresolved ? { equipmentFilterUnresolved: true } : {}),
          selectionId: selectionPrefix + ':' + index + ':' + slot,
        }),
      );
    }
    return [{ kind: 'unresolved', label: equipmentText(element), quantity: 1 }];
  });
}

function normalizeStartingEquipment(
  value: unknown,
  sourcePackId: string,
  classId: string,
): ClassData['startingEquipment'] {
  const raw = value && typeof value === 'object' ? (value as Record<string, any>) : {};
  if (Array.isArray(raw.choiceA) && typeof raw.choiceB === 'string')
    return raw as ClassData['startingEquipment'];

  const rows = Array.isArray(raw.defaultData) ? raw.defaultData : [];
  const first =
    rows[0] && typeof rows[0] === 'object' ? (rows[0] as Record<string, unknown>) : undefined;
  const upperCasePackages = first && ['A', 'B', 'C'].some((key) => key in first);

  if (upperCasePackages && first) {
    return {
      choiceA: (Array.isArray(first.A) ? first.A : [first.A]).map(equipmentText).filter(Boolean),
      choiceB: equipmentOption(first.B) || equipmentText(raw.goldAlternative),
      ...(first.C !== undefined ? { choiceC: equipmentOption(first.C) } : {}),
      choiceARecords: equipmentRecords(first.A, sourcePackId),
      ...(first.B !== undefined ? { choiceBRecord: equipmentRecords(first.B, sourcePackId) } : {}),
      ...(first.C !== undefined ? { choiceCRecord: equipmentRecords(first.C, sourcePackId) } : {}),
    };
  }

  const rowOccurrences = new Map<string, number>();
  const choiceRows: EquipmentChoiceRow[] = rows.flatMap((row: unknown, index: number) => {
    if (!row || typeof row !== 'object') return [];
    const data = row as Record<string, unknown>;
    const signature = JSON.stringify(
      Object.fromEntries(Object.entries(data).sort(([a], [b]) => a.localeCompare(b))),
    );
    const hash =
      Array.from(signature).reduce(
        (value, char) => Math.imul(value ^ char.charCodeAt(0), 16777619),
        2166136261,
      ) >>> 0;
    const occurrence = rowOccurrences.get(signature) || 0;
    rowOccurrences.set(signature, occurrence + 1);
    const id = `${classId}:equipment:row:${hash.toString(36)}:${occurrence}`;
    const text = Array.isArray(raw.default) ? String(raw.default[index] || '') : '';
    const sources = [...text.matchAll(/\{@filter\s+[^}]+\}/g)].flatMap((match) =>
      [...match[0].matchAll(/\|source=([^|}]+)/g)].map((value) => value[1]),
    );
    const equipmentSource = new Set(sources).size === 1 ? sources[0] : undefined;
    return [
      {
        id,
        fixedLabel: equipmentOption(data._),
        fixedRecords: equipmentRecords(
          data._,
          sourcePackId,
          id + ':_',
          equipmentSource,
          new Set(sources).size > 1,
        ),
        options: Object.entries(data)
          .filter(([key]) => key !== '_')
          .map(([key, value]) => ({
            id: key,
            label: equipmentOption(value),
            records: equipmentRecords(
              value,
              sourcePackId,
              id + ':' + key,
              equipmentSource,
              new Set(sources).size > 1,
            ),
          })),
      },
    ];
  });
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

  const goldFormula = goldAlternativeFormula(raw.goldAlternative);
  return {
    choiceA,
    choiceB: equipmentText(raw.goldAlternative),
    ...(goldFormula ? { goldAlternativeFormula: goldFormula } : {}),
    ...(choiceRows.length ? { choiceRows } : {}),
  };
}

function normalizeProficiencyList(items: unknown, itemReferences = false): string[] {
  if (!Array.isArray(items)) return [];
  const result: string[] = [];
  for (const item of items) {
    if (!item) continue;
    if (typeof item === 'string') {
      const trimmed = item.trim();
      // 原生物品标签转为带来源的引用；保留 raw，不将来源压成纯显示名称。
      const reference = itemReferences && trimmed.match(/^\{@item\s+([^}]+)\}$/i);
      if (reference) result.push(reference[1].split('|').slice(0, 2).join('|'));
      else if (trimmed) result.push(trimmed);
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

  // 职业原始数据不注入内容；完整装配之后仅补必要的计算机制。
  const mergedEntry = entry;
  const raw = (mergedEntry.raw || {}) as any;
  const hdFaces = raw.hd?.faces || raw.hitPointDie || 8;
  const savingThrows = Array.isArray(raw.proficiency) ? raw.proficiency : [];
  const startProf = raw.startingProficiencies || {};
  const primaryAbility = normalizePrimaryAbilities(raw.primaryAbility);
  const multiclassAbilityRequirements = parseMulticlassRequirements(
    raw.multiclassing?.requirements,
    raw.primaryAbility,
  );
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
          catalogId: mergedSub.id,
          source: mergedSub.source,
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
    primaryAbility:
      primaryAbility.length > 0
        ? primaryAbility
        : multiclassAbilityRequirements
            ?.flatMap((group) => Object.keys(group))
            .filter((key, index, keys) => keys.indexOf(key) === index) || ['str'],
    ...(multiclassAbilityRequirements ? { multiclassAbilityRequirements } : {}),
    hitPointDie: hdFaces,
    proficiencies: {
      savingThrows,
      skills: normalizeProficiencyChoice(startProf.skills, 2),
      weapons: normalizeProficiencyList(startProf.weapons),
      armor: normalizeProficiencyList(startProf.armor),
      tools: Array.isArray(startProf.tools)
        ? normalizeProficiencyList(startProf.tools, true)
        : startProf.tools || [],
    },
    startingEquipment: normalizeStartingEquipment(
      raw.startingEquipment,
      entry.sourcePackId,
      entry.id,
    ),
    becomingAClass: raw.becomingAClass,
    progression: raw.progression || assembled.progression,
    features: applyClassFeatureMechanics(
      entry,
      Array.isArray(raw.classFeatures) && raw.classFeatures.length > 0
        ? assembled.features
        : raw.features || raw.classFeature || assembled.features,
    ),
    subClassInfo: {
      unlockLevel: raw.subClassInfo?.unlockLevel || assembled.subclassUnlockLevel || 3,
      options: subOptions,
    },
    spellcastingType: raw.spellcastingType ?? raw.casterProgression,
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
export function getCatalogClasses(options?: CatalogQueryOptions): ClassData[] {
  const entries = defaultCatalog.list('class', options);
  const classes: ClassData[] = [];
  const seenKeys = new Set<string>();
  const adaptChoice = (entry: CatalogEntry) => {
    const definition = catalogEntryToClass(entry);
    if (!options?.sourcePolicy || !definition.subClassInfo) return definition;
    return {
      ...definition,
      subClassInfo: {
        ...definition.subClassInfo,
        options: filterNestedSourceChoices(
          definition.subClassInfo.options,
          entry,
          defaultCatalog,
          options.sourcePolicy,
        ),
      },
    };
  };

  // 1. 优先放入 5etools / homebrew 条目
  for (const entry of entries) {
    if (entry.sourcePackId !== 'legacy') {
      const cls = adaptChoice(entry);
      const key = `${entry.source}:${(cls.nameEn || cls.name).toLowerCase().replace(/[-_\s]+/g, '')}`;
      seenKeys.add(key);
      classes.push(cls);
    }
  }

  // 2. 补充放入 Legacy 条目
  for (const entry of entries) {
    if (entry.sourcePackId === 'legacy') {
      const cls = adaptChoice(entry);
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
  options?: CatalogQueryOptions & { parentSource?: string },
): CatalogEntry[] {
  const entries = defaultCatalog
    .list('subclass', { source: options?.source, sourcePolicy: options?.sourcePolicy })
    .filter((entry) => {
      if (!options?.edition || options.edition === 'both') return true;
      const parent = defaultCatalog
        .list('class')
        .find((candidate) => belongsToClass(entry, candidate));
      return !parent || parent.edition === 'both' || parent.edition === options.edition;
    });
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
