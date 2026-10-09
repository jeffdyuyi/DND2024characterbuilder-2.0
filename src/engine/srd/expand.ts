// 5etools 数据解包与继承展开引擎（移植自 DND-card-web-main）
// 职责：处理 5etools 原生数据中的 _copy 继承树、_versions 变体以及特定魔法物品生成

export type Raw = Record<string, any>;

const list = (v: any): any[] => (Array.isArray(v) ? v : v == null ? [] : [v]);
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const metadata = new Set([
  'page',
  'otherSources',
  'additionalSources',
  'referenceSources',
  'reprintedAs',
  'srd',
  'srd52',
  'basicRules',
  'basicRules2024',
  'hasFluff',
  'hasFluffImages',
]);

const ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'] as const;

/** 深度解包 5etools _copy 结构与 _templates 模板应用 */
export function expandCopies(items: Raw[], templates: Raw[] = []): Raw[] {
  const memo = new Map<Raw, Raw>();
  function resolve(item: Raw, seen = new Set<Raw>()): Raw {
    if (!item._copy) return item;
    if (memo.has(item)) return memo.get(item)!;
    if (seen.has(item)) return item;
    const copy = item._copy;
    const parent = items.find(
      (p) =>
        p !== item &&
        (copy.abbreviation
          ? p.abbreviation === copy.abbreviation
          : [p.name, p.ENG_name].includes(copy.name)) &&
        (p.source || p.inherits?.source) === copy.source &&
        (!copy.raceName || p.raceName === copy.raceName) &&
        (!copy.raceSource || p.raceSource === copy.raceSource),
    );
    if (!parent) return item;
    const base = structuredClone(resolve(parent, new Set([...seen, item])));
    if (base._copy) return item;
    for (const key of metadata) {
      if (!copy._preserve?.[key] && !copy._preserve?.['*']) delete base[key];
    }
    const applied = (copy._templates || []).map((t: Raw) =>
      templates.find((v) => [v.name, v.ENG_name].includes(t.name) && v.source === t.source),
    );
    if (applied.some((t: Raw | undefined) => !t)) return item;
    for (const template of applied) {
      Object.assign(base, structuredClone(template.apply?._root || {}));
    }
    const result = { ...base, ...structuredClone(item) };
    const modifications: Raw = {};
    for (const mods of [copy._mod || {}, ...applied.map((t: Raw) => t.apply?._mod || {})]) {
      for (const [path, changes] of Object.entries(mods)) {
        modifications[path] = [...(modifications[path] || []), ...list(changes)];
      }
    }
    for (const [key, value] of Object.entries(item)) {
      if (value === null) delete result[key];
    }
    let supported = true;
    for (const [path, changes] of Object.entries(modifications)) {
      if (path.split('.').some((key) => ['__proto__', 'prototype', 'constructor'].includes(key))) {
        supported = false;
        continue;
      }
      const segments = path.split('.');
      const key = segments.pop()!;
      let target: Raw = result;
      for (const segment of segments) target = target[segment] ||= {};
      for (const change of list(changes)) {
        if (change === 'remove') {
          delete target[key];
          continue;
        }
        if (change.mode === 'setProp') {
          const parts = (change.prop ? (path === '_' ? '' : path + '.') + change.prop : path).split(
            '.',
          );
          if (parts.some((p: string) => ['__proto__', 'constructor', 'prototype'].includes(p))) {
            supported = false;
            continue;
          }
          let dst = result;
          for (const p of parts.slice(0, -1)) dst = dst[p] ||= {};
          if (change.value === null) delete dst[parts.at(-1)!];
          else dst[parts.at(-1)!] = structuredClone(change.value);
          continue;
        }
        if (change.mode === 'addSenses') {
          result.senses ||= [];
          for (const sense of list(change.senses)) {
            const label =
              (
                {
                  darkvision: '黑暗视觉',
                  blindsight: '盲视',
                  tremorsense: '震颤感知',
                  truesight: '真实视觉',
                } as Record<string, string>
              )[sense.type] || sense.type;
            const index = result.senses.findIndex(
              (v: string) => v.startsWith(label) || v.startsWith(sense.type),
            );
            if (index < 0) result.senses.push(`${label} ${sense.range}尺`);
            else if (Number(String(result.senses[index]).match(/\d+/)?.[0] || 0) < sense.range) {
              result.senses[index] = `${label} ${sense.range}尺`;
            }
          }
          continue;
        }
        if (change.mode === 'replaceTxt' && typeof change.replace === 'string') {
          if (change.replace.length > 1000 || /\([^)]*[+*][^)]*\)[+*{]/.test(change.replace)) {
            supported = false;
            continue;
          }
          let regex: RegExp;
          try {
            regex = new RegExp(change.replace, change.flags?.includes('i') ? 'gi' : 'g');
          } catch {
            supported = false;
            continue;
          }
          const replace = (v: any): any =>
            typeof v === 'string'
              ? v.replace(regex, String(change.with))
              : Array.isArray(v)
                ? v.map(replace)
                : v && typeof v === 'object'
                  ? Object.fromEntries(
                      Object.entries(v).map(([k, value]) => [
                        k,
                        ['name', 'ENG_name'].includes(k) && !change.props?.includes(k)
                          ? value
                          : replace(value),
                      ]),
                    )
                  : v;
          if (path === '*') {
            for (const field of [
              'trait',
              'action',
              'bonus',
              'reaction',
              'legendary',
              'mythic',
              'variant',
              'spellcasting',
              'entries',
            ]) {
              if (result[field]) result[field] = replace(result[field]);
            }
          } else {
            target[key] = replace(target[key]);
          }
          continue;
        }
        const values = list(target[key]);
        const additions = structuredClone(list(change.items));
        if (change.mode === 'appendArr') target[key] = [...values, ...additions];
        else if (change.mode === 'prependArr') target[key] = [...additions, ...values];
        else if (change.mode === 'appendIfNotExistsArr') {
          target[key] = [...values, ...additions.filter((a) => !values.some((b) => same(a, b)))];
        } else if (change.mode === 'insertArr') {
          values.splice(change.index < 0 ? values.length : change.index, 0, ...additions);
          target[key] = values;
        } else if (change.mode === 'replaceArr' || change.mode === 'replaceOrAppendArr') {
          const at =
            typeof change.replace?.index === 'number'
              ? change.replace.index
              : values.findIndex(
                  (v) =>
                    v === change.replace ||
                    v?.name === change.replace ||
                    v?.ENG_name === change.replace,
                );
          if (at >= 0 && at < values.length) values.splice(at, 1, ...additions);
          else if (change.mode === 'replaceOrAppendArr') values.push(...additions);
          else supported = false;
          target[key] = values;
        }
      }
    }
    memo.set(item, result);
    return result;
  }
  return items.map((i) => resolve(i));
}

/** 展开 5etools 版本分支 (_versions) */
export function expandVersions(raw: Raw): Raw[] {
  const output: Raw[] = [];
  for (const version of raw._versions || []) {
    const versions = version._abstract
      ? (version._implementations || []).map((implementation: Raw) => {
          const variables = implementation._variables || {};
          const replace = (v: any): any =>
            typeof v === 'string'
              ? v.replace(/\{\{(\w+)}}/g, (all, key) => variables[key] ?? all)
              : Array.isArray(v)
                ? v.map(replace)
                : v && typeof v === 'object'
                  ? Object.fromEntries(Object.entries(v).map(([k, value]) => [k, replace(value)]))
                  : v;
          return replace({ ...version._abstract, ...implementation });
        })
      : [version];
    for (const variant of versions) {
      const base = { ...raw };
      delete base._versions;
      const item = {
        ...variant,
        _copy: {
          name: base.name,
          source: base.source,
          _preserve: { '*': true },
          _mod: variant._mod,
        },
      };
      const expanded = expandCopies([base, item])[1];
      if (expanded) {
        expanded._versionBaseName = raw.name;
        delete expanded._mod;
        delete expanded._variables;
        output.push(expanded);
      }
    }
  }
  return output;
}

/** 亚种继承主种族特质 */
export function inheritSubrace(raw: Raw, races: Raw[]): Raw {
  const parent = races.find(
    (r) => [r.name, r.ENG_name].includes(raw.raceName) && r.source === (raw.raceSource || 'PHB'),
  );
  if (!parent) return { ...raw, _unresolvedParent: true };
  const merged: Raw = {
    ...parent,
    ...raw,
    _parentName: parent.name,
    _parentSource: parent.source,
    _subraceName: raw.name,
  };
  merged.name = raw.name ? `${parent.name}（${raw.name}）` : parent.name;
  merged.ENG_name = raw.name
    ? `${parent.ENG_name || parent.name} (${raw.ENG_name || raw.name})`
    : parent.ENG_name || parent.name;
  const parentEntries = structuredClone(parent.entries || []);
  for (const entry of raw.entries || []) {
    const overwrite = typeof entry === 'object' && entry?.data?.overwrite;
    const index = overwrite
      ? parentEntries.findIndex((e: Raw) => e.name === overwrite || e.ENG_name === overwrite)
      : -1;
    if (index >= 0) parentEntries[index] = entry;
    else parentEntries.push(entry);
  }
  merged.entries = parentEntries;
  if (raw.overwrite?.ability) merged.ability = raw.ability;
  else if (parent.ability?.length === 1 && raw.ability?.length === 1) {
    const a = { ...parent.ability[0], ...raw.ability[0] };
    for (const key of ABILITIES) {
      if (typeof parent.ability[0][key] === 'number' || typeof raw.ability[0][key] === 'number') {
        a[key] = (parent.ability[0][key] || 0) + (raw.ability[0][key] || 0);
      }
    }
    merged.ability = [a];
  } else if (raw.ability && parent.ability) merged._unresolvedParent = true;
  for (const key of [
    'skillProficiencies',
    'toolProficiencies',
    'languageProficiencies',
    'weaponProficiencies',
    'armorProficiencies',
    'additionalSpells',
  ]) {
    if (!raw.overwrite?.[key]) merged[key] = [...(parent[key] || []), ...(raw[key] || [])];
  }
  return merged;
}

export function readableEntries(raw: Raw, category: string): unknown[] {
  const entries = [...(Array.isArray(raw.entries) ? raw.entries : [])];
  if (Array.isArray(raw.additionalEntries)) entries.push(...raw.additionalEntries);

  if (category === 'spell') {
    const spellMetaLines: string[] = [];
    // 环阶与学派
    const levelStr = raw.level === 0 ? '戏法' : `${raw.level}环`;
    const schoolMap: Record<string, string> = {
      A: '防护系',
      C: '咒法系',
      D: '预言系',
      E: '惑控系',
      V: '塑能系',
      I: '幻术系',
      N: '死灵系',
      T: '变化系',
    };
    const schoolStr = schoolMap[raw.school] || raw.school || '';
    spellMetaLines.push(`**等级与学派**：${levelStr} ${schoolStr}`);

    // 施法时间
    if (raw.time && Array.isArray(raw.time) && raw.time.length) {
      const t = raw.time[0];
      const unitMap: Record<string, string> = {
        action: '动作',
        bonus: '附赠动作',
        reaction: '反应',
        minute: '分钟',
        hour: '小时',
      };
      spellMetaLines.push(`**施法时间**：${t.number || 1} ${unitMap[t.unit] || t.unit}`);
    }

    // 距离
    if (raw.range) {
      if (raw.range.type === 'point' && raw.range.distance) {
        spellMetaLines.push(
          `**施法距离**：${raw.range.distance.amount || ''} ${raw.range.distance.type === 'feet' ? '尺' : raw.range.distance.type}`,
        );
      } else if (raw.range.type === 'self') {
        spellMetaLines.push(`**施法距离**：自身`);
      } else if (raw.range.type === 'touch') {
        spellMetaLines.push(`**施法距离**：触及`);
      }
    }

    // 成分
    if (raw.components) {
      const compParts: string[] = [];
      if (raw.components.v) compParts.push('声音 (V)');
      if (raw.components.s) compParts.push('姿势 (S)');
      if (raw.components.m) {
        const mat =
          typeof raw.components.m === 'string' ? raw.components.m : raw.components.m.text || '材料';
        compParts.push(`材料 (M, ${mat})`);
      }
      spellMetaLines.push(`**法术成分**：${compParts.join('、')}`);
    }

    // 持续时间
    if (raw.duration && Array.isArray(raw.duration) && raw.duration.length) {
      const d = raw.duration[0];
      if (d.type === 'instant') {
        spellMetaLines.push(`**持续时间**：立即`);
      } else if (d.type === 'timed') {
        const conc = d.concentration ? '专注，' : '';
        spellMetaLines.push(
          `**持续时间**：${conc}至多 ${d.duration?.amount || ''} ${d.duration?.type === 'minute' ? '分钟' : d.duration?.type === 'round' ? '轮' : d.duration?.type === 'hour' ? '小时' : d.duration?.type}`,
        );
      }
    }

    if (spellMetaLines.length) {
      entries.unshift({
        type: 'inset',
        name: '法术规格',
        entries: spellMetaLines,
      });
    }
  }

  if (category === 'itemGroup' && raw.items?.length) {
    entries.push({ type: 'list', items: raw.items.map((ref: string) => `{@item ${ref}}`) });
  }
  if (category === 'table') entries.push({ ...raw, type: 'table' });
  if (category === 'tableGroup') entries.push(...(raw.tables || []));
  if (category === 'psionic') entries.push(...(raw.modes || []));
  if (category === 'class' || category === 'subclass') {
    const refs = raw.classFeatures || raw.subclassFeatures || [];
    if (refs.length) {
      entries.push({
        type: 'entries',
        name: '等级特性',
        entries: [
          {
            type: 'list',
            items: refs.map((v: any) => {
              const ref = typeof v === 'string' ? v : v.classFeature || v.subclassFeature;
              return {
                type: category === 'class' ? 'refClassFeature' : 'refSubclassFeature',
                [category === 'class' ? 'classFeature' : 'subclassFeature']: ref,
              };
            }),
          },
        ],
      });
    }
  }
  if (category === 'monster') {
    for (const [key, label] of Object.entries({
      trait: '特性',
      spellcasting: '施法',
      action: '动作',
      bonus: '附赠动作',
      reaction: '反应',
      legendary: '传奇动作',
      mythic: '神话动作',
      variant: '变体',
    })) {
      if (raw[key]?.length) entries.push({ type: 'entries', name: label, entries: raw[key] });
    }
  }
  if (raw.entriesHigherLevel) entries.push(...raw.entriesHigherLevel);
  return entries;
}
