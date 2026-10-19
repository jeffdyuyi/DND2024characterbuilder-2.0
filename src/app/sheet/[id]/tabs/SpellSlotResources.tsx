import React from 'react';
import PillButton from '@/components/PillButton';
import { getSpellSlotResources } from '@/engine/spellSlotUsage';
import type { SpellcastingStats } from '@/engine/spellcasting';
import type { CharacterState } from '@/types/characterState';

const SpellSlotTracker = ({ level, max, used, onUpdate }: any) => {
  const remaining = Math.max(0, max - used);
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 14px',
        background: 'rgba(0,0,0,0.02)',
        borderRadius: 12,
        marginBottom: 10,
        border: '1px solid rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--color-text-primary)' }}>
        {level === 0 ? '戏法' : `${level} 环`}
      </div>
      <div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end' }}>
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
                  boxShadow: i < remaining ? '0 0 8px rgba(0, 113, 227, 0.3)' : 'none',
                }}
              />
            ))}
          </div>
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              marginLeft: 8,
              color: 'var(--color-text-tertiary)',
              minWidth: 35,
              textAlign: 'right',
            }}
          >
            {remaining} / {max}
          </span>
        </div>
        {max > 0 && (
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 6 }}>
            <PillButton
              size="xs"
              disabled={remaining <= 0}
              onClick={() => onUpdate(level, used + 1)}
            >
              消耗一枚
            </PillButton>
            <PillButton
              size="xs"
              variant="outline"
              disabled={used <= 0}
              onClick={() => onUpdate(level, used - 1)}
            >
              恢复一枚
            </PillButton>
          </div>
        )}
      </div>
    </div>
  );
};

export default function SpellSlotResources({
  character,
  spellcasting,
  spellSlotUsage,
  onChange,
}: {
  character: CharacterState;
  spellcasting: SpellcastingStats;
  spellSlotUsage: Record<number, number>;
  onChange: (patch: Partial<CharacterState>) => void;
}) {
  const resources = getSpellSlotResources({ ...character, spellSlotUsage }, spellcasting);
  const renderPool = (pool: 'standard' | 'pact', slots: Record<number, number>) =>
    Object.entries(slots)
      .filter(([, max]) => max > 0)
      .map(([key, max]) => {
        const level = Number(key);
        return (
          <SpellSlotTracker
            key={key}
            level={level}
            max={max}
            used={resources.usage[pool][level] || 0}
            onUpdate={(lvl: number, used: number) =>
              onChange(
                resources.separate
                  ? {
                      spellSlotUsageByPool: {
                        ...resources.usage,
                        [pool]: { ...resources.usage[pool], [lvl]: used },
                      },
                    }
                  : { spellSlotUsage: { ...spellSlotUsage, [lvl]: used } },
              )
            }
          />
        );
      });

  if (resources.legacy)
    return (
      <>
        <p style={{ fontSize: 12 }}>
          旧法术位消耗未区分通常施法与契约魔法，暂按合并记录显示。两类法术位均已恢复后，可确认启用分别记录；旧记录仍保留在存档中。
        </p>
        {Object.entries(spellcasting.spellSlots)
          .filter(([, max]) => max > 0)
          .map(([key, max]) => (
            <SpellSlotTracker
              key={key}
              level={Number(key)}
              max={max}
              used={spellSlotUsage[Number(key)] || 0}
              onUpdate={(lvl: number, used: number) =>
                onChange({ spellSlotUsage: { ...spellSlotUsage, [lvl]: used } })
              }
            />
          ))}
        <PillButton
          size="sm"
          variant="outline"
          onClick={() => onChange({ spellSlotUsageByPool: { standard: {}, pact: {} } })}
        >
          确认两类法术位已恢复，分别记录
        </PillButton>
      </>
    );

  const hasStandard = Object.values(resources.standard).some((max) => max > 0);
  const hasPact = Object.values(resources.pact).some((max) => max > 0);
  return (
    <>
      {hasStandard && (
        <>
          <h4 style={{ fontSize: 12 }}>通常法术位</h4>
          {renderPool('standard', resources.standard)}
        </>
      )}
      {hasPact && (
        <>
          <h4 style={{ fontSize: 12 }}>契约魔法法术位（短休或长休恢复）</h4>
          {renderPool('pact', resources.pact)}
        </>
      )}
      {!hasStandard && !hasPact && <div style={{ fontSize: 12 }}>该职业无每日法术位</div>}
    </>
  );
}
