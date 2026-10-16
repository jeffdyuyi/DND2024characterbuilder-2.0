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
