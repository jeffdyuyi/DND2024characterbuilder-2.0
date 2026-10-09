/**
 * Catalog Species Adapter
 * 对应《DND5R_5etools_rules_engine_agent_spec.md》规范 §8、§9、§18、§51
 *
 * 职责：
 * 1. 将 CatalogEntry (5etools / Legacy) 统一转为 UI 和规则引擎使用的 Species / SubSpecies 接口；
 * 2. 提供 getCatalogSpecies() 检索种族全集，按 5etools 优先、Legacy 兜底策略去重；
 * 3. 提供 getCatalogSubspecies() 检索亚种/血系集合；
 * 4. 维护稳定全局 ID 与旧版短 ID、英文名、中文名别名映射。
 */

import { CatalogEntry, Edition } from '../types';
import { defaultCatalog } from '../catalog';
import { Species, SubSpecies, Trait, AbilityScoreChoice } from '@/types/species';
import { mergeOverlay } from '@/mechanics-overlay';
import { flattenEntries } from '@/source/fiveetools-cn/utils';
import {
  entryTraits,
  addStructuredTraits,
  lineageChoices,
  SPECIES_RESISTANCE_TRANSLATION,
  findLineageHostTrait,
} from './speciesChoices';
export { SPECIES_RESISTANCE_TRANSLATION };

/**
 * 从 5etools / legacy 的 raw 数据中解析固定加值与动态自选加值 (Phase D)
 */
export function parseAbilityScoreData(raw: any): {
  abilityScoreIncrease?: Record<string, number>;
  abilityChoices?: AbilityScoreChoice[];
} {
  const fixed: Record<string, number> = {};
  const choices: AbilityScoreChoice[] = [];

  // 1. 如果已有明确的 abilityScoreIncrease (如 Legacy)
  if (raw.abilityScoreIncrease && typeof raw.abilityScoreIncrease === 'object') {
    Object.entries(raw.abilityScoreIncrease).forEach(([k, v]) => {
      if (typeof v === 'number') fixed[k.toLowerCase()] = v;
    });
  }

  // 2. 5etools 格式：raw.ability (对象数组或单个对象)
  const abilityList = Array.isArray(raw.ability) ? raw.ability : raw.ability ? [raw.ability] : [];
  for (const item of abilityList) {
    if (!item || typeof item !== 'object') continue;

    // A. 提取固定数值: str, dex, con, int, wis, cha
    const statKeys = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
    for (const key of statKeys) {
      if (typeof item[key] === 'number') {
        fixed[key] = (fixed[key] || 0) + item[key];
      }
    }

    // B. 提取 choose 结构
    if (item.choose && typeof item.choose === 'object') {
      const c = item.choose;
      const from = Array.isArray(c.from)
        ? c.from.map((s: string) => s.toLowerCase())
        : ['str', 'dex', 'con', 'int', 'wis', 'cha'];
      const count = typeof c.count === 'number' ? c.count : 1;
      const amount = typeof c.amount === 'number' ? c.amount : 1;
      const weights = Array.isArray(c.weighted?.weights) ? c.weighted.weights : undefined;
      choices.push({
        from,
        count,
        amount,
        weights,
      });
    }
  }

  // 3. 如果 raw.abilityChoices 已经存在，合并
  if (Array.isArray(raw.abilityChoices)) {
    choices.push(...raw.abilityChoices);
  }

  return {
    abilityScoreIncrease: Object.keys(fixed).length > 0 ? fixed : undefined,
    abilityChoices: choices.length > 0 ? choices : undefined,
  };
}

/**
 * 将 CatalogEntry 规范化为 UI 期望的标准 Species 接口
 */
export function catalogEntryToSpecies(entry: CatalogEntry): Species {
  // 1. 若原始对象已是完整的旧版 Species，直接保留原汁原味
  if (entry.sourcePackId === 'legacy' && entry.raw && Array.isArray((entry.raw as any).traits)) {
    return entry.raw as unknown as Species;
  }

  // 2. 5etools-cn 格式适配并应用机制覆盖层
  const mergedEntry = mergeOverlay(entry);
  const raw = (mergedEntry.raw || {}) as any;

  let speed = 30;
  if (typeof raw.speed === 'number') {
    speed = raw.speed;
  } else if (typeof raw.speed === 'object' && raw.speed !== null) {
    speed = raw.speed.walk || 30;
  }

  const sizeNames: Record<string, string> = { S: 'Small', M: 'Medium', L: 'Large' };
  const size = Array.isArray(raw.size)
    ? raw.size.map((s: string) => sizeNames[s] || s)
    : ['Medium'];

  const traits: Trait[] = entryTraits(raw);
  addStructuredTraits(traits, raw, entry.sourcePackId);

  // 合并 raw.traits (保留 Overlay 注入的天然护甲等特性)
  if (Array.isArray(raw.traits)) {
    for (const t of raw.traits) {
      const matchIdx = traits.findIndex(
        (existing) => existing.name === t.name || (t.nameEn && existing.nameEn === t.nameEn),
      );
      if (matchIdx >= 0) {
        traits[matchIdx].mechanics = {
          ...(traits[matchIdx].mechanics || {}),
          ...t.mechanics,
        };
      } else {
        traits.push(t as Trait);
      }
    }
  }

  const { abilityScoreIncrease, abilityChoices } = parseAbilityScoreData(raw);

  const parentNames = new Set(
    [mergedEntry.name, mergedEntry.englishName].filter(Boolean).map((value) =>
      String(value)
        .toLowerCase()
        .replace(/[-_\s]+/g, ''),
    ),
  );
  const linked = defaultCatalog
    .list('subrace')
    .filter((sub) => {
      const subRaw = sub.raw as any;
      const parentName = String(subRaw.raceName || sub.parent || '')
        .toLowerCase()
        .replace(/[-_\s]+/g, '');
      return (
        parentNames.has(parentName) &&
        (!subRaw.raceSource ||
          String(subRaw.raceSource).toUpperCase() === String(mergedEntry.source).toUpperCase() ||
          sub.source === mergedEntry.source)
      );
    })
    .flatMap((sub) => {
      const subRaw = sub.raw as any;

      // 1. 如果该 subrace 自身带有 _versions 抽象宏分支（如 2014 PHB 龙裔的 10 种龙分支），使用 lineageChoices 展开
      if (subRaw._versions && Array.isArray(subRaw._versions) && subRaw._versions.length > 0) {
        const expandedLineage = lineageChoices(sub);
        if (expandedLineage && expandedLineage.options.length > 0) {
          return expandedLineage.options.map((opt) => ({
            ...opt,
            source: opt.source || sub.source,
            overwrite: opt.overwrite || (subRaw as any)?.overwrite,
          }));
        }
      }

      const mapped = catalogEntryToSubspecies(sub, raw);
      mapped.source = sub.source;
      mapped.page = sub.page || (subRaw as any)?.page;
      mapped.otherSources = (subRaw as any)?.otherSources;
      mapped.overwrite = (subRaw as any)?.overwrite || (sub as any).overwrite;
      const parentRef = String(subRaw.raceName || sub.parent || '')
        .toLowerCase()
        .replace(/[-_\s]+/g, '');
      const parentEntry = defaultCatalog
        .list('race')
        .find(
          (candidate) =>
            candidate.source === (subRaw.raceSource || sub.source) &&
            [candidate.name, candidate.englishName].some(
              (name) => name?.toLowerCase().replace(/[-_\s]+/g, '') === parentRef,
            ),
        );
      const parsed = parseAbilityScoreData(subRaw);
      mapped.abilityScoreIncrease = parsed.abilityScoreIncrease;
      mapped.abilityChoices = parsed.abilityChoices;
      const traits = entryTraits(subRaw);
      addStructuredTraits(traits, subRaw, sub.sourcePackId, (parentEntry?.raw || raw) as any);
      mapped.traits = [...traits, ...(subRaw.traits || [])];
      const features: any = {};
      const resistances = Array.isArray(subRaw.resist)
        ? subRaw.resist.filter((r: any) => typeof r === 'string')
        : [];
      if (resistances.length)
        features.resistances = resistances.map(
          (r: string) => SPECIES_RESISTANCE_TRANSLATION[r.toLowerCase()] || r,
        );
      for (const t of mapped.traits) {
        if (t.features?.resistances?.length && !features.resistances?.length)
          features.resistances = t.features.resistances;
        if (t.features?.resistanceChoices?.length && !features.resistanceChoices?.length)
          features.resistanceChoices = t.features.resistanceChoices;
        if (t.features?.spells?.length && !features.spells?.length)
          features.spells = t.features.spells;
        if (t.features?.spellcastingAbility && !features.spellcastingAbility)
          features.spellcastingAbility = t.features.spellcastingAbility;
        if (t.features?.senseUpgrade && !features.senseUpgrade)
          features.senseUpgrade = t.features.senseUpgrade;
        if (typeof t.features?.speedBonus === 'number' && typeof features.speedBonus !== 'number')
          features.speedBonus = t.features.speedBonus;
        if (t.features?.skillProficiencies?.length && !features.skillProficiencies?.length)
          features.skillProficiencies = t.features.skillProficiencies;
        if (t.features?.toolProficiencies?.length && !features.toolProficiencies?.length)
          features.toolProficiencies = t.features.toolProficiencies;
        if (t.features?.skillToolProficiencies?.length && !features.skillToolProficiencies?.length)
          features.skillToolProficiencies = t.features.skillToolProficiencies;
        if (t.features?.languages?.length && !features.languages?.length)
          features.languages = t.features.languages;
      }
      if (Object.keys(features).length > 0) {
        mapped.features = features;
      }
      return [mapped];
    })
    .filter((sub) => sub.name !== '未命名亚种' && sub.nameEn !== '未命名亚种');

  const subSpecies = raw.subSpecies || lineageChoices(mergedEntry);
  const rawSubOptions = [...(subSpecies?.options || []), ...linked];

  // 排序：同源核心规则选项优先置顶，跨源扩展选项排在后面
  const subOptions = rawSubOptions.sort((a, b) => {
    const aSame =
      (a.source || mergedEntry.source).toUpperCase() === mergedEntry.source.toUpperCase() ? 0 : 1;
    const bSame =
      (b.source || mergedEntry.source).toUpperCase() === mergedEntry.source.toUpperCase() ? 0 : 1;
    return aSame - bSame;
  });

  const lineageTrait =
    findLineageHostTrait(traits, raw._versions) ||
    traits.find((t) => t.name === '龙族血统' || t.nameEn === 'Draconic Ancestry');
  if (subOptions.length > 0 && lineageTrait) {
    lineageTrait.representsSubSpecies = true;
  }

  return {
    id: mergedEntry.id,
    source: mergedEntry.source,
    name: mergedEntry.name,
    nameEn: mergedEntry.englishName || mergedEntry.name,
    description: Array.isArray(raw.fluff?.entries)
      ? flattenEntries(raw.fluff.entries)
      : mergedEntry.description || '',
    creatureType: raw.creatureType || raw.creatureTypes?.[0] || '类人',
    size,
    speed,
    senses: raw.senses || { darkvision: raw.darkvision },
    abilityScoreIncrease: abilityScoreIncrease || raw.abilityScoreIncrease,
    abilityChoices,
    traits: traits.length > 0 ? traits : raw.traits || [],
    features: (() => {
      const spFeatures: any = {};
      for (const t of traits) {
        if (t.features?.resistances?.length && !spFeatures.resistances?.length)
          spFeatures.resistances = t.features.resistances;
        if (t.features?.resistanceChoices?.length && !spFeatures.resistanceChoices?.length)
          spFeatures.resistanceChoices = t.features.resistanceChoices;
        if (t.features?.spells?.length && !spFeatures.spells?.length)
          spFeatures.spells = t.features.spells;
        if (t.features?.spellcastingAbility && !spFeatures.spellcastingAbility)
          spFeatures.spellcastingAbility = t.features.spellcastingAbility;
        if (t.features?.senseUpgrade && !spFeatures.senseUpgrade)
          spFeatures.senseUpgrade = t.features.senseUpgrade;
        if (typeof t.features?.speedBonus === 'number' && typeof spFeatures.speedBonus !== 'number')
          spFeatures.speedBonus = t.features.speedBonus;
        if (t.features?.skillProficiencies?.length && !spFeatures.skillProficiencies?.length)
          spFeatures.skillProficiencies = t.features.skillProficiencies;
        if (t.features?.toolProficiencies?.length && !spFeatures.toolProficiencies?.length)
          spFeatures.toolProficiencies = t.features.toolProficiencies;
        if (
          t.features?.skillToolProficiencies?.length &&
          !spFeatures.skillToolProficiencies?.length
        )
          spFeatures.skillToolProficiencies = t.features.skillToolProficiencies;
        if (t.features?.languages?.length && !spFeatures.languages?.length)
          spFeatures.languages = t.features.languages;
      }
      return Object.keys(spFeatures).length > 0 ? spFeatures : undefined;
    })(),
    subSpecies: subOptions.length
      ? {
          ...subSpecies,
          numToChoose: subSpecies?.numToChoose || 1,
          options: subOptions,
          name: subSpecies?.name || lineageTrait?.name || '亚种/血系选择',
          nameEn: subSpecies?.nameEn || lineageTrait?.nameEn || 'Subspecies / Lineage',
          hostTraitName: subSpecies?.hostTraitName || lineageTrait?.name,
          hostTraitNameEn: subSpecies?.hostTraitNameEn || lineageTrait?.nameEn,
          levelRequirement: subSpecies?.levelRequirement || 1,
          isGamePlayChoice: subSpecies?.isGamePlayChoice || false,
        }
      : undefined,
  } as Species;
}

/**
 * 将 CatalogEntry 规范化为 UI 期望的标准 SubSpecies 接口
 */
export function catalogEntryToSubspecies(entry: CatalogEntry, parent?: any): SubSpecies {
  if (entry.sourcePackId === 'legacy' && entry.raw && Array.isArray((entry.raw as any).traits)) {
    return entry.raw as unknown as SubSpecies;
  }

  const mergedEntry = mergeOverlay(entry);
  const raw = (mergedEntry.raw || {}) as any;
  const { abilityScoreIncrease, abilityChoices } = parseAbilityScoreData(raw);
  const traits = entryTraits(raw);
  traits.push(...(raw.traits || []));
  addStructuredTraits(traits, raw, entry.sourcePackId, parent);

  const features: any = {};
  for (const t of traits) {
    if (t.features?.resistances?.length && !features.resistances?.length)
      features.resistances = t.features.resistances;
    if (t.features?.resistanceChoices?.length && !features.resistanceChoices?.length)
      features.resistanceChoices = t.features.resistanceChoices;
    if (t.features?.spells?.length && !features.spells?.length) features.spells = t.features.spells;
    if (t.features?.spellcastingAbility && !features.spellcastingAbility)
      features.spellcastingAbility = t.features.spellcastingAbility;
    if (t.features?.senseUpgrade && !features.senseUpgrade)
      features.senseUpgrade = t.features.senseUpgrade;
    if (typeof t.features?.speedBonus === 'number' && typeof features.speedBonus !== 'number')
      features.speedBonus = t.features.speedBonus;
    if (t.features?.skillProficiencies?.length && !features.skillProficiencies?.length)
      features.skillProficiencies = t.features.skillProficiencies;
    if (t.features?.toolProficiencies?.length && !features.toolProficiencies?.length)
      features.toolProficiencies = t.features.toolProficiencies;
    if (t.features?.skillToolProficiencies?.length && !features.skillToolProficiencies?.length)
      features.skillToolProficiencies = t.features.skillToolProficiencies;
    if (t.features?.languages?.length && !features.languages?.length)
      features.languages = t.features.languages;
  }

  return {
    id: mergedEntry.id,
    name: mergedEntry.name,
    nameEn: mergedEntry.englishName || mergedEntry.name,
    description: mergedEntry.description || '',
    abilityScoreIncrease: abilityScoreIncrease || raw.abilityScoreIncrease,
    abilityChoices,
    traits,
    features: Object.keys(features).length > 0 ? features : undefined,
    source: mergedEntry.source,
    page: raw.page || mergedEntry.page,
    otherSources: raw.otherSources,
    overwrite: raw.overwrite || (mergedEntry as any).overwrite,
  } as SubSpecies;
}

/**
 * 获取 Catalog 中注册的所有种族
 * 合并策略：按英文原名/规范化标识去重，5etools 来源优先，Legacy 作为兜底
 */
export function getCatalogSpecies(options?: { edition?: Edition; source?: string }): Species[] {
  const entries = defaultCatalog.list('race', options);
  const speciesList: Species[] = [];
  const seenKeys = new Set<string>();

  // 1. 优先放入 5etools / homebrew 条目
  for (const entry of entries) {
    if (entry.sourcePackId !== 'legacy') {
      const sp = catalogEntryToSpecies(entry);
      const key = `${entry.source}:${(sp.nameEn || sp.name).toLowerCase().replace(/[-_\s]+/g, '')}`;
      seenKeys.add(key);
      speciesList.push(sp);
    }
  }

  // 2. 补充放入 Legacy 条目
  for (const entry of entries) {
    if (entry.sourcePackId === 'legacy') {
      const sp = catalogEntryToSpecies(entry);
      const key = `${entry.source}:${(sp.nameEn || sp.name).toLowerCase().replace(/[-_\s]+/g, '')}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        speciesList.push(sp);
      }
    }
  }

  return speciesList;
}

/**
 * 获取 Catalog 中注册的亚种/血系
 */
export function getCatalogSubspecies(parentRaceName?: string): SubSpecies[] {
  const entries = defaultCatalog.list('subrace');
  const subs: SubSpecies[] = [];

  for (const entry of entries) {
    if (parentRaceName) {
      const parent = (entry.parent || '').toLowerCase().replace(/[-_\s]+/g, '');
      const filter = parentRaceName.toLowerCase().replace(/[-_\s]+/g, '');
      if (!parent.includes(filter) && !filter.includes(parent)) {
        continue;
      }
    }
    subs.push(catalogEntryToSubspecies(entry));
  }

  return subs;
}
