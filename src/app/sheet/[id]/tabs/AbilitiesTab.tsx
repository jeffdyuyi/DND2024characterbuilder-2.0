import React from 'react';
import styles from '../../sheet.module.css';
import { translateAbilityKey, ALL_SKILLS, translateSkill } from '@/engine/terminology';
import PillButton from '@/components/PillButton';

interface AbilitiesTabProps {
  character: any;
  ability: any;
  proficiencies: any;
  pb: number;
  router: any;
  id: string;
  updateActiveCharacter: (data: any) => void;
}

const AbilitiesTab: React.FC<AbilitiesTabProps> = ({ 
  character, ability, proficiencies, pb, router, id, updateActiveCharacter 
}) => {
  const isEditMode = !!character.sheetEditMode;

  const skillToAbility: Record<string, string> = {
    arcana: 'int', history: 'int', investigation: 'int', nature: 'int', religion: 'int',
    athletics: 'str', acrobatics: 'dex', sleightOfHand: 'dex', stealth: 'dex',
    insight: 'wis', animalHandling: 'wis', medicine: 'wis', perception: 'wis', survival: 'wis',
    deception: 'cha', intimidation: 'cha', performance: 'cha', persuasion: 'cha'
  };

  const handleCycleSkill = (skillId: string) => {
    if (!isEditMode) return;
    const isProf = (proficiencies?.skills || []).some((p: any) => p.id === skillId);
    const currentExpertise = character.expertiseSkills || [];
    const isExpert = currentExpertise.includes(skillId);
    const currentSelectedSkills = character.selectedSkills || [];

    let nextSelectedSkills = [...currentSelectedSkills];
    let nextExpertise = [...currentExpertise];

    if (!isProf) {
      if (!nextSelectedSkills.includes(skillId)) nextSelectedSkills.push(skillId);
    } else if (!isExpert) {
      if (!nextExpertise.includes(skillId)) nextExpertise.push(skillId);
    } else {
      nextSelectedSkills = nextSelectedSkills.filter(id => id !== skillId);
      nextExpertise = nextExpertise.filter(id => id !== skillId);
    }

    updateActiveCharacter({ 
      selectedSkills: nextSelectedSkills,
      expertiseSkills: nextExpertise 
    });
  };

  const handleCycleSave = (saveId: string) => {
    if (!isEditMode) return;
    const isSaveProf = (proficiencies?.saves || []).some((p: any) => p.id === saveId);
    const currentClassSelections = { ...(character.classSelections || {}) };
    const customSaveKey = 'custom_save_proficiencies';
    const currentCustomSaves: string[] = currentClassSelections[customSaveKey] || [];

    let nextCustomSaves: string[];
    if (isSaveProf) {
      nextCustomSaves = currentCustomSaves.filter((s: string) => s !== saveId);
    } else {
      nextCustomSaves = [...currentCustomSaves, saveId];
    }

    updateActiveCharacter({ 
      classSelections: { ...currentClassSelections, [customSaveKey]: nextCustomSaves } 
    });
  };

  const handleUpdateBonus = (targetId: string, val: number) => {
    const current = character.customBonuses || {};
    updateActiveCharacter({ customBonuses: { ...current, [targetId]: val } });
  };

  const handleUpdateScore = (key: string, val: number) => {
    const current = character.abilities || { scores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } };
    const nextScores = { ...current.scores, [key]: val };
    updateActiveCharacter({ abilities: { ...current, scores: nextScores } });
  };

  const formatBonus = (val: number) => (val >= 0 ? `+${val}` : `${val}`);

  const renderItem = (type: '豁免' | '技能', label: string, targetId: string, baseMod: number, isProf: boolean, isExpertise: boolean = false) => {
    const customBonus = (character.customBonuses || {})[targetId] || 0;
    const total = baseMod + (isProf ? pb : 0) + (isExpertise ? pb : 0) + customBonus;

    return (
      <div key={targetId} style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        padding: '10px 0', 
        borderBottom: '1px solid var(--color-border-subtle)',
        opacity: isEditMode ? 1 : 0.9,
        transition: 'all 0.2s'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          {/* 循环切换圆圈 */}
          <div 
            onClick={() => type === '豁免' ? handleCycleSave(targetId) : handleCycleSkill(targetId)}
            style={{ 
              width: 18, height: 18, borderRadius: '50%', 
              border: `2px solid ${isProf ? 'var(--color-primary)' : 'var(--color-border-dark)'}`,
              background: isProf ? (isExpertise ? 'var(--color-primary)' : 'color-mix(in srgb, var(--color-primary) 25%, transparent)') : 'transparent',
              cursor: isEditMode ? 'pointer' : 'default',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              position: 'relative'
            }}
          >
            {isExpertise && <div style={{ width: 8, height: 8, background: 'var(--color-text-on-dark, #fff)', borderRadius: '50%' }} />}
            {isEditMode && <div style={{ position: 'absolute', inset: -4, borderRadius: '50%' }} />} {/* 增大点击热区 */}
          </div>
          
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontWeight: isProf ? 600 : 400, fontSize: 14 }}>{label}</span>
              {isProf && (
                <span style={{ fontSize: 9, background: isExpertise ? 'var(--color-primary)' : 'var(--color-bg-subtle)', color: isExpertise ? 'var(--color-text-on-dark, #fff)' : 'var(--color-text-secondary)', padding: '1px 4px', borderRadius: 4 }}>
                  {isExpertise ? '专精' : '熟练'}
                </span>
              )}
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 2 }}>
              {formatBonus(baseMod)} 属 
              {isProf && ` + ${pb} 熟`} 
              {isExpertise && ` + ${pb} 专`} 
              {customBonus !== 0 && ` ${formatBonus(customBonus)} 加`}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {isEditMode ? (
            <input 
              type="number"
              value={customBonus}
              onChange={(e) => handleUpdateBonus(targetId, Number(e.target.value))}
              style={{ width: 35, fontSize: 11, border: '1px solid var(--color-border-dark)', background: 'var(--color-bg-surface-elevated)', color: 'var(--color-text-primary)', textAlign: 'center', borderRadius: 4, padding: '2px 0' }}
            />
          ) : (
            customBonus !== 0 && <span style={{ fontSize: 11, color: 'var(--color-primary)', width: 35, textAlign: 'center' }}>{formatBonus(customBonus)}</span>
          )}
          <span style={{ width: 40, textAlign: 'right', fontWeight: 800, fontSize: 18, color: total >= 0 ? 'var(--color-primary)' : 'var(--color-danger)' }}>
            {formatBonus(total)}
          </span>
        </div>
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', background: isEditMode ? 'rgba(255, 149, 0, 0.05)' : 'transparent', padding: isEditMode ? '16px 20px' : '0', borderRadius: 16, border: isEditMode ? '1px solid rgba(255, 149, 0, 0.2)' : '1px solid transparent', transition: 'all 0.3s' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>属性与技能 <span style={{ fontSize: 13, color: 'var(--color-text-tertiary)', fontWeight: 400 }}>Abilities & Skills</span></h2>
          <p style={{ margin: '4px 0 0', fontSize: 12, color: isEditMode ? 'var(--color-warning)' : 'var(--color-text-tertiary)', fontWeight: isEditMode ? 600 : 400 }}>
            {isEditMode ? '⚠ 自由编辑模式已开启：改动将直接覆盖引导数据。' : '当前为查看模式：点击右侧开关解锁手动编辑。'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: isEditMode ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}>解锁快速编辑</span>
          <div 
            onClick={() => updateActiveCharacter({ sheetEditMode: !isEditMode })}
            style={{ 
              width: 48, height: 24, borderRadius: 12, 
              background: isEditMode ? 'var(--color-warning)' : 'var(--color-border-dark)',
              position: 'relative', cursor: 'pointer', transition: 'all 0.3s'
            }}
          >
            <div style={{ 
              width: 20, height: 20, borderRadius: '50%', background: 'var(--color-gold-bright)',
              position: 'absolute', top: 2, left: isEditMode ? 26 : 2,
              transition: 'all 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.5)'
            }} />
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 24 }}>
        {Object.entries(ability.scores).map(([key, value]) => {
          const mod = ability.modifiers[key as keyof typeof ability.modifiers];
          const relatedSkills = ALL_SKILLS.filter(s => skillToAbility[s] === key);
          const isSaveProf = (proficiencies?.saves || []).some((p: any) => p.id === key);

          return (
            <div key={key} className={styles.card} style={{ padding: 0, overflow: 'hidden', background: 'var(--color-bg-surface)', border: isEditMode ? '1px solid var(--color-warning)' : '1px solid var(--color-border-dark)' }}>
              {/* Header */}
              <div style={{ padding: '20px', background: 'var(--color-bg-dark)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border-dark)' }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-secondary)', textTransform: 'uppercase', fontFamily: 'var(--font-family-serif)' }}>{translateAbilityKey(key)}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                    <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>数值:</span>
                    {isEditMode ? (
                      <input 
                        type="number"
                        value={value as number}
                        onChange={(e) => handleUpdateScore(key, Number(e.target.value))}
                        style={{ width: 50, fontSize: 16, fontWeight: 700, border: '1px solid var(--color-gold-accent)', background: 'var(--color-bg-surface)', color: 'var(--color-text-primary)', borderRadius: 4, textAlign: 'center' }}
                      />
                    ) : (
                      <span style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-text-primary)' }}>{value as number}</span>
                    )}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase' }}>调整值</div>
                  <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--color-gold-bright)', lineHeight: 1, textShadow: '0 0 10px rgba(197,160,89,0.3)' }}>{formatBonus(mod)}</div>
                </div>
              </div>

              {/* Saves & Skills List */}
              <div style={{ padding: '8px 20px 20px' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-gold-bright)', textTransform: 'uppercase', marginTop: 12, marginBottom: 8, letterSpacing: '0.05em', fontFamily: 'var(--font-family-serif)' }}>豁免检定</div>
                {renderItem('豁免', `${translateAbilityKey(key)}豁免`, key, mod, isSaveProf)}

                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-gold-bright)', textTransform: 'uppercase', marginTop: 20, marginBottom: 8, letterSpacing: '0.05em', fontFamily: 'var(--font-family-serif)' }}>相关技能</div>
                {relatedSkills.map(skillId => {
                  const isProf = (proficiencies?.skills || []).some((p: any) => p.id === skillId);
                  const isExpertise = (character.expertiseSkills || []).includes(skillId);
                  return renderItem('技能', translateSkill(skillId, true), skillId, mod, isProf, isExpertise);
                })}
                {relatedSkills.length === 0 && <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontStyle: 'italic', padding: '10px 0' }}>无相关技能</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AbilitiesTab;
