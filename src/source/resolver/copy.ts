/**
 * _copy / _mod Resolver
 * 对应《DND5R_5etools_rules_engine_agent_spec.md》规范 §12、§13
 *
 * 5etools 的数据文件中大量使用 _copy 引用复制基础条目，
 * 再用 _mod 进行追加/替换等细粒度修改。
 * 必须在 Normalize 之前完整处理，禁止静默跳过未知 modifier。
 */

export interface ResolverWarning {
  code: 'UNSUPPORTED_MOD' | 'MISSING_COPY_SOURCE' | 'RESOLVE_ERROR';
  entry?: string;
  message: string;
  target?: Record<string, unknown>;
  filePath?: string;
  kind?: string;
}

export interface ResolveResult<T> {
  resolved: T[];
  warnings: ResolverWarning[];
}

// ─── _mod 操作实现 ───────────────────────────────────────────────────────────

// ─── _mod 操作实现 ───────────────────────────────────────────────────────────

type ModOperation =
  | { mode: 'setProp'; path?: string; value: any }
  | { mode: 'appendArr'; path?: string; items: unknown }
  | { mode: 'prependArr'; path?: string; items: unknown }
  | { mode: 'appendIfNotExistsArr'; path?: string; items: unknown }
  | { mode: 'remove'; path?: string }
  | { mode: 'removeArr'; path?: string; names?: string[]; items?: unknown }
  | { mode: 'replaceArr'; path?: string; replace: string; items: unknown }
  | { mode: 'replaceTxt'; path?: string; replace: string; with: string; flags?: string }
  | { mode: 'scalarAddHit'; path?: string; amount: number }
  | { mode: 'scalarAddDc'; path?: string; amount: number }
  | { mode: 'scalarAddProp'; path?: string; prop: string; amount: number }
  | { mode: 'addSpells'; spells: string[] }
  | { mode: 'replaceSpells'; spells: Record<string, string> }
  | { mode: 'removeSpells'; spells: string[] };

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function deepReplaceTxt(target: any, search: string, replaceWith: string, flags?: string): any {
  if (typeof target === 'string') {
    if (flags) {
      const reg = new RegExp(escapeRegex(search), flags.includes('g') ? flags : `${flags}g`);
      return target.replace(reg, replaceWith);
    }
    return target.replaceAll(search, replaceWith);
  }
  if (Array.isArray(target)) {
    return target.map((item) => deepReplaceTxt(item, search, replaceWith, flags));
  }
  if (target && typeof target === 'object') {
    const copy: any = {};
    for (const [k, v] of Object.entries(target)) {
      copy[k] = deepReplaceTxt(v, search, replaceWith, flags);
    }
    return copy;
  }
  return target;
}

function getNestedProp(obj: any, path: string): any {
  return path.split('.').reduce((acc, key) => acc?.[key], obj);
}

function setNestedProp(obj: any, path: string, value: any): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  const target = keys.reduce((acc, key) => (acc[key] ??= {}), obj);
  target[last] = value;
}

function deleteNestedProp(obj: any, path: string): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  const target = keys.reduce((acc, key) => acc?.[key], obj);
  if (target && typeof target === 'object') {
    delete target[last];
  }
}

function appendIfNotExists(arr: any[], items: any[]): any[] {
  const result = [...arr];
  for (const item of items) {
    const isObj = item && typeof item === 'object';
    const exists = result.some((existing) => {
      if (isObj && existing && typeof existing === 'object') {
        if (item.name && existing.name) return item.name === existing.name;
        return JSON.stringify(item) === JSON.stringify(existing);
      }
      return existing === item;
    });
    if (!exists) {
      result.push(item);
    }
  }
  return result;
}

function applyModOperation(entry: any, rawMod: any, defaultPath?: string): ResolverWarning | null {
  if (rawMod === 'remove') {
    const path = defaultPath;
    if (path) deleteNestedProp(entry, path);
    return null;
  }

  const mode: string = rawMod?.mode || (rawMod === 'remove' ? 'remove' : '');
  const path = rawMod?.path || defaultPath;

  try {
    switch (mode) {
      case 'setProp': {
        if (path) setNestedProp(entry, path, rawMod.value);
        break;
      }
      case 'appendArr': {
        if (!path) break;
        const arr = Array.isArray(getNestedProp(entry, path)) ? getNestedProp(entry, path) : [];
        const toAdd = Array.isArray(rawMod.items)
          ? rawMod.items
          : rawMod.items !== undefined
            ? [rawMod.items]
            : [];
        setNestedProp(entry, path, [...arr, ...toAdd]);
        break;
      }
      case 'prependArr': {
        if (!path) break;
        const arr = Array.isArray(getNestedProp(entry, path)) ? getNestedProp(entry, path) : [];
        const toAdd = Array.isArray(rawMod.items)
          ? rawMod.items
          : rawMod.items !== undefined
            ? [rawMod.items]
            : [];
        setNestedProp(entry, path, [...toAdd, ...arr]);
        break;
      }
      case 'appendIfNotExistsArr': {
        if (!path) break;
        const arr = Array.isArray(getNestedProp(entry, path)) ? getNestedProp(entry, path) : [];
        const toAdd = Array.isArray(rawMod.items)
          ? rawMod.items
          : rawMod.items !== undefined
            ? [rawMod.items]
            : [];
        setNestedProp(entry, path, appendIfNotExists(arr, toAdd));
        break;
      }
      case 'remove': {
        if (path) deleteNestedProp(entry, path);
        break;
      }
      case 'removeArr': {
        if (!path) break;
        const arr: any[] = Array.isArray(getNestedProp(entry, path))
          ? getNestedProp(entry, path)
          : [];
        const names: string[] =
          rawMod.names ||
          (Array.isArray(rawMod.items) ? rawMod.items : rawMod.items ? [rawMod.items] : []);
        setNestedProp(
          entry,
          path,
          names.length
            ? arr.filter((item) => !names.includes(typeof item === 'string' ? item : item?.name))
            : [],
        );
        break;
      }
      case 'replaceArr': {
        if (!path) break;
        const arr = getNestedProp(entry, path);
        if (!Array.isArray(arr)) break;
        const replaceTarget = rawMod.replace;
        const itemsToInsert = Array.isArray(rawMod.items)
          ? rawMod.items
          : rawMod.items !== undefined
            ? [rawMod.items]
            : [];

        const nextArr: any[] = [];
        for (const item of arr) {
          const isMatch =
            typeof item === 'string'
              ? item === replaceTarget
              : item?.name === replaceTarget || item?.ENG_name === replaceTarget;
          if (isMatch) {
            nextArr.push(...itemsToInsert);
          } else {
            nextArr.push(item);
          }
        }
        setNestedProp(entry, path, nextArr);
        break;
      }
      case 'replaceTxt': {
        if (!path) break;
        const currentVal = getNestedProp(entry, path);
        if (currentVal !== undefined) {
          setNestedProp(
            entry,
            path,
            deepReplaceTxt(currentVal, rawMod.replace, rawMod.with, rawMod.flags),
          );
        }
        break;
      }
      case 'scalarAddHit':
      case 'scalarAddDc':
      case 'scalarAddProp': {
        (entry._pendingScalarMods ??= []).push({ ...rawMod, path });
        break;
      }
      case 'addSpells': {
        entry.additionalSpells ??= [];
        entry.additionalSpells.push(...(rawMod.spells || []));
        break;
      }
      case 'replaceSpells': {
        if (entry.additionalSpells && rawMod.spells) {
          Object.entries(rawMod.spells as Record<string, string>).forEach(([from, to]) => {
            const idx = entry.additionalSpells.findIndex(
              (s: any) => (typeof s === 'string' ? s : s?.name) === from,
            );
            if (idx >= 0) entry.additionalSpells[idx] = to;
          });
        }
        break;
      }
      case 'removeSpells': {
        if (entry.additionalSpells) {
          const toRemove = new Set(rawMod.spells || []);
          entry.additionalSpells = entry.additionalSpells.filter(
            (s: any) => !toRemove.has(typeof s === 'string' ? s : s?.name),
          );
        }
        break;
      }
      default: {
        return {
          code: 'UNSUPPORTED_MOD',
          entry: entry.name,
          message: `未知 _mod 操作 "${mode}"，已保留条目原始数据`,
        };
      }
    }
  } catch (err) {
    return {
      code: 'RESOLVE_ERROR',
      entry: entry.name,
      message: `执行 _mod "${mode}" 时发生异常：${(err as Error).message}`,
    };
  }

  return null;
}

function applyModBlock(entry: any, modBlock: any, warnings: ResolverWarning[]): void {
  if (!modBlock || typeof modBlock !== 'object') return;
  for (const [key, modVal] of Object.entries(modBlock)) {
    if (modVal === 'remove') {
      const warning = applyModOperation(entry, 'remove', key);
      if (warning) warnings.push(warning);
      continue;
    }
    const mods = Array.isArray(modVal) ? modVal : [modVal];
    for (const mod of mods) {
      if (typeof mod === 'string' && mod === 'remove') {
        const warning = applyModOperation(entry, 'remove', key);
        if (warning) warnings.push(warning);
      } else if (mod && typeof mod === 'object') {
        const warning = applyModOperation(entry, mod, key);
        if (warning) warnings.push(warning);
      }
    }
  }
}

function extractEntrySource(entry: any): string | undefined {
  if (entry.source) return entry.source;
  if (entry.inherits?.source) return entry.inherits.source;
  if (typeof entry.type === 'string' && entry.type.includes('|')) {
    return entry.type.split('|').at(-1);
  }
  return undefined;
}

export function getEntryKeys(entry: any): string[] {
  const source = extractEntrySource(entry);
  if (!source) return [];
  const keys: string[] = [];
  // Class records may share name/book while targeting different parent editions.
  const scope = entry.className
    ? `::${[
        entry.className,
        entry.classSource || 'PHB',
        entry.subclassShortName || entry.shortName || entry.subclassName || '',
        entry.subclassShortName || entry.subclassName ? entry.subclassSource || 'PHB' : '',
        entry.level ?? '',
      ].join('::')}`
    : '';
  if (entry.name) keys.push(`${entry.name}::${source}${scope}`);
  if (entry.ENG_name) keys.push(`${entry.ENG_name}::${source}${scope}`);
  return keys;
}

function resolveSingleEntryNode(
  rawEntry: any,
  localIndex: Map<string, any>,
  resolvedMap: Map<string, any>,
  globalEntries: Map<string, any>,
  visitingKeys: Set<string>,
  warnings: ResolverWarning[],
  matchesCopyScope?: (candidate: Record<string, any>, copy: Record<string, any>) => boolean,
): any {
  const keys = getEntryKeys(rawEntry);
  const primaryKey = keys[0];

  if (primaryKey && resolvedMap.has(primaryKey)) {
    return JSON.parse(JSON.stringify(resolvedMap.get(primaryKey)));
  }

  const cloned: any = JSON.parse(JSON.stringify(rawEntry));

  if (cloned._copy) {
    if (primaryKey && visitingKeys.has(primaryKey)) {
      warnings.push({
        code: 'RESOLVE_ERROR',
        entry: cloned.name,
        message: `检测到循环继承引用: ${Array.from(visitingKeys).join(' -> ')} -> ${primaryKey}`,
      });
      return cloned;
    }

    if (primaryKey) visitingKeys.add(primaryKey);

    const copyRef = cloned._copy;
    const [copyKey, copyKeyEn] = getEntryKeys(copyRef);

    let baseRaw =
      localIndex.get(copyKey) ||
      (copyKeyEn ? localIndex.get(copyKeyEn) : undefined) ||
      globalEntries.get(copyKey) ||
      (copyKeyEn ? globalEntries.get(copyKeyEn) : undefined);

    if (!baseRaw) {
      // Some upstream copies omit parent fields. Resolve only a unique matching
      // record; never recreate the old name/book overwrite behavior.
      const names = new Set([copyRef.name, copyRef.ENG_name].filter(Boolean));
      const matches = [...new Set([...localIndex.values(), ...globalEntries.values()])].filter(
        (candidate) =>
          extractEntrySource(candidate) === copyRef.source &&
          [candidate.name, candidate.ENG_name].some((name) => names.has(name)) &&
          (matchesCopyScope
            ? matchesCopyScope(candidate, copyRef)
            : [
                'className',
                'classSource',
                'shortName',
                'subclassShortName',
                'subclassSource',
                'level',
              ].every(
                (field) => copyRef[field] === undefined || candidate[field] === copyRef[field],
              )),
      );
      if (matches.length === 1) baseRaw = matches[0];
      else if (matches.length > 1)
        warnings.push({
          code: 'RESOLVE_ERROR',
          entry: cloned.name,
          target: copyRef,
          message: `_copy 来源 "${copyKey}" 存在 ${matches.length} 个候选，未自动选择`,
        });
    }

    if (!baseRaw) {
      warnings.push({
        code: 'MISSING_COPY_SOURCE',
        entry: cloned.name,
        target: copyRef,
        message: `找不到 _copy 来源 "${copyKey}"，已跳过合并，保留当前条目`,
      });
    } else {
      // 基础模板先递归解析
      const baseKeys = getEntryKeys(baseRaw);
      const basePrimaryKey = baseKeys[0];
      let resolvedBase: any;
      if (basePrimaryKey && !resolvedMap.has(basePrimaryKey)) {
        resolvedBase = resolveSingleEntryNode(
          baseRaw,
          localIndex,
          resolvedMap,
          globalEntries,
          visitingKeys,
          warnings,
          matchesCopyScope,
        );
      } else if (basePrimaryKey && resolvedMap.has(basePrimaryKey)) {
        resolvedBase = resolvedMap.get(basePrimaryKey);
      } else {
        resolvedBase = baseRaw;
      }

      const baseCopy = JSON.parse(JSON.stringify(resolvedBase));
      delete baseCopy._copy;
      delete baseCopy._mod;

      const ownProps = Object.fromEntries(
        Object.entries(cloned).filter(([k]) => !k.startsWith('_')),
      );

      const mergedInherits = {
        ...(baseCopy.inherits || {}),
        ...(cloned.inherits || {}),
      };

      Object.assign(cloned, {
        ...baseCopy,
        ...ownProps,
      });

      if (baseCopy.inherits || cloned.inherits) {
        cloned.inherits = mergedInherits;
      }

      // 执行 _copy._mod
      if (copyRef._mod) {
        applyModBlock(cloned, copyRef._mod, warnings);
      }
      // Keep structural identity evidence for downstream bilingual reference
      // parsing. Preserve failed _copy nodes instead of discarding the target.
      cloned._copyIdentity = JSON.parse(JSON.stringify(copyRef));
      delete cloned._copy;
    }

    if (primaryKey) visitingKeys.delete(primaryKey);
  }

  // 执行顶层 _mod
  if (cloned._mod) {
    applyModBlock(cloned, cloned._mod, warnings);
    delete cloned._mod;
  }

  if (primaryKey) {
    resolvedMap.set(primaryKey, JSON.parse(JSON.stringify(cloned)));
    for (const k of keys) {
      resolvedMap.set(k, resolvedMap.get(primaryKey));
    }
  }

  return cloned;
}

// ─── 主 Resolver ─────────────────────────────────────────────────────────────

/**
 * 展开一批 5etools raw entries 中的 _copy 继承与 _mod 修改。
 * @param entries 同一文件/批次内的原始条目数组（处理内引用）
 * @param globalEntries 跨文件全局条目查找池（处理跨文件 _copy）
 */
export function resolveEntries<T extends Record<string, any>>(
  entries: T[],
  globalEntries: Map<string, T> = new Map(),
  matchesCopyScope?: (candidate: Record<string, any>, copy: Record<string, any>) => boolean,
): ResolveResult<T> {
  const warnings: ResolverWarning[] = [];

  // 建立批内索引
  const localIndex = new Map<string, T>();
  for (const entry of entries) {
    for (const key of getEntryKeys(entry)) {
      localIndex.set(key, entry);
    }
  }

  const resolvedMap = new Map<string, any>();
  const visitingKeys = new Set<string>();
  const resolved: T[] = [];

  for (const entry of entries) {
    const result = resolveSingleEntryNode(
      entry,
      localIndex,
      resolvedMap,
      globalEntries,
      visitingKeys,
      warnings,
      matchesCopyScope,
    );
    resolved.push(result as T);
  }

  return { resolved, warnings };
}
