/** A class choice can be stored under either its catalog ID or its English name. */
import type { CharacterState } from '@/types/characterState';
import type { ClassData } from '@/types/class';
import { getActiveClassFeatures } from './classFeatureActivation';

export function getActiveClassSelections(
  character: CharacterState | null,
  getClass: (id: string) => Pick<ClassData, 'nameEn' | 'features' | 'subClassInfo'> | undefined,
): Record<string, string[]> {
  if (!character) return {};
  const owners: string[] = [];
  const activity = new Map<string, boolean>();
  for (const entry of character.classes) {
    const definition = getClass(entry.classId);
    if (!definition) continue;
    const keys = [entry.classId, definition.nameEn].filter(Boolean);
    owners.push(...keys);
    const register = (features: ClassData['features'], selected = true) => {
      const active = new Set(
        selected ? getActiveClassFeatures(features, character, entry.level) : [],
      );
      for (const feature of features)
        for (const choice of feature.mechanics?.choices || [])
          for (const owner of keys) {
            const key = `cls:${owner}:feat:${feature.name}:${choice.id}`.toLowerCase();
            activity.set(key, active.has(feature) || activity.get(key) === true);
          }
    };
    register(definition.features);
    for (const subclass of definition.subClassInfo?.options || [])
      register(
        subclass.traits || [],
        [subclass.catalogId, subclass.name, subclass.nameEn].includes(entry.subclassId),
      );
  }
  return Object.fromEntries(
    Object.entries(character.classSelections || {}).filter(
      ([key]) => isActiveClassSelection(key, owners) && activity.get(key.toLowerCase()) !== false,
    ),
  );
}
export function isClassSelectionForOwner(key: string, owners: readonly string[]): boolean {
  const lowerKey = key.toLowerCase();
  return owners.some((owner) => lowerKey.startsWith(`cls:${owner.toLowerCase()}:`));
}

export function isActiveClassSelection(key: string, owners: readonly string[]): boolean {
  return !key.toLowerCase().startsWith('cls:') || isClassSelectionForOwner(key, owners);
}
