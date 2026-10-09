'use client';
import { useBuilderChoices } from '@/platform/useBuilderChoices';

import React, { useState, useEffect, useMemo, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  getCatalogSpecies,
  getCatalogSpells,
  getCatalogFeats,
  SPECIES_RESISTANCE_TRANSLATION,
} from '@/catalog';
import { useCatalog } from '@/platform/CatalogProvider';
import { getSpeciesDefinition } from '@/engine/characterData';
import { useCharacterStore } from '@/store/characterStore';
import OptionCard from '@/components/OptionCard';
import PillButton from '@/components/PillButton';
import styles from './page.module.css';
import { Species, InnateSpell, Trait, SubSpecies, Selection } from '@/types/species';
import { getSourceDisplayName, getSourceSortWeight } from '@/config/sourceMapping';
import { ALL_GAME_LANGUAGES } from '@/rules/languages';
import { getSpellDefinition } from '@/engine/characterData';
import {
  formatActionType,
  translateProficiency,
  ALL_SKILLS,
  ALL_TOOLS,
  translateClass,
  formatSpellRange,
  formatSpellDuration,
  formatSpellComponent,
  translateSpellSchool,
} from '@/engine/terminology';

import MarkdownText from '@/components/MarkdownText';

interface HybridProficiencyPickerProps {
  title?: string;
  numToChoose: number;
  currentSelected: string[];
  onChange: (next: string[]) => void;
}

const HybridProficiencyPicker: React.FC<HybridProficiencyPickerProps> = ({
  title,
  numToChoose,
  currentSelected,
  onChange,
}) => {
  const choices = useBuilderChoices();
  const [activeTab, setActiveTab] = useState<'skills' | 'tools'>('skills');

  const selectedSkills = currentSelected.filter((id) => ALL_SKILLS.includes(id));
  const selectedTools = currentSelected.filter((id) => !ALL_SKILLS.includes(id));

  const isFull = currentSelected.length === numToChoose;

  const handleToggle = (id: string) => {
    const isSelected = currentSelected.includes(id);
    let next: string[];
    if (isSelected) {
      next = currentSelected.filter((x) => x !== id);
    } else {
      next = [...currentSelected, id].slice(-numToChoose);
    }
    onChange(next);
  };

  return (
    <div
      style={{
        marginTop: '10px',
        padding: '12px 14px',
        background: 'var(--color-bg-dark)',
        borderRadius: '10px',
        border: '1px solid var(--color-border-dark)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px',
          flexWrap: 'wrap',
          gap: '6px',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          {title
            ? `🎯/🛠️ ${title}（任选 ${numToChoose} 项）：`
            : `🎯/🛠️ 请选择 ${numToChoose} 项技能或工具熟练：`}
        </span>
        <span
          style={{
            fontSize: '12px',
            color: isFull ? 'var(--color-gold-bright)' : '#ff3b30',
            fontWeight: 600,
          }}
        >
          {currentSelected.length}/{numToChoose}
        </span>
      </div>

      {/* 分类 Tab 切换栏 */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px' }}>
        <PillButton
          size="sm"
          variant={activeTab === 'skills' ? 'primary' : 'outline'}
          onClick={(e) => {
            e?.stopPropagation();
            setActiveTab('skills');
          }}
        >
          🎯 技能熟练 ({selectedSkills.length})
        </PillButton>
        <PillButton
          size="sm"
          variant={activeTab === 'tools' ? 'primary' : 'outline'}
          onClick={(e) => {
            e?.stopPropagation();
            setActiveTab('tools');
          }}
        >
          🛠️ 工具熟练 ({selectedTools.length})
        </PillButton>
      </div>

      {/* 选项 PillButtons */}
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        {(activeTab === 'skills' ? ALL_SKILLS : choices.getCatalogTools()).map((id) => {
          const isChosen = currentSelected.includes(id);
          return (
            <PillButton
              key={id}
              variant={isChosen ? 'primary' : 'outline'}
              size="sm"
              onClick={(e) => {
                e?.stopPropagation();
                handleToggle(id);
              }}
            >
              {translateProficiency(id)}
            </PillButton>
          );
        })}
      </div>
    </div>
  );
};

// 统一的特质渲染组件
const TraitItem = ({
  trait,
  traitId,
  allSelections,
  onTraitSelectionChange,
  showEn = true,
  selections,
  onSelectionChange,
  children,
  speciesId,
}: {
  trait: Trait;
  traitId: string;
  allSelections: Record<string, string[]>;
  onTraitSelectionChange: (id: string, options: string[]) => void;
  showEn?: boolean;
  selections?: string[];
  onSelectionChange?: (options: string[]) => void;
  children?: React.ReactNode;
  speciesId: string;
}) => {
  const choices = useBuilderChoices();
  const [featCategory, setFeatCategory] = useState<string>('All'); // 专长筛选分类 (All 表示全部分类)
  const [featSource, setFeatSource] = useState<string>('XPHB'); // 专长筛选来源 (默认 2024 玩家手册)
  const [langSource, setLangSource] = useState<string>('XPHB'); // 语言筛选来源 (默认 2024 玩家手册)
  const [spellSource, setSpellSource] = useState<string>('XPHB'); // 法术筛选来源 (默认 2024 玩家手册)
  const [previewSpellId, setPreviewSpellId] = useState<string | null>(null);
  const [previewFeatId, setPreviewFeatId] = useState<string | null>(null);
  const { characters, activeCharacterId, updateActiveCharacter } = useCharacterStore();
  const searchParams = useSearchParams();
  const charId = searchParams.get('id') || activeCharacterId || '';
  const character = charId ? characters[charId] : null;

  const hasBadges = Boolean(
    trait.features?.resistances ||
    trait.features?.resistanceChoices ||
    trait.features?.spells ||
    trait.action ||
    trait.usage,
  );
  const hasTitle = Boolean(trait.name || (showEn && trait.nameEn));
  const hasHeader = hasTitle || hasBadges;

  return (
    <div className={styles.traitCard}>
      {hasHeader && (
        <div className={styles.traitHeader}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {trait.name ? <span className={styles.traitName}>{trait.name}</span> : null}
            {showEn && trait.nameEn ? (
              <span className={styles.traitNameEn}>{trait.nameEn}</span>
            ) : null}

            <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
              {(trait.features?.resistances || trait.features?.resistanceChoices) && (
                <span
                  style={{
                    fontSize: '10px',
                    background: '#ff3b30',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  抗性
                </span>
              )}
              {trait.features?.spells && (
                <span
                  style={{
                    fontSize: '10px',
                    background: 'var(--color-gold-accent)',
                    color: 'white',
                    padding: '2px 6px',
                    borderRadius: '4px',
                  }}
                >
                  法术
                </span>
              )}
              {trait.action && (
                <span
                  className={styles.usageBadge}
                  style={{ background: 'var(--color-bg-dark)', color: '#86868b' }}
                >
                  {formatActionType(trait.action)}
                </span>
              )}
              {((trait as any).replacesTraitName || trait.overwrite) && (
                <span
                  style={{
                    fontSize: '11px',
                    background: 'rgba(255, 149, 0, 0.12)',
                    border: '1px solid rgba(255, 149, 0, 0.4)',
                    color: '#ff9500',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '3px',
                  }}
                >
                  <span>🔄</span>
                  <span>替换：{(trait as any).replacesTraitName || trait.overwrite}</span>
                </span>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {trait.usage && (
              <span className={styles.usageBadge}>
                {trait.usage.limit === 'Proficiency Bonus' ? '熟练加值' : trait.usage.limit}次 /{' '}
                {trait.usage.recovery === 'Long Rest'
                  ? '长休'
                  : trait.usage.recovery === 'Short Rest'
                    ? '短休'
                    : '休整'}
              </span>
            )}
          </div>
        </div>
      )}

      <div className={styles.traitBody}>
        {trait.description ? (
          <MarkdownText text={trait.description} className={styles.traitPara} variant="clean" />
        ) : null}

        {/* 渲染天生固定赋予的熟练项、抗性或语言（非自选型） */}
        {(() => {
          const fixedSkills = Array.from(
            new Set(
              (trait.features?.skillProficiencies || []).filter(
                (s: any): s is string => typeof s === 'string' && Boolean(s) && s !== 'undefined',
              ),
            ),
          );
          const fixedTools = Array.from(
            new Set(
              (trait.features?.toolProficiencies || []).filter(
                (t: any): t is string => typeof t === 'string' && Boolean(t) && t !== 'undefined',
              ),
            ),
          );
          const fixedLanguages = Array.from(
            new Set(
              (trait.features?.languages || []).filter(
                (l: any): l is string =>
                  typeof l === 'string' &&
                  Boolean(l) &&
                  l.toLowerCase() !== 'other' &&
                  l !== 'undefined',
              ),
            ),
          );
          const fixedResistances = Array.from(
            new Set(
              (trait.features?.resistances || []).filter(
                (r: any): r is string => typeof r === 'string' && Boolean(r),
              ),
            ),
          );

          if (
            fixedSkills.length === 0 &&
            fixedTools.length === 0 &&
            fixedLanguages.length === 0 &&
            fixedResistances.length === 0
          )
            return null;

          return (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginTop: trait.description ? '10px' : '0',
              }}
            >
              {fixedResistances.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                    fontSize: '13px',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <span>伤害抗性：</span>
                  {fixedResistances.map((r: string) => {
                    const label = SPECIES_RESISTANCE_TRANSLATION[r.toLowerCase()] || r;
                    return (
                      <span
                        key={r}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'rgba(255, 59, 48, 0.1)',
                          border: '1px solid rgba(255, 59, 48, 0.3)',
                          fontSize: '12px',
                          fontWeight: 500,
                          color: '#ff3b30',
                        }}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              )}
              {fixedSkills.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                    fontSize: '13px',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <span>天生熟练技能：</span>
                  {fixedSkills.map((s: string) => {
                    const label = translateProficiency(s);
                    if (!label || label === 'undefined' || label === 'null') return null;
                    return (
                      <span
                        key={s}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'var(--color-bg-dark)',
                          border: '1px solid var(--color-border-dark)',
                          fontSize: '12px',
                          fontWeight: 500,
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              )}
              {fixedTools.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                    fontSize: '13px',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <span>天生熟练工具：</span>
                  {fixedTools.map((t: string) => {
                    const label = translateProficiency(t);
                    if (!label || label === 'undefined' || label === 'null') return null;
                    return (
                      <span
                        key={t}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'var(--color-bg-dark)',
                          border: '1px solid var(--color-border-dark)',
                          fontSize: '12px',
                          fontWeight: 500,
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              )}
              {fixedLanguages.length > 0 && (
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    flexWrap: 'wrap',
                    fontSize: '13px',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  <span>掌握语言：</span>
                  {fixedLanguages.map((l: string) => {
                    const label = translateProficiency(l);
                    if (!label || label === 'undefined' || label === 'null') return null;
                    return (
                      <span
                        key={l}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          background: 'var(--color-bg-dark)',
                          border: '1px solid var(--color-border-dark)',
                          fontSize: '12px',
                          fontWeight: 500,
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* 处理技能/工具/语言熟练与伤害抗性选择 */}
        {(() => {
          const skills = trait.features?.skillProficiencies;
          const tools = trait.features?.toolProficiencies;
          const skillTools = trait.features?.skillToolProficiencies;
          const languages = trait.features?.languages;
          const resistanceChoices = trait.features?.resistanceChoices;
          const feats = trait.features?.originFeats;
          const hasSpellChoice = trait.features?.spells?.some(
            (s) => s && typeof s === 'object' && 'numToChoose' in s,
          );
          const spellcastingAbility = trait.features?.spellcastingAbility;

          if (
            !skills &&
            !tools &&
            !skillTools &&
            !languages &&
            !feats &&
            !resistanceChoices &&
            !hasSpellChoice &&
            !spellcastingAbility
          )
            return null;

          const renderPicker = (
            data: any,
            type: 'skill' | 'tool' | 'language' | 'resistance',
            subKey: string,
          ) => {
            if (!data || typeof data !== 'object' || !('numToChoose' in data)) return null;

            // 跳过每日整备项
            if (data.isLongRestChoice) return null;

            const fullKey = traitId.startsWith('sp:')
              ? `${traitId}:${subKey}`
              : `sp:${speciesId}:trait:${traitId}:${subKey}`;
            const currentSelections =
              allSelections?.[fullKey] || allSelections?.[`${traitId}:${subKey}`] || [];

            const isAny = data.options.some((opt: string) => opt.toLowerCase().includes('any'));
            let optionsList = data.options;

            if (isAny) {
              if (type === 'skill') optionsList = ALL_SKILLS;
              else if (type === 'tool') optionsList = choices.getCatalogTools();
            }

            if (type === 'resistance') {
              optionsList = data.options || [];
            }

            // 扎实修复：按 2024 规则，种族页面的自选语言仅能从标准语言表选取（排除已默认拥有的通用语）
            if (type === 'language') {
              const effectiveLangSource =
                langSource !== 'All' &&
                choices
                  .getCatalogLanguages()
                  .some(
                    (l) =>
                      l.type === 'Standard' &&
                      (l.source === langSource ||
                        getSourceDisplayName(l.source || '') === langSource),
                  )
                  ? langSource
                  : 'All';
              optionsList = choices
                .getCatalogLanguages()
                .filter(
                  (l) =>
                    l.type === 'Standard' &&
                    l.id !== 'common' &&
                    (effectiveLangSource === 'All' ||
                      l.source === effectiveLangSource ||
                      getSourceDisplayName(l.source || '') === effectiveLangSource),
                )
                .map((l) => l.id);
            }

            return (
              <div
                key={subKey}
                style={{
                  marginTop: '12px',
                  padding: '12px',
                  background: 'var(--color-bg-dark)',
                  borderRadius: '10px',
                  border: '1px solid #eee',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '8px',
                    flexWrap: 'wrap',
                    gap: '6px',
                  }}
                >
                  <p
                    className={styles.infoLabel}
                    style={{
                      margin: 0,
                      fontSize: '13px',
                      color: 'var(--color-text-primary)',
                      fontWeight: 600,
                    }}
                  >
                    {type === 'resistance'
                      ? '🛡️ '
                      : type === 'skill'
                        ? '🎯 '
                        : type === 'tool'
                          ? '🛠️ '
                          : '💬 '}
                    请选择 {data.numToChoose} 项
                    {type === 'skill'
                      ? '技能'
                      : type === 'tool'
                        ? '工具'
                        : type === 'language'
                          ? '语言'
                          : '伤害抗性'}
                    ：
                  </p>
                  <span
                    style={{
                      fontSize: '12px',
                      color:
                        currentSelections.length === data.numToChoose
                          ? 'var(--color-gold-bright)'
                          : '#ff3b30',
                      fontWeight: 600,
                    }}
                  >
                    {currentSelections.length}/{data.numToChoose}
                  </span>
                </div>
                {type === 'language' && (
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '6px',
                      marginBottom: '12px',
                      paddingBottom: '8px',
                      borderBottom: '1px solid #eee',
                    }}
                  >
                    {(() => {
                      const availableSources = Array.from(
                        new Set(
                          choices
                            .getCatalogLanguages()
                            .filter((l) => l.type === 'Standard')
                            .map((l) => getSourceDisplayName(l.source || 'Unknown')),
                        ),
                      );
                      return ['全部', ...availableSources].map((displayName) => (
                        <PillButton
                          key={displayName}
                          size="sm"
                          variant={
                            (langSource === 'All' && displayName === '全部') ||
                            getSourceDisplayName(langSource) === displayName
                              ? 'primary'
                              : 'outline'
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            if (displayName === '全部') setLangSource('All');
                            else {
                              // 反向寻找第一个匹配该中文名的 source ID
                              const originalId =
                                choices
                                  .getCatalogLanguages()
                                  .find((l) => getSourceDisplayName(l.source || '') === displayName)
                                  ?.source || displayName;
                              setLangSource(originalId);
                            }
                          }}
                        >
                          {displayName}
                        </PillButton>
                      ));
                    })()}
                  </div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {choices.filterOptions(optionsList, type).map((opt: string) => {
                    const label =
                      type === 'resistance'
                        ? SPECIES_RESISTANCE_TRANSLATION[opt.toLowerCase()] || opt
                        : translateProficiency(opt);
                    const isSelected =
                      currentSelections.includes(opt) ||
                      (type === 'resistance' && currentSelections.includes(label));
                    return (
                      <PillButton
                        key={opt}
                        variant={isSelected ? 'primary' : 'outline'}
                        size="sm"
                        onClick={(e) => {
                          e?.stopPropagation(); // 防止触发卡片折叠
                          if (!onSelectionChange) return;
                          const next = isSelected
                            ? currentSelections.filter((v: string) => v !== opt && v !== label)
                            : [...currentSelections, opt].slice(-data.numToChoose);
                          onTraitSelectionChange(fullKey, next);
                        }}
                      >
                        {label}
                      </PillButton>
                    );
                  })}
                </div>
              </div>
            );
          };

          return (
            <div className={styles.proficiencyPickers} onClick={(e) => e.stopPropagation()}>
              {skills?.map((s: string | Selection<string>, idx: number) =>
                renderPicker(s, 'skill', `skill-${idx}`),
              )}
              {tools?.map((t: string | Selection<string>, idx: number) =>
                renderPicker(t, 'tool', `tool-${idx}`),
              )}
              {languages?.map((l: string | Selection<string>, idx: number) =>
                renderPicker(l, 'language', `lang-${idx}`),
              )}
              {resistanceChoices?.map((rc: Selection<string>, idx: number) =>
                renderPicker(rc, 'resistance', `resist-${idx}`),
              )}
              {skillTools?.map((st: Selection<string>, idx: number) => {
                if (!st || typeof st !== 'object' || !('numToChoose' in st)) return null;
                const subKey = `skilltool-${idx}`;
                const fullKey = traitId.startsWith('sp:')
                  ? `${traitId}:${subKey}`
                  : `sp:${speciesId}:trait:${traitId}:${subKey}`;
                const currentSelections =
                  allSelections?.[fullKey] || allSelections?.[`${traitId}:${subKey}`] || [];

                return (
                  <HybridProficiencyPicker
                    key={`trait-hybrid-${idx}`}
                    title={st.name || '技能或工具自选'}
                    numToChoose={st.numToChoose}
                    currentSelected={currentSelections}
                    onChange={(next) => onTraitSelectionChange(fullKey, next)}
                  />
                );
              })}

              {/* 渲染法术选择 */}
              {trait.features?.spells?.map((s: any, idx: number) => {
                if (!s || typeof s !== 'object' || !('numToChoose' in s)) return null;
                if (s.isLongRestChoice) return null;

                const subKey = `spell-${idx}`;
                const fullKey = traitId.startsWith('sp:')
                  ? `${traitId}:${subKey}`
                  : `sp:${speciesId}:trait:${traitId}:${subKey}`;
                const legacySubKey = character?.subspeciesId
                  ? `sp:${speciesId}:sub:${character.subspeciesId}:${subKey}`
                  : '';
                const legacyInnateKey = `sp:${speciesId}:trait:innate-spells:${subKey}`;
                const currentSelections =
                  allSelections?.[fullKey] ||
                  (legacySubKey && allSelections?.[legacySubKey]) ||
                  allSelections?.[legacyInnateKey] ||
                  allSelections?.[`${traitId}:${subKey}`] ||
                  [];

                // 解析过滤器 e.g., "class:wizard;level:0"
                let optionsList = (s.options || [])
                  .map((option: string | InnateSpell) =>
                    typeof option === 'string' ? option : option.spellId,
                  )
                  .filter(Boolean);
                let filteredSpells: any[] = [];

                const allowBrew = Boolean(character?.allowHomebrew);
                if (s.filter) {
                  const filters = s.filter.split(';');
                  let filtered = choices.getCatalogSpells({ allowHomebrew: allowBrew }) as any[];

                  filters.forEach((f: string) => {
                    const [key, val] = f.split(':');
                    if (key === 'class') {
                      const targetClass = translateClass(val.toLowerCase());
                      filtered = filtered.filter((sp: any) =>
                        sp.classes?.some((c: string) => {
                          const normalizedC = translateClass(c);
                          return normalizedC === targetClass;
                        }),
                      );
                    } else if (key === 'level') {
                      const levels = val.split(',').map((v) => parseInt(v.trim()));
                      filtered = filtered.filter((sp: any) => levels.includes(sp.level));
                    } else if (key === 'school') {
                      const schools = val.split(',').map((v) => v.trim().toLowerCase());
                      filtered = filtered.filter((sp: any) =>
                        schools.some((ts) => {
                          const sSchool = (sp.school || '').toLowerCase();
                          if (sSchool === ts) return true;
                          const sZh = translateSpellSchool(sp.school).replace('系', '');
                          const tZh = translateSpellSchool(ts).replace('系', '');
                          return sZh === tZh && sZh !== sp.school;
                        }),
                      );
                    }
                  });
                  if (optionsList.length > 0) {
                    const catalogSpells = choices.getCatalogSpells({ allowHomebrew: allowBrew });
                    optionsList.forEach((id: string) => {
                      if (!filtered.some((sp) => sp.id === id)) {
                        const extra = catalogSpells.find((sp) => sp.id === id);
                        if (extra) filtered.unshift(extra);
                      }
                    });
                  }
                  filteredSpells = filtered;
                  optionsList = filtered.map((sp: any) => sp.id);
                } else if (optionsList.length > 0) {
                  const catalogSpells = choices.getCatalogSpells({ allowHomebrew: allowBrew });
                  filteredSpells = optionsList
                    .map((id: string) => catalogSpells.find((sp) => sp.id === id))
                    .filter(Boolean);
                }

                const defaultSpellId =
                  s.defaultSpellId ||
                  s.options?.[0]?.spellId ||
                  (typeof s.options?.[0] === 'string' ? s.options[0] : undefined);
                const effectiveSelections =
                  currentSelections.length > 0
                    ? currentSelections
                    : defaultSpellId
                      ? [defaultSpellId]
                      : [];

                // 获取当前可选法术的所有来源
                const availableSources = [
                  'All',
                  ...Array.from(new Set(filteredSpells.map((sp) => sp.source))),
                ];

                // 应用来源过滤 (支持回退)
                const effectiveSpellSource =
                  spellSource !== 'All' &&
                  filteredSpells.some(
                    (sp) =>
                      sp.source === spellSource || getSourceDisplayName(sp.source) === spellSource,
                  )
                    ? spellSource
                    : 'All';
                const displaySpells =
                  effectiveSpellSource === 'All'
                    ? filteredSpells
                    : filteredSpells.filter(
                        (sp) =>
                          sp.source === effectiveSpellSource ||
                          getSourceDisplayName(sp.source) === effectiveSpellSource,
                      );

                return (
                  <div
                    key={`spell-${idx}`}
                    style={{
                      marginTop: '12px',
                      padding: '12px',
                      background: 'var(--color-bg-dark)',
                      borderRadius: '10px',
                      border: '1px solid #eee',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        marginBottom: '8px',
                        flexWrap: 'wrap',
                        gap: '6px',
                      }}
                    >
                      <p
                        className={styles.infoLabel}
                        style={{
                          margin: 0,
                          fontSize: '13px',
                          color: 'var(--color-text-primary)',
                          fontWeight: 600,
                        }}
                      >
                        🪄 请选择 {s.numToChoose} 项{s.name || '法术'}：
                      </p>
                      <span
                        style={{
                          fontSize: '12px',
                          color:
                            effectiveSelections.length === s.numToChoose
                              ? 'var(--color-gold-bright)'
                              : '#ff3b30',
                          fontWeight: 600,
                        }}
                      >
                        {effectiveSelections.length}/{s.numToChoose}
                      </span>
                    </div>

                    {/* 来源筛选器与第三方开关 */}
                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '8px',
                        marginBottom: '12px',
                        borderBottom: '1px solid #eee',
                        paddingBottom: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {(() => {
                          const availableSources = Array.from(
                            new Set(filteredSpells.map((sp) => getSourceDisplayName(sp.source))),
                          );
                          return ['全部', ...availableSources].map((displayName) => (
                            <PillButton
                              key={displayName}
                              size="sm"
                              variant={
                                (spellSource === 'All' && displayName === '全部') ||
                                getSourceDisplayName(spellSource) === displayName
                                  ? 'primary'
                                  : 'outline'
                              }
                              onClick={(e) => {
                                e.stopPropagation();
                                if (displayName === '全部') setSpellSource('All');
                                else {
                                  const originalId =
                                    filteredSpells.find(
                                      (sp) => getSourceDisplayName(sp.source) === displayName,
                                    )?.source || displayName;
                                  setSpellSource(originalId);
                                }
                              }}
                            >
                              {displayName}
                            </PillButton>
                          ));
                        })()}
                      </div>
                      <PillButton
                        size="sm"
                        variant={character?.allowHomebrew ? 'primary' : 'outline'}
                        onClick={async (e) => {
                          e.stopPropagation();
                          const nextVal = !character?.allowHomebrew;
                          updateActiveCharacter({ allowHomebrew: nextVal });
                          if (nextVal) {
                            const { loadHomebrewAll } = await import('@/platform/catalogLoader');
                            await loadHomebrewAll();
                          }
                        }}
                      >
                        第三方扩展 / Homebrew: {character?.allowHomebrew ? '已开启' : '已关闭'}
                      </PillButton>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {displaySpells.map((spellInfo: any) => {
                        const optId = spellInfo.id;
                        const isSelected = effectiveSelections.includes(optId);

                        return (
                          <PillButton
                            key={optId}
                            variant={isSelected ? 'primary' : 'outline'}
                            size="sm"
                            onClick={(e) => {
                              e?.stopPropagation();
                              setPreviewSpellId(optId);
                              if (!onSelectionChange) return;
                              const next = isSelected
                                ? effectiveSelections.filter((v: string) => v !== optId)
                                : [...effectiveSelections, optId].slice(-s.numToChoose);
                              onTraitSelectionChange(fullKey, next);
                            }}
                          >
                            {spellInfo.name}{' '}
                            {displaySpells.filter((s: any) => s.name === spellInfo.name).length > 1
                              ? `[${getSourceDisplayName(spellInfo.source)}]`
                              : ''}
                          </PillButton>
                        );
                      })}
                    </div>

                    {/* 法术预览面板 (Master-Detail Pattern) */}
                    {previewSpellId &&
                      (() => {
                        const spell = getSpellDefinition(previewSpellId);
                        if (!spell) return null;
                        return (
                          <div className={styles.previewBox}>
                            <div className={styles.previewHeader}>
                              <div>
                                <span className={styles.previewTitle}>{spell.name}</span>
                                <span className={styles.previewSubtitle}>{spell.nameEn}</span>
                              </div>
                              <span
                                style={{
                                  fontSize: '11px',
                                  color: 'var(--color-gold-accent)',
                                  fontWeight: 600,
                                }}
                              >
                                {getSourceDisplayName(spell.source)}
                              </span>
                            </div>
                            <div className={styles.previewMeta}>
                              <div className={styles.metaItem}>
                                <span className={styles.metaLabel}>等级:</span>{' '}
                                {spell.level === 0 ? '戏法' : `${spell.level} 环`}
                              </div>
                              <div className={styles.metaItem}>
                                <span className={styles.metaLabel}>学派:</span>{' '}
                                {translateSpellSchool(spell.school)}
                              </div>
                              <div className={styles.metaItem}>
                                <span className={styles.metaLabel}>施法时间:</span>{' '}
                                {formatActionType(spell.castingTime)}
                              </div>
                              <div className={styles.metaItem}>
                                <span className={styles.metaLabel}>施法距离:</span>{' '}
                                {formatSpellRange(spell.range)}
                              </div>
                              <div className={styles.metaItem}>
                                <span className={styles.metaLabel}>持续时间:</span>{' '}
                                {formatSpellDuration(spell.duration)}
                              </div>
                              <div className={styles.metaItem}>
                                <span className={styles.metaLabel}>成分:</span>{' '}
                                {formatSpellComponent(spell.components)}
                              </div>
                            </div>
                            <MarkdownText
                              text={spell.description}
                              className={styles.previewDescription}
                              variant="clean"
                            />
                            {spell.higherLevel && (
                              <div
                                style={{
                                  marginTop: '12px',
                                  paddingTop: '12px',
                                  borderTop: '1px dashed rgba(0,0,0,0.1)',
                                  fontSize: '12px',
                                  color: '#424245',
                                }}
                              >
                                <b style={{ color: 'var(--color-text-primary)' }}>升环效应:</b>{' '}
                                {spell.higherLevel}
                              </div>
                            )}
                          </div>
                        );
                      })()}
                  </div>
                );
              })}

              {spellcastingAbility &&
                (() => {
                  const fullKey = traitId.startsWith('sp:')
                    ? `${traitId}:ability`
                    : `sp:${speciesId}:trait:${traitId}:ability`;
                  const legacySubKey = character?.subspeciesId
                    ? `sp:${speciesId}:sub:${character.subspeciesId}:ability`
                    : '';
                  const legacyInnateKey = `sp:${speciesId}:trait:innate-spellcasting-ability`;
                  const selected =
                    allSelections?.[fullKey]?.[0] ||
                    (legacySubKey && allSelections?.[legacySubKey]?.[0]) ||
                    allSelections?.[legacyInnateKey]?.[0] ||
                    '';
                  const abilityLabels: Record<string, string> = {
                    str: '力量',
                    dex: '敏捷',
                    con: '体质',
                    int: '智力',
                    wis: '感知',
                    cha: '魅力',
                  };
                  const isSelected = Boolean(selected);
                  return (
                    <div
                      style={{
                        marginTop: '12px',
                        padding: '12px 14px',
                        background: 'var(--color-bg-dark)',
                        borderRadius: '10px',
                        border: '1px solid var(--color-border-dark)',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '8px',
                          flexWrap: 'wrap',
                          gap: '6px',
                        }}
                      >
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: 600,
                            color: 'var(--color-text-primary)',
                          }}
                        >
                          🔮 请选择 {spellcastingAbility.name || '施法属性'}（任选 1 项）：
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {selected ? (
                            <span
                              style={{
                                fontSize: '12px',
                                color: 'var(--color-gold-accent)',
                                fontWeight: 500,
                              }}
                            >
                              已选: 【{abilityLabels[selected.toLowerCase()] || selected}】
                            </span>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#ff3b30', fontWeight: 500 }}>
                              尚未选择施法属性
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: '12px',
                              color: isSelected ? 'var(--color-gold-bright)' : '#ff3b30',
                              fontWeight: 600,
                            }}
                          >
                            {isSelected ? 1 : 0}/1
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {spellcastingAbility.options.map((ability: string) => {
                          const abLower = ability.toLowerCase();
                          const isChosen =
                            selected.toLowerCase() === abLower || selected === ability;
                          const label = abilityLabels[abLower] || ability;
                          return (
                            <PillButton
                              key={ability}
                              variant={isChosen ? 'primary' : 'outline'}
                              size="sm"
                              onClick={(e) => {
                                e?.stopPropagation();
                                if (!onSelectionChange) return;
                                const next = isChosen ? [] : [ability];
                                onTraitSelectionChange(fullKey, next);
                                if (legacyInnateKey) {
                                  onTraitSelectionChange(legacyInnateKey, next);
                                }
                              }}
                            >
                              {label} ({abLower.toUpperCase()})
                            </PillButton>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}

              {/* 渲染起源专长选择 */}
              {trait.features?.originFeats &&
                (() => {
                  const data = trait.features.originFeats;
                  const currentSelections = selections || [];

                  const isTypeAny = data.filter === 'type:any';
                  const isTypeOrigin =
                    data.filter === 'type:origin' ||
                    (!isTypeAny && (!data.options || data.options.length === 0));
                  const catalogFeats = choices.getCatalogFeats();

                  let baseFeats = catalogFeats;
                  if (data.options && data.options.length > 0) {
                    baseFeats = catalogFeats.filter(
                      (f) =>
                        data.options.includes(f.name) ||
                        data.options.includes(f.id) ||
                        (f.nameEn && data.options.includes(f.nameEn)),
                    );
                  } else if (isTypeOrigin) {
                    baseFeats = catalogFeats.filter((f) => f.category === 'Origin');
                  } else if (isTypeAny) {
                    baseFeats =
                      featCategory === 'All'
                        ? catalogFeats
                        : catalogFeats.filter((f) => f.category === featCategory);
                  }

                  const availableSources = Array.from(
                    new Set(baseFeats.map((f) => getSourceDisplayName(f.source))),
                  ).sort((a, b) => {
                    const wA = getSourceSortWeight(a);
                    const wB = getSourceSortWeight(b);
                    if (wA !== wB) return wA - wB;
                    return a.localeCompare(b, 'zh-Hans-CN');
                  });

                  const effectiveFeatSource =
                    featSource !== 'All' &&
                    baseFeats.some(
                      (f) =>
                        f.source === featSource || getSourceDisplayName(f.source) === featSource,
                    )
                      ? featSource
                      : 'All';
                  const filteredFeats = baseFeats.filter((f) => {
                    if (effectiveFeatSource === 'All') return true;
                    return (
                      f.source === effectiveFeatSource ||
                      getSourceDisplayName(f.source) === effectiveFeatSource
                    );
                  });

                  // 若已选专长不在当前来源筛选结果中，将其追加到前面，确保已选专长始终可见并可反选
                  const selectedExtraFeats = baseFeats.filter(
                    (f) =>
                      currentSelections.includes(f.name) &&
                      !filteredFeats.some(
                        (ff) => ff.id === f.id || (ff.name === f.name && ff.source === f.source),
                      ),
                  );
                  const displayFeats = [...selectedExtraFeats, ...filteredFeats];

                  const categories = [
                    { id: 'All', name: '全部分类 All' },
                    { id: 'General', name: '通用 General' },
                    { id: 'Origin', name: '起源 Origin' },
                    { id: 'Fighting Style', name: '战斗风格 Fighting Style' },
                    { id: 'Epic Boon', name: '史诗恩惠 Epic Boon' },
                  ].filter(
                    (cat) => cat.id === 'All' || catalogFeats.some((f) => f.category === cat.id),
                  );

                  return (
                    <div
                      key="origin-feat"
                      style={{
                        marginTop: '12px',
                        padding: '12px',
                        background: 'var(--color-bg-dark)',
                        borderRadius: '10px',
                        border: '1px solid #eee',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '12px',
                          flexWrap: 'wrap',
                          gap: '6px',
                        }}
                      >
                        <p
                          className={styles.infoLabel}
                          style={{
                            margin: 0,
                            fontSize: '13px',
                            color: 'var(--color-text-primary)',
                            fontWeight: 600,
                          }}
                        >
                          🌟 请选择 {data.numToChoose} 项{isTypeOrigin ? '起源专长' : '专长'}：
                        </p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {currentSelections.length > 0 && (
                            <span
                              style={{
                                fontSize: '12px',
                                color: 'var(--color-gold-accent)',
                                fontWeight: 500,
                              }}
                            >
                              已选: {currentSelections.join('、')}
                            </span>
                          )}
                          <span
                            style={{
                              fontSize: '12px',
                              color:
                                currentSelections.length === data.numToChoose
                                  ? 'var(--color-gold-bright)'
                                  : '#ff3b30',
                              fontWeight: 600,
                            }}
                          >
                            {currentSelections.length}/{data.numToChoose}
                          </span>
                        </div>
                      </div>

                      {/* 分类筛选器 (仅当是 type:any 全类型自选时展示) */}
                      {isTypeAny && (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            gap: '6px',
                            marginBottom: '16px',
                            borderBottom: '1px solid #eee',
                            paddingBottom: '12px',
                          }}
                        >
                          {categories.map((cat) => (
                            <button
                              key={cat.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                setFeatCategory(cat.id);
                              }}
                              style={{
                                padding: '4px 10px',
                                fontSize: '11px',
                                borderRadius: '6px',
                                border: 'none',
                                background:
                                  featCategory === cat.id
                                    ? 'var(--color-gold-accent)'
                                    : 'transparent',
                                color: featCategory === cat.id ? 'white' : '#86868b',
                                cursor: 'pointer',
                                transition: 'all 0.2s',
                              }}
                            >
                              {cat.name}
                            </button>
                          ))}
                        </div>
                      )}

                      {/* 书籍来源筛选器与第三方开关 */}
                      {(isTypeAny || isTypeOrigin || availableSources.length > 1) && (
                        <div
                          style={{
                            display: 'flex',
                            flexWrap: 'wrap',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '8px',
                            marginBottom: '16px',
                            borderBottom: '1px solid #eee',
                            paddingBottom: '12px',
                          }}
                        >
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                            {['全部', ...availableSources].map((displayName) => {
                              const isAll = displayName === '全部';
                              const isSelected =
                                (featSource === 'All' && isAll) ||
                                (!isAll &&
                                  (featSource === displayName ||
                                    getSourceDisplayName(featSource) === displayName));
                              return (
                                <PillButton
                                  key={displayName}
                                  size="sm"
                                  variant={isSelected ? 'primary' : 'outline'}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    if (isAll) setFeatSource('All');
                                    else {
                                      const matched = baseFeats.find(
                                        (f) => getSourceDisplayName(f.source) === displayName,
                                      );
                                      setFeatSource(matched?.source || displayName);
                                    }
                                  }}
                                >
                                  {displayName}
                                </PillButton>
                              );
                            })}
                          </div>
                          <PillButton
                            size="sm"
                            variant={character?.allowHomebrew ? 'primary' : 'outline'}
                            onClick={async (e) => {
                              e.stopPropagation();
                              const nextVal = !character?.allowHomebrew;
                              updateActiveCharacter({ allowHomebrew: nextVal });
                              if (nextVal) {
                                const { loadHomebrewAll } =
                                  await import('@/platform/catalogLoader');
                                await loadHomebrewAll();
                              }
                            }}
                          >
                            {character?.allowHomebrew ? '已启用第三方扩展' : '启用第三方扩展'}
                          </PillButton>
                        </div>
                      )}

                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {displayFeats.map((feat: any) => {
                          const isDuplicate =
                            displayFeats.filter((f: any) => f.name === feat.name).length > 1;
                          const isSelected =
                            currentSelections.includes(feat.name) ||
                            currentSelections.includes(feat.id);
                          const sourceDisplayName = getSourceDisplayName(feat.source);
                          return (
                            <PillButton
                              key={`${feat.id || feat.name}_${feat.source}`}
                              variant={isSelected ? 'primary' : 'outline'}
                              size="sm"
                              onClick={(e) => {
                                e?.stopPropagation();
                                setPreviewFeatId(feat.id || feat.name);
                                if (!onSelectionChange) return;
                                const next = isSelected
                                  ? currentSelections.filter(
                                      (v: string) => v !== feat.name && v !== feat.id,
                                    )
                                  : [...currentSelections, feat.name].slice(-data.numToChoose);
                                onSelectionChange(next);
                              }}
                            >
                              {feat.name}
                              {isDuplicate && (
                                <span
                                  style={{
                                    fontSize: '10px',
                                    color: 'var(--color-gold-accent)',
                                    marginLeft: '4px',
                                    fontWeight: 600,
                                  }}
                                >
                                  [{sourceDisplayName}]
                                </span>
                              )}
                              {feat?.nameEn && (
                                <span style={{ fontSize: '10px', opacity: 0.6, marginLeft: '4px' }}>
                                  {feat.nameEn}
                                </span>
                              )}
                            </PillButton>
                          );
                        })}
                        {displayFeats.length === 0 && (
                          <div style={{ fontSize: '12px', color: '#86868b', padding: '8px' }}>
                            该筛选条件下暂无可用专长
                          </div>
                        )}
                      </div>

                      {/* 专长预览面板 (Feat Preview) */}
                      {previewFeatId &&
                        (() => {
                          const feat = catalogFeats.find(
                            (f) => f.id === previewFeatId || f.name === previewFeatId,
                          );
                          if (!feat) return null;
                          const categoryNames: Record<string, string> = {
                            Origin: '起源专长 Origin',
                            General: '通用专长 General',
                            'Fighting Style': '战斗风格 Fighting Style',
                            Legacy: '经典/旧版专长 Legacy',
                            'Epic Boon': '史诗恩惠 Epic Boon',
                          };
                          const categoryLabel =
                            categoryNames[feat.category] || feat.category || '通用专长';
                          return (
                            <div className={styles.previewBox}>
                              <div className={styles.previewHeader}>
                                <div>
                                  <span className={styles.previewTitle}>{feat.name}</span>
                                  <span className={styles.previewSubtitle}>{feat.nameEn}</span>
                                </div>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      background: 'rgba(0, 113, 227, 0.1)',
                                      color: 'var(--color-apple-blue)',
                                      padding: '2px 8px',
                                      borderRadius: '4px',
                                      fontWeight: 600,
                                    }}
                                  >
                                    {categoryLabel}
                                  </span>
                                  <span
                                    style={{
                                      fontSize: '11px',
                                      color: 'var(--color-gold-accent)',
                                      fontWeight: 600,
                                    }}
                                  >
                                    {getSourceDisplayName(feat.source)}
                                  </span>
                                </div>
                              </div>
                              {feat.prerequisite && (
                                <div
                                  style={{
                                    fontSize: '12px',
                                    color: '#86868b',
                                    marginBottom: '8px',
                                    padding: '4px 8px',
                                    background: 'var(--color-bg-dark)',
                                    borderRadius: '4px',
                                    display: 'inline-block',
                                  }}
                                >
                                  前提: {feat.prerequisite}
                                </div>
                              )}
                              <MarkdownText
                                text={feat.description}
                                className={styles.previewDescription}
                                variant="clean"
                              />
                            </div>
                          );
                        })()}
                    </div>
                  );
                })()}
            </div>
          );
        })()}

        {trait.features?.spells && (
          <TraitSpellList
            spells={trait.features.spells}
            selectedSpellIds={
              allSelections
                ? Object.entries(allSelections)
                    .filter(([k]) => k.includes(':spell-') || k.includes('innate-spells'))
                    .flatMap(([_, v]) => v)
                : []
            }
          />
        )}
        {children}
      </div>
    </div>
  );
};

// 亚种/血系内的法术选择器组件（支持抽象选择项与预设默认法术）
const SubSpeciesSpellChoicePicker = ({
  choice,
  activeSpellId,
  onSelectSpell,
  allowHomebrew,
  onToggleHomebrew,
}: {
  choice: any;
  activeSpellId?: string;
  onSelectSpell: (spellId: string) => void;
  allowHomebrew?: boolean;
  onToggleHomebrew?: () => void;
}) => {
  const choices = useBuilderChoices();
  const [sourceFilter, setSourceFilter] = useState<string>('2024 玩家手册');
  const catalogSpells = useMemo(
    () => choices.getCatalogSpells({ allowHomebrew }),
    [allowHomebrew, choices],
  );

  const candidateSpells = useMemo(() => {
    let list: any[] = [];
    if (choice.filter) {
      const filters = choice.filter.split(';');
      let filtered = [...catalogSpells];
      filters.forEach((f: string) => {
        const [key, val] = f.split(':');
        if (key === 'class') {
          const targetClass = translateClass(val.toLowerCase());
          filtered = filtered.filter((sp: any) =>
            sp.classes?.some((c: string) => translateClass(c) === targetClass),
          );
        } else if (key === 'level') {
          const levels = val.split(',').map((v: string) => parseInt(v.trim()));
          filtered = filtered.filter((sp: any) => levels.includes(sp.level));
        } else if (key === 'school') {
          const schools = val.split(',').map((v: string) => v.trim().toLowerCase());
          filtered = filtered.filter((sp: any) =>
            schools.some((ts: string) => {
              const sSchool = (sp.school || '').toLowerCase();
              if (sSchool === ts) return true;
              const sZh = translateSpellSchool(sp.school).replace('系', '');
              const tZh = translateSpellSchool(ts).replace('系', '');
              return sZh === tZh && sZh !== sp.school;
            }),
          );
        }
      });
      // 保证默认预设法术包含在候选列表中
      const defaultId = choice.defaultSpellId || choice.options?.[0]?.spellId;
      if (defaultId && !filtered.some((sp) => sp.id === defaultId)) {
        const extra = catalogSpells.find((sp) => sp.id === defaultId);
        if (extra) filtered.unshift(extra);
      }
      list = filtered;
    } else if (choice.options && choice.options.length > 0) {
      list = choice.options
        .map((opt: any) => {
          const id = typeof opt === 'string' ? opt : opt.spellId;
          return (
            catalogSpells.find((sp) => sp.id === id) ||
            (typeof opt === 'object'
              ? {
                  id: opt.spellId,
                  name: opt.spellName,
                  nameEn: opt.spellNameEn,
                  level: opt.level,
                  source: 'PHB',
                }
              : undefined)
          );
        })
        .filter(Boolean);
    }
    return list.filter((spell) => choices.allows(spell, ['spell']));
  }, [choice, catalogSpells, choices]);

  const availableSources = useMemo(() => {
    return Array.from(
      new Set(candidateSpells.map((sp) => getSourceDisplayName(sp.source || 'PHB'))),
    ).sort((a, b) => {
      const wA = getSourceSortWeight(a);
      const wB = getSourceSortWeight(b);
      if (wA !== wB) return wA - wB;
      return a.localeCompare(b, 'zh-Hans-CN');
    });
  }, [candidateSpells, choices]);

  const effectiveSourceFilter = useMemo(() => {
    if (sourceFilter === 'All') return 'All';
    if (availableSources.includes(sourceFilter)) return sourceFilter;
    return 'All';
  }, [sourceFilter, availableSources, choices]);

  const displaySpells = useMemo(() => {
    return effectiveSourceFilter === 'All'
      ? candidateSpells
      : candidateSpells.filter((sp) => getSourceDisplayName(sp.source) === effectiveSourceFilter);
  }, [candidateSpells, effectiveSourceFilter, choices]);

  const activeSpell = candidateSpells.find(
    (sp) => sp.id === activeSpellId || sp.name === activeSpellId,
  );

  return (
    <div
      style={{
        padding: '12px 14px',
        background: 'var(--color-bg-dark)',
        borderRadius: '10px',
        border: '1px solid var(--color-border-dark)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
          flexWrap: 'wrap',
          gap: '6px',
        }}
      >
        <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
          🪄 {choice.name || '自选法术'}（请选择 {choice.numToChoose || 1} 项）：
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {activeSpell ? (
            <span style={{ fontSize: '12px', color: 'var(--color-gold-accent)', fontWeight: 500 }}>
              已选: 【{activeSpell.name}】
              {choice.defaultSpellName && activeSpell.name === choice.defaultSpellName
                ? '（默认预设）'
                : '（已自选）'}
            </span>
          ) : (
            <span style={{ fontSize: '12px', color: '#ff3b30', fontWeight: 500 }}>
              尚未选择法术
            </span>
          )}
          <span
            style={{
              fontSize: '12px',
              color: activeSpell ? 'var(--color-gold-bright)' : '#ff3b30',
              fontWeight: 600,
            }}
          >
            {activeSpell ? 1 : 0}/{choice.numToChoose || 1}
          </span>
        </div>
      </div>

      {/* 来源筛选与第三方开关 */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '6px',
          marginBottom: '10px',
          paddingBottom: '8px',
          borderBottom: '1px solid var(--color-border-dark)',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {['全部', ...availableSources].map((displayName) => (
            <PillButton
              key={displayName}
              size="sm"
              variant={
                (effectiveSourceFilter === 'All' && displayName === '全部') ||
                effectiveSourceFilter === displayName
                  ? 'primary'
                  : 'outline'
              }
              onClick={(e) => {
                e.stopPropagation();
                setSourceFilter(displayName === '全部' ? 'All' : displayName);
              }}
            >
              {displayName}
            </PillButton>
          ))}
        </div>
        {onToggleHomebrew && (
          <PillButton
            size="sm"
            variant={allowHomebrew ? 'primary' : 'outline'}
            onClick={(e) => {
              e.stopPropagation();
              onToggleHomebrew();
            }}
          >
            第三方扩展 / Homebrew: {allowHomebrew ? '已开启' : '已关闭'}
          </PillButton>
        )}
      </div>

      {/* 候选法术按钮列表 */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '6px',
          maxHeight: '180px',
          overflowY: 'auto',
          paddingRight: '4px',
        }}
      >
        {displaySpells.map((sp: any) => {
          const isChosen = activeSpell?.id === sp.id || activeSpell?.name === sp.name;
          return (
            <PillButton
              key={sp.id}
              variant={isChosen ? 'primary' : 'outline'}
              size="sm"
              onClick={(e) => {
                e?.stopPropagation();
                onSelectSpell(sp.id);
              }}
            >
              {sp.name}{' '}
              {displaySpells.filter((s: any) => s.name === sp.name).length > 1
                ? `[${getSourceDisplayName(sp.source)}]`
                : ''}
            </PillButton>
          );
        })}
      </div>
    </div>
  );
};

const TraitSpellList = ({
  spells,
  selectedSpellIds = [],
}: {
  spells: (InnateSpell | Selection<InnateSpell>)[];
  selectedSpellIds?: string[];
}) => {
  // 展平法术列表：包括固定法术和选择项中当前选中的法术
  const allSpells = (spells || []).reduce<InnateSpell[]>((acc, s) => {
    if ('numToChoose' in s) {
      if (s.options && s.options.length > 0 && selectedSpellIds.length > 0) {
        const chosen = s.options.filter((opt) => {
          const optId = typeof opt === 'string' ? opt : opt.spellId;
          const optName = typeof opt === 'string' ? opt : opt.spellName;
          return Boolean(
            (optId && selectedSpellIds.includes(optId)) ||
            (optName && selectedSpellIds.includes(optName)),
          );
        });
        if (chosen.length > 0) {
          const mapped: InnateSpell[] = chosen.map((c) =>
            typeof c === 'string'
              ? {
                  spellId: c,
                  spellName: c,
                  spellNameEn: c,
                  level: 0,
                  isPrepared: true,
                  freeCastsPerLongRest: 0,
                  useSpellSlots: true,
                }
              : (c as InnateSpell),
          );
          return [...acc, ...mapped];
        }
      }
      return acc;
    }
    return [...acc, s as InnateSpell];
  }, []);

  // 杜绝同一特质内法术因多重引用重复展示两次
  const uniqueSpells: InnateSpell[] = [];
  const seenSpellKeys = new Set<string>();
  for (const item of allSpells) {
    const key = (item.spellId || item.spellName || '').toLowerCase();
    if (!seenSpellKeys.has(key)) {
      seenSpellKeys.add(key);
      uniqueSpells.push(item);
    }
  }

  if (uniqueSpells.length === 0) return null;

  return (
    <div className={styles.traitSpellList}>
      {uniqueSpells.map((innate, idx) => {
        const catalogSpells = getCatalogSpells();
        const spell =
          getSpellDefinition(innate.spellId) ||
          (innate.spellName ? getSpellDefinition(innate.spellName) : undefined) ||
          (innate.spellNameEn ? getSpellDefinition(innate.spellNameEn) : undefined) ||
          catalogSpells.find(
            (s) =>
              s.id === innate.spellId ||
              s.name === innate.spellName ||
              s.nameEn === innate.spellNameEn,
          );

        if (!spell) {
          return (
            <div key={idx} className={styles.spellItemMini}>
              <span className={styles.spellPrimaryInfo}>
                {innate.level === 0 ? '戏法' : `${innate.level}级`}: {innate.spellName} (
                {innate.spellNameEn})
              </span>
              <span className={styles.spellUsageInfo}>
                {innate.freeCastsPerLongRest === Infinity
                  ? '随意'
                  : innate.freeCastsPerLongRest === 'Proficiency Bonus'
                    ? '熟练加值次/长休'
                    : innate.freeCastsPerLongRest
                      ? `${innate.freeCastsPerLongRest}次/长休`
                      : '按法术规则施展'}
              </span>
            </div>
          );
        }

        return (
          <div key={idx} className={styles.spellCard}>
            <div className={styles.spellCardHeader}>
              <div>
                <span className={styles.previewTitle}>{spell.name}</span>
                <span className={styles.previewSubtitle}>{spell.nameEn}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <span
                  className={styles.usageBadge}
                  style={{ background: 'var(--color-bg-dark)', color: '#86868b' }}
                >
                  {spell.level === 0 ? '戏法' : `${spell.level}环法术`}
                </span>
                {innate.level > 0 && innate.level !== spell.level && (
                  <span
                    className={styles.usageBadge}
                    style={{ background: 'var(--color-bg-dark)', color: '#86868b' }}
                  >
                    {innate.level}级解锁
                  </span>
                )}
                <span className={styles.usageBadge}>
                  {spell.level === 0 || innate.freeCastsPerLongRest === Infinity
                    ? '随意施展'
                    : innate.freeCastsPerLongRest === 'Proficiency Bonus'
                      ? '熟练加值次/长休'
                      : innate.freeCastsPerLongRest
                        ? `${innate.freeCastsPerLongRest}次/长休`
                        : '消耗法术位'}
                </span>
              </div>
            </div>

            <div className={styles.previewMeta}>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>学派:</span> {translateSpellSchool(spell.school)}
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>施法时间:</span>{' '}
                {formatActionType(spell.castingTime)}
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>施法距离:</span> {formatSpellRange(spell.range)}
              </div>
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>持续时间:</span>{' '}
                {formatSpellDuration(spell.duration)}
              </div>
            </div>

            <MarkdownText
              text={spell.description}
              className={styles.previewDescription}
              variant="clean"
            />
          </div>
        );
      })}
    </div>
  );
};

export default function SpeciesPage() {
  const choices = useBuilderChoices();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { characters, updateActiveCharacter, loadCharacter } = useCharacterStore();
  const { stats: catalogStats } = useCatalog();
  const character = id ? characters[id] : null;

  const [pendingTraitOptions, setPendingTraitOptions] = useState<Record<string, string>>({});
  const [isMainDescExpanded, setIsMainDescExpanded] = useState(false);
  const [expandedSources, setExpandedSources] = useState<string[]>(['2024 核心规则 (Core)']);

  const detailsPanelRef = useRef<HTMLDivElement>(null);

  // 切换种族时，自动回滚详情面板到顶部并收起背景描述
  useEffect(() => {
    if (detailsPanelRef.current) {
      detailsPanelRef.current.scrollTop = 0;
    }
    setIsMainDescExpanded(false);
  }, [character?.speciesId, character?.speciesSource]);

  const availableSpecies = useMemo(() => {
    return choices.getCatalogSpecies();
  }, [catalogStats.sources.fiveetoolsCn.entries, catalogStats.sources.homebrew.entries, choices]);

  const selectedSpecies = useMemo(
    () =>
      character
        ? getSpeciesDefinition(character) ||
          availableSpecies.find(
            (s) => s.id === character.speciesId && s.source === character.speciesSource,
          ) ||
          availableSpecies.find((s) => s.id === character.speciesId)
        : undefined,
    [character, availableSpecies, choices],
  );

  // 计算当前种族最终生效的特质列表
  const effectiveTraits = useMemo(() => {
    if (!selectedSpecies) return [];

    const isFlavorTrait = (t: Trait): boolean => {
      const norm = (t.id || t.nameEn || t.name || '').toLowerCase().replace(/[-_\s]+/g, '');
      return (
        ['age', 'alignment', 'size', 'speed', 'heightandweight'].includes(norm) ||
        ['年龄', '阵营', '体型', '速度', '身高体重', '身高与体重'].includes(t.name)
      );
    };

    // 1. 获取基础特质并过滤背景/描述类
    const baseTraits = (selectedSpecies.traits as Trait[]).filter((t: Trait) => {
      const isFlavor = isFlavorTrait(t);
      const isInternal = t.id === 'spellcasting-ability' || t.id === 'innate-spellcasting-ability';
      return !isFlavor && !isInternal;
    });

    // 2. 扎实修复：如果种族有亚种定义，统一将分支选择宿主特质置顶（排在首位）
    let finalBaseTraits = [...baseTraits];
    if (selectedSpecies.subSpecies) {
      const masterIdx = finalBaseTraits.findIndex((t) => t.representsSubSpecies);
      let masterTrait: Trait;
      if (masterIdx >= 0) {
        masterTrait = finalBaseTraits.splice(masterIdx, 1)[0];
      } else {
        const isLegacy = selectedSpecies.source === 'PHB';
        const hostName =
          selectedSpecies.subSpecies.hostTraitName ||
          selectedSpecies.subSpecies.name ||
          (isLegacy ? '亚种' : '分支特性');
        const hostNameEn =
          selectedSpecies.subSpecies.hostTraitNameEn ||
          selectedSpecies.subSpecies.nameEn ||
          (isLegacy ? 'Subrace' : 'Options');
        masterTrait = {
          id: 'subspecies-choice',
          name: hostName,
          nameEn: hostNameEn,
          description:
            selectedSpecies.subSpecies.description ||
            (selectedSpecies.subSpecies.levelRequirement &&
            selectedSpecies.subSpecies.levelRequirement > 1
              ? `此特性为 ${selectedSpecies.subSpecies.levelRequirement} 级进阶特性，建卡阶段可预选偏好形态：`
              : `请选择你的${hostName}：`),
          representsSubSpecies: true,
        };
      }
      finalBaseTraits.unshift(masterTrait);
    }

    // 3. 合并已选亚种的特质
    const selectedSub = selectedSpecies.subSpecies?.options.find((o) => {
      if (!character?.subspeciesId) return false;
      const target = character.subspeciesId.toLowerCase().replace(/[-_\s]+/g, '');
      return (
        o.id === character.subspeciesId ||
        o.id.toLowerCase().replace(/[-_\s]+/g, '') === target ||
        (o.name && o.name.toLowerCase().replace(/[-_\s]+/g, '') === target) ||
        (o.nameEn && o.nameEn.toLowerCase().replace(/[-_\s]+/g, '') === target)
      );
    });
    const rawSubTraits: Trait[] = selectedSub?.traits ? [...selectedSub.traits] : [];
    if (selectedSub?.features) {
      // 严格检查：仅当子特质列表中尚未有任何特质挂载法术时，才考虑挂载顶级 spells，杜绝重复与误挂
      const hasSpellsInTraits = rawSubTraits.some(
        (t) => t.features?.spells && t.features.spells.length > 0,
      );
      if (selectedSub.features.spells && !hasSpellsInTraits) {
        // 先检查母种族特质中是否已经存在包含相同法术的特质（例如 SCAG 提夫林外貌变体冗余声明地狱遗赠法术）
        const baseDuplicateTrait = finalBaseTraits.find((bt) => {
          if (isFlavorTrait(bt) || !bt.features?.spells) return false;
          const existing = new Set(
            (bt.features.spells as any[]).map(
              (s) => (s as any).spellName || (s as any).name || (s as any).id,
            ),
          );
          return (selectedSub.features!.spells as any[]).some((s) =>
            existing.has((s as any).spellName || (s as any).name || (s as any).id),
          );
        });

        if (baseDuplicateTrait) {
          // 母特质已包含完全相同的法术，亚种为兼容冗余声明，直接更新或沿用母特质，杜绝多特质重复展示
          baseDuplicateTrait.features = {
            ...baseDuplicateTrait.features,
            spells: selectedSub.features.spells,
          };
        } else {
          // 优先寻找语义匹配的非风味特质（如包含法术、戏法、灵能）
          const spellHostTrait =
            rawSubTraits.find((t) => {
              if (isFlavorTrait(t)) return false;
              const text = `${t.name} ${t.nameEn || ''} ${t.description || ''}`.toLowerCase();
              return /(法术|戏法|灵能|施法|spells?|cantrip|psionics?|magic)/i.test(text);
            }) || rawSubTraits.find((t) => !isFlavorTrait(t));

          if (spellHostTrait) {
            spellHostTrait.features = {
              ...spellHostTrait.features,
              spells: selectedSub.features.spells,
            };
          } else {
            rawSubTraits.push({
              id: `subspecies-spells-${selectedSub.id}`,
              name: '种族法术',
              nameEn: 'Innate Spells',
              description: '你获得此亚种提供的额外法术。',
              features: { spells: selectedSub.features.spells },
            });
          }
        }
      }

      // 施法属性同样处理：仅当尚未有特质拥有 spellcastingAbility 时，挂载到对应特质上，避开风味条目
      const hasAbilityInTraits = rawSubTraits.some((t) => t.features?.spellcastingAbility);
      if (selectedSub.features.spellcastingAbility && !hasAbilityInTraits) {
        const abilityHostTrait =
          rawSubTraits.find((t) => t.features?.spells && !isFlavorTrait(t)) ||
          rawSubTraits.find((t) => !isFlavorTrait(t));
        if (abilityHostTrait) {
          abilityHostTrait.features = {
            ...abilityHostTrait.features,
            spellcastingAbility: selectedSub.features.spellcastingAbility,
          };
        }
      }

      // 抗性同样处理：仅当尚未有特质拥有 resistances 时挂载，避开风味条目
      const hasResistInTraits = rawSubTraits.some(
        (t) => t.features?.resistances && t.features.resistances.length > 0,
      );
      if (selectedSub.features.resistances && !hasResistInTraits) {
        const resistHostTrait =
          rawSubTraits.find((t) => {
            if (isFlavorTrait(t)) return false;
            const text = `${t.name} ${t.nameEn || ''} ${t.description || ''}`.toLowerCase();
            return /(抗性|耐性|resistance)/i.test(text);
          }) || rawSubTraits.find((t) => !isFlavorTrait(t));
        if (resistHostTrait) {
          resistHostTrait.features = {
            ...resistHostTrait.features,
            resistances: selectedSub.features.resistances,
          };
        }
      }
    }

    const subTraits = rawSubTraits.filter((st) => {
      // 过滤无机制 options/features 的纯风味特质（如阵营、年龄、体型等，与基础种族过滤保持一致）
      if (
        isFlavorTrait(st) &&
        (!st.features || Object.keys(st.features).length === 0) &&
        (!st.options || st.options.length === 0)
      ) {
        return false;
      }
      // 纯占位无正文且无 options/features 的特质过滤
      const hasContent = Boolean(st.description && st.description.trim());
      const hasOptions = Boolean(st.options && st.options.length > 0);
      const hasFeatures = Boolean(st.features && Object.keys(st.features).length > 0);
      return hasContent || hasOptions || hasFeatures;
    });

    const normKey = (t: Trait) =>
      (t.id || t.nameEn || t.name || '').toLowerCase().replace(/[-_\s]+/g, '');
    const unmergedSubTraits: Trait[] = [];
    subTraits.forEach((st) => {
      const stKey = normKey(st);
      const rawOverwrite = st.overwrite?.trim();
      const overwriteNorm = rawOverwrite ? rawOverwrite.toLowerCase().replace(/[-_\s]+/g, '') : '';
      // 检查母特质中是否已经存在同名特质、被 overwrite 覆盖的特质，或者包含相同法术的特质
      // representsSubSpecies 宿主特质：禁止纯名称匹配（防止意外覆盖），但允许显式 overwrite 匹配
      // overwrite 已在 lineageChoices 层规范化为 change.replace，语义明确，可安全命中宿主特质
      let matchIdx = finalBaseTraits.findIndex((bt) => {
        const btKey = normKey(bt);
        const btName = (bt.name || '').toLowerCase().replace(/[-_\s]+/g, '');
        const btNameEn = (bt.nameEn || '').toLowerCase().replace(/[-_\s]+/g, '');

        const nameMatches =
          !bt.representsSubSpecies &&
          (btKey === stKey ||
            (bt.name && st.name && bt.name.toLowerCase() === st.name.toLowerCase()) ||
            (bt.nameEn && st.nameEn && bt.nameEn.toLowerCase() === st.nameEn.toLowerCase()));
        const overwriteMatches =
          overwriteNorm && rawOverwrite
            ? btName === overwriteNorm ||
              (btNameEn && btNameEn === overwriteNorm) ||
              btKey === overwriteNorm ||
              (bt.name && bt.name.toLowerCase() === rawOverwrite.toLowerCase()) ||
              (bt.nameEn && bt.nameEn.toLowerCase() === rawOverwrite.toLowerCase())
            : false;
        return nameMatches || overwriteMatches;
      });

      // 如果未按名称/overwrite命中，但该特质包含法术，且母特质已有特质包含相同法术（如 SCAG 变体冗余声明），则命中该母特质
      // 注意：排除 representsSubSpecies 宿主特质，法术重叠匹配不应触碰宿主卡片（否则会丢失选择器标志）
      if (matchIdx < 0 && st.features?.spells && st.features.spells.length > 0) {
        matchIdx = finalBaseTraits.findIndex((bt) => {
          if (
            isFlavorTrait(bt) ||
            bt.representsSubSpecies ||
            !bt.features?.spells ||
            bt.features.spells.length === 0
          )
            return false;
          const existing = new Set(
            (bt.features.spells as any[]).map(
              (s) => (s as any).spellName || (s as any).name || (s as any).id,
            ),
          );
          return (st.features!.spells as any[]).some((s) =>
            existing.has((s as any).spellName || (s as any).name || (s as any).id),
          );
        });
      }

      if (matchIdx >= 0) {
        const replacedBt = finalBaseTraits[matchIdx];
        // 如果亚种特质是占位性的“种族法术”，且母特质已经有具体名称（如“地狱遗赠”），保留母特质名称并更新法术
        if (
          (st.id === 'innate-spells' || st.name === '种族法术') &&
          replacedBt.name !== '种族法术'
        ) {
          finalBaseTraits[matchIdx] = {
            ...replacedBt,
            // representsSubSpecies 已在 replacedBt 中，spread 保留，无需单独处理
            features: {
              ...(replacedBt.features || {}),
              spells: st.features?.spells || replacedBt.features?.spells,
            },
          };
        } else {
          // 亚种变体特质替代母特质：记录被替代的母特质名称以供微标直观呈现
          // 关键：若被替代的母特质是 representsSubSpecies 宿主（如“地狱遗赠”），
          // 必须将该标志透传给替换后的特质，否则亚种选择器 UI 会从特质列表消失
          finalBaseTraits[matchIdx] = {
            ...st,
            replacesTraitName: replacedBt.name || rawOverwrite,
            ...(replacedBt.representsSubSpecies ? { representsSubSpecies: true } : {}),
          };
        }
      } else {
        // 亚种特有的独立特质（如灰矮人抗力、岩石侏儒修补匠等增量特性）
        // 统一作为标准特质卡片追加展示，确保规则呈现完整且排版一致
        unmergedSubTraits.push(st);
      }
    });

    // 动态同步亚种抗性到母种族的【伤害抗性】卡片（如龙裔各龙种、提夫林各遗赠等）
    if (selectedSub?.features?.resistances && selectedSub.features.resistances.length > 0) {
      const resistIdx = finalBaseTraits.findIndex(
        (t) =>
          t.id === 'damage-resistance' ||
          t.name === '伤害抗性' ||
          (t.nameEn && t.nameEn.toLowerCase() === 'damage resistance'),
      );
      if (resistIdx >= 0) {
        finalBaseTraits[resistIdx] = {
          ...finalBaseTraits[resistIdx],
          features: {
            ...(finalBaseTraits[resistIdx].features || {}),
            resistances: selectedSub.features.resistances,
          },
        };
      }
    }

    // 4. 种族属性值提升 (Unified Ability Score Increase / ASI)
    // 统一总开关管理：无论固定加成来自母种族还是亚种，或者自选属性，全部汇总为单一的【属性值加成】核心特质

    // 提取所有固定属性加成 (遵循 overwrite.ability 规则)
    const combinedFixed: Record<string, number> = {};
    const shouldOverwriteAbility = Boolean(selectedSub?.overwrite?.ability);

    if (!shouldOverwriteAbility && selectedSpecies.abilityScoreIncrease) {
      Object.entries(selectedSpecies.abilityScoreIncrease).forEach(([k, v]) => {
        if (typeof v === 'number' && v !== 0) {
          const lk = k.toLowerCase();
          combinedFixed[lk] = (combinedFixed[lk] || 0) + v;
        }
      });
    }
    if (selectedSub?.abilityScoreIncrease) {
      Object.entries(selectedSub.abilityScoreIncrease).forEach(([k, v]) => {
        if (typeof v === 'number' && v !== 0) {
          const lk = k.toLowerCase();
          combinedFixed[lk] = (combinedFixed[lk] || 0) + v;
        }
      });
    }

    // 提取所有自选属性加成 (遵循 overwrite.ability 规则)
    const allAbilityChoices = [
      ...(!shouldOverwriteAbility ? selectedSpecies.abilityChoices || [] : []),
      ...(selectedSub?.abilityChoices || []),
    ];

    // 检查并过滤掉 finalBaseTraits 和 unmergedSubTraits 中分散的既有 ASI 特质（防止重复多张卡片）
    const isASITraitPredicate = (t: Trait) =>
      t.id === 'ability-score-increase' ||
      t.id === 'v-human-asi' ||
      t.id?.startsWith('ability-score-increase') ||
      t.name === '属性值加成' ||
      t.name.includes('属性值加成') ||
      t.name.includes('属性值提升') ||
      (t.nameEn && t.nameEn.toLowerCase().includes('ability score increase'));

    let existingDesc = '';
    finalBaseTraits = finalBaseTraits.filter((t) => {
      if (isASITraitPredicate(t)) {
        if (!existingDesc && t.description) existingDesc = t.description;
        return false;
      }
      return true;
    });

    const filteredSubTraits: Trait[] = [];
    unmergedSubTraits.forEach((t) => {
      if (isASITraitPredicate(t)) {
        if (!existingDesc && t.description) existingDesc = t.description;
      } else {
        filteredSubTraits.push(t);
      }
    });

    const statNameMap: Record<string, string> = {
      str: '力量',
      dex: '敏捷',
      con: '体质',
      int: '智力',
      wis: '感知',
      cha: '魅力',
    };
    const statNameEnMap: Record<string, string> = {
      str: 'Strength',
      dex: 'Dexterity',
      con: 'Constitution',
      int: 'Intelligence',
      wis: 'Wisdom',
      cha: 'Charisma',
    };

    const hasFixedASI = Object.keys(combinedFixed).length > 0;
    const hasChoiceASI = allAbilityChoices.length > 0;
    const hasAnyASI = hasFixedASI || hasChoiceASI || !!existingDesc;

    if (hasAnyASI) {
      const fixedSummaryList = Object.entries(combinedFixed).map(([k, v]) => {
        const zh = statNameMap[k] || k.toUpperCase();
        return `${zh} +${v}`;
      });

      let asiDescription = '';
      if (fixedSummaryList.length > 0) {
        asiDescription = `你的属性值得到以下提升：${fixedSummaryList.join('，')}。`;
      }
      if (hasChoiceASI) {
        const choiceTexts = allAbilityChoices.map(
          (c) => `请选择 ${c.count || 1} 项不同属性值增加 +${c.amount || 1}`,
        );
        asiDescription = asiDescription
          ? `${asiDescription}\n\n此外，${choiceTexts.join('；')}：`
          : `${choiceTexts.join('；')}：`;
      } else if (!fixedSummaryList.length && existingDesc) {
        asiDescription = existingDesc;
      }

      let choiceOptions: Trait[] | undefined = undefined;
      let totalNumToChoose: number | undefined = undefined;

      if (hasChoiceASI) {
        const firstChoice = allAbilityChoices[0];
        const count = firstChoice.count || 1;
        const amount = firstChoice.amount || 1;
        totalNumToChoose = count;
        choiceOptions = firstChoice.from.map((k) => {
          const zh = statNameMap[k.toLowerCase()] || k.toUpperCase();
          const en = statNameEnMap[k.toLowerCase()] || k;
          return {
            name: `${zh} (+${amount})`,
            nameEn: `${en} (+${amount})`,
            description: `增加 ${zh} 属性值 +${amount}。`,
          };
        });
      }

      finalBaseTraits.unshift({
        id: 'ability-score-increase',
        name: '属性值加成',
        nameEn: 'Ability Score Increase',
        description: asiDescription,
        numToChoose: totalNumToChoose,
        options: choiceOptions,
        features: {
          abilityScoreIncrease: combinedFixed,
        },
      });
    }

    const merged = [...finalBaseTraits, ...filteredSubTraits];
    const seenKeys = new Set<string>();
    const deduplicated: Trait[] = [];
    for (const t of merged) {
      const k = normKey(t);
      if (!seenKeys.has(k)) {
        seenKeys.add(k);
        deduplicated.push(t);
      }
    }
    return deduplicated;
  }, [selectedSpecies, character?.subspeciesId, choices]);

  // 计算最终生效的感官 (考虑亚种/特质带来的 senseUpgrade)
  const effectiveSenses = useMemo(() => {
    if (!selectedSpecies) return null;
    const senses = { ...selectedSpecies.senses };

    const selectedSub = selectedSpecies.subSpecies?.options.find((o) => {
      if (!character?.subspeciesId) return false;
      const target = character.subspeciesId.toLowerCase().replace(/[-_\s]+/g, '');
      return (
        o.id === character.subspeciesId ||
        o.id.toLowerCase().replace(/[-_\s]+/g, '') === target ||
        (o.name && o.name.toLowerCase().replace(/[-_\s]+/g, '') === target) ||
        (o.nameEn && o.nameEn.toLowerCase().replace(/[-_\s]+/g, '') === target)
      );
    });

    if (selectedSub?.features?.senseUpgrade) {
      Object.entries(selectedSub.features.senseUpgrade).forEach(([key, val]) => {
        if (val !== undefined) {
          const current = (senses as any)[key] || 0;
          (senses as any)[key] = Math.max(current, val);
        }
      });
    }

    effectiveTraits.forEach((trait) => {
      if (trait.features?.senseUpgrade) {
        Object.entries(trait.features.senseUpgrade).forEach(([key, val]) => {
          if (val !== undefined) {
            const current = (senses as any)[key] || 0;
            (senses as any)[key] = Math.max(current, val);
          }
        });
      }
    });
    return senses;
  }, [selectedSpecies, effectiveTraits, character?.subspeciesId, choices]);

  // 计算最终生效的速度 (考虑亚种/特质带来的 speedBonus)
  const effectiveSpeed = useMemo(() => {
    if (!selectedSpecies) return 0;
    let speed = selectedSpecies.speed;

    const selectedSub = selectedSpecies.subSpecies?.options.find((o) => {
      if (!character?.subspeciesId) return false;
      const target = character.subspeciesId.toLowerCase().replace(/[-_\s]+/g, '');
      return (
        o.id === character.subspeciesId ||
        o.id.toLowerCase().replace(/[-_\s]+/g, '') === target ||
        (o.name && o.name.toLowerCase().replace(/[-_\s]+/g, '') === target) ||
        (o.nameEn && o.nameEn.toLowerCase().replace(/[-_\s]+/g, '') === target)
      );
    });

    let appliedBonus = 0;
    if (selectedSub?.features?.speedBonus) {
      appliedBonus = Math.max(appliedBonus, selectedSub.features.speedBonus);
    }
    effectiveTraits.forEach((trait) => {
      if (trait.features?.speedBonus) {
        appliedBonus = Math.max(appliedBonus, trait.features.speedBonus);
      }
    });
    return speed + appliedBonus;
  }, [selectedSpecies, effectiveTraits, character?.subspeciesId, choices]);

  const availableSources = useMemo(() => {
    return Array.from(new Set(availableSpecies.map((s) => s.source))).sort((a, b) => {
      const wA = getSourceSortWeight(a);
      const wB = getSourceSortWeight(b);
      if (wA !== wB) return wA - wB;
      return a.localeCompare(b);
    });
  }, [availableSpecies, choices]);

  if (!character) return <div className={styles.emptyState}>加载中...</div>;

  const toggleGroup = (groupName: string) => {
    setExpandedSources((prev) =>
      prev.includes(groupName) ? prev.filter((g) => g !== groupName) : [...prev, groupName],
    );
  };

  const handleSelectSpecies = (species: Species) => {
    // 切换种族时，彻底清理所有相关状态，确保数据纯净
    updateActiveCharacter({
      speciesId: species.id,
      speciesSource: species.source,
      subspeciesId: undefined,
      speciesSelections: {}, // 清空所有特质选择
    });
    setPendingTraitOptions({}); // 清空临时选择
  };

  const handleSelectSubspecies = (subId: string) => {
    updateActiveCharacter({
      subspeciesId: subId,
      speciesSelections: Object.fromEntries(
        Object.entries(character.speciesSelections || {}).filter(([key]) => {
          const subTraits =
            selectedSpecies?.subSpecies?.options.flatMap((option) => option.traits) || [];
          return !subTraits.some(
            (trait) =>
              key === `sp:${selectedSpecies?.id}:trait:${trait.id || trait.name}` ||
              key.startsWith(`sp:${selectedSpecies?.id}:trait:${trait.id || trait.name}:`),
          );
        }),
      ),
    });
    setPendingTraitOptions({});
  };

  const handleTraitSelectionChange = (traitId: string, options: string[]) => {
    updateActiveCharacter({
      speciesSelections: { ...(character.speciesSelections || {}), [traitId]: options },
    });
  };

  // 辅助函数：渲染单个特质的内容
  const renderTraitContent = (rawTrait: Trait, traitIndex: number = 0) => {
    let trait = rawTrait;
    const isLineageMaster = rawTrait.representsSubSpecies && selectedSpecies?.subSpecies;
    const isASI =
      trait.id === 'ability-score-increase' ||
      trait.id === 'v-human-asi' ||
      (trait.id && trait.id.startsWith('ability-score-increase')) ||
      trait.name === '属性值加成' ||
      trait.name.includes('属性值加成');
    const asiEnabled = character.useSpeciesASI !== false;
    const traitId = trait.id || trait.name;

    // 辅助函数：渲染 ASI 开关与固定加成徽章
    const renderASISwitch = () => (
      <div
        style={{
          marginTop: '16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: 'var(--color-bg-dark)',
          borderRadius: '10px',
          border: '1px solid var(--color-border-dark)',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: 500 }}>
            是否应用种族属性加值？
          </span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>
            当前已开启：种族与亚种加值将计入角色总属性
          </span>
        </div>
        <div
          onClick={() => updateActiveCharacter({ useSpeciesASI: false })}
          style={{
            width: '44px',
            height: '24px',
            borderRadius: '12px',
            background: '#34c759',
            position: 'relative',
            cursor: 'pointer',
            transition: 'background 0.3s',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: '20px',
              height: '20px',
              background: '#ffffff',
              borderRadius: '50%',
              position: 'absolute',
              top: '2px',
              left: '22px',
              transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
            }}
          />
        </div>
      </div>
    );

    const renderASIBadges = () => {
      const fixed = trait.features?.abilityScoreIncrease;
      if (!fixed || Object.keys(fixed).length === 0) return null;
      const statMap: Record<string, string> = {
        str: '力量',
        dex: '敏捷',
        con: '体质',
        int: '智力',
        wis: '感知',
        cha: '魅力',
      };
      return (
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
          {Object.entries(fixed).map(([k, v]) => (
            <span
              key={k}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                padding: '4px 10px',
                background: 'rgba(52, 199, 89, 0.12)',
                border: '1px solid rgba(52, 199, 89, 0.3)',
                borderRadius: '6px',
                color: '#34c759',
                fontSize: '12px',
                fontWeight: 600,
              }}
            >
              <span>📈</span>
              <span>{statMap[k] || k.toUpperCase()}</span>
              <span>+{String(v)}</span>
            </span>
          ))}
        </div>
      );
    };

    // 当关闭种族属性加值时，将 ASI 条目直接缩略为单行标题 + 开关，节省视觉空间
    if (isASI && !asiEnabled) {
      return (
        <div
          key={`sp:${selectedSpecies?.id}:asi:${trait.id || trait.name}:${traitIndex}`}
          className={styles.traitCard}
          style={{
            padding: '14px 20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'var(--color-bg-dark)',
            border: '1px solid var(--color-border-dark)',
            borderRadius: '12px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className={styles.traitName}>{trait.name}</span>
              {trait.nameEn && <span className={styles.traitNameEn}>{trait.nameEn}</span>}
              <span
                style={{
                  fontSize: '11px',
                  color: 'var(--color-text-secondary)',
                  background: 'rgba(255, 255, 255, 0.08)',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  fontWeight: 500,
                }}
              >
                已关闭加成
              </span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
              所有种族属性加值已关闭，不参与角色属性值计算
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span
              style={{ fontSize: '13px', color: 'var(--color-text-secondary)', fontWeight: 500 }}
            >
              是否应用种族属性加值？
            </span>
            <div
              onClick={() => updateActiveCharacter({ useSpeciesASI: true })}
              style={{
                width: '44px',
                height: '24px',
                borderRadius: '12px',
                background: 'rgba(120, 120, 128, 0.32)',
                position: 'relative',
                cursor: 'pointer',
                transition: 'background 0.3s',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  width: '20px',
                  height: '20px',
                  background: '#ffffff',
                  borderRadius: '50%',
                  position: 'absolute',
                  top: '2px',
                  left: '2px',
                  transition: 'left 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
              />
            </div>
          </div>
        </div>
      );
    }

    // 1. 处理亚种/变体选择器 (Lineage)
    if (isLineageMaster) {
      const sub = selectedSpecies!.subSpecies!;
      const selectedSub = sub.options.find((o) => {
        if (!character.subspeciesId) return false;
        const target = character.subspeciesId.toLowerCase().replace(/[-_\s]+/g, '');
        return (
          o.id === character.subspeciesId ||
          o.id.toLowerCase().replace(/[-_\s]+/g, '') === target ||
          (o.name && o.name.toLowerCase().replace(/[-_\s]+/g, '') === target) ||
          (o.nameEn && o.nameEn.toLowerCase().replace(/[-_\s]+/g, '') === target)
        );
      });

      const desc = rawTrait.description || '';
      const tableMatch = desc.match(/(\|[\s\S]*\|)/);
      let introDesc = desc;
      let tableContent = '';
      if (tableMatch) {
        tableContent = tableMatch[0];
        introDesc = desc.replace(tableMatch[0], '').trim();
      }

      const hostName = rawTrait.name || sub.hostTraitName || sub.name || '分支特性';
      const hostNameEn = rawTrait.nameEn || sub.hostTraitNameEn || sub.nameEn || 'Options';
      trait = {
        ...rawTrait,
        name: hostName,
        nameEn: hostNameEn,
        description: introDesc,
      };

      return (
        <TraitItem
          key={`sp:${selectedSpecies?.id}:lineage:${trait.id || trait.name}:${traitIndex}`}
          trait={trait}
          traitId={`sp:${selectedSpecies?.id}:trait:${traitId}`}
          allSelections={character.speciesSelections || {}}
          onTraitSelectionChange={handleTraitSelectionChange}
          selections={
            character.speciesSelections?.[`sp:${selectedSpecies?.id}:trait:${traitId}`] || []
          }
          onSelectionChange={(next: string[]) =>
            handleTraitSelectionChange(`sp:${selectedSpecies?.id}:trait:${traitId}`, next)
          }
          speciesId={selectedSpecies?.id || ''}
        >
          {tableContent && (
            <details className={styles.tableAccordion}>
              <summary className={styles.tableSummaryBtn}>
                📋 查看全部血系/遗赠全览对照表（点击展开/收起）
              </summary>
              <div style={{ marginTop: '10px' }}>
                <MarkdownText text={tableContent} variant="clean" />
              </div>
            </details>
          )}

          {renderSubSpeciesList(selectedSpecies!)}
        </TraitItem>
      );
    }

    // 2. 处理带有选择项特质 (Options)
    if (trait.options && trait.options.length > 0) {
      const numToChoose = trait.numToChoose || 0;
      const fullTraitId = `sp:${selectedSpecies?.id}:trait:${traitId}`;
      const selectedValues =
        character.speciesSelections?.[fullTraitId] || character.speciesSelections?.[traitId] || [];
      const hasDescription = trait.options.some((opt) => opt.description);
      const isSimpleOptions = trait.options.every(
        (opt) => !opt.description || opt.description.length < 80,
      );

      return (
        <TraitItem
          key={`sp:${selectedSpecies?.id}:opt:${traitId}:${traitIndex}`}
          trait={trait}
          traitId={fullTraitId}
          allSelections={character.speciesSelections || {}}
          onTraitSelectionChange={handleTraitSelectionChange}
          selections={selectedValues}
          onSelectionChange={(next: string[]) => handleTraitSelectionChange(fullTraitId, next)}
          speciesId={selectedSpecies?.id || ''}
        >
          {isASI && renderASIBadges()}
          {numToChoose > 0 && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginTop: '12px',
                marginBottom: '8px',
                padding: '0 4px',
              }}
            >
              <span
                style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}
              >
                请选择 {numToChoose} 项：
              </span>
              <span
                style={{
                  fontSize: '12px',
                  color:
                    selectedValues.length === numToChoose ? 'var(--color-gold-bright)' : '#ff3b30',
                  fontWeight: 600,
                }}
              >
                {selectedValues.length}/{numToChoose}
              </span>
            </div>
          )}
          <div
            className={isSimpleOptions && hasDescription ? styles.lineageGrid : styles.lineageList}
            style={{ marginTop: numToChoose > 0 ? '8px' : '16px' }}
          >
            {trait.options.map((opt) => {
              const isSelected = selectedValues.includes(opt.name);
              const canSelect = numToChoose > 0;

              if (hasDescription) {
                return (
                  <div
                    key={opt.name}
                    className={`${styles.lineageItem} ${isSelected ? styles.lineageItemActive : ''} ${isSimpleOptions ? styles.lineageItemCompact : ''}`}
                    style={!canSelect ? { cursor: 'default' } : {}}
                    onClick={() => {
                      if (!canSelect) return;
                      const fullTraitId = `sp:${selectedSpecies?.id}:trait:${traitId}`;
                      const next = isSelected
                        ? selectedValues.filter((v: string) => v !== opt.name)
                        : [...selectedValues, opt.name].slice(-numToChoose);
                      handleTraitSelectionChange(fullTraitId, next);
                    }}
                  >
                    <div className={styles.lineageHeader}>
                      <div className={styles.lineageRadio}>
                        {isSelected && <div className={styles.lineageRadioInner} />}
                      </div>
                      <div className={styles.lineageName}>
                        {opt.name} <span className={styles.lineageNameEn}>{opt.nameEn}</span>
                      </div>
                      <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                        {opt.action && (
                          <span
                            className={styles.usageBadge}
                            style={{
                              background: 'rgba(255,255,255,0.06)',
                              color: 'var(--color-text-secondary)',
                            }}
                          >
                            {formatActionType(opt.action)}
                          </span>
                        )}
                        {opt.usage && (
                          <span className={styles.usageBadge}>
                            {opt.usage.limit === 'Proficiency Bonus' ? '熟练加值' : opt.usage.limit}
                            次 /{' '}
                            {opt.usage.recovery === 'Long Rest'
                              ? '长休'
                              : opt.usage.recovery === 'Short Rest'
                                ? '短休'
                                : '休整'}
                          </span>
                        )}
                      </div>
                    </div>
                    {(() => {
                      const resMatch = opt.description
                        ? opt.description.match(/(?:获得对|具有)([^，。]+?伤害)的抗性/)
                        : null;
                      const resText = resMatch ? resMatch[1].replace(/伤害$/, '') : '';
                      if (!resText) return null;
                      return (
                        <div style={{ marginBottom: '8px' }}>
                          <span className={styles.resistanceHighlightBadge}>
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2.5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                            </svg>
                            <span>【伤害抗性】</span>
                            <strong>{resText}伤害抗性</strong>
                          </span>
                        </div>
                      );
                    })()}
                    {opt.description && (
                      <MarkdownText
                        text={opt.description}
                        className={styles.lineageDesc}
                        variant="clean"
                      />
                    )}
                  </div>
                );
              }

              return (
                <PillButton
                  key={opt.name}
                  variant={isSelected ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => {
                    if (!canSelect) return;
                    const fullTraitId = `sp:${selectedSpecies?.id}:trait:${traitId}`;
                    const next = isSelected
                      ? selectedValues.filter((v: string) => v !== opt.name)
                      : [...selectedValues, opt.name].slice(-numToChoose);
                    handleTraitSelectionChange(fullTraitId, next);
                  }}
                >
                  {opt.name}
                </PillButton>
              );
            })}
          </div>

          {isASI && renderASISwitch()}
        </TraitItem>
      );
    }

    // 3. 默认渲染逻辑 (普通特质 + ASI 开关)
    return (
      <TraitItem
        key={`sp:${selectedSpecies?.id}:trait:${traitId}:${traitIndex}`}
        trait={trait}
        traitId={`sp:${selectedSpecies?.id}:trait:${traitId}`}
        allSelections={character.speciesSelections || {}}
        onTraitSelectionChange={handleTraitSelectionChange}
        selections={
          character.speciesSelections?.[`sp:${selectedSpecies?.id}:trait:${traitId}`] || []
        }
        onSelectionChange={(next: string[]) =>
          handleTraitSelectionChange(`sp:${selectedSpecies?.id}:trait:${traitId}`, next)
        }
        speciesId={selectedSpecies?.id || ''}
      >
        {isASI && renderASIBadges()}
        {isASI && renderASISwitch()}
      </TraitItem>
    );
  };

  const handleConfirmTraitOption = (traitId: string) => {
    const option = pendingTraitOptions[traitId];
    if (option) {
      handleTraitSelectionChange(traitId, [option]);
      setPendingTraitOptions((prev: Record<string, string>) => {
        const next = { ...prev };
        delete next[traitId];
        return next;
      });
    }
  };

  const renderSubSpeciesList = (species: Species) => {
    const sub = species.subSpecies;
    if (!sub) return null;

    const selections = character.subspeciesId ? [character.subspeciesId] : [];
    const selectedSub = sub.options.find((o) => {
      if (!character.subspeciesId) return false;
      const target = character.subspeciesId.toLowerCase().replace(/[-_\s]+/g, '');
      return (
        o.id === character.subspeciesId ||
        o.id.toLowerCase().replace(/[-_\s]+/g, '') === target ||
        (o.name && o.name.toLowerCase().replace(/[-_\s]+/g, '') === target) ||
        (o.nameEn && o.nameEn.toLowerCase().replace(/[-_\s]+/g, '') === target)
      );
    });

    // 按书籍来源对亚种选项进行分组聚合
    const sourceMap = new Map<string, SubSpecies[]>();
    choices.filterNested(sub.options, species.id).forEach((opt) => {
      const src = (opt.source || species.source || 'PHB').toUpperCase();
      if (!sourceMap.has(src)) {
        sourceMap.set(src, []);
      }
      sourceMap.get(src)!.push(opt);
    });

    // 统一书籍优先级；同优先级内优先当前母种族出处。
    const sortedSources = Array.from(sourceMap.keys()).sort((a, b) => {
      const aIsCore = a === (species.source || 'PHB').toUpperCase();
      const bIsCore = b === (species.source || 'PHB').toUpperCase();
      const wA = getSourceSortWeight(a);
      const wB = getSourceSortWeight(b);
      if (wA !== wB) return wA - wB;
      if (aIsCore && !bIsCore) return -1;
      if (!aIsCore && bIsCore) return 1;
      return a.localeCompare(b);
    });

    const hasMultipleSources = sortedSources.length > 1;

    return (
      <div className={styles.subtraitsSection}>
        {sortedSources.map((src) => {
          const opts = sourceMap.get(src)!;
          const isCore = src === (species.source || 'PHB').toUpperCase();
          const displayName = getSourceDisplayName(src);

          return (
            <div
              key={src}
              className={hasMultipleSources ? styles.subspeciesSourceGroup : undefined}
            >
              {hasMultipleSources && (
                <div className={styles.subspeciesSourceHeader}>
                  <span className={styles.subspeciesSourceTag}>
                    {isCore ? '📖 核心规则' : '📚 扩展规则'} · {displayName} ({opts.length})
                  </span>
                </div>
              )}
              {/* 横向分段标签栏 (Horizontal Segment Tabs) - 仅负责纯粹的分支形态选择 */}
              <div
                className={styles.lineageTabsContainer}
                role="radiogroup"
                aria-label={`${displayName} 分支选项`}
              >
                {opts.map((opt) => {
                  const isSelected =
                    selections.includes(opt.id) ||
                    (Boolean(character.subspeciesId) &&
                      opt.id.toLowerCase().replace(/[-_\s]+/g, '') ===
                        character.subspeciesId?.toLowerCase().replace(/[-_\s]+/g, '')) ||
                    (Boolean(character.subspeciesId) &&
                      opt.name.toLowerCase().replace(/[-_\s]+/g, '') ===
                        character.subspeciesId?.toLowerCase().replace(/[-_\s]+/g, ''));

                  return (
                    <div
                      key={opt.id}
                      role="radio"
                      aria-checked={isSelected}
                      tabIndex={0}
                      className={`${styles.lineageTabBtn} ${isSelected ? styles.lineageTabBtnActive : ''}`}
                      onClick={() => handleSelectSubspecies(opt.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleSelectSubspecies(opt.id);
                        }
                      }}
                    >
                      <div className={styles.lineageTabRadioIndicator} />
                      <span>{opt.name}</span>
                      {opt.nameEn && (
                        <span style={{ opacity: 0.6, fontSize: '11px' }}>({opt.nameEn})</span>
                      )}
                      {!hasMultipleSources &&
                        opt.source &&
                        opt.source.toUpperCase() !== species.source.toUpperCase() && (
                          <span
                            style={{
                              fontSize: '10px',
                              padding: '1px 5px',
                              borderRadius: '4px',
                              background: 'rgba(218, 165, 32, 0.15)',
                              color: 'var(--color-gold-bright, #daa520)',
                              fontWeight: 600,
                              marginLeft: '4px',
                            }}
                          >
                            {opt.source}
                          </span>
                        )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}

        {/* 选中的亚种描述与规则替换生效呈现 */}
        {selectedSub && (
          <div
            className={styles.subspeciesDescBox}
            style={!selectedSub.description ? { padding: '12px 16px' } : undefined}
          >
            <div className={styles.subspeciesDescHeader}>
              <span className={styles.subspeciesDescTitle}>
                【{selectedSub.name}】{selectedSub.description ? '分支设定' : '分支特性'}
              </span>
              {selectedSub.source && (
                <span className={styles.subspeciesDescSource}>
                  来源：{getSourceDisplayName(selectedSub.source)}
                  {selectedSub.page ? ` (P.${selectedSub.page})` : ''}
                  {selectedSub.otherSources && selectedSub.otherSources.length > 0 && (
                    <span style={{ opacity: 0.9, marginLeft: '4px' }}>
                      · 亦收录于：
                      {selectedSub.otherSources
                        .map(
                          (os) =>
                            `${getSourceDisplayName(os.source)}${os.page ? ` (P.${os.page})` : ''}`,
                        )
                        .join('、')}
                    </span>
                  )}
                </span>
              )}
            </div>
            {selectedSub.description && (
              <MarkdownText
                text={selectedSub.description}
                className={styles.subspeciesDescBody}
                variant="clean"
              />
            )}
            {(() => {
              const replaces = (selectedSub.traits || []).filter(
                (t) => t.overwrite || (t as any).replacesTraitName,
              );
              const owAbility = selectedSub.overwrite?.ability;
              const owSkills = selectedSub.overwrite?.skillProficiencies;
              if (replaces.length === 0 && !owAbility && !owSkills) return null;
              return (
                <div
                  style={{
                    marginTop: selectedSub.description ? '12px' : '6px',
                    padding: '8px 12px',
                    background: 'rgba(255, 149, 0, 0.08)',
                    border: '1px solid rgba(255, 149, 0, 0.25)',
                    borderRadius: '8px',
                    fontSize: '12px',
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    alignItems: 'center',
                  }}
                >
                  <span
                    style={{
                      color: '#ff9500',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <span>⚖️</span>
                    <span>规则替换生效：</span>
                  </span>
                  {replaces.map((t) => (
                    <span key={t.name} style={{ color: 'var(--color-text-primary)' }}>
                      <strong>{t.name}</strong> 替换{' '}
                      <strong>{t.overwrite || (t as any).replacesTraitName}</strong>
                    </span>
                  ))}
                  {owAbility && (
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      属性值加成改用此分支设定
                    </span>
                  )}
                  {owSkills && (
                    <span style={{ color: 'var(--color-text-secondary)' }}>
                      技能熟练项改用此分支设定
                    </span>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.container}>
      {/* 分布式 Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>种族选择</h2>
        </div>
      </div>

      <div className={styles.content}>
        {/* 左侧固定导航栏 - 增加分组渲染 */}
        <div className={styles.list}>
          {(() => {
            const groups: Record<string, Species[]> = {};
            availableSpecies.forEach((s: Species) => {
              const groupName =
                s.source === 'XPHB'
                  ? '2024 核心规则 (Core)'
                  : s.source === 'PHB'
                    ? '2014 经典规则 (Legacy)'
                    : getSourceDisplayName(s.source);
              if (!groups[groupName]) groups[groupName] = [];
              groups[groupName].push(s);
            });

            return Object.entries(groups)
              .sort(([nameA], [nameB]) => {
                const wA = getSourceSortWeight(nameA);
                const wB = getSourceSortWeight(nameB);
                if (wA !== wB) return wA - wB;
                return nameA.localeCompare(nameB, 'zh-Hans-CN');
              })
              .map(([groupName, speciesList]) => {
                const isExpanded = expandedSources.includes(groupName);
                return (
                  <div key={groupName} className={styles.listGroup}>
                    <div className={styles.groupHeader} onClick={() => toggleGroup(groupName)}>
                      <span>
                        {groupName} ({speciesList.length})
                      </span>
                      <span
                        className={`${styles.groupIcon} ${isExpanded ? styles.groupIconExpanded : ''}`}
                      >
                        ▶
                      </span>
                    </div>
                    <div className={isExpanded ? styles.groupContent : styles.groupContentHidden}>
                      {speciesList.map((species) => (
                        <OptionCard
                          key={species.id + species.source}
                          title={species.name}
                          subtitle={species.nameEn}
                          compact
                          selected={
                            character.speciesId === species.id &&
                            character.speciesSource === species.source
                          }
                          onClick={() => handleSelectSpecies(species)}
                        />
                      ))}
                    </div>
                  </div>
                );
              });
          })()}
        </div>

        {/* 右侧独立滚动详情面板 */}
        <div className={styles.detailsPanel} ref={detailsPanelRef}>
          {selectedSpecies ? (
            <div className={styles.detailsContent}>
              <div className={styles.detailsHeader}>
                <h1 className={styles.detailsTitle}>
                  {selectedSpecies.name}
                  <span className={styles.detailsSubtitle}>{selectedSpecies.nameEn}</span>
                </h1>
                <div className={styles.sourceBadge}>
                  {getSourceDisplayName(selectedSpecies.source)}
                </div>

                <div className={styles.basicInfoGrid}>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>类型</span>
                    <span className={styles.infoValue}>{selectedSpecies.creatureType}</span>
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>体型</span>
                    {selectedSpecies.size.length > 1 ? (
                      <select
                        className={styles.selectionDropdown}
                        style={{ padding: '4px 28px 4px 8px', fontSize: '13px' }}
                        value={character.size || ''}
                        onChange={(e) => updateActiveCharacter({ size: e.target.value as any })}
                      >
                        <option value="">请选择...</option>
                        {selectedSpecies.size.map((s) => (
                          <option key={s} value={s}>
                            {s === 'Medium' ? '中型' : '小型'}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <span className={styles.infoValue}>
                        {selectedSpecies.size[0] === 'Medium' ? '中型' : '小型'}
                      </span>
                    )}
                  </div>
                  <div className={styles.infoItem}>
                    <span className={styles.infoLabel}>速度</span>
                    <span className={styles.infoValue}>{effectiveSpeed} 尺</span>
                  </div>
                  {effectiveSenses?.darkvision && (
                    <div className={styles.infoItem}>
                      <span className={styles.infoLabel}>感官</span>
                      <span className={styles.infoValue}>
                        黑暗视觉 {effectiveSenses.darkvision} 尺
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className={styles.descriptionSection}>
                {(() => {
                  // 识别设定类特质 (仅保留纯描述性的 年龄, 阵营, 体型, 速度)
                  const flavorTraitIds = ['age', 'alignment', 'size', 'speed'];
                  const flavorTraits = selectedSpecies.traits.filter(
                    (t) =>
                      flavorTraitIds.includes(t.id || '') ||
                      ['年龄', '阵营', '体型', '速度'].includes(t.name),
                  );

                  return (
                    <div
                      style={{
                        background: 'var(--color-bg-dark)',
                        border: '1px solid var(--color-border-dark)',
                        borderRadius: '12px',
                        overflow: 'hidden',
                        transition: 'all 0.3s ease',
                      }}
                    >
                      <div
                        onClick={() => setIsMainDescExpanded(!isMainDescExpanded)}
                        style={{
                          padding: '14px 20px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          background: isMainDescExpanded
                            ? 'rgba(197, 160, 89, 0.08)'
                            : 'transparent',
                          userSelect: 'none',
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '14px',
                            fontWeight: 600,
                            color: 'var(--color-gold-bright)',
                          }}
                        >
                          <span>📖</span>
                          <span>种族背景故事与设定</span>
                        </div>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontSize: '13px',
                            color: 'var(--color-text-secondary)',
                          }}
                        >
                          <span>{isMainDescExpanded ? '点击收起 ↑' : '点击展开阅读 ↓'}</span>
                        </div>
                      </div>

                      {isMainDescExpanded && (
                        <div
                          style={{
                            padding: '20px',
                            borderTop: '1px solid var(--color-border-dark)',
                          }}
                        >
                          <MarkdownText
                            text={selectedSpecies.description}
                            className={styles.descriptionParagraph}
                            variant="clean"
                          />

                          {flavorTraits.length > 0 && (
                            <div
                              style={{
                                marginTop: '20px',
                                paddingTop: '16px',
                                borderTop: '1px dashed var(--color-border-dark)',
                              }}
                            >
                              {flavorTraits.map((t) => (
                                <div key={t.name} style={{ marginBottom: '16px' }}>
                                  <div
                                    style={{
                                      fontWeight: 600,
                                      fontSize: '14px',
                                      color: 'var(--color-text-primary)',
                                      marginBottom: '4px',
                                    }}
                                  >
                                    {t.name}{' '}
                                    <span
                                      style={{
                                        fontWeight: 400,
                                        color: 'var(--color-text-secondary)',
                                        fontSize: '12px',
                                      }}
                                    >
                                      {t.nameEn}
                                    </span>
                                  </div>
                                  <MarkdownText
                                    text={t.description}
                                    variant="clean"
                                    style={{
                                      fontSize: '13px',
                                      color: 'var(--color-text-secondary)',
                                      lineHeight: '1.5',
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className={styles.traitsSection}>
                <h4 className={styles.sectionTitle}>核心特质 Core Traits</h4>
                <div className={styles.traitGrid} key={`grid:${selectedSpecies?.id || 'none'}`}>
                  {effectiveTraits.map((trait, idx) => renderTraitContent(trait, idx))}
                </div>
              </div>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div style={{ textAlign: 'center' }}>
                <p
                  style={{
                    fontSize: '1.2rem',
                    fontWeight: 600,
                    color: 'var(--color-text-primary)',
                    marginBottom: '8px',
                  }}
                >
                  尚未选择种族
                </p>
                <p style={{ color: '#86868b' }}>
                  你可以先在左侧浏览并选择一个种族，或者直接点击“下一步”稍后再定。
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
