import { describe, expect, it } from 'vitest';
import fs, { readFileSync } from 'node:fs';
import path from 'node:path';
import { createDefaultFiveEToolsSource } from '@/source/fiveetools-cn/client';
import { defaultCatalog } from '../catalog';
import { normalizeRace, normalizeSubrace } from '@/source/fiveetools-cn/normalizers/race';
import { normalizeSpell } from '@/source/fiveetools-cn/normalizers/spell';
import { catalogEntryToSubspecies, getCatalogSpecies } from '../adapters/species';
import { getSpeciesDefinition, getSubspeciesDefinition } from '@/engine/characterData';
import { computeCombatStats } from '@/engine/combat';
import { computeProficiencies } from '@/engine/proficiency';
import { deriveCharacterSpellSelection, getInnateSpells } from '@/engine/spellcasting';
import { CharacterState } from '@/types/characterState';
import { computeAbilityScores } from '@/engine/ability';
import { clean5eTags, flattenEntries } from '@/source/fiveetools-cn/utils';
import { resolveEntries } from '@/source/resolver/copy';

function state(speciesId: string, subspeciesId?: string): CharacterState {
  return {
    speciesId,
    subspeciesId,
    classes: [],
    selectedFeats: [],
    inventoryEntries: [],
    equipmentIds: [],
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    speciesSelections: {},
  } as unknown as CharacterState;
}

describe('5etools display and species choice regressions', () => {
  it('renders reference labels instead of source IDs, including nested tags', () => {
    expect(
      clean5eTags(
        '你拥有60尺{@sense 黑暗视觉|XPHB}，以{@action 魔法|XPHB}动作获得{@variantrule 抗性|XPHB}。',
      ),
    ).toBe('你拥有60尺黑暗视觉，以魔法动作获得抗性。');
    expect(clean5eTags('{@b {@variantrule 熟练|XPHB|熟练加值}}')).toBe('**熟练加值**');
    expect(clean5eTags('{@unknown 保留标签|XPHB}')).toBe('保留标签');
  });

  it('preserves table cells and single-entry list items', () => {
    const result = flattenEntries([
      { type: 'table', colLabels: ['龙', '类型'], rows: [['红', '{@variantrule 火焰|XPHB}']] },
      { type: 'list', items: [{ name: '条目', entry: '完整正文' }] },
    ]);
    expect(result).toContain('| 红 | 火焰 |');
    expect(result).toContain('完整正文');
  });

  it('keeps lineage choices in direct lookup and applies saved speed, senses and spells', () => {
    const raw = {
      name: '测试精灵',
      ENG_name: 'Elf',
      source: 'XPHB',
      speed: 30,
      darkvision: 60,
      entries: [{ name: '血系', entries: ['选择血系'] }],
      _versions: [
        {
          name: '测试木精灵',
          ENG_name: 'Test Wood Elf',
          speed: 35,
          darkvision: 120,
          _mod: {
            entries: {
              mode: 'replaceArr',
              replace: '血系',
              items: { name: '木精灵血系', entries: ['完整血系原文'] },
            },
          },
          additionalSpells: [
            { known: { '1': ['测试戏法|XPHB#c'] }, ability: { choose: ['int', 'wis', 'cha'] } },
          ],
        },
      ],
    };
    const original = JSON.stringify(raw);
    const entry = normalizeRace(raw);
    defaultCatalog.register(entry);
    const spell = normalizeSpell({
      name: '测试戏法',
      ENG_name: 'Test Cantrip',
      source: 'XPHB',
      level: 0,
      entries: [],
    });
    defaultCatalog.register(spell);
    const species = getSpeciesDefinition(state(entry.id))!;
    expect(species.subSpecies?.options).toHaveLength(1);
    const saved = JSON.parse(JSON.stringify(state(entry.id, species.subSpecies!.options[0].id)));
    saved.speciesSelections = { [`sp:${entry.id}:trait:innate-spellcasting-ability`]: ['感知'] };
    expect(
      getSubspeciesDefinition(saved)?.traits.some((t) => t.description === '完整血系原文'),
    ).toBe(true);
    expect(computeCombatStats(saved).speed).toBe(35);
    expect(computeProficiencies(saved).senses.darkvision).toBe(120);
    expect(getInnateSpells(saved).map((s) => s.spellId)).toContain(spell.id);
    expect(getInnateSpells(saved)[0].source).toContain('感知；豁免 DC 10，攻击 +2');
    expect(JSON.stringify(raw)).toBe(original);
  });

  it('links 2014 subraces by parent source and preserves their traits and ASI', () => {
    const parent = normalizeRace({ name: '测试精灵', ENG_name: 'Elf', source: 'PHB', entries: [] });
    defaultCatalog.register(parent);
    defaultCatalog.register(
      normalizeRace({ name: '测试精灵', ENG_name: 'Elf', source: 'XPHB', entries: [] }),
    );
    defaultCatalog.register(
      normalizeSubrace({
        name: '测试亚种',
        source: 'PHB',
        raceName: 'Elf',
        raceSource: 'PHB',
        ability: [{ int: 1 }],
        entries: [{ name: '亚种特质', entries: ['原文'] }],
      }),
    );
    const species = getSpeciesDefinition(state(parent.id))!;
    expect(species.subSpecies?.options).toHaveLength(1);
    expect(species.subSpecies!.options[0].traits[0].description).toBe('原文');
    expect(species.subSpecies!.options[0].abilityScoreIncrease).toEqual({ int: 1 });
  });

  it('restores explicit skill choices without interpreting ability or spell selections as skills', () => {
    const entry = normalizeRace({
      name: '测试人类',
      ENG_name: 'Human',
      source: 'XPHB',
      skillProficiencies: [{ any: 1 }],
      entries: [{ name: '娴熟', ENG_name: 'Skillful', entries: ['自选技能'] }],
    });
    defaultCatalog.register(entry);
    const species = getSpeciesDefinition(state(entry.id))!;
    expect(species.traits[0].features?.skillProficiencies).toEqual([
      { numToChoose: 1, options: ['any'] },
    ]);
    const character = state(entry.id);
    character.speciesSelections = {
      [`sp:${entry.id}:trait:skillful:skill-0`]: ['perception'],
      [`sp:${entry.id}:trait:skillful`]: ['智力'],
    };
    expect(computeProficiencies(character).skills.map((s) => s.id)).toEqual(['perception']);
  });

  it('merges structured resistances into the existing native trait without an empty duplicate card', () => {
    const entry = normalizeRace({
      name: '测试天界族',
      ENG_name: 'Test Celestial',
      source: 'TST',
      resist: ['暗蚀', '光耀'],
      entries: [
        {
          name: '天界抗性',
          ENG_name: 'Celestial Resistance',
          type: 'entries',
          entries: ['你具有暗蚀和光耀伤害的抗性。'],
        },
      ],
    });
    defaultCatalog.register(entry);

    const species = getSpeciesDefinition(state(entry.id))!;
    expect(species.traits).toHaveLength(1);
    expect(species.traits[0]).toMatchObject({
      name: '天界抗性',
      nameEn: 'Celestial Resistance',
      description: '你具有暗蚀和光耀伤害的抗性。',
      features: { resistances: ['暗蚀', '光耀'] },
    });
    expect(
      species.traits.some((trait) => trait.id === 'damage-resistance' && !trait.description),
    ).toBe(false);
  });

  it('gives structured-only resistance and sense traits meaningful fallback descriptions', () => {
    const parent = { darkvision: 60, speed: 30 };
    const entry = normalizeSubrace({
      name: '测试血系',
      raceName: 'Test Parent',
      raceSource: 'TST',
      source: 'TST',
      resist: ['寒冷'],
      darkvision: 120,
      speed: 35,
      entries: [],
    });
    defaultCatalog.register(entry);

    const subspecies = catalogEntryToSubspecies(entry, parent);
    expect(
      subspecies.traits.find((trait) => trait.id === 'damage-resistance')?.description,
    ).toContain('寒冷');
    expect(subspecies.traits.find((trait) => trait.id === 'lineage-senses')?.description).toContain(
      '120',
    );
    expect(subspecies.traits.find((trait) => trait.id === 'lineage-speed')?.description).toContain(
      '35',
    );
    expect(subspecies.traits.every((trait) => Boolean(trait.description))).toBe(true);
  });

  it('parses a prose cantrip choice and its linked spellcasting ability without a species id rule', () => {
    const entry = normalizeRace({
      name: '测试星裔',
      ENG_name: 'Test Astral Kin',
      source: 'TST',
      additionalSpells: [
        { known: { '1': ['舞光术#c'] }, ability: { choose: ['int', 'wis', 'cha'] } },
        { known: { '1': ['光亮术#c'] }, ability: { choose: ['int', 'wis', 'cha'] } },
        { known: { '1': ['圣火术#c'] }, ability: { choose: ['int', 'wis', 'cha'] } },
      ],
      entries: [
        {
          name: '星火',
          ENG_name: 'Astral Spark',
          type: 'entries',
          entries: [
            '你习得下列一项你选择的戏法：{@spell 舞光术}、{@spell 光亮术}、或{@spell 圣火术}。你施展该戏法的施法属性为智力、感知、或魅力（选择此种族时决定）。',
          ],
        },
      ],
    });
    defaultCatalog.register(entry);
    const spells = [
      normalizeSpell({
        name: '舞光术',
        ENG_name: 'Dancing Lights',
        source: 'PHB',
        level: 0,
        entries: [],
      }),
      normalizeSpell({ name: '光亮术', ENG_name: 'Light', source: 'PHB', level: 0, entries: [] }),
      normalizeSpell({
        name: '圣火术',
        ENG_name: 'Sacred Flame',
        source: 'PHB',
        level: 0,
        entries: [],
      }),
    ];
    spells.forEach((spell) => defaultCatalog.register(spell));

    const species = getSpeciesDefinition(state(entry.id))!;
    const trait = species.traits.find((candidate) => candidate.nameEn === 'Astral Spark')!;
    const spellChoice = trait.features?.spells?.[0] as any;
    expect(spellChoice).toMatchObject({ numToChoose: 1, name: '戏法' });
    expect(spellChoice.options.map((option: any) => option.spellId)).toEqual(
      spells.map((spell) => spell.id),
    );
    expect(trait.features?.spellcastingAbility).toEqual({
      numToChoose: 1,
      name: '施法属性',
      options: ['int', 'wis', 'cha'],
    });

    const character = state(entry.id);
    const traitKey = `sp:${entry.id}:trait:${trait.id}`;
    character.speciesSelections = {
      [`${traitKey}:spell-0`]: [spells[1].id],
      [`${traitKey}:ability`]: ['wis'],
    };
    expect(getInnateSpells(character)).toEqual([
      expect.objectContaining({ spellId: spells[1].id, source: expect.stringContaining('感知') }),
    ]);
    expect(deriveCharacterSpellSelection(character).cantripIds).toContain(spells[1].id);
  });

  it('does not merge lineage table spells into a prose cantrip choice', () => {
    const entry = normalizeRace({
      name: '测试精灵',
      ENG_name: 'Test Elf',
      source: 'TST',
      entries: [
        {
          name: '精灵血系',
          ENG_name: 'Elven Lineage',
          type: 'entries',
          entries: [
            '从精灵血系表格中选择其一。',
            '当你选择血系时，选择智力、感知、或魅力之一作为施法属性。',
            {
              type: 'table',
              rows: [
                ['卓尔', '你习得戏法{@spell 舞光术|PHB}。', '{@spell 妖火|PHB}'],
                ['木精灵', '你习得戏法{@spell 德鲁伊伎俩|PHB}。', '{@spell 大步奔行|PHB}'],
              ],
            },
          ],
        },
      ],
    });
    defaultCatalog.register(entry);

    const trait = getSpeciesDefinition(state(entry.id))!.traits.find(
      (candidate) => candidate.nameEn === 'Elven Lineage',
    )!;
    expect(trait.features?.spells).toBeUndefined();
    expect(trait.features?.spellcastingAbility).toBeUndefined();
  });

  it('structures resistances on lineage choices and marks lineage host trait with representsSubSpecies', () => {
    const raw = {
      name: '提夫林',
      ENG_name: 'Tiefling',
      source: 'XPHB',
      speed: 30,
      entries: [
        {
          name: '邪魔遗赠',
          ENG_name: 'Fiendish Legacy',
          entries: [
            '你承载着一份给予了你超自然能力的邪魔遗赠。从邪魔遗赠表格中选择其一。',
            {
              type: 'table',
              caption: '邪魔遗赠',
              colLabels: ['遗赠', '1环', '3环', '5环'],
              rows: [['深渊', '毒素', '致病射线', '定身类人']],
            },
          ],
        },
      ],
      _versions: [
        {
          name: '提夫林：深渊遗赠',
          ENG_name: 'Tiefling; Abyssal Legacy',
          resist: ['毒素'],
          _mod: {
            entries: {
              mode: 'replaceArr',
              replace: 'Fiendish Legacy',
              items: {
                name: '深渊遗赠',
                entries: ['你获得对毒素伤害的抗性。你习得戏法毒气喷涌。'],
              },
            },
          },
          additionalSpells: [
            {
              innate: {
                '1': ['毒气喷涌|XPHB#c'],
                '3': ['致病射线|XPHB'],
              },
              ability: { choose: ['int', 'wis', 'cha'] },
            },
          ],
        },
      ],
    };
    const entry = normalizeRace(raw);
    defaultCatalog.register(entry);

    const species = getSpeciesDefinition(state(entry.id))!;
    expect(species.subSpecies?.options).toHaveLength(1);

    const abyssal = species.subSpecies!.options[0];
    expect(abyssal.features?.resistances).toEqual(['毒素']);
    expect(abyssal.features?.spells).toBeDefined();

    const hostTrait = species.traits.find(
      (t) => t.name === '邪魔遗赠' || t.nameEn === 'Fiendish Legacy',
    );
    expect(hostTrait?.representsSubSpecies).toBe(true);
  });

  it('generalizes to Dragonborn ancestries with resistance normalization and breath traits', () => {
    const raw = {
      name: '龙裔',
      ENG_name: 'Dragonborn',
      source: 'XPHB',
      entries: [
        {
          name: '龙类祖怪',
          ENG_name: 'Draconic Ancestry',
          entries: ['选择一种龙类先祖。'],
        },
      ],
      _versions: [
        {
          name: '黑龙祖怪',
          ENG_name: 'Black Dragonborn',
          _variables: { damageType: 'acid' },
          _mod: {
            entries: {
              mode: 'replaceArr',
              replace: 'Draconic Ancestry',
              items: {
                name: '黑龙吐息与抗性',
                entries: ['你具有强酸伤害的抗性。以动作发动5尺乘30尺的强酸线状吐息。'],
              },
            },
          },
        },
      ],
    };
    const entry = normalizeRace(raw);
    defaultCatalog.register(entry);

    const species = getSpeciesDefinition(state(entry.id))!;
    expect(species.subSpecies?.options).toHaveLength(1);

    const black = species.subSpecies!.options[0];
    expect(black.features?.resistances).toEqual(['强酸']);

    const hostTrait = species.traits.find(
      (t) => t.name === '龙类祖怪' || t.nameEn === 'Draconic Ancestry',
    );
    expect(hostTrait?.representsSubSpecies).toBe(true);
  });

  it('supports non-XPHB official expansions and third-party homebrew lineages with resistances and spells', () => {
    // 1. 官方扩展书 (如 FTD 色彩/宝石龙裔)
    const ftdRaw = {
      name: '龙裔 (宝石)',
      ENG_name: 'Dragonborn (Gem)',
      source: 'FTD',
      entries: [{ name: '宝石龙先祖', entries: ['选择你的宝石龙先祖。'] }],
      _versions: [
        {
          _abstract: {
            name: '龙裔 (宝石; {{color}})',
            ENG_name: 'Dragonborn (Gem; {{color}})',
            source: 'FTD',
            _mod: {
              entries: [
                {
                  mode: 'replaceArr',
                  replace: '宝石龙先祖',
                  items: { name: '紫晶吐息', entries: ['你呼出重力波。'] },
                },
              ],
            },
          },
          _implementations: [
            {
              _variables: { color: '紫晶', damageType: '力场', resist: ['力场'] },
            },
          ],
        },
      ],
    };
    const ftdEntry = normalizeRace(ftdRaw);
    defaultCatalog.register(ftdEntry);
    const ftdSpecies = getSpeciesDefinition(state(ftdEntry.id))!;
    expect(ftdSpecies.subSpecies?.options).toHaveLength(1);
    expect(ftdSpecies.subSpecies!.options[0].features?.resistances).toEqual(['力场']);

    // 2. 第三方/自制 (Homebrew) 嵌套种族
    const homebrewRaw = {
      name: '自制虚空裔',
      ENG_name: 'Custom Voidborn',
      source: 'HOMEBREW_CUSTOM',
      entries: [{ name: '虚空传承', entries: ['选择传承。'] }],
      _versions: [
        {
          name: '蚀日虚空裔',
          ENG_name: 'Eclipse Voidborn',
          resist: ['necrotic', 'radiant'],
          additionalSpells: [
            {
              known: { '1': ['虚空射击|CUSTOM#c'] },
              ability: { choose: ['int', 'wis', 'cha'] },
            },
          ],
          _mod: {
            entries: [
              {
                mode: 'replaceArr',
                replace: '虚空传承',
                items: { name: '蚀日之力', entries: ['你获得暗蚀与光耀的交织之力。'] },
              },
            ],
          },
        },
      ],
    };
    const hbEntry = normalizeRace(homebrewRaw);
    defaultCatalog.register(hbEntry);
    const hbSpecies = getSpeciesDefinition(state(hbEntry.id))!;
    expect(hbSpecies.subSpecies?.options).toHaveLength(1);
    expect(hbSpecies.subSpecies!.options[0].features?.resistances).toEqual(['暗蚀', '光耀']);
    expect(
      hbSpecies.subSpecies!.options[0].features?.spellcastingAbility?.options ||
        hbSpecies.subSpecies!.options[0].traits.some((t) => t.features?.spellcastingAbility),
    ).toBeTruthy();
  });

  it('resolves raw other language proficiencies into concrete game languages and excludes other placeholder', () => {
    const raw = {
      name: '格龙蛙人',
      ENG_name: 'Grung',
      source: 'OGA',
      languageProficiencies: [{ other: true }],
      entries: [
        {
          name: '语言',
          ENG_name: 'Languages',
          entries: ['你能说、读、写格朗语。'],
        },
      ],
    };
    const entry = normalizeRace(raw);
    defaultCatalog.register(entry);
    const species = getSpeciesDefinition(state(entry.id))!;
    const langTrait = species.traits.find((t) => t.name === '语言');
    expect(langTrait).toBeDefined();
    expect(langTrait?.features?.languages).toContain('grung');
    expect(langTrait?.features?.languages).not.toContain('other');
  });

  it('extracts embedded skill choices and recognizes gameplay level-unlock features (Kobold Legacy & Aasimar Revelation)', () => {
    // 1. 验证狗头人遗产 (Kobold Legacy): 从 @skill 文本深入提取 5 选 1 技能熟练
    const koboldRaw = {
      name: '狗头人',
      ENG_name: 'Kobold',
      source: 'MPMM',
      entries: [
        {
          name: '狗头人遗产',
          ENG_name: 'Kobold Legacy',
          entries: [
            '狗头人与龙类的联系能够以一种不可思议的方式在一个狗头人的身上显现。从下列遗产选项中为你的狗头人选择一项：',
          ],
        },
      ],
      _versions: [
        {
          name: '狗头人；狡猾',
          ENG_name: 'Kobold; Craftiness',
          _mod: {
            entries: [
              {
                mode: 'replaceArr',
                replace: '狗头人遗产',
                items: {
                  name: '狗头人遗产（狡猾）',
                  ENG_name: 'Kobold Legacy (Craftiness)',
                  entries: [
                    '你拥有以下一项自选技能的熟练项：{@skill 奥秘}，{@skill 调查}，{@skill 医药}，{@skill 巧手}，或{@skill 求生}。',
                  ],
                },
              },
            ],
          },
        },
      ],
    };
    const koboldEntry = normalizeRace(koboldRaw);
    defaultCatalog.register(koboldEntry);
    const koboldSpecies = getSpeciesDefinition(state(koboldEntry.id))!;

    // 宿主名称不再是空洞的“血系”，而是“狗头人遗产”
    expect(koboldSpecies.subSpecies?.hostTraitName).toBe('狗头人遗产');
    expect(koboldSpecies.subSpecies?.isGamePlayChoice).toBe(false);
    expect(koboldSpecies.subSpecies?.levelRequirement).toBe(1);

    // 深入嵌套的自选技能熟练项被结构化提取为 5 选 1
    const craftiness = koboldSpecies.subSpecies?.options[0];
    expect(craftiness).toBeDefined();
    const legacyTrait = craftiness?.traits.find((t) => t.name.includes('狡猾'));
    expect(legacyTrait?.features?.skillProficiencies).toBeDefined();
    expect(legacyTrait?.features?.skillProficiencies?.[0]).toMatchObject({
      numToChoose: 1,
      options: ['arcana', 'investigation', 'medicine', 'sleightOfHand', 'survival'],
    });

    // 验证深入选择后，技能熟练项被规则引擎正确计算生效
    const character = state(koboldEntry.id, craftiness!.id);
    const traitKey = legacyTrait!.id || legacyTrait!.name;
    character.speciesSelections = {
      [`sp:${koboldEntry.id}:trait:${traitKey}:skill-0`]: ['sleight of hand'],
    };
    const profs = computeProficiencies(character);
    expect(profs.skills.map((s) => s.id)).toContain('sleightOfHand');

    // 2. 验证阿斯莫天界启示 (Aasimar Celestial Revelation): 正确识别 3 级生效门槛与游戏中抉择
    const aasimarRaw = {
      name: '阿斯莫',
      ENG_name: 'Aasimar',
      source: 'MPMM',
      entries: [
        {
          name: '天界启示',
          ENG_name: 'Celestial Revelation',
          entries: [
            '当你到达3级时，请选择以下的一个启示选项。此后，你可以使用一个附赠动作来释放你内在的天界能量，获得该启示的益处。',
          ],
        },
      ],
      _versions: [
        {
          name: '阿斯莫；死灵斗篷',
          ENG_name: 'Aasimar; Necrotic Shroud',
          _mod: {
            entries: [
              {
                mode: 'replaceArr',
                replace: '天界启示',
                items: {
                  name: '天界启示（死灵环绕）',
                  ENG_name: 'Celestial Revelation (Necrotic Shroud)',
                  entries: ['你的双目短暂地变成黑暗之池...'],
                },
              },
            ],
          },
        },
      ],
    };
    const aasimarEntry = normalizeRace(aasimarRaw);
    defaultCatalog.register(aasimarEntry);
    const aasimarSpecies = getSpeciesDefinition(state(aasimarEntry.id))!;

    expect(aasimarSpecies.subSpecies?.hostTraitName).toBe('天界启示');
    expect(aasimarSpecies.subSpecies?.levelRequirement).toBe(3);
    expect(aasimarSpecies.subSpecies?.isGamePlayChoice).toBe(true);
  });

  it('guarantees subspecies traits replace base placeholder traits without duplicate IDs or keys', () => {
    // 模拟 5etools XPHB 龙裔结构：基础特质含通用吐息武器与抗性，子亚种提供具体龙种吐息与抗性
    const dragonbornRaw = {
      name: '龙裔',
      ENG_name: 'Dragonborn',
      source: 'XPHB',
      entries: [
        { name: '龙族血统', ENG_name: 'Draconic Ancestry', entries: ['选择你的龙族血统。'] },
        { name: '吐息武器', ENG_name: 'Breath Weapon', entries: ['呼出通用的能量。'] },
        { name: '伤害抗性', ENG_name: 'Damage Resistance', entries: ['获得对应抗性。'] },
      ],
      _versions: [
        {
          _abstract: {
            name: '龙裔 ({{color}})',
            ENG_name: 'Dragonborn ({{color}})',
            source: 'XPHB',
            _mod: {
              entries: [
                {
                  mode: 'replaceArr',
                  replace: '吐息武器',
                  items: {
                    name: '吐息武器',
                    ENG_name: 'Breath Weapon',
                    entries: ['呼出特定的强酸线。'],
                  },
                },
                {
                  mode: 'replaceArr',
                  replace: '伤害抗性',
                  items: {
                    name: '伤害抗性',
                    ENG_name: 'Damage Resistance',
                    entries: ['你获得强酸抗性。'],
                  },
                },
              ],
            },
          },
          _implementations: [{ _variables: { color: '黑', damageType: '强酸', resist: ['强酸'] } }],
        },
      ],
    };

    const entry = normalizeRace(dragonbornRaw);
    defaultCatalog.register(entry);
    const species = getSpeciesDefinition(state(entry.id))!;
    expect(species.subSpecies?.options).toHaveLength(1);

    const blackDragonOption = species.subSpecies!.options[0];
    expect(blackDragonOption.traits.map((t) => t.id)).toEqual(['breathweapon', 'damageresistance']);
    expect(species.traits.map((t) => t.id)).toEqual([
      'draconicancestry',
      'breathweapon',
      'damageresistance',
    ]);
  });

  it('定制血统 (Custom Lineage)：正确继承并解析技能熟练选项与黑暗视觉互斥，且正确解析自选任意专长与自选语言', () => {
    const customLineageRaw = {
      name: '定制血统',
      ENG_name: 'Custom Lineage',
      source: 'TCE',
      lineage: true,
      darkvision: 60,
      feats: [{ any: 1 }],
      skillProficiencies: [{ any: 1 }],
      languageProficiencies: [{ common: true, anyStandard: 1 }],
      entries: [
        {
          name: '专长',
          ENG_name: 'Feat',
          type: 'entries',
          entries: ['你获得一个你自选的满足条件的专长。'],
        },
        {
          name: '可选特征',
          ENG_name: 'Variable Trait',
          type: 'entries',
          entries: ['从以下两种特性中选择一个：（a）60尺黑暗视觉（b）自选一项技能的熟练项。'],
        },
        {
          name: '语言',
          ENG_name: 'Languages',
          type: 'entries',
          entries: ['你可以说、读、写通用语和另一门你和你的DM认为合适的语言。'],
        },
      ],
      _versions: [
        {
          name: '定制血统；黑暗视觉',
          ENG_name: 'Custom Lineage; Darkvision',
          source: 'TCE',
          _mod: {
            entries: {
              mode: 'replaceArr',
              replace: '可选特征',
              items: {
                name: '可选特性；黑暗视觉',
                ENG_name: 'Variable Trait; Darkvision',
                type: 'entries',
                entries: ['你获得60尺的黑暗视觉。'],
              },
            },
          },
          skillProficiencies: null,
        },
        {
          name: '定制血统；技能熟练',
          ENG_name: 'Custom Lineage; Skill Proficiency',
          source: 'TCE',
          _mod: {
            entries: {
              mode: 'replaceArr',
              replace: '可选特征',
              items: {
                name: '可选特性；技能熟练',
                ENG_name: 'Variable Trait; Skill Proficiency',
                type: 'entries',
                entries: ['你自选一个技能并获得其熟练。'],
              },
            },
          },
          darkvision: null,
        },
      ],
    };

    const entry = normalizeRace(customLineageRaw);
    defaultCatalog.register(entry);
    const species = getSpeciesDefinition(state(entry.id))!;
    expect(species.subSpecies?.options).toHaveLength(2);

    // 1. 自选专长：挂载在原生“专长”特质上，且 filter 必须是 type:any（不限起源专长）
    const featTrait = species.traits.find((t) => t.name === '专长')!;
    expect(featTrait).toBeDefined();
    expect(featTrait.features?.originFeats).toMatchObject({
      numToChoose: 1,
      filter: 'type:any',
    });

    // 2. 语言：包含固定通用语和自选 1 项语言
    const langTrait = species.traits.find((t) => t.name === '语言')!;
    expect(langTrait).toBeDefined();
    expect(langTrait.features?.languages).toEqual([
      'common',
      expect.objectContaining({ numToChoose: 1, options: ['any'] }),
    ]);

    // 3. 子血系互斥
    const darkvisionSub = species.subSpecies!.options.find((o) => o.name.includes('黑暗视觉'))!;
    expect(darkvisionSub.features?.skillProficiencies).toBeUndefined();

    const skillSub = species.subSpecies!.options.find((o) => o.name.includes('技能熟练'))!;
    expect(skillSub.features?.skillProficiencies).toBeDefined();
    expect(skillSub.features!.skillProficiencies![0]).toMatchObject({
      numToChoose: 1,
    });
  });

  it('correctly maps Orc Primal Intuition 2 skill choices to the native trait without duplicate cards', () => {
    const rawOrc = {
      name: '兽人',
      ENG_name: 'Orc',
      source: 'EGW',
      skillProficiencies: [
        {
          choose: {
            from: [
              'animal handling',
              'insight',
              'intimidation',
              'medicine',
              'nature',
              'perception',
              'survival',
            ],
            count: 2,
          },
        },
      ],
      entries: [
        {
          name: '原初直觉',
          ENG_name: 'Primal Intuition',
          type: 'entries',
          entries: [
            '你可以从以下技能中选择两项获得熟练项：驯兽、洞悉、威吓、医药、自然、察觉和求生。',
          ],
        },
        {
          name: '强力构筑',
          ENG_name: 'Powerful Build',
          type: 'entries',
          entries: ['在决定你的载重时，你视为体型大一级的生物。'],
        },
      ],
    };

    const entry = normalizeRace(rawOrc);
    defaultCatalog.register(entry);
    const species = getSpeciesDefinition(state(entry.id))!;

    // 1. 严格只有 2 个原生特质，不产生多余的“技能熟练”孤立卡片
    expect(species.traits).toHaveLength(2);
    expect(species.traits.map((t) => t.name)).toEqual(['原初直觉', '强力构筑']);

    // 2. 原初直觉特质正确挂载结构化数据，numToChoose 严格为 2，options 包含全部候选技能
    const primalTrait = species.traits.find((t) => t.name === '原初直觉')!;
    expect(primalTrait.features?.skillProficiencies).toBeDefined();
    expect(primalTrait.features?.skillProficiencies?.[0]).toMatchObject({
      numToChoose: 2,
      options: [
        'animal handling',
        'insight',
        'intimidation',
        'medicine',
        'nature',
        'perception',
        'survival',
      ],
    });
  });

  it('correctly maps Bugbear Sneaky fixed skill to the native trait without duplicate cards', () => {
    const rawBugbear = {
      name: '熊地精',
      ENG_name: 'Bugbear',
      source: 'MPMM',
      skillProficiencies: [{ stealth: true }],
      entries: [
        {
          name: '隐秘',
          ENG_name: 'Sneaky',
          type: 'entries',
          entries: ['你获得隐匿技能的熟练。'],
        },
        {
          name: '长肢',
          ENG_name: 'Long-Limbed',
          type: 'entries',
          entries: ['进行近战近战攻击时攻击距离增加5尺。'],
        },
      ],
    };

    const entry = normalizeRace(rawBugbear);
    defaultCatalog.register(entry);
    const species = getSpeciesDefinition(state(entry.id))!;

    // 只有 2 个原生特质，不产生多余卡片
    expect(species.traits).toHaveLength(2);
    expect(species.traits.map((t) => t.name)).toEqual(['隐秘', '长肢']);

    const sneakyTrait = species.traits.find((t) => t.name === '隐秘')!;
    expect(sneakyTrait.features?.skillProficiencies).toEqual(['stealth']);
  });

  it('变体人类 (Variant Human)：正确解析 feats 中的 any: 1 自选专长，且支持 anyStandard 自选语言', () => {
    const rawVariantHuman = {
      name: '变体',
      ENG_name: 'Variant',
      source: 'PHB',
      raceName: '人类',
      raceSource: 'PHB',
      feats: [{ any: 1 }],
      skillProficiencies: [{ any: 1 }],
      languageProficiencies: [{ common: true, anyStandard: 1 }],
      entries: [
        {
          name: '技能',
          ENG_name: 'Skills',
          type: 'entries',
          entries: ['你自选一个技能并获得其熟练。'],
        },
        {
          name: '专长',
          ENG_name: 'Feat',
          type: 'entries',
          entries: ['你获得一个自选的专长。'],
        },
      ],
    };

    const entry = normalizeSubrace(rawVariantHuman);
    defaultCatalog.register(entry);
    const parent = { darkvision: 0, speed: 30 };
    const subspecies = catalogEntryToSubspecies(entry, parent);

    const featTrait = subspecies.traits.find((t) => t.name === '专长')!;
    expect(featTrait).toBeDefined();
    expect(featTrait.features?.originFeats).toMatchObject({
      numToChoose: 1,
      filter: 'type:any',
    });

    const langTrait = subspecies.traits.find((t) => t.name === '语言')!;
    expect(langTrait).toBeDefined();
    expect(langTrait.features?.languages).toEqual([
      'common',
      expect.objectContaining({ numToChoose: 1, options: ['any'] }),
    ]);
  });

  it('correctly resolves languages for PSA Aven and Khenra without duplicates, undefined, or verb prefixes', () => {
    const rawAven = {
      name: '艾文',
      ENG_name: 'Aven',
      source: 'PSA',
      languageProficiencies: [{ common: true, other: true }],
      entries: [
        {
          name: '语言',
          ENG_name: 'Languages',
          entries: ['你可以说、读、写通用语和鹰语。'],
        },
      ],
    };
    const entryAven = normalizeRace(rawAven);
    defaultCatalog.register(entryAven);
    const aven = getSpeciesDefinition(state(entryAven.id))!;
    const avenLangTrait = aven.traits.find((t) => t.name === '语言')!;
    expect(avenLangTrait).toBeDefined();
    expect(avenLangTrait.features?.languages).toEqual(['common', '鹰语']);

    const rawKhenra = {
      name: '胡狼人',
      ENG_name: 'Khenra',
      source: 'PSA',
      languageProficiencies: [{ common: true, other: true }],
      entries: [
        {
          name: '语言',
          ENG_name: 'Languages',
          entries: ['你能够说、读、写通用语和赫努拉语。'],
        },
      ],
    };
    const entryKhenra = normalizeRace(rawKhenra);
    defaultCatalog.register(entryKhenra);
    const khenra = getSpeciesDefinition(state(entryKhenra.id))!;
    const khenraLangTrait = khenra.traits.find((t) => t.name === '语言')!;
    expect(khenraLangTrait).toBeDefined();
    expect(khenraLangTrait.features?.languages).toEqual(['common', '赫努拉语']);
  });

  it('correctly parses Kaladesh Dwarf Artisan Expertise as tool proficiency and not duplicate skill', async () => {
    const client = createDefaultFiveEToolsSource();
    const res = await client.fetchJson<any>('data/races.json');
    const races: any[] = res.body.race || [];
    const dwarf = races.find(
      (r) =>
        (r.name && r.name.includes('卡拉德许')) || (r.ENG_name && r.ENG_name.includes('Kaladesh')),
    );
    expect(dwarf).toBeDefined();

    const entry = normalizeRace(dwarf);
    defaultCatalog.register(entry);
    const species = getSpeciesDefinition(state(entry.id))!;
    const artisanTrait = species.traits.find(
      (t) => t.nameEn === "Artisan's Expertise" || t.name === '专精工匠',
    );
    expect(artisanTrait).toBeDefined();

    // 核心断言 1：绝不能把工匠工具解析成历史技能
    expect(artisanTrait!.features?.skillProficiencies).toBeUndefined();

    // 核心断言 2：工匠工具正确解析为 2 项自选，且选项为标准工匠工具
    expect(artisanTrait!.features?.toolProficiencies).toBeDefined();
    expect(artisanTrait!.features?.toolProficiencies).toHaveLength(1);
    const toolChoice = artisanTrait!.features!.toolProficiencies![0] as any;
    expect(toolChoice.numToChoose).toBe(2);
    expect(toolChoice.options).toContain("smith's tools");
    expect(toolChoice.options).toContain("alchemist's supplies");
  }, 30000);

  it('scans all races and subraces in 5etools to ensure every toolProficiencies is properly attached and has valid choices', async () => {
    const client = createDefaultFiveEToolsSource();
    const resRaces = await client.fetchJson<any>('data/races.json');
    const races: any[] = resRaces.body.race || [];
    const subraces: any[] = resRaces.body.subrace || [];

    const toolRaces: { name: string; source: string; raw: any; traits: string[] }[] = [];

    for (const r of races) {
      if (r.toolProficiencies) {
        const entry = normalizeRace(r);
        defaultCatalog.register(entry);
        const species = getSpeciesDefinition(state(entry.id))!;

        // 查找挂载了 toolProficiencies 的特质
        const matchedTraits = species.traits.filter((t) => t.features?.toolProficiencies?.length);
        expect(
          matchedTraits.length,
          `Race ${r.name || r.ENG_name} (${r.source}) has toolProficiencies in raw data but none attached to traits!`,
        ).toBeGreaterThan(0);

        for (const mt of matchedTraits) {
          for (const tp of mt.features!.toolProficiencies!) {
            if (typeof tp === 'object' && 'numToChoose' in tp) {
              expect(tp.numToChoose).toBeGreaterThan(0);
              expect(
                tp.options.length,
                `Race ${r.name || r.ENG_name} trait ${mt.name} options cannot be empty`,
              ).toBeGreaterThan(0);
            }
          }
        }

        toolRaces.push({
          name: r.name || r.ENG_name,
          source: r.source,
          raw: r.toolProficiencies,
          traits: matchedTraits.map(
            (t) => `${t.name} (${t.nameEn}): ${JSON.stringify(t.features?.toolProficiencies)}`,
          ),
        });
      }
    }

    for (const sr of subraces) {
      if (sr.toolProficiencies) {
        const entry = normalizeSubrace(sr);
        defaultCatalog.register(entry);
        const sub = getSubspeciesDefinition(state('dummy', entry.id))!;
        expect(
          sub,
          `Subrace ${sr.name || sr.ENG_name} (${sr.source}) must produce a definition`,
        ).toBeDefined();

        const matchedTraits = sub.traits.filter((t) => t.features?.toolProficiencies?.length);
        expect(
          matchedTraits.length,
          `Subrace ${sr.name || sr.ENG_name} (${sr.source}) has toolProficiencies in raw data but none attached to traits!`,
        ).toBeGreaterThan(0);

        for (const mt of matchedTraits) {
          for (const tp of mt.features!.toolProficiencies!) {
            if (typeof tp === 'object' && 'numToChoose' in tp) {
              expect(tp.numToChoose).toBeGreaterThan(0);
              expect(
                tp.options.length,
                `Subrace ${sr.name || sr.ENG_name} trait ${mt.name} options cannot be empty`,
              ).toBeGreaterThan(0);
            }
          }
        }

        toolRaces.push({
          name: `[Subrace] ${sr.name || sr.ENG_name}`,
          source: sr.source,
          raw: sr.toolProficiencies,
          traits: matchedTraits.map(
            (t) => `${t.name} (${t.nameEn}): ${JSON.stringify(t.features?.toolProficiencies)}`,
          ),
        });
      }
    }

    // 普查：检查是否有种族仅在正文中写了工具选择，而 raw 数据未包含 toolProficiencies
    const proseToolCandidates: string[] = [];
    for (const item of [...races, ...subraces]) {
      if (item.toolProficiencies) continue;
      const prose = JSON.stringify(item.entries || '');
      if (
        /(?:选择|获得|具有|拥有)(?:一|二|两|1|2)?(?:项|种|门)?(?:工匠工具|工具|乐器)的?熟练度/.test(
          prose,
        )
      ) {
        proseToolCandidates.push(`[${item.source}] ${item.name || item.ENG_name}`);
      }
    }
  }, 30000);

  it('correctly adapts Kaladesh Elf and Vahadar subrace native traits and spell filters', async () => {
    const client = createDefaultFiveEToolsSource();
    const resRaces = await client.fetchJson<any>('data/races.json');
    const elf = resRaces.body.race.find(
      (r: any) => r.name === '精灵 (卡拉德许)' || r.ENG_name === 'Elf (Kaladesh)',
    );
    const vahadar = (resRaces.body.subrace || []).find(
      (s: any) =>
        (s.name && s.name.includes('沃赫达')) || (s.ENG_name && s.ENG_name.includes('Vahadar')),
    );

    const elfEntry = normalizeRace(elf);
    defaultCatalog.register(elfEntry);
    const vahadarEntry = normalizeSubrace(vahadar);
    defaultCatalog.register(vahadarEntry);

    const charState = state(elfEntry.id, vahadarEntry.id);
    const speciesDef = getSpeciesDefinition(charState)!;
    const subDef = getSubspeciesDefinition(charState)!;

    const cantripTrait = subDef.traits.find((t) => t.name === '戏法' || t.nameEn === 'Cantrip');
    expect(cantripTrait, 'Vahadar should have native Cantrip trait').toBeDefined();
    expect(cantripTrait!.features?.spells).toBeDefined();
    expect((cantripTrait!.features!.spells![0] as any).filter).toContain('class:德鲁伊');
    expect(cantripTrait!.mechanics?.spellcastingAbility).toBe('wis');

    const extraLangTrait = subDef.traits.find(
      (t) => t.name === '额外语言' || t.nameEn === 'Extra Language',
    );
    expect(extraLangTrait, 'Vahadar should have Extra Language trait').toBeDefined();
    expect(extraLangTrait!.features?.languages).toBeDefined();
    expect((extraLangTrait!.features!.languages![0] as any).numToChoose).toBe(1);

    const fakeInnateTrait = subDef.traits.find((t) => t.id === 'innate-spells');
    expect(
      fakeInnateTrait,
      'Should not produce fallback innate-spells trait when native trait matches',
    ).toBeUndefined();

    // 验证子职业法术不污染基础职业法术列表：以法师戏法(火焰箭)和德鲁伊戏法(神导术)为例
    const { normalizeSpell } = await import('@/source/fiveetools-cn/normalizers/spell');
    const { catalogEntryToSpell } = await import('@/catalog/adapters/spells');
    const { translateClass } = await import('@/engine/terminology');

    // 模拟从 5etools lookup 生成的 grants
    // 修复后 grants 仅包含 class 和 classVariant，不再包含 subclass 的母职业
    const fireBoltEntry = normalizeSpell({
      name: '火焰箭',
      ENG_name: 'Fire Bolt',
      source: 'XPHB',
      level: 0,
      _classGrants: [
        { name: '术士', source: 'XPHB' },
        { name: '法师', source: 'XPHB' },
      ],
    });
    const druidcraftEntry = normalizeSpell({
      name: '德鲁伊伎俩',
      ENG_name: 'Druidcraft',
      source: 'XPHB',
      level: 0,
      _classGrants: [{ name: '德鲁伊', source: 'XPHB' }],
    });

    const fireBoltSpell = catalogEntryToSpell(fireBoltEntry);
    const druidcraftSpell = catalogEntryToSpell(druidcraftEntry);

    const targetClass = translateClass('德鲁伊');
    const isFireBoltDruid = fireBoltSpell.classes.some((c) => translateClass(c) === targetClass);
    const isDruidcraftDruid = druidcraftSpell.classes.some(
      (c) => translateClass(c) === targetClass,
    );

    expect(isFireBoltDruid, 'Fire Bolt must not be classified as a druid spell').toBe(false);
    expect(isDruidcraftDruid, 'Druidcraft must be classified as a druid spell').toBe(true);
  }, 10000);

  it('correctly resolves and presents Dankwood Goblin (AWM) traits including Speak with Small Beasts and Nimble Escape', async () => {
    const client = createDefaultFiveEToolsSource();
    const resRaces = await client.fetchJson<any>('data/races.json');
    const races: any[] = resRaces.body.race || [];

    // 展开 _copy
    const { resolved, warnings } = resolveEntries(races);
    const dankwood = resolved.find(
      (r: any) =>
        r.source === 'AWM' && (r.name?.includes('阴林') || r.ENG_name?.includes('Dankwood')),
    );
    expect(dankwood).toBeDefined();

    // 核心特质验证：Entries 不被破坏，完整保留
    expect(dankwood.entries).toBeDefined();
    expect(Array.isArray(dankwood.entries)).toBe(true);
    const traitNames = dankwood.entries.map((e: any) => e.name || e.ENG_name);
    expect(traitNames).toContain('小型野兽交谈');
    expect(traitNames).toContain('迅捷逃逸');
    expect(traitNames).toContain('黑暗视觉');
    expect(traitNames).toContain('语言');

    // 归一化与适配器验证
    const entry = normalizeRace(dankwood);
    defaultCatalog.register(entry);
    const species = getSpeciesDefinition(state(entry.id))!;

    const speakWithBeasts = species.traits.find(
      (t) => t.name.includes('小型野兽交谈') || t.nameEn?.includes('Speak with Small Beasts'),
    );
    expect(speakWithBeasts).toBeDefined();
    expect(speakWithBeasts!.description).toContain('通过声音和手势');

    const nimbleEscape = species.traits.find(
      (t) => t.name.includes('迅捷逃逸') || t.nameEn?.includes('Nimble Escape'),
    );
    expect(nimbleEscape).toBeDefined();

    const langTrait = species.traits.find((t) => t.name === '语言' || t.nameEn === 'Languages');
    expect(langTrait).toBeDefined();
    expect(langTrait!.features?.languages).toContain('common');
    expect(langTrait!.features?.languages).toContain('阴林地精语');
  }, 30000);

  it('supports Homebrew entries with empty trait name while preserving full description and card', async () => {
    const { entryTraits } = await import('../adapters/speciesChoices');
    const rawHomebrew = {
      name: '自定义自制种族',
      entries: [
        '这是一段直接写在 entries 里的无标题纯文本特性描述。',
        { entries: ['这是一个有 entries 但没有 name 属性的对象特性。'] },
        { name: '', entries: ['这是一个明确将 name 留空的特性。'] },
        { name: '标准特性', entries: ['标准有名字的特性描述。'] },
      ],
    };
    const traits = entryTraits(rawHomebrew);
    expect(traits).toHaveLength(4);
    expect(traits[0].name).toBe('');
    expect(traits[0].description).toBe('这是一段直接写在 entries 里的无标题纯文本特性描述。');
    expect(traits[1].name).toBe('');
    expect(traits[1].description).toBe('这是一个有 entries 但没有 name 属性的对象特性。');
    expect(traits[2].name).toBe('');
    expect(traits[2].description).toBe('这是一个明确将 name 留空的特性。');
    expect(traits[3].name).toBe('标准特性');
  });

  it('guarantees Tiefling resistance is nested in lineages and not presented as free choice', async () => {
    const rawTiefling = {
      name: '提夫林',
      ENG_name: 'Tiefling',
      source: 'XPHB',
      resist: [{ choose: { from: ['poison', 'necrotic', 'fire'] } }],
      entries: [{ name: '邪魔遗赠', ENG_name: 'Fiendish Legacy', entries: ['选择一种遗赠。'] }],
      _versions: [
        {
          name: '提夫林；深渊遗赠',
          ENG_name: 'Tiefling; Abyssal',
          resist: ['毒素'],
          _mod: {
            entries: {
              mode: 'replaceArr',
              replace: 'Fiendish Legacy',
              items: { name: '深渊遗赠', entries: ['深渊抗性与法术'] },
            },
          },
        },
        {
          name: '提夫林；幽冥遗赠',
          ENG_name: 'Tiefling; Chthonic',
          resist: ['暗蚀'],
          _mod: {
            entries: {
              mode: 'replaceArr',
              replace: 'Fiendish Legacy',
              items: { name: '幽冥遗赠', entries: ['幽冥抗性与法术'] },
            },
          },
        },
        {
          name: '提夫林；炼狱遗赠',
          ENG_name: 'Tiefling; Infernal',
          resist: ['火焰'],
          _mod: {
            entries: {
              mode: 'replaceArr',
              replace: 'Fiendish Legacy',
              items: { name: '炼狱遗赠', entries: ['炼狱抗性与法术'] },
            },
          },
        },
      ],
    };
    const entry = normalizeRace(rawTiefling);
    defaultCatalog.register(entry);
    const species = getSpeciesDefinition(state(entry.id))!;

    // 母特质绝不能存在 resistanceChoices (杜绝自由单选选择器)
    const hostTrait = species.traits.find(
      (t) => t.name === '邪魔遗赠' || t.nameEn === 'Fiendish Legacy',
    );
    expect(hostTrait?.features?.resistanceChoices).toBeUndefined();

    // 验证各血统版本分别绑定了其专属的固定抗性
    expect(species.subSpecies?.options).toHaveLength(3);
    const abyssal = species.subSpecies?.options.find((o) => o.name.includes('深渊'));
    const chthonic = species.subSpecies?.options.find((o) => o.name.includes('幽冥'));
    const infernal = species.subSpecies?.options.find((o) => o.name.includes('炼狱'));

    expect(abyssal?.features?.resistances).toEqual(['毒素']);
    expect(chthonic?.features?.resistances).toEqual(['暗蚀']);
    expect(infernal?.features?.resistances).toEqual(['火焰']);
  });

  it('universally distinguishes branch-nested resistances from free choice without race name hardcoding', () => {
    // 1. 任意第三方自制种族：通过 _versions 分支定义抗性，绝无母特质自由单选
    const customHomebrew = {
      name: '炽源神嗣',
      ENG_name: 'IgnisBornCustom',
      source: 'HOMEBREW',
      resist: [{ choose: { from: ['fire', 'cold'] } }],
      entries: [{ name: '元素血系', entries: ['选择一种元素源流。'] }],
      _versions: [
        {
          name: '炽源神嗣；烈焰源流',
          resist: ['火焰'],
          _mod: {
            entries: {
              mode: 'replaceArr',
              replace: '元素血系',
              items: { name: '烈焰源流', entries: ['获得火焰抗性'] },
            },
          },
        },
        {
          name: '炽源神嗣；极冰源流',
          resist: ['寒冷'],
          _mod: {
            entries: {
              mode: 'replaceArr',
              replace: '元素血系',
              items: { name: '极冰源流', entries: ['获得寒冷抗性'] },
            },
          },
        },
      ],
    };
    const homebrewEntry = normalizeRace(customHomebrew);
    defaultCatalog.register(homebrewEntry);
    const homebrewSpecies = getSpeciesDefinition(state(homebrewEntry.id))!;
    const hbHostTrait = homebrewSpecies.traits.find((t) => t.name === '元素血系');
    expect(hbHostTrait?.features?.resistanceChoices).toBeUndefined();

    // 2. 任意第三方自制种族：通过条目内嵌表格映射抗性，绝无母特质自由单选
    const customTableRace = {
      name: '千鳞之民',
      ENG_name: 'ScaleFolkCustom',
      source: 'HOMEBREW',
      resist: [{ choose: { from: ['acid', 'lightning'] } }],
      entries: [
        {
          name: '鳞色谱系',
          entries: [
            '从下表中选择一种鳞色，决定你的伤害抗性。',
            {
              type: 'table',
              caption: '谱系表',
              colLabels: ['色系', '伤害类型'],
              rows: [
                ['黑鳞', '强酸'],
                ['青鳞', '闪电'],
              ],
            },
          ],
        },
      ],
    };
    const tableEntry = normalizeRace(customTableRace);
    defaultCatalog.register(tableEntry);
    const tableSpecies = getSpeciesDefinition(state(tableEntry.id))!;
    const tableHostTrait = tableSpecies.traits.find((t) => t.name === '鳞色谱系');
    expect(tableHostTrait?.features?.resistanceChoices).toBeUndefined();

    // 3. 真正由母种族直接赋予的自由单选（无分支、无表格映射），正确保留自由单选
    const customFreeChoiceRace = {
      name: '虚空塑者',
      ENG_name: 'VoidMolderCustom',
      source: 'HOMEBREW',
      resist: [{ choose: { from: ['necrotic', 'radiant'] } }],
      entries: [{ name: '两极耐性', entries: ['你在暗蚀和光耀中选择一项获得抗性。'] }],
    };
    const freeEntry = normalizeRace(customFreeChoiceRace);
    defaultCatalog.register(freeEntry);
    const freeSpecies = getSpeciesDefinition(state(freeEntry.id))!;
    const freeTrait = freeSpecies.traits.find(
      (t) => t.name === '两极耐性' || t.name === '伤害抗性',
    );
    expect(freeTrait?.features?.resistanceChoices).toBeDefined();
    expect(freeTrait?.features?.resistanceChoices?.[0].options).toEqual(['暗蚀', '光耀']);
  });

  it('2014 PHB 龙裔：正确展开 10 种巨龙血统分支，且绝无未命名亚种，并正确关联抗性', () => {
    const rawRacesPath = path.resolve(process.cwd(), 'tests/fixtures/races.json');
    if (!fs.existsSync(rawRacesPath)) return;
    const fileData = JSON.parse(fs.readFileSync(rawRacesPath, 'utf8'));

    // 注册 2014 PHB 龙裔 race
    const phbDragonborn = fileData.race.find((r: any) => r.name === '龙裔' && r.source === 'PHB');
    if (phbDragonborn) {
      defaultCatalog.register(normalizeRace(phbDragonborn, '5etools-cn'));
    }

    // 注册所有龙裔相关 subrace (PHB 变体 + EGW 扩展)
    for (const s of fileData.subrace || []) {
      if (s.raceName === '龙裔' || s.raceName === 'Dragonborn') {
        defaultCatalog.register(normalizeSubrace(s, '5etools-cn'));
      }
    }

    const species = getCatalogSpecies().find((s) => s.name === '龙裔' && s.source === 'PHB')!;
    expect(species).toBeDefined();
    expect(species.subSpecies).toBeDefined();

    const options = species.subSpecies!.options;
    // 应该至少包含 10 种 PHB 核心龙 (黑、蓝、黄铜、青铜、赤铜、金、绿、红、银、白) + 2 种 EGW 扩展
    expect(options.length).toBeGreaterThanOrEqual(10);

    // 绝无“未命名亚种”
    expect(options.some((o) => o.name.includes('未命名') || o.nameEn.includes('未命名'))).toBe(
      false,
    );

    // 检查核心 10 种龙的存在
    const dragonColors = ['黑', '蓝', '黄铜', '青铜', '赤铜', '金', '绿', '红', '银', '白'];
    for (const color of dragonColors) {
      const opt = options.find((o) => o.name === color || o.name.includes(color));
      expect(opt, `必须包含 ${color} 龙分支`).toBeDefined();
      expect(opt!.source).toBe('PHB');
    }

    // 验证黑龙抗性为强酸
    const blackDragon = options.find((o) => o.name === '黑' || o.name.includes('黑'))!;
    expect(blackDragon.features?.resistances).toContain('强酸');

    // 验证红龙抗性为火焰
    const redDragon = options.find((o) => o.name === '红' || o.name.includes('红'))!;
    expect(redDragon.features?.resistances).toContain('火焰');

    // 验证白龙抗性为寒冷
    const whiteDragon = options.find((o) => o.name === '白' || o.name.includes('白'))!;
    expect(whiteDragon.features?.resistances).toContain('寒冷');

    // 验证前 10 个选项全部为 PHB 核心来源（同源置顶）
    const firstTen = options.slice(0, 10);
    expect(firstTen.every((o) => o.source === 'PHB')).toBe(true);

    // 验证包含来自 EGW 的扩展亚种（龙血裔、峡谷裔）且其来源被准确标记
    const egwOption = options.find((o) => o.source === 'EGW');
    expect(egwOption).toBeDefined();
    expect(egwOption!.source).toBe('EGW');

    // 验证宿主特性是【龙族血统】
    expect(species.traits.find((t) => t.name === '龙族血统')?.representsSubSpecies).toBe(true);
  });

  describe('亚种与变体特性替换（Overwrite）与增量追加（Additive）验证', () => {
    const rawRacesPath = path.resolve(process.cwd(), 'tests/fixtures/races.json');
    if (!fs.existsSync(rawRacesPath)) return;
    const fileData = JSON.parse(fs.readFileSync(rawRacesPath, 'utf8'));

    it('SCAG 提夫林飞翼变体：正确解析 overwrite 元数据并替换地狱遗赠与母种族属性', () => {
      // 注册母提夫林与 SCAG 变体
      const phbTiefling = fileData.race.find((r: any) => r.name === '提夫林' && r.source === 'PHB');
      if (phbTiefling) defaultCatalog.register(normalizeRace(phbTiefling, '5etools-cn'));

      const wingedSub = fileData.subrace.find(
        (s: any) => s.name === '变体; 飞翼' && s.source === 'SCAG',
      );
      if (wingedSub) defaultCatalog.register(normalizeSubrace(wingedSub, '5etools-cn'));

      const species = getCatalogSpecies().find((s) => s.name === '提夫林' && s.source === 'PHB')!;
      expect(species).toBeDefined();

      const wingedOption = species.subSpecies?.options.find((o) => o.name.includes('飞翼'))!;
      expect(wingedOption).toBeDefined();
      expect(wingedOption.overwrite?.ability).toBe(true);

      // 验证飞翼特性上具有 overwrite: "地狱遗赠"
      const wingTrait = wingedOption.traits.find((t) => t.name === '飞翼')!;
      expect(wingTrait).toBeDefined();
      expect(wingTrait.overwrite).toBe('地狱遗赠');

      // 验证属性加值引擎：当选择飞翼时，因 overwrite.ability: true，母种族的 Cha+2, Int+1 不被重复叠加
      const wingedCharState: any = {
        speciesId: species.id,
        speciesSource: 'PHB',
        subspeciesId: wingedOption.id,
        classes: [],
        selectedFeats: [],
        inventoryEntries: [],
        equipmentIds: [],
        useSpeciesASI: true,
      };
      const scores = computeAbilityScores(wingedCharState);
      // 变体提夫林固定加值为 Int +1 (Dex/Cha 为自选)，不应叠加母种族的 Cha +2, Int +1 导致 Int 变成 +2
      expect(scores.breakdown.species.int).toBe(1);
      expect(scores.breakdown.species.cha).toBe(0); // 未做自选时母种族的 2 不应被叠加
    });

    it('MTF 提夫林扎瑞尔血统：正确替换地狱遗赠与属性加成 (Cha+2, Str+1，智力不加)', () => {
      const phbTiefling = fileData.race.find((r: any) => r.name === '提夫林' && r.source === 'PHB');
      if (phbTiefling) defaultCatalog.register(normalizeRace(phbTiefling, '5etools-cn'));

      const zarielSub = fileData.subrace.find(
        (s: any) => s.name === '扎瑞尔' && s.source === 'MTF',
      );
      if (zarielSub) defaultCatalog.register(normalizeSubrace(zarielSub, '5etools-cn'));

      const species = getCatalogSpecies().find((s) => s.name === '提夫林' && s.source === 'PHB')!;
      const zarielOption = species.subSpecies?.options.find((o) => o.name === '扎瑞尔')!;
      expect(zarielOption).toBeDefined();
      expect(zarielOption.overwrite?.ability).toBe(true);

      const legacyTrait = zarielOption.traits.find((t) => t.name === '阿弗纳斯之遗赠')!;
      expect(legacyTrait).toBeDefined();
      expect(legacyTrait.overwrite).toBe('地狱遗赠');

      const zarielCharState: any = {
        speciesId: species.id,
        speciesSource: 'PHB',
        subspeciesId: zarielOption.id,
        classes: [],
        selectedFeats: [],
        inventoryEntries: [],
        equipmentIds: [],
        useSpeciesASI: true,
      };
      const scores = computeAbilityScores(zarielCharState);
      // MTF 扎瑞尔是 Cha +2, Str +1；母提夫林是 Cha +2, Int +1
      // 正确替换后：Cha +2, Str +1, Int +0（杜绝 Cha+4 与 Int+1 恶性累加）
      expect(scores.breakdown.species.cha).toBe(2);
      expect(scores.breakdown.species.str).toBe(1);
      expect(scores.breakdown.species.int).toBe(0);
    });

    it('SCAG 半精灵卓尔血统变体：正确声明 skillProficiencies overwrite 并替换多才多艺', () => {
      const phbHalfElf = fileData.race.find((r: any) => r.name === '半精灵' && r.source === 'PHB');
      if (phbHalfElf) defaultCatalog.register(normalizeRace(phbHalfElf, '5etools-cn'));

      const drowHalfElf = fileData.subrace.find(
        (s: any) => s.name === '变体; 卓尔血统' && s.source === 'SCAG',
      );
      if (drowHalfElf) defaultCatalog.register(normalizeSubrace(drowHalfElf, '5etools-cn'));

      const species = getCatalogSpecies().find((s) => s.name === '半精灵' && s.source === 'PHB')!;
      const drowOption = species.subSpecies?.options.find(
        (o) => o.name.includes('卓尔魔法') || o.name.includes('卓尔血统'),
      )!;
      expect(drowOption).toBeDefined();
      expect(drowOption.overwrite?.skillProficiencies).toBe(true);

      const variantTrait = drowOption.traits.find(
        (t) =>
          t.overwrite === '多才多艺' || t.name.includes('变体特性') || t.name.includes('卓尔魔法'),
      )!;
      expect(variantTrait).toBeDefined();
      expect(variantTrait.overwrite).toBe('多才多艺');
    });

    it('灰矮人（Duergar）：纯增量亚种，无 overwrite，母特性与亚种特性并存，ASI 正常累加', () => {
      const phbDwarf = fileData.race.find((r: any) => r.name === '矮人' && r.source === 'PHB');
      if (phbDwarf) defaultCatalog.register(normalizeRace(phbDwarf, '5etools-cn'));

      const duergarSub = fileData.subrace.find(
        (s: any) => s.name === '灰矮人' && s.source === 'MTF',
      );
      if (duergarSub) defaultCatalog.register(normalizeSubrace(duergarSub, '5etools-cn'));

      const species = getCatalogSpecies().find((s) => s.name === '矮人' && s.source === 'PHB')!;
      const duergarOption = species.subSpecies?.options.find((o) => o.name === '灰矮人')!;
      expect(duergarOption).toBeDefined();
      // 增量亚种不覆盖属性
      expect(duergarOption.overwrite?.ability).toBeUndefined();

      const duergarCharState: any = {
        speciesId: species.id,
        speciesSource: 'PHB',
        subspeciesId: duergarOption.id,
        classes: [],
        selectedFeats: [],
        inventoryEntries: [],
        equipmentIds: [],
        useSpeciesASI: true,
      };
      const scores = computeAbilityScores(duergarCharState);
      // 母矮人体质 +2，灰矮人力量 +1，累加后：Con +2, Str +1
      expect(scores.breakdown.species.con).toBe(2);
      expect(scores.breakdown.species.str).toBe(1);
    });

    it('特性替换后天生法术绝不显示两次（扎瑞尔提夫林替换地狱遗赠：奇术仅 1 次，旧法术被剔除）', () => {
      const phbTiefling = fileData.race.find((r: any) => r.name === '提夫林' && r.source === 'PHB');
      if (phbTiefling) defaultCatalog.register(normalizeRace(phbTiefling, '5etools-cn'));

      const zarielSub = fileData.subrace.find(
        (s: any) => s.name === '扎瑞尔' && s.source === 'MTF',
      );
      if (zarielSub) defaultCatalog.register(normalizeSubrace(zarielSub, '5etools-cn'));

      const species = getCatalogSpecies().find((s) => s.name === '提夫林' && s.source === 'PHB')!;
      const zarielOption = species.subSpecies?.options.find((o) => o.name === '扎瑞尔')!;

      const charState: any = {
        speciesId: species.id,
        speciesSource: 'PHB',
        subspeciesId: zarielOption.id,
        classes: [{ classId: 'paladin', level: 5 }], // 5 级角色解锁全部天生法术
        selectedFeats: [],
        inventoryEntries: [],
        equipmentIds: [],
        useSpeciesASI: true,
      };

      const innateSpells = getInnateSpells(charState);

      // 验证奇术 (Thaumaturgy) 仅出现 1 次，绝无重复
      const thaumaturgyList = innateSpells.filter((s) => {
        const decoded = decodeURIComponent(s.spellId).toLowerCase();
        return decoded.includes('thaumaturgy') || decoded.includes('奇术');
      });
      expect(thaumaturgyList.length).toBe(1);

      // 验证已被替换掉的母特质法术（炼狱叱喝、黑暗术）已被剔除
      const hasHellishRebuke = innateSpells.some((s) => {
        const decoded = decodeURIComponent(s.spellId).toLowerCase();
        return decoded.includes('hellish-rebuke') || decoded.includes('炼狱叱喝');
      });
      const hasDarkness = innateSpells.some((s) => {
        const decoded = decodeURIComponent(s.spellId).toLowerCase();
        return decoded.includes('darkness') || decoded.includes('黑暗术');
      });
      expect(hasHellishRebuke, '炼狱叱喝已被替换剔除').toBe(false);
      expect(hasDarkness, '黑暗术已被替换剔除').toBe(false);

      // 验证扎瑞尔的斩击法术存在
      const hasSearingSmite = innateSpells.some((s) => {
        const decoded = decodeURIComponent(s.spellId).toLowerCase();
        return decoded.includes('smite') || decoded.includes('斩');
      });
      expect(hasSearingSmite, '必须包含扎瑞尔专属法术').toBe(true);
    });

    it('unifies spellcasting ability selection under spell trait without duplicate standalone trait', () => {
      const aasimarRaw = {
        name: '测试阿斯莫',
        ENG_name: 'Test Aasimar',
        source: 'MPMM',
        entries: [
          { name: '天界遗赠', entries: ['你知晓圣火戏法。选择智力、感知或魅力作为你的施法属性。'] },
        ],
        additionalSpells: [
          {
            known: { '1': ['圣火|XPHB#c'] },
            ability: { choose: ['int', 'wis', 'cha'] },
          },
        ],
      };
      const entry = normalizeRace(aasimarRaw);
      defaultCatalog.register(entry);
      const sacredFlame = normalizeSpell({
        name: '圣火',
        ENG_name: 'Sacred Flame',
        source: 'XPHB',
        level: 0,
        entries: [],
      });
      defaultCatalog.register(sacredFlame);

      const species = getSpeciesDefinition(state(entry.id))!;

      // 1. 验证特质列表中绝不存在名为 "施法属性" 或 id 为 "innate-spellcasting-ability" 的空壳独立特质卡片
      expect(
        species.traits.some((t) => t.id === 'innate-spellcasting-ability' || t.name === '施法属性'),
      ).toBe(false);

      // 2. 验证施法属性选择器正确挂载在赋予法术的特质 features.spellcastingAbility 下
      const spellTrait = species.traits.find((t) => t.name === '天界遗赠')!;
      expect(spellTrait).toBeDefined();
      expect(spellTrait.features?.spellcastingAbility?.options).toEqual(['int', 'wis', 'cha']);

      // 3. 验证选择施法属性后，角色卡正确计算法术 DC 与攻击加值 (Cha 16 -> Mod +3, PB 2 -> DC 13, Attack +5)
      const charState = {
        ...state(entry.id),
        speciesSelections: {
          [`sp:${entry.id}:trait:${spellTrait.id || '天界遗赠'}:ability`]: ['cha'],
        },
        baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 16 },
      };
      const spells = getInnateSpells(charState);
      expect(spells.length).toBeGreaterThan(0);
      expect(spells[0].source).toContain('魅力；豁免 DC 13，攻击 +5');
    });
  });
});

// Read the reference project in place; never copy its database into this repo.
describe.skipIf(!process.env.REFERENCE_RACES)('real Chinese races database', () => {
  it('restores all five XPHB lineage/ancestry groups from upstream versions', () => {
    const data = JSON.parse(readFileSync(process.env.REFERENCE_RACES!, 'utf8'));
    for (const [name, count] of [
      ['Elf', 3],
      ['Gnome', 2],
      ['Tiefling', 3],
      ['Dragonborn', 10],
      ['Goliath', 6],
    ] as const) {
      const entry = normalizeRace(
        data.race.find((r: any) => r.source === 'XPHB' && r.ENG_name === name),
      );
      defaultCatalog.register(entry);
      const species = getSpeciesDefinition(state(entry.id))!;
      expect(species.subSpecies?.options, name).toHaveLength(count);
      expect(species.description).not.toContain('XPHB');
      expect(species.subSpecies!.options.every((o) => o.traits.length > 0)).toBe(true);
    }
  });
});
