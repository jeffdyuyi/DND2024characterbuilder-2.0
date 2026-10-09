import { describe, expect, it } from 'vitest';
import { createClassAliases } from '../resolver/classAliases';
import { getEntryKeys, resolveEntries } from '../resolver/copy';

const classes = [{ name: '测试职业', ENG_name: 'Test Class', source: 'BOOK' }];
const base = { name: '测试道路', ENG_name: 'Test Path', shortName: '测试道路', source: 'EXPANSION', className: '测试职业', classSource: 'BOOK', entries: ['原始正文'] };
const target = { name: 'Test Path', shortName: 'Path', source: 'EXPANSION', className: 'Test Class', classSource: 'BOOK' };

describe('上游结构驱动的职业身份别名', () => {
  it('由唯一完整复制身份关联英文短名，继承正文且不改写输入记录', () => {
    const derived = { name: 'Adapted Path', shortName: 'Adapted', source: 'CUSTOM', className: 'Test Class', classSource: 'BOOK', _copy: target };
    const original = structuredClone([base, derived]);
    const aliases = createClassAliases(classes, [base, derived]);
    const pool = new Map(getEntryKeys(base).map(key => [key, base]));
    const result = resolveEntries<Record<string, any>>([derived], pool, aliases.matchesCopyScope);
    expect(result.warnings).toEqual([]);
    expect((result.resolved[0] as any).entries).toEqual(['原始正文']);
    expect((result.resolved[0] as any)._copyIdentity).toEqual(target);
    expect((result.resolved[0] as any)._copy).toBeUndefined();
    expect([base, derived]).toEqual(original);
  });

  it('同名多候选和不同父来源均不建立推测映射', () => {
    const duplicate = { ...base, shortName: '另一条道路' };
    const aliases = createClassAliases(classes, [base, duplicate, { _copy: target }]);
    expect(aliases.matchesCopyScope(base, target)).toBe(false);
    const unique = createClassAliases(classes, [base, { _copy: target }]);
    expect(unique.matchesCopyScope(base, { ...target, classSource: 'OTHER' })).toBe(false);
    expect(unique.matchesCopyScope({ ...base, subclassSource: 'ONE' }, { subclassSource: 'OTHER' })).toBe(false);
    const other = { ...base, name: '另一条道路', ENG_name: 'Other Path', shortName: 'Path' };
    const conflict = createClassAliases(classes, [base, other, { _copy: target }]);
    expect(conflict.matchesCopyScope(base, target)).toBe(false);
  });

  it('完整引用树与唯一同全名基础子职业相符时建立短名关系', () => {
    const features = [1, 6].map(level => ({ name: `特性${level}`, ENG_name: `Feature ${level}`, source: 'EXPANSION', className: '测试职业', classSource: 'BOOK', subclassShortName: '测试道路', subclassSource: 'EXPANSION', level }));
    const owner = { name: 'Test Path', shortName: 'Adapted', source: 'CUSTOM', className: 'Test Class', classSource: 'BOOK',
      subclassFeatures: ['Feature 1|Test Class|BOOK|Path|EXPANSION|1', 'Feature 6|Test Class|BOOK|Path|EXPANSION|6'] };
    const aliases = createClassAliases(classes, [base, owner], features);
    expect(aliases.subclassName('Path', 'Test Class', 'BOOK', 'EXPANSION')).toBe(aliases.subclassName('测试道路', '测试职业', 'BOOK', 'EXPANSION'));
    const missing = createClassAliases(classes, [base, owner], features.slice(0, 1));
    expect(missing.subclassName('Path', 'Test Class', 'BOOK', 'EXPANSION')).not.toBe(missing.subclassName('测试道路', '测试职业', 'BOOK', 'EXPANSION'));
  });

  it('失败的复制依赖保留原始目标和诊断，便于后续依赖修复', () => {
    const raw = { name: 'Derived', source: 'CUSTOM', _copy: { name: 'Missing', source: 'BOOK' } };
    const result = resolveEntries([raw]);
    expect(result.resolved[0]._copy).toEqual(raw._copy);
    expect(result.warnings[0].target).toEqual(raw._copy);
    expect(result.warnings[0].code).toBe('MISSING_COPY_SOURCE');
  });
});
