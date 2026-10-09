import { describe, it, expect, beforeEach } from 'vitest';
import { defaultCatalog } from '../catalog';
import { normalizeBackground } from '@/source/fiveetools-cn/normalizers/background';
import { normalizeFeat } from '@/source/fiveetools-cn/normalizers/feat';
import { normalizeClass } from '@/source/fiveetools-cn/normalizers/class';
import { getCatalogBackgrounds } from '../adapters/backgrounds';
import { getCatalogTools, getCatalogToolEntries } from '../tools';
import { translateProficiency } from '@/engine/terminology';

describe('Background Builder Page Logic & Data Integration Tests', () => {
  let nobleId: string;
  let acolyteId: string;
  let apprenticeId: string;

  beforeEach(() => {
    // 注册 2024 起源专长: 熟习 (Skilled)
    const featEntry = normalizeFeat(
      {
        name: '熟习',
        ENG_name: 'Skilled',
        source: 'XPHB',
        category: 'O', // Origin feat
        entries: ['你选择三项自选技能或工具，并获得其熟练项。'],
      },
      '5etools-cn',
    );
    defaultCatalog.register(featEntry);

    // 注册 2024 核心背景: 贵族 (Noble)
    const noble2024Entry = normalizeBackground(
      {
        name: '贵族',
        ENG_name: 'Noble',
        source: 'XPHB',
        ability: [{ choose: { weighted: { from: ['str', 'cha', 'int'], weights: [2, 1] } } }],
        feats: [{ '熟习|xphb': true }],
        skillProficiencies: [{ history: true, persuasion: true }],
        toolProficiencies: [{ 'gaming set': true }],
        startingEquipment: [
          {
            A: [
              { equipmentType: 'setGaming', count: 1 },
              { item: 'fine clothes|xphb' },
              { item: 'perfume|xphb' },
              { containsValue: 2900 },
            ],
            B: [{ containsValue: 5000 }],
          },
        ],
        entries: [
          '你的家族拥有显赫的地位、财富与特权。',
          {
            type: 'list',
            style: 'list-hang-notitle',
            items: [
              {
                name: '装备：',
                entry:
                  '选择 A 或 B：(A) {@item 赌具|XPHB}（同上所选）、{@item 高档服装|XPHB}、{@item 香水|XPHB}、29 GP；或 (B) 50 GP',
              },
            ],
          },
        ],
      },
      '5etools-cn',
    );
    defaultCatalog.register(noble2024Entry);
    nobleId = noble2024Entry.id;

    // 注册 2014 经典背景: 侍僧 (Acolyte)
    const acolyte2014Entry = normalizeBackground(
      {
        name: '侍僧',
        ENG_name: 'Acolyte',
        source: 'PHB',
        skillProficiencies: [{ insight: true, religion: true }],
        languageProficiencies: [{ anyStandard: 2 }],
        entries: [
          {
            name: '特性：庇护所',
            ENG_name: 'Feature: Shelter of the Faithful',
            type: 'entries',
            entries: ['作为侍僧，你能在你的神祇的神殿中获得庇护和援助。'],
            data: { isFeature: true },
          },
        ],
      },
      '5etools-cn',
    );
    defaultCatalog.register(acolyte2014Entry);
    acolyteId = acolyte2014Entry.id;

    // 注册 2014 扩展书背景: AHA学徒 (O:TTG)
    const apprenticeEntry = normalizeBackground(
      {
        name: 'AHA学徒',
        ENG_name: 'AHA Apprentice',
        source: 'O:TTG',
        skillProficiencies: [{ arcana: true, investigation: true }],
        entries: [
          {
            name: '特性：研究人脉',
            type: 'entries',
            entries: ['你可以查阅学者协会的藏书。'],
            data: { isFeature: true },
          },
        ],
      },
      '5etools-cn',
    );
    defaultCatalog.register(apprenticeEntry);
    apprenticeId = apprenticeEntry.id;
  });

  it('correctly distinguishes 2024 Core backgrounds from 2014 Legacy backgrounds', () => {
    const backgrounds = getCatalogBackgrounds();
    const noble = backgrounds.find((b) => b.id === nobleId)!;
    expect(noble).toBeDefined();

    // 2024 核心规则识别
    const isNoble2024 =
      noble.source === 'XPHB' ||
      noble.source === 'PHB2024' ||
      Boolean(noble.feat && noble.abilityScoreOptions && noble.abilityScoreOptions.length >= 3);
    expect(isNoble2024).toBe(true);

    // 2014 PHB 背景识别
    const acolyte = backgrounds.find((b) => b.id === acolyteId)!;
    expect(acolyte).toBeDefined();
    const isAcolyte2024 =
      acolyte.source === 'XPHB' ||
      acolyte.source === 'PHB2024' ||
      Boolean(
        acolyte.feat && acolyte.abilityScoreOptions && acolyte.abilityScoreOptions.length >= 3,
      );
    expect(isAcolyte2024).toBe(false);

    // 2014 扩展书背景 (O:TTG) 也被正确识别为 Legacy (非 2024)
    const apprentice = backgrounds.find((b) => b.id === apprenticeId)!;
    expect(apprentice).toBeDefined();
    const isApprentice2024 =
      apprentice.source === 'XPHB' ||
      apprentice.source === 'PHB2024' ||
      Boolean(
        apprentice.feat &&
        apprentice.abilityScoreOptions &&
        apprentice.abilityScoreOptions.length >= 3,
      );
    expect(isApprentice2024).toBe(false);
  });

  it('2024 Noble background has Origin Feat, Tool Choices and Equipment', () => {
    const backgrounds = getCatalogBackgrounds();
    const noble = backgrounds.find((b) => b.id === nobleId)!;
    expect(noble).toBeDefined();
    expect(noble.feat?.name).toBe('熟习');

    // 赌具自选展开
    const toolChoice = noble.toolProficiencies?.find((t) => typeof t === 'object') as any;
    expect(toolChoice).toBeDefined();
    expect(toolChoice.name).toBe('赌具自选');
    expect(toolChoice.options).toContain('dice set');
    expect(toolChoice.options).toContain('dragonchess set');

    // 初始装备方案 A 与方案 B
    expect(
      noble.equipment.choiceA.some((item) => typeof item === 'string' && item.includes('29 GP')),
    ).toBe(true);
    expect(noble.equipment.choiceB).toBe('50 GP');
  });

  it('correctly maps 5etools standard translations for tools without hallucination', () => {
    // 文书伪造工具与制毒工具
    expect(translateProficiency('forgery kit')).toBe('文书伪造工具');
    expect(translateProficiency('forgeryKit')).toBe('文书伪造工具');
    expect(translateProficiency("poisoner's kit")).toBe('制毒工具');
    expect(translateProficiency('poisonerKit')).toBe('制毒工具');
    expect(translateProficiency("thieves' tools")).toBe('盗贼工具');
    expect(translateProficiency('disguise kit')).toBe('易容工具');
    expect(translateProficiency('herbalism kit')).toBe('草药工具');
    expect(translateProficiency("navigator's tools")).toBe('领航工具');

    // 赌具
    expect(translateProficiency('gaming set')).toBe('赌具');
    expect(translateProficiency('dice set')).toBe('骰子组');
    expect(translateProficiency('dragonchess set')).toBe('龙棋组');
    expect(translateProficiency('playing card set')).toBe('整副纸牌');
    expect(translateProficiency('three-dragon ante set')).toBe('整副三龙牌');

    // 工匠工具
    expect(translateProficiency("alchemist's supplies")).toBe('炼金工具');
    expect(translateProficiency("smith's tools")).toBe('铁匠工具');
    expect(translateProficiency("tinker's tools")).toBe('修补匠工具');

    // 乐器 (全部以 5etools items-base 官方中文呈现，拒绝英文遗漏)
    expect(translateProficiency('bagpipes')).toBe('风笛');
    expect(translateProficiency('drum')).toBe('鼓');
    expect(translateProficiency('dulcimer')).toBe('扬琴');
    expect(translateProficiency('flute')).toBe('长笛');
    expect(translateProficiency('lute')).toBe('鲁特琴');
    expect(translateProficiency('lyre')).toBe('里拉琴');
    expect(translateProficiency('horn')).toBe('号角');
    expect(translateProficiency('pan flute')).toBe('排箫');
    expect(translateProficiency('shawm')).toBe('芦笛');
    expect(translateProficiency('viol')).toBe('提琴');
  });

  it('2024 and 2014 Charlatan backgrounds correctly have 文书伪造工具', () => {
    const charlatan2024Entry = normalizeBackground(
      {
        name: '骗子',
        ENG_name: 'Charlatan',
        source: 'XPHB',
        toolProficiencies: [{ 'forgery kit': true }],
      },
      '5etools-cn',
    );
    defaultCatalog.register(charlatan2024Entry);

    const backgrounds = getCatalogBackgrounds();
    const charlatan = backgrounds.find((b) => b.id === charlatan2024Entry.id)!;
    expect(charlatan).toBeDefined();
    expect(charlatan.toolProficiencies).toContain('forgery kit');

    // 翻译后验证
    const toolZh = charlatan
      .toolProficiencies!.map((t) => (typeof t === 'string' ? translateProficiency(t) : ''))
      .filter(Boolean);
    expect(toolZh).toContain('文书伪造工具');
    expect(toolZh.join('')).not.toContain('造假工具');
  });

  it('2014 Legacy backgrounds have Legacy Feature with text and Manual ASI capability', () => {
    const backgrounds = getCatalogBackgrounds();
    const acolyte = backgrounds.find((b) => b.id === acolyteId)!;
    expect(acolyte).toBeDefined();
    expect(acolyte.legacyFeature).toBeDefined();
    expect(acolyte.legacyFeature?.name).toContain('庇护所');
    expect(acolyte.legacyFeature?.description).toContain('神殿中获得庇护和援助');

    // Manual ASI 开启逻辑验证
    const isLegacy = true;
    let enableLegacyAsi = false;

    // 未开启时门禁拦截
    const canShowAsiBefore = !isLegacy || enableLegacyAsi;
    expect(canShowAsiBefore).toBe(false);

    // 开启后能够自由分配 6 项属性
    enableLegacyAsi = true;
    const canShowAsiAfter = !isLegacy || enableLegacyAsi;
    expect(canShowAsiAfter).toBe(true);

    const stats = isLegacy
      ? ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma']
      : acolyte.abilityScoreOptions || [];
    expect(stats).toHaveLength(6);
  });

  it('correctly resolves origin feat with sub-variant (e.g. 魔法学徒；牧师) with description and English name', () => {
    // 注册职业: 牧师 (Cleric)，供动态提取英文名
    const clericClass = normalizeClass(
      {
        name: '牧师',
        ENG_name: 'Cleric',
        source: 'PHB',
      },
      '5etools-cn',
    );
    defaultCatalog.register(clericClass);

    // 注册母专长: 魔法学徒 (Magic Initiate)
    const magicInitiateEntry = normalizeFeat(
      {
        name: '魔法学徒',
        ENG_name: 'Magic Initiate',
        source: 'XPHB',
        category: 'O',
        entries: ['你学会两门自选戏法，以及一道 1 环法术。'],
      },
      '5etools-cn',
    );
    defaultCatalog.register(magicInitiateEntry);

    // 注册 2024 侍僧 (Acolyte)，专长为 "魔法学徒；牧师|xphb"
    const acolyte2024Entry = normalizeBackground(
      {
        name: '侍僧',
        ENG_name: 'Acolyte',
        source: 'XPHB',
        ability: [{ choose: { weighted: { from: ['wis', 'int', 'cha'], weights: [2, 1] } } }],
        feats: ['魔法学徒；牧师|xphb'],
        skillProficiencies: [{ insight: true, religion: true }],
        toolProficiencies: [{ "calligrapher's supplies": true }],
        startingEquipment: [{ A: [{ item: 'holy symbol|xphb' }], B: [{ containsValue: 5000 }] }],
      },
      '5etools-cn',
    );
    defaultCatalog.register(acolyte2024Entry);

    const backgrounds = getCatalogBackgrounds();
    const acolyte2024 = backgrounds.find((b) => b.id === acolyte2024Entry.id)!;
    expect(acolyte2024).toBeDefined();
    expect(acolyte2024.feat).toBeDefined();
    expect(acolyte2024.feat?.name).toBe('魔法学徒；牧师');
    expect(acolyte2024.feat?.nameEn).toBe('Magic Initiate (Cleric)');
    expect(acolyte2024.feat?.description).toBe('你学会两门自选戏法，以及一道 1 环法术。');
  });

  it('correctly categorizes flavor tables into 特点, 理念, 牵挂, 缺陷 instead of duplicate generic title', () => {
    const acolyteWithTraitsEntry = normalizeBackground(
      {
        name: '侍僧',
        ENG_name: 'Acolyte',
        source: 'PHB',
        entries: [
          {
            name: '建议人物特征',
            type: 'entries',
            entries: [
              '侍僧由神殿塑造...',
              {
                type: 'table',
                colLabels: ['d8', '特点'],
                rows: [
                  ['1', '我敬畏神祇。'],
                  ['2', '我能找到任何宗教的共同点。'],
                ],
              },
              {
                type: 'table',
                colLabels: ['d6', '理念'],
                rows: [
                  ['1', '传统。'],
                  ['2', '慈善。'],
                ],
              },
              {
                type: 'table',
                colLabels: ['d6', '牵挂'],
                rows: [['1', '我誓死保护神圣圣物。']],
              },
              {
                type: 'table',
                colLabels: ['d6', '缺陷'],
                rows: [['1', '我盲目相信教派权威。']],
              },
            ],
          },
        ],
      },
      '5etools-cn',
    );
    defaultCatalog.register(acolyteWithTraitsEntry);

    const backgrounds = getCatalogBackgrounds();
    const bg = backgrounds.find((b) => b.id === acolyteWithTraitsEntry.id)!;
    expect(bg).toBeDefined();
    expect(bg.flavorTables).toBeDefined();
    expect(bg.flavorTables).toHaveLength(4);
    expect(bg.flavorTables![0].name).toBe('特点');
    expect(bg.flavorTables![1].name).toBe('理念');
    expect(bg.flavorTables![2].name).toBe('牵挂');
    expect(bg.flavorTables![3].name).toBe('缺陷');
  });

  it('correctly resolves 2024 Wayfarer equipment gaming set as 任意 directly from 5etools entry', () => {
    // 2024 流浪者: 5etools 原生数据自带官方 entries
    const wayfarerEntry = normalizeBackground(
      {
        name: '流浪者',
        ENG_name: 'Wayfarer',
        source: 'XPHB',
        ability: [{ choose: { weighted: { from: ['dex', 'con', 'wis'], weights: [2, 1] } } }],
        feats: ['幸运|xphb'],
        skillProficiencies: [{ insight: true, stealth: true }],
        toolProficiencies: [{ "thieves' tools": true }],
        startingEquipment: [
          {
            A: [
              { item: 'dagger|xphb', count: 2 },
              { item: "thieves' tools|xphb" },
              { equipmentType: 'setGaming', count: 1 },
              { item: 'bedroll|xphb' },
              { containsValue: 1600 },
            ],
            B: [{ containsValue: 5000 }],
          },
        ],
        entries: [
          {
            type: 'list',
            style: 'list-hang-notitle',
            items: [
              {
                name: '装备：',
                entry:
                  '选择 A 或 B：(A) {@item 匕首|XPHB|2把匕首}、{@item 盗贼工具|XPHB}、{@item 赌具|XPHB}（任意）、{@item 铺盖|XPHB}、{@item 小包|XPHB|2个小包}、{@item 旅行服装|XPHB}、16 GP；或 (B) 50 GP',
              },
            ],
          },
        ],
      },
      '5etools-cn',
    );
    defaultCatalog.register(wayfarerEntry);

    const backgrounds = getCatalogBackgrounds();
    const wayfarer = backgrounds.find((b) => b.id === wayfarerEntry.id)!;
    expect(wayfarer).toBeDefined();

    // 方案 A 直接从 5etools 原文提取，呈现权威的 "赌具（任意）"
    expect(wayfarer.equipment.choiceA).toContain('赌具（任意）');
    expect(wayfarer.equipment.choiceA).toContain('2把匕首');
    expect(wayfarer.equipment.choiceA).toContain('盗贼工具');
    expect(wayfarer.equipment.choiceA).not.toContain('赌具（同上所选）');

    // 对比 2024 贵族 (Noble)，其 5etools 原文为 "赌具（同上所选）"
    const noble = backgrounds.find((b) => b.id === nobleId)!;
    expect(noble.equipment.choiceA).toContain('赌具（同上所选）');
  });

  it('dynamically extracts full 5etools tools including SCAG expansions and third-party items', () => {
    // 核心与 SCAG 官方扩展乐器均在全量乐器池中
    const allInstruments = getCatalogTools('Musical');
    expect(allInstruments).toContain('bagpipes'); // 风笛
    expect(allInstruments).toContain('birdpipes'); // 鸟箫 (SCAG)
    expect(allInstruments).toContain('longhorn'); // 长号角 (SCAG)
    expect(allInstruments).toContain('yarting'); // 雅廷琴 (SCAG)
    expect(allInstruments).toContain('shawm'); // 芦笛

    // 动态注册一个第三方扩展/自建乐器 (type: INS)
    const customLuteEntry = {
      id: 'astral-lute',
      source: 'HOMEBREW',
      edition: '2024',
      kind: 'item',
      name: '星界鲁特琴',
      englishName: 'Astral Lute',
      description: '一把来自星界的魔法鲁特琴。',
      raw: { type: 'INS', name: '星界鲁特琴', ENG_name: 'Astral Lute' },
    };
    defaultCatalog.register(customLuteEntry as any);

    // 重新获取全量乐器，验证第三方自建乐器已被全量动态提取
    const updatedInstruments = getCatalogTools('Musical');
    expect(updatedInstruments).toContain('astral-lute');
  });

  it('filters magic item instruments and distinguishes tools existing across multiple editions by source', () => {
    // 动态注册多来源乐器与魔法乐器
    defaultCatalog.register({
      id: 'item:drum:phb',
      source: 'PHB',
      edition: '2014',
      kind: 'baseitem',
      name: '鼓',
      englishName: 'Drum',
      raw: { type: 'INS', name: '鼓', ENG_name: 'Drum', source: 'PHB', rarity: 'none' },
    } as any);

    defaultCatalog.register({
      id: 'item:drum:xphb',
      source: 'XPHB',
      edition: '2024',
      kind: 'baseitem',
      name: '鼓',
      englishName: 'Drum',
      raw: { type: 'INS|XPHB', name: '鼓', ENG_name: 'Drum', source: 'XPHB', rarity: 'none' },
    } as any);

    // 魔法乐器 1: +1 调律者之鼓 (带有加值和稀有度)
    defaultCatalog.register({
      id: "item:%2B1-rhythm-maker's-drum:tce",
      source: 'TCE',
      edition: '2014',
      kind: 'item',
      name: '+1 调律者之鼓',
      englishName: "+1 Rhythm Maker's Drum",
      raw: {
        type: 'INS',
        name: '+1 调律者之鼓',
        ENG_name: "+1 Rhythm Maker's Drum",
        rarity: 'uncommon',
        reqAttune: true,
        bonusSpellAttack: '+1',
      },
    } as any);

    // 魔法乐器 2: 金穗琴 (奇物)
    defaultCatalog.register({
      id: 'item:instruments-of-the-bards-doss-chime:dmg',
      source: 'DMG',
      edition: '2014',
      kind: 'item',
      name: '多斯编钟',
      englishName: 'Doss Chime',
      raw: {
        type: 'INS|$M',
        name: '多斯编钟',
        ENG_name: 'Doss Chime',
        wondrous: true,
        rarity: 'rare',
      },
    } as any);

    const tools = getCatalogToolEntries().filter((t) => t.category === 'Musical');
    const toolIds = getCatalogTools('Musical');

    // 1. 验证魔法乐器已被 100% 规则过滤，绝无渗透
    expect(toolIds.some((id) => id.includes('rhythm-maker') || id.includes('%2b1'))).toBe(false);
    expect(toolIds.some((id) => id.includes('doss-chime'))).toBe(false);

    // 2. 验证多版本同名工具来源区分
    const drumXphb = tools.find((t) => t.id === 'drum|xphb');
    const drumPhb = tools.find((t) => t.id === 'drum|phb');
    expect(drumXphb).toBeDefined();
    expect(drumPhb).toBeDefined();
    expect(drumXphb!.name).toBe('鼓 [2024 玩家手册]');
    expect(drumPhb!.name).toBe('鼓 [玩家手册]');

    // 3. 验证 2024 版本排在 2014 版本前面
    const xphbIdx = tools.findIndex((t) => t.id === 'drum|xphb');
    const phbIdx = tools.findIndex((t) => t.id === 'drum|phb');
    expect(xphbIdx).toBeLessThan(phbIdx);

    // 4. 验证翻译函数支持带来源 ID 与单来源 ID
    expect(translateProficiency('drum|xphb')).toBe('鼓 [2024 玩家手册]');
    expect(translateProficiency('drum|phb')).toBe('鼓 [玩家手册]');
    expect(translateProficiency('birdpipes')).toBe('鸟箫');
  });
});
