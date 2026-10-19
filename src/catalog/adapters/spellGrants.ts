import type { CatalogEntry } from '../types';
import type {
  ParsedSpellGrants,
  SpellGrantMode,
  SpellGrantRule,
  SpellReference,
} from '@/types/spellGrant';

type RawObject = Record<string, unknown>;
const object = (value: unknown): value is RawObject =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const modes: SpellGrantMode[] = ['known', 'prepared', 'innate', 'expanded'];
const abilities = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha']);

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (object(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  return JSON.stringify(value) ?? 'undefined';
}

/** 浏览器可用的确定性内容签名；来源完整ID仍为前缀，不用数组下标或随机数存选择。 */
function signature(value: unknown): string {
  const text = canonical(value);
  let a = 2166136261;
  let b = 5381;
  for (let index = 0; index < text.length; index++) {
    a = Math.imul(a ^ text.charCodeAt(index), 16777619);
    b = Math.imul(b, 33) ^ text.charCodeAt(index);
  }
  return `${(a >>> 0).toString(16)}-${(b >>> 0).toString(16)}`;
}

/** 只接受正文明确的单一法表选择，并要求正文列出的职业恰好覆盖所有授予块。 */
function hasExclusiveSpellListChoice(
  raw: Record<string, unknown>,
  blocks: ParsedSpellGrants['blocks'],
): boolean {
  const texts: string[] = [];
  const visit = (node: unknown): void => {
    if (typeof node === 'string') texts.push(node);
    else if (Array.isArray(node)) node.forEach(visit);
    else if (object(node))
      Object.entries(node).forEach(([key, value]) => {
        if (key === 'entries') visit(value);
      });
  };
  visit(raw.entries);
  const choice = texts.find((text) => /选择一个(?:法术)?列表|指定一个职业/.test(text));
  if (!choice || blocks.length < 2) return false;
  const mentioned = new Set(
    [...choice.matchAll(/\{@filter [^|}]+\|spells\|[^}]*?class=([^|}]+)[^}]*\}/g)].flatMap(
      (match) => match[1].split(';').map((name) => name.trim()),
    ),
  );
  if (mentioned.size !== blocks.length) return false;
  return blocks.every((block) => {
    const classes = new Set(
      block.rules.flatMap((rule) =>
        rule.selection.kind === 'fixed' || !rule.selection.filter
          ? []
          : [...rule.selection.filter.matchAll(/(?:^|\|)class=([^|]+)/g)].flatMap((match) =>
              match[1].split(';').map((name) => name.trim()),
            ),
      ),
    );
    return classes.size === 1 && mentioned.has([...classes][0]);
  });
}

/** 解析原生授法结构及明确的法表互斥正文；不激活装备或改写存档。 */
export function parseCatalogSpellGrants(entry: CatalogEntry): ParsedSpellGrants {
  const { id, kind, name, source, sourcePackId, edition, revision } = entry;
  const result: ParsedSpellGrants = {
    origin: { id, kind, name, source, sourcePackId, edition, revision },
    blockRelationship: 'single',
    blocks: [],
    associations: [],
    diagnostics: [],
  };
  const diagnostic = (code: string, path: string, message: string, raw: unknown) => {
    result.diagnostics.push({ code, path, message, raw });
  };
  const reference = (value: unknown, path: string): SpellReference | undefined => {
    if (typeof value !== 'string') {
      diagnostic('invalid-spell-reference', path, '法术引用不是字符串。', value);
      return;
    }
    const match = value.trim().match(/^([^|#]+)(?:\|([^|#]+))?(?:#([^|#]+))?$/);
    if (!match || !match[1].trim() || (match[2] !== undefined && !match[2].trim())) {
      diagnostic('invalid-spell-reference', path, '法术引用结构未识别。', value);
      return;
    }
    return {
      name: match[1].trim(),
      source: (match[2] || 'PHB').trim(),
      suffix: match[3],
      raw: value,
    };
  };
  const additional = entry.raw.additionalSpells;
  if (additional !== undefined && !Array.isArray(additional)) {
    diagnostic(
      'invalid-additional-spells',
      'additionalSpells',
      '法术授予块必须为数组。',
      additional,
    );
  }
  if (Array.isArray(additional)) {
    result.blockRelationship = additional.length > 1 ? 'unspecified' : 'single';
    const metadataSignature = (block: RawObject) =>
      signature(
        Object.fromEntries(
          Object.entries(block).filter(([key]) => !modes.includes(key as SpellGrantMode)),
        ),
      );
    const metadataCounts = new Map<string, number>();
    for (const block of additional) {
      if (!object(block)) continue;
      const key = metadataSignature(block);
      metadataCounts.set(key, (metadataCounts.get(key) ?? 0) + 1);
    }
    const blockIds = new Set<string>();
    for (const [index, block] of additional.entries()) {
      const path = `additionalSpells[${index}]`;
      if (!object(block)) {
        diagnostic('invalid-block', path, '法术授予块不是对象。', block);
        continue;
      }
      const metadataKey = metadataSignature(block);
      const identityStability = metadataCounts.get(metadataKey) === 1 ? 'metadata' : 'content';
      // 独立元数据身份不受新增等级、法术或数组重排影响；无法消歧时不猜测块之间的对应关系。
      const blockId = `${id}:spell-grant:${identityStability}:${identityStability === 'metadata' ? metadataKey : signature(block)}`;
      if (blockIds.has(blockId)) {
        diagnostic('duplicate-block', path, '完全相同的授予块重复，需核对组间关系。', block);
        continue;
      }
      blockIds.add(blockId);
      const diagnosticsBeforeBlock = result.diagnostics.length;
      // 相同候选条件可以授予多次独立选择；同签名选择分别计序，不合并选择额度。
      const choiceOccurrences = new Map<string, number>();
      const parsed: ParsedSpellGrants['blocks'][number] = {
        id: blockId,
        identityStability,
        name: typeof block.name === 'string' ? block.name : undefined,
        nameEn: typeof block.ENG_name === 'string' ? block.ENG_name : undefined,
        rules: [],
        requiresReview: false,
        raw: block,
      };
      if (typeof block.resourceName === 'string' && block.resourceName.trim())
        parsed.resourceName = block.resourceName;
      else if (block.resourceName !== undefined)
        diagnostic(
          'invalid-resource-name',
          `${path}.resourceName`,
          '资源名称不是非空字符串。',
          block.resourceName,
        );
      const ability = block.ability;
      if (ability === 'inherit') parsed.ability = { kind: 'inherit' };
      else if (typeof ability === 'string' && abilities.has(ability))
        parsed.ability = { kind: 'fixed', value: ability };
      else if (
        object(ability) &&
        Array.isArray(ability.choose) &&
        ability.choose.length &&
        ability.choose.every((a) => typeof a === 'string' && abilities.has(a))
      ) {
        parsed.ability = { kind: 'choose', from: [...new Set(ability.choose as string[])] };
      } else if (ability !== undefined)
        diagnostic('unsupported-ability', `${path}.ability`, '施法属性结构需核对。', ability);
      for (const key of Object.keys(block)) {
        if (![...modes, 'name', 'ENG_name', 'ability', 'resourceName'].includes(key))
          diagnostic(
            'unsupported-block-field',
            `${path}.${key}`,
            '保留未支持的授予条件，不能忽略后自动生效。',
            block[key],
          );
      }
      for (const mode of modes) {
        const gates = block[mode];
        if (gates === undefined) continue;
        if (!object(gates)) {
          diagnostic('invalid-gates', `${path}.${mode}`, '授予等级分组不是对象。', gates);
          continue;
        }
        for (const [gateKey, content] of Object.entries(gates)) {
          const gate: SpellGrantRule['gate'] | undefined =
            gateKey === '_'
              ? { kind: 'none', raw: gateKey }
              : /^\d+$/.test(gateKey)
                ? { kind: 'level', value: Number(gateKey), raw: gateKey }
                : /^s[0-9]$/.test(gateKey)
                  ? { kind: 'spellLevel', value: Number(gateKey.slice(1)), raw: gateKey }
                  : undefined;
          const gatePath = `${path}.${mode}.${gateKey}`;
          if (!gate) {
            diagnostic('unsupported-gate', gatePath, '解锁条件未识别。', content);
            continue;
          }
          const walk = (
            node: unknown,
            nodePath: string,
            usage: SpellGrantRule['usage'],
            groupId: string,
          ) => {
            const emit = (selection: SpellGrantRule['selection']) => {
              const baseRuleId = `${blockId}:${mode}:${gateKey}:${signature({ usage, selection })}`;
              let ruleId = baseRuleId;
              if (selection.kind === 'choose') {
                const occurrence = choiceOccurrences.get(baseRuleId) ?? 0;
                choiceOccurrences.set(baseRuleId, occurrence + 1);
                if (occurrence > 0) ruleId = `${baseRuleId}:choice:${occurrence + 1}`;
              }
              if (parsed.rules.some((rule) => rule.id === ruleId)) {
                diagnostic('duplicate-rule', nodePath, '相同授予重复，需核对是否独立选择。', node);
                return;
              }
              parsed.rules.push({
                id: ruleId,
                mode,
                gate,
                usage: { ...usage },
                selection,
                resourceGroupId: groupId,
                raw: node,
              });
            };
            if (typeof node === 'string') {
              const spell = reference(node, nodePath);
              if (spell) emit({ kind: 'fixed', spell });
            } else if (Array.isArray(node)) {
              node.forEach((child, childIndex) =>
                walk(child, `${nodePath}[${childIndex}]`, usage, groupId),
              );
            } else if (object(node)) {
              if ('choose' in node || 'all' in node) {
                if (
                  Object.keys(node).some((key) => !['choose', 'all', 'count'].includes(key)) ||
                  ('choose' in node && 'all' in node)
                ) {
                  diagnostic('unsupported-choice', nodePath, '选择节点含未支持的条件。', node);
                  return;
                }
                if (typeof node.all === 'string' && node.all.trim())
                  emit({ kind: 'all', filter: node.all });
                else if ('choose' in node) {
                  const choose = node.choose;
                  const count = object(choose)
                    ? (choose.count ?? node.count ?? 1)
                    : (node.count ?? 1);
                  if (typeof count !== 'number' || !Number.isInteger(count) || count < 1) {
                    diagnostic('invalid-choice-count', nodePath, '法术选择数量无效。', node);
                    return;
                  }
                  if (typeof choose === 'string' && choose.trim())
                    emit({ kind: 'choose', count, filter: choose });
                  else if (
                    object(choose) &&
                    Array.isArray(choose.from) &&
                    choose.from.length &&
                    Object.keys(choose).every((key) => ['from', 'count'].includes(key))
                  ) {
                    const from = choose.from.map((ref, refIndex) =>
                      reference(ref, `${nodePath}.choose.from[${refIndex}]`),
                    );
                    if (from.every((ref): ref is SpellReference => Boolean(ref)))
                      emit({ kind: 'choose', count, from });
                  } else diagnostic('unsupported-choice', nodePath, '法术候选结构未识别。', node);
                } else diagnostic('unsupported-choice', nodePath, '法术筛选结构未识别。', node);
                return;
              }
              for (const [key, children] of Object.entries(node)) {
                if (key === '_' && usage.kind === 'unspecified')
                  walk(children, `${nodePath}._`, usage, groupId);
                else if (key === 'will' || key === 'ritual')
                  walk(children, `${nodePath}.${key}`, { kind: key }, `${groupId}:${key}`);
                else if (
                  ['daily', 'rest', 'weekly', 'yearly', 'resource'].includes(key) &&
                  object(children)
                ) {
                  for (const [uses, spells] of Object.entries(children)) {
                    walk(
                      spells,
                      `${nodePath}.${key}.${uses}`,
                      { kind: key as SpellGrantRule['usage']['kind'], key: uses },
                      `${blockId}:${mode}:${gateKey}:${key}:${uses}`,
                    );
                  }
                } else
                  diagnostic(
                    'unsupported-usage',
                    `${nodePath}.${key}`,
                    '施法次数或恢复条件需核对。',
                    children,
                  );
              }
            } else diagnostic('invalid-grant-node', nodePath, '法术授予节点未识别。', node);
          };
          walk(content, gatePath, { kind: 'unspecified' }, `${blockId}:${mode}:${gateKey}`);
        }
      }
      parsed.requiresReview = result.diagnostics.length > diagnosticsBeforeBlock;
      result.blocks.push(parsed);
    }
    if (
      result.blockRelationship === 'unspecified' &&
      result.blocks.length === additional.length &&
      result.blocks.every((block) => !block.requiresReview) &&
      hasExclusiveSpellListChoice(entry.raw, result.blocks)
    )
      result.blockRelationship = 'exclusive';
  }
  const attached = entry.raw.attachedSpells;
  if (attached !== undefined) {
    const walk = (node: unknown, path: string) => {
      if (typeof node === 'string') {
        const spell = reference(node, path);
        if (spell) result.associations.push({ path, spell, raw: node });
      } else if (Array.isArray(node))
        node.forEach((child, index) => walk(child, `${path}[${index}]`));
      else if (object(node))
        Object.entries(node).forEach(([key, child]) => {
          if (
            ['daily', 'rest', 'weekly', 'yearly', 'will', 'ritual', 'charges'].includes(key) ||
            /^\d+e?$/.test(key)
          )
            walk(child, `${path}.${key}`);
          else
            diagnostic(
              'unsupported-association',
              `${path}.${key}`,
              '关联法术条件需进一步核对。',
              child,
            );
        });
      else diagnostic('unsupported-association', path, '关联法术结构未识别。', node);
    };
    walk(attached, 'attachedSpells');
    diagnostic(
      'association-not-grant',
      'attachedSpells',
      '关联法术不是施法授权；须结合原文确认法术书、次数、充能及激活条件。',
      attached,
    );
  }
  return result;
}
