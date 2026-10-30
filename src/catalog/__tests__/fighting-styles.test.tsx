import React from 'react';
import { expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { matchingFightingStyles, featFightingStyleChoices } from '../fightingStyles';
import type { CharacterOptionDefinition } from '../adapters/characterOptions';
import FightingStyleChoice from '@/components/FightingStyleChoice';
import { flattenEntries } from '@/source/fiveetools-cn/utils';
import { parseClassSpellTables } from '../adapters/classSpellTables';
import { getOccupiedFightingStyleIds } from '@/engine/fightingStyleSelections';
import type { CharacterState } from '@/types/characterState';

const style = (source: string): CharacterOptionDefinition => ({
  id: `style:${source}`,
  kind: 'optionalfeature',
  name: '测试风格',
  nameEn: 'Test Style',
  source,
  description: '完整风格正文。',
  featureTypes: ['FS:F'],
  prerequisites: [],
  isHomebrew: false,
  automationStatus: 'manual',
  raw: {},
});

it('传统风格保留来源身份、旧名称读回、完整详情及多来源筛选', () => {
  const pool = [style('PHB'), style('TCE')];
  expect(matchingFightingStyles(pool, ['测试风格|TCE']).map((entry) => entry.id)).toEqual([
    'style:TCE',
  ]);
  const html = renderToStaticMarkup(
    <FightingStyleChoice options={pool} selected={['Test Style']} onChange={() => {}} />,
  );
  expect(html).toContain('来源筛选');
  expect(html).toContain('完整风格正文');
  expect(html).toContain('战斗风格');
  expect(matchingFightingStyles(pool, undefined, ['EI'])).toEqual([]);
  const character = {
    classes: [],
    classSelections: { 'manual:style': ['style:TCE'] },
  } as unknown as CharacterState;
  expect(getOccupiedFightingStyleIds(character, pool, 'other-slot')).toEqual([
    'style:PHB',
    'style:TCE',
  ]);
  expect(getOccupiedFightingStyleIds(character, pool, 'manual:style')).toEqual([]);
});

it('专长按原生职业风格类型和数量产生独立选择，不误用战斗风格专长', () => {
  const raw = {
    optionalfeatureProgression: [
      { name: '战斗风格', featureType: ['FS:F'], progression: { '*': 1 } },
    ],
  };
  expect(featFightingStyleChoices(raw)).toEqual([
    { id: 'optionalfeature:0', name: '战斗风格', types: ['FS:F'], count: 1 },
  ]);
  expect(
    featFightingStyleChoices({
      optionalfeatureProgression: [{ featureType: ['EI'], progression: { '*': 2 } }],
    }),
  ).toEqual([]);
});

it('DC和法术攻击节点显示公式，既有命名正文仍完整保留', () => {
  const entries = [
    {
      type: 'entries',
      name: '施法属性',
      entries: [
        '你的施法属性是感知。',
        { type: 'abilityDc', name: '法术', attributes: ['wis'] },
        { type: 'abilityAttackMod', name: '法术', attributes: ['wis'] },
      ],
    },
  ];
  const before = JSON.stringify(entries);
  const text = flattenEntries(entries);
  expect(text).toContain('法术豁免 DC = 8 + 熟练加值 + 感知调整值');
  expect(text).toContain('法术攻击加值 = 熟练加值 + 感知调整值');
  expect(text).toContain('你的施法属性是感知。');
  expect(text).not.toContain('【法术】');
  expect(JSON.stringify(entries)).toBe(before);
});

it('含自选语句的表格单元格不误作固定授予，并输出诊断', () => {
  const parsed = parseClassSpellTables({
    entries: [
      '你学会下表法术，不占用职业已知法术。',
      {
        type: 'table',
        colLabels: ['职业等级', '法术'],
        rows: [['3', '选择{@spell 测试甲}或{@spell 测试乙}']],
      },
    ],
  });
  expect(parsed.spells).toEqual([]);
  expect(parsed.diagnostics).toHaveLength(1);
});
