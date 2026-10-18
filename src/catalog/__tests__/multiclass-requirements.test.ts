import { expect, it } from 'vitest';
import { catalogEntryToClass } from '../adapters/classes';
import { meetsMulticlassRequirements } from '../multiclassRequirements';
import { normalizeClass } from '@/source/fiveetools-cn/normalizers/class';

function definition(source: string, requirements?: unknown, primaryAbility?: unknown) {
  return catalogEntryToClass(
    normalizeClass({
      name: '兼职条件测试职业',
      source,
      ...(requirements ? { multiclassing: { requirements } } : {}),
      ...(primaryAbility ? { primaryAbility } : {}),
    }),
  );
}

it('2014 原生单项、同时满足和任选条件分别计算', () => {
  const druid = definition('PHB', { wis: 13 });
  const monk = definition('PHB', { dex: 13, wis: 13 });
  const fighter = definition('PHB', { or: [{ str: 13, dex: 13 }] });
  expect(druid.primaryAbility).toEqual(['wis']);
  expect(meetsMulticlassRequirements(druid, { str: 13, wis: 12 })).toBe(false);
  expect(meetsMulticlassRequirements(druid, { str: 8, wis: 13 })).toBe(true);
  expect(meetsMulticlassRequirements(monk, { dex: 13, wis: 12 })).toBe(false);
  expect(meetsMulticlassRequirements(monk, { dex: 13, wis: 13 })).toBe(true);
  expect(meetsMulticlassRequirements(fighter, { str: 13, dex: 8 })).toBe(true);
  expect(meetsMulticlassRequirements(fighter, { str: 8, dex: 13 })).toBe(true);
  expect(meetsMulticlassRequirements(fighter, { str: 12, dex: 12 })).toBe(false);
});

it('2024 对象要求同时满足，对象数组允许任选', () => {
  const monk = definition('XPHB', undefined, { dex: true, wis: true });
  const fighter = definition('XPHB', undefined, [{ str: true }, { dex: true }]);
  expect(meetsMulticlassRequirements(monk, { dex: 13, wis: 12 })).toBe(false);
  expect(meetsMulticlassRequirements(monk, { dex: 13, wis: 13 })).toBe(true);
  expect(meetsMulticlassRequirements(fighter, { str: 8, dex: 13 })).toBe(true);
  expect(meetsMulticlassRequirements(fighter, { str: 12, dex: 12 })).toBe(false);
});

it('不识别的原生条件不部分套用，旧自定义职业保持原有门槛', () => {
  const malformed = definition('PHB', { wis: 13, or: [{ str: 13 }, { other: 13 }] });
  expect(malformed.multiclassAbilityRequirements).toBeUndefined();
  const custom = definition('HB', undefined, ['cha']);
  expect(meetsMulticlassRequirements(custom, { cha: 13 })).toBe(true);
});
