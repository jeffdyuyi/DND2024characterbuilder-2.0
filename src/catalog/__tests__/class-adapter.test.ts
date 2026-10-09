import { describe, it, expect } from 'vitest';
import { defaultCatalog } from '../catalog';
import { getCatalogClasses, getCatalogSubclasses, catalogEntryToClass } from '../adapters/classes';
import { getClassDefinition, getSubclassDefinition } from '@/engine/characterData';
import { normalizeClass, normalizeSubclass } from '@/source/fiveetools-cn/normalizers/class';
import { assembleCatalogClass, collectClassAssemblyDiagnostics } from '../adapters/classAssembly';
import { InMemoryCatalogService } from '../catalog';
import { makeEntryId } from '../identity';
import mesmerSample from '@/source/__fixtures__/homebrew/mesmer-class.sample.json';

describe('Catalog Class & Subclass Adapter Tests', () => {



  it('should prioritize 5etools class when registered into catalog', () => {
    const raw5eClass = {
      name: '测试战士',
      ENG_name: 'Test Fighter',
      source: 'XPHB',
      hd: { number: 1, faces: 10 },
      proficiency: ['str', 'con'],
      entries: ['这是一个来自5etools的职业测试描述。'],
    };

    const entry = normalizeClass(raw5eClass, '5etools-cn');
    defaultCatalog.register(entry);

    const def = getClassDefinition(entry.id);
    expect(def).toBeDefined();
    expect(def?.name).toBe('测试战士');
    expect(def?.hitPointDie).toBe(10);
    expect(def?.description).toContain('这是一个来自5etools的职业测试描述。');

    const allClasses = getCatalogClasses();
    const found = allClasses.find((c) => c.nameEn === 'Test Fighter');
    expect(found).toBeDefined();
  });

  it('将 2024 职业的属性、A/B/C 起始装备和兼职熟练归一化为页面契约', () => {
    const entry = normalizeClass({
      name: '战士', ENG_name: 'Fighter', source: 'XPHB',
      primaryAbility: [{ str: true }, { dex: true }],
      proficiency: ['str', 'con'],
      startingProficiencies: {
        skills: [{ choose: { from: ['athletics', 'perception'], count: 2 } }],
        weapons: ['简易', '军用'], armor: ['light', 'medium'],
      },
      startingEquipment: {
        defaultData: [{
          A: [{ item: '链甲|xphb' }, { item: '标枪|xphb', quantity: 8 }, { value: 400 }],
          B: [{ item: '镶钉皮甲|xphb' }, { item: '长弓|xphb' }, { value: 1100 }],
          C: [{ value: 15500 }],
        }],
        entries: ['{@i 选择A、B或C。}'],
      },
      multiclassing: { proficienciesGained: { weapons: ['军用'], armor: ['light', 'medium', 'shield'] } },
    }, '5etools-cn');

    const definition = catalogEntryToClass(entry);
    expect(definition.primaryAbility).toEqual(['str', 'dex']);
    expect(definition.startingEquipment.choiceA).toEqual([{
      options: ['链甲，8 标枪，4 GP', '镶钉皮甲，长弓，11 GP'],
    }]);
    expect(definition.startingEquipment.choiceB).toBe('155 GP');
    expect(definition.becomingAClass).toBeUndefined();
    expect(definition.multiclassProficiencies).toMatchObject({
      weapons: ['军用'], armor: ['light', 'medium', 'shield'],
    });
  });

  it('将 2014 起始装备的逐行选项和金币替代方案归一化', () => {
    const entry = normalizeClass({
      name: '旧版战士', ENG_name: 'Legacy Fighter', source: 'PHB',
      startingEquipment: {
        defaultData: [
          { a: ['链甲|phb'], b: ['皮甲|phb', '长弓|phb'] },
          { _: ['地城套组|phb'] },
        ],
        goldAlternative: '{@dice 5d4 × 10|5d4 × 10|起始金币}',
      },
    }, '5etools-cn');

    const definition = catalogEntryToClass(entry);
    expect(definition.startingEquipment.choiceA).toEqual([
      { options: ['链甲', '皮甲，长弓'] },
      '地城套组',
    ]);
    expect(definition.startingEquipment.choiceB).toBe('起始金币');
  });

  it('组装扩展职业引用、跨书源子职业，并按等级生成进度', () => {
    const catalog = new InMemoryCatalogService();
    const classEntry = normalizeClass({
      name: '星术师', ENG_name: 'Astrologer', source: 'COREX', hd: { faces: 8 },
      classFeatures: [
        '星象施法|Astrologer|COREX|1',
        { classFeature: '星路选择|Astrologer|COREX|2', gainSubclassFeature: true },
      ],
      classTableGroups: [{ rowsSpellProgression: [[2, 0], [3, 0]] }],
      cantripProgression: [2, 2],
    }, 'homebrew-tjliqy');
    const subclassEntry = normalizeSubclass({
      name: '月之道', ENG_name: 'Moon Path', shortName: 'Moon', source: 'EXPANSION',
      className: 'Astrologer', classSource: 'COREX',
      subclassFeatures: ['月辉|Astrologer|COREX|Moon|EXPANSION|2'],
    }, 'homebrew-tjliqy');
    catalog.register(classEntry);
    catalog.register(subclassEntry);

    const registerFeature = (kind: 'classFeature' | 'subclassFeature', raw: any) => catalog.register({
      id: makeEntryId({ packId: 'homebrew-tjliqy', kind, source: raw.source, name: raw.name, parent: raw.className, level: raw.level }),
      kind, name: raw.name, englishName: raw.ENG_name, source: raw.source, edition: '2014',
      sourcePackId: 'homebrew-tjliqy', isHomebrew: true, description: `${raw.name}说明`, raw,
    });
    registerFeature('classFeature', { name: '星象施法', className: 'Astrologer', classSource: 'COREX', source: 'COREX', level: 1 });
    registerFeature('classFeature', { name: '星路选择', className: 'Astrologer', classSource: 'COREX', source: 'COREX', level: 2 });
    registerFeature('subclassFeature', { name: '月辉', className: 'Astrologer', classSource: 'COREX', subclassShortName: 'Moon', subclassSource: 'EXPANSION', source: 'EXPANSION', level: 2 });

    const assembled = assembleCatalogClass(classEntry, catalog);
    expect(assembled.unresolvedReferences).toEqual([]);
    expect(assembled.features.map((feature) => feature.level)).toEqual([1, 2]);
    expect(assembled.progression[0].featuresUnlocked).toEqual(['星象施法']);
    expect(assembled.progression[1].spellcasting?.spellSlots.level1).toBe(3);
    expect(assembled.subclassUnlockLevel).toBe(2);
    expect(assembled.subclasses[0]).toMatchObject({ name: '月之道', source: 'EXPANSION' });
    expect(assembled.subclasses[0].traits[0]).toMatchObject({ name: '月辉', level: 2 });
  });

  it('通过固定修订的真实 Homebrew Mesmer 样本完成职业树组装', () => {
    const catalog = new InMemoryCatalogService();
    const classEntry = normalizeClass(mesmerSample.class[0], 'homebrew-tjliqy');
    catalog.register(classEntry);
    catalog.register(normalizeSubclass(mesmerSample.subclass[0], 'homebrew-tjliqy'));
    for (const [kind, records] of [
      ['classFeature', mesmerSample.classFeature],
      ['subclassFeature', mesmerSample.subclassFeature],
    ] as const) {
      for (const raw of records) {
        catalog.register({
          id: makeEntryId({ packId: 'homebrew-tjliqy', kind, source: raw.source, name: raw.name, parent: raw.className, level: raw.level }),
          kind, name: raw.name, source: raw.source, edition: '2014', sourcePackId: 'homebrew-tjliqy',
          isHomebrew: true, description: String(raw.entries[0]), raw,
        });
      }
    }
    const result = assembleCatalogClass(classEntry, catalog);
    expect(mesmerSample._provenance.revision).toHaveLength(40);
    expect(result.unresolvedReferences).toEqual([]);
    expect(result.features.map((feature) => feature.name)).toEqual(['Mesmer Casting', 'Mesmer Magic Tradition', 'Fast Casting']);
    expect(result.subclassUnlockLevel).toBe(1);
    expect(result.subclasses[0].traits.map((feature) => feature.level)).toEqual([1, 6]);
  });

  it('从职业特性规则文本解析专精选项，而不是按特性 ID 注入 Overlay', () => {
    const catalog = new InMemoryCatalogService();
    const rogueClass = normalizeClass({
      name: '游荡者', ENG_name: 'Rogue', source: 'XPHB', hd: { faces: 8 },
      classFeatures: ['专精|Rogue|XPHB|1'],
    }, '5etools-cn');

    catalog.register(rogueClass);
    catalog.register({
      id: makeEntryId({ packId: '5etools-cn', kind: 'classFeature', source: 'XPHB', name: 'Expertise', parent: 'Rogue', level: 1 }),
      kind: 'classFeature',
      name: '专精',
      englishName: 'Expertise',
      source: 'XPHB',
      edition: '2024',
      sourcePackId: '5etools-cn',
      raw: {
        name: '专精', ENG_name: 'Expertise', className: 'Rogue', classSource: 'XPHB', source: 'XPHB', level: 1,
        entries: ['Choose two of your skill proficiencies. You gain Expertise in the chosen skills.'],
      },
    });

    const assembled = assembleCatalogClass(rogueClass, catalog);
    const expertiseFeature = assembled.features.find(f => f.nameEn === 'Expertise' || f.name === '专精');
    expect(expertiseFeature).toBeDefined();
    expect(expertiseFeature?.mechanics?.choices).toBeDefined();
    const choices = expertiseFeature?.mechanics?.choices;
    expect(choices?.[0]).toMatchObject({
      type: 'expertise',
      numToChoose: 2,
      filter: 'proficient-skills',
    });
    expect(assembled.choiceDiagnostics).toEqual([]);
  });

  it('优先解析 AST options，并对无法识别类别的结构化选项保留通用分支诊断', () => {
    const catalog = new InMemoryCatalogService();
    const classEntry = normalizeClass({
      name: '测试武者', ENG_name: 'Test Adept', source: 'TEST',
      classFeatures: ['战斗训练|Test Adept|TEST|1'],
    }, 'homebrew-test');
    catalog.register(classEntry);
    catalog.register({
      id: makeEntryId({ packId: 'homebrew-test', kind: 'classFeature', source: 'TEST', name: 'Combat Training', parent: 'Test Adept', level: 1 }),
      kind: 'classFeature', name: '战斗训练', englishName: 'Combat Training', source: 'TEST', edition: 'both', sourcePackId: 'homebrew-test',
      raw: {
        name: '战斗训练', className: 'Test Adept', classSource: 'TEST', source: 'TEST', level: 1,
        entries: [{ type: 'options', count: 1, entries: [
          { type: 'refOptionalfeature', optionalfeature: 'Archery|TEST' },
          { type: 'refOptionalfeature', optionalfeature: 'Defense|TEST' },
        ] }],
      },
    });

    const assembled = assembleCatalogClass(classEntry, catalog);
    expect(assembled.features[0].mechanics?.choices?.[0]).toMatchObject({
      type: 'custom', numToChoose: 1, options: ['Archery', 'Defense'],
    });
    expect(assembled.choiceDiagnostics).toHaveLength(1);
    expect(assembled.choiceDiagnostics[0]).toContain('feature-choice-generic:');
  });

  it('汇总职业装配诊断时保留所属职业 ID', () => {
    const catalog = new InMemoryCatalogService();
    const classEntry = normalizeClass({
      name: 'Audit Class',
      source: 'TST',
      classFeatures: ['Missing Feature|Audit Class|TST|1'],
    });
    catalog.register(classEntry);

    const diagnostics = collectClassAssemblyDiagnostics(catalog);

    expect(diagnostics.unresolvedReferences).toEqual([
      `${classEntry.id}:classFeature:Missing Feature|Audit Class|TST|1`,
    ]);
    expect(diagnostics.choiceParsing).toEqual([]);
    expect(diagnostics.referenceFailures).toEqual([{
      ownerId: classEntry.id, parentClassId: classEntry.id, kind: 'classFeature',
      reference: 'Missing Feature|Audit Class|TST|1', referenceIndex: 0,
    }]);
  });

  it('正确解析并扁平化 5etools 复合对象型熟练项（如奇械师可选火器与德鲁伊盾牌）', async () => {
    const { translateProficiency } = await import('@/engine/terminology');
    const entry = normalizeClass({
      name: '奇械师',
      ENG_name: 'Artificer',
      source: 'TCE',
      startingProficiencies: {
        weapons: ['simple', { proficiency: 'firearms', optional: true }],
        armor: ['light', 'medium', { proficiency: 'shield', full: 'shields (druids will not wear metal)' }],
      },
    }, '5etools-cn');

    const definition = catalogEntryToClass(entry);
    expect(definition.proficiencies.weapons).toEqual(['simple', 'firearms（可选）']);
    expect(definition.proficiencies.armor).toEqual(['light', 'medium', 'shield']);

    // 验证翻译器正确处理可选后缀并翻译为规范中文
    const translatedWeapons = definition.proficiencies.weapons.map(translateProficiency);
    expect(translatedWeapons).toEqual(['简易武器', '火器（可选）']);

    const translatedArmor = definition.proficiencies.armor.map(translateProficiency);
    expect(translatedArmor).toEqual(['轻甲', '中甲', '盾牌']);

    // 验证翻译器防御性：直接传入 object、undefined 或 null 绝不崩溃
    expect(translateProficiency({ proficiency: 'firearms', optional: true })).toBe('火器（可选）');
    expect(translateProficiency(undefined)).toBe('');
    expect(translateProficiency(null)).toBe('');
    expect(translateProficiency({})).toBe('');
  });
});

