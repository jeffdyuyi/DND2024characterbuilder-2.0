'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCharacterStore } from '@/store/characterStore';
import { computeAbilityScores } from '@/engine/ability';
import {
  getClassDefinition,
  getSpeciesDefinition,
  getBackgroundDefinition,
  getFeatDefinition,
} from '@/engine/characterData';
import { getCatalogFeats } from '@/catalog';
import {
  SKILL_ABILITY_MAP,
  translateSkill,
  normalizeSkillId,
  ABILITY_LABEL_MAP,
  normalizeAbilityKey,
} from '@/engine/terminology';
import { AbilityScores } from '@/types/characterState';
import OptionCard from '@/components/OptionCard';
import PillButton from '@/components/PillButton';
import styles from './abilities.module.css';

type Mode = 'standard' | 'pointbuy' | 'roll' | 'manual';

const ABILITIES = [
  { id: 'str', label: '力量', abbr: 'STR' },
  { id: 'dex', label: '敏捷', abbr: 'DEX' },
  { id: 'con', label: '体质', abbr: 'CON' },
  { id: 'int', label: '智力', abbr: 'INT' },
  { id: 'wis', label: '感知', abbr: 'WIS' },
  { id: 'cha', label: '魅力', abbr: 'CHA' },
] as const;

const POINT_BUY_COSTS: Record<number, number> = {
  8: 0,
  9: 1,
  10: 2,
  11: 3,
  12: 4,
  13: 5,
  14: 7,
  15: 9,
};

const STANDARD_ARRAY = [15, 14, 13, 12, 10, 8];

const CLASS_PRESETS: Record<string, AbilityScores> = {
  Barbarian: { str: 15, dex: 13, con: 14, int: 10, wis: 12, cha: 8 },
  Bard: { str: 8, dex: 14, con: 12, int: 13, wis: 10, cha: 15 },
  Cleric: { str: 14, dex: 8, con: 13, int: 10, wis: 15, cha: 12 },
  Druid: { str: 8, dex: 12, con: 14, int: 13, wis: 15, cha: 10 },
  Fighter: { str: 15, dex: 14, con: 13, int: 8, wis: 10, cha: 12 },
  Monk: { str: 12, dex: 15, con: 13, int: 10, wis: 14, cha: 8 },
  Paladin: { str: 15, dex: 10, con: 13, int: 8, wis: 12, cha: 14 },
  Ranger: { str: 12, dex: 15, con: 13, int: 8, wis: 14, cha: 10 },
  Rogue: { str: 12, dex: 15, con: 13, int: 14, wis: 10, cha: 8 },
  Sorcerer: { str: 10, dex: 13, con: 14, int: 8, wis: 12, cha: 15 },
  Warlock: { str: 8, dex: 14, con: 13, int: 12, wis: 10, cha: 15 },
  Wizard: { str: 8, dex: 12, con: 13, int: 15, wis: 14, cha: 10 },
};

export default function AbilitiesPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { characters, updateActiveCharacter, loadCharacter } = useCharacterStore();
  const character = id ? characters[id] : null;

  const [mode, setMode] = useState<Mode>('pointbuy');
  const [rolledScores, setRolledScores] = useState<number[]>([]);
  const [assignments, setAssignments] = useState<Partial<AbilityScores>>({
    str: undefined,
    dex: undefined,
    con: undefined,
    int: undefined,
    wis: undefined,
    cha: undefined,
  });

  useEffect(() => {
    if (id) {
      loadCharacter(id);
    }
  }, [id, loadCharacter]);

  if (!character) return <div className="page-container">加载中...</div>;

  const { scores, modifiers, breakdown, caps } = computeAbilityScores(character);
  const baseScores = character.baseAbilityScores || {
    str: 8,
    dex: 8,
    con: 8,
    int: 8,
    wis: 8,
    cha: 8,
  };

  // Roll 4d6 drop lowest
  const rollAbilities = () => {
    const results = [];
    for (let i = 0; i < 6; i++) {
      const dice = [0, 0, 0, 0].map(() => Math.floor(Math.random() * 6) + 1);
      dice.sort((a, b) => b - a);
      results.push(dice[0] + dice[1] + dice[2]);
    }
    setRolledScores(results);
    setAssignments({
      str: undefined,
      dex: undefined,
      con: undefined,
      int: undefined,
      wis: undefined,
      cha: undefined,
    });
  };

  const handleAssign = (ability: string, value: number) => {
    const newAssignments = { ...assignments, [ability]: value };
    setAssignments(newAssignments);

    // Sync to store
    const newBase: any = { ...baseScores };
    Object.entries(newAssignments).forEach(([key, val]) => {
      if (val !== undefined) newBase[key] = val;
    });
    updateActiveCharacter({ baseAbilityScores: newBase });
  };

  const unassign = (ability: string) => {
    const newAssignments = { ...assignments, [ability]: undefined };
    setAssignments(newAssignments);
  };

  const calculatePointsUsed = () => {
    return Object.values(baseScores).reduce((total, score) => {
      return total + (POINT_BUY_COSTS[score] || 0);
    }, 0);
  };
  const pointsUsed = calculatePointsUsed();
  const maxPoints = 27;

  const { hpValue, hitDie, conBonus, extraHP } = React.useMemo(() => {
    const classDef = getClassDefinition(character.classes[0]?.classId);
    const hitDie = classDef?.hitPointDie || 8;
    const conBonus = modifiers.con;

    let extraHP = 0;
    character.classSelections &&
      Object.values(character.classSelections).forEach((selection: any) => {
        selection.forEach((optId: string) => {
          const feat =
            getFeatDefinition(optId) ||
            getCatalogFeats().find((f) => f.id === optId || f.nameEn === optId);
          if (feat?.nameEn === 'Tough' || feat?.name === '健壮') {
            extraHP += 2;
          }
        });
      });

    return { hpValue: hitDie + conBonus + extraHP, hitDie, conBonus, extraHP };
  }, [character, modifiers.con]);

  const updateBaseScore = (ability: keyof typeof baseScores, newScore: number) => {
    updateActiveCharacter({
      baseAbilityScores: { ...baseScores, [ability]: newScore },
    });
  };

  const handlePointBuyChange = (ability: keyof typeof baseScores, delta: number) => {
    const currentScore = baseScores[ability];
    const newScore = currentScore + delta;
    if (newScore < 8 || newScore > 15) return;

    const currentCost = POINT_BUY_COSTS[currentScore];
    const newCost = POINT_BUY_COSTS[newScore];
    const pointDelta = newCost - currentCost;

    if (pointsUsed + pointDelta > maxPoints) return;
    updateBaseScore(ability, newScore);
  };

  const handleManualChange = (ability: keyof typeof baseScores, val: string) => {
    const num = parseInt(val, 10);
    if (isNaN(num)) return;
    updateBaseScore(ability, Math.max(1, Math.min(30, num)));
  };

  const resetToStandard = (classId?: string) => {
    const preset = classId
      ? CLASS_PRESETS[classId]
      : { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 };
    setAssignments(preset);
    updateActiveCharacter({ baseAbilityScores: preset });
  };

  const primaryClass = character.classes[0]?.classId;
  const hasRecommendation = primaryClass && CLASS_PRESETS[primaryClass];

  // Aggregate all proficiencies (Skills & Saves)
  const proficiencies = React.useMemo(() => {
    const profs = {
      skills: [] as string[],
      saves: [] as string[],
    };

    // 1. Species
    const speciesDef = getSpeciesDefinition(character);
    if (speciesDef?.traits) {
      speciesDef.traits.forEach((trait) => {
        if (trait.features?.skillProficiencies) {
          trait.features.skillProficiencies.forEach((p) => {
            if (typeof p === 'string') profs.skills.push(normalizeSkillId(p));
          });
        }
      });
    }
    Object.entries(character.speciesSelections || {}).forEach(([traitId, values]) => {
      if (traitId.toLowerCase().includes('skill') && Array.isArray(values)) {
        values.forEach((v) => profs.skills.push(normalizeSkillId(v)));
      }
    });

    // 2. Background
    const bgDef = getBackgroundDefinition(character);
    if (bgDef?.skillProficiencies) {
      bgDef.skillProficiencies.forEach((p) => {
        if (typeof p === 'string') profs.skills.push(normalizeSkillId(p));
      });
    }
    Object.entries(character.backgroundSelections || {}).forEach(([traitId, values]) => {
      if (traitId.toLowerCase().includes('skill') && Array.isArray(values)) {
        values.forEach((v) => profs.skills.push(normalizeSkillId(v)));
      }
    });

    // 3. Class (Level 1)
    const classDef = getClassDefinition(primaryClass);
    if (classDef?.proficiencies) {
      // Saving Throws
      if (classDef.proficiencies.savingThrows) {
        classDef.proficiencies.savingThrows.forEach((s: string) => {
          const norm = normalizeAbilityKey(s);
          if (norm) profs.saves.push(norm);
        });
      }
      // Fixed skills in options (if any are pre-selected or just available)
      if (classDef.proficiencies.skills?.options) {
        // Here we typically only add what's pre-defined or chosen.
        // For simple display, we rely on character.classSelections for choices.
      }
    }
    // Chosen skills
    Object.entries(character.classSelections || {}).forEach(([choiceId, values]) => {
      if (choiceId.toLowerCase().includes('skill') && Array.isArray(values)) {
        values.forEach((v) => profs.skills.push(normalizeSkillId(v)));
      }
    });

    return profs;
  }, [character, primaryClass]);

  const proficiencyBonus = 2; // Level 1 constant

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>分配属性 Ability Scores</h2>
      <p className={styles.subtitle}>
        选择生成方式并分配数值。我们将自动计算来自种族、背景和专长的所有加值。
      </p>

      {/* Mode Selector */}
      <div className={styles.modeSelector}>
        {(['pointbuy', 'standard', 'roll', 'manual'] as Mode[]).map((m) => (
          <PillButton
            key={m}
            variant={mode === m ? 'primary' : 'outline'}
            onClick={() => {
              setMode(m);
              if (m === 'standard') resetToStandard();
              if (m === 'roll') rollAbilities();
            }}
          >
            {m === 'pointbuy'
              ? '点数购买 (27点)'
              : m === 'standard'
                ? '标准阵列'
                : m === 'roll'
                  ? '掷骰生成 (4d6)'
                  : '自由输入'}
          </PillButton>
        ))}
      </div>

      <div className={styles.content}>
        <div className={styles.mainPanel}>
          {/* Header Area for Modes */}
          {mode === 'pointbuy' && (
            <div className={styles.pointBuyHeader}>
              <span className={styles.pointsLabel}>剩余可用购买点数:</span>
              <span
                className={`${styles.pointsValue} ${pointsUsed > maxPoints ? styles.pointsError : ''}`}
              >
                {maxPoints - pointsUsed}
              </span>
            </div>
          )}

          {(mode === 'standard' || mode === 'roll') && (
            <div
              className={styles.standardArrayHeader}
              style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span style={{ fontWeight: 600 }}>
                    {mode === 'standard' ? '标准阵列数值:' : '掷骰结果:'}
                  </span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    {(mode === 'standard' ? STANDARD_ARRAY : rolledScores).map((val, idx) => {
                      const isUsed = Object.values(assignments).includes(val);
                      return (
                        <div
                          key={idx}
                          className={styles.arrayPill}
                          style={{ opacity: isUsed ? 0.4 : 1, cursor: 'default' }}
                        >
                          {val}
                        </div>
                      );
                    })}
                  </div>
                </div>
                {mode === 'roll' && (
                  <PillButton size="sm" onClick={rollAbilities} variant="outline">
                    重新投掷 Roll Again
                  </PillButton>
                )}
                {mode === 'standard' && hasRecommendation && (
                  <PillButton
                    size="sm"
                    variant="primary"
                    onClick={() => resetToStandard(primaryClass)}
                    style={{ background: '#0071e3' }}
                  >
                    应用 {primaryClass} 推荐方案
                  </PillButton>
                )}
              </div>
              <p style={{ fontSize: '12px', color: '#86868b' }}>
                * 请在下方属性卡片中点击下拉菜单分配这些数值。
              </p>
            </div>
          )}

          <div className={styles.verticalAbilitiesList}>
            {ABILITIES.map(({ id, label, abbr }) => {
              const base = baseScores[id as keyof typeof baseScores];
              const final = scores[id as keyof typeof scores];
              const mod = modifiers[id as keyof typeof modifiers];
              const b = breakdown;

              const isSaveProficient = proficiencies.saves.includes(id);
              const relatedSkills = Object.entries(SKILL_ABILITY_MAP)
                .filter(([_, attr]) => attr === id)
                .map(([skillId]) => skillId);

              return (
                <div key={id} className={styles.premiumAbilityCard}>
                  {/* Column 1: Identity & Control */}
                  <div className={styles.attrSection}>
                    <div className={styles.attrHeader}>
                      <span className={styles.attrAbbr}>{abbr}</span>
                      <span className={styles.attrLabel}>{label}</span>
                    </div>
                    <div className={styles.controlWrapper}>
                      {mode === 'pointbuy' && (
                        <div className={styles.stepperModern}>
                          <button
                            onClick={() => handlePointBuyChange(id as any, -1)}
                            disabled={base <= 8}
                          >
                            −
                          </button>
                          <span className={styles.baseVal}>{base}</span>
                          <button
                            onClick={() => handlePointBuyChange(id as any, 1)}
                            disabled={
                              base >= 15 ||
                              pointsUsed + (POINT_BUY_COSTS[base + 1] - POINT_BUY_COSTS[base]) >
                                maxPoints
                            }
                          >
                            +
                          </button>
                        </div>
                      )}
                      {(mode === 'standard' || mode === 'roll') && (
                        <select
                          className={styles.modernSelect}
                          value={assignments[id] || ''}
                          onChange={(e) => handleAssign(id, parseInt(e.target.value))}
                        >
                          <option value="">- 分配 -</option>
                          {(mode === 'standard' ? STANDARD_ARRAY : rolledScores).map((val, idx) => (
                            <option
                              key={idx}
                              value={val}
                              disabled={Object.entries(assignments).some(
                                ([a, v]) => a !== id && v === val,
                              )}
                            >
                              {val}
                            </option>
                          ))}
                        </select>
                      )}
                      {mode === 'manual' && (
                        <input
                          type="number"
                          className={styles.modernInput}
                          value={base}
                          onChange={(e) => handleManualChange(id as any, e.target.value)}
                        />
                      )}
                    </div>
                  </div>

                  {/* Column 2: The Core Result (The Modifier) */}
                  <div className={styles.resultSection}>
                    <div className={styles.modLabel}>调整值</div>
                    <div className={`${styles.modDisplay} ${mod < 0 ? styles.modNegative : ''}`}>
                      <span className={styles.modSign}>{mod >= 0 ? '+' : '-'}</span>
                      <span className={styles.modValue}>{Math.abs(mod)}</span>
                    </div>
                    <div
                      className={styles.scoreBadge}
                      style={{
                        background:
                          final > caps[id as keyof AbilityScores]
                            ? 'rgba(239, 68, 68, 0.15)'
                            : 'var(--color-bg-dark)',
                        border:
                          final > caps[id as keyof AbilityScores]
                            ? '1px solid var(--color-danger)'
                            : '1px solid var(--color-border-dark)',
                      }}
                    >
                      <span className={styles.scoreLabel}>属性值</span>
                      <span
                        className={styles.scoreValue}
                        style={{
                          color:
                            final > caps[id as keyof AbilityScores]
                              ? 'var(--color-danger)'
                              : 'var(--color-gold-bright)',
                        }}
                      >
                        {final}
                        {final > caps[id as keyof AbilityScores] && (
                          <span
                            style={{ fontSize: '10px', marginLeft: '4px', fontWeight: 600 }}
                            title={`规则上限: ${caps[id as keyof AbilityScores]}`}
                          >
                            ⚠️
                          </span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Column 3: Source Breakdown */}
                  <div className={styles.sourceSection}>
                    <div className={styles.sourceList}>
                      <div className={styles.sourceRow}>
                        <span>基础 Base</span> <span>{base}</span>
                      </div>
                      {b.background[id as keyof AbilityScores] !== 0 && (
                        <div
                          className={styles.sourceRow}
                          style={{ color: 'var(--color-gold-bright)' }}
                        >
                          <span>背景 BG</span>{' '}
                          <span>+{b.background[id as keyof AbilityScores]}</span>
                        </div>
                      )}
                      {b.species[id as keyof AbilityScores] !== 0 && (
                        <div
                          className={styles.sourceRow}
                          style={{ color: 'var(--color-gold-bright)' }}
                        >
                          <span>种族 SP</span> <span>+{b.species[id as keyof AbilityScores]}</span>
                        </div>
                      )}
                      {b.feats[id as keyof AbilityScores] !== 0 && (
                        <div
                          className={styles.sourceRow}
                          style={{ color: 'var(--color-gold-bright)' }}
                        >
                          <span>专长 FT</span> <span>+{b.feats[id as keyof AbilityScores]}</span>
                        </div>
                      )}
                      {(b as any).class?.[id as keyof AbilityScores] !== 0 && (
                        <div
                          className={styles.sourceRow}
                          style={{ color: 'var(--color-gold-bright)' }}
                        >
                          <span>职业 CL</span>{' '}
                          <span>+{(b as any).class[id as keyof AbilityScores]}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Column 4: Skills & Saves (The Practical Output) */}
                  <div className={styles.skillsSection}>
                    {/* Saving Throw */}
                    <div
                      className={`${styles.skillPill} ${isSaveProficient ? styles.skillPillActive : ''}`}
                    >
                      <div className={styles.skillPillInfo}>
                        <span className={styles.skillName}>豁免 Save</span>
                        <span className={styles.skillCalc}>
                          {mod >= 0 ? `+${mod}` : mod}
                          {isSaveProficient ? `+${proficiencyBonus}` : ''}
                        </span>
                      </div>
                      <div className={styles.skillResult}>
                        {mod + (isSaveProficient ? proficiencyBonus : 0) >= 0 ? '+' : ''}
                        {mod + (isSaveProficient ? proficiencyBonus : 0)}
                      </div>
                    </div>

                    {/* Associated Skills */}
                    {relatedSkills.map((skillId) => {
                      const isSkillProficient = proficiencies.skills.includes(skillId);
                      const total = mod + (isSkillProficient ? proficiencyBonus : 0);
                      return (
                        <div
                          key={skillId}
                          className={`${styles.skillPill} ${isSkillProficient ? styles.skillPillActive : ''}`}
                        >
                          <div className={styles.skillPillInfo}>
                            <span className={styles.skillName}>{translateSkill(skillId)}</span>
                            <span className={styles.skillCalc}>
                              {mod >= 0 ? `+${mod}` : mod}
                              {isSkillProficient ? `+${proficiencyBonus}` : ''}
                            </span>
                          </div>
                          <div className={styles.skillResult}>
                            {total >= 0 ? '+' : ''}
                            {total}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div
            style={{
              marginTop: '24px',
              padding: '20px',
              background: 'var(--color-bg-dark)',
              borderRadius: '16px',
              border: '1px solid var(--color-border-dark)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div
                style={{
                  fontSize: '14px',
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  fontFamily: 'var(--font-family-serif)',
                  marginBottom: '4px',
                }}
              >
                角色生命值 Hit Points (Level 1)
              </div>
              <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                生命骰({hitDie}) + 体质调整值({conBonus >= 0 ? `+${conBonus}` : conBonus})
                {extraHP > 0 && ` + 额外加成(+${extraHP})`}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '32px', fontWeight: 800, color: '#ff3b30', lineHeight: 1 }}>
                {hpValue}
              </div>
              <div
                style={{ fontSize: '12px', color: '#ff3b30', fontWeight: 600, marginTop: '4px' }}
              >
                MAX HP
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
