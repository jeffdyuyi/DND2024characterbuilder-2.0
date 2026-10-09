'use client';

import React, { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCharacterStore } from '@/store/characterStore';
import OptionCard from '@/components/OptionCard';
import styles from '../species/page.module.css';

const ALIGNMENTS = [
  { id: 'LG', name: '守序善良' }, { id: 'NG', name: '中立善良' }, { id: 'CG', name: '混乱善良' },
  { id: 'LN', name: '守序中立' }, { id: 'TN', name: '绝对中立' }, { id: 'CN', name: '混乱中立' },
  { id: 'LE', name: '守序邪恶' }, { id: 'NE', name: '中立邪恶' }, { id: 'CE', name: '混乱邪恶' },
];

export default function AlignmentPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { characters, updateActiveCharacter, loadCharacter } = useCharacterStore();
  const character = id ? characters[id] : null;

  useEffect(() => {
    if (id) loadCharacter(id);
  }, [id, loadCharacter]);

  if (!character) return <div className="page-container">加载中...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>选择阵营</h2>
          <p className={styles.subtitle}>决定角色的道德和道德倾向。</p>
        </div>
      </div>

      <div className={styles.content}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, width: '100%', maxWidth: 800 }}>
          {ALIGNMENTS.map(a => (
            <OptionCard 
              key={a.id} 
              title={a.name} 
              subtitle={a.id}
              selected={character.alignment === a.id} 
              onClick={() => updateActiveCharacter({ alignment: a.id })} 
            />
          ))}
        </div>
      </div>
    </div>
  );
}
