import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { InMemoryCatalogService } from '@/catalog/catalog';
import { normalizeClass, normalizeSubclass } from '@/source/fiveetools-cn/normalizers/class';
import type { CatalogEntry } from '@/catalog/types';
import { collectClassSpellGrantSources } from '../classSpellGrants';

function setup() {
  const catalog = new InMemoryCatalogService();
  const parent = normalizeClass({
    name: 'Wizard',
    source: 'PHB',
    classFeatures: ['Early|Wizard|PHB|1', 'Later|Wizard|PHB|5'],
    additionalSpells: [{ known: { 9: ['命令术'] } }],
  });
  const child = normalizeSubclass({
    name: 'Chosen',
    shortName: 'Chosen',
    source: 'PHB',
    className: 'Wizard',
    classSource: 'PHB',
    subclassFeatures: ['Child|Wizard|PHB|Chosen|PHB|3'],
    additionalSpells: [{ expanded: { s1: ['鉴定术'] } }],
  });
  const feature = (name: string, level: number, subclass = false): CatalogEntry => ({
    id: `test:${subclass ? 'subclassFeature' : 'classFeature'}:${name}`,
    kind: subclass ? 'subclassFeature' : 'classFeature',
    name,
    source: 'PHB',
    edition: '2014',
    sourcePackId: '5etools-cn',
    raw: {
      name,
      source: 'PHB',
      className: 'Wizard',
      classSource: 'PHB',
      level,
      ...(subclass ? { subclassShortName: 'Chosen', subclassSource: 'PHB' } : {}),
      additionalSpells: [{ known: { _: ['光亮术#c'] } }],
    },
  });
  const early = feature('Early', 1);
  const later = feature('Later', 5);
  const childFeature = feature('Child', 3, true);
  catalog.registerMany([parent, child, early, later, childFeature]);
  const selected = (level: number) => ({
    classId: parent.id,
    source: 'PHB',
    level,
    isMulticlass: false,
    subclassId: child.id,
  });
  return { catalog, parent, child, early, later, childFeature, selected };
}
const ids = (result: ReturnType<typeof collectClassSpellGrantSources>) =>
  result.sources.map((source) => source.grants.origin.id);

it('只收集已选择职业及解锁特性，保留上层法术等级门槛而不自动授予', () => {
  const { catalog, parent, early, selected } = setup();
  const result = collectClassSpellGrantSources({ classes: [selected(1)] }, catalog);
  expect(ids(result)).toEqual([parent.id, early.id]);
  expect(result.diagnostics).toEqual([]);
  expect(result.sources[0].grants.blocks[0].rules[0].gate).toMatchObject({
    kind: 'level',
    value: 9,
  });
  expect(result.sources[0].classLevel).toBe(1);
});

it('升级解锁子职业及特性，降级后移除来源，不修改角色或raw', () => {
  const { catalog, parent, early, later, child, childFeature, selected } = setup();
  const state = { classes: [selected(5)] };
  const original = JSON.stringify({ state, entries: catalog.list('class') });
  expect(ids(collectClassSpellGrantSources(state, catalog))).toEqual([
    parent.id,
    early.id,
    later.id,
    child.id,
    childFeature.id,
  ]);
  expect(JSON.stringify({ state, entries: catalog.list('class') })).toBe(original);
  expect(ids(collectClassSpellGrantSources({ classes: [selected(2)] }, catalog))).toEqual([
    parent.id,
    early.id,
  ]);
});

it('兼职各自查询子职业，不借用首职业的子职业，移除职业后不残留', () => {
  const { catalog, selected, parent, child } = setup();
  const other = normalizeClass({ name: 'Fighter', source: 'PHB' });
  catalog.register(other);
  const classes = [
    { classId: other.id, source: 'PHB', level: 10, isMulticlass: false },
    selected(3),
  ];
  const result = collectClassSpellGrantSources({ classes }, catalog);
  expect(ids(result)).toContain(child.id);
  expect(
    result.sources.every((source) => source.classId === parent.id && source.classLevel === 3),
  ).toBe(true);
  expect(collectClassSpellGrantSources({ classes: [classes[0]] }, catalog).sources).toEqual([]);
});

it('未选择、错父职业和未解锁子职业不进入来源', () => {
  const { catalog, selected, child } = setup();
  const wrong = normalizeSubclass({
    name: 'Wrong',
    source: 'PHB',
    className: 'Fighter',
    classSource: 'PHB',
  });
  catalog.register(wrong);
  const result = collectClassSpellGrantSources(
    { classes: [{ ...selected(5), subclassId: wrong.id }] },
    catalog,
  );
  expect(ids(result)).not.toContain(child.id);
  expect(ids(result)).not.toContain(wrong.id);
  expect(result.diagnostics.map((d) => d.code)).toContain('unresolved-subclass');
});

it('已保存来源保留，不套用候选书籍开关；同名不同来源不混用', () => {
  const { catalog, selected, early } = setup();
  catalog.register({ ...early, id: 'homebrew:feature:Early', sourcePackId: 'homebrew-test' });
  const result = collectClassSpellGrantSources({ classes: [selected(1)] }, catalog);
  expect(ids(result)).toContain(early.id);
  expect(ids(result)).not.toContain('homebrew:feature:Early');
});

it('歧义旧名称保持未解析，不按插入顺序选择版本', () => {
  const { catalog } = setup();
  catalog.register(normalizeClass({ name: 'Wizard', source: 'XPHB' }));
  const result = collectClassSpellGrantSources(
    { classes: [{ classId: 'Wizard', source: '', level: 5, isMulticlass: false }] },
    catalog,
  );
  expect(result.sources).toEqual([]);
  expect(result.diagnostics[0].code).toBe('unresolved-class');
});

it.each([0, -1, 1.5, NaN])('非法职业等级%s不会激活来源', (level) => {
  const { catalog, selected } = setup();
  const result = collectClassSpellGrantSources({ classes: [selected(level)] }, catalog);
  expect(result.sources).toEqual([]);
  expect(result.diagnostics[0].code).toBe('invalid-class-level');
});

it('未来等级缺失引用不误报当前缺失，当前缺失和无效引用进入诊断', () => {
  const { catalog, parent, selected } = setup();
  catalog.register({
    ...parent,
    raw: {
      ...parent.raw,
      classFeatures: ['Missing|Wizard|PHB|1', 'Future|Wizard|PHB|10', 'invalid', null],
    },
  });
  const result = collectClassSpellGrantSources(
    { classes: [{ ...selected(1), subclassId: undefined }] },
    catalog,
  );
  expect(result.diagnostics.map((d) => d.code)).toEqual([
    'invalid-feature-reference',
    'unresolved-feature',
    'invalid-feature-reference',
  ]);
});

it('同职业其他子职业的引用不能混入当前子职业', () => {
  const { catalog, child, childFeature, selected } = setup();
  const foreign = {
    ...childFeature,
    id: 'foreign:feature',
    raw: { ...childFeature.raw, subclassShortName: 'Foreign' },
  };
  catalog.register(foreign);
  catalog.register({
    ...child,
    raw: { ...child.raw, subclassFeatures: ['Child|Wizard|PHB|Foreign|PHB|3'] },
  });
  const result = collectClassSpellGrantSources({ classes: [selected(3)] }, catalog);
  expect(ids(result)).not.toContain(foreign.id);
  expect(ids(result)).not.toContain(child.id);
  expect(result.diagnostics.map((d) => d.code)).toContain('unresolved-subclass-unlock');
});

it('官方特性缺失时不能借用第三方同名特性', () => {
  const { catalog, parent, early, selected } = setup();
  const isolated = new InMemoryCatalogService();
  isolated.registerMany([
    parent,
    { ...early, id: 'homebrew:feature:Early', sourcePackId: 'homebrew-test' },
  ]);
  const result = collectClassSpellGrantSources(
    { classes: [{ ...selected(1), subclassId: undefined }] },
    isolated,
  );
  expect(ids(result)).toEqual([parent.id]);
  expect(result.diagnostics.map((d) => d.code)).toContain('mismatched-feature-pack');
});

it('存档职业来源与目录不一致时不静默换版本', () => {
  const { catalog, selected } = setup();
  const result = collectClassSpellGrantSources(
    { classes: [{ ...selected(1), source: 'XPHB' }] },
    catalog,
  );
  expect(result.sources).toEqual([]);
  expect(result.diagnostics[0].code).toBe('mismatched-class-source');
});

it('真实2024魔契师额外准备法术进入原生来源数据，不改成旧mechanics', () => {
  const fixture = JSON.parse(
    readFileSync('src/source/__fixtures__/fiveetools-cn/spell-grants.json', 'utf8'),
  );
  const raw = fixture.entries.find(
    (entry: any) => entry.raw.ENG_name === 'Warlock' && entry.raw.source === 'XPHB',
  ).raw;
  const catalog = new InMemoryCatalogService();
  const parent = normalizeClass(raw);
  catalog.register(parent);
  const result = collectClassSpellGrantSources(
    { classes: [{ classId: parent.id, source: 'XPHB', level: 9, isMulticlass: false }] },
    catalog,
  );
  expect(result.sources[0].grants.blocks[0].rules[0]).toMatchObject({
    mode: 'prepared',
    gate: { kind: 'level', value: 9 },
    selection: { kind: 'fixed', spell: { name: '异界探知', source: 'xphb' } },
  });
  expect(result.diagnostics).toEqual([]);
});
