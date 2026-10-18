import { expect, it, vi } from 'vitest';
import { createSpellClassMatcher } from '@/app/builder/spells/spellClassMatcher';
import { getClassDefinition } from '../characterData';
import { defaultCatalog } from '@/catalog/catalog';
import { normalizeClass } from '@/source/fiveetools-cn/normalizers/class';

it('保留目录职业引用匹配结果，重复候选只装配每个完整引用一次', () => {
  const entries = ['PHB', 'XPHB'].map((source) =>
    normalizeClass({ name: '法师', ENG_name: 'Wizard', source }),
  );
  defaultCatalog.registerMany(entries);
  const references = ['Wizard', '法师', ...entries.map((entry) => entry.id), '未解析职业'];
  const oldMatch = (reference: string, target: string) =>
    reference.toLowerCase() === target ||
    getClassDefinition(reference)?.nameEn.toLowerCase() === target;
  const expected = references.map((reference) => oldMatch(reference, 'wizard'));
  const resolve = vi.fn(getClassDefinition);
  const matches = createSpellClassMatcher(resolve);
  for (let i = 0; i < 160; i++) {
    expect(references.map((reference) => matches(reference, 'wizard'))).toEqual(expected);
  }
  expect(resolve.mock.calls.map(([reference]) => reference)).toEqual(references.slice(1));
  expect(matches(entries[0].id, 'cleric')).toBe(false);
  expect(resolve).toHaveBeenCalledTimes(references.length - 1);
});

it('直接英文匹配不装配职业，无法解析的引用也只查询一次', () => {
  const resolve = vi.fn(() => undefined);
  const matches = createSpellClassMatcher(resolve);
  expect(matches('WIZARD', 'wizard')).toBe(true);
  expect(resolve).not.toHaveBeenCalled();
  expect(matches('missing', 'wizard')).toBe(false);
  expect(matches('missing', 'cleric')).toBe(false);
  expect(resolve).toHaveBeenCalledTimes(1);
});

it('新目录快照使用新匹配器，不保留上次未解析的结果', () => {
  const entry = normalizeClass({ name: '快照施法者', ENG_name: 'Snapshot Caster', source: 'XPHB' });
  const oldSnapshot = createSpellClassMatcher(() => undefined);
  expect(oldSnapshot(entry.id, 'snapshot caster')).toBe(false);
  defaultCatalog.register(entry);
  const nextSnapshot = createSpellClassMatcher();
  expect(nextSnapshot(entry.id, 'snapshot caster')).toBe(true);
});
