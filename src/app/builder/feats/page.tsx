'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCharacterStore } from '@/store/characterStore';
import { getCatalogFeats, getCatalogClasses, getCatalogSpells } from '@/catalog';
import { useCatalog } from '@/platform/CatalogProvider';
import {
  getBackgroundDefinition,
  getSpeciesDefinition,
  getClassDefinition,
} from '@/engine/characterData';
import { computeAbilityScores } from '@/engine/ability';
import { computeProficiencies } from '@/engine/proficiency';
import OptionCard from '@/components/OptionCard';
import PillButton from '@/components/PillButton';
import MarkdownText from '@/components/MarkdownText';
import {
  normalizeAbilityKey,
  translateAbilityKey,
  translateSkill,
  translateProficiency,
  translateClass,
  translateSource,
  translateSpellSchool,
  formatSpellRange,
  ALL_SKILLS,
  ALL_TOOLS,
} from '@/engine/terminology';
import { FeatChoices, AbilityScores } from '@/types/characterState';

import { allLanguages } from '@/rules/languages';
import styles from '../species/page.module.css';
import featsStyles from './feats.module.css';

export default function FeatsPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { characters, updateActiveCharacter, loadCharacter } = useCharacterStore();
  const { status: catalogStatus } = useCatalog();
  const character = id ? characters[id] : null;

  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>('All');
  const [expandedSources, setExpandedSources] = useState<string[]>(['2024 核心规则 (Core)']);

  // Language filtering state
  const [langCategory, setLangCategory] = useState<string>('Standard');
  const [langSource, setLangSource] = useState<string>('XPHB');

  // Spell selection states
  const [spellSearch, setSpellSearch] = useState('');
  const [spellSourceFilter, setSpellSourceFilter] = useState<string | null>('2024 玩家手册');
  const [spellPreview, setSpellPreview] = useState<{ id: string; reqIndex: number } | null>(null);

  const detailsPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) loadCharacter(id);
  }, [id, loadCharacter]);

  const background = useMemo(
    () => (character ? getBackgroundDefinition(character) : null),
    [character],
  );
  const species = useMemo(() => (character ? getSpeciesDefinition(character) : null), [character]);

  // Identify all potential feat slots
  const featSlots = useMemo(() => {
    if (!character) return [];

    // Define the slot structure strictly following 2024/2014 paradigms
    const slots: {
      id: string;
      level?: number;
      name: string;
      allowedCategories: ('Origin' | 'General' | 'Fighting Style' | 'Epic Boon' | 'Legacy')[];
      grantingSource: string;
      currentFeatId?: string;
    }[] = [];

    // 1. Background Feat (Origin)
    if (background) {
      const slotId = 'background-feat';
      slots.push({
        id: slotId,
        level: 1,
        name: '背景专长 (Origin Feat)',
        allowedCategories: ['Origin'],
        grantingSource: `背景: ${background.name}`,
        currentFeatId: character.featSelections?.[slotId]?.featId || character.originFeatId,
      });
    }

    // 2. Species-granted slots
    if (species) {
      species.traits.forEach((trait) => {
        const originFeatData = trait.features?.originFeats;
        const isLegacyFeat =
          trait.id === 'bonus-feat' ||
          trait.id === 'feat' ||
          trait.name === '额外专长' ||
          trait.name === '专长';
        const isVersatile =
          trait.id === 'versatile' ||
          trait.id === 'origin-feat' ||
          trait.name === '多用' ||
          trait.name === '多才多艺';

        if (originFeatData || isLegacyFeat || isVersatile) {
          const isOriginOnly = originFeatData
            ? originFeatData.filter === 'type:origin'
            : isVersatile;
          const slotId = `species-${trait.id || 'feat'}`;

          const traitKey = trait.id || trait.name || 'feat';
          const savedSelections =
            character.speciesSelections?.[slotId] ||
            (trait.id ? character.speciesSelections?.[trait.id] : undefined) ||
            (trait.name ? character.speciesSelections?.[trait.name] : undefined) ||
            (character.speciesId
              ? character.speciesSelections?.[`sp:${character.speciesId}:trait:${traitKey}`]
              : undefined) ||
            [];
          const savedFeat = savedSelections[0];

          slots.push({
            id: slotId,
            level: 1,
            name: isOriginOnly ? '种族加成专长 (Origin Feat)' : '种族加成专长 (Bonus Feat)',
            allowedCategories: isOriginOnly
              ? ['Origin']
              : ['Origin', 'General', 'Fighting Style', 'Legacy', 'Epic Boon'],
            grantingSource: `种族: ${species.name} (${trait.name})`,
            currentFeatId: character.featSelections?.[slotId]?.featId || savedFeat,
          });
        }
      });
    }

    // 3. Class Progression & Feature-granted slots
    character.classes.forEach((c) => {
      const classDef =
        getClassDefinition(c.classId) ||
        getCatalogClasses().find((ad: any) => ad.id === c.classId || ad.nameEn === c.classId);
      if (!classDef) return;

      classDef.features
        .filter((f: any) => f.level <= c.level)
        .forEach((f: any) => {
          if (f.mechanics?.choices) {
            f.mechanics.choices
              .filter((choice: any) => choice.type === 'feat')
              .forEach((choice: any) => {
                const slotId = `cls:${c.classId}:feat:${f.name}:${choice.id}`;
                let allowed: ('Origin' | 'General' | 'Fighting Style' | 'Epic Boon' | 'Legacy')[] =
                  ['General', 'Legacy'];
                if (choice.options?.includes('Fighting Style')) allowed = ['Fighting Style'];
                else if (choice.options?.includes('Epic Boon')) allowed = ['Epic Boon'];
                else if (choice.options?.includes('Origin Feat')) allowed = ['Origin'];

                slots.push({
                  id: slotId,
                  level: f.level,
                  name: `${f.name} (${choice.name || '专长选择'})`,
                  allowedCategories: allowed,
                  grantingSource: `职业: ${classDef.name} (等级 ${f.level})`,
                  currentFeatId:
                    character.featSelections?.[slotId]?.featId ||
                    character.classSelections?.[slotId]?.[0],
                });
              });
          }
        });
    });

    return slots;
  }, [character, background, species]);

  const activeSlot =
    featSlots.find((s) => s.id === selectedSlotId) || (featSlots.length > 0 ? featSlots[0] : null);

  const activeChoices = useMemo(() => {
    if (!activeSlot || !character) return null;
    return character.featSelections?.[activeSlot.id] || null;
  }, [character, activeSlot]);

  // Calculate existing proficiencies (excluding current selections in THIS slot)
  const baseProficiencies = useMemo<{
    skills: Record<string, string>;
    tools: Record<string, string>;
    languages: Record<string, string>;
    expertise: Record<string, string>;
  }>(() => {
    if (!character || !activeSlot) return { skills: {}, tools: {}, languages: {}, expertise: {} };

    // Create a temporary state without the current feat selections to find base proficiencies
    const tempState = {
      ...character,
      featSelections: { ...character.featSelections },
    };
    // Remove choices for the current slot so we can see what was there before
    if (tempState.featSelections?.[activeSlot.id]) {
      delete tempState.featSelections[activeSlot.id];
    }

    const computed = computeProficiencies(tempState as any);

    // Create maps for quick lookup of sources
    const skillMap: Record<string, string> = {};
    computed.skills.forEach((p) => (skillMap[p.id] = p.sources.join(', ')));

    const toolMap: Record<string, string> = {};
    computed.tools.forEach((p) => (toolMap[p.id] = p.sources.join(', ')));

    const langMap: Record<string, string> = {};
    computed.languages.forEach((p) => (langMap[p.id] = p.sources.join(', ')));

    const expertiseMap: Record<string, string> = {};
    // Extract from global expertise
    tempState.expertiseSkills?.forEach((s) => (expertiseMap[s] = 'Global Expertise'));
    // Extract from other feat selections
    Object.entries(tempState.featSelections || {}).forEach(([id, choices]) => {
      choices.expertise?.forEach((skill) => (expertiseMap[skill] = `专长专精`));
    });

    return {
      skills: skillMap,
      tools: toolMap,
      languages: langMap,
      expertise: expertiseMap,
    };
  }, [character, activeSlot]);

  const baseAbilityData = useMemo(() => {
    if (!character || !activeSlot) return null;
    const tempState = { ...character, featSelections: { ...character.featSelections } };

    // To support sequential calculation:
    // 1. Identify current slot index and level
    const currentIdx = featSlots.findIndex((s) => s.id === activeSlot.id);
    const currentLevel = activeSlot.level || 1;

    // 2. Remove any selections that are "later" in the timeline
    Object.keys(tempState.featSelections || {}).forEach((sid) => {
      const slotDef = featSlots.find((s) => s.id === sid);
      if (!slotDef) return;

      // If slot is at a higher level, OR same level but later in the list, remove it
      const slotLevel = slotDef.level || 1;
      const slotIdx = featSlots.findIndex((s) => s.id === sid);

      if (slotLevel > currentLevel || (slotLevel === currentLevel && slotIdx >= currentIdx)) {
        delete tempState.featSelections[sid];
      }
    });

    return computeAbilityScores(tempState as any);
  }, [character, activeSlot, featSlots]);

  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategoryFilter, setActiveCategoryFilter] = useState<string>('All');
  const [activeSourceFilter, setActiveSourceFilter] = useState<string>('XPHB');
  const [confirmingFeatId, setConfirmingFeatId] = useState<string | null>(null);
  const [isOriginFeatUnbound, setIsOriginFeatUnbound] = useState(false);

  const allFeats = useMemo(() => {
    return getCatalogFeats();
  }, [catalogStatus]);

  const allSpells = useMemo(() => {
    return getCatalogSpells();
  }, [catalogStatus]);

  const filteredFeats = useMemo(() => {
    if (!activeSlot || !character) return [];
    const currentScores = computeAbilityScores(character).scores;
    const totalLevel = character.classes.reduce((acc, c) => acc + c.level, 0);
    const hasSpellcasting = character.classes.some((c) => {
      const def = getClassDefinition(c.classId);
      return def?.progression.some((p: any) => p.level <= c.level && p.spellcasting);
    });

    const allOtherSelections = Object.entries(character.featSelections || {})
      .filter(([slotId]) => slotId !== activeSlot.id)
      .map(([_, s]) => s.featId.toLowerCase());

    return allFeats.map((f) => {
      const effectiveCategory = f.category === 'Legacy' ? 'General' : f.category;
      const isCategoryAllowed =
        activeSlot.allowedCategories.includes(f.category as any) ||
        activeSlot.allowedCategories.includes(effectiveCategory as any);

      let categoryMatch =
        activeCategoryFilter === 'All' ||
        f.category === activeCategoryFilter ||
        (activeCategoryFilter === 'General' && f.category === 'Legacy');
      const hasSourceInSlot = allFeats.some(
        (feat) =>
          feat.source === activeSourceFilter &&
          (activeSlot.allowedCategories.includes(feat.category as any) ||
            (feat.category === 'Legacy' &&
              activeSlot.allowedCategories.includes('General' as any))),
      );
      const sourceMatch =
        activeSourceFilter === 'All' || !hasSourceInSlot || f.source === activeSourceFilter;
      const searchMatch =
        !searchQuery ||
        f.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        f.nameEn.toLowerCase().includes(searchQuery.toLowerCase());

      let prerequisiteError = '';
      if (f.prerequisiteLogic) {
        if (f.prerequisiteLogic.level && totalLevel < f.prerequisiteLogic.level)
          prerequisiteError = `等级不足 (需要 ${f.prerequisiteLogic.level} 级)`;
        else if (f.prerequisiteLogic.abilities) {
          const met = f.prerequisiteLogic.abilities.some((a: any) => {
            const key = normalizeAbilityKey(a.ability) as keyof AbilityScores;
            return key && currentScores[key] >= a.min;
          });
          if (!met)
            prerequisiteError = `属性不足 (${f.prerequisiteLogic.abilities.map((a: any) => `${translateAbilityKey(a.ability)} ${a.min}`).join(' 或 ')})`;
        }
        if (!prerequisiteError && f.prerequisiteLogic.spellcasting && !hasSpellcasting)
          prerequisiteError = '需要施法能力';
      }

      const isOccupied = allOtherSelections.includes(f.id.toLowerCase()) && !f.repeatable;

      return {
        ...f,
        isCategoryAllowed,
        isFiltered: isCategoryAllowed && categoryMatch && sourceMatch && searchMatch,
        prerequisiteError,
        isOccupied,
      };
    });
  }, [activeSlot, activeCategoryFilter, activeSourceFilter, searchQuery, character]);

  const handleSelectFeat = (featId: string, force: boolean = false) => {
    if (!activeSlot || !character) return;

    // Logic for Origin Feat Unbinding
    if (activeSlot.id === 'background-feat' && !isOriginFeatUnbound) {
      alert('当前背景专长已锁定。如需更改，请在左侧开启“起源专长解绑”。');
      return;
    }

    // Check if we need confirmation (if something is already selected and it's different)
    if (!force && activeSlot.currentFeatId && activeSlot.currentFeatId !== featId) {
      setConfirmingFeatId(featId);
      return;
    }

    const currentSelections = { ...(character.featSelections || {}) };
    currentSelections[activeSlot.id] = { featId };
    updateActiveCharacter({ featSelections: currentSelections });

    // Backward compatibility mappings...
    if (activeSlot.id === 'background-feat') updateActiveCharacter({ originFeatId: featId });
    else if (activeSlot.id.startsWith('species-')) {
      const traitId = activeSlot.id.replace('species-', '');
      const speciesSelections = { ...(character.speciesSelections || {}) };
      speciesSelections[traitId] = [featId];
      updateActiveCharacter({ speciesSelections });
    } else if (activeSlot.id.includes(':')) {
      const classSelections = { ...(character.classSelections || {}) };
      classSelections[activeSlot.id] = [featId];
      updateActiveCharacter({ classSelections });
    }
    setConfirmingFeatId(null);
  };

  const selectedFeatData = useMemo(() => {
    if (!activeSlot?.currentFeatId) return null;
    const searchId = activeSlot.currentFeatId.toLowerCase();
    return allFeats.find((f) => {
      const fId = f.id.toLowerCase();
      const fName = f.nameEn.toLowerCase();
      return fId === searchId || fName === searchId || searchId.startsWith(fName + ' (');
    });
  }, [activeSlot]);

  // Clear spell preview when switching slots or feats
  useEffect(() => {
    setSpellPreview(null);
    setSpellSearch('');
    setSpellSourceFilter(null);
  }, [selectedSlotId, selectedFeatData?.id]);

  const handleUpdateFeatChoice = (slotId: string, updates: Partial<FeatChoices>) => {
    if (!character) return;
    const currentSelections = { ...(character.featSelections || {}) };
    const existing = currentSelections[slotId] || { featId: '' };
    currentSelections[slotId] = { ...existing, ...updates };
    updateActiveCharacter({ featSelections: currentSelections });
  };

  if (!character) return <div className={styles.emptyState}>加载中...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>专长管理</h2>
          <div style={{ display: 'flex', gap: 8, marginLeft: 16 }}>
            <div
              style={{
                background: featSlots.every((s) => s.currentFeatId)
                  ? 'rgba(197, 160, 89, 0.1)'
                  : 'var(--color-bg-dark)',
                color: featSlots.every((s) => s.currentFeatId)
                  ? 'var(--color-gold-accent)'
                  : '#86868b',
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: '11px',
                fontWeight: 600,
                border: featSlots.every((s) => s.currentFeatId) ? '1px solid #0071e3' : 'none',
              }}
            >
              已分配 {featSlots.filter((s) => s.currentFeatId).length} / {featSlots.length}
            </div>
          </div>
        </div>
      </div>

      <div className={styles.content} style={{ flexDirection: 'column' }}>
        {/* Top Section: Horizontal Slot List */}
        <div className={featsStyles.horizontalContainer}>
          <div className={featsStyles.slotHeader}>
            <p className={featsStyles.slotHeaderText}>点击下方槽位进行配置：</p>
            <div
              className={featsStyles.unboundToggle}
              onClick={() => setIsOriginFeatUnbound(!isOriginFeatUnbound)}
            >
              <span
                className={`${featsStyles.toggleLabel} ${isOriginFeatUnbound ? featsStyles.toggleLabelActive : ''}`}
              >
                起源专长解绑
              </span>
              <div
                className={`${featsStyles.toggleTrack} ${isOriginFeatUnbound ? featsStyles.toggleTrackActive : ''}`}
              >
                <div
                  className={`${featsStyles.toggleThumb} ${isOriginFeatUnbound ? featsStyles.toggleThumbActive : ''}`}
                />
              </div>
            </div>
          </div>

          <div className={featsStyles.scrollList}>
            {featSlots.map((slot) => {
              const isSelected = activeSlot?.id === slot.id;
              const currentFeat = allFeats.find((f) => {
                const searchId = slot.currentFeatId?.toLowerCase() || '';
                const fId = f.id.toLowerCase();
                const fName = f.nameEn.toLowerCase();
                return fId === searchId || fName === searchId || searchId.startsWith(fName + ' (');
              });
              const isLocked = slot.id === 'background-feat' && !isOriginFeatUnbound;

              return (
                <div key={slot.id} className={featsStyles.slotCardWrapper}>
                  <OptionCard
                    title={
                      <span>
                        {slot.name} {isLocked && <span style={{ fontSize: '10px' }}>🔒</span>}
                      </span>
                    }
                    subtitle={slot.grantingSource}
                    selected={isSelected}
                    compact={true}
                    onClick={() => setSelectedSlotId(slot.id)}
                  >
                    <div style={{ position: 'absolute', right: 8, top: 12 }}>
                      <div
                        className={`${styles.radioCircle} ${isSelected ? styles.radioCircleActive : ''}`}
                        style={{ width: 14, height: 14 }}
                      >
                        <div className={styles.radioInner} style={{ width: 6, height: 6 }} />
                      </div>
                    </div>
                    {slot.currentFeatId && (
                      <div className={featsStyles.selectedFeatLabel}>
                        <span style={{ fontSize: '11px' }}>★</span>{' '}
                        {currentFeat?.name || slot.currentFeatId}
                      </div>
                    )}
                  </OptionCard>
                </div>
              );
            })}
            {featSlots.length === 0 && (
              <div style={{ padding: 20, textAlign: 'center', color: '#86868b', width: '100%' }}>
                当前角色尚未解锁任何专长槽位。
              </div>
            )}
          </div>
        </div>

        {/* Bottom Section: Library + Details */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'row', overflow: 'hidden' }}>
          {activeSlot ? (
            <>
              {/* Column 1: Feat Library (Left/Middle) */}
              <div
                style={{
                  width: '420px',
                  display: 'flex',
                  flexDirection: 'column',
                  borderRight: '1px solid #eee',
                  background: 'var(--color-bg-dark)',
                  height: '100%',
                }}
              >
                {/* Filters */}
                <div
                  style={{
                    padding: '12px 16px',
                    borderBottom: '1px solid #f0f0f0',
                    background: 'var(--color-bg-dark)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: 12,
                    }}
                  >
                    <h3 className={styles.detailsTitle} style={{ margin: 0, fontSize: '18px' }}>
                      选择专长
                    </h3>
                    <input
                      type="text"
                      placeholder="搜索..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      style={{
                        width: '100px',
                        padding: '4px 8px',
                        borderRadius: 6,
                        border: '1px solid #ddd',
                        fontSize: '11px',
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 8 }}>
                    {['All', 'Origin', 'General', 'Fighting Style', 'Epic Boon'].map((cat) => {
                      if (
                        cat !== 'All' &&
                        !activeSlot.allowedCategories.includes(cat as any) &&
                        !(cat === 'General' && activeSlot.allowedCategories.includes('Legacy'))
                      )
                        return null;
                      return (
                        <PillButton
                          key={cat}
                          size="xs"
                          variant={activeCategoryFilter === cat ? 'primary' : 'outline'}
                          onClick={() => setActiveCategoryFilter(cat)}
                          style={{ fontSize: '10px' }}
                        >
                          {cat === 'All'
                            ? '全部'
                            : cat === 'Origin'
                              ? '起源'
                              : cat === 'General'
                                ? '通用'
                                : cat === 'Fighting Style'
                                  ? '风格'
                                  : '恩惠'}
                        </PillButton>
                      );
                    })}
                  </div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {['All', 'XPHB', 'PHB', 'TCoE'].map((src) => (
                      <PillButton
                        key={src}
                        size="xs"
                        variant={activeSourceFilter === src ? 'primary' : 'outline'}
                        onClick={() => setActiveSourceFilter(src)}
                        style={{ fontSize: '9px', padding: '2px 6px' }}
                      >
                        {src === 'All' ? '全部来源' : translateSource(src)}
                      </PillButton>
                    ))}
                  </div>
                </div>

                {/* Library Grid */}
                <div style={{ padding: '12px', flex: 1, overflowY: 'auto' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {filteredFeats
                      .filter((f) => f.isFiltered)
                      .map((feat) => {
                        const isSelected = activeSlot?.currentFeatId
                          ? activeSlot.currentFeatId.toLowerCase() === feat.id.toLowerCase() ||
                            activeSlot.currentFeatId.toLowerCase() === feat.nameEn.toLowerCase() ||
                            activeSlot.currentFeatId
                              .toLowerCase()
                              .startsWith(feat.nameEn.toLowerCase() + ' (')
                          : false;
                        const hasError = !!feat.prerequisiteError;
                        const isOccupied = feat.isOccupied;
                        const isDisabled = hasError || isOccupied;

                        return (
                          <div
                            key={feat.id}
                            className={`${styles.traitCard} ${isSelected ? styles.traitCardActive : ''} ${isDisabled ? styles.disabledCard : ''}`}
                            onClick={() => !isDisabled && handleSelectFeat(feat.id)}
                            style={{
                              padding: '6px 8px',
                              border: isSelected ? '2px solid #0071e3' : '1px solid #e5e5e7',
                              borderRadius: 8,
                              background: isSelected
                                ? 'rgba(197, 160, 89, 0.1)'
                                : 'var(--color-bg-dark)',
                              cursor: isDisabled ? 'not-allowed' : 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              minHeight: '44px',
                            }}
                          >
                            <div style={{ fontSize: '9px', color: '#86868b', lineHeight: 1 }}>
                              {translateSource(feat.source)}
                            </div>
                            <div
                              style={{
                                fontWeight: 600,
                                fontSize: '11px',
                                color: isSelected
                                  ? 'var(--color-gold-accent)'
                                  : 'var(--color-text-primary)',
                                lineHeight: 1.1,
                                marginTop: 2,
                              }}
                            >
                              {feat.name}
                              {filteredFeats.filter((f) => f.name === feat.name).length > 1 && (
                                <span
                                  style={{
                                    fontSize: '9px',
                                    color: 'var(--color-gold-accent)',
                                    marginLeft: 3,
                                    fontWeight: 500,
                                  }}
                                >
                                  [{translateSource(feat.source)}]
                                </span>
                              )}
                              {isOccupied && (
                                <span
                                  style={{
                                    fontSize: '8px',
                                    marginLeft: 2,
                                    fontWeight: 400,
                                    color: '#86868b',
                                  }}
                                >
                                  (已选)
                                </span>
                              )}
                            </div>
                            {hasError && (
                              <div
                                style={{
                                  marginTop: 2,
                                  fontSize: '8px',
                                  color: '#ff3b30',
                                  lineHeight: 1,
                                }}
                              >
                                ! {feat.prerequisiteError}
                              </div>
                            )}
                          </div>
                        );
                      })}
                  </div>
                </div>
              </div>

              {/* Column 2: Details & Config (Right) */}
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  background: 'var(--color-bg-dark)',
                  height: '100%',
                  overflowY: 'auto',
                }}
                ref={detailsPanelRef}
              >
                {selectedFeatData ? (
                  <div style={{ padding: '16px 20px' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 12,
                      }}
                    >
                      <div>
                        <h4 style={{ margin: 0, fontSize: '22px', fontWeight: 700 }}>
                          {selectedFeatData.name}
                        </h4>
                        <p style={{ margin: 0, color: '#86868b', fontSize: '14px' }}>
                          {selectedFeatData.nameEn}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '10px', fontWeight: 600, color: '#ff3b30' }}>
                          前提条件
                        </div>
                        <div style={{ fontSize: '11px', marginBottom: 4 }}>
                          {selectedFeatData.prerequisite || '无'}
                        </div>
                        <PillButton
                          size="xs"
                          variant="outline"
                          disabled={activeSlot.id === 'background-feat' && !isOriginFeatUnbound}
                          style={{
                            borderColor:
                              activeSlot.id === 'background-feat' && !isOriginFeatUnbound
                                ? '#d2d2d7'
                                : '#ff3b30',
                            color:
                              activeSlot.id === 'background-feat' && !isOriginFeatUnbound
                                ? '#86868b'
                                : '#ff3b30',
                            padding: '1px 6px',
                            fontSize: '9px',
                          }}
                          onClick={() => {
                            if (
                              window.confirm('确认重置当前槽位的专长选择吗？所有相关配置都将清除。')
                            ) {
                              const currentSelections = { ...(character.featSelections || {}) };
                              delete currentSelections[activeSlot.id];
                              updateActiveCharacter({ featSelections: currentSelections });
                              // Sync back to specific sources
                              if (activeSlot.id === 'background-feat')
                                updateActiveCharacter({ originFeatId: undefined });
                              else if (activeSlot.id.startsWith('species-')) {
                                const traitId = activeSlot.id.replace('species-', '');
                                const speciesSelections = {
                                  ...(character.speciesSelections || {}),
                                };
                                delete speciesSelections[traitId];
                                updateActiveCharacter({ speciesSelections });
                              } else if (activeSlot.id.includes(':')) {
                                const classSelections = { ...(character.classSelections || {}) };
                                delete classSelections[activeSlot.id];
                                updateActiveCharacter({ classSelections });
                              }
                            }
                          }}
                        >
                          更换
                        </PillButton>
                      </div>
                    </div>

                    <div
                      style={{
                        background: 'var(--color-bg-dark)',
                        padding: '20px 24px',
                        borderRadius: 12,
                        border: '1px solid #eee',
                        marginBottom: 20,
                        fontSize: '15px',
                        lineHeight: 1.6,
                      }}
                    >
                      <MarkdownText text={selectedFeatData.description} />
                    </div>

                    <div
                      style={{
                        padding: '16px 20px',
                        background: 'rgba(0,0,0,0.02)',
                        borderRadius: 10,
                        border: '1px solid #eee',
                      }}
                    >
                      <h5 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: 600 }}>
                        ⚙️ 专长精细化配置
                      </h5>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {/* ASI */}
                        {selectedFeatData.mechanics?.abilityScoreImprovement?.map((asi, idx) => {
                          const currentAsi = activeChoices?.asi || {};
                          const totalPointsUsed = Object.values(currentAsi).reduce(
                            (a, b) => a + (b || 0),
                            0,
                          );
                          const pointsLeft = asi.points - totalPointsUsed;
                          const hasTwoSomewhere = Object.values(currentAsi).some((v) => v === 2);

                          return (
                            <div
                              key={idx}
                              style={{
                                marginBottom: 16,
                                padding: '16px',
                                background: 'rgba(0,0,0,0.03)',
                                borderRadius: 10,
                              }}
                            >
                              <div
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center',
                                  marginBottom: 12,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <h5 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>
                                    分配加值 (总计 +{asi.points})
                                  </h5>
                                  <span
                                    style={{
                                      fontSize: '0.75rem',
                                      padding: '2px 8px',
                                      borderRadius: 6,
                                      background:
                                        pointsLeft === 0
                                          ? 'rgba(52, 199, 89, 0.1)'
                                          : 'rgba(255, 159, 10, 0.1)',
                                      color: pointsLeft === 0 ? '#248a3d' : '#c97b00',
                                      fontWeight: 700,
                                    }}
                                  >
                                    {pointsLeft === 0 ? '已完成分配' : `剩余: ${pointsLeft}`}
                                  </span>
                                </div>
                              </div>

                              <div
                                style={{
                                  display: 'grid',
                                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                                  gap: 10,
                                }}
                              >
                                {asi.options.map((opt) => {
                                  const key = (normalizeAbilityKey(opt) ||
                                    opt) as keyof AbilityScores;
                                  const val = currentAsi[key] || 0;
                                  const baseScore = baseAbilityData?.scores[key] || 0;
                                  const cap =
                                    selectedFeatData.category === 'Epic Boon'
                                      ? 30
                                      : baseAbilityData?.caps[key] || 20;
                                  const isAlreadyAtCap = baseScore >= cap;

                                  // Potential bonus if we click:
                                  // 0 -> 1 (if pointsLeft >= 1 and no one has 2)
                                  // 0 -> 2 (if pointsLeft >= 2)
                                  // 1 -> 2 (if pointsLeft >= 1)
                                  // 1 -> 0
                                  // 2 -> 0

                                  const isActive = val > 0;
                                  const potentialNextVal =
                                    val === 0
                                      ? pointsLeft >= 1 && !hasTwoSomewhere
                                        ? 1
                                        : pointsLeft >= 2
                                          ? 2
                                          : 0
                                      : val === 1
                                        ? pointsLeft >= 1
                                          ? 2
                                          : 0
                                        : 0;
                                  const bonusForWarning = isActive ? val : potentialNextVal || 1;
                                  const potentialScore = baseScore + bonusForWarning;
                                  const isPotentiallyOverCap = potentialScore > cap;

                                  return (
                                    <div
                                      key={opt}
                                      onClick={() => {
                                        const nextAsi = { ...currentAsi };
                                        if (val === 0) {
                                          if (pointsLeft >= 2) {
                                            if (!hasTwoSomewhere) {
                                              nextAsi[key] = 1;
                                            } else {
                                              Object.keys(nextAsi).forEach(
                                                (k) => delete nextAsi[k as keyof AbilityScores],
                                              );
                                              nextAsi[key] = 1;
                                            }
                                          } else if (pointsLeft === 1) {
                                            if (!hasTwoSomewhere) {
                                              nextAsi[key] = 1;
                                            } else {
                                              Object.keys(nextAsi).forEach(
                                                (k) => delete nextAsi[k as keyof AbilityScores],
                                              );
                                              nextAsi[key] = 1;
                                            }
                                          } else {
                                            Object.keys(nextAsi).forEach(
                                              (k) => delete nextAsi[k as keyof AbilityScores],
                                            );
                                            nextAsi[key] = 1;
                                          }
                                        } else if (val === 1) {
                                          if (pointsLeft >= 1) {
                                            Object.keys(nextAsi).forEach(
                                              (k) => delete nextAsi[k as keyof AbilityScores],
                                            );
                                            nextAsi[key] = 2;
                                          } else {
                                            delete nextAsi[key];
                                          }
                                        } else if (val === 2) {
                                          delete nextAsi[key];
                                        }
                                        handleUpdateFeatChoice(activeSlot.id, {
                                          asi: nextAsi,
                                          ability: undefined,
                                        });
                                      }}
                                      style={{
                                        background: isActive
                                          ? 'var(--color-bg-surface-elevated)'
                                          : 'var(--color-bg-dark)',
                                        padding: '10px 16px',
                                        borderRadius: 12,
                                        border: isActive
                                          ? '2px solid var(--color-apple-blue)'
                                          : isPotentiallyOverCap
                                            ? '1px dashed var(--color-accent-blood)'
                                            : '1px solid var(--color-border-dark)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s ease',
                                        boxShadow: isActive
                                          ? '0 4px 12px rgba(0, 113, 227, 0.1)'
                                          : 'none',
                                        opacity: isAlreadyAtCap && !isActive ? 0.7 : 1,
                                      }}
                                    >
                                      <div
                                        style={{
                                          display: 'flex',
                                          flexDirection: 'column',
                                          alignItems: 'flex-start',
                                        }}
                                      >
                                        <span style={{ fontSize: '10px', color: '#86868b' }}>
                                          当前: {baseScore}
                                        </span>
                                        <span
                                          style={{
                                            fontSize: '14px',
                                            fontWeight: 700,
                                            color: isActive
                                              ? 'var(--color-gold-accent)'
                                              : 'var(--color-text-primary)',
                                          }}
                                        >
                                          {translateAbilityKey(key)}
                                        </span>
                                      </div>
                                      <div
                                        style={{
                                          fontSize: '18px',
                                          fontWeight: 800,
                                          color: isActive
                                            ? 'var(--color-gold-accent)'
                                            : isPotentiallyOverCap
                                              ? '#ff3b30'
                                              : '#d2d2d7',
                                        }}
                                      >
                                        {isActive ? `+${val}` : '+0'}
                                      </div>
                                      {isPotentiallyOverCap && (
                                        <div
                                          style={{
                                            fontSize: '9px',
                                            color: '#ff3b30',
                                            marginTop: 4,
                                            fontWeight: 600,
                                            background: 'rgba(255, 59, 48, 0.1)',
                                            padding: '2px 6px',
                                            borderRadius: 4,
                                          }}
                                        >
                                          {isAlreadyAtCap ? '已达上限' : '超出上限'}
                                        </div>
                                      )}
                                      {isAlreadyAtCap && !isPotentiallyOverCap && (
                                        <div
                                          style={{
                                            fontSize: '9px',
                                            color: '#ff9500',
                                            marginTop: 4,
                                            fontWeight: 600,
                                            background: 'rgba(255, 149, 0, 0.1)',
                                            padding: '2px 6px',
                                            borderRadius: 4,
                                          }}
                                        >
                                          已达上限
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}

                        {/* Skills */}
                        {selectedFeatData.mechanics?.skillProficiencies &&
                          (() => {
                            const profs = Array.isArray(
                              selectedFeatData.mechanics.skillProficiencies,
                            )
                              ? selectedFeatData.mechanics.skillProficiencies[0]
                              : selectedFeatData.mechanics.skillProficiencies;
                            const options =
                              profs.options.includes('Any') || profs.options.includes('any')
                                ? ALL_SKILLS
                                : profs.options;

                            return (
                              <div>
                                <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: 8 }}>
                                  技能熟练 (选 {profs.count}):
                                </p>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  {options.map((skill: string) => {
                                    const existingSource = baseProficiencies.skills[skill];
                                    const isSelected = activeChoices?.skills?.includes(skill);
                                    const isDisabled = !isSelected && !!existingSource;

                                    return (
                                      <div key={skill} style={{ position: 'relative' }}>
                                        <PillButton
                                          size="sm"
                                          variant={isSelected ? 'primary' : 'outline'}
                                          disabled={isDisabled}
                                          onClick={() => {
                                            if (isDisabled) return;
                                            const currentSkills = activeChoices?.skills || [];
                                            const next = isSelected
                                              ? currentSkills.filter((s) => s !== skill)
                                              : [...currentSkills, skill].slice(0, profs.count);
                                            handleUpdateFeatChoice(activeSlot.id, { skills: next });
                                          }}
                                          style={{
                                            opacity: isDisabled ? 0.5 : 1,
                                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                                          }}
                                        >
                                          {translateSkill(skill)}
                                          {existingSource && !isSelected && (
                                            <span
                                              style={{
                                                fontSize: '9px',
                                                marginLeft: 4,
                                                padding: '1px 4px',
                                                background: '#eee',
                                                borderRadius: 4,
                                                color: '#666',
                                              }}
                                            >
                                              {existingSource.split(':')[0]}
                                            </span>
                                          )}
                                        </PillButton>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}

                        {/* Tools */}
                        {selectedFeatData.mechanics?.toolProficiencies &&
                          (() => {
                            const profs = Array.isArray(
                              selectedFeatData.mechanics.toolProficiencies,
                            )
                              ? selectedFeatData.mechanics.toolProficiencies[0]
                              : selectedFeatData.mechanics.toolProficiencies;
                            const options =
                              profs.options.includes('Any') || profs.options.includes('any')
                                ? ALL_TOOLS
                                : profs.options;

                            return (
                              <div>
                                <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: 8 }}>
                                  工具熟练 (选 {profs.count}):
                                </p>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  {options.map((tool: string) => {
                                    const existingSource = baseProficiencies.tools[tool];
                                    const isSelected = activeChoices?.tools?.includes(tool);
                                    const isDisabled = !isSelected && !!existingSource;

                                    return (
                                      <div key={tool} style={{ position: 'relative' }}>
                                        <PillButton
                                          size="sm"
                                          variant={isSelected ? 'primary' : 'outline'}
                                          disabled={isDisabled}
                                          onClick={() => {
                                            if (isDisabled) return;
                                            const currentTools = activeChoices?.tools || [];
                                            const next = isSelected
                                              ? currentTools.filter((t) => t !== tool)
                                              : [...currentTools, tool].slice(0, profs.count);
                                            handleUpdateFeatChoice(activeSlot.id, { tools: next });
                                          }}
                                          style={{
                                            opacity: isDisabled ? 0.5 : 1,
                                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                                          }}
                                        >
                                          {translateProficiency(tool)}
                                          {existingSource && !isSelected && (
                                            <span
                                              style={{
                                                fontSize: '9px',
                                                marginLeft: 4,
                                                padding: '1px 4px',
                                                background: '#eee',
                                                borderRadius: 4,
                                                color: '#666',
                                              }}
                                            >
                                              {existingSource.split(':')[0]}
                                            </span>
                                          )}
                                        </PillButton>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}

                        {/* Shared Proficiency Pool (Skills + Tools) */}
                        {selectedFeatData.mechanics?.sharedProficiencyPool &&
                          (() => {
                            const pool = selectedFeatData.mechanics.sharedProficiencyPool;
                            const includesSkills = pool.types.includes('skill');
                            const includesTools = pool.types.includes('tool');

                            const skillOptions = includesSkills
                              ? pool.options.includes('Any') || pool.options.includes('any')
                                ? ALL_SKILLS
                                : pool.options
                              : [];
                            const toolOptions = includesTools
                              ? pool.options.includes('Any') || pool.options.includes('any')
                                ? ALL_TOOLS
                                : pool.options
                              : [];

                            const totalSelected =
                              (activeChoices?.skills?.length || 0) +
                              (activeChoices?.tools?.length || 0);

                            return (
                              <div>
                                <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: 8 }}>
                                  熟练项选择 (共选 {pool.count}):
                                </p>

                                {includesSkills && (
                                  <div style={{ marginBottom: 12 }}>
                                    <p
                                      style={{
                                        fontSize: '11px',
                                        color: '#86868b',
                                        marginBottom: 4,
                                      }}
                                    >
                                      技能
                                    </p>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                      {skillOptions.map((skill: string) => {
                                        const existingSource = baseProficiencies.skills[skill];
                                        const isSelected = activeChoices?.skills?.includes(skill);
                                        const isDisabled =
                                          !isSelected &&
                                          (!!existingSource || totalSelected >= pool.count);

                                        return (
                                          <div key={skill} style={{ position: 'relative' }}>
                                            <PillButton
                                              size="sm"
                                              variant={isSelected ? 'primary' : 'outline'}
                                              disabled={isDisabled}
                                              onClick={() => {
                                                if (isDisabled) return;
                                                const currentSkills = activeChoices?.skills || [];
                                                if (isSelected) {
                                                  handleUpdateFeatChoice(activeSlot.id, {
                                                    skills: currentSkills.filter(
                                                      (s) => s !== skill,
                                                    ),
                                                  });
                                                } else {
                                                  if (totalSelected >= pool.count) return;
                                                  handleUpdateFeatChoice(activeSlot.id, {
                                                    skills: [...currentSkills, skill],
                                                  });
                                                }
                                              }}
                                              style={{
                                                opacity: isDisabled ? 0.5 : 1,
                                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                              }}
                                            >
                                              {translateSkill(skill)}
                                              {existingSource && !isSelected && (
                                                <span
                                                  style={{
                                                    fontSize: '9px',
                                                    marginLeft: 4,
                                                    padding: '1px 4px',
                                                    background: '#eee',
                                                    borderRadius: 4,
                                                    color: '#666',
                                                  }}
                                                >
                                                  {existingSource.split(':')[0]}
                                                </span>
                                              )}
                                            </PillButton>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {includesTools && (
                                  <div>
                                    <p
                                      style={{
                                        fontSize: '11px',
                                        color: '#86868b',
                                        marginBottom: 4,
                                      }}
                                    >
                                      工具
                                    </p>
                                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                      {toolOptions.map((tool: string) => {
                                        const existingSource = baseProficiencies.tools[tool];
                                        const isSelected = activeChoices?.tools?.includes(tool);
                                        const isDisabled =
                                          !isSelected &&
                                          (!!existingSource || totalSelected >= pool.count);

                                        return (
                                          <div key={tool} style={{ position: 'relative' }}>
                                            <PillButton
                                              size="sm"
                                              variant={isSelected ? 'primary' : 'outline'}
                                              disabled={isDisabled}
                                              onClick={() => {
                                                if (isDisabled) return;
                                                const currentTools = activeChoices?.tools || [];
                                                if (isSelected) {
                                                  handleUpdateFeatChoice(activeSlot.id, {
                                                    tools: currentTools.filter((t) => t !== tool),
                                                  });
                                                } else {
                                                  if (totalSelected >= pool.count) return;
                                                  handleUpdateFeatChoice(activeSlot.id, {
                                                    tools: [...currentTools, tool],
                                                  });
                                                }
                                              }}
                                              style={{
                                                opacity: isDisabled ? 0.5 : 1,
                                                cursor: isDisabled ? 'not-allowed' : 'pointer',
                                              }}
                                            >
                                              {translateProficiency(tool)}
                                              {existingSource && !isSelected && (
                                                <span
                                                  style={{
                                                    fontSize: '9px',
                                                    marginLeft: 4,
                                                    padding: '1px 4px',
                                                    background: '#eee',
                                                    borderRadius: 4,
                                                    color: '#666',
                                                  }}
                                                >
                                                  {existingSource.split(':')[0]}
                                                </span>
                                              )}
                                            </PillButton>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                        {/* Expertise */}
                        {selectedFeatData.mechanics?.expertise &&
                          (() => {
                            const profs = Array.isArray(selectedFeatData.mechanics.expertise)
                              ? selectedFeatData.mechanics.expertise[0]
                              : selectedFeatData.mechanics.expertise;
                            const options =
                              profs.options.includes('Any') || profs.options.includes('any')
                                ? ALL_SKILLS
                                : profs.options;

                            return (
                              <div>
                                <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: 8 }}>
                                  专精选择 (选 {profs.count}):
                                </p>
                                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                  {options.map((skill: string) => {
                                    const existingExpertise = baseProficiencies.expertise[skill];
                                    const isSelected = activeChoices?.expertise?.includes(skill);

                                    // Can only select for expertise if proficient
                                    const isProficient =
                                      !!baseProficiencies.skills[skill] ||
                                      activeChoices?.skills?.includes(skill);
                                    const disabled = !isProficient || !!existingExpertise;

                                    return (
                                      <div key={skill} style={{ position: 'relative' }}>
                                        <PillButton
                                          size="sm"
                                          variant={isSelected ? 'primary' : 'outline'}
                                          disabled={disabled && !isSelected}
                                          onClick={() => {
                                            if (existingExpertise || (!isProficient && !isSelected))
                                              return;
                                            const currentExpertise = activeChoices?.expertise || [];
                                            const next = isSelected
                                              ? currentExpertise.filter((s) => s !== skill)
                                              : [...currentExpertise, skill].slice(0, profs.count);
                                            handleUpdateFeatChoice(activeSlot.id, {
                                              expertise: next,
                                            });
                                          }}
                                          style={{
                                            opacity: disabled && !isSelected ? 0.5 : 1,
                                            cursor:
                                              disabled && !isSelected ? 'not-allowed' : 'pointer',
                                            borderColor: isSelected
                                              ? 'var(--color-gold-accent)'
                                              : disabled
                                                ? 'var(--color-border-dark)'
                                                : undefined,
                                          }}
                                        >
                                          {translateSkill(skill)}
                                          {existingExpertise && (
                                            <span
                                              style={{
                                                fontSize: '9px',
                                                marginLeft: 4,
                                                padding: '1px 4px',
                                                background: '#eee',
                                                borderRadius: 4,
                                                color: '#666',
                                              }}
                                            >
                                              已专精
                                            </span>
                                          )}
                                          {!existingExpertise && !isProficient && (
                                            <span
                                              style={{
                                                fontSize: '9px',
                                                marginLeft: 4,
                                                padding: '1px 4px',
                                                background: '#eee',
                                                borderRadius: 4,
                                                color: '#666',
                                              }}
                                            >
                                              需熟练
                                            </span>
                                          )}
                                        </PillButton>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}

                        {/* Spells */}
                        {selectedFeatData.mechanics?.spells &&
                          (() => {
                            const spellReqs = selectedFeatData.mechanics.spells;
                            const masterListOptions =
                              spellReqs.find((r) => r.listOptions)?.listOptions || [];

                            let forcedList: string | undefined = undefined;
                            if (
                              activeSlot.id === 'background-feat' &&
                              background?.feat?.mechanicsOverride?.spellList
                            ) {
                              forcedList = background.feat.mechanicsOverride.spellList[0];
                            }

                            const rawSpellList =
                              forcedList ||
                              activeChoices?.spellList ||
                              (masterListOptions.length === 1 ? masterListOptions[0] : undefined);
                            const currentSpellList =
                              masterListOptions.length === 1 &&
                              masterListOptions[0] !== rawSpellList
                                ? masterListOptions[0]
                                : rawSpellList;

                            return (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                                {/* 1. Spell List Selector */}
                                {masterListOptions.length > 1 && !forcedList && (
                                  <div>
                                    <p
                                      style={{ fontSize: '13px', fontWeight: 600, marginBottom: 8 }}
                                    >
                                      选择法术列表:
                                    </p>
                                    <div style={{ display: 'flex', gap: 6 }}>
                                      {masterListOptions.map((lo) => {
                                        const isSchool = [
                                          'divination',
                                          'enchantment',
                                          'illusion',
                                          'necromancy',
                                          'evocation',
                                          'abjuration',
                                          'transmutation',
                                          'conjuration',
                                        ].includes(lo.toLowerCase());
                                        return (
                                          <PillButton
                                            key={lo}
                                            size="sm"
                                            variant={
                                              currentSpellList === lo ? 'primary' : 'outline'
                                            }
                                            onClick={() => {
                                              handleUpdateFeatChoice(activeSlot.id, {
                                                spellList: lo,
                                                spells: [],
                                              });
                                              setSpellPreview(null);
                                            }}
                                          >
                                            {isSchool
                                              ? translateSpellSchool(lo)
                                              : translateClass(lo)}
                                          </PillButton>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}

                                {/* 2. Mature Spell Selection UI */}
                                {currentSpellList &&
                                  spellReqs.map((spellReq, sIdx) => {
                                    const chosenSpells = activeChoices?.spells || [];
                                    const availableSpells = allSpells.filter((s) => {
                                      if (s.level !== spellReq.level) return false;

                                      // Check if this specific requirement is a fixed spell (e.g. Misty Step)
                                      const isFixedEntry =
                                        spellReq.listOptions &&
                                        spellReq.listOptions.length === 1 &&
                                        !spellReq.listOptions[0].includes(',') &&
                                        ![
                                          'cleric',
                                          'druid',
                                          'wizard',
                                          'paladin',
                                          'ranger',
                                          'bard',
                                          'sorcerer',
                                          'warlock',
                                        ].includes(spellReq.listOptions[0].toLowerCase()) &&
                                        ![
                                          'divination',
                                          'enchantment',
                                          'illusion',
                                          'necromancy',
                                          'evocation',
                                          'abjuration',
                                          'transmutation',
                                          'conjuration',
                                          'ritual',
                                        ].includes(spellReq.listOptions[0].toLowerCase());

                                      if (isFixedEntry) {
                                        const target = spellReq.listOptions![0].toLowerCase();
                                        return (
                                          s.id.toLowerCase() === target ||
                                          s.nameEn.toLowerCase() === target
                                        );
                                      }

                                      // Standard filtering by chosen list (Class or School)
                                      const targetLists = currentSpellList
                                        .split(',')
                                        .map((l) => l.trim().toLowerCase());
                                      const baseMatch =
                                        currentSpellList === 'Any' ||
                                        targetLists.some((list) => {
                                          const mappedClass = translateClass(list);
                                          const isClassMatch = s.classes.includes(mappedClass);
                                          const isSchoolMatch = s.school.toLowerCase() === list;
                                          const isRitualMatch =
                                            list === 'ritual' &&
                                            (s.ritual || s.castingTime.includes('仪式'));
                                          return isClassMatch || isSchoolMatch || isRitualMatch;
                                        });
                                      if (spellReq.ritualOnly) {
                                        return (
                                          baseMatch && (s.ritual || s.castingTime.includes('仪式'))
                                        );
                                      }
                                      return baseMatch;
                                    });

                                    const isFixedSpell =
                                      availableSpells.length === 1 &&
                                      spellReq.count === 1 &&
                                      spellReq.listOptions &&
                                      spellReq.listOptions.length === 1 &&
                                      (availableSpells[0].nameEn.toLowerCase() ===
                                        spellReq.listOptions[0].toLowerCase() ||
                                        availableSpells[0].id === spellReq.listOptions[0]);

                                    // Source Filtering for Spell Library
                                    const spellSources = Array.from(
                                      new Set(
                                        availableSpells.map((s) => translateSource(s.source)),
                                      ),
                                    ).sort();

                                    const filteredSpells = availableSpells.filter((s) => {
                                      const matchesSearch =
                                        !spellSearch ||
                                        s.name.includes(spellSearch) ||
                                        s.nameEn.toLowerCase().includes(spellSearch.toLowerCase());
                                      const effectiveSpellSource =
                                        spellSourceFilter &&
                                        spellSources.includes(spellSourceFilter)
                                          ? spellSourceFilter
                                          : null;
                                      const matchesSource =
                                        !effectiveSpellSource ||
                                        translateSource(s.source) === effectiveSpellSource;
                                      return matchesSearch && matchesSource;
                                    });

                                    const currentPreview =
                                      spellPreview?.reqIndex === sIdx
                                        ? allSpells.find((s) => s.id === spellPreview.id)
                                        : undefined;
                                    const levelTitle =
                                      spellReq.level === 0
                                        ? '戏法 Cantrips'
                                        : `${spellReq.level} 环法术 Level ${spellReq.level}`;

                                    // Auto-select fixed spells if not present
                                    if (
                                      isFixedSpell &&
                                      !chosenSpells.includes(availableSpells[0].id)
                                    ) {
                                      setTimeout(() => {
                                        handleUpdateFeatChoice(activeSlot.id, {
                                          spells: [...chosenSpells, availableSpells[0].id],
                                        });
                                      }, 0);
                                    }

                                    return (
                                      <div
                                        key={sIdx}
                                        style={{
                                          padding: '12px 14px',
                                          background: 'var(--color-bg-dark)',
                                          borderRadius: '10px',
                                          border: '1px solid var(--color-border-dark)',
                                          boxShadow: 'var(--shadow-subtle)',
                                        }}
                                      >
                                        {isFixedSpell ? (
                                          <div
                                            style={{
                                              display: 'flex',
                                              justifyContent: 'space-between',
                                              alignItems: 'center',
                                              marginBottom: 8,
                                            }}
                                          >
                                            <h4
                                              style={{
                                                margin: 0,
                                                fontSize: '13px',
                                                fontWeight: 700,
                                                color: 'var(--color-gold-bright)',
                                                fontFamily: 'var(--font-family-serif)',
                                              }}
                                            >
                                              获得 {levelTitle}
                                            </h4>
                                            <div
                                              style={{
                                                fontSize: '9px',
                                                color: 'var(--color-gold-bright)',
                                                fontWeight: 600,
                                                background: 'rgba(197, 160, 89, 0.15)',
                                                padding: '1px 5px',
                                                borderRadius: 4,
                                                border: '1px solid var(--color-border-gold)',
                                              }}
                                            >
                                              固定获得
                                            </div>
                                          </div>
                                        ) : (
                                          <>
                                            <div
                                              style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                marginBottom: 8,
                                              }}
                                            >
                                              <h4
                                                style={{
                                                  margin: 0,
                                                  fontSize: '13px',
                                                  fontWeight: 700,
                                                }}
                                              >
                                                {levelTitle} 选择
                                              </h4>
                                              <div style={{ fontSize: '10px', color: '#86868b' }}>
                                                已选{' '}
                                                {
                                                  chosenSpells.filter(
                                                    (id: string) =>
                                                      allSpells.find((s) => s.id === id)?.level ===
                                                      spellReq.level,
                                                  ).length
                                                }
                                                /{spellReq.count}
                                              </div>
                                            </div>

                                            {/* Source Filters */}
                                            <div
                                              style={{
                                                display: 'flex',
                                                gap: '3px',
                                                flexWrap: 'wrap',
                                                marginBottom: '10px',
                                                borderBottom: '1px solid #f5f5f7',
                                                paddingBottom: '6px',
                                              }}
                                            >
                                              <PillButton
                                                size="xs"
                                                variant={
                                                  !spellSourceFilter ||
                                                  !spellSources.includes(spellSourceFilter)
                                                    ? 'primary'
                                                    : 'outline'
                                                }
                                                onClick={() => setSpellSourceFilter(null)}
                                                style={{
                                                  fontSize: '9px',
                                                  padding: '1px 5px',
                                                  minHeight: '18px',
                                                }}
                                              >
                                                全部
                                              </PillButton>
                                              {spellSources.map((src) => (
                                                <PillButton
                                                  key={src}
                                                  size="xs"
                                                  variant={
                                                    spellSourceFilter === src &&
                                                    spellSources.includes(spellSourceFilter)
                                                      ? 'primary'
                                                      : 'outline'
                                                  }
                                                  onClick={() => setSpellSourceFilter(src)}
                                                  style={{
                                                    fontSize: '9px',
                                                    padding: '1px 5px',
                                                    minHeight: '18px',
                                                  }}
                                                >
                                                  {src}
                                                </PillButton>
                                              ))}
                                            </div>
                                          </>
                                        )}

                                        {/* Pill Grid */}
                                        <div
                                          style={{
                                            display: 'flex',
                                            gap: 4,
                                            flexWrap: 'wrap',
                                            marginBottom: currentPreview ? 10 : 0,
                                          }}
                                        >
                                          {isFixedSpell ? (
                                            <div
                                              style={{
                                                padding: '6px 14px',
                                                background: 'var(--color-bg-dark)',
                                                borderRadius: 16,
                                                border: '1px solid #d2d2d7',
                                                color: 'var(--color-text-primary)',
                                                fontSize: '14px',
                                                fontWeight: 600,
                                              }}
                                            >
                                              {availableSpells[0].name}
                                            </div>
                                          ) : (
                                            filteredSpells.map((s) => {
                                              const isSelected = chosenSpells.includes(s.id);
                                              return (
                                                <PillButton
                                                  key={s.id}
                                                  size="sm"
                                                  variant={isSelected ? 'primary' : 'outline'}
                                                  onClick={() => {
                                                    setSpellPreview({ id: s.id, reqIndex: sIdx });
                                                    const isLevelFull =
                                                      chosenSpells.filter(
                                                        (id: string) =>
                                                          allSpells.find((ds) => ds.id === id)
                                                            ?.level === spellReq.level,
                                                      ).length >= spellReq.count;
                                                    let next;
                                                    if (isSelected) {
                                                      next = chosenSpells.filter(
                                                        (id: string) => id !== s.id,
                                                      );
                                                    } else {
                                                      if (isLevelFull) {
                                                        const sameLevel = chosenSpells.filter(
                                                          (id: string) =>
                                                            allSpells.find((ds) => ds.id === id)
                                                              ?.level === spellReq.level,
                                                        );
                                                        const others = chosenSpells.filter(
                                                          (id: string) => !sameLevel.includes(id),
                                                        );
                                                        next = [
                                                          ...others,
                                                          ...sameLevel.slice(1),
                                                          s.id,
                                                        ];
                                                      } else {
                                                        next = [...chosenSpells, s.id];
                                                      }
                                                    }
                                                    handleUpdateFeatChoice(activeSlot.id, {
                                                      spells: next,
                                                    });
                                                  }}
                                                >
                                                  {s.name}
                                                </PillButton>
                                              );
                                            })
                                          )}
                                        </div>

                                        {/* Detailed Preview Panel */}
                                        {currentPreview && (
                                          <div
                                            style={{
                                              padding: '20px',
                                              background: 'var(--color-bg-dark)',
                                              borderRadius: '12px',
                                              border: '1px solid #e5e5e7',
                                              marginTop: 12,
                                            }}
                                          >
                                            <div
                                              style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'flex-start',
                                                marginBottom: 12,
                                              }}
                                            >
                                              <div>
                                                <h5
                                                  style={{
                                                    margin: 0,
                                                    fontSize: '18px',
                                                    fontWeight: 700,
                                                  }}
                                                >
                                                  {currentPreview.name}{' '}
                                                  <span
                                                    style={{
                                                      fontSize: '12px',
                                                      color: '#86868b',
                                                      fontWeight: 400,
                                                    }}
                                                  >
                                                    {currentPreview.nameEn}
                                                  </span>
                                                </h5>
                                              </div>
                                              <div
                                                style={{
                                                  fontSize: '11px',
                                                  color: 'var(--color-gold-accent)',
                                                  fontWeight: 600,
                                                }}
                                              >
                                                {translateSource(currentPreview.source)}
                                              </div>
                                            </div>
                                            <div
                                              style={{
                                                borderTop: '1px dotted #d2d2d7',
                                                paddingTop: '12px',
                                                display: 'flex',
                                                gap: '16px',
                                                flexWrap: 'wrap',
                                                marginBottom: '16px',
                                              }}
                                            >
                                              <div style={{ fontSize: '12px', color: '#86868b' }}>
                                                等级:{' '}
                                                <span
                                                  style={{ color: 'var(--color-text-primary)' }}
                                                >
                                                  {currentPreview.level === 0
                                                    ? '戏法'
                                                    : `${currentPreview.level} 环`}
                                                </span>
                                              </div>
                                              <div style={{ fontSize: '12px', color: '#86868b' }}>
                                                学派:{' '}
                                                <span
                                                  style={{ color: 'var(--color-text-primary)' }}
                                                >
                                                  {translateSpellSchool(currentPreview.school)}
                                                </span>
                                              </div>
                                              <div style={{ fontSize: '12px', color: '#86868b' }}>
                                                施法时间:{' '}
                                                <span
                                                  style={{ color: 'var(--color-text-primary)' }}
                                                >
                                                  {currentPreview.castingTime}
                                                </span>
                                              </div>
                                              <div style={{ fontSize: '12px', color: '#86868b' }}>
                                                距离:{' '}
                                                <span
                                                  style={{ color: 'var(--color-text-primary)' }}
                                                >
                                                  {formatSpellRange(currentPreview.range)}
                                                </span>
                                              </div>
                                              <div style={{ fontSize: '12px', color: '#86868b' }}>
                                                持续时间:{' '}
                                                <span
                                                  style={{ color: 'var(--color-text-primary)' }}
                                                >
                                                  {currentPreview.duration}
                                                </span>
                                              </div>
                                              <div style={{ fontSize: '12px', color: '#86868b' }}>
                                                成分:{' '}
                                                <span
                                                  style={{ color: 'var(--color-text-primary)' }}
                                                >
                                                  {currentPreview.components}
                                                </span>
                                              </div>
                                            </div>
                                            <div
                                              style={{
                                                fontSize: '13px',
                                                lineHeight: 1.6,
                                                color: '#424245',
                                              }}
                                            >
                                              <MarkdownText text={currentPreview.description} />
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                              </div>
                            );
                          })()}

                        {/* Languages */}
                        {selectedFeatData.mechanics?.languageProficiencies &&
                          (() => {
                            const profReqs = Array.isArray(
                              selectedFeatData.mechanics.languageProficiencies,
                            )
                              ? selectedFeatData.mechanics.languageProficiencies
                              : [selectedFeatData.mechanics.languageProficiencies];
                            return profReqs.map((prof, pIdx) => {
                              const options = allLanguages.filter(
                                (l) => langCategory === 'All' || l.type === langCategory,
                              );

                              return (
                                <div key={pIdx}>
                                  <p style={{ fontSize: '13px', fontWeight: 600, marginBottom: 8 }}>
                                    语言熟练 (选 {prof.count}):
                                  </p>
                                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                    {options.map((lang) => {
                                      const existingSource =
                                        baseProficiencies.languages[lang.nameEn];
                                      const isSelected = activeChoices?.languages?.includes(
                                        lang.nameEn,
                                      );
                                      const isDisabled = !isSelected && !!existingSource;

                                      return (
                                        <PillButton
                                          key={lang.id}
                                          size="sm"
                                          variant={isSelected ? 'primary' : 'outline'}
                                          disabled={isDisabled}
                                          onClick={() => {
                                            if (isDisabled) return;
                                            const currentLangs = activeChoices?.languages || [];
                                            const next = isSelected
                                              ? currentLangs.filter((l) => l !== lang.nameEn)
                                              : [...currentLangs, lang.nameEn].slice(0, prof.count);
                                            handleUpdateFeatChoice(activeSlot.id, {
                                              languages: next,
                                            });
                                          }}
                                          style={{
                                            opacity: isDisabled ? 0.5 : 1,
                                            cursor: isDisabled ? 'not-allowed' : 'pointer',
                                          }}
                                        >
                                          {lang.name}
                                          {existingSource && !isSelected && (
                                            <span
                                              style={{
                                                fontSize: '9px',
                                                marginLeft: 4,
                                                padding: '1px 4px',
                                                background: '#eee',
                                                borderRadius: 4,
                                                color: '#666',
                                              }}
                                            >
                                              {existingSource.split(':')[0]}
                                            </span>
                                          )}
                                        </PillButton>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            });
                          })()}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#86868b',
                      textAlign: 'center',
                    }}
                  >
                    <div style={{ fontSize: '48px', marginBottom: 16 }}>⬅️</div>
                    <p style={{ fontSize: '16px', fontWeight: 500 }}>请在左侧选择专长</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className={styles.emptyState}>
              <p>暂无可用专长槽位</p>
            </div>
          )}
        </div>
      </div>
      {/* Confirmation Modal */}
      {confirmingFeatId &&
        (() => {
          const feat = allFeats.find((f) => f.id === confirmingFeatId);
          return (
            <div
              style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: 'rgba(0,0,0,0.4)',
                backdropFilter: 'blur(10px)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 1000,
                animation: 'fadeIn 0.2s ease',
              }}
            >
              <div
                style={{
                  backgroundColor: 'white',
                  padding: '32px',
                  borderRadius: '24px',
                  maxWidth: '400px',
                  width: '90%',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.2)',
                  textAlign: 'center',
                }}
              >
                <h3 style={{ fontSize: '20px', fontWeight: 700, marginBottom: 16 }}>
                  确认更换专长？
                </h3>
                <p
                  style={{ color: '#86868b', fontSize: '15px', lineHeight: 1.5, marginBottom: 24 }}
                >
                  你正在尝试更换 <strong>{activeSlot?.name || '当前'}</strong> 槽位的专长为{' '}
                  <strong>{feat?.name}</strong>。<br />
                  这将会重置当前已选专长的所有精细化配置（如属性加成、技能熟练等）。
                </p>
                <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                  <PillButton variant="outline" onClick={() => setConfirmingFeatId(null)}>
                    取消
                  </PillButton>
                  <PillButton
                    variant="primary"
                    onClick={() => handleSelectFeat(confirmingFeatId, true)}
                  >
                    确认更换
                  </PillButton>
                </div>
              </div>
            </div>
          );
        })()}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
