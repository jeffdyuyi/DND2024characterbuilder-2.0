import { defaultCatalog } from '@/catalog/catalog';
import { resolveCatalogReference } from '@/catalog/references';
import { parseCatalogSpellGrants } from '@/catalog/adapters/spellGrants';
import { buildCharacterFeatSlots } from './featSlots';
import type { CharacterFeatSlot, FeatSlotDefinitions } from './featSlots';
import type { CatalogService } from '@/catalog/types';
import type { CharacterState } from '@/types/characterState';
import type { ParsedSpellGrants } from '@/types/spellGrant';

export interface FeatSlotSpellGrantSources {
  sources: {
    slot: CharacterFeatSlot;
    /** 专长法术的解锁上下文是角色总等级，取得专长的职业等级保留在slot中。 */
    characterLevel: number;
    grants: ParsedSpellGrants;
  }[];
  diagnostics: { code: string; ownerId: string; reference: string }[];
}

/** 将原页面的有效槽位关联到原生规则；不选择分支/法术，不写入或替换任何存档。 */
export function collectFeatSlotSpellGrantSources(
  character: CharacterState,
  definitions: FeatSlotDefinitions,
  catalog: CatalogService = defaultCatalog,
): FeatSlotSpellGrantSources {
  const result: FeatSlotSpellGrantSources = { sources: [], diagnostics: [] };
  const report = (code: string, ownerId: string, reference: string) =>
    result.diagnostics.push({ code, ownerId, reference });
  if (character.classes.some((entry) => !Number.isInteger(entry.level) || entry.level < 1)) {
    report('unresolved-character-level', character.id, 'classes');
    return result;
  }
  const characterLevel = character.classes.reduce((sum, entry) => sum + entry.level, 0) || 1;
  const slots = buildCharacterFeatSlots(character, definitions);
  const counts = new Map<string, number>();
  slots.forEach((slot) => counts.set(slot.id, (counts.get(slot.id) || 0) + 1));
  for (const slot of slots) {
    if (!slot.currentFeatId) continue;
    if (counts.get(slot.id)! > 1) {
      report('ambiguous-feat-slot', slot.id, slot.currentFeatId);
      continue;
    }
    const feat = resolveCatalogReference(catalog, slot.currentFeatId, ['feat']);
    if (!feat) {
      report('unresolved-feat', slot.id, slot.currentFeatId);
      continue;
    }
    if (slot.id === 'background-feat') {
      const origin = resolveCatalogReference(catalog, character.originFeatId, ['feat']);
      if (!origin) {
        report('unverified-background-feat', slot.id, slot.currentFeatId);
        continue;
      }
      if (origin.id !== feat.id) {
        report('conflicting-background-feat', slot.id, slot.currentFeatId);
        continue;
      }
    }
    if (feat.raw.additionalSpells === undefined && feat.raw.attachedSpells === undefined) continue;
    result.sources.push({ slot, characterLevel, grants: parseCatalogSpellGrants(feat) });
  }
  for (const [slotId, choices] of Object.entries(character.featSelections || {})) {
    if (choices.featId && !counts.has(slotId))
      report('unverified-feat-slot', slotId, choices.featId);
  }
  return result;
}
