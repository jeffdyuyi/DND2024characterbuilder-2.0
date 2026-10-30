import { describe, expect, it } from 'vitest';
import { parseFeatureChoices } from '../adapters/featureChoicesParser';
import { normalizeClass } from '@/source/fiveetools-cn/normalizers/class';
import type { CatalogEntry } from '../types';
import barbarian from '@/source/__fixtures__/fiveetools-cn/barbarian-class.json';

function feature(name: string, entries: unknown[]): CatalogEntry {
  return {
    ...normalizeClass({ name: '测试职业', ENG_name: 'Test Class', source: 'TEST' }, 'test'),
    id: `test:classFeature:${name}`,
    kind: 'classFeature',
    name,
    englishName: name,
    raw: { name, className: 'Test Class', classSource: 'TEST', source: 'TEST', level: 1, entries },
  };
}

describe('职业特性通用选项解析器', () => {
  it('明确授予的技能直接记录，不能展开为任意技能选择，也不提前授予 options 分支', () => {
    const result = parseFeatureChoices(feature('知识授予', ['你获得{@skill 奥秘}技能的熟练。']));
    expect(result.choices).toEqual([]);
    expect(result.skillProficiencies).toEqual(['arcana']);
    expect(
      parseFeatureChoices(
        feature('熟练举例', ['You gain proficiency in a skill, such as {@skill Arcana}.']),
      ).skillProficiencies,
    ).toEqual([]);

    const branch = parseFeatureChoices(
      feature('分支训练', [
        {
          type: 'options',
          count: 1,
          entries: [
            { name: '学者', entries: ['You gain proficiency in the {@skill Arcana} skill.'] },
            { name: '斥候', entries: ['You gain proficiency in the {@skill Stealth} skill.'] },
          ],
        },
      ]),
    );
    expect(branch.skillProficiencies).toEqual([]);
  });

  it.each(['PHB', 'XPHB'])('原初学识遵守 %s 职业技能表，其他段落标签不充当候选', (source) => {
    const raw = barbarian.classFeature.find(
      (entry) => entry.ENG_name === 'Primal Knowledge' && entry.classSource === source,
    )!;
    const result = parseFeatureChoices({ ...feature(raw.name, raw.entries), raw });
    expect(result.choices[0]).toMatchObject({
      type: 'skill',
      numToChoose: 1,
      filter: 'class-skills',
    });
  });

  it.each([
    [
      '吟游诗人激励',
      '你可以用语言，音乐或舞蹈的形式对他人进行超自然的激励。一个生物获得一个激励骰，并将数字加到一次属性检定、攻击检定或豁免检定上。你获得使用次数。',
    ],
    ['施法 Spellcasting', '选择两个戏法。你的法术豁免DC使用魅力调整值。'],
    ['攻击加护', '你获得一次额外攻击。目标进行一次豁免。'],
  ])('%s 的施用效果不生成建卡豁免选择', (name, text) => {
    expect(parseFeatureChoices(feature(name, [text])).choices).toEqual([]);
  });

  it.each([
    {
      name: '属性值提升 Ability Score Improvement',
      text: '你获得属性值提升专长或其他你满足条件的专长。',
      expected: { type: 'feat', numToChoose: 1 },
    },
    {
      name: '附赠熟练',
      text: '你获得三项由你选择的技能的熟练。',
      expected: { type: 'skill', numToChoose: 3 },
    },
    {
      name: 'Weapon Training',
      text: 'Choose three kinds of Simple or Martial weapons. You can use the Mastery property of the chosen weapons.',
      expected: { type: 'weaponMastery', numToChoose: 3, filter: 'proficient-weapons' },
    },
    {
      name: 'Style Training',
      text: 'You gain a Fighting Style feat of your choice.',
      expected: { type: 'feat', numToChoose: 1, options: ['Fighting Style'] },
    },
    {
      name: '2024 战士战斗风格',
      text: '不断磨练你的武艺。你获得一项你选择的{@filter 战斗风格专长|feats|category=FS}。推荐选择{@feat 防御|XPHB}。',
      expected: { type: 'feat', numToChoose: 1, options: ['Fighting Style'] },
    },
    {
      name: 'Languages',
      text: '选择两种你自选的语言。',
      expected: { type: 'language', numToChoose: 2, filter: 'type:language' },
    },
    {
      name: '2024 战士武器精通',
      text: '你对武器的训练使你能够运用三种自选的{@filter 简易|items|type=简易武器}或{@filter 军用|items|type=军用武器}的{@variantrule 武器精通词条|XPHB|精通词条}。',
      expected: { type: 'weaponMastery', numToChoose: 3, filter: 'proficient-weapons' },
    },
    {
      name: '2024 游荡者专精',
      text: '你获得两项由你选择的你已熟练的技能的{@variantrule 专精|XPHB}。如果你有这两项技能的熟练的话，推荐选择{@skill 巧手|XPHB}和{@skill 隐匿|XPHB}。',
      expected: { type: 'expertise', numToChoose: 2, filter: 'proficient-skills' },
    },
    {
      name: '2014 游荡者专精',
      text: '第1级起，你选择两个已有技能熟练项，或者一个技能熟练项和{@item 盗贼工具|phb}熟练项。此后你进行该项目的检定时，可以使用双倍的熟练加值。',
      expected: { type: 'expertise', numToChoose: 2, filter: 'proficient-skills' },
    },
  ])('从法条语义解析 $name', ({ name, text, expected }) => {
    const result = parseFeatureChoices(feature(name, [text]));
    expect(result.choices[0]).toMatchObject(expected);
    if (expected.type === 'expertise') {
      expect(result.choices[0].options.length).toBeGreaterThanOrEqual(18);
    }
    if (name.includes('2014')) {
      expect(result.choices[0].options).toContain('thievesTools');
    }
    expect(result.diagnostics).toEqual([]);
  });

  it('AST options 优先保留原始选项和数量', () => {
    const result = parseFeatureChoices(
      feature('Style Options', [
        'Choose one Fighting Style.',
        {
          type: 'options',
          count: 1,
          entries: [
            { type: 'refOptionalfeature', optionalfeature: 'Archery|TEST' },
            { type: 'refOptionalfeature', optionalfeature: 'Defense|TEST' },
          ],
        },
      ]),
    );
    expect(result.choices[0]).toMatchObject({
      type: 'fightingStyle',
      numToChoose: 1,
      options: ['Archery|TEST', 'Defense|TEST'],
    });
    expect(result.diagnostics).toEqual([]);
  });

  it('原生结构化技能、工具、语言和武器选择保留类型与数量', () => {
    const entry = feature('结构化训练', ['按原生字段配置。']);
    Object.assign(entry.raw, {
      skillProficiencies: [{ any: 2 }],
      toolProficiencies: [{ anyArtisansTool: 1 }],
      languageProficiencies: [{ anyStandard: 1 }],
      weaponProficiencies: [{ choose: { from: ['longsword', 'shortsword'], count: 1 } }],
    });
    expect(parseFeatureChoices(entry).choices).toMatchObject([
      { type: 'skill', numToChoose: 2, options: ['Any'] },
      { type: 'tool', numToChoose: 1, options: ["Artisan's Tools"] },
      { type: 'language', numToChoose: 1, options: ['Any Standard Language'] },
      { type: 'weapon', numToChoose: 1, options: ['longsword', 'shortsword'] },
    ]);
  });

  it('AST options 解析 5etools 原生 refClassFeature (如牧师圣职 / 德鲁伊原初职能)', () => {
    const result = parseFeatureChoices(
      feature('圣职', [
        '你将自己投身于所选择的以下一项神圣的角色之中：',
        {
          type: 'entries',
          entries: [
            {
              type: 'options',
              count: 1,
              entries: [
                { type: 'refClassFeature', classFeature: '保护者|牧师|XPHB|1|XPHB' },
                { type: 'refClassFeature', classFeature: '奇术使|牧师|XPHB|1|XPHB' },
              ],
            },
          ],
        },
      ]),
    );
    expect(result.choices[0]).toMatchObject({
      numToChoose: 1,
      options: ['保护者', '奇术使'],
    });
    expect(result.diagnostics).toEqual(['feature-choice-generic:test:classFeature:圣职']);
  });

  it('未识别的选择法条只记录诊断，不抛出异常', () => {
    const result = parseFeatureChoices(
      feature('Strange Choice', ['Choose one omen known only to this ruleset.']),
    );
    expect(result.choices).toEqual([]);
    expect(result.diagnostics).toEqual([
      'feature-choice-unresolved:test:classFeature:Strange Choice',
    ]);
  });

  it('同一特性的不同法条分别保留专精与语言数量', () => {
    const entry = feature('熟练探险家', [
      '{@i 1级游侠可选特性，替代自然探索者特性}',
      {
        name: '精明',
        type: 'entries',
        entries: [
          '你选择一项你拥有熟练的技能，你在使用该技能时所做的任何属性检定中的熟练加值变为两倍。',
          '你还可以额外说、读、写两门额外的自选语言。',
        ],
      },
    ]);
    expect(parseFeatureChoices(entry).choices).toMatchObject([
      { type: 'expertise', numToChoose: 1, filter: 'proficient-skills' },
      { type: 'language', numToChoose: 2, filter: 'type:language' },
    ]);
  });
});
