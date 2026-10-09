import { describe, expect, it } from 'vitest';
import { parseFeatureChoices } from '../adapters/featureChoicesParser';
import { normalizeClass } from '@/source/fiveetools-cn/normalizers/class';
import type { CatalogEntry } from '../types';

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
  it.each([
    {
      name: 'Weapon Training',
      text: 'Choose three kinds of Simple or Martial weapons. You can use the Mastery property of the chosen weapons.',
      expected: { type: 'weaponMastery', numToChoose: 3, filter: 'proficient-weapons' },
    },
    {
      name: 'Style Training',
      text: 'You gain a Fighting Style feat of your choice.',
      expected: { type: 'fightingStyle', numToChoose: 1, filter: 'category:Fighting Style' },
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
      options: ['Archery', 'Defense'],
    });
    expect(result.diagnostics).toEqual([]);
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
});
