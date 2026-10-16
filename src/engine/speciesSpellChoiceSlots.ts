import type { CharacterState } from '@/types/characterState';
import { getSpeciesDefinition } from './characterData';
import { getSpeciesSpellSelections } from './speciesSpellSelections';

/** 仅复用来源页已有明确候选的母种族槽位；不推断条件、默认或长休替换。 */
export function getSpeciesSpellChoiceSlots(character: CharacterState) {
  if (!character.speciesId || character.subspeciesId) return [];
  const species = getSpeciesDefinition(character);
  const level = character.classes?.reduce((sum, entry) => sum + entry.level, 0) || 1;
  return (species?.traits || []).flatMap((trait) => {
    if (trait.options?.length || trait.representsSubSpecies || (trait.level || 0) > level)
      return [];
    const spells = trait.features?.spells || [];
    const choiceCount = spells.filter((entry: any) => entry && 'numToChoose' in entry).length;
    return spells.flatMap((choice: any, index: number) => {
      if (
        !choice ||
        !Number.isInteger(choice.numToChoose) ||
        choice.numToChoose < 1 ||
        choice.filter ||
        choice.isLongRestChoice ||
        choice.defaultSpellId ||
        choice.defaultSpellName ||
        !Array.isArray(choice.options) ||
        !choice.options.length ||
        choice.options.some(
          (option: any) =>
            !option ||
            typeof option.spellId !== 'string' ||
            typeof option.level !== 'number' ||
            option.level > level,
        )
      )
        return [];
      const traitId = trait.id || trait.name;
      return [
        {
          key: `sp:${character.speciesId}:trait:${traitId}:spell-${index}`,
          label: trait.name,
          count: choice.numToChoose as number,
          optionIds: [...new Set<string>(choice.options.map((option: any) => option.spellId))],
          selectedIds: getSpeciesSpellSelections(
            character.speciesSelections,
            character.speciesId,
            character.subspeciesId,
            traitId,
            index,
            choiceCount,
          ),
        },
      ];
    });
  });
}
