import { CatalogEntry, CatalogService } from '../types';
import { ClassFeature, ClassLevelProgression, SubClass } from '@/types/class';
import { getFeatureMechanicsOverlay } from '@/mechanics-overlay/features';
import { parseFeatureChoices } from './featureChoicesParser';
import { belongsToClass, createClassFeatureLookup } from './classReferences';

type FeatureLookups = { classFeature: ReturnType<typeof createClassFeatureLookup>; subclassFeature: ReturnType<typeof createClassFeatureLookup> };

type RefValue = string | { classFeature?: string; subclassFeature?: string; gainSubclassFeature?: boolean };

function refText(ref: RefValue, kind: 'classFeature' | 'subclassFeature'): string {
  return typeof ref === 'string' ? ref : String(ref?.[kind] || '');
}

function toFeature(entry: CatalogEntry): ClassFeature {
  const raw = entry.raw as any;
  const overlay = getFeatureMechanicsOverlay(entry);
  const parsed = parseFeatureChoices(entry);
  const existingChoices = Array.isArray(raw.mechanics?.choices) ? raw.mechanics.choices : [];
  return {
    name: entry.name,
    nameEn: entry.englishName || entry.name,
    level: Number(raw.level || 0),
    description: entry.description || '',
    source: entry.source,
    mechanics: (overlay || parsed.choices.length > 0 || raw.mechanics) ? {
      ...(raw.mechanics || {}),
      ...(parsed.choices.length > 0 ? { choices: [...existingChoices, ...parsed.choices] } : {}),
      ...(overlay || {}),
    } : undefined,
    options: raw.options,
  };
}

export interface ClassAssemblyResult {
  features: ClassFeature[];
  progression: ClassLevelProgression[];
  subclasses: SubClass[];
  subclassUnlockLevel: number;
  unresolvedReferences: string[];
  choiceDiagnostics: string[];
  referenceFailures: ClassReferenceFailure[];
}

export interface ClassReferenceFailure {
  ownerId: string;
  parentClassId?: string;
  kind: 'classFeature' | 'subclassFeature';
  reference: string;
  referenceIndex: number;
}

export interface ClassAssemblyDiagnostics {
  unresolvedReferences: string[];
  choiceParsing: string[];
  referenceFailures: ClassReferenceFailure[];
}

/** 汇总所有已注册职业的装配诊断，供 Catalog 状态层与数据审计使用。 */
export function collectClassAssemblyDiagnostics(catalog: CatalogService): ClassAssemblyDiagnostics {
  const unresolvedReferences: string[] = [];
  const choiceParsing: string[] = [];
  const referenceFailures: ClassReferenceFailure[] = [];

  const lookups = { classFeature: createClassFeatureLookup(catalog), subclassFeature: createClassFeatureLookup(catalog, true) };
  for (const entry of catalog.list('class')) {
    if (entry.sourcePackId === 'legacy') continue;
    const assembled = assembleCatalogClass(entry, catalog, lookups);
    unresolvedReferences.push(...assembled.unresolvedReferences.map((value) => `${entry.id}:${value}`));
    choiceParsing.push(...assembled.choiceDiagnostics.map((value) => `${entry.id}:${value}`));
    referenceFailures.push(...assembled.referenceFailures.map(value => ({ ...value, parentClassId: entry.id })));
  }

  return {
    unresolvedReferences: Array.from(new Set(unresolvedReferences)),
    choiceParsing: Array.from(new Set(choiceParsing)),
    referenceFailures,
  };
}

/** 将 5etools 的引用数组与独立特性条目组装为 UI/引擎可消费的职业树。 */
export function assembleCatalogClass(entry: CatalogEntry, catalog: CatalogService, lookups?: FeatureLookups): ClassAssemblyResult {
  const raw = entry.raw as any;
  const unresolvedReferences: string[] = [];
  const choiceDiagnostics: string[] = [];
  const referenceFailures: ClassReferenceFailure[] = [];
  const findClassFeature = lookups?.classFeature || createClassFeatureLookup(catalog);
  const findSubclassFeature = lookups?.subclassFeature || createClassFeatureLookup(catalog, true);

  const featureRefs: RefValue[] = Array.isArray(raw.classFeatures) ? raw.classFeatures : [];
  const features = featureRefs.flatMap((ref, referenceIndex) => {
    const text = refText(ref, 'classFeature');
    const found = findClassFeature(text, entry);
    if (!found) {
      if (text) unresolvedReferences.push(`classFeature:${text}`);
      if (text) referenceFailures.push({ ownerId: entry.id, kind: 'classFeature', reference: text, referenceIndex });
      return [];
    }
    const feature = toFeature(found);
    choiceDiagnostics.push(...parseFeatureChoices(found).diagnostics);
    return [feature];
  });

  const subclassCatalogEntries = catalog.list('subclass').filter(subclass => belongsToClass(subclass, entry));

  let subclassUnlockLevel = 20;
  for (const ref of featureRefs) {
    if (typeof ref === 'object' && ref.gainSubclassFeature) {
      const level = Number(refText(ref, 'classFeature').split('|')[3] || 0);
      if (level > 0) subclassUnlockLevel = Math.min(subclassUnlockLevel, level);
    }
  }

  const subclasses = subclassCatalogEntries.map((subclass): SubClass => {
    const subRaw = subclass.raw as any;
    const refs: RefValue[] = Array.isArray(subRaw.subclassFeatures) ? subRaw.subclassFeatures : [];
    for (const ref of refs) {
      const level = Number(refText(ref, 'subclassFeature').split('|')[5] || 0);
      if (level > 0) subclassUnlockLevel = Math.min(subclassUnlockLevel, level);
    }
    const traits = refs.flatMap((ref, referenceIndex) => {
      const text = refText(ref, 'subclassFeature');
      const found = findSubclassFeature(text, subclass);
      if (!found) {
        if (text) unresolvedReferences.push(`subclassFeature:${text}`);
        if (text) referenceFailures.push({ ownerId: subclass.id, kind: 'subclassFeature', reference: text, referenceIndex });
        return [];
      }
      const feature = toFeature(found);
      choiceDiagnostics.push(...parseFeatureChoices(found).diagnostics);
      return [feature];
    });
    const firstLevel = traits.reduce((min, trait) => Math.min(min, trait.level), 20);
    subclassUnlockLevel = Math.min(subclassUnlockLevel, firstLevel);
    return {
      name: subclass.name,
      nameEn: subclass.englishName || subRaw.shortName || subclass.name,
      description: subclass.description || '',
      traits,
      source: subclass.source,
      catalogId: subclass.id,
    };
  });

  const spellRows = (raw.classTableGroups || []).find((group: any) => Array.isArray(group.rowsSpellProgression))?.rowsSpellProgression || [];
  const preparedProgression = raw.preparedSpellsProgression || raw.spellsKnownProgressionFixed || [];
  const progression: ClassLevelProgression[] = Array.from({ length: 20 }, (_, index) => {
    const level = index + 1;
    const row = spellRows[index];
    return {
      level,
      proficiencyBonus: 2 + Math.floor((level - 1) / 4),
      featuresUnlocked: features.filter((feature) => feature.level === level).map((feature) => feature.nameEn || feature.name),
      ...(Array.isArray(row) ? {
        spellcasting: {
          cantripsKnown: Number(raw.cantripProgression?.[index] || 0),
          spellsPrepared: Number(preparedProgression[index] || 0),
          spellSlots: Object.fromEntries(row.map((count: number, slot: number) => [`level${slot + 1}`, count])),
        },
      } : {}),
    } as ClassLevelProgression;
  });

  return {
    features,
    progression,
    subclasses,
    subclassUnlockLevel: subclassUnlockLevel === 20 && subclasses.length === 0 ? 3 : subclassUnlockLevel,
    unresolvedReferences,
    choiceDiagnostics: Array.from(new Set(choiceDiagnostics)),
    referenceFailures,
  };
}
