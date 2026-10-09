'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { getCatalogBackgrounds, getCatalogFeats, getCatalogSpecies } from '@/catalog';
import { useCatalog } from '@/platform/CatalogProvider';
import { getBackgroundDefinition, getSpeciesDefinition } from '@/engine/characterData';

import { useCharacterStore } from '@/store/characterStore';
import OptionCard from '@/components/OptionCard';
import PillButton from '@/components/PillButton';
import MarkdownText from '@/components/MarkdownText';
import styles from '../species/page.module.css'; // Reuse species layout styles
import { Background, FlavorTable } from '@/types/background';
import { Selection } from '@/types/species';
import { 
  getCatalogTools,
  getToolCategory,
  getToolDisplayName,
  ALL_STANDARD_TOOLS 
} from '@/catalog/tools';

import { ALL_GAME_LANGUAGES } from '@/rules/languages';
import { getSourceDisplayName, getSourceSortWeight } from '@/config/sourceMapping';
import {
  normalizeAbilityKey, 
  translateAbilityKey, 
  translateSkill, 
  translateProficiency,
  ALL_TOOLS,
  ALL_LANGUAGES,
  ALL_SKILLS
} from '@/engine/terminology';

/**
 * Local component for collapsible sections in background description
 */
const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div style={{ 
      margin: '16px 0', 
      border: '1px solid var(--color-border-dark)', 
      borderRadius: '12px', 
      overflow: 'hidden',
      background: 'var(--color-bg-dark)',
      boxShadow: 'var(--shadow-subtle)'
    }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          padding: '14px 16px', 
          background: 'var(--color-bg-surface)', 
          cursor: 'pointer', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          userSelect: 'none',
          transition: 'background 0.2s ease'
        }}
      >
        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: 'var(--color-text-primary)', fontFamily: 'var(--font-family-serif)' }}>{title}</h4>
        <span style={{ 
          transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', 
          transition: 'transform 0.2s ease',
          fontSize: '10px',
          color: 'var(--color-gold-bright)'
        }}>▶</span>
      </div>
      {isOpen && (
        <div style={{ padding: '16px', borderTop: '1px solid var(--color-border-dark)', background: 'var(--color-bg-dark)' }}>
          {children}
        </div>
      )}
    </div>
  );
};

export default function BackgroundPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { characters, updateActiveCharacter, loadCharacter } = useCharacterStore();
  const { status: catalogStatus } = useCatalog();
  const character = id ? characters[id] : null;

  const [bonusScheme, setBonusScheme] = useState<'2-1' | '1-1-1' | 'none'>('none');
  const [enableLegacyAsi, setEnableLegacyAsi] = useState(false);
  const [expandedSources, setExpandedSources] = useState<string[]>(['2024 核心规则 (Core)']);
  const [langCategory, setLangCategory] = useState<string>('Standard');
  const [langSource, setLangSource] = useState<string>('XPHB');
  const [toolCategory, setToolCategory] = useState<string>('All');
  
  const detailsPanelRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (id) {
      loadCharacter(id);
    }
  }, [id, loadCharacter]);

  // 切换背景时，自动回滚详情面板到顶部
  useEffect(() => {
    if (detailsPanelRef.current) {
      detailsPanelRef.current.scrollTop = 0;
    }
  }, [character?.backgroundId]);



  const catalogBackgrounds = useMemo(() => {
    return getCatalogBackgrounds();
  }, [catalogStatus]);

  const selectedBackground = useMemo(() => {
    if (!character) return undefined;
    return getBackgroundDefinition(character) || catalogBackgrounds.find(b => b.id === character.backgroundId && b.source === character.backgroundSource) || catalogBackgrounds.find(b => b.id === character.backgroundId);
  }, [character, catalogBackgrounds]);

  // Grouping logic
  const backgroundGroups = useMemo(() => {
    const groups: Record<string, Background[]> = {};
    catalogBackgrounds.forEach(bg => {
      const groupName = bg.source === 'XPHB' || bg.source === 'PHB2024' ? '2024 核心规则 (Core)' : 
                        bg.source === 'PHB' || bg.source === 'PHB2014' ? '2014 经典规则 (Legacy)' : 
                        getSourceDisplayName(bg.source);
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(bg);
    });
    return groups;
  }, [catalogBackgrounds]);


  const toggleGroup = (groupName: string) => {
    setExpandedSources(prev => 
      prev.includes(groupName) ? prev.filter(g => g !== groupName) : [...prev, groupName]
    );
  };

  const handleSelectBackground = (bg: Background) => {
    updateActiveCharacter({
      backgroundId: bg.id,
      backgroundSource: bg.source,
      backgroundVariantId: undefined, // 切换背景时清除变体
      backgroundAbilityBonuses: {}, 
      backgroundSelections: {
        [`bg:${bg.id}:equipment`]: ['choiceA'] // 默认选中方案 A
      }, 
      originFeatId: bg.feat?.nameEn,
    });
    setBonusScheme('none');
    setEnableLegacyAsi(false);
  };

  const handleSelectVariant = (variantId: string | null) => {
    const bg = selectedBackground;
    const variant = bg?.variants?.find(v => v.id === variantId);
    const effectiveBg = variant?.overrides ? { ...bg, ...variant.overrides } : bg;
    
    updateActiveCharacter({
      backgroundVariantId: variantId || undefined,
      backgroundSelections: {
        [`bg:${bg?.id}:equipment`]: ['choiceA']
      }
    });
  };

  const activeBackground = useMemo(() => {
    if (!selectedBackground || !character) return null;
    if (character.backgroundVariantId) {
      const variant = selectedBackground.variants?.find(v => v.id === character.backgroundVariantId);
      if (variant?.overrides) {
        return {
          ...selectedBackground,
          ...variant.overrides,
        };
      }
    }
    return selectedBackground;
  }, [selectedBackground, character?.backgroundVariantId]);

  const preSelectedLanguages = useMemo(() => {
    const langs: string[] = [];
    if (!character || !character.speciesId) return langs;
    
    const species = getSpeciesDefinition(character) || getCatalogSpecies().find(s => s.id === character.speciesId);
    if (species) {
      const checkTrait = (traits: any[]) => {
        traits.forEach(trait => {
          if (trait.features?.languages) {
            trait.features.languages.forEach((l: any) => {
              if (typeof l === 'string') langs.push(l.toLowerCase());
            });
          }
          if (trait.options) checkTrait(trait.options);
        });
      };
      checkTrait(species.traits);
      
      // Check subSpecies selections
      if (character.subspeciesId && species.subSpecies?.options) {
        const sub = species.subSpecies.options.find(o => o.id === character.subspeciesId);
        if (sub) checkTrait(sub.traits);
      }
    }
    
    // From species selections
    if (character.speciesSelections) {
      Object.values(character.speciesSelections).forEach(selected => {
        selected.forEach(s => {
          const sLow = s.toLowerCase();
          if (ALL_GAME_LANGUAGES.some(pl => pl.id.toLowerCase() === sLow || pl.nameEn.toLowerCase() === sLow)) {
            langs.push(sLow);
          }
        });
      });
    }
    
    return Array.from(new Set(langs));
  }, [character]);

  const currentBackgroundDisplayName = useMemo(() => {
    if (!activeBackground) return '';
    return activeBackground.name;
  }, [activeBackground]);

  const handleSelection = (choiceId: string, value: string, numToChoose: number = 1) => {
    if (!character) return;
    const currentSelections = { ...(character.backgroundSelections || {}) };
    let values = currentSelections[choiceId] || [];
    
    if (values.includes(value)) {
      values = values.filter(v => v !== value);
    } else {
      if (values.length < numToChoose) {
        values = [...values, value];
      } else if (numToChoose === 1) {
        values = [value];
      }
    }

    updateActiveCharacter({
      backgroundSelections: {
        ...currentSelections,
        [choiceId]: values
      }
    });
  };

  const handleSchemeChange = (scheme: '2-1' | '1-1-1') => {
    setBonusScheme(scheme);
    const newBonuses: any = {};
    if (scheme === '1-1-1' && selectedBackground?.abilityScoreOptions) {
      if (selectedBackground.abilityScoreOptions.length === 3) {
        selectedBackground.abilityScoreOptions.forEach(opt => {
          const key = normalizeAbilityKey(opt);
          if (key) newBonuses[key] = 1;
        });
      }
    }
    updateActiveCharacter({ backgroundAbilityBonuses: newBonuses });
  };

  const handleStatBonusChange = (stat: string, value: number) => {
    const abilityKey = normalizeAbilityKey(stat);
    if (!abilityKey || !character) return;
    const currentBonuses = { ...(character.backgroundAbilityBonuses || {}) } as Record<string, number>;
    if (bonusScheme === '2-1') {
      if (value === 2) {
        Object.keys(currentBonuses).forEach(k => { if (currentBonuses[k] === 2) delete currentBonuses[k]; });
        currentBonuses[abilityKey] = 2;
      } else if (value === 1) {
        Object.keys(currentBonuses).forEach(k => { if (currentBonuses[k] === 1) delete currentBonuses[k]; });
        currentBonuses[abilityKey] = 1;
      } else { delete currentBonuses[abilityKey]; }
    } else if (bonusScheme === '1-1-1') {
      if (currentBonuses[abilityKey]) delete currentBonuses[abilityKey];
      else if (Object.keys(currentBonuses).length < 3) currentBonuses[abilityKey] = 1;
    }
    updateActiveCharacter({ backgroundAbilityBonuses: currentBonuses });
  };

  const handleToggleLegacyAsi = (enabled: boolean) => {
    setEnableLegacyAsi(enabled);
    if (!enabled) {
      updateActiveCharacter({ backgroundAbilityBonuses: {} });
      setBonusScheme('none');
    }
  };

  // Selection Renderer Helper
  const renderSelection = (id: string, selection: Selection<string>, compact: boolean = false, category?: 'tool' | 'language' | 'skill') => {
    const chosen = character?.backgroundSelections?.[id] || [];
    
    let options = selection.options;
    const isAny = selection.options.some(opt => typeof opt === 'string' && opt.toLowerCase() === 'any');
    if (isAny) {
      if (category === 'language') {
        options = ALL_GAME_LANGUAGES
          .filter(l => {
            const matchesCat = langCategory === 'All' || l.type === langCategory;
            const hasSource = ALL_GAME_LANGUAGES.some(x => (langCategory === 'All' || x.type === langCategory) && x.source === langSource);
            const matchesSource = langSource === 'All' || !hasSource || l.source === langSource;
            return matchesCat && matchesSource;
          })
          .map(l => l.id);
      }
      else if (category === 'skill') options = ALL_SKILLS;
      else options = getCatalogTools();
    }
    const isComplete = chosen.length === selection.numToChoose;

    // 判断选项池是否跨越多个不同工具分类
    const isMultiCategoryTool = category === 'tool' && (isAny || (() => {
      const distinctCats = new Set(options.map(opt => getToolCategory(opt)).filter(c => c !== 'Unknown'));
      return distinctCats.size > 1;
    })());

    const displayOptions = isMultiCategoryTool
      ? options.filter(opt => {
          if (toolCategory === 'All') return true;
          return getToolCategory(opt) === toolCategory;
        })
      : options;

    return (
      <div key={id} className="pixel-surface" style={{
        marginTop: compact ? 8 : 20, 
        padding: compact ? '14px 16px' : 20, 
        border: isComplete ? '3px solid var(--color-apple-blue)' : '1px solid var(--color-border-dark)',
        borderRadius: 14,
        background: isComplete ? 'var(--color-bg-surface-elevated)' : 'var(--color-bg-dark)',
        backdropFilter: 'blur(10px)',
        boxShadow: 'var(--shadow-subtle)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Apple-style subtle status indicator bar on the left */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: isComplete ? 'var(--color-primary)' : 'transparent',
          opacity: 0.8
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: compact ? 10 : 14 }}>
          <span style={{ 
            fontSize: compact ? '0.85rem' : '1rem', 
            fontWeight: 700, 
            color: isComplete ? 'var(--color-apple-blue)' : 'var(--color-text-primary)',
            letterSpacing: '-0.02em',
            display: 'flex',
            alignItems: 'center',
            gap: 6
          }}>
            {selection.name || (category === 'tool' ? '工具自选' : category === 'language' ? '语言自选' : category === 'skill' ? '技能自选' : '自选项目')}
            {isComplete && <span style={{ fontSize: '0.8rem' }}>✓</span>}
          </span>
          <span style={{ 
            fontSize: '0.75rem', 
            color: isComplete ? 'var(--color-apple-blue)' : 'var(--color-text-secondary)',
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 10,
            background: 'var(--color-bg-surface)'
          }}>
            {chosen.length}/{selection.numToChoose}
          </span>
        </div>
        
        {category === 'language' && isAny && (
          <div style={{ marginBottom: '16px' }}>
            <div style={{display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'8px'}}>
              {['Standard', 'Rare', 'Exotic', 'All'].map(cat => (
                <button
                  key={cat}
                  onClick={(e) => { e.stopPropagation(); setLangCategory(cat); }}
                  style={{
                    padding: '4px 10px', fontSize: '11px', borderRadius: '6px', border: 'none',
                    background: langCategory === cat ? 'var(--color-gold-accent)' : 'transparent',
                    color: langCategory === cat ? 'white' : '#86868b',
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  {cat === 'All' ? '所有稀有度' : cat === 'Standard' ? '标准' : cat === 'Rare' ? '稀有' : '特种'}
                </button>
              ))}
            </div>
            <div style={{display:'flex', flexWrap:'wrap', gap:'6px', paddingBottom:'8px', borderBottom:'1px solid #eee'}}>
              {['All', ...Array.from(new Set(ALL_GAME_LANGUAGES.filter(l => langCategory === 'All' || l.type === langCategory).map(l => l.source || 'Unknown')))].map(src => (
                <button
                  key={src}
                  onClick={(e) => { e.stopPropagation(); setLangSource(src); }}
                  style={{
                    padding: '4px 10px', fontSize: '11px', borderRadius: '6px', border: 'none',
                    background: (langSource === src || (src === 'All' && !ALL_GAME_LANGUAGES.some(x => (langCategory === 'All' || x.type === langCategory) && x.source === langSource))) ? '#34c759' : 'transparent',
                    color: (langSource === src || (src === 'All' && !ALL_GAME_LANGUAGES.some(x => (langCategory === 'All' || x.type === langCategory) && x.source === langSource))) ? 'white' : '#86868b',
                    cursor: 'pointer', transition: 'all 0.2s'
                  }}
                >
                  {src === 'All' ? '所有来源' : getSourceDisplayName(src)}
                </button>
              ))}
            </div>
          </div>
        )}

        {isMultiCategoryTool && (
          <div style={{ marginBottom: '14px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {[
              { id: 'All', label: '全部' },
              { id: 'Artisan', label: '工匠工具' },
              { id: 'Gaming', label: '赌具' },
              { id: 'Musical', label: '乐器' },
              { id: 'Other', label: '其他工具' },
              { id: 'Vehicle', label: '载具' },
            ].map(cat => (
              <button
                key={cat.id}
                onClick={(e) => { e.stopPropagation(); setToolCategory(cat.id); }}
                style={{
                  padding: '4px 10px',
                  fontSize: '11px',
                  borderRadius: '6px',
                  border: 'none',
                  background: toolCategory === cat.id ? 'var(--color-apple-blue)' : 'rgba(0,0,0,0.06)',
                  color: toolCategory === cat.id ? '#fff' : 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  fontWeight: toolCategory === cat.id ? 700 : 500,
                  transition: 'all 0.2s'
                }}
              >
                {cat.label}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {displayOptions.length === 0 ? (
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', padding: '8px 0' }}>该分类下暂无可选工具</div>
          ) : (
            displayOptions.map(opt => {
              const optLow = opt.toLowerCase();
              const isPreSelected = category === 'language' && preSelectedLanguages.includes(optLow);
              const isChosen = chosen.includes(opt);
              
              return (
                <PillButton
                  key={opt}
                  size={compact ? 'xs' : 'sm'}
                  variant={isChosen ? 'primary' : 'outline'}
                  disabled={isPreSelected}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isPreSelected) return;
                    handleSelection(id, opt, selection.numToChoose);
                  }}
                  style={{
                    padding: compact ? '5px 12px' : '8px 16px',
                    fontSize: compact ? '0.8rem' : '0.9rem',
                    borderRadius: 24,
                    borderWidth: isChosen ? 2 : 1,
                    transform: isChosen ? 'scale(1.02)' : 'scale(1)',
                    boxShadow: isChosen ? '0 4px 10px var(--color-border-gold)' : 'none',
                    transition: 'all 0.2s ease',
                    opacity: isPreSelected ? 0.4 : 1,
                    cursor: isPreSelected ? 'not-allowed' : 'pointer',
                    borderColor: isPreSelected ? '#d2d2d7' : undefined,
                    color: isPreSelected ? '#86868b' : undefined,
                    background: isPreSelected ? 'var(--color-bg-dark)' : undefined,
                    border: isPreSelected ? '1px solid var(--color-border-dark)' : undefined,
                  }}
                >
                  {translateProficiency(opt)}
                  {isPreSelected && <span style={{ fontSize: '0.7rem', marginLeft: 4 }}>(已选)</span>}
                </PillButton>
              );
            })
          )}
        </div>
      </div>
    );
  };

  // Find detailed feat data
  let detailedFeat = null;
  if (activeBackground?.feat) {
    const rawEn = activeBackground.feat.nameEn || '';
    const rawCn = activeBackground.feat.name || '';
    const searchId = rawEn.toLowerCase();
    const baseEn = rawEn.split(/[;(（]/)[0].trim().toLowerCase();
    const baseCn = rawCn.split(/[;；(（]/)[0].trim().toLowerCase();

    detailedFeat = getCatalogFeats().find(f => {
      const fId = f.id.toLowerCase();
      const fNameEn = (f.nameEn || '').toLowerCase();
      const fNameCn = (f.name || '').toLowerCase();
      return (
        fId === searchId || 
        fNameEn === searchId || 
        (baseEn && (fId === baseEn || fNameEn === baseEn || searchId.startsWith(fNameEn))) ||
        (baseCn && fNameCn === baseCn)
      );
    });
  }

  const is2024 = Boolean(
    activeBackground && (
      activeBackground.source === 'XPHB' || 
      activeBackground.source === 'PHB2024' ||
      (Boolean(activeBackground.feat) && Boolean(activeBackground.abilityScoreOptions && activeBackground.abilityScoreOptions.length >= 3))
    )
  );
  const isLegacy = !is2024;
  if (!character) return <div className="page-container">加载中...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>背景选择 <span style={{fontWeight:400, color:'#86868b', fontSize:'18px', marginLeft:'8px'}}>Background Selection</span></h2>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.list}>
          {Object.entries(backgroundGroups)
            .sort(([nameA], [nameB]) => {
              const wA = getSourceSortWeight(nameA);
              const wB = getSourceSortWeight(nameB);
              if (wA !== wB) return wA - wB;
              return nameA.localeCompare(nameB, 'zh-Hans-CN');
            })
            .map(([groupName, bgs]) => {
            const isExpanded = expandedSources.includes(groupName);
            return (
              <div key={groupName} className={styles.listGroup}>
                <div className={styles.groupHeader} onClick={() => toggleGroup(groupName)}>
                  <span>{groupName} ({bgs.length})</span>
                  <span className={`${styles.groupIcon} ${isExpanded ? styles.groupIconExpanded : ''}`}>▶</span>
                </div>
                <div className={isExpanded ? styles.groupContent : styles.groupContentHidden}>
                  {bgs.map((bg) => (
                    <OptionCard
                      key={bg.id + bg.source}
                      title={bg.name}
                      subtitle={bg.nameEn}
                      compact
                      selected={character.backgroundId === bg.id && character.backgroundSource === bg.source}
                      onClick={() => handleSelectBackground(bg)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className={styles.detailsPanel} ref={detailsPanelRef}>
          {selectedBackground ? (
            <div className={styles.detailsContent}>
              <h3 className={styles.detailsTitle} style={{ marginBottom: '24px' }}>
                {currentBackgroundDisplayName} 
                <span className={styles.detailsSubtitle}>
                  {character.backgroundVariantId 
                    ? selectedBackground.variants?.find(v => v.id === character.backgroundVariantId)?.nameEn 
                    : selectedBackground.nameEn}
                </span>
                {isLegacy ? (
                  <span style={{ 
                    marginLeft: 12, 
                    fontSize: '0.75rem', 
                    fontWeight: 700, 
                    padding: '3px 8px', 
                    background: 'rgba(234, 179, 8, 0.12)', 
                    color: '#d97706',
                    borderRadius: 6, 
                    verticalAlign: 'middle', 
                    border: '1px solid rgba(234, 179, 8, 0.25)' 
                  }}>
                    2014 经典 (LEGACY)
                  </span>
                ) : (
                  <span style={{ 
                    marginLeft: 12, 
                    fontSize: '0.75rem', 
                    fontWeight: 700, 
                    padding: '3px 8px', 
                    background: 'rgba(59, 130, 246, 0.12)', 
                    color: '#3b82f6',
                    borderRadius: 6, 
                    verticalAlign: 'middle', 
                    border: '1px solid rgba(59, 130, 246, 0.25)' 
                  }}>
                    2024 核心 (CORE)
                  </span>
                )}
              </h3>
              {/* Description Rendering with Collapsible Support */}
              {(() => {
                const description = selectedBackground.description || '';
                // Split by H3 headers (### )
                const parts = description.split(/(?=### )/g);
                
                return parts.map((part, index) => {
                  if (part.startsWith('### ')) {
                    const lines = part.split('\n');
                    const title = lines[0].replace('### ', '').trim();
                    const content = lines.slice(1).join('\n').trim();
                    
                    return (
                      <CollapsibleSection key={index} title={title}>
                        <MarkdownText text={content} />
                      </CollapsibleSection>
                    );
                  }
                  return <MarkdownText key={index} text={part} className={styles.description} />;
                });
              })()}

              {/* Flavor Tables Rendering */}
              {activeBackground?.flavorTables && activeBackground.flavorTables.map((table, idx) => (
                <CollapsibleSection key={`flavor-${idx}`} title={table.name}>
                  <div style={{ overflowX: 'auto', borderRadius: '8px', border: '1px solid var(--color-border-dark)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                      <thead>
                        <tr style={{ background: 'var(--color-bg-dark)', borderBottom: '1px solid var(--color-border-dark)' }}>
                          <th style={{ padding: '8px 12px', textAlign: 'left', width: '60px', color: 'var(--color-gold-bright)' }}>d{table.dice}</th>
                          <th style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--color-gold-bright)' }}>{table.name}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {table.rows.map((row) => (
                          <tr key={row.id} style={{ borderBottom: '1px solid #f2f2f7' }}>
                            <td style={{ padding: '10px', textAlign: 'center', fontWeight: 600, borderRight: '1px solid #f2f2f7', background: '#fafafa' }}>{row.id}</td>
                            <td style={{ padding: '10px', color: '#424245' }}>{row.content}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CollapsibleSection>
              ))}

              {/* Background Variants Selection */}
              {selectedBackground.variants && (
                <div style={{ marginTop: 24, marginBottom: 32 }}>
                  <h5 style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: 12 }}>背景变体 Variant Background</h5>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div 
                      onClick={() => handleSelectVariant(null)}
                      style={{
                        padding: '16px 20px',
                        borderRadius: 12,
                        background: !character.backgroundVariantId ? 'var(--color-bg-subtle)' : 'var(--color-bg-dark)',
                        border: !character.backgroundVariantId ? '2px solid var(--color-apple-blue)' : '1px solid #e5e5e7',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12
                      }}
                    >
                      <div style={{
                        width: 20,
                        height: 20,
                        borderRadius: '50%',
                        border: `2px solid ${!character.backgroundVariantId ? 'var(--color-apple-blue)' : '#d2d2d7'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {!character.backgroundVariantId && <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-apple-blue)' }} />}
                      </div>
                      <span style={{ fontWeight: !character.backgroundVariantId ? 700 : 500, color: !character.backgroundVariantId ? 'var(--color-text-primary)' : '#424245' }}>标准：{selectedBackground.name}</span>
                    </div>

                    {selectedBackground.variants.map(variant => (
                      <div 
                        key={variant.id}
                        onClick={() => handleSelectVariant(variant.id)}
                        style={{
                          padding: '16px 20px',
                          borderRadius: 12,
                          background: character.backgroundVariantId === variant.id ? 'var(--color-bg-subtle)' : 'var(--color-bg-dark)',
                          border: character.backgroundVariantId === variant.id ? '2px solid var(--color-apple-blue)' : '1px solid #e5e5e7',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 8
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          <div style={{
                            width: 20,
                            height: 20,
                            borderRadius: '50%',
                            border: `2px solid ${character.backgroundVariantId === variant.id ? 'var(--color-apple-blue)' : '#d2d2d7'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {character.backgroundVariantId === variant.id && <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--color-apple-blue)' }} />}
                          </div>
                          <span style={{ fontWeight: character.backgroundVariantId === variant.id ? 700 : 500, color: character.backgroundVariantId === variant.id ? 'var(--color-text-primary)' : '#424245' }}>{variant.name}</span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#86868b', paddingLeft: 32, lineHeight: 1.5 }}>{variant.description}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className={styles.traits} style={{ marginTop: '48px' }}>
                {/* ASI Section */}
                <h4 className={styles.sectionTitle}>属性值加成</h4>
                
                {isLegacy && (
                  <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12 }}>
                    <label style={{ fontSize: '0.9rem', fontWeight: 600, color: '#666' }}>开启属性加值 (Manual ASI):</label>
                    <div 
                      onClick={() => handleToggleLegacyAsi(!enableLegacyAsi)}
                      style={{ 
                        width: 44, height: 24, borderRadius: 12, background: enableLegacyAsi ? 'var(--color-apple-blue)' : '#ccc', 
                        position: 'relative', cursor: 'pointer', transition: '0.3s' 
                      }}
                    >
                      <div style={{ 
                        width: 18, height: 18, borderRadius: '50%', background: 'var(--color-bg-dark)', 
                        position: 'absolute', top: 3, left: enableLegacyAsi ? 23 : 3, transition: '0.3s' 
                      }} />
                    </div>
                  </div>
                )}

                {((is2024 && activeBackground?.abilityScoreOptions && activeBackground.abilityScoreOptions.length > 0) || (isLegacy && enableLegacyAsi)) && (
                  <div style={{ marginBottom: 24, padding: '20px', background: 'rgba(0,0,0,0.03)', borderRadius: 14, border: '1px solid rgba(0,0,0,0.05)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <h5 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>属性值加点 (3点预算)</h5>
                        {(() => {
                          const bonuses = (character.backgroundAbilityBonuses as any) || {};
                          const totalUsed = Object.values(bonuses).reduce((a: number, b: any) => a + (b as number), 0);
                          const isComplete = totalUsed === 3;
                          return (
                            <span style={{ 
                              fontSize: '0.75rem', 
                              padding: '2px 8px', 
                              borderRadius: 6, 
                              background: isComplete ? 'rgba(52, 199, 89, 0.1)' : 'rgba(255, 159, 10, 0.1)',
                              color: isComplete ? '#248a3d' : '#c97b00',
                              fontWeight: 700
                            }}>
                              {isComplete ? '已完成分配' : `剩余待分配: ${3 - totalUsed}`}
                            </span>
                          );
                        })()}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#86868b', fontWeight: 500 }}>
                        点击属性增加点数 (单项上限 +2)
                      </div>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                      {(isLegacy ? ['Strength', 'Dexterity', 'Constitution', 'Intelligence', 'Wisdom', 'Charisma'] : activeBackground?.abilityScoreOptions || []).map(stat => {
                        const key = normalizeAbilityKey(stat);
                        const bonuses = (character.backgroundAbilityBonuses as any) || {};
                        const val = key ? (bonuses[key] || 0) : 0;
                        const totalUsed = Object.values(bonuses).reduce((a: number, b: any) => a + (b as number), 0);
                        const pointsLeft = 3 - totalUsed;
                        const isActive = val > 0;
                        
                        const handleClick = () => {
                          if (!key) return;
                          
                          let nextVal = 0;
                          if (val === 0) {
                            // Try to add +1 if points available
                            if (pointsLeft >= 1) nextVal = 1;
                            else nextVal = 0;
                          } else if (val === 1) {
                            // Try to go to +2 if points available
                            if (pointsLeft >= 1) nextVal = 2;
                            else nextVal = 0; // No points left, cycle back to 0
                          } else if (val === 2) {
                            // Already at max, cycle back to 0
                            nextVal = 0;
                          }
                          
                          // Update bonuses manually to avoid scheme restrictions in handleStatBonusChange
                          const newBonuses = { ...bonuses };
                          if (nextVal === 0) delete newBonuses[key];
                          else newBonuses[key] = nextVal;
                          
                          updateActiveCharacter({ backgroundAbilityBonuses: newBonuses });
                        };

                        return (
                          <PillButton
                            key={stat}
                            size="sm"
                            variant={isActive ? 'primary' : 'outline'}
                            onClick={handleClick}
                            style={{
                              padding: '8px 16px',
                              fontSize: '0.9rem',
                              borderRadius: 12,
                              fontWeight: isActive ? 700 : 500,
                              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                              transform: isActive ? 'scale(1.05)' : 'scale(1)',
                              boxShadow: isActive ? '0 4px 12px var(--color-border-gold)' : 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6
                            }}
                          >
                            {key ? translateAbilityKey(key) : stat}
                            {isActive && (
                              <span style={{ 
                                background: 'rgba(255,255,255,0.2)', 
                                padding: '1px 6px', 
                                borderRadius: 4, 
                                fontSize: '0.8rem' 
                              }}>
                                +{val}
                              </span>
                            )}
                          </PillButton>
                        );
                      })}
                    </div>
                  </div>
                )}
                {isLegacy && !enableLegacyAsi && (
                  <p style={{ color: '#999', fontSize: '0.85rem', marginBottom: 24 }}>根据 2014 规则，属性加值通常由种族提供。如需应用 2024 背景 ASI 规则，请开启上方开关。</p>
                )}

                {/* Proficiencies Section */}
                <h4 className={styles.sectionTitle}>熟练项与特性</h4>
                <div style={{ marginBottom: 24 }}>
                  <p style={{ fontSize: '0.95rem' }}>
                    <strong>技能熟练:</strong> {activeBackground?.skillProficiencies.map(s => {
                      if (typeof s === 'string') return translateSkill(s);
                      return null;
                    }).filter(Boolean).join(', ')}
                  </p>
                  {activeBackground?.skillProficiencies.map((s, i) => 
                    typeof s === 'string' ? null : renderSelection(`bg:${activeBackground.id}:prof:skill:${i}`, s, false, 'skill')
                  )}
                  
                  {activeBackground?.toolProficiencies && (
                    <div style={{ marginTop: 8 }}>
                      <strong>工具熟练:</strong> {activeBackground.toolProficiencies.map(t => {
                        if (typeof t === 'string') return translateProficiency(t).split(' (')[0];
                        return null;
                      }).filter(Boolean).join(', ')}
                      {activeBackground?.toolProficiencies.map((t, i) => 
                        typeof t === 'string' ? null : renderSelection(`bg:${activeBackground.id}:prof:tool:${i}`, t, false, 'tool')
                      )}
                    </div>
                  )}

                  {activeBackground?.languages && (
                    <div style={{ marginTop: 8 }}>
                      <strong>语言:</strong> {activeBackground.languages.map(l => {
                        if (typeof l === 'string') return l;
                        return null;
                      }).filter(Boolean).join(', ')}
                      {activeBackground?.languages.map((l, i) => 
                        typeof l === 'string' ? null : renderSelection(`bg:${activeBackground.id}:prof:lang:${i}`, l, false, 'language')
                      )}
                    </div>
                  )}

                  {/* 2024 起源专长 (Origin Feat) 专属高品质卡片 */}
                  {(detailedFeat || activeBackground?.feat) && (
                    <div style={{ 
                      marginTop: 24, 
                      padding: '18px 20px', 
                      borderRadius: 14, 
                      background: 'var(--color-bg-surface)', 
                      border: '1px solid rgba(59, 130, 246, 0.35)',
                      boxShadow: '0 4px 16px rgba(59, 130, 246, 0.08)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <span style={{ 
                            fontSize: '0.75rem', 
                            padding: '3px 8px', 
                            background: 'rgba(59, 130, 246, 0.15)', 
                            color: '#3b82f6', 
                            borderRadius: 6,
                            fontWeight: 700 
                          }}>
                            起源专长 ORIGIN FEAT
                          </span>
                          <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                            {activeBackground?.feat?.name || detailedFeat?.name}
                          </span>
                          <span style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)', fontStyle: 'italic' }}>
                            {activeBackground?.feat?.nameEn || detailedFeat?.nameEn}
                          </span>
                        </div>
                        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>
                          来源: {detailedFeat?.source || activeBackground?.source || '2024 XPHB'}
                        </span>
                      </div>
                      <MarkdownText 
                        text={detailedFeat?.description || activeBackground?.feat?.description || ''} 
                        style={{ fontSize: '0.95rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }} 
                      />
                    </div>
                  )}

                  {/* 2014 背景特性 (Legacy Background Feature) 专属古典金色卡片 */}
                  {activeBackground?.legacyFeature && (
                    <div style={{ 
                      marginTop: 24, 
                      padding: '18px 20px', 
                      borderRadius: 14, 
                      background: 'var(--color-bg-surface)', 
                      border: '1px solid rgba(234, 179, 8, 0.35)',
                      boxShadow: '0 4px 16px rgba(234, 179, 8, 0.08)'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <span style={{ 
                          fontSize: '0.75rem', 
                          padding: '3px 8px', 
                          background: 'rgba(234, 179, 8, 0.15)', 
                          color: '#d97706', 
                          borderRadius: 6,
                          fontWeight: 700 
                        }}>
                          背景特性 FEATURE
                        </span>
                        <span style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
                          {activeBackground.legacyFeature.name}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.95rem', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                        <MarkdownText text={activeBackground.legacyFeature.description} />
                      </div>
                    </div>
                  )}
                </div>

                {/* Starting Equipment */}
                <h4 className={styles.sectionTitle}>初始装备</h4>
                <div className={styles.lineageList} style={{ marginBottom: 24 }}>
                  <div 
                    className={`${styles.lineageItem} ${character.backgroundSelections?.[`bg:${activeBackground?.id}:equipment`]?.[0] === 'choiceA' ? styles.lineageItemActive : ''}`}
                    onClick={() => handleSelection(`bg:${activeBackground?.id}:equipment`, 'choiceA')}
                  >
                    <div className={styles.lineageHeader}>
                      <div className={styles.lineageRadio}>
                        {character.backgroundSelections?.[`bg:${activeBackground?.id}:equipment`]?.[0] === 'choiceA' && <div className={styles.lineageRadioInner} />}
                      </div>
                      <div className={styles.lineageName}>
                        {activeBackground?.equipment.choiceB ? '方案 A (装备组合)' : '初始装备包'}
                      </div>
                    </div>
                    
                    <div style={{ paddingLeft: '28px' }}>
                      <div className={styles.lineageDesc} style={{ lineHeight: 1.6 }}>
                        {activeBackground?.equipment.choiceA.map((item, i) => {
                          if (typeof item === 'string') return (
                            <div key={i} style={{ marginBottom: 4 }}>• {item}</div>
                          );
                          return (
                            <div key={i} onClick={(e) => e.stopPropagation()} style={{ marginTop: 12 }}>
                              {renderSelection(`bg:${activeBackground.id}:equip-choiceA-${i}`, item, true)}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {activeBackground?.equipment.choiceB && (
                    <div 
                      className={`${styles.lineageItem} ${character.backgroundSelections?.[`bg:${activeBackground.id}:equipment`]?.[0] === 'choiceB' ? styles.lineageItemActive : ''}`}
                      onClick={() => handleSelection(`bg:${activeBackground.id}:equipment`, 'choiceB')}
                    >
                      <div className={styles.lineageHeader}>
                        <div className={styles.lineageRadio}>
                          {character.backgroundSelections?.[`bg:${activeBackground.id}:equipment`]?.[0] === 'choiceB' && <div className={styles.lineageRadioInner} />}
                        </div>
                        <div className={styles.lineageName}>方案 B (折现金币)</div>
                      </div>
                      <div style={{ paddingLeft: '28px' }}>
                        <div style={{ fontSize: '18px', fontWeight: 700, color: 'var(--color-gold-bright)' }}>
                          {activeBackground.equipment.choiceB}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Suggested Characteristics - Hidden per user request, but code preserved */}
                {/* 
                {selectedBackground.suggestedCharacteristics && (
                  <>
                    <h4 className={styles.sectionTitle}>个性特征 (开发中)</h4>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {Object.entries(selectedBackground.suggestedCharacteristics).map(([key, options]) => (
                        <div key={key}>
                          <p style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: 8 }}>
                            {key === 'personalityTraits' ? '人格特质' : key === 'ideals' ? '理想' : key === 'bonds' ? '牵绊' : '缺点'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                */}
              </div>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '8px' }}>尚未选择背景</p>
                <p style={{ color: '#86868b' }}>你可以先在左侧选择一个背景，或者直接点击“下一步”跳过此步骤。</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

