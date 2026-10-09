/**
 * Catalog Spell Adapter
 * 对应《DND5R_5etools_rules_engine_agent_spec.md》规范 §8、§9、§18、§51
 *
 * 职责：
 * 1. 将 CatalogEntry (无论 5etools 还是 Legacy) 统一转为 UI 和规则引擎使用的 Spell 接口；
 * 2. 提供 getCatalogSpells() 检索法术全集，按 5etools 优先、Legacy 兜底的策略合并去重；
 * 3. 维护稳定 ID 与旧版 ID 的双向别名索引。
 */

import { CatalogEntry, SpellCatalogEntry, Edition } from '../types';
import { defaultCatalog } from '../catalog';
import { Spell } from '@/types/spell';
import { translateClass } from '@/engine/terminology';

/**
 * 将 CatalogEntry 归一化为 UI 期望的标准 Spell 接口
 */
export function catalogEntryToSpell(entry: CatalogEntry): Spell {
  // 1. 如果原始对象就是完整的旧版 Spell，直接保留原汁原味的字段
  if (entry.sourcePackId === 'legacy' && entry.raw && (entry.raw as any).castingTime) {
    const raw = entry.raw as unknown as Spell;
    return {
      ...raw,
      id: entry.id, // 允许使用稳定 ID，同时别名映射兼容旧 ID
    };
  }

  // 2. 5etools-cn / Homebrew 格式转换
  const spellEntry = entry as SpellCatalogEntry;
  const spellMeta = spellEntry.spell || {
    level: 0,
    school: '',
    classIds: [],
    components: {},
  };

  // 格式化材料成分
  const compParts: string[] = [];
  if (spellMeta.components?.v) compParts.push('V');
  if (spellMeta.components?.s) compParts.push('S');
  if (spellMeta.components?.m) {
    if (typeof spellMeta.components.m === 'string') {
      compParts.push(`M (${spellMeta.components.m})`);
    } else {
      compParts.push('M');
    }
  }

  // 提取升环效应文段
  let higherLevel: string | undefined = undefined;
  if (Array.isArray(entry.raw?.entries)) {
    const hlObj = (entry.raw.entries as any[]).find(
      (e) => typeof e === 'object' && (e.name === 'Higher Levels' || e.name === '升环施法效应' || e.name === '升环效应')
    );
    if (hlObj && Array.isArray(hlObj.entries)) {
      higherLevel = hlObj.entries.join('\n');
    }
  }

  // 扩展职业列表：包含大小写与中文译名，保证与 UI / 进度步 100% 顺畅匹配
  const classSet = new Set<string>();
  for (const c of spellMeta.classIds || []) {
    if (!c) continue;
    classSet.add(c);
    classSet.add(c.toLowerCase());
    classSet.add(c.charAt(0).toUpperCase() + c.slice(1).toLowerCase());
    const zh = translateClass(c);
    if (zh && zh !== c) classSet.add(zh);
  }

  return {
    id: entry.id,
    name: entry.name,
    nameEn: entry.englishName || entry.name,
    source: entry.source,
    level: spellMeta.level ?? 0,
    school: spellMeta.school ?? '',
    castingTime: spellMeta.castingTime || '',
    range: spellMeta.range || '',
    components: compParts.join(', '),
    duration: spellMeta.duration || '',
    ritual: spellMeta.ritual,
    classes: Array.from(classSet),
    classGrants: spellMeta.classGrants,
    description: entry.description || '',
    higherLevel,
    isHomebrew: Boolean(entry.isHomebrew || entry.sourcePackId?.startsWith('homebrew')),
    sourcePackId: entry.sourcePackId,
  };
}

/**
 * 获取 Catalog 中注册的所有法术
 * 合并策略：按英文原名/规范化标识去重，5etools 来源优先，Legacy 作为兜底
 */
export function getCatalogSpells(options?: { edition?: Edition; source?: string; allowHomebrew?: boolean }): Spell[] {
  const entries = defaultCatalog.list('spell', options);
  const spells: Spell[] = [];
  const seenKeys = new Set<string>();

  // 1. 优先放入 5etools / homebrew 条目
  for (const entry of entries) {
    if (entry.sourcePackId !== 'legacy') {
      const isBrew = Boolean(entry.isHomebrew || entry.sourcePackId?.startsWith('homebrew'));
      if (options?.allowHomebrew === false && isBrew) continue;
      const spell = catalogEntryToSpell(entry);
      const key = `${entry.source}:${(spell.nameEn || spell.name).toLowerCase().replace(/[-_\s]+/g, '')}`;
      seenKeys.add(key);
      spells.push(spell);
    }
  }

  // 2. 补充放入 Legacy 条目 (若 5etools 暂无对应内容)
  for (const entry of entries) {
    if (entry.sourcePackId === 'legacy') {
      const isBrew = Boolean(entry.isHomebrew || entry.sourcePackId?.startsWith('homebrew'));
      if (options?.allowHomebrew === false && isBrew) continue;
      const spell = catalogEntryToSpell(entry);
      const key = `${entry.source}:${(spell.nameEn || spell.name).toLowerCase().replace(/[-_\s]+/g, '')}`;
      if (!seenKeys.has(key)) {
        seenKeys.add(key);
        spells.push(spell);
      }
    }
  }

  return spells;
}


