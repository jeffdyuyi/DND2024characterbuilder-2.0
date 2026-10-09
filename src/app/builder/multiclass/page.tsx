'use client';

import React, { useState, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCharacterStore } from '@/store/characterStore';
import { getCatalogClasses } from '@/catalog';
import { WarlockInvocations2024 } from '@/mechanics-overlay/warlockInvocations';
import { getClassDefinition, getClassProgression, getFeatDefinition } from '@/engine/characterData';
import { computeAbilityScores } from '@/engine/ability';
import { normalizeAbilityKey, translateClass, translateAbilityKey } from '@/engine/terminology';
import { allLanguages } from '@/rules/languages';
import styles from '../class/class.module.css'; // Reuse class styles
import classStyles from './multiclass.module.css';
import PillButton from '@/components/PillButton';

const SKILL_MAP: Record<string, string> = {
  Acrobatics: '体操',
  'Animal Handling': '驯兽',
  Arcana: '奥秘',
  Athletics: '运动',
  Deception: '欺瞒',
  History: '历史',
  Insight: '洞悉',
  Intimidation: '威吓',
  Investigation: '调查',
  Medicine: '医药',
  Nature: '自然',
  Perception: '察觉',
  Performance: '表演',
  Persuasion: '游说',
  Religion: '宗教',
  'Sleight of Hand': '巧手',
  Stealth: '隐匿',
  Survival: '生存',
};

const WEAPON_MAP: Record<string, string> = {
  battleaxe: '战斧',
  blowgun: '吹箭',
  club: '短棍',
  dagger: '匕首',
  dart: '飞镖',
  flail: '连枷',
  greataxe: '巨斧',
  greatclub: '巨棒',
  greatsword: '巨剑',
  halberd: '长柄刀',
  'hand-crossbow': '手弩',
  handaxe: '手斧',
  'heavy-crossbow': '重弩',
  javelin: '标枪',
  'light-crossbow': '轻弩',
  'light-hammer': '轻锤',
  longbow: '长弓',
  longsword: '长剑',
  mace: '重锤',
  maul: '大锤',
  morningstar: '晨星锤',
  musket: '火枪',
  net: '网',
  pike: '长枪',
  pistol: '手枪',
  quarterstaff: '短棍',
  rapier: '细剑',
  scimitar: '弯刀',
  shortbow: '短弓',
  shortsword: '短剑',
  sickle: '镰刀',
  sling: '弹弓',
  spear: '短矛',
  trident: '三叉戟',
  'war-pick': '战镐',
  warhammer: '战锤',
  whip: '长鞭',
};

const normalizeSkillId = (id: string) => id.replace(/\s+/g, '').toLowerCase();

export default function MulticlassPage() {
  const searchParams = useSearchParams();
  const charId = searchParams.get('id') || '';
  const {
    characters,
    updateActiveCharacter: storeUpdateActiveCharacter,
    loadCharacter,
  } = useCharacterStore();
  const character = charId ? characters[charId] : null;

  React.useEffect(() => {
    if (charId) loadCharacter(charId);
  }, [charId, loadCharacter]);

  const [showMCSelector, setShowMCSelector] = useState(false);

  // Language filtering state
  const [langCategory, setLangCategory] = useState<string>('Standard');
  const [langSource, setLangSource] = useState<string>('All');

  if (!character) return <div className={styles.container}>未找到角色数据</div>;

  const currentClasses = character.classes || [];
  const primaryClassEntry = currentClasses[0];
  const additionalClasses = currentClasses.slice(1);
  const totalLevel = currentClasses.reduce((acc, c) => acc + c.level, 0);

  const abilityScores = useMemo(() => computeAbilityScores(character), [character]);

  const updateActiveCharacter = (updates: any) => {
    if (charId) storeUpdateActiveCharacter(updates);
  };

  const handleLevelChange = (classId: string, delta: number) => {
    const newClasses = currentClasses.map((c) => {
      if (c.classId === classId) {
        const next = Math.max(1, c.level + delta);
        if (delta > 0 && totalLevel >= 20) return c;
        return { ...c, level: next };
      }
      return c;
    });
    updateActiveCharacter({ classes: newClasses });
  };

  const handleAddMC = (classId: string) => {
    if (currentClasses.some((c) => c.classId === classId)) return;
    if (totalLevel >= 20) return;

    // Prereq check
    const targetDef =
      getClassDefinition(classId) ||
      getCatalogClasses().find((c) => c.nameEn === classId || (c as any).id === classId);
    if (targetDef && abilityScores) {
      // All current classes and target class must have 13+ in primary ability
      const allValid =
        currentClasses.every((cc) => {
          const def =
            getClassDefinition(cc.classId) ||
            getCatalogClasses().find(
              (c) => c.nameEn === cc.classId || (c as any).id === cc.classId,
            );
          const scores = abilityScores?.scores;
          return def?.primaryAbility.some((attr: string) => {
            if (!scores) return false;
            const key = normalizeAbilityKey(attr);
            if (!key) return false;
            const val = (scores as any)[key.toLowerCase()];
            return (val || 0) >= 13;
          });
        }) &&
        targetDef.primaryAbility.some((attr: string) => {
          const scores = abilityScores?.scores;
          if (!scores) return false;
          const key = normalizeAbilityKey(attr);
          if (!key) return false;
          const val = (scores as any)[key.toLowerCase()];
          return (val || 0) >= 13;
        });

      if (!allValid) return;
    }

    const definition = getClassDefinition(classId);
    const newClasses = [
      ...currentClasses,
      { classId, level: 1, isMulticlass: true, source: definition?.source || 'PHB2024' },
    ];
    updateActiveCharacter({ classes: newClasses });
    setShowMCSelector(false);
  };

  const handleRemoveMC = (classId: string) => {
    const newClasses = currentClasses.filter((c) => c.classId !== classId);
    updateActiveCharacter({ classes: newClasses });
  };

  const handleSelectSubclass = (classId: string, subclassId: string) => {
    const newClasses = currentClasses.map((c) =>
      c.classId === classId ? { ...c, subclassId } : c,
    );
    updateActiveCharacter({ classes: newClasses });
  };

  const handleChoiceSelection = (
    choiceId: string,
    value: string,
    num: number,
    category: string,
    options: string[] = [],
  ) => {
    const currentSelections = character.classSelections || {};
    let values = currentSelections[choiceId] || [];

    if (category === 'skill') {
      const curSkills = character.selectedSkills || [];
      if (curSkills.includes(value)) {
        updateActiveCharacter({ selectedSkills: curSkills.filter((s) => s !== value) });
      } else if (values.length < num) {
        updateActiveCharacter({ selectedSkills: [...curSkills, value] });
        updateActiveCharacter({
          classSelections: { ...currentSelections, [choiceId]: [...values, value] },
        });
      }
      return;
    }

    if (values.includes(value)) {
      values = values.filter((v) => v !== value);
    } else {
      if (values.length < num) values = [...values, value];
      else if (num === 1) values = [value];
    }
    updateActiveCharacter({ classSelections: { ...currentSelections, [choiceId]: values } });
  };

  const translateLabel = (val: string) => {
    if (typeof val !== 'string') return String(val || '');
    return SKILL_MAP[val] || val;
  };

  const renderChoice = (classId: string, choice: any, category: string) => {
    const classDef =
      getClassDefinition(classId) ||
      getCatalogClasses().find((c) => c.nameEn === classId || (c as any).id === classId);
    const isMC = currentClasses[0]?.classId !== classId;
    let num = choice.numToChoose;

    // Proficiency Override
    if (isMC && category === 'skill' && classDef?.multiclassProficiencies?.skills) {
      num = classDef.multiclassProficiencies.skills.numToChoose;
    }

    const choiceId = `${classId}:${choice.name || choice.id}:${choice.id}`;
    const selected = (character.classSelections || {})[choiceId] || [];

    if (category === 'language') {
      const uniqueSources = Array.from(new Set(allLanguages.map((l) => l.source))).filter(
        Boolean,
      ) as string[];
      const filteredLanguages = allLanguages.filter((l) => {
        const categoryMatch = langCategory === 'All' || l.type === langCategory;
        const sourceMatch = langSource === 'All' || l.source === langSource;

        const opts = choice.options || [];
        const keyword = opts.length === 1 ? opts[0] : '';
        let isAllowed =
          opts.includes(l.name) ||
          opts.includes(l.nameEn) ||
          opts.includes('Any') ||
          opts.includes('any') ||
          opts.includes('Any Standard Language') ||
          opts.includes('Any Rare Language');

        if (
          keyword === 'Any standard language' ||
          keyword === '任何标准语言' ||
          keyword === 'Any Standard Language'
        ) {
          isAllowed = l.type === 'Standard';
        } else if (
          keyword === 'Any rare language' ||
          keyword === '任何稀有语言' ||
          keyword === 'Any Rare Language'
        ) {
          isAllowed = l.type === 'Rare';
        } else if (opts.length === 0 || opts[0] === 'Any' || opts[0] === 'any') {
          isAllowed = true;
        }

        return categoryMatch && sourceMatch && isAllowed;
      });

      return (
        <div key={choiceId} className={styles.choiceContainer} style={{ marginTop: 12 }}>
          <div className={styles.choiceLabel}>
            {choice.name || '请选择语言'} ({selected.length}/{num})
          </div>

          {/* Filter Controls */}
          <div
            style={{
              marginBottom: 12,
              display: 'flex',
              gap: 8,
              flexWrap: 'wrap',
              padding: '10px',
              background: 'rgba(0,0,0,0.03)',
              borderRadius: 8,
            }}
          >
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['Standard', 'Rare', 'All'].map((cat) => (
                <PillButton
                  key={cat}
                  size="sm"
                  variant={langCategory === cat ? 'primary' : 'outline'}
                  onClick={() => setLangCategory(cat)}
                >
                  {cat === 'Standard' ? '标准' : cat === 'Rare' ? '稀有' : '全部'}
                </PillButton>
              ))}
            </div>
            <div style={{ width: '1px', background: '#ddd', margin: '0 4px' }} />
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <PillButton
                size="sm"
                variant={langSource === 'All' ? 'primary' : 'outline'}
                onClick={() => setLangSource('All')}
              >
                全部来源
              </PillButton>
              {uniqueSources.map((src) => (
                <PillButton
                  key={src}
                  size="sm"
                  variant={langSource === src ? 'primary' : 'outline'}
                  onClick={() => setLangSource(src)}
                >
                  {src}
                </PillButton>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {filteredLanguages.map((lang) => {
              const isSelected = selected.includes(lang.nameEn);
              return (
                <PillButton
                  key={lang.id}
                  size="sm"
                  variant={isSelected ? 'primary' : 'outline'}
                  onClick={() =>
                    handleChoiceSelection(choiceId, lang.nameEn, num, category, choice.options)
                  }
                >
                  {lang.name}
                </PillButton>
              );
            })}
            {filteredLanguages.length === 0 && (
              <p
                style={{
                  fontSize: '12px',
                  color: '#86868b',
                  width: '100%',
                  textAlign: 'center',
                  padding: '10px',
                }}
              >
                当前筛选条件下没有匹配的语言。
              </p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={choiceId} className={styles.choiceContainer} style={{ marginTop: 12 }}>
        <div className={styles.choiceLabel}>
          {choice.name || '请选择'} ({selected.length}/{num})
        </div>
        {choiceId.includes('invocation') ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '12px',
              marginTop: '12px',
            }}
          >
            {choice.options.map((opt: string) => {
              const inv = WarlockInvocations2024.find((i) => i.name === opt || i.nameEn === opt);
              if (!inv) return null;
              const isSelected = selected.includes(opt);
              return (
                <div
                  key={opt}
                  className={`${styles.pill} ${isSelected ? styles.pillActive : ''}`}
                  onClick={() =>
                    handleChoiceSelection(choiceId, opt, num, category, choice.options)
                  }
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'flex-start',
                    padding: '12px',
                    height: 'auto',
                    textAlign: 'left',
                    gap: '4px',
                    borderRadius: '12px',
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {inv.name} <span style={{ fontSize: '10px', opacity: 0.7 }}>{inv.nameEn}</span>
                  </div>
                  <div style={{ fontSize: '11px', opacity: 0.8 }}>等级: {inv.level}</div>
                  <div style={{ fontSize: '12px', whiteSpace: 'pre-wrap', marginTop: 4 }}>
                    {inv.description}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.pillGrid}>
            {choice.options.map((opt: string) => {
              const isSelected = selected.includes(opt);
              return (
                <div
                  key={opt}
                  className={`${styles.pill} ${isSelected ? styles.pillActive : ''}`}
                  onClick={() =>
                    handleChoiceSelection(choiceId, opt, num, category, choice.options)
                  }
                >
                  {translateLabel(opt)}
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <h2 className={styles.title}>兼职管理</h2>

        <div className={styles.mainLayout}>
          {/* Primary Class Summary */}
          <div className={styles.traitsSection} style={{ opacity: 0.8 }}>
            <h4 className={styles.sectionTitle}>首选职业 (已锁定)</h4>
            {primaryClassEntry && (
              <div
                className={styles.traitCard}
                style={{
                  background: 'var(--color-bg-dark)',
                  border: '1px solid var(--color-border-dark)',
                }}
              >
                <span className={styles.traitName}>
                  {translateClass(primaryClassEntry.classId)}
                </span>
                <span className={styles.traitNameEn} style={{ marginLeft: 8 }}>
                  {primaryClassEntry.classId}
                </span>
                <span
                  style={{ float: 'right', fontWeight: 600, color: 'var(--color-gold-bright)' }}
                >
                  等级 {primaryClassEntry.level}
                </span>
              </div>
            )}
          </div>

          {/* Additional Classes */}
          <div className={styles.traitsSection}>
            <h4 className={styles.sectionTitle}>
              当前兼职{' '}
              <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>
                Additional Classes
              </span>
            </h4>
            {additionalClasses.length === 0 ? (
              <div
                style={{
                  padding: '40px',
                  textAlign: 'center',
                  background: 'var(--color-bg-dark)',
                  borderRadius: '12px',
                  border: '1px dashed var(--color-border-dark)',
                  color: 'var(--color-text-secondary)',
                }}
              >
                尚未添加兼职职业。满足条件后点击下方按钮添加。
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {additionalClasses.map((mc: any) => {
                  const def =
                    getClassDefinition(mc.classId) ||
                    getCatalogClasses().find(
                      (c) => c.nameEn === mc.classId || (c as any).id === mc.classId,
                    );
                  const progression = getClassProgression(def!, mc.level);

                  return (
                    <div
                      key={mc.classId}
                      className={styles.traitCard}
                      style={{ padding: '20px 24px' }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: 16,
                        }}
                      >
                        <div>
                          <span className={styles.traitName} style={{ fontSize: '1.2rem' }}>
                            {def ? translateClass(def.name) : mc.classId}
                          </span>
                          <span className={styles.traitNameEn} style={{ marginLeft: 8 }}>
                            {mc.classId}
                          </span>
                        </div>
                        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                          <div className={styles.levelStepper}>
                            <button
                              className={styles.stepBtn}
                              onClick={() => handleLevelChange(mc.classId, -1)}
                              disabled={mc.level <= 1}
                            >
                              -
                            </button>
                            <span className={styles.levelValue}>{mc.level}</span>
                            <button
                              className={styles.stepBtn}
                              onClick={() => handleLevelChange(mc.classId, 1)}
                              disabled={totalLevel >= 20}
                            >
                              +
                            </button>
                          </div>
                          <button
                            onClick={() => handleRemoveMC(mc.classId)}
                            style={{
                              color: '#ff3b30',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                            }}
                          >
                            移除
                          </button>
                        </div>
                      </div>

                      {/* Subclass */}
                      {def?.subClassInfo && mc.level >= def.subClassInfo.unlockLevel && (
                        <div
                          style={{
                            marginTop: 12,
                            padding: '12px',
                            background: 'var(--color-bg-dark)',
                            borderRadius: '8px',
                            border: '1px solid var(--color-border-dark)',
                          }}
                        >
                          <div
                            style={{
                              fontSize: '13px',
                              fontWeight: 600,
                              marginBottom: 8,
                              color: 'var(--color-gold-bright)',
                            }}
                          >
                            子职业选择 Subclass
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {def.subClassInfo.options.map((sc: any) => (
                              <div
                                key={sc.catalogId || sc.nameEn}
                                className={`${styles.pill} ${mc.subclassId === sc.catalogId || mc.subclassId === sc.nameEn ? styles.pillActive : ''}`}
                                onClick={() =>
                                  handleSelectSubclass(
                                    mc.classId,
                                    sc.catalogId || sc.nameEn || sc.name,
                                  )
                                }
                              >
                                {sc.name}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Multiclass specific features/choices could go here */}
                      {progression?.featuresUnlocked.map((fName: string) => {
                        const feature = def?.features.find((f: any) => f.name === fName);
                        if (!feature?.mechanics?.choices) return null;
                        return feature.mechanics.choices.map((choice: any) =>
                          renderChoice(mc.classId, choice, choice.type),
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Add MC Selector */}
          <div style={{ marginTop: 24 }}>
            {!showMCSelector ? (
              <PillButton onClick={() => setShowMCSelector(true)} disabled={totalLevel >= 20}>
                + 添加兼职职业
              </PillButton>
            ) : (
              <div
                className={styles.mcSelector}
                style={{
                  background: 'var(--color-bg-dark)',
                  border: '1px solid var(--color-border-dark)',
                  padding: '24px',
                  borderRadius: '16px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                  <span
                    style={{
                      fontWeight: 700,
                      color: 'var(--color-text-primary)',
                      fontFamily: 'var(--font-family-serif)',
                    }}
                  >
                    选择兼职职业
                  </span>
                  <button
                    onClick={() => setShowMCSelector(false)}
                    style={{
                      color: 'var(--color-gold-bright)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                    }}
                  >
                    取消
                  </button>
                </div>
                <div
                  className={styles.mcGrid}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                    gap: 12,
                  }}
                >
                  {getCatalogClasses()
                    .filter(
                      (c: any) =>
                        !currentClasses.some(
                          (cc: any) => cc.classId === c.nameEn || cc.classId === c.id,
                        ),
                    )
                    .map((cls: any) => {
                      const meets =
                        currentClasses.every((cc: any) => {
                          const d =
                            getClassDefinition(cc.classId) ||
                            getCatalogClasses().find(
                              (x) => x.nameEn === cc.classId || (x as any).id === cc.classId,
                            );
                          const scores = abilityScores?.scores;
                          return d?.primaryAbility.some((a: string) => {
                            if (!scores) return false;
                            const key = normalizeAbilityKey(a);
                            if (!key) return false;
                            const val = (scores as any)[key.toLowerCase()];
                            return (val || 0) >= 13;
                          });
                        }) &&
                        cls.primaryAbility.some((a: string) => {
                          const scores = abilityScores?.scores;
                          if (!scores) return false;
                          const key = normalizeAbilityKey(a);
                          if (!key) return false;
                          const val = (scores as any)[key.toLowerCase()];
                          return (val || 0) >= 13;
                        });

                      return (
                        <div
                          key={cls.nameEn}
                          className={styles.mcOption}
                          style={{
                            padding: '12px',
                            border: '1px solid var(--color-border-dark)',
                            borderRadius: '8px',
                            cursor: meets ? 'pointer' : 'not-allowed',
                            opacity: meets ? 1 : 0.5,
                            background: meets ? 'var(--color-bg-surface)' : 'var(--color-bg-dark)',
                          }}
                          onClick={() => meets && handleAddMC(cls.nameEn)}
                        >
                          <div style={{ fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            {translateClass(cls.name)}
                          </div>
                          <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
                            {cls.nameEn}
                          </div>
                          {!meets && (
                            <div
                              style={{
                                fontSize: '9px',
                                color: 'var(--color-danger)',
                                marginTop: 4,
                              }}
                            >
                              属性不足 13
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
