import React from 'react';
import styles from '../../sheet.module.css';
import PillButton from '@/components/PillButton';

interface StoryTabProps {
  character: any;
  updateActiveCharacter: (data: any) => void;
  router: any;
  id: string;
}

const StoryTab: React.FC<StoryTabProps> = ({ character, updateActiveCharacter, router, id }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <span>背景故事</span>
          <PillButton size="sm" variant="outline" onClick={() => router.push(`/builder/details?id=${id}`)}>跳转编辑</PillButton>
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.8, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap' }}>
          {character.backstory || '尚未谱写传奇经历...'}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
        {/* 同盟与组织 */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>同盟与组织</h2>
          <textarea 
            placeholder="记录所属组织或盟友..."
            value={character.organizations || ''}
            onChange={(e) => updateActiveCharacter({ organizations: e.target.value })}
            style={{ 
              width: '100%', 
              height: 120, 
              padding: 12, 
              borderRadius: 8, 
              border: '1px solid var(--color-border-subtle)', 
              background: 'var(--color-bg-light)',
              fontSize: 14,
              resize: 'none'
            }}
          />
        </div>

        {/* 队友与 NPC */}
        <div className={styles.card}>
          <h2 className={styles.cardTitle}>队友记录</h2>
          <textarea 
            placeholder="记录队友姓名与特点..."
            value={character.partyNotes || ''}
            onChange={(e) => updateActiveCharacter({ partyNotes: e.target.value })}
            style={{ 
              width: '100%', 
              height: 120, 
              padding: 12, 
              borderRadius: 8, 
              border: '1px solid var(--color-border-subtle)', 
              background: 'var(--color-bg-light)',
              fontSize: 14,
              resize: 'none'
            }}
          />
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>关键 NPC 与重要人物</h2>
        <textarea 
          placeholder="记录在旅途中遇到的重要人物、敌人或指引者..."
          value={character.npcNotes || ''}
          onChange={(e) => updateActiveCharacter({ npcNotes: e.target.value })}
          style={{ 
            width: '100%', 
            height: 120, 
            padding: 12, 
            borderRadius: 8, 
            border: '1px solid var(--color-border-subtle)', 
            background: 'var(--color-bg-light)',
            fontSize: 14,
            resize: 'none'
          }}
        />
      </div>
    </div>
  );
};

export default StoryTab;
