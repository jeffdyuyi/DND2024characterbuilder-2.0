import type { CharacterState } from '@/types/characterState';
import type { SpellcastingStats } from './spellcasting';

export function getSpellSlotResources(character: CharacterState, stats: SpellcastingStats) {
  const standard = stats.standardSpellSlots ?? stats.spellSlots;
  const pact = stats.pactMagicSlots ?? {};
  const hasPact = Object.values(pact).some((count) => count > 0);
  const legacy =
    !character.spellSlotUsageByPool &&
    hasPact &&
    Object.values(character.spellSlotUsage || {}).some((used) => used > 0);
  return {
    standard,
    pact,
    legacy,
    separate: Boolean(character.spellSlotUsageByPool) || hasPact,
    usage: character.spellSlotUsageByPool ?? {
      standard: hasPact ? {} : character.spellSlotUsage || {},
      pact: {},
    },
  };
}
