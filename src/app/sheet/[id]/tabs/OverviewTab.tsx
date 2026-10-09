import React from 'react';
import styles from '../../sheet.module.css';
import PillButton from '@/components/PillButton';
import {
  translateAbilityKey,
  ALL_SKILLS,
  translateSkill,
  translateProficiency,
  translateSense,
} from '@/engine/terminology';
import { useCharacterStore } from '@/store/characterStore';
import { CharacterSheetView } from '@/engine/viewAdapter';
import { ALL_CONDITIONS } from '@/rules/conditions';
import {
  getAttunementStatus,
  getClassDefinition,
  findItemById,
  resolveInventoryItem,
} from '@/engine/characterData';

interface OverviewTabProps {
  character: any;
  species: any;
  background: any;
  primaryClass: any;
  subclass: any;
  totalLevel: number;
  pb: number;
  sheetView: CharacterSheetView;
  updateActiveCharacter: (data: any) => void;
  router: any;
  id: string;
  setActiveTab: (index: number) => void;
  isEditMode: boolean;
}

const OverviewTab: React.FC<OverviewTabProps> = ({
  character,
  species,
  background,
  primaryClass,
  subclass,
  totalLevel,
  pb,
  sheetView,
  updateActiveCharacter,
  router,
  id,
  setActiveTab,
  isEditMode,
}) => {
  const { updateManualOverrides } = useCharacterStore();
  const { final, flags, computed } = sheetView;
  const { ability, combat, proficiencies } = computed;

  const equippedArmor = resolveInventoryItem(character, character.equippedArmorId);
  const hasStealthDisadvantage = (equippedArmor as any)?.stealthDisadvantage || false;
  const attunement = getAttunementStatus(character);
  const attunedItems = (character.attunedItemIds || [])
    .map((attunedId: string) => {
      const entry = character.inventoryEntries?.find(
        (candidate: any) => candidate.id === attunedId || candidate.itemId === attunedId,
      );
      return findItemById(entry?.itemId || attunedId) as any;
    })
    .filter((item: any) => item?.requiresAttunement);

  const [isEditingXP, setIsEditingXP] = React.useState(false);
  const [tempXP, setTempXP] = React.useState(character.xp || 0);
  const [hpChange, setHpChange] = React.useState<string>('');

  const { maxHp, currentHp, tempHp, initiative, speed, proficiencyBonus, passivePerception } =
    final;

  // --- Step 1.3: Hit Dice Multiclass Breakdown Logic ---
  const hitDicePools: Record<string, number> = {};
  character.classes?.forEach((c: any) => {
    const classDef = getClassDefinition(c.classId);
    const die = `d${classDef?.hitPointDie || 8}`;
    hitDicePools[die] = (hitDicePools[die] || 0) + c.level;
  });

  const handleUpdateHitDice = (dieKey: string, delta: number) => {
    const currentMap = character.hitDiceUsedMap || {};
    const total = hitDicePools[dieKey] || 0;
    const currentUsed = currentMap[dieKey] || 0;
    const nextUsed = Math.max(0, Math.min(total, currentUsed + delta));

    updateActiveCharacter({
      hitDiceUsedMap: { ...currentMap, [dieKey]: nextUsed },
    });
  };

  const skillToAbility: Record<string, string> = {
    arcana: 'int',
    history: 'int',
    investigation: 'int',
    nature: 'int',
    religion: 'int',
    athletics: 'str',
    acrobatics: 'dex',
    sleightOfHand: 'dex',
    stealth: 'dex',
    insight: 'wis',
    animalHandling: 'wis',
    medicine: 'wis',
    perception: 'wis',
    survival: 'wis',
    deception: 'cha',
    intimidation: 'cha',
    performance: 'cha',
    persuasion: 'cha',
  };

  const handleHpChange = (isHeal: boolean) => {
    const val = parseInt(hpChange);
    if (isNaN(val)) return;
    if (isHeal) {
      updateActiveCharacter({ currentHp: Math.min(maxHp, currentHp + val) });
    } else {
      let remainingDamage = val;
      let nextTemp = tempHp;
      let nextCurrent = currentHp;
      if (nextTemp > 0) {
        const absorb = Math.min(nextTemp, remainingDamage);
        nextTemp -= absorb;
        remainingDamage -= absorb;
      }
      if (remainingDamage > 0) nextCurrent = Math.max(0, nextCurrent - remainingDamage);
      updateActiveCharacter({ currentHp: nextCurrent, tempHp: nextTemp });
    }
    setHpChange('');
  };

  const [showHPSettings, setShowHPSettings] = React.useState(false);
  const [showConditionSelector, setShowConditionSelector] = React.useState(false);
  const [viewingCondition, setViewingCondition] = React.useState<any>(null);
  const [editingField, setEditingField] = React.useState<string | null>(null);
  const [tempValue, setTempValue] = React.useState<string>('');

  // HP Rolling State
  const [rollTargetLevel, setRollTargetLevel] = React.useState<number | null>(null);
  const [rollConfirmStep, setRollConfirmStep] = React.useState(0);

  const toggleCondition = (condId: string) => {
    const current = character.conditions || [];
    const next = current.includes(condId)
      ? current.filter((c: string) => c !== condId)
      : [...current, condId];
    updateActiveCharacter({ conditions: next });
  };

  const handleEditClick = (field: string, currentVal: any) => {
    if (!isEditMode) return;
    setEditingField(field);
    setTempValue(String(currentVal));
  };

  const handleSaveValue = () => {
    const val = parseInt(tempValue) || 0;
    if (editingField === 'ac') {
      updateManualOverrides({ ac: val });
    } else if (editingField === 'initiative') {
      updateManualOverrides({ initiative: val });
    } else if (editingField === 'speed') {
      updateManualOverrides({ speed: val });
    }
    setEditingField(null);
  };

  const handleRollHP = (level: number, hitDie: number) => {
    const roll = Math.floor(Math.random() * hitDie) + 1;
    const currentRolls = character.hpLevelRolls || {};
    updateActiveCharacter({
      hpLevelRolls: { ...currentRolls, [level]: roll },
    });
    setRollTargetLevel(null);
    setRollConfirmStep(0);
  };

  const hpMode = character.hpCalculationMode || 'fixed';
  const levelByLevelInfo = React.useMemo(() => {
    const info: {
      level: number;
      classId: string;
      className: string;
      hitDie: number;
      average: number;
    }[] = [];
    let counter = 0;
    character.classes.forEach((cEntry: any) => {
      const def = getClassDefinition(cEntry.classId);
      const hitDie = def?.hitPointDie || 8;
      const className = def?.name || cEntry.classId;
      for (let i = 1; i <= cEntry.level; i++) {
        counter++;
        info.push({
          level: counter,
          classId: cEntry.classId,
          className,
          hitDie,
          average: Math.floor(hitDie / 2) + 1,
        });
      }
    });
    return info;
  }, [character.classes]);

  const [hoveredCondition, setHoveredCondition] = React.useState<any>(null);

  const handleCycleSkill = (skillId: string) => {
    if (!isEditMode) return;
    const isProf = proficiencies.skills.some((p: any) => p.id === skillId);
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
      nextSelectedSkills = nextSelectedSkills.filter((id) => id !== skillId);
      nextExpertise = nextExpertise.filter((id) => id !== skillId);
    }

    updateActiveCharacter({
      selectedSkills: nextSelectedSkills,
      expertiseSkills: nextExpertise,
    });
  };

  const handleCycleSave = (saveId: string) => {
    if (!isEditMode) return;
    const isSaveProf = proficiencies.saves.some((p: any) => p.id === saveId);
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
      classSelections: { ...currentClassSelections, [customSaveKey]: nextCustomSaves },
    });
  };

  const handleUpdateBonus = (targetId: string, val: number) => {
    const current = character.customBonuses || {};
    updateActiveCharacter({ customBonuses: { ...current, [targetId]: val } });
  };

  const handleUpdateScore = (key: string, val: number) => {
    updateManualOverrides({
      abilityScores: { ...character.manualOverrides?.abilityScores, [key]: val },
    });
  };

  const handleResetScore = (key: string) => {
    const scores = { ...character.manualOverrides?.abilityScores };
    delete (scores as any)[key];
    updateManualOverrides({ abilityScores: scores });
  };

  const formatBonus = (val: number) => (val >= 0 ? `+${val}` : `${val}`);

  const renderItem = (
    type: '豁免' | '技能',
    label: string,
    targetId: string,
    baseMod: number,
    isProf: boolean,
    isExpertise: boolean = false,
  ) => {
    const customBonus = (character.customBonuses || {})[targetId] || 0;
    const total =
      baseMod +
      (isProf ? proficiencyBonus : 0) +
      (isExpertise ? proficiencyBonus : 0) +
      customBonus;

    return (
      <div
        key={targetId}
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 0',
          borderBottom: '1px solid var(--color-border-subtle)',
          opacity: isEditMode ? 1 : 0.9,
          transition: 'all 0.2s',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
          <div
            onClick={() =>
              type === '豁免' ? handleCycleSave(targetId) : handleCycleSkill(targetId)
            }
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              border: `2px solid ${isProf ? 'var(--color-primary)' : 'var(--color-border-dark)'}`,
              background: isProf
                ? isExpertise
                  ? 'var(--color-primary)'
                  : 'color-mix(in srgb, var(--color-primary) 25%, transparent)'
                : 'transparent',
              cursor: isEditMode ? 'pointer' : 'default',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
            }}
          >
            {isExpertise && (
              <div
                style={{
                  width: 5,
                  height: 5,
                  background: 'var(--color-text-on-dark, #fff)',
                  borderRadius: '50%',
                }}
              />
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              style={{
                fontWeight: isProf ? 700 : 500,
                fontSize: 12,
                color: isProf ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              }}
            >
              {label}
            </span>
            {isProf && (
              <span
                style={{
                  fontSize: 8,
                  background: isExpertise ? 'var(--color-primary)' : 'var(--color-bg-subtle)',
                  color: isExpertise
                    ? 'var(--color-text-on-dark, #fff)'
                    : 'var(--color-text-secondary)',
                  padding: '0px 3px',
                  borderRadius: 3,
                }}
              >
                {isExpertise ? '专' : '熟'}
              </span>
            )}
            {targetId === 'stealth' && hasStealthDisadvantage && (
              <span
                style={{
                  fontSize: 9,
                  color: 'var(--color-danger)',
                  fontWeight: 800,
                  background: 'rgba(255, 59, 48, 0.1)',
                  padding: '0 4px',
                  borderRadius: 4,
                }}
              >
                劣势
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {isEditMode && (
            <input
              type="number"
              value={customBonus}
              onChange={(e) => handleUpdateBonus(targetId, Number(e.target.value))}
              style={{
                width: 28,
                fontSize: 9,
                border: '1px solid var(--color-border-dark)',
                background: 'var(--color-bg-surface-elevated)',
                color: 'var(--color-text-primary)',
                textAlign: 'center',
                borderRadius: 3,
                padding: '0',
              }}
            />
          )}
          <span
            style={{
              width: 28,
              textAlign: 'right',
              fontWeight: 800,
              fontSize: 13,
              color: total >= 0 ? 'var(--color-primary)' : 'var(--color-danger)',
            }}
          >
            {formatBonus(total)}
          </span>
        </div>
      </div>
    );
  };

  const xpTable = [
    0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000,
    165000, 195000, 225000, 265000, 305000, 355000,
  ];
  const currentXP = character.xp || 0;
  const nextLevelXP = totalLevel < 20 ? xpTable[totalLevel] : currentXP;
  const prevLevelXP = totalLevel > 1 ? xpTable[totalLevel - 1] : 0;
  const xpProgress =
    totalLevel < 20
      ? Math.min(100, Math.max(0, ((currentXP - prevLevelXP) / (nextLevelXP - prevLevelXP)) * 100))
      : 100;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 40 }}>
      {/* 1. 紧凑型顶部面板 (Header + Combat Stats) */}
      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16 }}>
        {/* 左侧：角色身份卡 */}
        <div
          className={styles.card}
          style={{ padding: '12px', display: 'flex', gap: 12, alignItems: 'center' }}
        >
          <div
            onClick={() => router.push(`/builder/details?id=${id}`)}
            style={{
              width: 56,
              height: 56,
              borderRadius: '50%',
              background: 'var(--color-bg-dark)',
              overflow: 'hidden',
              border: '2px solid var(--color-gold-bright)',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <img
              src={
                character.avatarUrl ||
                `https://api.dicebear.com/7.x/avataaars/svg?seed=${character.name}`
              }
              alt="Avatar"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          </div>
          <div style={{ minWidth: 0 }}>
            <h1
              onClick={() => router.push(`/builder/details?id=${id}`)}
              style={{
                fontSize: 16,
                fontWeight: 800,
                margin: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              {character.name || '未命名'}
            </h1>
            <div
              style={{
                fontSize: 11,
                color: 'var(--color-text-tertiary)',
                marginTop: 2,
                display: 'flex',
                gap: 4,
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <span
                onClick={() => router.push(`/builder/species?id=${id}`)}
                style={{ cursor: 'pointer' }}
              >
                {species?.name || '未知'}
              </span>
              <span>·</span>
              <span
                onClick={() => router.push(`/builder/class?id=${id}`)}
                style={{ cursor: 'pointer' }}
              >
                {character.classes && character.classes.length > 1
                  ? character.classes
                      .map(
                        (c: any) =>
                          `${getClassDefinition(c.classId)?.name || c.classId} ${c.level}`,
                      )
                      .join(' / ')
                  : `${primaryClass?.name || '未知'} ${totalLevel}`}
              </span>
              {character.alignment && (
                <>
                  <span>·</span>
                  <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                    {character.alignment}
                  </span>
                </>
              )}
            </div>
            <div style={{ marginTop: 6, position: 'relative' }}>
              <div
                style={{
                  height: 4,
                  background: 'rgba(0,0,0,0.05)',
                  borderRadius: 2,
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${xpProgress}%`,
                    height: '100%',
                    background: 'var(--color-primary)',
                  }}
                />
              </div>
              <div
                style={{
                  fontSize: 9,
                  color: 'var(--color-text-tertiary)',
                  marginTop: 2,
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>Lv.{totalLevel}</span>
                <span onClick={() => setIsEditingXP(!isEditingXP)} style={{ cursor: 'pointer' }}>
                  {currentXP} / {nextLevelXP} XP
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* 右侧：战斗核心数据栏 (高密度多行网格) */}
        <div
          className={styles.card}
          style={{
            padding: '8px 16px',
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px 0',
            alignItems: 'center',
          }}
        >
          {/* 第一行 */}
          <div
            style={{
              textAlign: 'center',
              borderRight: '1px solid var(--color-border-subtle)',
              position: 'relative',
              cursor: 'pointer',
            }}
            onClick={() => handleEditClick('ac', final.ac)}
          >
            <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{final.ac}</div>
            <div
              style={{
                fontSize: 9,
                color: flags.isAcManual ? 'var(--color-warning)' : 'var(--color-text-tertiary)',
                fontWeight: 700,
                marginTop: 2,
              }}
            >
              护甲 (AC) {flags.isAcManual && '✎'}
            </div>
          </div>
          <div
            style={{
              textAlign: 'center',
              borderRight: '1px solid var(--color-border-subtle)',
              position: 'relative',
              cursor: 'pointer',
            }}
            onClick={() => handleEditClick('initiative', initiative)}
          >
            <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>
              {initiative >= 0 ? `+${initiative}` : initiative}
            </div>
            <div
              style={{
                fontSize: 9,
                color: flags.isInitiativeManual
                  ? 'var(--color-warning)'
                  : 'var(--color-text-tertiary)',
                fontWeight: 700,
                marginTop: 2,
              }}
            >
              先攻 (INIT) {flags.isInitiativeManual && '✎'}
            </div>
          </div>
          <div
            style={{
              textAlign: 'center',
              borderRight: '1px solid var(--color-border-subtle)',
              position: 'relative',
              cursor: 'pointer',
            }}
            onClick={() => handleEditClick('speed', speed)}
          >
            <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1 }}>{speed}</div>
            <div
              style={{
                fontSize: 9,
                color: flags.isSpeedManual ? 'var(--color-warning)' : 'var(--color-text-tertiary)',
                fontWeight: 700,
                marginTop: 2,
              }}
            >
              速度 (FT) {flags.isSpeedManual && '✎'}
            </div>
          </div>
          <div
            style={{
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s',
              background: character.inspiration ? 'var(--color-bg-subtle)' : 'transparent',
              borderRadius: 8,
              padding: '4px 0',
            }}
            onClick={() => updateActiveCharacter({ inspiration: !character.inspiration })}
          >
            <div
              style={{
                fontSize: 22,
                color: character.inspiration ? 'var(--color-primary)' : 'var(--color-border-dark)',
                lineHeight: 1,
              }}
            >
              {character.inspiration ? '★' : '☆'}
            </div>
            <div
              style={{
                fontSize: 9,
                color: character.inspiration
                  ? 'var(--color-primary)'
                  : 'var(--color-text-tertiary)',
                fontWeight: 700,
                marginTop: 2,
              }}
            >
              激励
            </div>
          </div>

          {/* 第二行 */}
          <div style={{ textAlign: 'center', borderRight: '1px solid var(--color-border-subtle)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>+{proficiencyBonus}</div>
            <div
              style={{
                fontSize: 9,
                color: 'var(--color-text-tertiary)',
                fontWeight: 700,
                marginTop: 2,
              }}
            >
              熟练 (PB)
            </div>
          </div>
          <div style={{ textAlign: 'center', borderRight: '1px solid var(--color-border-subtle)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>{passivePerception}</div>
            <div
              style={{
                fontSize: 9,
                color: 'var(--color-text-tertiary)',
                fontWeight: 700,
                marginTop: 2,
              }}
            >
              被动察觉
            </div>
          </div>
          <div style={{ textAlign: 'center', borderRight: '1px solid var(--color-border-subtle)' }}>
            <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>
              {10 +
                final.modifiers.wis +
                (proficiencies.skills.some((p: any) => p.id === 'insight') ? proficiencyBonus : 0) +
                ((character.customBonuses || {}).insight || 0)}
            </div>
            <div
              style={{
                fontSize: 9,
                color: 'var(--color-text-tertiary)',
                fontWeight: 700,
                marginTop: 2,
              }}
            >
              被动洞悉
            </div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1 }}>
              {10 +
                final.modifiers.int +
                (proficiencies.skills.some((p: any) => p.id === 'investigation')
                  ? proficiencyBonus
                  : 0) +
                ((character.customBonuses || {}).investigation || 0)}
            </div>
            <div
              style={{
                fontSize: 9,
                color: 'var(--color-text-tertiary)',
                fontWeight: 700,
                marginTop: 2,
              }}
            >
              被动调查
            </div>
          </div>
        </div>
      </div>

      {/* 2. 状态记录栏 (HP, Resources, Conditions) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
        {/* 生命值面板 */}
        <div
          className={styles.card}
          style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}
        >
          {/* 顶部追踪器: 死亡豁免 & 生命骰 */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: 12,
              borderBottom: '1px solid var(--color-border-subtle)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <DeathSaveTracker
                successes={character.deathSaves?.success ?? 0}
                failures={character.deathSaves?.failure ?? 0}
                onUpdate={(type: string, val: number) => {
                  const current = character.deathSaves || { success: 0, failure: 0 };
                  updateActiveCharacter({ deathSaves: { ...current, [type]: val } });
                }}
              />
            </div>
            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {Object.entries(hitDicePools).map(([die, total]) => {
                const used = (character.hitDiceUsedMap || {})[die] || 0;
                return (
                  <div
                    key={die}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}
                  >
                    <div
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        color: 'var(--color-text-tertiary)',
                        textTransform: 'uppercase',
                      }}
                    >
                      生命骰 ({die})
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 2 }}>
                      <span
                        style={{ fontSize: 20, fontWeight: 900, color: 'var(--color-primary)' }}
                      >
                        {total - used}
                        <small style={{ fontSize: 11, color: '#86868b', fontWeight: 600 }}>
                          /{total}
                        </small>
                      </span>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <button
                          style={{
                            border: 'none',
                            background: 'var(--color-bg-subtle)',
                            borderRadius: 4,
                            width: 22,
                            height: 22,
                            cursor: 'pointer',
                            fontSize: 14,
                            fontWeight: 700,
                          }}
                          onClick={() => handleUpdateHitDice(die, 1)}
                        >
                          -
                        </button>
                        <button
                          style={{
                            border: 'none',
                            background: 'var(--color-bg-subtle)',
                            borderRadius: 4,
                            width: 22,
                            height: 22,
                            cursor: 'pointer',
                            fontSize: 14,
                            fontWeight: 700,
                          }}
                          onClick={() => handleUpdateHitDice(die, -1)}
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {Object.keys(hitDicePools).length === 0 && (
                <div style={{ fontSize: 9, color: 'var(--color-text-tertiary)' }}>无可用生命骰</div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 24, alignItems: 'center' }}>
            <div style={{ flex: 1 }}>
              {/* 临时生命值行 */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  marginBottom: 10,
                  paddingBottom: 10,
                  borderBottom: '1px dashed var(--color-border-subtle)',
                }}
              >
                <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-primary)' }}>
                  临时生命 TEMP
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <input
                    type="number"
                    value={tempHp}
                    onChange={(e) => updateActiveCharacter({ tempHp: Number(e.target.value) || 0 })}
                    style={{
                      width: 60,
                      border: 'none',
                      background: 'var(--color-bg-subtle)',
                      fontSize: 24,
                      fontWeight: 800,
                      color: 'var(--color-primary)',
                      padding: '0 4px',
                      textAlign: 'right',
                      borderRadius: 4,
                    }}
                  />
                </div>
              </div>

              {/* 主生命值行 */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  marginBottom: 6,
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                  onClick={() => setShowHPSettings(true)}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 800,
                      color: flags.isMaxHpManual
                        ? 'var(--color-warning)'
                        : 'var(--color-text-tertiary)',
                    }}
                  >
                    生命值 HP {flags.isMaxHpManual && '✎'}
                  </span>
                  {isEditMode && flags.isMaxHpManual && (
                    <span
                      onClick={(e) => {
                        e.stopPropagation();
                        updateManualOverrides({ maxHp: undefined });
                      }}
                      style={{ fontSize: 10, color: 'var(--color-primary)', cursor: 'pointer' }}
                    >
                      恢复
                    </span>
                  )}
                </div>
                <div onClick={() => setShowHPSettings(true)} style={{ cursor: 'pointer' }}>
                  <span style={{ fontSize: 24, fontWeight: 800 }}>{currentHp}</span>
                  <span
                    style={{ fontSize: 14, color: 'var(--color-text-tertiary)', margin: '0 2px' }}
                  >
                    /
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600 }}>{maxHp}</span>
                </div>
              </div>
              <div
                onClick={() => setShowHPSettings(true)}
                style={{
                  height: 8,
                  background: 'rgba(0,0,0,0.06)',
                  borderRadius: 4,
                  overflow: 'hidden',
                  position: 'relative',
                  cursor: 'pointer',
                }}
              >
                <div
                  style={{
                    width: `${(currentHp / maxHp) * 100}%`,
                    height: '100%',
                    background:
                      currentHp <= maxHp * 0.3 ? 'var(--color-danger)' : 'var(--color-success)',
                    transition: 'width 0.4s ease',
                  }}
                />
                {tempHp > 0 && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: `${(tempHp / maxHp) * 100}%`,
                      height: '100%',
                      background: 'rgba(0, 113, 227, 0.4)',
                    }}
                  />
                )}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="number"
                placeholder="值"
                value={hpChange}
                onChange={(e) => setHpChange(e.target.value)}
                style={{
                  width: 44,
                  padding: '4px',
                  border: '1px solid var(--color-border-subtle)',
                  borderRadius: 6,
                  fontSize: 12,
                  textAlign: 'center',
                }}
              />
              <PillButton
                size="xs"
                variant="outline"
                onClick={() => handleHpChange(true)}
                style={{ color: 'var(--color-success)', borderColor: 'var(--color-success)' }}
              >
                治愈
              </PillButton>
              <PillButton
                size="xs"
                variant="outline"
                onClick={() => handleHpChange(false)}
                style={{ color: 'var(--color-danger)', borderColor: 'var(--color-danger)' }}
              >
                伤害
              </PillButton>
            </div>
          </div>
        </div>

        {/* 状态记录栏 (Conditions & Active Effects) */}
        <div
          className={styles.card}
          style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}
        >
          {/* 力竭等级整合到最上方 */}
          <div style={{ paddingBottom: 10, borderBottom: '1px solid var(--color-border-subtle)' }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                marginBottom: 6,
              }}
            >
              力竭等级 Exhaustion
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              {[1, 2, 3, 4, 5, 6].map((lvl: number) => (
                <div
                  key={lvl}
                  onClick={() =>
                    updateActiveCharacter({
                      exhaustion: character.exhaustion === lvl ? lvl - 1 : lvl,
                    })
                  }
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    border: '1px solid var(--color-border-subtle)',
                    background:
                      (character.exhaustion ?? 0) >= lvl ? 'var(--color-danger)' : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 10,
                    fontWeight: 700,
                    color:
                      (character.exhaustion ?? 0) >= lvl ? '#fff' : 'var(--color-text-tertiary)',
                  }}
                >
                  {lvl}
                </div>
              ))}
            </div>
            {/* 动态描述文字 */}
            {(character.exhaustion ?? 0) > 0 && (
              <div
                style={{
                  marginTop: 10,
                  padding: '8px 12px',
                  background: 'rgba(255, 59, 48, 0.05)',
                  borderRadius: 8,
                  borderLeft: '3px solid var(--color-danger)',
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 800,
                    color: 'var(--color-danger)',
                    marginBottom: 4,
                  }}
                >
                  当前效应 (第 {character.exhaustion} 级):
                </div>
                <div
                  style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}
                >
                  • <strong>D20 检定减去 {(character.exhaustion ?? 0) * 2}</strong>{' '}
                  (攻击、属性检定、豁免)
                  <br />• <strong>速度降低 {(character.exhaustion ?? 0) * 5} 尺</strong>
                  <br />
                  {character.exhaustion === 6 && (
                    <span style={{ color: 'var(--color-danger)', fontWeight: 800 }}>
                      • 你已死亡 (等级达到 6)
                    </span>
                  )}
                </div>
              </div>
            )}
            {(character.exhaustion ?? 0) === 0 && (
              <div
                style={{
                  marginTop: 8,
                  fontSize: 10,
                  color: 'var(--color-text-tertiary)',
                  fontStyle: 'italic',
                }}
              >
                目前没有力竭效应。每完成一次长休可移除 1 级。
              </div>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
              }}
            >
              状态标记 Conditions
            </div>
            <PillButton size="xs" variant="outline" onClick={() => setShowConditionSelector(true)}>
              管理状态
            </PillButton>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 24 }}>
            {(character.conditions || []).map((cId: string) => {
              const cond = ALL_CONDITIONS.find((c) => c.id === cId);
              return (
                <div
                  key={cId}
                  onClick={() => setViewingCondition(cond)}
                  style={{
                    padding: '2px 10px',
                    background: 'var(--color-danger)',
                    color: '#fff',
                    borderRadius: 4,
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: 'pointer',
                    animation: 'scaleIn 0.2s ease',
                  }}
                >
                  {cond?.name}
                </div>
              );
            })}
            {(character.conditions || []).length === 0 && (
              <span style={{ fontSize: 12, color: 'var(--color-border-dark)', fontWeight: 500 }}>
                目前身体状况良好，无异常状态
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 3. 核心属性与技能矩阵 (三列两行结构) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {['str', 'dex', 'con', 'int', 'wis', 'cha'].map((key) => renderAbilityBlock(key))}
      </div>

      {/* 4. 底部补充信息: 综合熟练项汇总 (Armor, Weapons, Tools, Languages) */}
      <div className={styles.card} style={{ padding: '16px 20px' }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '24px 32px',
          }}
        >
          {/* 护甲熟练 */}
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: 'var(--color-text-secondary)',
                textTransform: 'uppercase',
                marginBottom: 8,
                letterSpacing: '0.05em',
                borderBottom: '1px solid var(--color-border-dark)',
                paddingBottom: 4,
                fontFamily: 'var(--font-family-serif)',
              }}
            >
              护甲熟练 Armor
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {proficiencies.armor.length > 0 ? (
                proficiencies.armor.map((p: any) => (
                  <span
                    key={p.id}
                    style={{
                      fontSize: 12,
                      color: 'var(--color-text-primary)',
                      background: 'var(--color-bg-dark)',
                      border: '1px solid var(--color-border-dark)',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontWeight: 500,
                    }}
                  >
                    {translateProficiency(p.id)}
                  </span>
                ))
              ) : (
                <span
                  style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}
                >
                  无熟练
                </span>
              )}
            </div>
          </div>

          {/* 武器熟练 */}
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: 'var(--color-text-secondary)',
                textTransform: 'uppercase',
                marginBottom: 8,
                letterSpacing: '0.05em',
                borderBottom: '1px solid var(--color-border-dark)',
                paddingBottom: 4,
                fontFamily: 'var(--font-family-serif)',
              }}
            >
              武器熟练 Weapons
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {proficiencies.weapons.length > 0 ? (
                proficiencies.weapons.map((p: any) => (
                  <span
                    key={p.id}
                    style={{
                      fontSize: 12,
                      color: 'var(--color-text-primary)',
                      background: 'var(--color-bg-dark)',
                      border: '1px solid var(--color-border-dark)',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontWeight: 500,
                    }}
                  >
                    {translateProficiency(p.id)}
                  </span>
                ))
              ) : (
                <span
                  style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}
                >
                  无熟练
                </span>
              )}
            </div>
          </div>

          {/* 武器精通 (2024 新增) */}
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: 'var(--color-text-secondary)',
                textTransform: 'uppercase',
                marginBottom: 8,
                letterSpacing: '0.05em',
                borderBottom: '1px solid var(--color-border-dark)',
                paddingBottom: 4,
                fontFamily: 'var(--font-family-serif)',
              }}
            >
              武器精通 Masteries
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {proficiencies.weaponMasteries?.length > 0 ? (
                proficiencies.weaponMasteries.map((p: any) => (
                  <span
                    key={p.id}
                    style={{
                      fontSize: 12,
                      color: 'var(--color-gold-bright)',
                      background: 'rgba(197,160,89,0.1)',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontWeight: 600,
                      border: '1px solid var(--color-border-gold)',
                    }}
                  >
                    {translateProficiency(p.id)}
                  </span>
                ))
              ) : (
                <span
                  style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}
                >
                  无精通
                </span>
              )}
            </div>
          </div>

          {/* 工具熟练 */}
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: 'var(--color-text-secondary)',
                textTransform: 'uppercase',
                marginBottom: 8,
                letterSpacing: '0.05em',
                borderBottom: '1px solid var(--color-border-dark)',
                paddingBottom: 4,
                fontFamily: 'var(--font-family-serif)',
              }}
            >
              工具熟练 Tools
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {proficiencies.tools.length > 0 ? (
                proficiencies.tools.map((p: any) => (
                  <span
                    key={p.id}
                    style={{
                      fontSize: 12,
                      color: 'var(--color-text-primary)',
                      background: 'var(--color-bg-dark)',
                      border: '1px solid var(--color-border-dark)',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontWeight: 500,
                    }}
                  >
                    {translateProficiency(p.id)}
                  </span>
                ))
              ) : (
                <span
                  style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}
                >
                  无熟练
                </span>
              )}
            </div>
          </div>

          {/* 伤害抗性 Resistances */}
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                marginBottom: 8,
                letterSpacing: '0.05em',
                borderBottom: '1px solid var(--color-border-subtle)',
                paddingBottom: 4,
              }}
            >
              伤害抗性 Resistances
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {proficiencies.resistances && proficiencies.resistances.length > 0 ? (
                proficiencies.resistances.map((p: any) => (
                  <span
                    key={p.id}
                    style={{
                      fontSize: 12,
                      color: 'var(--color-text-primary)',
                      background: 'rgba(239, 68, 68, 0.12)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontWeight: 600,
                    }}
                  >
                    🛡️ {translateProficiency(p.id)}
                  </span>
                ))
              ) : (
                <span
                  style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}
                >
                  无特殊抗性
                </span>
              )}
            </div>
          </div>

          {/* 语言 Languages */}
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                marginBottom: 8,
                letterSpacing: '0.05em',
                borderBottom: '1px solid var(--color-border-subtle)',
                paddingBottom: 4,
              }}
            >
              语言 Languages
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {proficiencies.languages.length > 0 ? (
                proficiencies.languages.map((p: any) => (
                  <span
                    key={p.id}
                    style={{
                      fontSize: 12,
                      color: 'var(--color-text-primary)',
                      background: 'var(--color-bg-subtle)',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontWeight: 600,
                    }}
                  >
                    {translateProficiency(p.id)}
                  </span>
                ))
              ) : (
                <span
                  style={{ fontSize: 12, color: 'var(--color-text-tertiary)', fontStyle: 'italic' }}
                >
                  仅通用语
                </span>
              )}
            </div>
          </div>

          {/* 感官 Senses */}
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                marginBottom: 8,
                letterSpacing: '0.05em',
                borderBottom: '1px solid var(--color-border-subtle)',
                paddingBottom: 4,
              }}
            >
              感官 Senses
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--color-text-secondary)',
                  background: 'var(--color-bg-light)',
                  padding: '2px 8px',
                  borderRadius: 4,
                  border: '1px solid var(--color-border-subtle)',
                }}
              >
                {translateSense(character.senses) || '普通视觉'}
              </span>
              {Object.entries(proficiencies.senses).map(([k, v]) => (
                <span
                  key={k}
                  style={{
                    fontSize: 12,
                    color: 'var(--color-text-primary)',
                    background: 'var(--color-bg-subtle)',
                    padding: '2px 8px',
                    borderRadius: 4,
                    border: '1px solid var(--color-border-subtle)',
                  }}
                >
                  {translateSense(k)} {v as any}尺
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 同调物品 (如果有) */}
        {attunedItems.length > 0 && (
          <div
            style={{
              marginTop: 20,
              paddingTop: 16,
              borderTop: '1px dashed var(--color-border-subtle)',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: attunement.overLimit ? 'var(--color-warning)' : 'var(--color-text-tertiary)',
                textTransform: 'uppercase',
                marginBottom: 8,
              }}
            >
              已同调魔法装备 Attunement ({attunement.count}/{attunement.limit})
              {attunement.overLimit && ' · 超出当前同调上限，需由 DM 确认'}
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              {attunedItems.map((item: any) => (
                <div
                  key={item.id}
                  style={{
                    fontSize: 12,
                    color: 'var(--color-primary)',
                    background: 'var(--color-bg-subtle)',
                    padding: '4px 12px',
                    borderRadius: 20,
                    fontWeight: 600,
                    border: '1px solid color-mix(in srgb, var(--color-primary) 25%, transparent)',
                  }}
                >
                  {item.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {isEditingXP && (
        <div
          className={styles.card}
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            padding: 12,
            boxShadow: '0 8px 30px rgba(0,0,0,0.15)',
            zIndex: 100,
            display: 'flex',
            gap: 8,
          }}
        >
          <input
            type="number"
            value={tempXP}
            onChange={(e) => setTempXP(Number(e.target.value))}
            style={{
              width: 80,
              padding: '4px 8px',
              fontSize: 12,
              borderRadius: 4,
              border: '1px solid var(--color-border-subtle)',
            }}
          />
          <PillButton
            size="sm"
            onClick={() => {
              updateActiveCharacter({ xp: tempXP });
              setIsEditingXP(false);
            }}
          >
            更新经验
          </PillButton>
          <PillButton size="sm" variant="outline" onClick={() => setIsEditingXP(false)}>
            取消
          </PillButton>
        </div>
      )}

      {/* 状态选择器模态框 (双栏固定高度无抖动布局) */}
      {showConditionSelector && (
        <div className={styles.overlay} onClick={() => setShowConditionSelector(false)}>
          <div
            className={styles.modal}
            style={{ maxWidth: 780, width: '92%', padding: 24 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <h3 className={styles.modalTitle} style={{ margin: 0 }}>
                异常状态管理
              </h3>
              <PillButton
                size="sm"
                variant="outline"
                onClick={() => setShowConditionSelector(false)}
              >
                ✕ 关闭
              </PillButton>
            </div>

            {/* 顶部已激活状态标签栏 */}
            <div
              style={{
                background: 'var(--color-bg-subtle)',
                padding: '10px 14px',
                borderRadius: 12,
                marginBottom: 16,
              }}
            >
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--color-text-tertiary)',
                  marginBottom: 6,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>已生效状态 ({(character.conditions || []).length})：</span>
                <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                  点击快捷移除 / 点击列表中状态查看规则
                </span>
              </div>
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  minHeight: 26,
                  alignItems: 'center',
                }}
              >
                {(character.conditions || []).length === 0 ? (
                  <span
                    style={{
                      fontSize: 12,
                      color: 'var(--color-text-tertiary)',
                      fontStyle: 'italic',
                    }}
                  >
                    目前身体状况良好，无任何异常状态
                  </span>
                ) : (
                  (character.conditions || []).map((cId: string) => {
                    const cond = ALL_CONDITIONS.find((c) => c.id === cId);
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
                          boxShadow: '0 2px 5px rgba(255, 59, 48, 0.2)',
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
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 16,
                alignItems: 'start',
              }}
            >
              {/* 左栏：状态选择列表 */}
              <div>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    color: 'var(--color-text-tertiary)',
                    marginBottom: 8,
                  }}
                >
                  选择状态 (点击切换/查看规则)：
                </div>
                <div
                  className={styles.gridList}
                  style={{
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    maxHeight: 340,
                    overflowY: 'auto',
                    paddingRight: 4,
                  }}
                >
                  {ALL_CONDITIONS.map((cond) => {
                    const isActive = (character.conditions || []).includes(cond.id);
                    const isInspecting = (hoveredCondition?.id || ALL_CONDITIONS[0].id) === cond.id;
                    return (
                      <div
                        key={cond.id}
                        className={`${styles.listItem} ${isActive ? styles.listItemActive : ''}`}
                        style={{
                          borderLeft: isInspecting ? '4px solid var(--color-primary)' : undefined,
                          fontWeight: isInspecting || isActive ? 700 : 500,
                        }}
                        onClick={() => {
                          setHoveredCondition(cond);
                          toggleCondition(cond.id);
                        }}
                      >
                        <span style={{ flex: 1 }}>{cond.name}</span>
                        {isActive && (
                          <span style={{ fontSize: 12, fontWeight: 800, color: '#ff3b30' }}>✓</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 右栏：固定高度的规则详情面板 */}
              {(() => {
                const activePreviewCond =
                  hoveredCondition ||
                  ALL_CONDITIONS.find((c) => (character.conditions || []).includes(c.id)) ||
                  ALL_CONDITIONS[0];
                const isSelected = (character.conditions || []).includes(activePreviewCond.id);

                return (
                  <div
                    style={{
                      height: 375,
                      display: 'flex',
                      flexDirection: 'column',
                      background: 'var(--color-bg-light)',
                      borderRadius: 12,
                      border: '1px solid var(--color-border-subtle)',
                      padding: 16,
                      boxShadow: 'inset 0 1px 3px rgba(0,0,0,0.02)',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 10,
                        paddingBottom: 8,
                        borderBottom: '1px solid var(--color-border-subtle)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            fontWeight: 800,
                            fontSize: 17,
                            color: 'var(--color-text-primary)',
                          }}
                        >
                          {activePreviewCond.name}
                        </span>
                        <span
                          style={{
                            fontSize: 11,
                            padding: '2px 8px',
                            borderRadius: 10,
                            background: isSelected
                              ? 'rgba(255, 59, 48, 0.1)'
                              : 'var(--color-bg-subtle)',
                            color: isSelected ? '#ff3b30' : 'var(--color-text-tertiary)',
                            fontWeight: 700,
                          }}
                        >
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

                    <div
                      style={{
                        flex: 1,
                        overflowY: 'auto',
                        fontSize: 13,
                        lineHeight: 1.65,
                        color: 'var(--color-text-secondary)',
                        whiteSpace: 'pre-wrap',
                        paddingRight: 4,
                      }}
                    >
                      {activePreviewCond.description}
                    </div>
                  </div>
                );
              })()}
            </div>

            <div style={{ marginTop: 20 }}>
              <PillButton
                size="md"
                variant="primary"
                style={{ width: '100%' }}
                onClick={() => setShowConditionSelector(false)}
              >
                完成并关闭
              </PillButton>
            </div>
          </div>
        </div>
      )}

      {/* 状态详情模态框 */}
      {viewingCondition && (
        <div className={styles.overlay} onClick={() => setViewingCondition(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>{viewingCondition.name}</h3>
            <div
              style={{ lineHeight: 1.6, fontSize: 15, color: '#424245', whiteSpace: 'pre-wrap' }}
            >
              {viewingCondition.description}
            </div>
            <div style={{ marginTop: 24, display: 'flex', gap: 12 }}>
              <PillButton
                size="md"
                variant="outline"
                style={{ flex: 1 }}
                onClick={() => toggleCondition(viewingCondition.id)}
              >
                移除该状态
              </PillButton>
              <PillButton
                size="md"
                variant="primary"
                style={{ flex: 1 }}
                onClick={() => setViewingCondition(null)}
              >
                确定
              </PillButton>
            </div>
          </div>
        </div>
      )}

      {/* HP 设置模态框 */}
      {showHPSettings && (
        <div className={styles.overlay} onClick={() => setShowHPSettings(false)}>
          <div
            className={styles.modal}
            style={{ maxWidth: 600 }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className={styles.modalTitle}>生命值计算设置</h3>

            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  fontSize: 13,
                  color: 'var(--color-text-secondary)',
                  marginBottom: 12,
                  fontWeight: 600,
                }}
              >
                计算模式
              </div>
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
                  逐级投骰
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
                <div
                  style={{ fontSize: 13, color: 'var(--color-text-secondary)', fontWeight: 600 }}
                >
                  等级详情
                </div>
                <div
                  style={{
                    maxHeight: 220,
                    overflowY: 'auto',
                    border: '1px solid var(--color-border-dark)',
                    borderRadius: 12,
                    background: 'var(--color-bg-dark)',
                  }}
                >
                  <table
                    style={{
                      width: '100%',
                      borderCollapse: 'collapse',
                      fontSize: 13,
                      color: 'var(--color-text-primary)',
                    }}
                  >
                    <thead
                      style={{
                        background: 'var(--color-bg-surface)',
                        position: 'sticky',
                        top: 0,
                        borderBottom: '1px solid var(--color-border-dark)',
                      }}
                    >
                      <tr>
                        <th
                          style={{
                            padding: 10,
                            textAlign: 'left',
                            color: 'var(--color-gold-bright)',
                          }}
                        >
                          等级
                        </th>
                        <th
                          style={{
                            padding: 10,
                            textAlign: 'center',
                            color: 'var(--color-gold-bright)',
                          }}
                        >
                          增加 HP
                        </th>
                        <th
                          style={{
                            padding: 10,
                            textAlign: 'center',
                            color: 'var(--color-gold-bright)',
                          }}
                        >
                          操作
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {levelByLevelInfo.map((info: any) => {
                        const roll = character.hpLevelRolls?.[info.level];
                        const isRolled = typeof roll === 'number';
                        const isLevel1 = info.level === 1;
                        return (
                          <tr
                            key={info.level}
                            style={{ borderBottom: '1px solid var(--color-border-dark)' }}
                          >
                            <td style={{ padding: '8px 10px' }}>
                              Lv.{info.level} ({info.className})
                            </td>
                            <td
                              style={{
                                padding: '8px 10px',
                                textAlign: 'center',
                                color: 'var(--color-gold-bright)',
                                fontWeight: 700,
                              }}
                            >
                              {isLevel1 ? info.hitDie : isRolled ? roll : info.average}
                            </td>
                            <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                              {!isLevel1 && !isRolled && (
                                <PillButton
                                  size="xs"
                                  variant="outline"
                                  onClick={() => handleRollHP(info.level, info.hitDie)}
                                >
                                  投骰
                                </PillButton>
                              )}
                              {isRolled && (
                                <span
                                  style={{
                                    color: 'var(--color-success)',
                                    fontSize: 11,
                                    fontWeight: 700,
                                  }}
                                >
                                  锁定
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div style={{ marginTop: 24 }}>
              <PillButton
                size="md"
                variant="primary"
                style={{ width: '100%' }}
                onClick={() => setShowHPSettings(false)}
              >
                确认关闭
              </PillButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  function DeathSaveTracker({ successes, failures, onUpdate }: any) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={`s-${i}`}
              onClick={() => onUpdate('success', i === successes ? i - 1 : i)}
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                border: '1px solid var(--color-border-gold)',
                background: i <= successes ? 'var(--color-success)' : 'transparent',
                cursor: 'pointer',
              }}
            />
          ))}
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-success)' }}>成功</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {[1, 2, 3].map((i) => (
            <div
              key={`f-${i}`}
              onClick={() => onUpdate('failure', i === failures ? i - 1 : i)}
              style={{
                width: 12,
                height: 12,
                borderRadius: '50%',
                border: '1px solid var(--color-border-gold)',
                background: i <= failures ? 'var(--color-danger)' : 'transparent',
                cursor: 'pointer',
              }}
            />
          ))}
          <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-danger)' }}>失败</span>
        </div>
      </div>
    );
  }

  function renderAbilityBlock(key: string) {
    const val = final.ability[key as keyof typeof final.ability];
    const mod = final.modifiers[key as keyof typeof final.modifiers];
    const relatedSkills = ALL_SKILLS.filter((s) => skillToAbility[s] === key);
    const isSaveProf = proficiencies.saves.some((p: any) => p.id === key);

    return (
      <div
        key={key}
        className={styles.card}
        style={{
          padding: 0,
          overflow: 'hidden',
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-dark)',
          height: '100%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          {/* 属性核心格 (深黑铁质感) */}
          <div
            style={{
              width: 64,
              background: 'var(--color-bg-dark)',
              borderRight: '1px solid var(--color-border-dark)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '10px 0',
            }}
          >
            <div
              style={{
                fontSize: 10,
                fontWeight: 800,
                color: flags.manualAbilityScores.includes(key as any)
                  ? 'var(--color-warning)'
                  : 'var(--color-text-secondary)',
                textTransform: 'uppercase',
                fontFamily: 'var(--font-family-serif)',
              }}
            >
              {translateAbilityKey(key)} {flags.manualAbilityScores.includes(key as any) && '✎'}
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 900,
                color: 'var(--color-gold-bright)',
                lineHeight: 1,
                margin: '4px 0',
                textShadow: '0 0 10px rgba(197,160,89,0.3)',
              }}
            >
              {formatBonus(mod)}
            </div>
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                color: 'var(--color-text-secondary)',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid var(--color-border-dark)',
                padding: '1px 6px',
                borderRadius: 4,
                position: 'relative',
              }}
            >
              {isEditMode ? (
                <>
                  <input
                    type="number"
                    value={val}
                    onChange={(e) => handleUpdateScore(key, Number(e.target.value))}
                    style={{
                      width: 24,
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--color-text-primary)',
                      fontSize: 10,
                      fontWeight: 700,
                      textAlign: 'center',
                      padding: 0,
                    }}
                  />
                  {flags.manualAbilityScores.includes(key as any) && (
                    <div
                      onClick={() => handleResetScore(key)}
                      style={{
                        position: 'absolute',
                        right: -12,
                        top: 0,
                        fontSize: 8,
                        cursor: 'pointer',
                        color: 'var(--color-gold-bright)',
                      }}
                    >
                      ↺
                    </div>
                  )}
                </>
              ) : (
                val
              )}
            </div>
          </div>

          {/* 豁免与技能列表 */}
          <div style={{ flex: 1, padding: '8px 12px' }}>
            {renderItem('豁免', `${translateAbilityKey(key)}豁免`, key, mod, isSaveProf)}
            {relatedSkills.map((skillId: string) => {
              const isProf = proficiencies.skills.some((p: any) => p.id === skillId);
              const isExpertise = (character.expertiseSkills || []).includes(skillId);
              return renderItem(
                '技能',
                translateSkill(skillId, false),
                skillId,
                mod,
                isProf,
                isExpertise,
              );
            })}
          </div>
        </div>
      </div>
    );
  }
};

export default OverviewTab;
