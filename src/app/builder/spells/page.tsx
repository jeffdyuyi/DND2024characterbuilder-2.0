'use client';

import React, { useEffect, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { useCharacterStore } from '@/store/characterStore';
import { computeSpellcasting } from '@/engine/spellcasting';
import styles from '../species/page.module.css';

// Lazy load the heavy spell list component which imports the entire spell data dictionary
const SpellList = dynamic(() => import('./SpellList'), {
  loading: () => <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>加载法术数据库中...</div>,
  ssr: false, // Prevents loading heavy data on server, reduces initial bundle
});

import SpellcastingSummary from './SpellcastingSummary';

export default function SpellsPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { characters, loadCharacter } = useCharacterStore();
  const character = id ? characters[id] : null;

  useEffect(() => {
    if (id) loadCharacter(id);
  }, [id, loadCharacter]);

  const spellcasting = useMemo(() => {
    if (!character) return { casterLevel: 0, spellSlots: {}, cantripsKnown: 0, spellsPrepared: 0, featCapacity: 0, spellcastingAbility: undefined };
    return computeSpellcasting(character);
  }, [character]);

  if (!character) return <div className="page-container">加载中...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>选择法术</h2>
          <p className={styles.subtitle}>为你的角色准备法术，选择戏法与各环阶法术。</p>
        </div>
      </div>

      <div className={styles.content} style={{ display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
        {/* 左侧状态侧边栏 */}
        <SpellcastingSummary
          spellcastingAbility={spellcasting.spellcastingAbility}
          cantripsKnown={spellcasting.cantripsKnown}
          spellsPrepared={spellcasting.spellsPrepared}
          featCapacity={spellcasting.featCapacity}
          spellSlots={spellcasting.spellSlots}
          character={character}
        />
        
        {/* 右侧主选择区 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px 40px' }}>
          <SpellList
            casterLevel={spellcasting.casterLevel}
            spellSlots={spellcasting.spellSlots}
            cantripsKnown={spellcasting.cantripsKnown}
            spellsPrepared={spellcasting.spellsPrepared}
            spellcastingAbility={spellcasting.spellcastingAbility}
            character={character}
          />
        </div>
      </div>
    </div>
  );
}
