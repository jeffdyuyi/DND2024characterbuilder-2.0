import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parseCatalogSpellGrants } from '@/catalog/adapters/spellGrants';
import { catalogEntryToSpell } from '@/catalog/adapters/spells';
import { normalizeSpell } from '@/source/fiveetools-cn/normalizers/spell';
import { normalizeFeat } from '@/source/fiveetools-cn/normalizers/feat';
import type { CatalogEntry } from '@/catalog/types';
import type { SpellGrantRule } from '@/types/spellGrant';
import { resolveSpellGrantCandidates } from '../spellGrantCandidates';

const fixture = JSON.parse(
  readFileSync('src/source/__fixtures__/fiveetools-cn/spell-grants.json', 'utf8'),
);
function sample(name: string, source: string) {
  const row = fixture.entries.find(
    (entry: any) => entry.raw.ENG_name === name && entry.raw.source === source,
  );
  const entry: CatalogEntry = {
    id: `5etools-cn:${source}:${row.kind}:${name}`,
    kind: row.kind,
    name: row.raw.name,
    englishName: name,
    source,
    sourcePackId: '5etools-cn',
    edition: '2014',
    raw: row.raw,
  };
  return parseCatalogSpellGrants(entry);
}
const spell = (
  name: string,
  level: number,
  classes: string[] = [],
  source = 'PHB',
  pack = '5etools-cn',
) => catalogEntryToSpell(normalizeSpell({ name, source, level, classes }, pack));
const origin = sample('Magic Initiate', 'PHB').origin;
const rule = (selection: SpellGrantRule['selection']): SpellGrantRule => ({
  id: 'test-rule',
  mode: 'known',
  gate: { kind: 'none', raw: '_' },
  usage: { kind: 'unspecified' },
  resourceGroupId: 'shared',
  selection,
  raw: selection,
});
const ref = (name: string, source = 'PHB', suffix?: string) => ({
  name,
  source,
  suffix,
  raw: `${name}|${source}${suffix ? `#${suffix}` : ''}`,
});

it('真实斯翠海文学徒的职业并集与环阶交集不增加选择数量或激活其他块', () => {
  const parsed = sample('Strixhaven Initiate', 'SCC');
  const selected = parsed.blocks.find((block) => block.nameEn === 'Lorehold 1')!;
  const choice = selected.rules.find((entry) => entry.selection.kind === 'choose')!;
  const cleric = spell('牧师一环', 1, ['牧师']);
  const wizard = spell('法师一环', 1, ['法师']);
  const both = spell('双职业', 1, ['法师', '牧师']);
  const pool = [
    cleric,
    wizard,
    both,
    spell('职业不符', 1, ['吟游诗人']),
    spell('戏法', 0, ['牧师']),
    spell('高环', 2, ['法师']),
  ];
  const before = JSON.stringify({ parsed, pool });
  expect(resolveSpellGrantCandidates(parsed.origin, choice, pool)).toEqual({
    spellIds: [cleric.id, wizard.id, both.id],
    diagnostics: [],
  });
  expect(choice.selection).toMatchObject({ kind: 'choose', count: 1 });
  expect(parsed.blocks).toHaveLength(15);
  expect(JSON.stringify({ parsed, pool })).toBe(before);
});

it('2014和2024原生魔法学徒分别解析，保留2个戏法与1个一环的规则身份', () => {
  for (const source of ['PHB', 'XPHB']) {
    const parsed = sample('Magic Initiate', source);
    const block = parsed.blocks.find((entry) => entry.nameEn === 'Cleric Spells')!;
    const cantrip = spell('牧师戏法', 0, ['牧师']);
    const first = spell('牧师法术', 1, ['牧师']);
    for (const entry of block.rules) {
      const expected = entry.mode === 'known' ? cantrip : first;
      expect(resolveSpellGrantCandidates(parsed.origin, entry, [cantrip, first]).spellIds).toEqual([
        expected.id,
      ]);
      expect(entry.selection).toMatchObject({ count: entry.mode === 'known' ? 2 : 1 });
    }
  }
});

it('明确引用限定书籍与包，戏法后缀不误选同名高环或其他版本', () => {
  const cantrip = spell('光亮术', 0);
  const pool = [
    cantrip,
    { ...spell('光亮术', 1), id: 'different-level-entry' },
    spell('光亮术', 0, [], 'XPHB'),
    spell('光亮术', 0, [], 'PHB', 'homebrew-x'),
  ];
  const grant = rule({ kind: 'fixed', spell: ref('光亮术', 'PHB', 'c') });
  expect(resolveSpellGrantCandidates(origin, grant, pool).spellIds).toEqual([cantrip.id]);
  expect(
    resolveSpellGrantCandidates(
      origin,
      grant,
      pool.filter((item) => item.id !== cantrip.id),
    ).spellIds,
  ).toEqual([]);
});

it('第三方引用优先自身包；跨书可引用官方，不借用其他第三方同名资源', () => {
  const custom = { ...origin, sourcePackId: 'homebrew-own', source: 'CUSTOM' };
  const own = spell('包内法术', 1, [], 'CUSTOM', 'homebrew-own');
  const other = spell('包内法术', 1, [], 'CUSTOM', 'homebrew-other');
  const official = spell('官方法术', 1);
  expect(
    resolveSpellGrantCandidates(custom, rule({ kind: 'fixed', spell: ref('包内法术', 'CUSTOM') }), [
      own,
      other,
    ]).spellIds,
  ).toEqual([own.id]);
  expect(
    resolveSpellGrantCandidates(custom, rule({ kind: 'fixed', spell: ref('包内法术', 'CUSTOM') }), [
      other,
    ]).spellIds,
  ).toEqual([]);
  expect(
    resolveSpellGrantCandidates(custom, rule({ kind: 'fixed', spell: ref('官方法术') }), [official])
      .spellIds,
  ).toEqual([official.id]);
});

it('未知条件、空条件及不支持后缀不给出宽泛候选', () => {
  const pool = [spell('任意', 1, ['法师'])];
  for (const filter of [
    'level=1|components=V',
    'level=1|school=unknown',
    'level=1|school=E;',
    'level=1|school=E|school=N',
    'level=1|',
    'class=',
    'level=1|class=法师;',
    'level=1|level=2',
    'level=1..3',
    'level=0;1',
    '',
  ]) {
    const result = resolveSpellGrantCandidates(
      origin,
      rule({ kind: 'choose', count: 1, filter }),
      pool,
    );
    expect(result.spellIds).toEqual([]);
    expect(result.diagnostics).toHaveLength(1);
  }
  expect(
    resolveSpellGrantCandidates(
      origin,
      rule({ kind: 'fixed', spell: ref('任意', 'PHB', 'unknown') }),
      pool,
    ).diagnostics[0].code,
  ).toBe('unsupported-spell-suffix');
});

it('在线原生入道专长的学派并集保持原筛选、环阶、次数与候选来源', () => {
  // 2026-10-16只读核对cn2.0/data/feats.json的additionalSpells字段；非运行时语料。
  const native = normalizeFeat({
    name: '黑袍入道',
    source: 'DSotDQ',
    additionalSpells: [
      {
        ability: { choose: ['int', 'wis', 'cha'] },
        innate: { _: { daily: { '1e': [{ choose: 'level=2|school=E;N' }] } } },
      },
    ],
  });
  const before = JSON.stringify(native);
  const parsed = parseCatalogSpellGrants(native);
  const grant = parsed.blocks[0].rules[0];
  const enchantment = { ...spell('惑控候选', 2), school: 'E' };
  const necromancy = { ...spell('死灵候选', 2), school: 'Necromancy' };
  const illusion = { ...spell('幻术非候选', 2), school: 'I' };
  const wrongLevel = { ...spell('其他环阶', 1), school: 'N' };
  const pool = [enchantment, necromancy, illusion, wrongLevel];
  expect(resolveSpellGrantCandidates(parsed.origin, grant, pool).spellIds).toEqual([
    enchantment.id,
    necromancy.id,
  ]);
  expect(resolveSpellGrantCandidates(parsed.origin, grant, [enchantment]).spellIds).toEqual([
    enchantment.id,
  ]);
  expect(grant.selection).toEqual({ kind: 'choose', count: 1, filter: 'level=2|school=E;N' });
  expect(grant.usage).toEqual({ kind: 'daily', key: '1e' });
  expect(JSON.stringify(native)).toBe(before);
});

it('学派与职业、环阶同时约束；未知学派不能被静默忽略', () => {
  const allowed = { ...spell('允许', 2, ['法师']), school: 'a' };
  const otherClass = { ...spell('其他职业', 2, ['牧师']), school: 'A' };
  const otherSchool = { ...spell('其他学派', 2, ['法师']), school: 'D' };
  expect(
    resolveSpellGrantCandidates(
      origin,
      rule({ kind: 'choose', count: 1, filter: 'school=Abjuration|class=法师|level=2' }),
      [allowed, otherClass, otherSchool],
    ).spellIds,
  ).toEqual([allowed.id]);
  const rejected = resolveSpellGrantCandidates(
    origin,
    rule({ kind: 'all', filter: 'level=2|school=A;unknown' }),
    [allowed],
  );
  expect(rejected.spellIds).toEqual([]);
  expect(rejected.diagnostics[0].code).toBe('unsupported-spell-filter');
});

it('多个不同ID同名同源时保持歧义，重复候选ID只计一次', () => {
  const first = spell('同名', 1);
  const second = { ...first, id: 'distinct-stable-id' };
  const grant = rule({ kind: 'fixed', spell: ref('同名') });
  expect(resolveSpellGrantCandidates(origin, grant, [first, first]).spellIds).toEqual([first.id]);
  const ambiguous = resolveSpellGrantCandidates(origin, grant, [first, second]);
  expect(ambiguous.spellIds).toEqual([]);
  expect(ambiguous.diagnostics[0].code).toBe('ambiguous-spell-reference');
});

it('all筛选仍只是候选，明确from列表独立解析，不从全局补回禁用法术', () => {
  const first = spell('已启用', 0, ['法师']);
  const second = spell('未启用', 0, ['法师']);
  expect(
    resolveSpellGrantCandidates(origin, rule({ kind: 'all', filter: 'level=0|class=法师' }), [
      first,
    ]).spellIds,
  ).toEqual([first.id]);
  const result = resolveSpellGrantCandidates(
    origin,
    rule({ kind: 'choose', count: 1, from: [ref(first.name), ref(second.name)] }),
    [first],
  );
  expect(result.spellIds).toEqual([first.id]);
  expect(result.diagnostics).toContainEqual({
    code: 'unresolved-spell-reference',
    reference: '未启用|PHB',
  });
});
