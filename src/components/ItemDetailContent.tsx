import React from 'react';
import { Sword, Shield as ShieldIcon, Hammer, Sparkles, Box, Info, Book, Zap, Wrench, Scroll, Briefcase, GraduationCap } from 'lucide-react';
import MarkdownText from './MarkdownText';
import { PROPERTY_DATA } from '@/rules/equipment';

interface ItemDetailContentProps {
  item: any;
  category: string | undefined;
}

const ItemDetailContent: React.FC<ItemDetailContentProps> = ({ item, category }) => {
  if (!item) return <span style={{ fontStyle: 'italic', opacity: 0.5 }}>暂无详细描述</span>;

  const isWeapon = category === 'weapon';
  const isArmor = category && ['armor', 'shield', 'protection'].includes(category);
  const isTool = category === 'tool';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* 核心指标栏 (Stats Bar) - Premium Style */}
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: '12px 24px', 
        padding: '12px 16px', 
        background: 'var(--color-bg-surface-elevated)',
        borderRadius: '10px',
        fontSize: '0.85rem',
        border: '1px solid var(--color-border-dark)',
        boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.02)'
      }}>
        {isWeapon && (
          <>
            <div style={{ color: 'var(--color-text-primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sword size={16} className="text-blue-600" /> 
              <span>伤害: <span style={{ color: 'var(--color-apple-blue)' }}>{item.damage} {item.damageType}</span></span>
            </div>
            {item.mastery && (
              <div style={{ color: 'var(--color-accent-arcane)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={16} /> 
                <span>精通: {item.mastery.name}</span>
              </div>
            )}
          </>
        )}

        {isArmor && (
          <>
            <div style={{ color: 'var(--color-text-primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}>
              <ShieldIcon size={16} className="text-blue-600" /> 
              <span>AC: <span style={{ color: 'var(--color-apple-blue)' }}>{item.ac}</span></span>
            </div>
            {item.strengthRequirement && (
              <div style={{ color: 'var(--color-accent-blood)', fontWeight: 600 }}>力量要求: {item.strengthRequirement}</div>
            )}
            {item.stealthDisadvantage && (
              <div style={{ color: 'var(--color-accent-blood)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>
                <Zap size={14} /> 隐匿: 劣势
              </div>
            )}
          </>
        )}

        {isTool && item.toolAbility && (
          <div style={{ color: 'var(--color-text-primary)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: 6 }}>
            <GraduationCap size={16} style={{ color: 'var(--color-accent-arcane)' }} />
            <span>相关属性: <span style={{ color: 'var(--color-accent-arcane)' }}>{item.toolAbility}</span></span>
          </div>
        )}

        <div style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <Box size={14} /> 重量: {item.weight || '---'}
        </div>
        <div style={{ color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontWeight: 'bold', color: 'var(--color-success)' }}>价格: {item.cost || '---'}</span>
        </div>
      </div>

      {/* 详细描述文本 */}
      <div style={{ padding: '0 4px' }}>
        <div style={{ 
          fontSize: '0.95rem', 
          lineHeight: 1.7, 
          color: 'var(--color-text-secondary)',
          background: isTool ? 'var(--color-bg-surface-elevated)' : 'transparent',
          padding: isTool ? '12px' : '0',
          borderRadius: '8px',
          borderLeft: isTool ? '3px solid var(--color-accent-arcane)' : 'none'
        }}>
          <MarkdownText text={item.description || item.notes || '暂无详细描述'} />
        </div>
      </div>

      {/* 工具专属高级展示区 (Tool Details) */}
      {isTool && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 4 }}>
          
          {/* 组件构成 */}
          {item.components && (
            <div style={{ padding: '12px', background: 'var(--color-bg-surface-elevated)', borderRadius: '10px', border: '1px solid var(--color-border-dark)' }}>
              <div style={{ fontWeight: 'bold', color: 'var(--color-accent-arcane)', fontSize: '0.85rem', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Briefcase size={14} /> 工具构成 (Components)
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                {item.components}
              </div>
            </div>
          )}

          {/* 技能协同 (Synergies) */}
          {item.synergies && item.synergies.length > 0 && (
            <div>
              <div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', fontSize: '0.85rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Zap size={14} className="text-amber-500" /> 技能协同 (Synergies)
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
                {item.synergies.map((s: any, idx: number) => (
                  <div key={idx} style={{ padding: '8px 12px', background: 'var(--color-bg-surface-elevated)', borderRadius: '8px', border: '1px solid var(--color-border-dark)' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--color-warning)', fontSize: '0.8rem' }}>{s.skill}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>{s.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 特殊用途 (Special Uses) */}
          {item.specialUses && item.specialUses.length > 0 && (
            <div>
              <div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', fontSize: '0.85rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Sparkles size={14} style={{ color: 'var(--color-accent-arcane)' }} /> 特殊用途 (Special Uses)
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {item.specialUses.map((s: any, idx: number) => (
                  <div key={idx} style={{ padding: '10px 14px', background: 'var(--color-bg-surface-elevated)', borderRadius: '10px', border: '1px solid var(--color-border-dark)' }}>
                    <div style={{ fontWeight: 'bold', color: 'var(--color-accent-arcane)', fontSize: '0.85rem' }}>{s.name}</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', marginTop: 4, lineHeight: 1.5 }}>{s.description}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 操作 (Utilize) */}
          {item.toolUtilize && item.toolUtilize.length > 0 && (
            <div>
              <div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', fontSize: '0.85rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Wrench size={14} style={{ color: 'var(--color-apple-blue)' }} /> 具体操作 (Utilize)
              </div>
              <div style={{ border: '1px solid var(--color-border-dark)', borderRadius: '10px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ background: 'var(--color-bg-surface-elevated)', borderBottom: '1px solid var(--color-border-dark)' }}>
                      <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--color-text-secondary)' }}>动作</th>
                      <th style={{ textAlign: 'center', padding: '8px 12px', color: 'var(--color-text-secondary)', width: 60 }}>DC</th>
                      <th style={{ textAlign: 'left', padding: '8px 12px', color: 'var(--color-text-secondary)' }}>描述</th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.toolUtilize.map((u: any, idx: number) => (
                      <tr key={idx} style={{ borderBottom: idx === item.toolUtilize.length - 1 ? 'none' : '1px solid var(--color-border-dark)' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 'bold', color: 'var(--color-apple-blue)' }}>{u.action}</td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ background: 'var(--color-bg-surface-elevated)', color: 'var(--color-apple-blue)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>{u.dc}</span>
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)' }}>{u.description}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 制造 (Craft) */}
          {item.toolCraft && item.toolCraft.length > 0 && (
            <div style={{ padding: '12px', background: 'var(--color-bg-surface-elevated)', borderRadius: '10px', border: '1px solid var(--color-border-dark)' }}>
              <div style={{ fontWeight: 'bold', color: 'var(--color-success)', fontSize: '0.85rem', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                <Hammer size={14} /> 可制造物品 (Crafting)
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {item.toolCraft.map((c: string) => (
                  <span key={c} style={{ fontSize: '0.8rem', padding: '4px 10px', background: 'var(--color-bg-dark)', color: 'var(--color-success)', borderRadius: '6px', border: '1px solid var(--color-border-dark)', boxShadow: 'var(--shadow-subtle)' }}>
                    {c}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 武器/护甲常规说明区 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* 武器精通详细说明 */}
        {isWeapon && item.mastery && (
          <div style={{ padding: '12px', background: 'var(--color-bg-surface-elevated)', borderRadius: '10px', border: '1px solid var(--color-border-dark)' }}>
            <div style={{ fontWeight: 'bold', color: 'var(--color-accent-arcane)', fontSize: '0.85rem', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
              <Sparkles size={14} /> 精通效果: {item.mastery.name}
            </div>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
              {item.mastery.description}
            </div>
          </div>
        )}

        {/* 武器词条详细说明 */}
        {isWeapon && item.properties && item.properties.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {item.properties.map((p: string) => {
              const baseCode = p.split(' ')[0].split('(')[0];
              const prop = PROPERTY_DATA[baseCode];
              if (!prop) return null;
              return (
                <div key={p} style={{ padding: '12px', background: 'var(--color-bg-surface-elevated)', borderRadius: '10px', border: '1px solid var(--color-border-dark)' }}>
                  <div style={{ fontWeight: 'bold', color: 'var(--color-text-primary)', fontSize: '0.85rem', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Info size={14} className="text-slate-400" /> {prop.name} {p.includes('(') ? `(${p.split('(')[1]}` : ''}
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                    {prop.description}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ItemDetailContent;
