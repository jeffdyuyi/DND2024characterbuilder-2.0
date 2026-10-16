import { expect, it, vi } from 'vitest';
import { getSpeciesSpellSelections } from '../speciesSpellSelections';
import type { CharacterState } from '@/types/characterState';

vi.mock('../ability', () => ({ computeAbilityScores: () => ({ modifiers: {} }) }));
vi.mock('../characterData', async (load) => ({
  ...(await load<typeof import('../characterData')>()),
  getSpeciesDefinition: () => ({
    traits: [
      {
        id: 'magic',
        features: {
          spells: [
            {
              numToChoose: 1,
              options: [
                { spellId: 'first', level: 1, isPrepared: true },
                { spellId: 'second', level: 1, isPrepared: true },
              ],
            },
            { numToChoose: 1, options: [{ spellId: 'second', level: 1, isPrepared: false }] },
            { spellId: 'fixed', level: 1 },
          ],
        },
      },
    ],
  }),
  getSubspeciesDefinition: () => undefined,
}));
import { getInnateSpells } from '../spellcasting';

const read = (saved: Record<string, string[]>, index = 0, count = 2) =>
  getSpeciesSpellSelections(saved, 'species', 'sub', 'magic', index, count);

it('isolates each spell slot and ignores another species or similarly named trait', () => {
  const saved = {
    'sp:species:trait:magic:spell-0': ['first'],
    'sp:species:trait:magic:spell-1': ['second'],
    'sp:old:trait:magic:spell-0': ['old-species'],
    'sp:species:trait:othermagic:spell-0': ['other-trait'],
  };
  expect(read(saved)).toEqual(['first']);
  expect(read(saved, 1)).toEqual(['second']);
  expect(saved['sp:old:trait:magic:spell-0']).toEqual(['old-species']);
});

it('does not resurrect legacy spells after an explicit cancellation', () => {
  expect(read({ 'sp:species:trait:magic:spell-0': [], 'magic:spell-0': ['old'] })).toEqual([]);
});

it('uses one legacy record in the same order as the existing page, without merging mirrors', () => {
  expect(
    read({
      'sp:species:sub:sub:spell-0': ['sub', 'sub'],
      'sp:species:trait:innate-spells:spell-0': ['mirror'],
      'magic:spell-0': ['old'],
    }),
  ).toEqual(['sub']);
  expect(read({ 'magic:spell-0': ['old'] })).toEqual(['old']);
});

it('accepts unnumbered historical records only when the choice has a unique owner', () => {
  expect(read({ magic: ['old'] }, 0, 1)).toEqual(['old']);
  expect(read({ magic: ['ambiguous'] })).toEqual([]);
  expect(read({ 'sp:old:trait:magic:spell-0': ['old-species'] })).toEqual([]);
});

it('production grants keep slot-specific preparation and cancellation after a JSON round trip', () => {
  const character = {
    speciesId: 'species',
    classes: [],
    speciesSelections: {
      'sp:species:trait:magic:spell-0': [],
      'sp:species:trait:magic:spell-1': ['second'],
      'magic:spell-0': ['first'],
    },
  } as unknown as CharacterState;
  const snapshot = JSON.stringify(character);
  expect(getInnateSpells(JSON.parse(snapshot))).toEqual([
    expect.objectContaining({ spellId: 'second', isPrepared: false }),
    expect.objectContaining({ spellId: 'fixed', isPrepared: true }),
  ]);
  expect(JSON.stringify(character)).toBe(snapshot);
});
