import type { CatalogEntry } from '@/catalog/types';
import type { ClassFeature } from '@/types/class';
import { CLASS_OVERLAYS } from './classes';

const key = (value?: string) => (value || '').toLowerCase().replace(/[-_\s]+/g, '');

/** Supplement existing official features only; never create content or change raw data. */
export function applyClassFeatureMechanics(
  entry: CatalogEntry,
  features: ClassFeature[],
): ClassFeature[] {
  const source = entry.source.toUpperCase();
  const edition = source === 'PHB' ? '2014' : source === 'XPHB' ? '2024' : undefined;
  if (
    entry.kind !== 'class' ||
    entry.sourcePackId !== '5etools-cn' ||
    entry.isHomebrew ||
    String(entry.raw.source || '').toUpperCase() !== source ||
    !edition ||
    (entry.edition !== 'both' && entry.edition !== edition)
  ) {
    return features;
  }

  const template =
    CLASS_OVERLAYS[(entry.englishName || '').toLowerCase()] || CLASS_OVERLAYS[entry.name];
  if (!template?.features?.length) return features;

  return features.map((feature) => {
    if (feature.source && feature.source.toUpperCase() !== source) return feature;
    const supplement = template.features!.find(
      (candidate) =>
        candidate.level === feature.level &&
        ((feature.nameEn && key(feature.nameEn) === key(candidate.nameEn)) ||
          key(feature.name) === key(candidate.name) ||
          key(feature.name) === key(candidate.nameEn)),
    );
    if (!supplement) return feature;

    const defaults = structuredClone(supplement.mechanics);
    // The upstream PHB and XPHB Primal Champion texts specify different caps.
    if (key(supplement.nameEn) === 'primalchampion') {
      const cap = edition === '2024' ? 25 : 24;
      defaults.statMaxIncrease = { str: cap, con: cap };
    }
    const native = feature.mechanics || {};
    const mechanics = { ...defaults, ...native };
    if (defaults.acCalculation && native.acCalculation) {
      mechanics.acCalculation = { ...defaults.acCalculation, ...native.acCalculation };
    }
    return { ...feature, mechanics };
  });
}
