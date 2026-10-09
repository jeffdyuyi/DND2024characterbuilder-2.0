import { describe, it, expect, vi } from 'vitest';
import { InMemoryCatalogService, defaultCatalog } from '../catalog';
import { getCatalogSubclasses } from '../adapters/classes';
import { CatalogEntry } from '../types';
import { assembleCatalogClass } from '../adapters/classAssembly';
import { normalizeClass, normalizeSubclass } from '@/source/fiveetools-cn/normalizers/class';
import { FiveEToolsCnLoader } from '@/source/fiveetools-cn/loader';
import { makeEntryId } from '../identity';
import { classContentParent } from '../classIdentity';
import { resolveCatalogReference } from '../references';
import { resolveEntries, getEntryKeys } from '@/source/resolver/copy';
import sample from '@/source/__fixtures__/fiveetools-cn/barbarian-class.json';

const feature = (raw: Record<string, any>, pack = '5etools-cn'): CatalogEntry => ({
  id: makeEntryId({
    packId: pack,
    kind: raw.subclassShortName ? 'subclassFeature' : 'classFeature',
    source: raw.source,
    name: raw.ENG_name || raw.name,
    parent: classContentParent(raw, true),
    level: raw.level,
  }),
  kind: raw.subclassShortName ? 'subclassFeature' : 'classFeature',
  name: raw.name,
  englishName: raw.ENG_name,
  source: raw.source,
  sourcePackId: pack,
  edition: 'both',
  raw,
});

describe('5etools 职业引用与父来源完整性', () => {
  it('子职业检索按父规则版本筛选，保留旧出版物对新父职业的显式适配', () => {
    const old = normalizeClass({ name: '检索测试', ENG_name: 'Lookup Test Class', source: 'PHB' });
    const modern = normalizeClass({
      name: '检索测试',
      ENG_name: 'Lookup Test Class',
      source: 'XPHB',
    });
    const oldChild = normalizeSubclass({
      name: 'Lookup Path',
      source: 'PHB',
      className: 'Lookup Test Class',
      classSource: 'PHB',
    });
    const modernChild = normalizeSubclass({
      name: 'Lookup Path',
      source: 'PHB',
      className: 'Lookup Test Class',
      classSource: 'XPHB',
    });
    [old, modern, oldChild, modernChild].forEach((entry) => defaultCatalog.register(entry));
    expect(getCatalogSubclasses(modern.id, { edition: '2024' }).map((entry) => entry.id)).toEqual([
      modernChild.id,
    ]);
    expect(
      getCatalogSubclasses('检索测试', { parentSource: 'PHB' }).map((entry) => entry.id),
    ).toEqual([oldChild.id]);
    expect(getCatalogSubclasses('Lookup Test', { parentSource: 'PHB' })).toEqual([]);
  });
  it('真实分卷经加载、继承、Catalog 和装配：双版本及全部子职业引用不丢失、不互相覆盖', async () => {
    const catalog = new InMemoryCatalogService();
    const client = {
      id: '5etools-cn',
      kind: 'official',
      subscribeRefresh: vi.fn(),
      listIndexedFiles: vi.fn().mockResolvedValue(['class-barbarian.json']),
      fetchJson: vi.fn().mockResolvedValue({ body: sample, revision: sample._provenance.revision }),
    };
    const summary = await new FiveEToolsCnLoader(client as any, catalog).loadClasses();
    expect(summary.failedFiles).toBe(0);
    expect(summary.warnings).toEqual([]);
    expect(catalog.list('subclass')).toHaveLength(sample.subclass.length);
    expect(catalog.list('classFeature')).toHaveLength(sample.classFeature.length);
    expect(catalog.list('subclassFeature')).toHaveLength(sample.subclassFeature.length);
    expect(sample._provenance.revision).toHaveLength(40);
    for (const parent of catalog.list('class')) {
      const assembled = assembleCatalogClass(parent, catalog);
      expect(assembled.unresolvedReferences).toEqual([]);
      expect(assembled.features).toHaveLength((parent.raw.classFeatures as unknown[]).length);
      const expected = sample.subclass.filter((child) => child.classSource === parent.source);
      expect(assembled.subclasses).toHaveLength(expected.length);
      for (const child of assembled.subclasses) {
        const registered = catalog.get(child.catalogId!)!;
        expect(registered.raw.classSource).toBe(parent.source);
        expect(child.traits).toHaveLength((registered.raw.subclassFeatures as unknown[]).length);
      }
    }
  });

  it('中英文别名来自职业记录；末尾特性来源和显示文本参与正确解析', () => {
    const catalog = new InMemoryCatalogService();
    const parent = normalizeClass({
      name: '测试职业',
      ENG_name: 'Test Class',
      source: 'PARENT',
      classFeatures: ['Feature|测试职业|PARENT|1|BOOK|显示文本'],
    });
    catalog.register(parent);
    catalog.register(
      feature({
        name: '特性',
        ENG_name: 'Feature',
        className: 'Test Class',
        classSource: 'PARENT',
        source: 'BOOK',
        level: 1,
      }),
    );
    catalog.register(
      feature({
        name: '特性',
        ENG_name: 'Feature',
        className: 'Test Class',
        classSource: 'PARENT',
        source: 'OTHER',
        level: 1,
      }),
    );
    const result = assembleCatalogClass(parent, catalog);
    expect(result.unresolvedReferences).toEqual([]);
    expect(result.features[0].source).toBe('BOOK');
  });

  it('同来源多包歧义安全保留诊断；显式来源缺失不降级到另一书源', () => {
    const catalog = new InMemoryCatalogService();
    const parent = normalizeClass(
      {
        name: 'Class',
        source: 'PARENT',
        classFeatures: ['Feature|Class|PARENT|1|BOOK', 'Feature|Class|PARENT|1|MISSING'],
      },
      'owner',
    );
    catalog.register(parent);
    for (const pack of ['one', 'two'])
      catalog.register(
        feature(
          { name: 'Feature', className: 'Class', classSource: 'PARENT', source: 'BOOK', level: 1 },
          pack,
        ),
      );
    expect(assembleCatalogClass(parent, catalog).features).toEqual([]);
    expect(assembleCatalogClass(parent, catalog).unresolvedReferences).toHaveLength(2);
  });

  it('跨书源子职业按父来源归属；空父来源按 UID schema 默认 PHB', () => {
    const catalog = new InMemoryCatalogService();
    const old = normalizeClass({ name: '职业', ENG_name: 'Class', source: 'PHB' });
    const modern = normalizeClass({ name: '职业', ENG_name: 'Class', source: 'XPHB' });
    catalog.register(old);
    catalog.register(modern);
    catalog.register(
      normalizeSubclass({
        name: '扩展',
        source: 'EXPANSION',
        className: 'Class',
        classSource: 'XPHB',
      }),
    );
    catalog.register(normalizeSubclass({ name: '默认', source: 'EXPANSION', className: 'Class' }));
    expect(assembleCatalogClass(old, catalog).subclasses.map((child) => child.name)).toEqual([
      '默认',
    ]);
    expect(assembleCatalogClass(modern, catalog).subclasses.map((child) => child.name)).toEqual([
      '扩展',
    ]);
  });

  it('旧子职业 ID 依据父来源迁移；已存的异版本稳定 ID 不自动替换', () => {
    const catalog = new InMemoryCatalogService();
    const old = normalizeSubclass({
      name: 'Path',
      source: 'BOOK',
      className: 'Class',
      classSource: 'PHB',
    });
    const modern = normalizeSubclass({
      name: 'Path',
      source: 'BOOK',
      className: 'Class',
      classSource: 'XPHB',
    });
    catalog.register(old);
    catalog.register(modern);
    const legacyId = makeEntryId({
      packId: old.sourcePackId,
      kind: old.kind,
      name: 'Path',
      source: 'BOOK',
      parent: 'Class',
    });
    expect(resolveCatalogReference(catalog, legacyId, ['subclass'])).toBeUndefined();
    expect(
      resolveCatalogReference(catalog, legacyId, ['subclass'], {
        parentSource: 'XPHB',
        parentNames: ['Class'],
      })?.id,
    ).toBe(modern.id);
    expect(
      resolveCatalogReference(catalog, old.id, ['subclass'], { parentSource: 'XPHB' }),
    ).toBeUndefined();
  });

  it('子职业特性自身来源独立于子职业出版物，末尾来源不被忽略', () => {
    const catalog = new InMemoryCatalogService();
    const parent = normalizeClass({ name: 'Class', source: 'PARENT' });
    catalog.register(parent);
    catalog.register(
      normalizeSubclass({
        name: 'Path',
        shortName: 'Path',
        source: 'SUB',
        className: 'Class',
        classSource: 'PARENT',
        subclassFeatures: ['Gift|Class|PARENT|Path|SUB|3|FEATUREBOOK|显示'],
      }),
    );
    catalog.register(
      feature({
        name: 'Gift',
        source: 'FEATUREBOOK',
        className: 'Class',
        classSource: 'PARENT',
        subclassShortName: 'Path',
        subclassSource: 'SUB',
        level: 3,
      }),
    );
    catalog.register(
      feature({
        name: 'Gift',
        source: 'SUB',
        className: 'Class',
        classSource: 'PARENT',
        subclassShortName: 'Path',
        subclassSource: 'SUB',
        level: 3,
      }),
    );
    const result = assembleCatalogClass(parent, catalog);
    expect(result.unresolvedReferences).toEqual([]);
    expect(result.subclasses[0].traits[0].source).toBe('FEATUREBOOK');
  });

  it('跨文件复制按完整父身份定位；省略父身份遇多候选时不猜测', () => {
    const old = {
      name: 'Path',
      source: 'BOOK',
      shortName: 'Path',
      className: 'Class',
      classSource: 'PHB',
      entries: ['old'],
    };
    const modern = { ...old, classSource: 'XPHB', entries: ['modern'] };
    const pool = new Map<string, any>();
    for (const record of [old, modern])
      for (const key of getEntryKeys(record)) pool.set(key, record);
    const explicit = resolveEntries(
      [
        {
          name: 'Derived',
          source: 'OTHER',
          className: 'Class',
          classSource: 'XPHB',
          _copy: {
            name: 'Path',
            source: 'BOOK',
            shortName: 'Path',
            className: 'Class',
            classSource: 'XPHB',
          },
        },
      ],
      pool,
    );
    expect(explicit.warnings).toEqual([]);
    expect((explicit.resolved[0] as any).entries).toEqual(['modern']);
    const ambiguous = resolveEntries(
      [{ name: 'Unknown', source: 'OTHER', _copy: { name: 'Path', source: 'BOOK' } }],
      pool,
    );
    expect(ambiguous.warnings.some((warning) => warning.message.includes('候选'))).toBe(true);
    expect((ambiguous.resolved[0] as any).entries).toBeUndefined();
  });
});
