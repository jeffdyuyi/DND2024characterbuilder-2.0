import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parseCatalogSpellGrants } from '../adapters/spellGrants';
import { makeEntryId } from '../identity';
import type { CatalogEntry, EntryKind } from '../types';

interface Sample {
  kind: EntryKind;
  path: string;
  raw: Record<string, any>;
}
const fixture = JSON.parse(
  readFileSync('src/source/__fixtures__/fiveetools-cn/spell-grants.json', 'utf8'),
) as { entries: Sample[] };
function entry(sample: Sample, pack = '5etools-cn'): CatalogEntry {
  return {
    id: makeEntryId({
      packId: pack,
      kind: sample.kind,
      source: sample.raw.source,
      name: sample.raw.ENG_name || sample.raw.name,
    }),
    kind: sample.kind,
    name: sample.raw.name,
    englishName: sample.raw.ENG_name,
    source: sample.raw.source,
    sourcePackId: pack,
    edition: sample.raw.source === 'XPHB' ? '2024' : '2014',
    raw: sample.raw,
  };
}
function sample(name: string, source: string) {
  return entry(fixture.entries.find((s) => s.raw.ENG_name === name && s.raw.source === source)!);
}
const rules = (value: ReturnType<typeof parseCatalogSpellGrants>) =>
  value.blocks.flatMap((block) => block.rules);

it.each([
  { choose: 'level=0;1;2;3;4;5' },
  { choose: { from: ['命令术|PHB', '鉴定术|PHB'], count: 1 } },
])('重复选择节点保留独立额度和可序列化身份：%j', (choice) => {
  const raw = { additionalSpells: [{ known: { 10: [choice, choice] } }] };
  const original = JSON.stringify(raw);
  const input = { ...sample('Warlock', 'XPHB'), raw };
  const parsed = parseCatalogSpellGrants(input);
  expect(parsed.diagnostics).toEqual([]);
  expect(parsed.blocks[0].requiresReview).toBe(false);
  const selections = rules(parsed);
  expect(selections).toHaveLength(2);
  expect(new Set(selections.map((rule) => rule.id)).size).toBe(2);
  expect(selections[0].selection).toEqual(selections[1].selection);
  expect(selections[0].resourceGroupId).toBe(selections[1].resourceGroupId);
  const saved = JSON.parse(
    JSON.stringify({
      [selections[0].id]: ['spell-a'],
      [selections[1].id]: ['spell-b'],
    }),
  );
  const reparsed = rules(parseCatalogSpellGrants(JSON.parse(JSON.stringify(input))));
  expect(reparsed.map((rule) => saved[rule.id])).toEqual([['spell-a'], ['spell-b']]);
  expect(JSON.stringify(raw)).toBe(original);
});

it('不同等级的重复选择分别计数，固定法术重复仍诊断', () => {
  const choice = { choose: 'level=1' };
  const parsed = parseCatalogSpellGrants({
    ...sample('Warlock', 'XPHB'),
    raw: {
      additionalSpells: [
        {
          known: {
            1: [choice, choice, '命令术', '命令术'],
            3: [choice, choice],
          },
        },
      ],
    },
  });
  expect(rules(parsed).filter((rule) => rule.selection.kind === 'choose')).toHaveLength(4);
  expect(rules(parsed).filter((rule) => rule.selection.kind === 'fixed')).toHaveLength(1);
  expect(new Set(rules(parsed).map((rule) => rule.id)).size).toBe(5);
  expect(parsed.diagnostics.map((diagnostic) => diagnostic.code)).toEqual(['duplicate-rule']);
  expect(parsed.blocks[0].requiresReview).toBe(true);
});

it.each(fixture.entries)(
  '真实 $kind / $raw.ENG_name / $raw.source保全raw与来源，块不错误合并',
  (row) => {
    const original = JSON.stringify(row.raw);
    const catalogEntry = entry(row);
    const parsed = parseCatalogSpellGrants(catalogEntry);
    expect(parsed.origin.id).toBe(catalogEntry.id);
    expect(parsed.origin.sourcePackId).toBe('5etools-cn');
    expect(parsed.origin.edition).toBe(catalogEntry.edition);
    expect(JSON.stringify(row.raw)).toBe(original);
    expect(parsed.blocks).toHaveLength(row.raw.additionalSpells?.length || 0);
    if (row.kind !== 'item') expect(parsed.diagnostics).toEqual([]);
  },
);
it('星界精灵三个原生块保持分离，不自动把三道都授予', () => {
  const parsed = parseCatalogSpellGrants(sample('Astral Elf', 'AAG'));
  expect(parsed.blocks).toHaveLength(3);
  expect(parsed.blockRelationship).toBe('unspecified');
  expect(
    rules(parsed).map((rule) => rule.selection.kind === 'fixed' && rule.selection.spell.name),
  ).toEqual(['舞光术', '光亮术', '圣火术']);
  expect(parsed.blocks[0].ability).toEqual({ kind: 'choose', from: ['int', 'wis', 'cha'] });
});
it('阿斯莫已知戏法、等级和每日次数分别保留；不能把daily擅自换成长休', () => {
  const parsed = parseCatalogSpellGrants(sample('Aasimar', 'DMG'));
  expect(parsed.blocks[0].ability).toEqual({ kind: 'fixed', value: 'cha' });
  expect(rules(parsed).filter((rule) => rule.mode === 'known')).toMatchObject([
    {
      gate: { kind: 'level', value: 1 },
      usage: { kind: 'unspecified' },
      selection: { kind: 'fixed', spell: { name: '光亮术', source: 'PHB', suffix: 'c' } },
    },
  ]);
  expect(rules(parsed).filter((rule) => rule.mode === 'innate')).toMatchObject([
    { gate: { kind: 'level', value: 3 }, usage: { kind: 'daily', key: '1' } },
    { gate: { kind: 'level', value: 5 }, usage: { kind: 'daily', key: '1' } },
  ]);
});
it('衡鉴学生扩展表始终是expanded；不误作prepared/known/innate', () => {
  const parsed = parseCatalogSpellGrants(sample('Lorehold Student', 'SCC'));
  expect(rules(parsed)).toHaveLength(10);
  expect(new Set(rules(parsed).map((rule) => rule.mode))).toEqual(new Set(['expanded']));
  expect(rules(parsed)[0].gate).toEqual({ kind: 'spellLevel', value: 1, raw: 's1' });
});
it('斯翠海文学徒15个组合保持独立，固定戏法与可选1环法术不混为同一选择', () => {
  const parsed = parseCatalogSpellGrants(sample('Strixhaven Initiate', 'SCC'));
  expect(parsed.blockRelationship).toBe('unspecified');
  expect(parsed.blocks).toHaveLength(15);
  const lorehold = parsed.blocks.filter((block) => block.nameEn?.startsWith('Lorehold'));
  expect(lorehold).toHaveLength(3);
  for (const block of lorehold) {
    expect(block.rules.filter((rule) => rule.mode === 'known')).toHaveLength(2);
    expect(block.rules.find((rule) => rule.mode === 'innate')).toMatchObject({
      usage: { kind: 'daily', key: '1' },
      selection: { kind: 'choose', count: 1, filter: 'level=1|class=牧师;法师' },
    });
    expect(block.ability).toMatchObject({ kind: 'choose', from: ['int', 'wis', 'cha'] });
  }
});
it('职业固定准备与子职业扩展表区分，解锁职业等级不变成法术环阶', () => {
  const warlock = parseCatalogSpellGrants(sample('Warlock', 'XPHB'));
  expect(rules(warlock)).toMatchObject([
    {
      mode: 'prepared',
      gate: { kind: 'level', value: 9 },
      selection: { kind: 'fixed', spell: { name: '异界探知', source: 'xphb' } },
    },
  ]);
  const knowledge = parseCatalogSpellGrants(sample('Knowledge Domain', 'PHB'));
  expect(rules(knowledge)).toHaveLength(10);
  expect(rules(knowledge).every((rule) => rule.mode === 'prepared')).toBe(true);
  const archfey = parseCatalogSpellGrants(sample('The Archfey', 'PHB'));
  expect(
    rules(archfey).every((rule) => rule.mode === 'expanded' && rule.gate.kind === 'spellLevel'),
  ).toBe(true);
});
it('装备关联法术不自动成为角色施法；共享次数与法术书要留待正文适配', () => {
  for (const name of ['Adze of Annam', 'Alchemical Compendium']) {
    const catalogEntry = fixture.entries.find((row) => row.raw.ENG_name === name)!;
    const parsed = parseCatalogSpellGrants(entry(catalogEntry));
    expect(parsed.blocks).toEqual([]);
    expect(parsed.associations.length).toBeGreaterThan(0);
    expect(parsed.diagnostics.map((d) => d.code)).toContain('association-not-grant');
    if (name === 'Adze of Annam')
      expect(parsed.associations.map((a) => a.path)).toEqual([
        'attachedSpells.daily.1[0]',
        'attachedSpells.daily.1[1]',
      ]);
  }
});
it('同名官方/第三方和2014/2024身份隔离；块重排不会更换选择ID', () => {
  const official = sample('Strixhaven Initiate', 'SCC');
  const parsed = parseCatalogSpellGrants(official);
  const reversed = parseCatalogSpellGrants({
    ...official,
    raw: {
      ...official.raw,
      additionalSpells: [...(official.raw.additionalSpells as any[])].reverse(),
    },
  });
  expect(new Set(rules(parsed).map((r) => r.id))).toEqual(
    new Set(rules(reversed).map((r) => r.id)),
  );
  const other = parseCatalogSpellGrants({
    ...official,
    id: 'homebrew:feat:scc:strixhaven-initiate',
    sourcePackId: 'homebrew',
  });
  expect(other.blocks[0].id).not.toBe(parsed.blocks[0].id);
  expect(parseCatalogSpellGrants(sample('Magic Initiate', 'PHB')).origin.id).not.toBe(
    parseCatalogSpellGrants(sample('Magic Initiate', 'XPHB')).origin.id,
  );
});
it('相同daily分组保留共享身份，1与1e不擅自折叠，will/ritual/all筛选保留', () => {
  const base = sample('Warlock', 'XPHB');
  const parsed = parseCatalogSpellGrants({
    ...base,
    raw: {
      additionalSpells: [
        {
          ability: 'inherit',
          innate: {
            _: {
              daily: { '1': ['命令术', '鉴定术'], '1e': ['疗伤术'] },
              will: ['光亮术#c'],
              ritual: ['寻获魔宠'],
            },
            3: [{ all: 'level=1|class=wizard' }],
          },
        },
      ],
    },
  });
  expect(parsed.diagnostics).toEqual([]);
  const result = rules(parsed);
  const daily = result.filter((rule) => rule.usage.kind === 'daily');
  expect(daily[0].resourceGroupId).toBe(daily[1].resourceGroupId);
  expect(daily[2].resourceGroupId).not.toBe(daily[1].resourceGroupId);
  expect(result.map((r) => r.usage.kind).sort()).toEqual([
    'daily',
    'daily',
    'daily',
    'ritual',
    'unspecified',
    'will',
  ]);
  expect(result.find((rule) => rule.selection.kind === 'all')?.selection).toEqual({
    kind: 'all',
    filter: 'level=1|class=wizard',
  });
});
it.each([
  null,
  12,
  'bad',
  { known: [] },
  [
    {
      ability: { choose: ['unknown'] },
      prepared: { bad: ['a'], _: [{ choose: { from: ['a|PHB', 12], count: 2 } }] },
    },
  ],
])('未知结构诊断且不篡改输入：%j', (raw) => {
  const base = sample('Warlock', 'XPHB');
  const original = JSON.stringify(raw);
  const parsed = parseCatalogSpellGrants({ ...base, raw: { additionalSpells: raw } });
  expect(parsed.diagnostics.length).toBeGreaterThan(0);
  expect(JSON.stringify(raw)).toBe(original);
});
it('未知次数、节点附加条件不能被当成合法选择默默放行', () => {
  const base = sample('Warlock', 'XPHB');
  const parsed = parseCatalogSpellGrants({
    ...base,
    raw: {
      additionalSpells: [
        {
          innate: {
            _: { unknown: ['命令术'], daily: { 1: [{ choose: 'level=1', requires: 'unknown' }] } },
          },
        },
      ],
    },
  });
  expect(rules(parsed)).toEqual([]);
  expect(parsed.diagnostics.map((d) => d.code)).toEqual([
    'unsupported-usage',
    'unsupported-choice',
  ]);
  expect(parsed.blocks[0].requiresReview).toBe(true);
});

it.each([
  'race',
  'background',
  'class',
  'subclass',
  'classFeature',
  'subclassFeature',
  'feat',
  'item',
] as EntryKind[])('所有来源类别复用同一固定与可选解析：%s', (kind) => {
  const catalogEntry = {
    ...sample('Warlock', 'XPHB'),
    kind,
    raw: {
      additionalSpells: [
        {
          prepared: {
            1: [{ choose: { from: ['命令术|PHB', '鉴定术|PHB'], count: 1 } }, '光亮术#c'],
          },
        },
      ],
    },
  };
  const parsed = parseCatalogSpellGrants(catalogEntry);
  expect(parsed.diagnostics).toEqual([]);
  expect(parsed.blocks[0].requiresReview).toBe(false);
  expect(rules(parsed)[0].selection).toMatchObject({
    kind: 'choose',
    count: 1,
    from: [
      { name: '命令术', source: 'PHB' },
      { name: '鉴定术', source: 'PHB' },
    ],
  });
  expect(rules(parsed)[1].selection).toMatchObject({
    kind: 'fixed',
    spell: { name: '光亮术', suffix: 'c' },
  });
});
it('未知附加解锁条件让整个块待核对，关联法术筛选不能误作法术名', () => {
  const parsed = parseCatalogSpellGrants({
    ...sample('Warlock', 'XPHB'),
    raw: {
      additionalSpells: [{ requires: 'unknown', known: { 1: ['命令术'] } }],
      attachedSpells: { choose: 'level=1|class=wizard' },
    },
  });
  expect(parsed.blocks[0].requiresReview).toBe(true);
  expect(parsed.associations).toEqual([]);
  expect(parsed.diagnostics.map((d) => d.code)).toEqual([
    'unsupported-block-field',
    'unsupported-association',
    'association-not-grant',
  ]);
});

it.each([
  ['Nature Domain', 'PHB', 'level=0|class=德鲁伊', 1],
  ['Death Domain', 'DMG', 'level=0|school=N', 1],
  ['Arcana Domain', 'SCAG', 'level=0|class=法师', 2],
])('真实%s嵌套无次数节点保留等级、候选和选择数量', (name, source, filter, count) => {
  const parsed = parseCatalogSpellGrants(sample(String(name), String(source)));
  expect(parsed.diagnostics).toEqual([]);
  const known = rules(parsed).filter((rule) => rule.mode === 'known');
  expect(known).toHaveLength(1);
  expect(known[0]).toMatchObject({
    gate: { kind: 'level', value: 1 },
    usage: { kind: 'unspecified' },
    selection: { kind: 'choose', filter, count },
  });
  expect(rules(parsed).filter((rule) => rule.mode === 'prepared').length).toBeGreaterThanOrEqual(
    10,
  );
});

it('新增后续等级和同级无关法术不改变已有规则及资源组身份，JSON选择仍可对应', () => {
  const base = sample('Warlock', 'XPHB');
  const original = {
    ...base,
    raw: {
      additionalSpells: [
        {
          ability: 'int',
          known: { 1: [{ choose: 'level=0', count: 2 }] },
          innate: { 1: { daily: { 1: ['命令术'] } } },
        },
      ],
    },
  };
  const parsed = parseCatalogSpellGrants(original);
  const upgraded = parseCatalogSpellGrants({
    ...base,
    raw: {
      additionalSpells: [
        {
          ability: 'int',
          known: { 1: ['光亮术#c', { choose: 'level=0', count: 2 }], 5: ['鉴定术'] },
          innate: { 1: { daily: { 1: ['命令术', '疗伤术'] } }, 9: ['飞行术'] },
        },
      ],
    },
  });
  expect(parsed.blocks[0].identityStability).toBe('metadata');
  expect(upgraded.blocks[0].id).toBe(parsed.blocks[0].id);
  const choices = JSON.parse(
    JSON.stringify(Object.fromEntries(rules(parsed).map((rule) => [rule.id, ['saved-spell']]))),
  );
  for (const rule of rules(parsed)) {
    const updated = rules(upgraded).find((candidate) => candidate.id === rule.id);
    expect(updated?.resourceGroupId).toBe(rule.resourceGroupId);
    expect(choices[updated!.id]).toEqual(['saved-spell']);
  }
});

it('有名称的多个块重排和后续等级扩展仍保留各自身份', () => {
  const base = sample('Warlock', 'XPHB');
  const first = { name: '第一组', known: { 1: [{ choose: 'level=0' }] } };
  const second = { name: '第二组', known: { 1: [{ choose: 'level=0' }] } };
  const before = parseCatalogSpellGrants({ ...base, raw: { additionalSpells: [first, second] } });
  const after = parseCatalogSpellGrants({
    ...base,
    raw: { additionalSpells: [second, { ...first, known: { ...first.known, 5: ['命令术'] } }] },
  });
  for (const rule of rules(before))
    expect(rules(after).some((candidate) => candidate.id === rule.id)).toBe(true);
  expect(before.blocks.every((block) => block.identityStability === 'metadata')).toBe(true);
});

it('无法靠元数据区分的多个块保留内容身份，不能假称跨修订稳定', () => {
  const parsed = parseCatalogSpellGrants(sample('Astral Elf', 'AAG'));
  expect(parsed.blocks.every((block) => block.identityStability === 'content')).toBe(true);
  expect(new Set(parsed.blocks.map((block) => block.id)).size).toBe(3);
});

it('资源名称原样保留，不擅自推断容量和恢复；无效资源名仍阻止自动激活', () => {
  const base = sample('Warlock', 'XPHB');
  const parsed = parseCatalogSpellGrants({
    ...base,
    raw: {
      additionalSpells: [
        {
          resourceName: '功力',
          innate: { 3: { resource: { 2: ['黑暗术'] } } },
        },
      ],
    },
  });
  expect(parsed.diagnostics).toEqual([]);
  expect(parsed.blocks[0].resourceName).toBe('功力');
  expect(rules(parsed)[0].usage).toEqual({ kind: 'resource', key: '2' });
  const invalid = parseCatalogSpellGrants({
    ...base,
    raw: { additionalSpells: [{ resourceName: 3, known: { 1: ['命令术'] } }] },
  });
  expect(invalid.blocks[0].requiresReview).toBe(true);
  expect(invalid.diagnostics[0].code).toBe('invalid-resource-name');
});

it('未知嵌套结构仍诊断，不会将解锁等级或资源次数偷偷改成无限使用', () => {
  const parsed = parseCatalogSpellGrants({
    ...sample('Warlock', 'XPHB'),
    raw: {
      additionalSpells: [
        {
          known: { 1: { unknown: { _: ['命令术'] } } },
          innate: { 3: { daily: { 1: { _: ['鉴定术'] } } } },
        },
      ],
    },
  });
  expect(parsed.blocks[0].requiresReview).toBe(true);
  expect(rules(parsed)).toEqual([]);
  expect(parsed.diagnostics.map((diagnostic) => diagnostic.code)).toEqual([
    'unsupported-usage',
    'unsupported-usage',
  ]);
});
