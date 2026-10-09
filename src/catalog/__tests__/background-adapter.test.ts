import { describe, it, expect } from 'vitest';
import { defaultCatalog } from '../catalog';
import { getCatalogBackgrounds, catalogEntryToBackground } from '../adapters/backgrounds';
import { getBackgroundDefinition } from '@/engine/characterData';
import { normalizeBackground } from '@/source/fiveetools-cn/normalizers/background';
import { CharacterState } from '@/types/characterState';

describe('Catalog Background Adapter Tests', () => {



  it('should prioritize 5etools background when registered into catalog', () => {
    const raw5eBg = {
      name: '测试背景',
      ENG_name: 'Test Background',
      source: 'XPHB',
      ability: [{ str: true, con: true }],
      skills: ['athletics', 'survival'],
      entries: ['这是一个来自5etools的背景测试描述。'],
    };

    const entry = normalizeBackground(raw5eBg, '5etools-cn');
    defaultCatalog.register(entry);

    const dummyState = { backgroundId: entry.id } as CharacterState;
    const def = getBackgroundDefinition(dummyState);
    expect(def).toBeDefined();
    expect(def?.name).toBe('测试背景');
    expect(def?.skillProficiencies).toContain('athletics');
    expect(def?.description).toContain('这是一个来自5etools的背景测试描述。');

    const all = getCatalogBackgrounds();
    const found = all.find((b) => b.id === entry.id);
    expect(found).toBeDefined();
  });

  it('uses fluff as display description while preserving mechanical entries', () => {
    const mechanicalEntries = ['【属性值】力量、体质、魅力', '【专长】异种龙纹'];
    const entry = normalizeBackground({
      name: '畸变继承人', ENG_name: 'Aberrant Heir', source: 'EFA', entries: mechanicalEntries,
      fluff: { name: '畸变继承人', ENG_name: 'Aberrant Heir', source: 'EFA', entries: ['你的异种龙纹自显现以来就让生活充满挑战。'] },
    });

    expect(catalogEntryToBackground(entry).description).toBe('你的异种龙纹自显现以来就让生活充满挑战。');
    expect(entry.entries).toEqual(mechanicalEntries);
  });

  it('adapts real 2024 background proficiency, feat and ability shapes', () => {
    const entry = normalizeBackground({
      name: '测试侍僧', ENG_name: 'Test Acolyte', source: 'XPHB',
      ability: [{ choose: { weighted: { from: ['int', 'wis', 'cha'], weights: [2, 1] } } }],
      feats: [{ '魔法学徒；牧师|xphb': true }], skillProficiencies: [{ insight: true, religion: true }],
      toolProficiencies: [{ "calligrapher's supplies": true }], languageProficiencies: [{ anyStandard: 2 }],
      startingEquipment: [{ A: [{ item: '书籍|xphb' }, { value: 800 }], B: [{ value: 5000 }] }],
    }, 'test');
    const background = catalogEntryToBackground(entry);
    expect(background.abilityScoreOptions).toEqual(['INT', 'WIS', 'CHA']);
    expect(background.feat?.name).toBe('魔法学徒；牧师');
    expect(background.skillProficiencies).toEqual(['insight', 'religion']);
    expect(background.toolProficiencies).toEqual(["calligrapher's supplies"]);
    expect(background.languages?.[0]).toMatchObject({ numToChoose: 2 });
    expect(background.equipment.choiceA).toContain('书籍');
    expect(background.equipment.choiceB).toBe('50 GP');
  });

  it('expands tool categories (artisan tools, gaming sets, musical instruments) into concrete options', () => {
    // 模拟 2024 工匠 (Guild Artisan) 拥有工匠工具自选与单项标准语言自选
    const artisanEntry = normalizeBackground({
      name: '工匠', ENG_name: 'Artisan', source: 'XPHB',
      toolProficiencies: [{ "artisan's tools": true }],
      languageProficiencies: [{ anyStandard: 1 }],
    }, '5etools-cn');
    const artisanBg = catalogEntryToBackground(artisanEntry);

    // 应该将工匠工具展开为具体的选择槽
    expect(artisanBg.toolProficiencies![0]).toMatchObject({
      name: '工匠工具自选',
      numToChoose: 1,
    });
    const toolOptions = (artisanBg.toolProficiencies![0] as any).options;
    expect(toolOptions).toContain("smith's tools");
    expect(toolOptions).toContain("leatherworker's tools");
    expect(toolOptions.length).toBe(17);

    // 语言应该为标准语言自选槽，包含 options: ['Any']
    expect(artisanBg.languages?.[0]).toMatchObject({
      name: '标准语言自选',
      numToChoose: 1,
      options: ['Any'],
    });

    // 模拟 2024 贵族拥有游戏套件自选
    const nobleEntry = normalizeBackground({
      name: '贵族', ENG_name: 'Noble', source: 'XPHB',
      toolProficiencies: [{ "gaming set": true }],
    }, '5etools-cn');
    const nobleBg = catalogEntryToBackground(nobleEntry);
    expect(nobleBg.toolProficiencies![0]).toMatchObject({
      name: '赌具自选',
      numToChoose: 1,
    });
    const gamingOptions = (nobleBg.toolProficiencies![0] as any).options;
    expect(gamingOptions).toContain('dice set');
    expect(gamingOptions).toContain('dragonchess set');

    // 模拟 2014 复合选择：工匠工具或乐器任选 1 种
    const compositeEntry = normalizeBackground({
      name: '民俗艺人', ENG_name: 'Folk Entertainer', source: 'PHB',
      toolProficiencies: [{ choose: { from: ["artisan's tools", "musical instrument"], count: 1 } }],
    }, '5etools-cn');
    const compositeBg = catalogEntryToBackground(compositeEntry);
    const compositeOptions = (compositeBg.toolProficiencies![0] as any).options;
    expect(compositeOptions).toContain("woodcarver's tools");
    expect(compositeOptions).toContain("lute");
    expect((compositeBg.toolProficiencies![0] as any).numToChoose).toBe(1);
  });

  it('extracts legacy background features and flavor tables from 5etools entries', () => {
    const rawCriminal = {
      name: '罪犯',
      ENG_name: 'Criminal',
      source: 'PHB',
      entries: [
        {
          name: '特性：罪犯接头人',
          ENG_name: 'Feature: Criminal Contact',
          type: 'entries',
          entries: ['你有一个可靠可信的接头人，来帮你组织进罪犯们组成的联系网中。'],
          data: { isFeature: true }
        },
        {
          name: '手法',
          type: 'entries',
          entries: [
            {
              type: 'table',
              colLabels: ['d8', '手法'],
              rows: [['1', '敲诈犯'], ['2', '盗窃犯']]
            }
          ]
        }
      ]
    };

    const entry = normalizeBackground(rawCriminal, '5etools-cn');
    const bg = catalogEntryToBackground(entry);

    expect(bg.legacyFeature).toBeDefined();
    expect(bg.legacyFeature?.name).toBe('罪犯接头人');
    expect(bg.legacyFeature?.description).toContain('你有一个可靠可信的接头人');
    expect(bg.flavorTables).toHaveLength(1);
    expect(bg.flavorTables?.[0].name).toBe('手法');
    expect(bg.flavorTables?.[0].dice).toBe('8');
    expect(bg.flavorTables?.[0].rows[0].content).toBe('敲诈犯');
  });

  it('correctly parses 2014 classic background startingEquipment with individual items and embedded currency', () => {
    // 模拟拉尼卡俄佐立官员 (Azorius Functionary) 2014 结构化装备
    const rawAzorius = {
      name: '俄佐立官员',
      ENG_name: 'Azorius Functionary',
      source: 'GGR',
      skillProficiencies: [{ insight: true, intimidation: true }],
      startingEquipment: [
        {
          _: [
            { special: '俄佐立徽章' },
            { special: '一支记载着对你来说非常重要的法律条文的卷轴' },
            '墨水(1盎司/瓶)|phb',
            '墨水笔|phb',
            '高档服装|phb',
            {
              item: '小包|phb',
              containsValue: 1000
            }
          ]
        }
      ]
    };

    const entry = normalizeBackground(rawAzorius, '5etools-cn');
    const bg = catalogEntryToBackground(entry);

    // 1. choiceA 拆分为独立的条目，而不是整段长句子
    expect(bg.equipment.choiceA).toHaveLength(6);
    expect(bg.equipment.choiceA).toContain('俄佐立徽章');
    expect(bg.equipment.choiceA).toContain('一支记载着对你来说非常重要的法律条文的卷轴');
    expect(bg.equipment.choiceA).toContain('墨水(1盎司/瓶)');
    expect(bg.equipment.choiceA).toContain('墨水笔');
    expect(bg.equipment.choiceA).toContain('高档服装');
    expect(bg.equipment.choiceA).toContain('小包（内含 10 GP）');

    // 2. 结构化记录 choiceARecords
    expect(bg.equipment.choiceARecords).toBeDefined();
    expect(bg.equipment.choiceARecords!.length).toBeGreaterThanOrEqual(6);

    // 必须有独立的 10 GP 货币记录
    const currencyRecord = bg.equipment.choiceARecords?.find(r => r.kind === 'currency');
    expect(currencyRecord).toBeDefined();
    expect(currencyRecord?.currency?.gp).toBe(10);

    // 必须有小包物品记录
    const pouchRecord = bg.equipment.choiceARecords?.find(r => r.label.includes('小包'));
    expect(pouchRecord).toBeDefined();
    expect(pouchRecord?.kind).toBe('item');
  });

  it('correctly parses 2014 classic background natural language text fallback into split items and currency', () => {
    // 模拟无 startingEquipment 只有长文本 entries 的 2014 背景
    const rawLegacyProse = {
      name: '测试古典背景',
      ENG_name: 'Test Legacy Background',
      source: 'PHB',
      entries: [
        {
          type: 'list',
          items: [
            {
              name: '装备：',
              entry: '一枚俄佐立徽章，一支记载着对你来说非常重要的法律条文的卷轴，一瓶{@item 墨水(1盎司/瓶)|phb|一瓶蓝墨水}，一支{@item 墨水笔|phb|笔}，一套{@item 高档服装|phb}，以及一条腰带{@item 小包|phb}内装有10gp（俄佐立发行的1齐诺硬币）'
            }
          ]
        }
      ]
    };

    const entry = normalizeBackground(rawLegacyProse, '5etools-cn');
    const bg = catalogEntryToBackground(entry);

    // 1. 拆分为多个独立项目
    expect(bg.equipment.choiceA.length).toBeGreaterThanOrEqual(5);

    // 2. 修复了重复量词（"一瓶一瓶蓝墨水" -> "一瓶蓝墨水"）
    expect(bg.equipment.choiceA.some(s => typeof s === 'string' && s.includes('一瓶一瓶'))).toBe(false);

    // 3. 提取了 10 GP 货币
    const curRecord = bg.equipment.choiceARecords?.find(r => r.kind === 'currency');
    expect(curRecord).toBeDefined();
    expect(curRecord?.currency?.gp).toBe(10);
  });

  it('correctly separates items and trailing currency when joined by Chinese comma in 2024 backgrounds', () => {
    // 模拟 2024 农夫背景文本格式（项目以顿号分隔，末尾金币以全角逗号分隔）
    const rawFarmer2024 = {
      name: '农民',
      ENG_name: 'Farmer',
      source: 'XPHB',
      entries: [
        {
          type: 'list',
          items: [
            {
              name: '装备：',
              entry: '选择 A 或 B：(A) {@item 镰刀|XPHB}、{@item 木匠工具|XPHB}、{@item 医疗包|XPHB}、{@item 铁壶|XPHB}、{@item 铲子|XPHB}、{@item 旅行服装|XPHB}， 30 GP；或 (B) 50 GP'
            }
          ]
        }
      ]
    };

    const entry = normalizeBackground(rawFarmer2024, '5etools-cn');
    const bg = catalogEntryToBackground(entry);

    // 1. choiceA 必须将 "旅行服装" 与 "30 GP" 拆为两个独立子项，不能合并为一条
    expect(bg.equipment.choiceA).toContain('旅行服装');
    expect(bg.equipment.choiceA).toContain('30 GP');
    expect(bg.equipment.choiceA).not.toContain('旅行服装， 30 GP');
    expect(bg.equipment.choiceA.length).toBe(7); // 镰刀, 木匠工具, 医疗包, 铁壶, 铲子, 旅行服装, 30 GP

    // 2. choiceARecords 必须同时拥有旅行服装物品记录与 30 GP 货币记录
    expect(bg.equipment.choiceARecords).toBeDefined();
    const clothesRecord = bg.equipment.choiceARecords?.find(r => r.label === '旅行服装');
    expect(clothesRecord).toBeDefined();
    expect(clothesRecord?.kind).toBe('item');

    const goldRecord = bg.equipment.choiceARecords?.find(r => r.kind === 'currency');
    expect(goldRecord).toBeDefined();
    expect(goldRecord?.currency?.gp).toBe(30);

    // 3. 方案 B 纯金币正确提取
    expect(bg.equipment.choiceB).toBe('50 GP');
    expect(bg.equipment.choiceBRecord?.kind).toBe('currency');
    expect(bg.equipment.choiceBRecord?.currency?.gp).toBe(50);
  });

  it('handles space-delimited currency, Chinese commas between items, and quantifiers cleanly', () => {
    // 模拟包含数量词、逗号混杂及空格金币的 2024 背景
    const rawComplex2024 = {
      name: '潜行者',
      ENG_name: 'Infiltrator',
      source: 'XPHB',
      entries: [
        {
          type: 'list',
          items: [
            {
              name: '装备：',
              entry: '选择A或B：(A) 2把{@item 匕首|XPHB}，{@item 盗贼工具|XPHB}，2个{@item 小包|XPHB}，{@item 水袋|XPHB} 26GP；(B) 50GP'
            }
          ]
        }
      ]
    };

    const entry = normalizeBackground(rawComplex2024, '5etools-cn');
    const bg = catalogEntryToBackground(entry);

    // 水袋与 26GP 必须分离
    expect(bg.equipment.choiceA).toContain('水袋');
    expect(bg.equipment.choiceA).toContain('26GP');

    // 数量词正确识别
    const daggerRecord = bg.equipment.choiceARecords?.find(r => r.label.includes('匕首'));
    expect(daggerRecord).toBeDefined();
    expect(daggerRecord?.quantity).toBe(2);

    const pouchRecord = bg.equipment.choiceARecords?.find(r => r.label.includes('小包'));
    expect(pouchRecord).toBeDefined();
    expect(pouchRecord?.quantity).toBe(2);

    // 26 GP 货币记录
    const curRecord = bg.equipment.choiceARecords?.find(r => r.kind === 'currency');
    expect(curRecord?.currency?.gp).toBe(26);
  });
});


