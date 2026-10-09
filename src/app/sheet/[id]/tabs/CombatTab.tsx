import React, { useState, useMemo } from 'react';
import styles from '../../sheet.module.css';
import PillButton from '@/components/PillButton';
import { ALL_CONDITIONS } from '@/rules/conditions';
import { getClassDefinition } from '@/engine/characterData';
import { useCharacterStore } from '@/store/characterStore';
import { CharacterSheetView } from '@/engine/viewAdapter';

import { translateProficiency } from '@/engine/terminology';

interface CombatTabProps {
  character: any;
  primaryClass: any;
  totalLevel: number;
  sheetView: CharacterSheetView;
  updateActiveCharacter: (data: any) => void;
  DeathSaveTracker: any;
  isEditMode: boolean;
}

const CombatTab: React.FC<CombatTabProps> = ({ 
  character, primaryClass, totalLevel, sheetView, updateActiveCharacter, DeathSaveTracker, isEditMode 
}) => {
  const { updateManualOverrides } = useCharacterStore();
  const { final, flags, computed } = sheetView;
  const { combat, ability, proficiencies } = computed;
  const { modifiers } = final;

  const [editingField, setEditingField] = useState<string | null>(null);
  const [showHPSettings, setShowHPSettings] = useState(false);
  const [tempValue, setTempValue] = useState<string>('');
  const [showConditionSelector, setShowConditionSelector] = useState(false);
  const [viewingCondition, setViewingCondition] = useState<any>(null);
  const [hoveredCondition, setHoveredCondition] = useState<any>(null);

  // HP Rolling State
  const [rollTargetLevel, setRollTargetLevel] = useState<number | null>(null);
  const [rollConfirmStep, setRollConfirmStep] = useState(0);

  const handleEditClick = (field: string, currentVal: any) => {
    if (!isEditMode) return;
    setEditingField(field);
    setTempValue(String(currentVal));
  };

  const handleSaveValue = () => {
    const val = parseInt(tempValue) || 0;
    if (editingField === 'currentHp') {
      updateActiveCharacter({ currentHp: Math.min(final.maxHp, Math.max(0, val)) });
    } else if (editingField === 'tempHp') {
      updateActiveCharacter({ tempHp: Math.max(0, val) });
    } else if (editingField === 'ac') {
      updateManualOverrides({ ac: val });
    } else if (editingField === 'initiative') {
      updateManualOverrides({ initiative: val });
    } else if (editingField === 'speed') {
      updateManualOverrides({ speed: val });
    } else if (editingField === 'spellSaveDc') {
      updateManualOverrides({ spellSaveDc: val });
    } else if (editingField === 'spellAttackBonus') {
      updateManualOverrides({ spellAttackBonus: val });
    }
    setEditingField(null);
  };

  const toggleCondition = (condId: string) => {
    const current = character.conditions || [];
    const next = current.includes(condId) ? current.filter((c: string) => c !== condId) : [...current, condId];
    updateActiveCharacter({ conditions: next });
  };

  const hpMode = character.hpCalculationMode || 'fixed';

  // Calculate hit dice and info per level
  const levelByLevelInfo = useMemo(() => {
    const info: { level: number; classId: string; className: string; hitDie: number; average: number }[] = [];
    let counter = 0;
    character.classes.forEach((cEntry: any) => {
      const def = getClassDefinition(cEntry.classId);
      const hitDie = def?.hitPointDie || 8;
      const className = def?.name || cEntry.classId;
      for (let i = 1; i <= cEntry.level; i++) {
        counter++;
        info.push({ level: counter, classId: cEntry.classId, className, hitDie, average: Math.floor(hitDie / 2) + 1 });
      }
    });
    return info;
  }, [character.classes]);

  const handleRollHP = (level: number, hitDie: number) => {
    const roll = Math.floor(Math.random() * hitDie) + 1;
    const currentRolls = character.hpLevelRolls || {};
    updateActiveCharacter({
      hpLevelRolls: { ...currentRolls, [level]: roll }
    });
    setRollTargetLevel(null);
    setRollConfirmStep(0);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 40 }}>
      {/* 1. 实时状态追踪 (高密度横向栏) */}
      <div className={styles.card} style={{ padding: '8px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div 
            style={{ 
              flex: 1, textAlign: 'center', cursor: 'pointer', padding: '4px', borderRadius: 8,
              border: character.inspiration ? '2px solid var(--color-primary)' : '1px solid transparent',
              background: character.inspiration ? 'rgba(0,113,227,0.05)' : 'transparent',
              transition: 'all 0.2s'
            }}
            onClick={() => updateActiveCharacter({ inspiration: !character.inspiration })}
          >
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-tertiary)', marginBottom: 2 }}>激励</div>
            <div style={{ fontSize: 20, color: character.inspiration ? 'var(--color-primary)' : 'var(--color-border-dark)' }}>
              {character.inspiration ? '★' : '☆'}
            </div>
          </div>

          <div style={{ width: 1, height: 24, background: 'var(--color-border-subtle)' }} />

          <div style={{ flex: 2 }}>
            <DeathSaveTracker 
              successes={character.deathSaves?.success ?? 0}
              failures={character.deathSaves?.failure ?? 0}
              onUpdate={(type: string, val: number) => {
                const current = character.deathSaves || { success: 0, failure: 0 };
                updateActiveCharacter({ 
                  deathSaves: { ...current, [type]: val } 
                });
              }}
            />
          </div>

          <div style={{ width: 1, height: 24, background: 'var(--color-border-subtle)' }} />

          <div style={{ flex: 2, textAlign: 'center' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-tertiary)', marginBottom: 2 }}>生命骰 (d{primaryClass?.hitPointDie || 8})</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 800 }}>{totalLevel - (character.hitDiceUsed ?? 0)}<small style={{ fontSize: 10, color: '#86868b', fontWeight: 500 }}>/{totalLevel}</small></span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button 
                  style={{ border: 'none', background: 'var(--color-bg-subtle)', borderRadius: 4, width: 20, height: 20, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => updateActiveCharacter({ hitDiceUsed: Math.min(totalLevel, (character.hitDiceUsed ?? 0) + 1) })}
                >-</button>
                <button 
                  style={{ border: 'none', background: 'var(--color-bg-subtle)', borderRadius: 4, width: 20, height: 20, cursor: 'pointer', fontSize: 12, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                  onClick={() => updateActiveCharacter({ hitDiceUsed: Math.max(0, (character.hitDiceUsed ?? 0) - 1) })}
                >+</button>
              </div>
            </div>
          </div>

          <div style={{ width: 1, height: 24, background: 'var(--color-border-subtle)' }} />

          <div style={{ flex: 1.5, textAlign: 'center' }}>
            <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-tertiary)', marginBottom: 2 }}>力竭等级</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              <span style={{ fontSize: 18, fontWeight: 800 }}>{character.exhaustion ?? 0}</span>
              <div style={{ display: 'flex', gap: 4 }}>
                <button 
                  style={{ border: 'none', background: 'var(--color-bg-subtle)', borderRadius: 4, width: 18, height: 18, cursor: 'pointer', fontSize: 10 }}
                  onClick={() => updateActiveCharacter({ exhaustion: Math.max(0, (character.exhaustion ?? 0) - 1) })}
                >-</button>
                <button 
                  style={{ border: 'none', background: 'var(--color-bg-subtle)', borderRadius: 4, width: 18, height: 18, cursor: 'pointer', fontSize: 10 }}
                  onClick={() => updateActiveCharacter({ exhaustion: Math.min(6, (character.exhaustion ?? 0) + 1) })}
                >+</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {/* 2. 属性核心 (高密度) */}
        <div className={styles.card} style={{ padding: '16px' }}>
          <div className={styles.cardTitle} style={{ fontSize: 14, marginBottom: 12 }}>
            <span>属性核心</span>
            <PillButton size="xs" variant="outline" onClick={() => setShowHPSettings(true)}>⚙️ 配置 HP</PillButton>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div 
              style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-dark)', cursor: isEditMode ? 'pointer' : 'default' }}
              onClick={() => handleEditClick('ac', final.ac)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: flags.isAcManual ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}>护甲等级 (AC) {flags.isAcManual && '✎'}</span>
                {isEditMode && flags.isAcManual && (
                  <span onClick={(e) => { e.stopPropagation(); updateManualOverrides({ ac: undefined }); }} style={{ fontSize: 10, color: 'var(--color-gold-bright)', cursor: 'pointer' }}>↺</span>
                )}
              </div>
              <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--color-gold-bright)' }}>{final.ac}</span>
            </div>
            
            <div 
              style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-dark)', cursor: 'pointer' }}
              onClick={() => handleEditClick('currentHp', final.currentHp)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: flags.isMaxHpManual ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}>当前 HP / 最大 HP {flags.isMaxHpManual && '✎'}</span>
                {isEditMode && flags.isMaxHpManual && (
                  <span onClick={(e) => { e.stopPropagation(); updateManualOverrides({ maxHp: undefined }); }} style={{ fontSize: 10, color: 'var(--color-gold-bright)', cursor: 'pointer' }}>↺</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontWeight: 800, fontSize: 18, color: final.currentHp < final.maxHp ? 'var(--color-danger)' : 'var(--color-text-primary)' }}>
                  {final.currentHp} / {final.maxHp} ✎
                </span>
                <span style={{ fontSize: 8, color: 'var(--color-text-tertiary)' }}>
                  方式: {hpMode === 'fixed' ? '期望' : hpMode === 'rolled' ? '投骰' : '自定义'}
                </span>
              </div>
            </div>

            <div 
              style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-dark)', cursor: 'pointer' }}
              onClick={() => handleEditClick('tempHp', final.tempHp)}
            >
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-secondary)' }}>临时 HP</span>
              <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--color-gold-bright)' }}>
                {final.tempHp || 0} ✎
              </span>
            </div>

            <div 
              style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-dark)', cursor: isEditMode ? 'pointer' : 'default' }}
              onClick={() => handleEditClick('initiative', final.initiative)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: flags.isInitiativeManual ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}>先攻加值 {flags.isInitiativeManual && '✎'}</span>
                {isEditMode && flags.isInitiativeManual && (
                  <span onClick={(e) => { e.stopPropagation(); updateManualOverrides({ initiative: undefined }); }} style={{ fontSize: 10, color: 'var(--color-gold-bright)', cursor: 'pointer' }}>↺</span>
                )}
              </div>
              <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--color-gold-bright)' }}>{final.initiative >= 0 ? `+${final.initiative}` : final.initiative}</span>
            </div>

            <div 
              style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-dark)', cursor: isEditMode ? 'pointer' : 'default' }}
              onClick={() => handleEditClick('spellSaveDc', final.spellSaveDc)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: flags.isSpellSaveDcManual ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}>法术 DC {flags.isSpellSaveDcManual && '✎'}</span>
                {isEditMode && flags.isSpellSaveDcManual && (
                  <span onClick={(e) => { e.stopPropagation(); updateManualOverrides({ spellSaveDc: undefined }); }} style={{ fontSize: 10, color: 'var(--color-gold-bright)', cursor: 'pointer' }}>↺</span>
                )}
              </div>
              <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--color-gold-bright)' }}>{final.spellSaveDc}</span>
            </div>

            <div 
              style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid var(--color-border-dark)', cursor: isEditMode ? 'pointer' : 'default' }}
              onClick={() => handleEditClick('spellAttackBonus', final.spellAttackBonus)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: flags.isSpellAttackBonusManual ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}>法术攻击加值 {flags.isSpellAttackBonusManual && '✎'}</span>
                {isEditMode && flags.isSpellAttackBonusManual && (
                  <span onClick={(e) => { e.stopPropagation(); updateManualOverrides({ spellAttackBonus: undefined }); }} style={{ fontSize: 10, color: 'var(--color-gold-bright)', cursor: 'pointer' }}>↺</span>
                )}
              </div>
              <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--color-gold-bright)' }}>{final.spellAttackBonus >= 0 ? `+${final.spellAttackBonus}` : final.spellAttackBonus}</span>
            </div>

            <div 
              style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', cursor: isEditMode ? 'pointer' : 'default' }}
              onClick={() => handleEditClick('speed', final.speed)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: flags.isSpeedManual ? 'var(--color-warning)' : 'var(--color-text-secondary)' }}>移动速度 {flags.isSpeedManual && '✎'}</span>
                {isEditMode && flags.isSpeedManual && (
                  <span onClick={(e) => { e.stopPropagation(); updateManualOverrides({ speed: undefined }); }} style={{ fontSize: 10, color: 'var(--color-gold-bright)', cursor: 'pointer' }}>↺</span>
                )}
              </div>
              <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--color-gold-bright)' }}>{final.speed}尺</span>
            </div>
          </div>
        </div>

        {/* 3. 状态标记 (高密度) */}
        <div className={styles.card} style={{ padding: '16px' }}>
          <div className={styles.cardTitle} style={{ fontSize: 14, marginBottom: 12 }}>
            <span>状态标记</span>
            <PillButton size="xs" variant="outline" onClick={() => setShowConditionSelector(true)}>管理</PillButton>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div 
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', paddingBottom: 8, borderBottom: '1px solid var(--color-border-dark)' }}
              onClick={() => updateActiveCharacter({ concentration: !character.concentration })}
            >
              <span style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-tertiary)' }}>法术专注</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: character.concentration ? 'var(--color-primary)' : 'var(--color-border-dark)' }}>
                {character.concentration ? '正在维持 ●' : '无 ○'}
              </span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
              {(character.conditions || []).map((cId: string) => {
                const cond = ALL_CONDITIONS.find(c => c.id === cId);
                return (
                  <div 
                    key={cId} 
                    style={{ 
                      padding: '2px 8px', 
                      background: 'var(--color-danger)', 
                      color: 'white', 
                      borderRadius: 4, 
                      fontSize: 10, 
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                    onClick={() => setViewingCondition(cond)}
                  >
                    {cond?.name || cId}
                  </div>
                );
              })}
              {(character.conditions || []).length === 0 && (
                <span style={{ color: 'var(--color-border-dark)', fontSize: 11, fontWeight: 500 }}>目前处于健康状态</span>
              )}
            </div>

            {/* 伤害抗性 */}
            <div style={{ paddingTop: 8, marginTop: 4, borderTop: '1px solid var(--color-border-dark)' }}>
              <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--color-text-tertiary)', marginBottom: 4, letterSpacing: '0.05em' }}>伤害抗性 RESISTANCES</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {proficiencies?.resistances && proficiencies.resistances.length > 0 ? (
                  proficiencies.resistances.map((r: any) => (
                    <span 
                      key={r.id} 
                      style={{ 
                        padding: '2px 8px', 
                        background: 'rgba(239, 68, 68, 0.15)', 
                        border: '1px solid rgba(239, 68, 68, 0.4)', 
                        color: '#f87171', 
                        borderRadius: 4, 
                        fontSize: 10, 
                        fontWeight: 700 
                      }}
                      title={`来源: ${r.source}`}
                    >
                      🛡️ {translateProficiency(r.id)}
                    </span>
                  ))
                ) : (
                  <span style={{ color: 'var(--color-text-tertiary)', fontSize: 10, fontStyle: 'italic' }}>无特殊抗性</span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 数值编辑模态框 */}
      {editingField && (
        <div className={styles.overlay} onClick={() => setEditingField(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>
              修改 {
                editingField === 'currentHp' ? '当前 HP' : 
                editingField === 'tempHp' ? '临时 HP' :
                editingField === 'ac' ? '护甲等级 (AC)' :
                editingField === 'initiative' ? '先攻加值' :
                editingField === 'speed' ? '移动速度' :
                editingField === 'spellSaveDc' ? '法术 DC' :
                editingField === 'spellAttackBonus' ? '法术攻击加值' : '数值'
              }
            </h3>
            <div className={styles.inputGroup}>
              <input 
                type="number" 
                className={styles.inputField}
                value={tempValue}
                onChange={e => setTempValue(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <PillButton size="md" variant="outline" style={{ flex: 1 }} onClick={() => setEditingField(null)}>取消</PillButton>
              <PillButton size="md" variant="primary" style={{ flex: 1 }} onClick={handleSaveValue}>确认</PillButton>
            </div>
          </div>
        </div>
      )}

      {/* HP 设置模态框 */}
      {showHPSettings && (
        <div className={styles.overlay} onClick={() => setShowHPSettings(false)}>
          <div className={styles.modal} style={{ maxWidth: 600 }} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>生命值计算设置</h3>
            
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 13, color: '#86868b', marginBottom: 12, fontWeight: 600 }}>计算模式</div>
              <div className={styles.gridList} style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
                <div 
                  className={`${styles.listItem} ${hpMode === 'fixed' ? styles.listItemActive : ''}`}
                  onClick={() => updateActiveCharacter({ hpCalculationMode: 'fixed' })}
                >
                  期望值
                </div>
                <div 
                  className={`${styles.listItem} ${hpMode === 'rolled' ? styles.listItemActive : ''}`}
                  onClick={() => updateActiveCharacter({ hpCalculationMode: 'rolled' })}
                >
                  逐级配置
                </div>
                <div 
                  className={`${styles.listItem} ${hpMode === 'custom' ? styles.listItemActive : ''}`}
                  onClick={() => updateActiveCharacter({ hpCalculationMode: 'custom' })}
                >
                  手动输入
                </div>
              </div>
            </div>

            {(hpMode === 'fixed' || hpMode === 'rolled') && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 600 }}>等级详情</div>
                <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid var(--color-border-dark)', borderRadius: 12 }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                    <thead style={{ background: 'var(--color-bg-dark)', position: 'sticky', top: 0, borderBottom: '1px solid var(--color-border-dark)' }}>
                      <tr>
                        <th style={{ padding: 10, textAlign: 'left', color: 'var(--color-gold-bright)' }}>等级</th>
                        <th style={{ padding: 10, textAlign: 'left', color: 'var(--color-gold-bright)' }}>职业</th>
                        <th style={{ padding: 10, textAlign: 'center', color: 'var(--color-gold-bright)' }}>生命值增加</th>
                        <th style={{ padding: 10, textAlign: 'center', color: 'var(--color-gold-bright)' }}>操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {levelByLevelInfo.map((info) => {
                        const roll = character.hpLevelRolls?.[info.level];
                        const isRolled = typeof roll === 'number';
                        const isLevel1 = info.level === 1;

                        return (
                          <tr key={info.level} style={{ borderBottom: '1px solid var(--color-border-dark)' }}>
                            <td style={{ padding: 10 }}>Lv.{info.level}</td>
                            <td style={{ padding: 10 }}>{info.className}</td>
                            <td style={{ padding: 10, textAlign: 'center' }}>
                              {isLevel1 ? (
                                <span style={{ fontWeight: 600 }}>{info.hitDie} <small>(最大值)</small></span>
                              ) : isRolled ? (
                                <span style={{ fontWeight: 600, color: 'var(--color-primary)' }}>{roll} <small>(投骰)</small></span>
                              ) : (
                                <span>{info.average} <small>(期望值)</small></span>
                              )}
                            </td>
                            <td style={{ padding: 10, textAlign: 'center' }}>
                              {!isLevel1 && !isRolled && (
                                <PillButton 
                                  size="xs" 
                                  variant="outline" 
                                  onClick={() => {
                                    setRollTargetLevel(info.level);
                                    setRollConfirmStep(1);
                                  }}
                                >
                                  投骰
                                </PillButton>
                              )}
                              {isRolled && <span style={{ color: '#34c759', fontSize: 11 }}>已锁定</span>}
                              {isLevel1 && <span style={{ color: '#86868b', fontSize: 11 }}>固定</span>}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ textAlign: 'right', marginTop: 8 }}>
                   <div style={{ fontSize: 12, color: '#86868b' }}>
                     体质修正 (+{modifiers.con} × {totalLevel}) = {modifiers.con * totalLevel}
                   </div>
                   <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--color-primary)', marginTop: 4 }}>
                     最大 HP: {final.maxHp}
                   </div>
                </div>
              </div>
            )}

            {hpMode === 'custom' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ background: 'rgba(197, 160, 89, 0.1)', padding: 12, borderRadius: 8, fontSize: 12, color: 'var(--color-gold-bright)', border: '1px solid var(--color-border-gold)' }}>
                  注意：手动输入模式将无视所有自动规则。
                </div>
                <div className={styles.inputGroup}>
                  <label>自定义最大 HP 值</label>
                  <input 
                    type="number" 
                    className={styles.inputField}
                    value={character.customMaxHp || final.maxHp}
                    onChange={e => updateActiveCharacter({ customMaxHp: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
            )}

            <div style={{ marginTop: 32 }}>
              <PillButton size="md" variant="primary" style={{ width: '100%' }} onClick={() => setShowHPSettings(false)}>关闭</PillButton>
            </div>
          </div>
        </div>
      )}

      {/* 投骰二次确认 */}
      {rollTargetLevel && (
        <div className={styles.overlay} style={{ zIndex: 1100 }}>
          <div className={styles.modal} style={{ maxWidth: 400 }}>
            <h3 className={styles.modalTitle}>
              {rollConfirmStep === 1 ? '确认投骰计算？' : '⚠️ 最终确认'}
            </h3>
            <p style={{ textAlign: 'center', color: '#424245', lineHeight: 1.6, marginBottom: 24 }}>
              {rollConfirmStep === 1 
                ? `你即将为 ${rollTargetLevel} 级进行生命值投骰。投骰结果将永久替换该等级的期望值。`
                : '投骰结果一旦产生将无法撤销或重新投掷。请确认你已征得 DM 同意。'}
            </p>
            <div style={{ display: 'flex', gap: 12 }}>
              <PillButton 
                style={{ flex: 1 }} 
                variant="outline" 
                onClick={() => {
                  setRollTargetLevel(null);
                  setRollConfirmStep(0);
                }}
              >
                取消
              </PillButton>
              <PillButton 
                style={{ flex: 1 }} 
                variant={rollConfirmStep === 2 ? 'danger' : 'primary'}
                onClick={() => {
                  if (rollConfirmStep === 1) {
                    setRollConfirmStep(2);
                  } else {
                    const info = levelByLevelInfo.find(i => i.level === rollTargetLevel);
                    if (info) handleRollHP(info.level, info.hitDie);
                  }
                }}
              >
                {rollConfirmStep === 1 ? '继续' : '确认投骰'}
              </PillButton>
            </div>
          </div>
        </div>
      )}

      {/* 状态选择器模态框 (双栏固定高度无抖动布局) */}
      {showConditionSelector && (
        <div className={styles.overlay} onClick={() => setShowConditionSelector(false)}>
          <div className={styles.modal} style={{ maxWidth: 780, width: '92%', padding: 24 }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 className={styles.modalTitle} style={{ margin: 0 }}>异常状态管理</h3>
              <PillButton size="sm" variant="outline" onClick={() => setShowConditionSelector(false)}>✕ 关闭</PillButton>
            </div>

            {/* 顶部已激活状态标签栏 */}
            <div style={{ background: 'var(--color-bg-subtle)', padding: '10px 14px', borderRadius: 12, marginBottom: 16 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-tertiary)', marginBottom: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>已生效状态 ({(character.conditions || []).length})：</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>点击快捷移除 / 点击列表中状态查看规则</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 26, alignItems: 'center' }}>
                {(character.conditions || []).length === 0 ? (
                  <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}>目前身体状况良好，无任何异常状态</span>
                ) : (
                  (character.conditions || []).map((cId: string) => {
                    const cond = ALL_CONDITIONS.find(c => c.id === cId);
                    return (
                      <div 
                        key={cId} 
                        style={{ 
                          padding: '3px 10px', 
                          background: 'var(--color-danger)', 
                          color: '#fff', 
                          borderRadius: 14, 
                          fontSize: 12, 
                          fontWeight: 600, 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 6, 
                          cursor: 'pointer',
                          boxShadow: '0 2px 5px rgba(255, 59, 48, 0.2)'
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleCondition(cId);
                        }}
                        title="点击快捷移除此状态"
                      >
                        <span>{cond?.name || cId}</span>
                        <span style={{ fontSize: 11, opacity: 0.9, fontWeight: 800 }}>✕</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 双栏主体：左侧状态按钮网格，右侧固定高度规则详情 */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
              {/* 左栏：状态选择列表 */}
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-tertiary)', marginBottom: 8 }}>选择状态 (点击切换/查看规则)：</div>
                <div className={styles.gridList} style={{ gridTemplateColumns: 'repeat(2, 1fr)', maxHeight: 340, overflowY: 'auto', paddingRight: 4 }}>
                  {ALL_CONDITIONS.map(cond => {
                    const isActive = (character.conditions || []).includes(cond.id);
                    const isInspecting = (hoveredCondition?.id || ALL_CONDITIONS[0].id) === cond.id;
                    return (
                      <div 
                        key={cond.id} 
                        className={`${styles.listItem} ${isActive ? styles.listItemActive : ''}`}
                        style={{
                          borderLeft: isInspecting ? '4px solid var(--color-primary)' : undefined,
                          fontWeight: isInspecting || isActive ? 700 : 500
                        }}
                        onClick={() => {
                          setHoveredCondition(cond);
                          toggleCondition(cond.id);
                        }}
                      >
                        <span style={{ flex: 1 }}>{cond.name}</span>
                        {isActive && <span style={{ fontSize: 12, fontWeight: 800, color: '#ff3b30' }}>✓</span>}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 右栏：固定高度的规则详情面板 */}
              {(() => {
                const activePreviewCond = hoveredCondition || 
                  ALL_CONDITIONS.find(c => (character.conditions || []).includes(c.id)) || 
                  ALL_CONDITIONS[0];
                const isSelected = (character.conditions || []).includes(activePreviewCond.id);

                return (
                  <div style={{ 
                    height: 375, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    background: 'var(--color-bg-light)', 
                    borderRadius: 12, 
                    border: '1px solid var(--color-border-subtle)', 
                    padding: 16,
                    boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--color-border-subtle)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontWeight: 800, fontSize: 17, color: 'var(--color-text-primary)' }}>
                          {activePreviewCond.name}
                        </span>
                        <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, background: isSelected ? 'rgba(255, 59, 48, 0.1)' : 'var(--color-bg-subtle)', color: isSelected ? '#ff3b30' : 'var(--color-text-tertiary)', fontWeight: 700 }}>
                          {isSelected ? '● 已生效' : '○ 未启用'}
                        </span>
                      </div>
                      <PillButton 
                        size="xs" 
                        variant={isSelected ? 'outline' : 'primary'} 
                        onClick={() => toggleCondition(activePreviewCond.id)}
                      >
                        {isSelected ? '移除状态' : '启用状态'}
                      </PillButton>
                    </div>

                    <div style={{ flex: 1, overflowY: 'auto', fontSize: 13, lineHeight: 1.65, color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', paddingRight: 4 }}>
                      {activePreviewCond.description}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div style={{ marginTop: 20 }}>
              <PillButton size="md" variant="primary" style={{ width: '100%' }} onClick={() => setShowConditionSelector(false)}>完成并关闭</PillButton>
            </div>
          </div>
        </div>
      )}

      {/* 状态详情模态框 */}
      {viewingCondition && (
        <div className={styles.overlay} onClick={() => setViewingCondition(null)}>
          <div className={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>{viewingCondition.name}</h3>
            <div style={{ lineHeight: 1.6, fontSize: 15, color: '#424245', whiteSpace: 'pre-wrap' }}>
              {viewingCondition.description}
            </div>
            <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
              <PillButton size="md" variant="outline" style={{ flex: 1 }} onClick={() => toggleCondition(viewingCondition.id)}>移除该状态</PillButton>
              <PillButton size="md" variant="primary" style={{ flex: 1 }} onClick={() => setViewingCondition(null)}>确定</PillButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CombatTab;

