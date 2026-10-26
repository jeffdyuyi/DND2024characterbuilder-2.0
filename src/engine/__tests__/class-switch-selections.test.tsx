import React from 'react';
import { beforeEach, expect, it, vi } from 'vitest';
import { defaultCatalog } from '@/catalog/catalog';
import { createBuilderChoices } from '@/catalog/builderChoices';
import { normalizeClass } from '@/source/fiveetools-cn/normalizers/class';
import type { CharacterState } from '@/types/characterState';
import { isActiveClassSelection, isClassSelectionForOwner } from '../classSelectionScope';
import { computeProficiencies } from '../proficiency';

const store = vi.hoisted(() => ({ character: {} as CharacterState, update: vi.fn() }));
vi.mock('react', async (load) => {
  const actual = await load<typeof import('react')>();
  return {
    ...actual,
    useMemo: (fn: () => unknown) => fn(),
    useState: (value: unknown) => [value, vi.fn()],
    useRef: () => ({ current: null }),
    useEffect: vi.fn(),
  };
});
vi.mock('next/navigation', () => ({ useSearchParams: () => new URLSearchParams('id=test') }));
vi.mock('@/platform/useBuilderChoices', () => ({
  useBuilderChoices: () => createBuilderChoices({}),
}));
vi.mock('@/platform/CatalogProvider', () => ({ useCatalog: () => ({ status: 'ready' }) }));
vi.mock('@/store/characterStore', () => ({
  useCharacterStore: () => ({
    characters: { test: store.character },
    updateActiveCharacter: store.update,
    loadCharacter: vi.fn(),
  }),
}));
vi.mock('@/engine/startingEquipment', () => ({
  normalizeEquipmentMode: (mode: unknown) => mode,
  reconcileStartingEquipment: () => ({}),
}));

import ClassPage from '@/app/builder/class/page';
import OptionCard from '@/components/OptionCard';
import PillButton from '@/components/PillButton';

function nodes(node: any): any[] {
  if (!node || typeof node !== 'object') return [];
  if (Array.isArray(node)) return node.flatMap(nodes);
  return [node, ...nodes(node.props?.children)];
}

const former = normalizeClass({
  name: '旧职业',
  ENG_name: 'Former Class',
  source: 'XPHB',
  startingProficiencies: { skills: [{ choose: { from: ['arcana', 'history'], count: 2 } }] },
});
const next = normalizeClass({
  name: '新职业',
  ENG_name: 'Next Class',
  source: 'PHB',
  startingProficiencies: { skills: [{ choose: { from: ['arcana', 'history'], count: 1 } }] },
});

beforeEach(() => {
  defaultCatalog.registerMany([former, next]);
  store.update.mockClear();
  store.character = {
    id: 'test',
    classes: [{ classId: former.id, level: 1 }],
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    selectedFeats: [],
    selectedSkills: ['perception'],
    selectedLanguages: [],
    equipmentIds: [],
    inventoryEntries: [],
    classSelections: {
      [`cls:${former.id}:base:prof:skills`]: ['arcana'],
      'cls:Former Class:base:prof:skills': ['history'],
      'cls:Next Class:base:prof:skills': ['arcana'],
      'cls:unrelated:base:prof:skills': ['stealth'],
    },
    backgroundSelections: { 'bg:test:prof:skill:0': ['nature'] },
  } as unknown as CharacterState;
});

it('完整职业身份清理旧基础熟练，保留其他来源和手动技能', () => {
  const tree = nodes(ClassPage());
  const nextCard = tree.find(
    (node) => node.type === OptionCard && node.props.subtitle === 'Next Class',
  );
  expect(nextCard).toBeDefined();
  nextCard.props.onClick();
  expect(store.update).toHaveBeenCalledWith(
    expect.objectContaining({
      classes: [expect.objectContaining({ classId: next.id })],
      classSelections: { 'cls:unrelated:base:prof:skills': ['stealth'] },
    }),
  );
  expect(store.character.selectedSkills).toEqual(['perception']);
  expect(store.character.backgroundSelections).toEqual({ 'bg:test:prof:skill:0': ['nature'] });
  const updated = { ...store.character, ...store.update.mock.calls.at(-1)![0] };
  const skills = computeProficiencies(updated).skills.map((skill) => skill.id);
  expect(skills).toContain('perception');
  expect(skills).not.toContain('arcana');
  expect(skills).not.toContain('history');
});

it('旧职业残留键不占用当前职业技能槽', () => {
  store.character.classes = [{ classId: next.id, level: 1, source: 'PHB', isMulticlass: false }];
  const tree = nodes(ClassPage());
  const arcana = tree.find(
    (node) => node.type === PillButton && node.props.children?.[0] === '奥秘（智力）',
  );
  expect(arcana).toBeDefined();
  expect(arcana.props.disabled).toBe(false);
  expect(arcana.props.children).not.toContainEqual(
    expect.objectContaining({ props: expect.objectContaining({ children: '(已选)' }) }),
  );
});

it('目录 ID 中有冒号仍按完整身份匹配，不误判相邻职业', () => {
  expect(
    isClassSelectionForOwner('cls:pack:class:Wizard:XPHB:base:prof:skills', [
      'pack:class:Wizard:XPHB',
    ]),
  ).toBe(true);
  expect(
    isActiveClassSelection('cls:pack:class:Wizard:PHB:base:prof:skills', [
      'pack:class:Wizard:XPHB',
    ]),
  ).toBe(false);
  expect(isActiveClassSelection('manual:skill', [])).toBe(true);
});
