'use client';
import React from 'react';
import { getCatalogSpells } from '@/catalog';
import { getSpellDefinition } from '@/engine/characterData';
import { getSourceDisplayName } from '@/config/sourceMapping';
import {
  formatActionType,
  formatSpellRange,
  formatSpellDuration,
  formatSpellComponent,
  translateSpellSchool,
} from '@/engine/terminology';
import type { InnateSpell, Selection } from '@/types/species';
import type { Spell } from '@/types/spell';
import MarkdownText from '@/components/MarkdownText';
import styles from './page.module.css';

export const TraitSpellList = ({
  spells,
  selectedSpellIds = [],
  remainingOnly = false,
}: {
  spells: (InnateSpell | Selection<InnateSpell>)[];
  selectedSpellIds?: string[];
  remainingOnly?: boolean;
}) => {
  // 展平法术列表：包括固定法术和选择项中当前选中的法术
  const allSpells = (spells || []).reduce<InnateSpell[]>((acc, s) => {
    if ('numToChoose' in s) {
      // 建卡选择项的详情由对应选择器负责；长休整备项仍保留在汇总中。
      if (remainingOnly && !s.isLongRestChoice) return acc;
      if (s.options && s.options.length > 0 && selectedSpellIds.length > 0) {
        const chosen = s.options.filter((opt) => {
          const optId = typeof opt === 'string' ? opt : opt.spellId;
          const optName = typeof opt === 'string' ? opt : opt.spellName;
          return Boolean(
            (optId && selectedSpellIds.includes(optId)) ||
            (optName && selectedSpellIds.includes(optName)),
          );
        });
        if (chosen.length > 0) {
          const mapped: InnateSpell[] = chosen.map((c) =>
            typeof c === 'string'
              ? {
                  spellId: c,
                  spellName: c,
                  spellNameEn: c,
                  level: 0,
                  isPrepared: true,
                  freeCastsPerLongRest: 0,
                  useSpellSlots: true,
                }
              : (c as InnateSpell),
          );
          return [...acc, ...mapped];
        }
      }
      return acc;
    }
    return [...acc, s as InnateSpell];
  }, []);

  // 杜绝同一特质内法术因多重引用重复展示两次
  const uniqueSpells: InnateSpell[] = [];
  const seenSpellKeys = new Set<string>();
  for (const item of allSpells) {
    const key = (item.spellId || item.spellName || '').toLowerCase();
    if (!seenSpellKeys.has(key)) {
      seenSpellKeys.add(key);
      uniqueSpells.push(item);
    }
  }

  if (uniqueSpells.length === 0) return null;

  return (
    <div className={styles.traitSpellList}>
      {uniqueSpells.map((innate, idx) => {
        const catalogSpells = getCatalogSpells();
        const spell =
          getSpellDefinition(innate.spellId) ||
          (innate.spellName ? getSpellDefinition(innate.spellName) : undefined) ||
          (innate.spellNameEn ? getSpellDefinition(innate.spellNameEn) : undefined) ||
          catalogSpells.find(
            (s) =>
              s.id === innate.spellId ||
              s.name === innate.spellName ||
              s.nameEn === innate.spellNameEn,
          );

        if (!spell) {
          return (
            <div key={idx} className={styles.spellItemMini}>
              <span className={styles.spellPrimaryInfo}>
                {innate.level === 0 ? '戏法' : `${innate.level}级`}: {innate.spellName} (
                {innate.spellNameEn})
              </span>
              <span className={styles.spellUsageInfo}>
                {innate.freeCastsPerLongRest === Infinity
                  ? '随意'
                  : innate.freeCastsPerLongRest === 'Proficiency Bonus'
                    ? '熟练加值次/长休'
                    : innate.freeCastsPerLongRest
                      ? `${innate.freeCastsPerLongRest}次/长休`
                      : '按法术规则施展'}
              </span>
            </div>
          );
        }

        return (
          <div key={idx} className={styles.spellCard}>
            <div className={styles.spellCardHeader}>
              <div>
                <span className={styles.previewTitle}>{spell.name}</span>
                <span className={styles.previewSubtitle}>{spell.nameEn}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span className={styles.usageBadge}>{getSourceDisplayName(spell.source)}</span>
                <span
                  className={styles.usageBadge}
                  style={{ background: 'var(--color-bg-dark)', color: '#86868b' }}
                >
                  {spell.level === 0 ? '戏法' : `${spell.level}环法术`}
                </span>
                {innate.level > 0 && innate.level !== spell.level && (
                  <span
                    className={styles.usageBadge}
                    style={{ background: 'var(--color-bg-dark)', color: '#86868b' }}
                  >
                    {innate.level}级解锁
                  </span>
                )}
                <span className={styles.usageBadge}>
                  {spell.level === 0 || innate.freeCastsPerLongRest === Infinity
                    ? '随意施展'
                    : innate.freeCastsPerLongRest === 'Proficiency Bonus'
                      ? '熟练加值次/长休'
                      : innate.freeCastsPerLongRest
                        ? `${innate.freeCastsPerLongRest}次/长休`
                        : '消耗法术位'}
                </span>
              </div>
            </div>

            <div className={styles.previewMeta}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>学派:</span> {translateSpellSchool(spell.school)}
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>施法时间:</span>{' '}
                {formatActionType(spell.castingTime)}
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>施法距离:</span> {formatSpellRange(spell.range)}
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>持续时间:</span>{' '}
                {formatSpellDuration(spell.duration)}
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>成分:</span>{' '}
                {formatSpellComponent(spell.components)}
              </div>
            </div>

            <MarkdownText
              text={spell.description}
              className={styles.previewDescription}
              variant="clean"
            />
            {spell.higherLevel && !spell.description.includes(spell.higherLevel) && (
              <div className={styles.previewDescription}>
                <b>升环效应:</b> {spell.higherLevel}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// 每个选择组只展示自己的预览或已选法术，避免读取其他特质的选择。
export function SpeciesSpellChoiceDetails({
  choice,
  candidateSpells,
  selectedSpellIds,
  previewSpellId,
}: {
  choice: Selection<InnateSpell>;
  candidateSpells: Spell[];
  selectedSpellIds: string[];
  previewSpellId?: string | null;
}) {
  const options = candidateSpells.map((spell) => {
    const original = (choice.options || []).find(
      (option) => typeof option === 'object' && option.spellId === spell.id,
    );
    return (
      original || {
        spellId: spell.id,
        spellName: spell.name,
        spellNameEn: spell.nameEn,
        level: choice.levelRequirement ?? 0,
        isPrepared: true,
        freeCastsPerLongRest: 0,
        useSpellSlots: true,
      }
    );
  });
  const previewIsCandidate = candidateSpells.some((spell) => spell.id === previewSpellId);
  return (
    <TraitSpellList
      spells={[{ ...choice, options }]}
      selectedSpellIds={
        previewIsCandidate ? [...selectedSpellIds, previewSpellId!] : selectedSpellIds
      }
    />
  );
}
