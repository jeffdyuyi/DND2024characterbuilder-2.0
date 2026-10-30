import type { ClassFeature } from '@/types/class';
import type { CharacterState } from '@/types/characterState';

export function isClassFeatureEnabled(
  feature: ClassFeature,
  character: Pick<CharacterState, 'enabledOptionalClassFeatureIds'>,
) {
  return (
    !feature.isOptional ||
    Boolean(
      feature.catalogId && character.enabledOptionalClassFeatureIds?.includes(feature.catalogId),
    )
  );
}

/** 只按明确的替换目标停用同一职业中的基础特性。 */
export function getActiveClassFeatures(
  features: ClassFeature[],
  character: Pick<CharacterState, 'enabledOptionalClassFeatureIds'>,
  level = Infinity,
) {
  const enabled = features.filter(
    (feature) => feature.level <= level && isClassFeatureEnabled(feature, character),
  );
  const replaced = new Set(
    enabled.flatMap((feature) =>
      feature.isOptional && feature.replacesFeatureName ? [feature.replacesFeatureName] : [],
    ),
  );
  return enabled.filter((feature) => feature.isOptional || !replaced.has(feature.name));
}
