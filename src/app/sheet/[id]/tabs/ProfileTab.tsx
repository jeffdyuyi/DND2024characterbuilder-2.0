import React from 'react';
import styles from '../../sheet.module.css';
import PillButton from '@/components/PillButton';
import { CharacterState } from '@/types/characterState';

interface ProfileTabProps {
  character: CharacterState;
  updateActiveCharacter: (data: Partial<CharacterState>) => void;
  router: any;
  id: string;
}

const ProfileTab: React.FC<ProfileTabProps> = ({
  character,
  updateActiveCharacter,
  router,
  id,
}) => {
  const renderDetailItem = (
    label: string,
    value: string | undefined,
    placeholder: string = '未填写',
  ) => (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontWeight: 600,
          color: 'var(--color-text-tertiary)',
          fontSize: 11,
          textTransform: 'uppercase',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 15, color: 'var(--color-text-primary)' }}>{value || placeholder}</div>
    </div>
  );

  const SectionHeader = ({
    title,
    editPath,
  }: {
    title: string;
    enTitle?: string;
    editPath?: string;
  }) => (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid var(--color-border-subtle)',
        paddingBottom: 8,
        marginBottom: 20,
      }}
    >
      <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{title}</h3>
      <PillButton
        size="sm"
        variant="outline"
        onClick={() => router.push(editPath || `/builder/details?id=${id}`)}
      >
        编辑
      </PillButton>
    </div>
  );

  const renderTextarea = (
    title: string,
    placeholder: string,
    value: string,
    onChange: (val: string) => void,
    height: number = 100,
  ) => (
    <div style={{ flex: 1 }}>
      <div
        style={{
          fontWeight: 600,
          color: 'var(--color-text-tertiary)',
          fontSize: 11,
          textTransform: 'uppercase',
          marginBottom: 8,
        }}
      >
        {title}
      </div>
      <textarea
        placeholder={placeholder}
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        style={{
          width: '100%',
          height: height,
          padding: 12,
          borderRadius: 8,
          border: '1px solid var(--color-border-subtle)',
          background: 'var(--color-bg-light)',
          fontSize: 14,
          color: 'var(--color-text-primary)',
          resize: 'none',
          transition: 'border-color 0.2s',
          outline: 'none',
        }}
        onFocus={(e) => (e.target.style.borderColor = 'var(--color-primary)')}
        onBlur={(e) => (e.target.style.borderColor = 'var(--color-border-subtle)')}
      />
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32, paddingBottom: 40 }}>
      {/* 1. 身份与生理特征 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 32 }}>
        <div className={styles.card} style={{ padding: 24 }}>
          <SectionHeader title="核心身份" />
          <div style={{ display: 'flex', gap: 20, alignItems: 'flex-start' }}>
            <div
              style={{
                width: 100,
                height: 100,
                borderRadius: 20,
                backgroundColor: 'var(--color-bg-light)',
                backgroundImage: character.avatarUrl ? `url(${character.avatarUrl})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                border: '1px solid var(--color-border-subtle)',
                flexShrink: 0,
              }}
            />
            <div style={{ flex: 1 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                {renderDetailItem('代词', character.pronouns)}
                {renderDetailItem('阵营', character.alignment)}
                {renderDetailItem('信仰', character.faith)}
                {renderDetailItem('生活方式', character.lifestyle)}
              </div>
              <div style={{ marginTop: 8 }}>{renderDetailAbbr('玩家', character.playerName)}</div>
            </div>
          </div>
        </div>

        <div className={styles.card} style={{ padding: 24 }}>
          <SectionHeader title="物理特征" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
            {renderDetailItem('性别', character.gender)}
            {renderDetailItem('年龄', character.age)}
            {renderDetailItem('身高', character.height)}
            {renderDetailItem('体重', character.weight)}
            {renderDetailItem('瞳色', character.eyes || character.eyeColor)}
            {renderDetailItem('肤色', character.skin || character.skinColor)}
            {renderDetailItem('发色', character.hair || character.hairColor)}
          </div>
          <div
            style={{
              marginTop: 16,
              paddingTop: 16,
              borderTop: '1px dashed var(--color-border-subtle)',
            }}
          >
            <div
              style={{
                fontWeight: 600,
                color: 'var(--color-text-tertiary)',
                fontSize: 11,
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              外貌描述
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--color-text-secondary)' }}>
              {character.appearance || '无详细描述'}
            </div>
          </div>
        </div>
      </div>

      {/* 2. 背景故事与性格 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 32 }}>
        <div className={styles.card} style={{ padding: 24 }}>
          <SectionHeader title="个性特征" />
          {renderLongItem('人格特质', character.personalityTraits)}
          {renderLongLongItem('理想', character.ideals)}
          {renderLongLongItem('牵绊', character.bonds)}
          {renderLongLongItem('缺点', character.flaws)}
        </div>

        <div className={styles.card} style={{ padding: 24 }}>
          <SectionHeader title="背景故事" />
          <div
            style={{
              fontSize: 15,
              lineHeight: 1.8,
              color: 'var(--color-text-secondary)',
              whiteSpace: 'pre-wrap',
              maxHeight: 400,
              overflowY: 'auto',
              paddingRight: 8,
            }}
          >
            {character.backstory || '这段传奇尚未落笔...'}
          </div>
        </div>
      </div>

      {/* 3. 社交与组织笔记 */}
      <div className={styles.card} style={{ padding: 24 }}>
        <SectionHeader title="社交与组织" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div style={{ display: 'flex', gap: 24 }}>
            {renderTextarea(
              '所属组织',
              '记录角色所属的阵营、工会或教派...',
              character.organizations || '',
              (val) => updateActiveCharacter({ organizations: val }),
              80,
            )}
            {renderTextarea(
              '重要盟友',
              '记录关键 NPC 或友方人物...',
              character.allies || '',
              (val) => updateActiveCharacter({ allies: val }),
              80,
            )}
            {renderTextarea(
              '劲敌/宿敌',
              '记录对手、敌人或仇家...',
              character.enemies || '',
              (val) => updateActiveCharacter({ enemies: val }),
              80,
            )}
          </div>
          <div style={{ display: 'flex', gap: 24 }}>
            {renderTextarea(
              '队友笔记',
              '记录与当前冒险伙伴的相关信息...',
              character.partyNotes || '',
              (val) => updateActiveCharacter({ partyNotes: val }),
              80,
            )}
            {renderTextarea(
              '重要人物/NPC',
              '记录其他旅途中遇到的重要人物...',
              character.npcNotes || '',
              (val) => updateActiveCharacter({ npcNotes: val }),
              80,
            )}
            {renderTextarea(
              '其他笔记',
              '记录杂项信息或未分类内容...',
              character.otherNotes || '',
              (val) => updateActiveCharacter({ otherNotes: val }),
              80,
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const renderLongLongItem = (label: string, value: string | undefined) => (
  <div style={{ marginBottom: 16 }}>
    <div
      style={{
        fontWeight: 600,
        color: 'var(--color-text-tertiary)',
        fontSize: 11,
        textTransform: 'uppercase',
        marginBottom: 4,
      }}
    >
      {label}
    </div>
    <div style={{ fontSize: 13, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>
      {value || '未填写'}
    </div>
  </div>
);

const renderDetailAbbr = (label: string, value: string | undefined) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
    <span
      style={{
        fontWeight: 600,
        color: 'var(--color-text-tertiary)',
        fontSize: 11,
        textTransform: 'uppercase',
      }}
    >
      {label}:
    </span>
    <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{value || '未知'}</span>
  </div>
);

const renderLongItem = (label: string, value: string | undefined) => (
  <div style={{ marginBottom: 20 }}>
    <div
      style={{
        fontWeight: 600,
        color: 'var(--color-text-tertiary)',
        fontSize: 11,
        textTransform: 'uppercase',
        marginBottom: 6,
      }}
    >
      {label}
    </div>
    <div style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--color-text-secondary)' }}>
      {value || '未填写'}
    </div>
  </div>
);

export default ProfileTab;
