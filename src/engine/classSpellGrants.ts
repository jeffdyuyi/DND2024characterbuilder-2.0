import { defaultCatalog } from '@/catalog/catalog';
import { resolveCatalogReference } from '@/catalog/references';
import { isHomebrewSource, sourceBookKey } from '@/catalog/sourcePolicy';
import {
  belongsToClass,
  classKeyPart,
  createClassFeatureLookup,
  parseClassFeatureUid,
} from '@/catalog/adapters/classReferences';
import { parseCatalogSpellGrants } from '@/catalog/adapters/spellGrants';
import { toFeature } from '@/catalog/adapters/classAssembly';
import { getActiveClassFeatures } from './classFeatureActivation';
import type { CatalogEntry, CatalogService } from '@/catalog/types';
import type { CharacterState } from '@/types/characterState';
import type { ParsedSpellGrants } from '@/types/spellGrant';

export interface ClassSpellGrantSources {
  sources: {
    classId: string;
    classLevel: number;
    featureLevel?: number;
    unlockLevel?: number;
    grants: ParsedSpellGrants;
  }[];
  diagnostics: { code: string; ownerId: string; reference: string }[];
}

/** 只收集当前职业拥有的原生授予数据；等级/分支/候选选择仍由后续配置层处理。 */
export function collectClassSpellGrantSources(
  character: Pick<CharacterState, 'classes' | 'enabledOptionalClassFeatureIds'>,
  catalog: CatalogService = defaultCatalog,
): ClassSpellGrantSources {
  const result: ClassSpellGrantSources = { sources: [], diagnostics: [] };
  const findFeature = createClassFeatureLookup(catalog);
  const findSubclassFeature = createClassFeatureLookup(catalog, true);
  const seen = new Set<string>();
  const report = (code: string, ownerId: string, reference: string) =>
    result.diagnostics.push({ code, ownerId, reference });
  const refs = (entry: CatalogEntry, subclass: boolean) => {
    const field = subclass ? 'subclassFeatures' : 'classFeatures';
    const values = entry.raw[field];
    if (values === undefined) return [];
    if (!Array.isArray(values)) {
      report('invalid-feature-references', entry.id, field);
      return [];
    }
    return values.flatMap((value): string[] => {
      const text =
        typeof value === 'string' ? value : value?.[subclass ? 'subclassFeature' : 'classFeature'];
      if (typeof text === 'string' && text) return [text];
      report('invalid-feature-reference', entry.id, field);
      return [];
    });
  };
  for (const selected of character.classes) {
    if (!Number.isInteger(selected.level) || selected.level < 1) {
      report('invalid-class-level', selected.classId, String(selected.level));
      continue;
    }
    const parent = resolveCatalogReference(catalog, selected.classId, ['class'], {
      source: selected.source,
    });
    if (!parent) {
      report('unresolved-class', selected.classId, selected.classId);
      continue;
    }
    if (
      selected.source &&
      sourceBookKey(parent) !== sourceBookKey({ ...parent, source: selected.source })
    ) {
      report('mismatched-class-source', parent.id, selected.source);
      continue;
    }
    const add = (entry: CatalogEntry, featureLevel?: number, unlockLevel?: number) => {
      const key = `${parent.id}:${entry.id}`;
      if (seen.has(key)) return;
      seen.add(key);
      if (entry.raw.additionalSpells === undefined && entry.raw.attachedSpells === undefined)
        return;
      result.sources.push({
        classId: parent.id,
        classLevel: selected.level,
        featureLevel,
        ...(unlockLevel !== undefined ? { unlockLevel } : {}),
        grants: parseCatalogSpellGrants(entry),
      });
    };
    const collectFeatures = (owner: CatalogEntry, subclass: boolean, references: string[]) => {
      const allowedIds = new Set(
        getActiveClassFeatures(
          references
            .map((reference) => (subclass ? findSubclassFeature : findFeature)(reference, owner))
            .filter((feature): feature is CatalogEntry => Boolean(feature))
            .map(toFeature),
          character,
          selected.level,
        ).map((feature) => feature.catalogId),
      );
      for (const reference of references) {
        const uid = parseClassFeatureUid(reference, subclass);
        if (!uid.valid) {
          report('invalid-feature-reference', owner.id, reference);
          continue;
        }
        if (uid.level > selected.level) continue;
        const feature = (subclass ? findSubclassFeature : findFeature)(reference, owner);
        if (!feature) {
          report('unresolved-feature', owner.id, reference);
          continue;
        }
        if (isHomebrewSource(feature) && feature.sourcePackId !== owner.sourcePackId) {
          report('mismatched-feature-pack', owner.id, reference);
          continue;
        }
        // Lookup resolves a UID; also ensure that the UID actually belongs to this owner.
        if (!belongsToClass(feature, parent)) {
          report('mismatched-feature-parent', owner.id, reference);
          continue;
        }
        if (
          subclass &&
          (![owner.name, owner.englishName, owner.raw.shortName, owner.raw.ENG_shortName]
            .filter(Boolean)
            .map(classKeyPart)
            .includes(classKeyPart(feature.raw.subclassShortName || feature.raw.subclassName)) ||
            classKeyPart(feature.raw.subclassSource || 'PHB') !== classKeyPart(owner.source))
        ) {
          report('mismatched-feature-parent', owner.id, reference);
          continue;
        }
        if (allowedIds.has(feature.id)) add(feature, uid.level);
      }
    };
    add(parent);
    const classRefs = refs(parent, false);
    collectFeatures(parent, false, classRefs);
    if (!selected.subclassId) continue;
    const child = resolveCatalogReference(catalog, selected.subclassId, ['subclass'], {
      parentNames: [parent.name, parent.englishName || parent.name],
      parentSource: parent.source,
    });
    if (!child || !belongsToClass(child, parent)) {
      report('unresolved-subclass', parent.id, selected.subclassId);
      continue;
    }
    const childRefs = refs(child, true);
    const childNames = [child.name, child.englishName, child.raw.shortName, child.raw.ENG_shortName]
      .filter(Boolean)
      .map(classKeyPart);
    const unlockLevels = childRefs
      .map((ref) => parseClassFeatureUid(ref, true))
      .filter(
        (uid) =>
          uid.valid &&
          childNames.includes(classKeyPart(uid.subclassName)) &&
          classKeyPart(uid.subclassSource) === classKeyPart(child.source) &&
          [parent.name, parent.englishName]
            .map(classKeyPart)
            .includes(classKeyPart(uid.className)) &&
          classKeyPart(uid.classSource) === classKeyPart(parent.source),
      )
      .map((uid) => uid.level);
    const rawClassRefs = parent.raw.classFeatures;
    if (Array.isArray(rawClassRefs))
      for (const ref of rawClassRefs) {
        if (
          !ref ||
          typeof ref !== 'object' ||
          !ref.gainSubclassFeature ||
          typeof ref.classFeature !== 'string'
        )
          continue;
        const uid = parseClassFeatureUid(ref.classFeature);
        if (
          uid.valid &&
          [parent.name, parent.englishName]
            .map(classKeyPart)
            .includes(classKeyPart(uid.className)) &&
          classKeyPart(uid.classSource) === classKeyPart(parent.source)
        )
          unlockLevels.push(uid.level);
      }
    if (!unlockLevels.length) {
      report('unresolved-subclass-unlock', child.id, selected.subclassId);
      continue;
    }
    if (selected.level < Math.min(...unlockLevels)) continue;
    add(child, undefined, Math.min(...unlockLevels));
    collectFeatures(child, true, childRefs);
  }
  return result;
}
