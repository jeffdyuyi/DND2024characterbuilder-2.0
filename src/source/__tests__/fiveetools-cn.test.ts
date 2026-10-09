import { describe, it, expect } from 'vitest';
import { resolveEntries } from '../resolver/copy';
import { clean5eTags, flattenEntries } from '../fiveetools-cn/utils';
import { normalizeSpell } from '../fiveetools-cn/normalizers/spell';
import { normalizeClass } from '../fiveetools-cn/normalizers/class';
import { FiveEToolsCnLoader } from '../fiveetools-cn/loader';
import { InMemoryCatalogService } from '@/catalog/catalog';

describe('5etools Resolver & Normalizer Tests', () => {
  it('should clean 5etools markup tags cleanly', () => {
    const raw1 = 'Deals {@damage 2d6} fire damage or {@dice 1d20+5}.';
    expect(clean5eTags(raw1)).toBe('Deals 2d6 fire damage or 1d20+5.');

    const raw2 = 'Gain a {@item shield|phb|Shield} and cast {@spell fireball}.';
    expect(clean5eTags(raw2)).toBe('Gain a Shield and cast fireball.');
  });

  it('should flatten nested entries into readable text', () => {
    const entries = [
      'First line of description.',
      {
        name: 'Feature Name',
        entries: ['Feature line 1', 'Feature line 2'],
      },
    ];
    const text = flattenEntries(entries);
    expect(text).toContain('First line of description.');
    expect(text).toContain('【Feature Name】');
    expect(text).toContain('Feature line 1');
  });

  it('should resolve _copy and _mod inheritance correctly', () => {
    const rawList = [
      {
        name: 'Base Spell',
        source: 'PHB',
        level: 1,
        entries: ['Original effect.'],
        components: { v: true },
      },
      {
        name: 'Variant Spell',
        source: 'XPHB',
        _copy: { name: 'Base Spell', source: 'PHB' },
        _mod: {
          entries: [
            {
              mode: 'appendArr',
              path: 'entries',
              items: ['Appended bonus effect.'],
            },
          ],
        },
      },
    ];

    const { resolved, warnings } = resolveEntries(rawList);
    expect(warnings.length).toBe(0);
    expect(resolved.length).toBe(2);

    const variant = resolved[1] as any;
    expect(variant.name).toBe('Variant Spell');
    expect(variant.level).toBe(1);
    expect(variant.components?.v).toBe(true);
    expect(variant.entries).toEqual(['Original effect.', 'Appended bonus effect.']);
  });

  it('should normalize 5etools-cn spell into standard SpellCatalogEntry', () => {
    const rawSpell = {
      name: '火球术',
      ENG_name: 'Fireball',
      source: 'XPHB',
      level: 3,
      school: 'V',
      time: [{ number: 1, unit: 'action' }],
      range: { type: 'point', distance: { type: 'feet', amount: 150 } },
      components: { v: true, s: true, m: '一小撮蝙蝠粪和硫磺' },
      duration: [{ type: 'instant' }],
      entries: ['一道明亮的光线从你的指尖射向目标点...'],
      classes: {
        fromClassList: [{ name: 'Wizard', source: 'XPHB' }, { name: 'Sorcerer', source: 'XPHB' }],
      },
    };

    const entry = normalizeSpell(rawSpell, '5etools-cn');
    expect(entry.id).toBe('5etools-cn:spell:xphb:fireball');
    expect(entry.name).toBe('火球术');
    expect(entry.englishName).toBe('Fireball');
    expect(entry.edition).toBe('2024');
    expect(entry.spell.level).toBe(3);
    expect(entry.spell.school).toBe('塑能');
    expect(entry.spell.castingTime).toBe('1 动作');
    expect(entry.spell.range).toBe('150 尺');
    expect(entry.spell.duration).toBe('立即');
    expect(entry.spell.classIds).toContain('wizard');
    expect(entry.spell.classIds).toContain('sorcerer');
  });

  it('should register and search entries in CatalogService', () => {
    const catalog = new InMemoryCatalogService();

    const spellEntry = normalizeSpell({
      name: '法师护甲',
      ENG_name: 'Mage Armor',
      source: 'PHB',
      level: 1,
      school: 'A',
      entries: ['触及一个未着装护甲的自愿生物...'],
    });

    const classEntry = normalizeClass({
      name: '法师',
      ENG_name: 'Wizard',
      source: 'XPHB',
      entries: ['施法者专家...'],
    });

    catalog.register(spellEntry);
    catalog.register(classEntry);

    expect(catalog.get(spellEntry.id)?.name).toBe('法师护甲');
    expect(catalog.list('spell').length).toBe(1);
    expect(catalog.list('class').length).toBe(1);

    const searchResults = catalog.search('mage');
    expect(searchResults.length).toBe(1);
    expect(searchResults[0].id).toBe(spellEntry.id);
  });

  it('loads and joins background and race fluff by name plus source', async () => {
    const catalog = new InMemoryCatalogService();
    const bodies: Record<string, any> = {
      'data/backgrounds.json': { background: [{ name: '测试继承人', ENG_name: 'Test Heir', source: 'XPHB', entries: ['机械摘要'] }] },
      'data/fluff-backgrounds.json': { backgroundFluff: [{ name: '测试继承人', ENG_name: 'Test Heir', source: 'XPHB', entries: ['背景故事原文'] }] },
      'data/races.json': { race: [{ name: '测试种族', ENG_name: 'Test Species', source: 'XPHB', entries: [{ name: '规则特质', entries: ['机械规则'] }] }] },
      'data/fluff-races.json': { raceFluff: [{ name: '测试种族', ENG_name: 'Test Species', source: 'XPHB', entries: ['种族设定原文'] }] },
    };
    const client = {
      id: 'test-pack', kind: '5etools-cn',
      fetchJson: async (path: string) => ({ body: bodies[path], revision: `${path}-revision`, cached: false, fetchedAt: 0 }),
    } as any;
    const loader = new FiveEToolsCnLoader(client, catalog);

    const [backgroundSummary, raceSummary] = await Promise.all([loader.loadBackgrounds(), loader.loadRaces()]);

    expect(backgroundSummary).toMatchObject({ count: 1, expectedFiles: 2, loadedFiles: 2, failedFiles: 0 });
    expect(raceSummary).toMatchObject({ count: 1, expectedFiles: 2, loadedFiles: 2, failedFiles: 0 });
    const background = catalog.list('background')[0];
    const race = catalog.list('race')[0];
    expect(background.description).toBe('背景故事原文');
    expect(race.description).toBe('种族设定原文');
    expect(background.entries).toEqual(['机械摘要']);
    expect(race.entries).toEqual([{ name: '规则特质', entries: ['机械规则'] }]);
    expect((background.raw as any)._fluffProvenance.path).toBe('data/fluff-backgrounds.json');
    expect((race.raw as any)._fluffProvenance.path).toBe('data/fluff-races.json');
  });

  it('loads base items and materializes magic variants', async () => {
    const catalog = new InMemoryCatalogService();
    const bodies: Record<string, any> = {
      'data/items-base.json': { baseitem: [{ name: 'Base Armor', source: 'PHB', type: 'LA', ac: 11 }] },
      'data/items.json': { item: [null, { name: 'Magic Armor', source: 'DMG', type: 'LA', ac: 12 }] },
      'data/magicvariants.json': { variant: [{ name: 'Magic Weapon Variant', source: 'DMG' }] },
    };
    const client = {
      id: 'test-pack',
      fetchJson: async (path: string) => {
        if (!bodies[path]) throw new Error(`missing ${path}`);
        return { body: bodies[path], revision: 'test', cached: false, fetchedAt: 0 };
      },
    } as any;

    const summary = await new FiveEToolsCnLoader(client, catalog).loadItems();
    expect(summary.count).toBe(5);
    expect(catalog.list('baseitem')).toHaveLength(1);
    expect(catalog.list('item')).toHaveLength(3);
    expect(catalog.list('magicvariant')).toHaveLength(1);
    expect(summary.warnings.some((warning) => warning.message.includes('非对象物品条目'))).toBe(true);
    expect(catalog.list('baseitem')[0].id).toContain(':baseitem:');
    expect(catalog.list('baseitem')[0]).toMatchObject({ revision: 'test' });
    expect((catalog.list('baseitem')[0].raw as any)._provenance.path).toBe('data/items-base.json');
    expect(catalog.list('magicvariant')[0].id).toContain(':magicvariant:');
  });

  it('loads every public character-option collection without inventing mechanics', async () => {
    const catalog = new InMemoryCatalogService();
    const bodies: Record<string, any> = {
      'data/optionalfeatures.json': { optionalfeature: [{ name: '契约选项', source: 'TCE', featureType: ['EI'], entries: ['原文'] }] },
      'data/charcreationoptions.json': { charoption: [{ name: '黑暗赠礼', source: 'VRGR', optionType: ['DG'], entries: ['原文'] }] },
      'data/rewards.json': { reward: [{ name: '祝福', source: 'DMG', type: 'Blessing', entries: ['原文'] }] },
      'data/cultsboons.json': { cult: [{ name: '教团', source: 'MTF', entries: ['原文'] }], boon: [{ name: '邪魔恩惠', source: 'MTF', type: 'Demonic', entries: ['原文'] }] },
    };
    const client = { id: 'test-pack', fetchJson: async (path: string) => ({ body: bodies[path] }) } as any;
    const summary = await new FiveEToolsCnLoader(client, catalog).loadCharacterOptions();
    expect(summary.count).toBe(5);
    expect(summary.loadedFiles).toBe(4);
    expect(catalog.list('optionalfeature')).toHaveLength(1);
    expect(catalog.list('charoption')[0].description).toBe('原文');
    expect(catalog.list('reward')[0].raw.type).toBe('Blessing');
    expect(catalog.list('boon')).toHaveLength(1);
    expect(catalog.list('cult')).toHaveLength(1);
  });

  it('loads mixed Homebrew target categories from manifest files', async () => {
    const catalog = new InMemoryCatalogService();
    const client = {
      id: 'homebrew-tjliqy', kind: 'homebrew',
      fetchJson: async () => ({ body: {
        race: [{ name: '扩展种族', source: 'HB', entries: ['原文'] }],
        background: [{ name: '扩展背景', source: 'HB', entries: ['原文'] }],
        feat: [{ name: '扩展专长', source: 'HB', entries: ['原文'] }],
        optionalfeature: [{ name: '扩展可选特性', source: 'HB', featureType: ['EI'], entries: ['原文'] }],
        reward: [{ name: '扩展祝福', source: 'HB', type: 'Blessing', entries: ['原文'] }],
      } }),
    } as any;
    const summary = await new FiveEToolsCnLoader(client, catalog).loadClassFiles(['collection/all.json']);
    expect(summary.count).toBe(5);
    expect(catalog.list('race')[0].isHomebrew).toBe(true);
    expect(catalog.list('background')).toHaveLength(1);
    expect(catalog.list('feat')).toHaveLength(1);
    expect(catalog.list('optionalfeature')).toHaveLength(1);
    expect(catalog.list('reward')).toHaveLength(1);
  });

  it('registers public subclass features from class files', async () => {
    const catalog = new InMemoryCatalogService();
    const client = {
      id: 'test-public',
      listIndexedFiles: async () => ['class-rogue.json'],
      fetchJson: async () => ({ body: {
        subclassFeature: [{ name: '使用魔法装置', ENG_name: 'Use Magic Device', source: 'XPHB',
          className: '游荡者', classSource: 'XPHB', subclassShortName: '盗贼', level: 13,
          entries: [{ name: '同调', entries: ['你最多可以同时同调于四个魔法物品。'] }] }],
      } }),
    } as any;
    await new FiveEToolsCnLoader(client, catalog).loadClasses();
    expect(catalog.list('subclassFeature')).toHaveLength(1);
    expect(catalog.list('subclassFeature')[0].sourcePackId).toBe('test-public');
  });

  it('resolves Homebrew class feature inheritance across files', async () => {
    const catalog = new InMemoryCatalogService();
    const bodies: Record<string, any> = {
      'class/base.json': { classFeature: [{ name: 'Shared Feature', source: 'BASE', className: 'Example', classSource: 'BASE', level: 1, entries: ['base text'] }] },
      'class/derived.json': { classFeature: [{ name: 'Derived Feature', source: 'EXT', className: 'Example', classSource: 'BASE', level: 2, _copy: { name: 'Shared Feature', source: 'BASE' } }] },
    };
    const client = {
      id: 'homebrew-tjliqy', kind: 'homebrew',
      fetchJson: async (path: string) => ({ body: bodies[path], revision: 'test', cached: false, fetchedAt: 0 }),
    } as any;
    const summary = await new FiveEToolsCnLoader(client, catalog).loadClassFiles(Object.keys(bodies));
    const derived = catalog.list('classFeature').find((entry) => entry.name === 'Derived Feature');
    expect(summary.warnings).toEqual([]);
    expect(derived?.description).toContain('base text');
    expect(derived?.isHomebrew).toBe(true);
  });

  it('uses the generated spell source lookup to attach versioned class grants', async () => {
    const catalog = new InMemoryCatalogService();
    const client = {
      id: '5etools-cn', kind: '5etools-cn',
      listIndexedFiles: async () => ['spells-test.json'],
      fetchJson: async (path: string) => {
        if (path.includes('gendata-spell-source-lookup')) return { body: {
          tst: { '测试飞弹': { class: { PHB: { 法师: true }, XPHB: { 法师: true } } } },
        } };
        return { body: { spell: [{ name: '测试飞弹', source: 'TST', level: 1 }] } };
      },
    } as any;
    const summary = await new FiveEToolsCnLoader(client, catalog).loadSpells();
    const spell = catalog.list('spell')[0] as any;
    expect(summary.failedFiles).toBe(0);
    expect(spell.spell.classGrants).toEqual([
      { name: '法师', source: 'PHB' },
      { name: '法师', source: 'XPHB' },
    ]);
  });

  describe('P0-A: Real Magic Variant Copy-Mod & Multilevel Inheritance', () => {
    // 真实样本数据提取自 5etools-cn 仓库 data/magicvariants.json (cn2.0 分支)
    // 提取日期: 2026-09-25
    it('correctly resolves _copy._mod on Regal Breastplate of the Tyrant (*)', () => {
      const baseArmor = {
        name: '心灵抗性护甲',
        ENG_name: 'Armor of Psychic Resistance',
        type: 'GV|XDMG',
        inherits: {
          namePrefix: '心灵抗性',
          source: 'XDMG',
          page: 231,
          srd52: true,
          basicRules2024: true,
          resist: ['心灵'],
          rarity: 'rare',
          reqAttune: true,
          entries: ['{#itemEntry 抗性护甲|XDMG}'],
        },
      };

      const regalArmorVariant = {
        name: '君威暴君胸甲 (*)',
        ENG_name: 'Regal Breastplate of the Tyrant (*)',
        source: 'AU',
        _copy: {
          name: '心灵抗性护甲',
          ENG_name: 'Armor of Psychic Resistance',
          source: 'XDMG',
          _mod: {
            'inherits.basicRules2024': 'remove',
            'inherits.srd52': 'remove',
            'inherits.namePrefix': { mode: 'setProp', value: '君威暴君' },
            'inherits.nameSuffix': { mode: 'setProp', value: '' },
            'inherits.page': { mode: 'setProp', value: 132 },
            'inherits.propertyAdd': { mode: 'appendIfNotExistsArr', items: 'Evo|AU' },
            'inherits.rarity': { mode: 'setProp', value: '极珍稀' },
            'inherits.source': { mode: 'setProp', value: 'AU' },
            'inherits.entries': {
              mode: 'appendArr',
              items: {
                name: '君威',
                ENG_name: 'Regal',
                type: 'entries',
                entries: ['当角色们前往一处古战场时，护甲进化获得君威词条。'],
              },
            },
          },
        },
        requires: [{ name: '胸甲', ENG_name: 'Breastplate', source: 'XPHB' }],
      };

      const { resolved, warnings } = resolveEntries([baseArmor, regalArmorVariant]);
      expect(warnings).toEqual([]);
      expect(resolved).toHaveLength(2);

      const resolvedRegal = resolved[1] as any;
      expect(resolvedRegal.name).toBe('君威暴君胸甲 (*)');
      expect(resolvedRegal.ENG_name).toBe('Regal Breastplate of the Tyrant (*)');
      expect(resolvedRegal.source).toBe('AU');
      expect(resolvedRegal.inherits.namePrefix).toBe('君威暴君');
      expect(resolvedRegal.inherits.nameSuffix).toBe('');
      expect(resolvedRegal.inherits.rarity).toBe('极珍稀');
      expect(resolvedRegal.inherits.source).toBe('AU');
      expect(resolvedRegal.inherits.basicRules2024).toBeUndefined();
      expect(resolvedRegal.inherits.srd52).toBeUndefined();
      expect(resolvedRegal.inherits.propertyAdd).toEqual(['Evo|AU']);
      expect(resolvedRegal.inherits.resist).toEqual(['心灵']);
      expect(resolvedRegal.inherits.entries).toHaveLength(2);
      expect(resolvedRegal.inherits.entries[0]).toBe('{#itemEntry 抗性护甲|XDMG}');
      expect(resolvedRegal.inherits.entries[1].name).toBe('君威');
    });

    it('resolves 3-level chain inheritance across weapon variants (Weapon of Warning -> Studious -> Resistant -> All-Seeing)', () => {
      const baseWarning = {
        name: '警戒武器',
        ENG_name: 'Weapon of Warning',
        type: 'GV|XDMG',
        inherits: {
          namePrefix: '警戒',
          source: 'XDMG',
          rarity: 'uncommon',
          reqAttune: true,
          entries: ['只要这件武器在你触手可及的范围内，你在先攻检定上具有优势。'],
        },
      };

      const studiousBlade = {
        name: '博识卫护之刃',
        ENG_name: 'Studious Blade of the Guardian',
        source: 'AU',
        _copy: {
          name: '警戒武器',
          ENG_name: 'Weapon of Warning',
          source: 'XDMG',
          _mod: {
            'inherits.namePrefix': { mode: 'setProp', value: '博识卫护' },
            'inherits.rarity': { mode: 'setProp', value: '珍稀' },
            'inherits.source': { mode: 'setProp', value: 'AU' },
            'inherits.propertyAdd': { mode: 'appendIfNotExistsArr', items: 'Evo|AU' },
            'inherits.entries': {
              mode: 'appendArr',
              items: { name: '博识', entries: ['武器进化为珍稀并获得博识词条。'] },
            },
          },
        },
        requires: [{ name: '巨剑', source: 'XPHB' }],
      };

      const resistantBlade = {
        name: '抗性卫护之刃',
        ENG_name: 'Resistant Blade of the Guardian',
        source: 'AU',
        _copy: {
          name: '博识卫护之刃',
          ENG_name: 'Studious Blade of the Guardian',
          source: 'AU',
          _mod: {
            'inherits.namePrefix': { mode: 'setProp', value: '抗性卫护' },
            'inherits.rarity': { mode: 'setProp', value: '极珍稀' },
            'inherits.resist': { mode: 'appendIfNotExistsArr', items: '火焰' },
            'inherits.entries': {
              mode: 'appendArr',
              items: { name: '抗性', entries: ['武器再次进化获得火焰抗性。'] },
            },
          },
        },
      };

      const allSeeingBlade = {
        name: '全视卫护之刃',
        ENG_name: 'All-Seeing Blade of the Guardian',
        source: 'AU',
        _copy: {
          name: '抗性卫护之刃',
          ENG_name: 'Resistant Blade of the Guardian',
          source: 'AU',
          _mod: {
            'inherits.namePrefix': { mode: 'setProp', value: '全视卫护' },
            'inherits.rarity': { mode: 'setProp', value: '传说' },
            'inherits.entries': {
              mode: 'appendArr',
              items: { name: '全视', entries: ['武器最后进化成为传说物品。'] },
            },
          },
        },
      };

      // 测试乱序排列输入，检验 DAG 递归解析
      const { resolved, warnings } = resolveEntries([allSeeingBlade, studiousBlade, resistantBlade, baseWarning]);
      expect(warnings).toEqual([]);

      const allSeeing = resolved.find((r) => r.name === '全视卫护之刃') as any;
      expect(allSeeing).toBeDefined();
      expect(allSeeing.inherits.namePrefix).toBe('全视卫护');
      expect(allSeeing.inherits.rarity).toBe('传说');
      expect(allSeeing.inherits.source).toBe('AU');
      expect(allSeeing.inherits.propertyAdd).toEqual(['Evo|AU']);
      expect(allSeeing.inherits.resist).toEqual(['火焰']);
      expect(allSeeing.inherits.entries).toHaveLength(4);
      expect(allSeeing.inherits.entries[0]).toContain('先攻检定上具有优势');
      expect(allSeeing.inherits.entries[1].name).toBe('博识');
      expect(allSeeing.inherits.entries[2].name).toBe('抗性');
      expect(allSeeing.inherits.entries[3].name).toBe('全视');
    });

    it('detects cyclic inheritance without infinite recursion and warns cleanly', () => {
      const cycleA = {
        name: 'Cyclic A',
        source: 'TEST',
        _copy: { name: 'Cyclic B', source: 'TEST' },
      };
      const cycleB = {
        name: 'Cyclic B',
        source: 'TEST',
        _copy: { name: 'Cyclic A', source: 'TEST' },
      };

      const { resolved, warnings } = resolveEntries([cycleA, cycleB]);
      expect(warnings.some((w) => w.code === 'RESOLVE_ERROR' && w.message.includes('循环继承引用'))).toBe(true);
      expect(resolved).toHaveLength(2);
    });

    it('materializes Regal Breastplate onto Breastplate base item with accurate propertyAdd and rarity', async () => {
      const catalog = new InMemoryCatalogService();
      const bodies: Record<string, any> = {
        'data/items-base.json': {
          baseitem: [
            {
              name: '胸甲',
              ENG_name: 'Breastplate',
              source: 'XPHB',
              type: 'MA',
              ac: 14,
              property: ['S'],
              entries: ['一副合身的金属胸甲。'],
            },
          ],
        },
        'data/items.json': { item: [] },
        'data/magicvariants.json': {
          variant: [
            {
              name: '君威暴君胸甲 (*)',
              ENG_name: 'Regal Breastplate of the Tyrant (*)',
              source: 'AU',
              type: 'GV|AU',
              requires: [{ name: '胸甲', source: 'XPHB' }],
              inherits: {
                namePrefix: '君威暴君',
                rarity: '极珍稀',
                source: 'AU',
                propertyAdd: ['Evo|AU'],
                entries: ['具有暴君威仪。'],
              },
            },
          ],
        },
      };

      const client = {
        id: '5etools-cn',
        fetchJson: async (path: string) => ({ body: bodies[path], revision: 'p0a-test', cached: false, fetchedAt: 0 }),
      } as any;

      const summary = await new FiveEToolsCnLoader(client, catalog).loadItems();
      expect(summary.warnings).toEqual([]);

      const items = catalog.list('item');
      const regalInstance = items.find((item) => item.name === '君威暴君胸甲');
      expect(regalInstance).toBeDefined();
      expect(regalInstance?.source).toBe('AU');
      expect(regalInstance?.raw.rarity).toBe('极珍稀');
      expect(regalInstance?.raw.properties).toContain('S');
      expect(regalInstance?.raw.properties).toContain('Evo|AU');
      expect(regalInstance?.description).toContain('一副合身的金属胸甲。');
      expect(regalInstance?.description).toContain('具有暴君威仪。');
    });
  });
});
