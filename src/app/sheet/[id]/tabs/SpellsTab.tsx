import React, { useState } from 'react';
import styles from '../../sheet.module.css';
import PillButton from '@/components/PillButton';
import MarkdownText from '@/components/MarkdownText';
import { 
  translateAbilityKey, 
  translateSpellSchool, 
  formatSpellRange, 
  formatSpellDuration, 
  formatSpellComponent, 
  formatActionType 
} from '@/engine/terminology';

// --- Sub-components (Upgraded for Premium Look) ---

const SpellSlotTracker = ({ level, max, used, onUpdate }: any) => {
  const remaining = max - used;
  return (
    <div style={{ 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      padding: '10px 14px', 
      background: 'rgba(0,0,0,0.02)', 
      borderRadius: 12, 
      marginBottom: 10,
      border: '1px solid rgba(0,0,0,0.04)'
    }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text-primary)' }}>{level === 0 ? '戏法' : `${level} 环`}</div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {Array.from({ length: max }).map((_, i) => (
            <div 
              key={i} 
              onClick={() => onUpdate(level, max - (i + 1))}
              style={{ 
                width: 14, 
                height: 14, 
                borderRadius: '50%', 
                background: i < remaining ? 'var(--color-primary)' : 'var(--color-border-dark)',
                cursor: 'pointer',
                transition: 'all 0.2s',
                boxShadow: i < remaining ? '0 0 8px rgba(0, 113, 227, 0.3)' : 'none'
              }} 
            />
          ))}
        </div>
        <span style={{ fontSize: 11, fontWeight: 700, marginLeft: 8, color: 'var(--color-text-tertiary)', minWidth: 35, textAlign: 'right' }}>
          {remaining} / {max}
        </span>
      </div>
    </div>
  );
};

const DetailedSpellItem = ({ spell, source }: any) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const schoolZh = translateSpellSchool(spell.school);
  
  return (
    <div style={{ 
      marginBottom: 12, 
      border: '1px solid var(--color-border-subtle)', 
      borderRadius: 16, 
      overflow: 'hidden', 
      background: 'var(--color-bg-light)',
      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      boxShadow: isExpanded ? '0 4px 20px rgba(0,0,0,0.08)' : 'none',
      transform: isExpanded ? 'translateY(-2px)' : 'none'
    }}>
      <div 
        style={{ 
          cursor: 'pointer', 
          padding: '14px 18px', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center', 
          background: isExpanded ? 'rgba(0,113,227,0.03)' : 'transparent'
        }} 
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span style={{ color: 'var(--color-text-primary)' }}>{spell.name}</span>
            {spell.ritual && <span style={{ fontSize: 9, background: 'var(--color-bg-subtle)', color: 'var(--color-primary)', padding: '1px 6px', borderRadius: 4, fontWeight: 800, textTransform: 'uppercase' }}>仪式</span>}
            {spell.concentration && <span style={{ fontSize: 9, background: 'rgba(255, 149, 0, 0.1)', color: '#f59e0b', padding: '1px 6px', borderRadius: 4, fontWeight: 800, textTransform: 'uppercase' }}>专注</span>}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginTop: 4, display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontWeight: 600, color: 'var(--color-primary-subtle)' }}>{schoolZh}</span>
            <span>•</span>
            <span>{spell.level === 0 ? '戏法' : `${spell.level}环法术`}</span>
            {source && (
              <>
                <span>•</span>
                <span style={{ opacity: 0.8 }}>来源: {source}</span>
              </>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right', display: 'none', md: 'block' } as any}>
            <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontWeight: 600 }}>射程 Range</div>
            <div style={{ fontSize: 12, fontWeight: 600 }}>{formatSpellRange(spell.range)}</div>
          </div>
          <div style={{ 
            width: 24, height: 24, borderRadius: '50%', background: isExpanded ? 'var(--color-primary)' : 'rgba(0,0,0,0.05)', 
            color: isExpanded ? '#fff' : '#86868b', display: 'flex', alignItems: 'center', justifyContent: 'center', 
            fontSize: 10, transition: 'all 0.2s' 
          }}>
            {isExpanded ? '▲' : '▼'}
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <div style={{ padding: '20px', borderTop: '1px solid var(--color-border-dark)', background: 'var(--color-bg-surface)' }}>
          {/* 属性徽章栏 */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20 }}>
            <div style={{ background: 'var(--color-bg-dark)', padding: '6px 12px', borderRadius: 10, border: '1px solid var(--color-border-dark)' }}>
              <div style={{ fontSize: 9, color: 'var(--color-text-secondary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2, fontFamily: 'var(--font-family-serif)' }}>施法时间 Time</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-gold-bright)' }}>{formatActionType(spell.castingTime)}</div>
            </div>
            <div style={{ background: 'var(--color-bg-dark)', padding: '6px 12px', borderRadius: 10, border: '1px solid var(--color-border-dark)' }}>
              <div style={{ fontSize: 9, color: 'var(--color-text-secondary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2, fontFamily: 'var(--font-family-serif)' }}>射程 / 区域 Range</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-gold-bright)' }}>{formatSpellRange(spell.range)}</div>
            </div>
            <div style={{ background: 'var(--color-bg-dark)', padding: '6px 12px', borderRadius: 10, border: '1px solid var(--color-border-dark)' }}>
              <div style={{ fontSize: 9, color: 'var(--color-text-secondary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2, fontFamily: 'var(--font-family-serif)' }}>持续时间 Duration</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-gold-bright)' }}>{formatSpellDuration(spell.duration)}</div>
            </div>
            {spell.components && (
              <div style={{ background: 'var(--color-bg-dark)', padding: '6px 12px', borderRadius: 10, border: '1px solid var(--color-border-dark)' }}>
                <div style={{ fontSize: 9, color: 'var(--color-text-secondary)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 2, fontFamily: 'var(--font-family-serif)' }}>成分 Components</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-gold-bright)' }}>{formatSpellComponent(spell.components)}</div>
              </div>
            )}
          </div>
          
          {/* 法术描述内容 */}
          <div style={{ fontSize: 14, lineHeight: 1.8, color: 'var(--color-text-secondary)', margin: 0 }}>
            <MarkdownText text={spell.description} variant="clean" />
          </div>
        </div>
      )}
    </div>
  );
};

// --- Main Component ---

interface SpellsTabProps {
  character: any;
  spellcasting: any;
  primaryClass: any;
  cantripDetails: any[];
  spellDetails: any[];
  spellbookDetails?: any[];
  spellSourceMap: Record<string, string>;
  spellSlotUsage: any;
  updateActiveCharacter: (data: any) => void;
  router: any;
  id: string;
}

const SpellsTab: React.FC<SpellsTabProps> = ({ 
  character, spellcasting, primaryClass, cantripDetails, spellDetails, 
  spellbookDetails = [], spellSourceMap, spellSlotUsage, updateActiveCharacter, router, id
}) => {
  const [viewMode, setViewMode] = useState<'prepared' | 'spellbook'>('prepared');
  const isWizard = primaryClass?.nameEn === 'Wizard';

  // 切换法术准备状态
  const togglePreparation = (spellId: string) => {
    const current = character.preparedSpellIds || [];
    const next = current.includes(spellId) 
      ? current.filter((id: string) => id !== spellId)
      : [...current, spellId];
    
    // 限制准备数量（可选提示，但不强制阻止，以防规则变动或特殊加成）
    updateActiveCharacter({ preparedSpellIds: next });
  };
  // 确保数值存在，避免 NaN
  const safeDC = spellcasting.spellDC || '--';
  const safeAttack = spellcasting.spellAttack !== undefined ? (spellcasting.spellAttack >= 0 ? `+${spellcasting.spellAttack}` : spellcasting.spellAttack) : '--';

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 24 }}>
      {/* 左侧：施法核心数据 */}
      <div style={{ gridColumn: 'span 4' }}>
        <div className={styles.card} style={{ position: 'sticky', top: 20 }}>
          <div className={styles.cardTitle} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>✨</span>
              <span>施法概览</span>
            </div>
            <PillButton size="sm" variant="outline" onClick={() => router.push(`/builder/spells?id=${id}`)}>配置法术</PillButton>
          </div>
          
          {/* 关键属性仪表盘 */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginBottom: 20 }}>
            <div style={{ background: 'linear-gradient(135deg, var(--color-primary) 0%, #0056b3 100%)', padding: '16px 12px', borderRadius: 16, textAlign: 'center', color: '#fff', boxShadow: '0 4px 12px var(--shadow-subtle)' }}>
              <div style={{ fontSize: 10, opacity: 0.9, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>法术救赎 DC</div>
              <div style={{ fontSize: 32, fontWeight: 800 }}>{safeDC}</div>
            </div>
            <div style={{ background: 'var(--color-bg-light)', padding: '16px 12px', borderRadius: 16, textAlign: 'center', border: '1px solid var(--color-border-subtle)' }}>
              <div style={{ fontSize: 10, color: 'var(--color-text-tertiary)', fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.05em' }}>法术攻击加值</div>
              <div style={{ fontSize: 32, fontWeight: 800, color: 'var(--color-primary)' }}>{safeAttack}</div>
            </div>
          </div>

          <div 
            onClick={() => updateActiveCharacter({ concentration: !character.concentration })}
            style={{ 
              background: character.concentration ? 'rgba(255, 149, 0, 0.08)' : 'var(--color-bg-light)', 
              padding: '14px 18px', borderRadius: 14, marginBottom: 24, cursor: 'pointer',
              border: `1px solid ${character.concentration ? '#ff9500' : 'transparent'}`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'all 0.2s'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 18 }}>{character.concentration ? '⏳' : '💤'}</span>
              <span style={{ fontSize: 14, fontWeight: 700, color: character.concentration ? '#ff9500' : 'var(--color-text-secondary)' }}>法术专注 Concentration</span>
            </div>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: character.concentration ? '#ff9500' : 'var(--color-border-dark)', boxShadow: character.concentration ? '0 0 8px #ff9500' : 'none' }} />
          </div>

          <div style={{ padding: '4px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 }}>
              <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 500 }}>施法关键属性</span>
              <strong style={{ color: 'var(--color-text-primary)' }}>{translateAbilityKey(spellcasting.spellcastingAbility || '')}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12, fontSize: 14 }}>
              <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 500 }}>已准备法术</span>
              <strong style={{ color: 'var(--color-text-primary)' }}>{character.preparedSpellIds.length} / {spellcasting.spellsPrepared}</strong>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 24, fontSize: 14 }}>
              <span style={{ color: 'var(--color-text-tertiary)', fontWeight: 500 }}>已知戏法</span>
              <strong style={{ color: 'var(--color-text-primary)' }}>{character.cantripIds.length} / {spellcasting.cantripsKnown}</strong>
            </div>
          </div>

          {/* 模式切换 (仅法师) */}
          {isWizard && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'rgba(0,0,0,0.04)', padding: 4, borderRadius: 12 }}>
                <button 
                  onClick={() => setViewMode('prepared')}
                  style={{ 
                    border: 'none', padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                    background: viewMode === 'prepared' ? '#fff' : 'transparent',
                    color: viewMode === 'prepared' ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
                    boxShadow: viewMode === 'prepared' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  已准备
                </button>
                <button 
                  onClick={() => setViewMode('spellbook')}
                  style={{ 
                    border: 'none', padding: '8px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                    background: viewMode === 'spellbook' ? '#fff' : 'transparent',
                    color: viewMode === 'spellbook' ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
                    boxShadow: viewMode === 'spellbook' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  法术书
                </button>
              </div>
            </div>
          )}

          <div style={{ marginTop: 8 }}>
            <h3 style={{ fontSize: 11, color: 'var(--color-text-tertiary)', marginBottom: 16, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 4, height: 4, borderRadius: '50%', background: 'var(--color-primary)' }} />
              法术位 Spell Slots
            </h3>
            {Object.entries(spellcasting.spellSlots).length > 0 ? (
              Object.entries(spellcasting.spellSlots).map(([level, count]) => (
                <SpellSlotTracker 
                  key={level} 
                  level={parseInt(level)} 
                  max={count} 
                  used={spellSlotUsage[parseInt(level)] || 0}
                  onUpdate={(lvl: number, val: number) => {
                    updateActiveCharacter({ 
                      spellSlotUsage: { ...spellSlotUsage, [lvl]: val } 
                    });
                  }}
                />
              ))
            ) : (
              <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontStyle: 'italic', padding: '10px 0' }}>该职业无每日法术位</div>
            )}
          </div>
        </div>
      </div>

      {/* 右侧：法术详情列表 */}
      <div style={{ gridColumn: 'span 8' }}>
        <div className={styles.card}>
          <div className={styles.cardTitle} style={{ borderBottom: '1px solid var(--color-border-subtle)', paddingBottom: 16, marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>{viewMode === 'spellbook' ? '📓' : '📜'}</span>
              <span>{viewMode === 'spellbook' ? '法术书 Spellbook' : '法术列表 Spell List'}</span>
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontWeight: 600 }}>
              {viewMode === 'spellbook' ? `${spellbookDetails.length} 道法术已记录` : `${cantripDetails.length + spellDetails.length} 道已就绪`}
            </div>
          </div>

          <div style={{ minHeight: '600px' }}>
            {viewMode === 'spellbook' ? (
               // 法术书模式
               <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                 {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(lvl => {
                    const levelSpells = spellbookDetails.filter(s => s.level === lvl);
                    if (levelSpells.length === 0) return null;
                    return (
                      <div key={lvl} style={{ marginBottom: 24 }}>
                        <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-text-tertiary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                          {lvl === 0 ? '戏法 Cantrips' : `${lvl} 环法术 Level ${lvl}`}
                        </div>
                        {levelSpells.map(spell => {
                          const isPrepared = character.preparedSpellIds?.includes(spell.id) || character.cantripIds?.includes(spell.id);
                          const canPrepare = spell.level > 0;
                          return (
                            <div key={spell.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', background: 'rgba(0,0,0,0.02)', borderRadius: 12, marginBottom: 8, border: isPrepared ? '1px solid var(--color-primary-subtle)' : '1px solid transparent' }}>
                              <div 
                                onClick={() => canPrepare && togglePreparation(spell.id)}
                                style={{ 
                                  width: 18, height: 18, borderRadius: 4, border: '2px solid var(--color-border-dark)', 
                                  background: isPrepared ? 'var(--color-primary)' : 'transparent',
                                  borderColor: isPrepared ? 'var(--color-primary)' : 'var(--color-border-dark)',
                                  cursor: canPrepare ? 'pointer' : 'default',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 12
                                }}
                              >
                                {isPrepared && '✓'}
                              </div>
                              <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 14, fontWeight: 700 }}>{spell.name}</div>
                                <div style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>{translateSpellSchool(spell.school)}</div>
                              </div>
                              <PillButton size="xs" variant="outline" onClick={() => {/* TODO: Show Details Modal */}}>详情</PillButton>
                            </div>
                          );
                        })}
                      </div>
                    );
                 })}
               </div>
            ) : (
               // 标准就绪列表模式
               <>
                 {cantripDetails.length > 0 && (
                   <div style={{ marginBottom: 32 }}>
                <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-primary)', marginBottom: 16, paddingLeft: 4, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 8 }}>
                  戏法 Cantrips
                  <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, rgba(0,113,227,0.1), transparent)' }} />
                </div>
                {cantripDetails.map((spell: any) => <DetailedSpellItem key={spell.id} spell={spell} source={spellSourceMap[spell.id]} />)}
              </div>
            )}
            
            {[1,2,3,4,5,6,7,8,9].map((level: number) => {
              const levelSpells = spellDetails.filter(s => s.level === level);
              if (levelSpells.length === 0) return null;
              return (
                <div key={level} style={{ marginBottom: 32 }}>
                  <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-primary)', marginBottom: 16, paddingLeft: 4, textTransform: 'uppercase', letterSpacing: '0.1em', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {level} 环法术 Level {level}
                    <div style={{ flex: 1, height: 1, background: 'linear-gradient(to right, rgba(0,113,227,0.1), transparent)' }} />
                  </div>
                  {levelSpells.map((spell: any) => <DetailedSpellItem key={spell.id} spell={spell} source={spellSourceMap[spell.id]} />)}
                </div>
              );
            })}
            </>
            )}

            {(cantripDetails.length === 0 && spellDetails.length === 0 && viewMode === 'prepared') && (
              <div style={{ textAlign: 'center', padding: '80px 20px' }}>
                <div style={{ fontSize: 48, marginBottom: 16, opacity: 0.5 }}>📖</div>
                <h3 style={{ fontSize: 18, color: 'var(--color-text-primary)', marginBottom: 8 }}>空空如也</h3>
                <p style={{ color: 'var(--color-text-tertiary)', fontSize: 14 }}>尚未在法术准备页配置任何法术</p>
                <div style={{ marginTop: 24 }}>
                  <PillButton onClick={() => router.push(`/builder/spells?id=${id}`)}>立即去配置</PillButton>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SpellsTab;
