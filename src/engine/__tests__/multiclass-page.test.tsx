import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { defaultCatalog } from '@/catalog/catalog';
import { normalizeClass } from '@/source/fiveetools-cn/normalizers/class';
import { createBuilderChoices } from '@/catalog/builderChoices';
import type { CharacterState } from '@/types/characterState';

const store = vi.hoisted(() => ({ character: {} as CharacterState, update: vi.fn() }));
vi.mock('react', async (load) => {
  const actual = await load<typeof import('react')>();
  return {
    ...actual,
    useMemo: (fn: () => unknown) => fn(),
    useState: (value: unknown) => [value === false ? true : value, vi.fn()],
    default: { ...actual, useEffect: vi.fn() },
  };
});
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('id=test') }));
vi.mock('@/platform/useBuilderChoices', () => ({
  useBuilderChoices: () => createBuilderChoices({}),
}));
vi.mock('@/store/characterStore', () => ({
  useCharacterStore: () => ({
    characters: { test: store.character },
    updateActiveCharacter: store.update,
    loadCharacter: vi.fn(),
  }),
}));
import MulticlassPage from '@/app/builder/multiclass/page';

const wizard = normalizeClass({ name: '法师', ENG_name: 'Wizard', source: 'XPHB' });
const clerics = ['PHB', 'XPHB'].map((source) =>
  normalizeClass({ name: '牧师', ENG_name: 'Cleric', source, primaryAbility: ['wis'] }),
);
function nodes(node: any): any[] {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}
function text(node: any): string {
  if (node == null || typeof node === 'boolean') return '';
  if (Array.isArray(node)) return node.map(text).join('');
  return typeof node === 'object' ? text(node.props?.children) : String(node);
}
beforeEach(() => {
  defaultCatalog.registerMany([wizard, ...clerics]);
  store.update.mockClear();
  store.character = {
    id: 'test',
    classes: [{ classId: wizard.id, level: 2 }],
    baseAbilityScores: { str: 13, dex: 13, con: 13, int: 13, wis: 13, cha: 13 },
    selectedFeats: [],
  } as unknown as CharacterState;
});

it('兼职候选区分来源，保存精确目录身份且不重复列出当前职业', () => {
  const tree = MulticlassPage();
  const options = nodes(tree).filter((node) => node.props?.className?.includes('mcOption'));
  expect(options).toHaveLength(2);
  expect(text(tree)).toContain('法师Wizard');
  expect(text(tree)).not.toContain(wizard.id);
  for (const entry of clerics) {
    store.update.mockClear();
    const option = options.find((node) => text(node).includes(`Cleric · ${entry.source}`));
    expect(option).toBeDefined();
    option.props.onClick();
    expect(store.update).toHaveBeenCalledWith({
      classes: [
        store.character.classes[0],
        { classId: entry.id, level: 1, isMulticlass: true, source: entry.source },
      ],
    });
  }
});

it('旧英文名存档仍解析名称，已存在的同来源兼职不重复列出', () => {
  store.character.classes.push({ classId: 'Cleric', level: 1, isMulticlass: true });
  const tree = MulticlassPage();
  const options = nodes(tree).filter((node) => node.props?.className?.includes('mcOption'));
  expect(options).toHaveLength(1);
  expect(text(options[0])).toContain('Cleric · PHB');
  expect(text(tree)).toContain('牧师Cleric');
});
