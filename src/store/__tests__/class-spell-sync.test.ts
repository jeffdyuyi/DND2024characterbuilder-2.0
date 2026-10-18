import { beforeEach, expect, it } from 'vitest';
import { useCharacterStore } from '../characterStore';
import type { CharacterState } from '@/types/characterState';

const initial = (): CharacterState =>
  ({
    id: 'class-spell-sync',
    classes: [
      { classId: 'primary-record', source: 'XPHB', level: 3 },
      { classId: 'secondary-record', source: 'XPHB', level: 1 },
    ],
    cantripIds: ['new-cantrip', 'manual-cantrip'],
    preparedSpellIds: ['new-spell', 'future-spell', 'shared', 'secondary-only', 'manual-spell'],
    spellbookIds: ['book-one', 'book-two', 'book-three'],
    spellsByLevel: {
      'primary-record': {
        1: {
          cantrips: ['old-cantrip'],
          spells: ['old-spell', 'shared', 'manually-unprepared'],
          extra: { wizard_spellbook_lvl1: ['book-one'] },
        },
        2: {
          cantrips: ['new-cantrip'],
          spells: ['new-spell'],
          replacedCantrip: 'old-cantrip',
          replacedSpell: 'old-spell',
          extra: { wizard_spellbook_lvl2: ['book-two'] },
        },
        3: {
          cantrips: [],
          spells: ['future-spell'],
          extra: { wizard_spellbook_lvl3: ['book-three'] },
        },
      },
      'secondary-record': { 1: { cantrips: [], spells: ['shared', 'secondary-only'] } },
    },
  }) as unknown as CharacterState;

beforeEach(() => {
  const character = initial();
  useCharacterStore.setState({
    characters: { [character.id]: character },
    activeCharacterId: character.id,
  });
});
const saved = () => useCharacterStore.getState().characters['class-spell-sync'];

it('真实存储动作在降级时停用未来法术和替换，升级时恢复逐级记录', () => {
  const originalHistory = JSON.stringify(saved().spellsByLevel);
  useCharacterStore.getState().updateActiveCharacter({
    classes: saved().classes.map((entry) => ({ ...entry, level: 1 })),
  });
  expect(saved().cantripIds).toEqual(['manual-cantrip', 'old-cantrip']);
  expect(saved().preparedSpellIds).toEqual([
    'shared',
    'secondary-only',
    'manual-spell',
    'old-spell',
  ]);
  expect(saved().spellbookIds).toEqual(['book-one']);
  expect(JSON.stringify(saved().spellsByLevel)).toBe(originalHistory);
  useCharacterStore.getState().updateActiveCharacter({
    classes: saved().classes.map((entry, index) => ({ ...entry, level: index === 0 ? 3 : 1 })),
  });
  expect(saved().cantripIds).toEqual(['manual-cantrip', 'new-cantrip']);
  expect(saved().preparedSpellIds).toEqual([
    'shared',
    'secondary-only',
    'manual-spell',
    'new-spell',
    'future-spell',
  ]);
  expect(saved().preparedSpellIds).not.toContain('manually-unprepared');
  expect(saved().spellbookIds).toEqual(['book-one', 'book-two', 'book-three']);
  expect(JSON.stringify(saved().spellsByLevel)).toBe(originalHistory);
});

it('移除兼职仅停用该职业独有法术，共享来源、手动记录及历史保留', () => {
  useCharacterStore.getState().updateActiveCharacter({ classes: saved().classes.slice(0, 1) });
  expect(saved().preparedSpellIds).not.toContain('secondary-only');
  expect(saved().preparedSpellIds).toContain('shared');
  expect(saved().preparedSpellIds).toContain('manual-spell');
  expect(saved().spellsByLevel?.['secondary-record']).toBeDefined();
});

it('同次显式提供的手动法表优先，无逐级记录的旧存档不清理', () => {
  useCharacterStore.getState().updateActiveCharacter({
    classes: saved().classes.map((entry) => ({ ...entry, level: 1 })),
    preparedSpellIds: ['explicit-manual'],
  });
  expect(saved().preparedSpellIds).toEqual(['explicit-manual']);
  useCharacterStore.setState({
    characters: { 'class-spell-sync': { ...saved(), spellsByLevel: undefined } },
  });
  useCharacterStore.getState().updateActiveCharacter({ classes: saved().classes.slice(0, 1) });
  expect(saved().preparedSpellIds).toEqual(['explicit-manual']);
});
