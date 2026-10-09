'use client';

import React from 'react';
import styles from './SpellcastingSummary.module.css';
import { CharacterState } from '@/types/characterState';

interface SpellcastingSummaryProps {
  spellcastingAbility?: string;
  cantripsKnown: number;
  spellsPrepared: number;
  featCapacity: number;
  spellSlots: Record<number, number>;
  character: CharacterState;
}

export default function SpellcastingSummary({
  spellcastingAbility,
  cantripsKnown,
  spellsPrepared,
  spellSlots,
}: SpellcastingSummaryProps) {
  const slotEntries = Object.entries(spellSlots).sort(([a], [b]) => Number(a) - Number(b));

  return (
    <div className={styles.summaryBar}>
      {spellcastingAbility && (
        <div className={styles.statCell}>
          <span className={styles.statLabel}>施法属性</span>
          <span className={styles.abilityValue}>{spellcastingAbility}</span>
        </div>
      )}
      <div className={styles.statCell}>
        <span className={styles.statLabel}>可知戏法</span>
        <span className={styles.statValue}>{cantripsKnown}</span>
      </div>
      <div className={styles.statCell}>
        <span className={styles.statLabel}>可准备法术</span>
        <span className={styles.statValue}>{spellsPrepared}</span>
      </div>
      {slotEntries.length > 0 && (
        <div className={styles.slotsCell}>
          <span className={styles.statLabel}>法术位：</span>
          {slotEntries.map(([level, count]) => (
            <span key={level} className={styles.slotBadge}>
              <span className={styles.slotRing}>{level}环</span>
              <span className={styles.slotCount}>×{count}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
