import type { CharacterState } from '@/types/characterState';
import type { CharacterOptionDefinition } from '@/catalog/adapters/characterOptions';
import { defaultCatalog } from '@/catalog/catalog';
import {
  featFightingStyleChoices,
  matchesStyleReference,
  matchingFightingStyles,
} from '@/catalog/fightingStyles';
import { getActiveClassSelections } from './classSelectionScope';
import { buildCharacterFeatSlots } from './featSlots';
import { getBackgroundDefinition, getClassDefinition, getSpeciesDefinition } from './characterData';

/** 其他有效槽位已获得的传统风格；不修改历史选择。 */
export function getOccupiedFightingStyleIds(
  character: CharacterState,
  pool: CharacterOptionDefinition[],
  currentKey: string,
) {
  pool = matchingFightingStyles(pool);
  const saved = Object.entries(getActiveClassSelections(character, getClassDefinition))
    .filter(([key]) => key !== currentKey)
    .flatMap(([, values]) => values);
  const slots = buildCharacterFeatSlots(character, {
    background: getBackgroundDefinition(character),
    species: getSpeciesDefinition(character),
    getClass: getClassDefinition,
  });
  for (const slot of slots) {
    const choices = character.featSelections?.[slot.id];
    if (!choices || choices.featId !== slot.currentFeatId) continue;
    for (const group of featFightingStyleChoices(defaultCatalog.get(choices.featId)?.raw || {})) {
      if (`${slot.id}:${group.id}` !== currentKey)
        saved.push(...(choices.optionalFeatures?.[group.id] || []));
    }
  }
  const knownNames = new Set(
    pool
      .filter((entry) => saved.some((id) => matchesStyleReference(entry, id)))
      .map((entry) => (entry.nameEn || entry.name).toLowerCase()),
  );
  return pool
    .filter((entry) => knownNames.has((entry.nameEn || entry.name).toLowerCase()))
    .map((entry) => entry.id);
}
