import { expect, it } from 'vitest';
import { getActiveClassFeatures } from '../classFeatureActivation';
import { buildCharacterFeatSlots } from '../featSlots';
import type { ClassFeature } from '@/types/class';
import type { CharacterState } from '@/types/characterState';

const features: ClassFeature[] = [
  { catalogId: 'base', name: '基础特性', level: 1, description: '' },
  {
    catalogId: 'variant',
    name: '替换特性',
    level: 1,
    description: '',
    isOptional: true,
    replacesFeatureName: '基础特性',
    mechanics: { choices: [{ id: 'bonus', type: 'feat', numToChoose: 1, options: [] }] },
  },
  { catalogId: 'improvement', name: '增效', level: 6, description: '', isOptional: true },
];

it('可选特性默认关闭，逐级独立启用，明确替换且降级不提前替换', () => {
  expect(getActiveClassFeatures(features, {}, 6).map((f) => f.catalogId)).toEqual(['base']);
  const state = { enabledOptionalClassFeatureIds: ['variant'] };
  expect(getActiveClassFeatures(features, state, 6).map((f) => f.catalogId)).toEqual(['variant']);
  state.enabledOptionalClassFeatureIds = ['improvement'];
  expect(getActiveClassFeatures(features, state, 6).map((f) => f.catalogId)).toEqual([
    'base',
    'improvement',
  ]);
  expect(getActiveClassFeatures(features, state, 1).map((f) => f.catalogId)).toEqual(['base']);
  expect(
    getActiveClassFeatures(
      features,
      { enabledOptionalClassFeatureIds: ['other-source:variant'] },
      6,
    ).map((f) => f.catalogId),
  ).toEqual(['base']);
});

it('关闭后保留旧选择但不提供专长槽位，重载并开启后恢复', () => {
  const character = {
    classes: [{ classId: 'test', level: 6 }],
    classSelections: {},
    featSelections: {},
    enabledOptionalClassFeatureIds: [],
  } as unknown as CharacterState;
  const definitions = { getClass: () => ({ name: '测试职业', features }) };
  expect(buildCharacterFeatSlots(character, definitions)).toHaveLength(0);
  character.enabledOptionalClassFeatureIds = ['variant'];
  const opened = JSON.parse(JSON.stringify(character));
  expect(buildCharacterFeatSlots(opened, definitions)).toHaveLength(1);
  character.enabledOptionalClassFeatureIds = [];
  expect(buildCharacterFeatSlots(character, definitions)).toHaveLength(0);
});
