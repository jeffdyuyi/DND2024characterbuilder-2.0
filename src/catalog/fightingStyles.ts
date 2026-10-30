import type { CharacterOptionDefinition } from './adapters/characterOptions';

export function matchingFightingStyles(
  pool: CharacterOptionDefinition[],
  references?: string[],
  featureTypes?: string[],
) {
  return pool.filter(
    (entry) =>
      entry.kind === 'optionalfeature' &&
      entry.featureTypes.some((type) =>
        featureTypes?.length ? featureTypes.includes(type) : type.startsWith('FS:'),
      ) &&
      (!references?.length ||
        references.some((reference) => matchesStyleReference(entry, reference))),
  );
}

export function matchesStyleReference(entry: CharacterOptionDefinition, reference: string) {
  if (entry.id === reference) return true;
  const [name, source] = reference.split('|');
  return (
    (!source || entry.source.toLowerCase() === source.toLowerCase()) &&
    [entry.name, entry.nameEn].some((value) => value?.toLowerCase() === name.toLowerCase())
  );
}

/** 只读取原生类型与数量，不按专长名称推断风格表。 */
export function featFightingStyleChoices(raw: Record<string, any>) {
  return (
    Array.isArray(raw.optionalfeatureProgression) ? raw.optionalfeatureProgression : []
  ).flatMap((group: any, index: number) => {
    const types = Array.isArray(group.featureType) ? group.featureType : [];
    const count = group.progression?.['*'];
    return types.length &&
      types.every((type: unknown) => typeof type === 'string' && type.startsWith('FS:')) &&
      Number.isInteger(count) &&
      count > 0
      ? [{ id: `optionalfeature:${index}`, name: group.name || group.ENG_name, types, count }]
      : [];
  });
}
