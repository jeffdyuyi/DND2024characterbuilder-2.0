import { defaultCatalog } from '../catalog';
import { CatalogEntry, EntryKind } from '../types';

export const CHARACTER_OPTION_KINDS = [
  'optionalfeature',
  'charoption',
  'reward',
  'boon',
  'cult',
] as const;
export type CharacterOptionKind = (typeof CHARACTER_OPTION_KINDS)[number];

export interface CharacterOptionDefinition {
  id: string;
  kind: CharacterOptionKind;
  name: string;
  nameEn?: string;
  source: string;
  description: string;
  type?: string;
  featureTypes: string[];
  prerequisites: unknown[];
  isHomebrew: boolean;
  automationStatus: 'manual' | 'structured';
  raw: Record<string, unknown>;
}

export function catalogEntryToCharacterOption(entry: CatalogEntry): CharacterOptionDefinition {
  const raw = entry.raw as any;
  const featureTypes = [
    ...(Array.isArray(raw.featureType)
      ? raw.featureType
      : raw.featureType
        ? [raw.featureType]
        : []),
    ...(Array.isArray(raw.optionType) ? raw.optionType : raw.optionType ? [raw.optionType] : []),
  ];
  return {
    id: entry.id,
    kind: entry.kind as CharacterOptionKind,
    name: entry.name,
    nameEn: entry.englishName,
    source: entry.source,
    description: entry.description || '',
    type: raw.type,
    featureTypes,
    prerequisites: Array.isArray(raw.prerequisite) ? raw.prerequisite : [],
    isHomebrew: Boolean(entry.isHomebrew),
    automationStatus: raw.mechanics ? 'structured' : 'manual',
    raw: entry.raw,
  };
}

export function getCatalogCharacterOptions(options?: {
  kind?: CharacterOptionKind;
  source?: string;
}): CharacterOptionDefinition[] {
  const kinds: EntryKind[] = options?.kind ? [options.kind] : [...CHARACTER_OPTION_KINDS];
  return kinds
    .flatMap((kind) => defaultCatalog.list(kind, { source: options?.source }))
    .map(catalogEntryToCharacterOption)
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
}

/**
 * 检索可选特性 (Optional Features)
 * @param featureType 可选特性类型代码，如 'EI' 代表魔能祈唤 (Eldritch Invocations)
 */
export function getCatalogOptionalFeatures(
  featureType?: string,
  source?: string,
): CharacterOptionDefinition[] {
  const all = getCatalogCharacterOptions({ kind: 'optionalfeature', source });
  if (!featureType) return all;
  const target = featureType.toUpperCase();
  return all.filter((opt) => opt.featureTypes.some((t) => t.toUpperCase() === target));
}
