/**
 * 5etools Spell Normalizer
 * 对应《DND5R_5etools_rules_engine_agent_spec.md》规范 §8、§9、§18
 */

import { SpellCatalogEntry } from '@/catalog/types';
import { makeEntryId, inferEditionFromSource } from '@/catalog/identity';
import {
  clean5eTags,
  flattenEntries,
  SPELL_SCHOOL_NAMES,
  formatCastingTime,
  formatRange,
  formatDuration,
} from '../utils';

export function normalizeSpell(raw: Record<string, any>, packId = '5etools-cn'): SpellCatalogEntry {
  const name = raw.name || raw.ENG_name || '未命名法术';
  const englishName = raw.ENG_name || (raw.name !== name ? raw.name : undefined);
  const source = raw.source || 'PHB';
  const edition = inferEditionFromSource(source);

  // 稳定唯一 ID
  const id = makeEntryId({
    packId,
    kind: 'spell',
    source,
    name: englishName || name,
  });

  const level = typeof raw.level === 'number' ? raw.level : 0;
  const schoolCode = raw.school || '';
  const school = SPELL_SCHOOL_NAMES[schoolCode] || schoolCode;

  // 职业与子职业授权列表
  const classIds: string[] = [];
  const classGrants: Array<{ name: string; source: string }> = [];
  if (raw.classes?.fromClassList && Array.isArray(raw.classes.fromClassList)) {
    for (const c of raw.classes.fromClassList) {
      if (c.name) {
        classIds.push(c.name.toLowerCase());
        classGrants.push({ name: c.name, source: c.source || '' });
      }
    }
  }
  if (raw.classes?.fromClassListVariant && Array.isArray(raw.classes.fromClassListVariant)) {
    for (const c of raw.classes.fromClassListVariant) {
      if (c.name) {
        classIds.push(c.name.toLowerCase());
        classGrants.push({ name: c.name, source: c.source || '' });
      }
    }
  }
  if (Array.isArray(raw.classes)) {
    for (const c of raw.classes) {
      if (typeof c === 'string') {
        classIds.push(c.toLowerCase());
        classGrants.push({ name: c, source: '' });
      } else if (c?.name) {
        classIds.push(c.name.toLowerCase());
        classGrants.push({ name: c.name, source: c.source || '' });
      }
    }
  }
  if (Array.isArray(raw._classGrants)) {
    for (const grant of raw._classGrants) {
      if (!grant?.name) continue;
      classIds.push(String(grant.name).toLowerCase());
      classGrants.push({ name: String(grant.name), source: String(grant.source || '') });
    }
  }

  const subclassIds: string[] = [];
  if (raw.classes?.fromSubclass && Array.isArray(raw.classes.fromSubclass)) {
    for (const sc of raw.classes.fromSubclass) {
      if (sc.subclass?.name) subclassIds.push(sc.subclass.name.toLowerCase());
    }
  }

  // 仪式
  const ritual = Boolean(raw.meta?.ritual);

  // 专注判断
  let concentration = false;
  if (Array.isArray(raw.duration)) {
    concentration = raw.duration.some((d: any) => Boolean(d.concentration));
  }

  // 施法构材
  const components = {
    v: Boolean(raw.components?.v),
    s: Boolean(raw.components?.s),
    m: raw.components?.m ? (typeof raw.components.m === 'string' ? clean5eTags(raw.components.m) : true) : false,
  };

  const description = flattenEntries(raw.entries);

  return {
    id,
    kind: 'spell',
    name,
    englishName,
    source,
    edition,
    page: raw.page,
    sourcePackId: packId,
    isHomebrew: packId.startsWith('homebrew') || Boolean(raw.isHomebrew),
    description,
    entries: raw.entries,
    raw,
    spell: {
      level,
      school,
      classIds,
      classGrants,
      subclassIds,
      ritual,
      concentration,
      castingTime: formatCastingTime(raw.time),
      range: formatRange(raw.range),
      components,
      duration: formatDuration(raw.duration),
    },
  };
}
