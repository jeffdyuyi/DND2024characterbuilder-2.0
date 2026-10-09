'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCharacterStore } from '@/store/characterStore';
import { computeProficiencies } from '@/engine/proficiency';
import { getBackgroundDefinition, getSpeciesDefinition, getSubspeciesDefinition } from '@/engine/characterData';
import OptionCard from '@/components/OptionCard';
import styles from '../species/page.module.css'; // Reuse species layout styles
import skillStyles from './skills.module.css';

import { ALL_SKILLS, SKILL_MAP, translateSkill } from '@/engine/terminology';

const SKILLS = ALL_SKILLS.map((id) => ({
  id,
  name: SKILL_MAP[id] || translateSkill(id) || id,
}));

export default function SkillsPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { characters, updateActiveCharacter, loadCharacter } = useCharacterStore();
  const character = id ? characters[id] : null;

  useEffect(() => {
    if (id) {
      loadCharacter(id);
    }
  }, [id, loadCharacter]);

  if (!character) return <div className="page-container">加载中...</div>;

  const proficiencies = computeProficiencies(character);
  const selectedSkills = character.selectedSkills || [];
  
  const backgroundDef = getBackgroundDefinition(character);
  const speciesDef = getSpeciesDefinition(character);
  const subspeciesDef = getSubspeciesDefinition(character);

  const handleToggleSkill = (skillId: string, isFixed: boolean) => {
    if (isFixed) return;
    
    let newSkills = [...selectedSkills];
    if (newSkills.includes(skillId)) {
      newSkills = newSkills.filter(s => s !== skillId);
    } else {
      newSkills.push(skillId);
    }
    updateActiveCharacter({ selectedSkills: newSkills });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>熟练项概览</h2>
          <p className={styles.subtitle}>结合你的背景、种族与职业，查看并补充你缺乏的技能与工具熟练。</p>
        </div>
      </div>

      <div className={styles.content}>
        <h3 className={skillStyles.sectionTitle}>技能熟练项 (Skills)</h3>
        <div className={skillStyles.skillsGrid}>
          {SKILLS.map(skill => {
            // 1. 检查引擎计算出的熟练项是否存在
            const prof = proficiencies.skills.find(p => p.id === skill.id);
            const isProficient = !!prof;

            // 2. 判定是否为“固定项”（来自种族、背景或职业的选择通常不在此页面手动修改）
            const isFixed = isProficient && prof.sources.some(s => 
              (backgroundDef && s.includes(backgroundDef.name)) || 
              (speciesDef && s.includes(speciesDef.name)) ||
              (subspeciesDef && s.includes(subspeciesDef.name)) ||
              s.includes('背景') || s.includes('种族') || s.includes('Class') || s.includes('职业')
            );

            // 3. 最终选中状态：引擎判定熟练，或者在全局手动数组中
            const isSelected = isProficient || selectedSkills.includes(skill.id);
            const overlappingSources = proficiencies.duplicates[`skills:${skill.id}`] || [];
            const hasDuplicateWarning = overlappingSources.length > 1 && !isFixed;

            return (
              <div 
                key={skill.id} 
                className={`${skillStyles.skillCard} ${isSelected ? skillStyles.skillCardSelected : ''} ${isFixed ? skillStyles.skillCardFixed : ''}`}
                onClick={() => handleToggleSkill(skill.id, isFixed)}
              >
                <div className={skillStyles.skillHeader}>
                  <span className={skillStyles.skillName}>{skill.name}</span>
                  <div className={skillStyles.checkbox}>
                    {isSelected && <span className={skillStyles.checkmark}>✓</span>}
                  </div>
                </div>
                
                {isFixed && (
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                    来源: {prof?.sources.join(', ')}
                  </div>
                )}

                {hasDuplicateWarning && isSelected && (
                  <div className={skillStyles.warningBox}>
                    ⚠️ 重复提示：你已通过以下来源获得此技能熟练 ({overlappingSources.join(' 与 ')})。
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className={skillStyles.toolSection}>
          <h3 className={skillStyles.sectionTitle}>工具熟练项 (Tools)</h3>
          {proficiencies.tools.length > 0 ? (
            <div className={skillStyles.skillsGrid}>
              {proficiencies.tools.map(tool => (
                <div key={tool.id} className={`${skillStyles.skillCard} ${skillStyles.skillCardSelected} ${skillStyles.skillCardFixed}`}>
                   <div className={skillStyles.skillHeader}>
                    <span className={skillStyles.skillName}>{tool.id}</span>
                    <div className={skillStyles.checkbox}>
                      <span className={skillStyles.checkmark}>✓</span>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4 }}>
                    来源: {tool.sources.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ color: 'var(--color-text-tertiary)' }}>当前尚未获得任何工具熟练项。</p>
          )}

          <p style={{ marginTop: 24, fontSize: 13, color: 'var(--color-text-tertiary)' }}>
            提示：若职业或背景提供工具选择，请在对应的“背景”或“职业”步骤中进行选择。此处仅做最终汇总展示。
          </p>
        </div>
      </div>
    </div>
  );
}

