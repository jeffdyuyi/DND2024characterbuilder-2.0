import React from 'react';
import styles from '../../sheet.module.css';
import PillButton from '@/components/PillButton';
import { ALL_SKILLS, translateSkill, translateProficiency, translateAbilityKey } from '@/engine/terminology';

interface SkillsTabProps {
  character: any;
  proficiencies: any;
  ability: any;
  pb: number;
  router: any;
  id: string;
}

const SkillsTab: React.FC<SkillsTabProps> = ({ character, proficiencies, ability, pb, router, id }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div className={styles.card}>
        <div className={styles.cardTitle}>
          <span>技能列表</span>
          <PillButton size="sm" variant="outline" onClick={() => router.push(`/builder/skills?id=${id}`)}>编辑</PillButton>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0 40px' }}>
          {ALL_SKILLS.map(skillId => {
            const prof = proficiencies.skills.find((p: any) => p.id === skillId);
            const expertise = character.expertiseSkills?.includes(skillId);
            const isProf = !!prof;
            const skillBonuses = proficiencies.skillBonuses.filter((b: any) => b.skill === skillId);
            
            const skillToAbility: Record<string, string> = {
              arcana: 'int', history: 'int', investigation: 'int', nature: 'int', religion: 'int',
              athletics: 'str', acrobatics: 'dex', sleightOfHand: 'dex', stealth: 'dex',
              insight: 'wis', animalHandling: 'wis', medicine: 'wis', perception: 'wis', survival: 'wis',
              deception: 'cha', intimidation: 'cha', performance: 'cha', persuasion: 'cha'
            };
            const abilityKey = skillToAbility[skillId] || 'int';
            const baseMod = ability.modifiers[abilityKey as keyof typeof ability.modifiers];
            
            let total = baseMod;
            if (isProf) total += pb;
            else if (proficiencies.hasJackOfAllTrades) total += Math.floor(pb / 2);
            
            if (expertise) total += pb;
            
            const otherBonus = skillBonuses.reduce((sum: number, b: any) => b.isActive ? sum + b.bonus : sum, 0);

            const getBonusColor = (val: number) => {
              if (val > 0) return 'var(--color-primary)'; // 蓝色
              if (val < 0) return 'var(--color-danger)'; // 红色
              return 'var(--color-text-tertiary)';
            };

            const formatBonus = (val: number) => (val >= 0 ? `+${val}` : `${val}`);

            return (
              <div key={skillId} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--color-border-subtle)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div 
                    className={`${styles.bubble} ${expertise ? styles.bubbleActive : ''}`} 
                    style={{ 
                      borderColor: isProf ? 'var(--color-primary)' : 'var(--color-border-subtle)', 
                      background: isProf ? (expertise ? 'var(--color-primary)' : 'color-mix(in srgb, var(--color-primary) 30%, transparent)') : 'transparent', 
                      borderStyle: expertise ? 'double' : 'solid' 
                    }} 
                  />
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontWeight: isProf ? 600 : 400, fontSize: 15 }}>{translateSkill(skillId, false)}</span>
                      <span style={{ fontSize: 10, color: 'var(--color-text-tertiary)', background: 'var(--color-bg-subtle)', padding: '1px 4px', borderRadius: 4, fontWeight: 600 }}>
                        {translateAbilityKey(abilityKey).slice(0, 1)}
                      </span>
                    </div>
                    {/* 细化加值显示 */}
                    <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', display: 'flex', gap: 4, marginTop: 2 }}>
                      <span>{formatBonus(baseMod)}</span>
                      {isProf && <span style={{ color: 'var(--color-primary)' }}>+{pb}(熟)</span>}
                      {expertise && <span style={{ color: 'var(--color-primary)' }}>+{pb}(专)</span>}
                      {otherBonus !== 0 && <span style={{ color: getBonusColor(otherBonus) }}>{formatBonus(otherBonus)}</span>}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ 
                    fontWeight: 800, 
                    fontSize: 20, 
                    color: getBonusColor(total),
                    width: 45, 
                    textAlign: 'right',
                    fontFamily: 'SF Pro Display, system-ui'
                  }}>
                    {total >= 0 ? `+${total}` : total}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className={styles.card}>
        <h2 className={styles.cardTitle}>工具与语言</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20 }}>
          <div>
            <h3 style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginBottom: 8, textTransform: 'uppercase' }}>工具</h3>
            <ul style={{ lineHeight: 1.8, fontSize: 14 }}>
              {proficiencies.tools.map((item: any) => <li key={item.id}>{translateProficiency(item.id)}</li>)}
              {proficiencies.tools.length === 0 && <li style={{ color: 'var(--color-text-tertiary)' }}>无工具熟练</li>}
            </ul>
          </div>
          <div>
            <h3 style={{ fontSize: 13, color: 'var(--color-text-tertiary)', marginBottom: 8, textTransform: 'uppercase' }}>语言</h3>
            <ul style={{ lineHeight: 1.8, fontSize: 14 }}>
              {proficiencies.languages.map((item: any) => <li key={item.id}>{translateProficiency(item.id)}</li>)}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SkillsTab;
