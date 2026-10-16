import { defaultCatalog } from '@/catalog/catalog';
import { resolveCatalogReference } from '@/catalog/references';
import { sourceBookKey } from '@/catalog/sourcePolicy';
import { parseCatalogSpellGrants } from '@/catalog/adapters/spellGrants';
import { collectClassSpellGrantSources } from './classSpellGrants';
import type { CatalogEntry, CatalogService, EntryKind } from '@/catalog/types';
import type { CharacterState } from '@/types/characterState';
import type { ParsedSpellGrants } from '@/types/spellGrant';

export interface CharacterSpellGrantSources {
  sources: {
    selectionKey: string;
    /** 职业来源用职业等级；种族、背景、专长来源用角色总等级。 */
    level: number;
    classId?: string;
    featureLevel?: number;
    grants: ParsedSpellGrants;
  }[];
  diagnostics: { code: string; ownerId: string; reference: string }[];
}

const normalize = (value: unknown) =>
  String(value || '')
    .toLowerCase()
    .replace(/[-_\s]+/g, '');

/** 连接可确认的已选来源；不激活授予、不扫描选择正文、不迁移或修改角色记录。 */
export function collectCharacterSpellGrantSources(
  character: CharacterState,
  catalog: CatalogService = defaultCatalog,
): CharacterSpellGrantSources {
  const classSources = collectClassSpellGrantSources(character, catalog);
  const result: CharacterSpellGrantSources = {
    sources: classSources.sources.map(({ classId, classLevel, featureLevel, grants }) => ({
      selectionKey: JSON.stringify(['class', classId, grants.origin.id]),
      level: classLevel,
      classId,
      featureLevel,
      grants,
    })),
    diagnostics: [...classSources.diagnostics],
  };
  const report = (code: string, ownerId: string, reference: string) =>
    result.diagnostics.push({ code, ownerId, reference });
  if (character.classes.some((entry) => !Number.isInteger(entry.level) || entry.level < 1)) {
    report('unresolved-character-level', character.id, 'classes');
    return result;
  }
  const totalLevel = character.classes.reduce((sum, entry) => sum + entry.level, 0) || 1;
  const resolve = (reference: string | undefined, kind: EntryKind, source?: string) => {
    if (!reference) return;
    const entry = resolveCatalogReference(catalog, reference, [kind], { source });
    if (!entry) {
      report('unresolved-source', kind, reference);
      return;
    }
    if (source && sourceBookKey(entry) !== sourceBookKey({ ...entry, source })) {
      report('mismatched-source', kind, reference);
      return;
    }
    return entry;
  };
  const add = (entry: CatalogEntry, selectionKey: string, level = totalLevel, classId?: string) => {
    if (entry.raw.additionalSpells === undefined && entry.raw.attachedSpells === undefined) return;
    result.sources.push({ selectionKey, level, classId, grants: parseCatalogSpellGrants(entry) });
  };
  const species = resolve(character.speciesId, 'race', character.speciesSource);
  if (species) add(species, 'speciesId');
  if (character.subspeciesId) {
    const subrace = resolve(character.subspeciesId, 'subrace');
    if (subrace && species) {
      const parentMatches = [species.name, species.englishName]
        .filter(Boolean)
        .map(normalize)
        .includes(normalize(subrace.raw.raceName || subrace.parent));
      const sourceMatches =
        sourceBookKey(species) ===
        sourceBookKey({
          ...species,
          source: String(subrace.raw.raceSource || 'PHB'),
        });
      if (parentMatches && sourceMatches) {
        add(subrace, 'subspeciesId');
        // 这里只列出原生来源；父/子字段的覆盖关系不能在收集阶段直接视为累加授予。
        if (
          species.raw.additionalSpells !== undefined &&
          subrace.raw.additionalSpells !== undefined
        )
          report('subrace-inheritance-review', subrace.id, species.id);
      } else report('mismatched-subrace-parent', subrace.id, species.id);
    } else if (subrace) report('unresolved-subrace-parent', subrace.id, character.speciesId || '');
  }
  const background = resolve(character.backgroundId, 'background', character.backgroundSource);
  if (background) add(background, 'backgroundId');

  const backgroundChoice = character.featSelections?.['background-feat']?.featId;
  const origin = resolve(character.originFeatId, 'feat');
  const detailed = resolve(backgroundChoice, 'feat');
  if (background) {
    if (origin && detailed && origin.id !== detailed.id) {
      report('conflicting-background-feat', background.id, backgroundChoice!);
    } else if ((backgroundChoice && !detailed) || (character.originFeatId && !origin)) {
      report(
        'unresolved-background-feat',
        background.id,
        backgroundChoice || character.originFeatId!,
      );
    } else if (detailed && !origin) {
      // 背景切换只更新快捷字段；孤立详细槽位可能是旧背景残留，不据此新增授予。
      report('unverified-background-feat', background.id, backgroundChoice!);
    } else if (origin) add(origin, 'background-feat');
    // 不根据原生feats直接选中专长，避免覆盖解绑后的手动选择或把多组全部授予。
    if (!origin && !detailed && background.raw.feats !== undefined)
      report('background-feat-selection-required', background.id, 'feats');
  } else if (character.originFeatId || backgroundChoice) {
    report('orphan-background-feat', character.id, backgroundChoice || character.originFeatId!);
  }

  const selectedFeatIds = new Set<string>();
  for (const selection of character.selectedFeats || []) {
    const owner = resolve(selection.classId, 'class');
    const activeClass =
      owner &&
      character.classes.find((entry) => {
        const resolved = resolveCatalogReference(catalog, entry.classId, ['class'], {
          source: entry.source,
        });
        return (
          resolved?.id === owner.id &&
          (!entry.source ||
            sourceBookKey(resolved) === sourceBookKey({ ...resolved, source: entry.source }))
        );
      });
    if (!activeClass || !Number.isInteger(selection.level) || selection.level < 1) {
      report('unverified-feat-owner', character.id, selection.featId);
      continue;
    }
    if (selection.level > activeClass.level) continue;
    const feat = resolve(selection.featId, 'feat');
    if (!feat) continue;
    const key = JSON.stringify(['selectedFeat', owner!.id, selection.level, feat.id]);
    if (selectedFeatIds.has(key)) continue;
    selectedFeatIds.add(key);
    add(feat, key, totalLevel, owner!.id);
  }
  for (const [slotId, selection] of Object.entries(character.featSelections || {})) {
    if (slotId === 'background-feat' || !selection.featId) continue;
    // 其他槽位必须先由现有规则确认是否仍属于当前种族/职业，不把任意缓存槽位当成有效来源。
    report('unverified-feat-slot', slotId, selection.featId);
  }
  return result;
}
