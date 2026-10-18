import type { ClassData } from '@/types/class';
import type { AbilityScores } from '@/types/characterState';
import { normalizeAbilityKey } from '@/engine/terminology';

type Requirement = Record<string, number>;
const ABILITIES = new Set(['str', 'dex', 'con', 'int', 'wis', 'cha']);

function scoresFromObject(value: unknown): Requirement | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value);
  if (!entries.length || entries.some(([key]) => !ABILITIES.has(key.toLowerCase())))
    return undefined;
  const scores: Requirement = {};
  for (const [key, threshold] of entries) {
    if (threshold === true) scores[key.toLowerCase()] = 13;
    else if (typeof threshold === 'number' && Number.isFinite(threshold) && threshold > 0)
      scores[key.toLowerCase()] = threshold;
    else return undefined;
  }
  return scores;
}

/** Preserve native AND/OR groups instead of flattening abilities into one list. */
export function parseMulticlassRequirements(
  nativeRequirements: unknown,
  primaryAbility: unknown,
): Requirement[] | undefined {
  if (
    nativeRequirements &&
    typeof nativeRequirements === 'object' &&
    !Array.isArray(nativeRequirements)
  ) {
    const { or, ...required } = nativeRequirements as Record<string, unknown>;
    const base = Object.keys(required).length ? scoresFromObject(required) : {};
    if (!base) return undefined;
    if (or === undefined) return Object.keys(base).length ? [base] : undefined;
    if (!Array.isArray(or) || !or.length) return undefined;
    const parsed = or.map(scoresFromObject);
    if (parsed.some((group) => !group)) return undefined;
    const alternatives = parsed.flatMap((group) =>
      Object.entries(group!).map(([key, value]) => ({ ...base, [key]: value })),
    );
    return alternatives.length ? alternatives : undefined;
  }

  const groups = Array.isArray(primaryAbility) ? primaryAbility : [primaryAbility];
  const parsed = groups.map((group) =>
    typeof group === 'string'
      ? scoresFromObject({ [group.toLowerCase()]: 13 })
      : scoresFromObject(group),
  );
  return parsed.length && parsed.every(Boolean) ? (parsed as Requirement[]) : undefined;
}

export function meetsMulticlassRequirements(
  definition: ClassData | undefined,
  scores: Partial<AbilityScores> | undefined,
): boolean {
  if (!definition || !scores) return false;
  const groups = definition.multiclassAbilityRequirements;
  if (groups?.length)
    return groups.some((group) =>
      Object.entries(group).every(
        ([ability, threshold]) => (scores[ability as keyof AbilityScores] ?? 0) >= threshold,
      ),
    );
  return definition.primaryAbility.some((ability) => {
    const key = normalizeAbilityKey(ability);
    return key ? (scores[key as keyof AbilityScores] ?? 0) >= 13 : false;
  });
}
