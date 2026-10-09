'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCharacterStore } from '@/store/characterStore';
import OptionCard from '@/components/OptionCard';
import PillButton from '@/components/PillButton';
import { computeProficiencies, isProficientWithWeapon, ProficiencySource } from '@/engine/proficiency';
import styles from '../species/page.module.css'; // Reuse species layout styles
import classStyles from '../class/class.module.css';
import { getCatalogFeats, getCatalogSpells } from '@/catalog';
import { WarlockInvocations2024 } from '@/mechanics-overlay/warlockInvocations';
import { allLanguages } from '@/rules/languages';
import { getSourceDisplayName, getSourceSortWeight } from '@/config/sourceMapping';
import { SubClass, ClassFeature, ClassLevelProgression, EquipmentRecord } from '@/types/class';
import { CharacterState, InventoryEntry, AbilityScores, CustomMarker } from '@/types/characterState';
import { 
  translateClass, 
  translateProficiency, 
  translateSkill,
  ALL_SKILLS,
  ALL_TOOLS,
  MUSICAL_INSTRUMENTS,
  ARTISAN_TOOLS,
  GAMING_SETS,
  WEAPON_MAP,
  normalizeSkillId,
  translateAbilityKey,
  normalizeAbilityKey,
  translateLabel,
  translateSource,
  formatSpellRange,
  formatSpellDuration,
  formatSpellComponent,
  translateSpellSchool,
  formatActionType
} from '@/engine/terminology';

import MarkdownText from '@/components/MarkdownText';
import { computeSpellcasting, getInnateSpells } from '@/engine/spellcasting';
import { computeAbilityScores } from '@/engine/ability';
import { getSpellDefinition, getClassDefinition, getFeatDefinition } from '@/engine/characterData';
import { Sparkles } from 'lucide-react';

/**
 * Local component for collapsible sections in description
 */
const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div style={{ 
      margin: '16px 0', 
      border: '1px solid #e5e5e7', 
      borderRadius: '12px', 
      overflow: 'hidden',
      background: 'var(--color-bg-dark)',
      boxShadow: '0 2px 8px rgba(0,0,0,0.02)'
    }}>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        style={{ 
          padding: '14px 16px', 
          background: 'var(--color-bg-dark)', 
          cursor: 'pointer', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          userSelect: 'none',
          transition: 'background 0.2s ease'
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#f0f0f2')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'var(--color-bg-dark)')}
      >
        <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>{title}</h4>
        <span style={{ 
          transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)', 
          transition: 'transform 0.2s ease',
          fontSize: '10px',
          color: '#86868b'
        }}>▶</span>
      </div>
      {isOpen && (
        <div style={{ padding: '16px', borderTop: '1px solid #e5e5e7', background: 'var(--color-bg-dark)' }}>
          {children}
        </div>
      )}
    </div>
  );
};

/**
 * Local component for choices that need descriptions (like maneuvers or invocations)
 */
const OptionCardInline: React.FC<{ 
  displayObj: any; 
  isChosen: boolean; 
  inv?: any; 
  onClick: () => void 
}> = ({ displayObj, isChosen, inv, onClick }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div 
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        padding: '16px',
        borderRadius: '14px',
        background: isChosen ? 'rgba(0, 113, 227, 0.03)' : 'var(--color-bg-dark)',
        border: isChosen ? '2px solid #0071e3' : '1px solid #e5e5e7',
        cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: isChosen ? '0 8px 20px rgba(0, 113, 227, 0.1)' : 'none'
      }}
      onMouseEnter={(e) => {
        if (!isChosen) {
          e.currentTarget.style.borderColor = '#d2d2d7';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isChosen) {
          e.currentTarget.style.borderColor = 'var(--color-border-dark)';
          e.currentTarget.style.boxShadow = 'none';
        }
      }}
    >
      {/* Apple-style status indicator bar */}
      <div style={{
        position: 'absolute',
        left: 0,
        top: 0,
        bottom: 0,
        width: 4,
        background: isChosen ? 'var(--color-gold-accent)' : 'transparent',
        opacity: 0.8
      }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <div style={{ 
            width: '18px', 
            height: '18px', 
            borderRadius: '50%', 
            border: isChosen ? '5px solid #0071e3' : '2px solid #d2d2d7', 
            boxSizing: 'border-box',
            background: 'var(--color-bg-dark)',
            flexShrink: 0
          }} />
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {displayObj.name} <span style={{ fontSize: '11px', color: '#86868b', fontWeight: 400 }}>{displayObj.nameEn}</span>
          </div>
        </div>
        <div 
          onClick={(e) => {
            e.stopPropagation();
            setIsExpanded(!isExpanded);
          }}
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: isExpanded ? 'rgba(0,113,227,0.1)' : 'rgba(0,0,0,0.05)',
            color: isExpanded ? 'var(--color-gold-accent)' : '#86868b',
            fontSize: '12px',
            transition: 'all 0.2s ease',
            cursor: 'pointer',
            marginLeft: '8px'
          }}
          title="点击查看详情"
        >
          {isExpanded ? '▲' : 'i'}
        </div>
      </div>
      <div style={{ display: 'flex', gap: '12px', marginLeft: '26px' }}>
        {inv && <div style={{ fontSize: '11px', color: '#86868b' }}>等级要求: {inv.level}</div>}
        {displayObj.cost !== undefined && <div style={{ fontSize: '11px', color: 'var(--color-gold-accent)', fontWeight: 600 }}>术法点消耗: {displayObj.cost}</div>}
      </div>
      {isExpanded && (
        <div 
          onClick={(e) => e.stopPropagation()}
          style={{ 
            marginTop: '8px',
            paddingTop: '10px',
            borderTop: '1px solid rgba(0,0,0,0.05)',
            fontSize: '13px', 
            color: '#515154', 
            lineHeight: 1.6, 
            whiteSpace: 'pre-wrap' 
          }}
        >
          <MarkdownText text={displayObj.description} />
        </div>
      )}
    </div>
  );
};

export default function ClassDetailPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { characters, updateActiveCharacter, loadCharacter } = useCharacterStore();
  const character = id ? characters[id] : null;

  const [selectedFeatSlot, setSelectedFeatSlot] = useState<number | null>(null);
  const [expandedSources, setExpandedSources] = useState<string[]>(['2024 核心规则 (Core)']);
  const [featSearch, setFeatSearch] = useState('');
  const [featSourceFilter, setFeatSourceFilter] = useState<string>('XPHB');
  const [previewMap, setPreviewMap] = useState<Record<string, string>>({});
  const [activeSourceFilter, setActiveSourceFilter] = useState<string | null>('2024 玩家手册');

  // Language filtering state
  const [langCategory, setLangCategory] = useState<string>('Standard');
  const [langSource, setLangSource] = useState<string>('XPHB');
  
  const detailsPanelRef = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    if (id) {
      loadCharacter(id);
    }
  }, [id, loadCharacter]);

  const currentClasses = character?.classes || [];
  const primaryClassEntry = currentClasses[0];
  const classDefinition = useMemo(() => 
    getClassDefinition(primaryClassEntry?.classId), 
    [primaryClassEntry?.classId]
  );
  const selectedClassId = primaryClassEntry?.classId;



  // Compute feat slots and features
  const { combinedFeatures, subclassFeature } = useMemo(() => {
    if (!classDefinition || !primaryClassEntry) return { combinedFeatures: [] };
    
    let features = [...classDefinition.features];
    
    // Add subclass features if selected
    if (primaryClassEntry.subclassId) {
      const sub = classDefinition.subClassInfo?.options.find((o: any) => o.catalogId === primaryClassEntry.subclassId || o.nameEn === primaryClassEntry.subclassId || o.name === primaryClassEntry.subclassId);
      if (sub && sub.traits) {
        features = [...features, ...sub.traits];
      }
    }
    
    const subclassFeature = features.find(f => f.mechanics?.choices?.some((c: any) => c.type === 'subclass'));

    return { 
      subclassFeature,
      combinedFeatures: features
        .filter(f => {
           // Filter out the primary subclass selection feature itself (it's handled by top UI)
           const isSubclassSelector = f.mechanics?.choices?.some((c: any) => c.type === 'subclass');
           // Filter out generic placeholders
           const isGenericPlaceholder = (f.name === '子职特性' && f.nameEn === 'Subclass Feature');
           return !isSubclassSelector && !isGenericPlaceholder;
        })
        .sort((a, b) => a.level - b.level)
    };
  }, [classDefinition, primaryClassEntry]);

  const totalLevel = currentClasses.reduce((acc, c) => acc + c.level, 0);

  const handleLevelChange = (classId: string, delta: number) => {
    const newClasses = currentClasses.map(c => {
      if (c.classId === classId) {
        const newLevel = Math.max(1, Math.min(20, c.level + delta));
        return { ...c, level: newLevel };
      }
      return c;
    });
    updateActiveCharacter({ classes: newClasses });
    setPreviewMap({});
  };

  const handleSelectSubclass = (subclassId: string, targetClassId?: string) => {
    const targetId = targetClassId || primaryClassEntry?.classId;
    if (!targetId) return;

    const newClasses = currentClasses.map((entry) =>
      entry.classId === targetId ? { ...entry, subclassId } : entry
    );
    updateActiveCharacter({ classes: newClasses });
  };

  const handleClassSelection = (choiceId: string, value: string, numToChoose: number = 1, category?: string, options: string[] = [], preSelected: string[] = []) => {
    const currentSelections = character?.classSelections || {};
    let values = currentSelections[choiceId] || [];
    
    // Set preview for detailed display
    setPreviewMap(prev => ({ ...prev, [choiceId]: value }));

    // Normalize IDs for consistency
    const normValue = (category === 'skill' || category === 'expertise') ? normalizeSkillId(value) : value;

    if (values.includes(normValue)) {
      values = values.filter(v => v !== normValue);
    } else {
      // Logic for exclusivity (check against ALL other selections)
      const isMastery = category === 'mastery' || category === 'weaponMastery' || choiceId.includes('weapon_mastery');
      
      // If selecting a skill/tool, don't allow duplicates unless it's Expertise
      if (category === 'skill' || category === 'tool' || category === 'language') {
        const alreadyProficient = allProficiencies.skills.map(s => normalizeSkillId(s.id)).includes(normValue) || 
                                 allProficiencies.tools.some(t => t.id === normValue) ||
                                 allProficiencies.languages.some(l => l.id === normValue);
        // Special case: If we are in the SAME slot, we are just toggling. 
        // But if it's already selected in OTHER slots, block it.
      }

      if (values.length < numToChoose) {
        values = [...values, normValue];
      } else if (numToChoose === 1) {
        values = [normValue];
      }
    }
    
    updateActiveCharacter({
      classSelections: { ...currentSelections, [choiceId]: values },
      expertiseSkills: Array.from(new Set(Object.entries({ ...currentSelections, [choiceId]: values }).filter(([cid]) => cid.toLowerCase().includes('expertise') || cid.includes('专精')).flatMap(([_, vals]) => (vals || []).map(normalizeSkillId)))),



    });
  };

  // Logic for exclusivity (already selected proficiencies)
  const preSelectedProficiencies = useMemo(() => {
    const profs: string[] = [];
    if (!character) return profs;
    // ... logic for pre-selected profs ...
    return Array.from(new Set(profs));
  }, [character]);

  const allProficiencies = useMemo(() => {
    if (!character) return { weapons: [], armor: [], skills: [], tools: [], languages: [], saves: [] };
    return computeProficiencies(character);
  }, [character]);

  const renderChoice = (id: string, selection: any, category: string = 'custom', compact: boolean = false, parentFeature?: ClassFeature) => {
    let chosen = (character?.classSelections?.[id] || []);
    
    // Expansion logic for generic keywords
    let options = [...(selection.options || [])];
    
    // ── 动态选项展开逻辑 (Dynamic Options Expansion) ──────────────────────────
    if (options.length === 1) {
      const keyword = options[0];
      if (keyword === 'Any' || keyword === 'Any Skill' || keyword === 'Any Skill Proficiency' || keyword === '任何技能') {
        if (category === 'weaponMastery') {
          options = Object.keys(WEAPON_MAP);
        } else if (category === 'tool') {
          options = ALL_TOOLS;
        } else {
          options = ALL_SKILLS;
        }
      } else if (keyword === 'Any Tool' || keyword === '任何工具') {
        options = ALL_TOOLS;
      } else if (keyword === 'Any Musical Instrument' || keyword === '任何乐器' || keyword === '乐器') {
        options = MUSICAL_INSTRUMENTS;
      } else if (keyword === 'Any Gaming Set' || keyword === '任何游戏套装') {
        options = GAMING_SETS;
      } else if (keyword === 'Artisan\'s Tools' || keyword === 'Artisan Tools' || keyword === '工匠工具') {
        options = ARTISAN_TOOLS;
      } else if (keyword === 'Any Language' || keyword === '任何语言' || (keyword === 'Any' && category === 'language')) {
        options = allLanguages.map(l => l.id);
      }
    }

    // ── 动态选项解析逻辑 (Dynamic Options Resolution) ──────────────────────────
    let resolvedOptions = [...options];

    // 1. 处理法术动态加载 (基于 filter)
    if (category === 'spell' && (resolvedOptions.length === 0 || resolvedOptions[0] === 'Any')) {
      const filter = (selection as any).filter || '';
      if (filter) {
        const parts = filter.split(';');
        const cls = parts.find((p: string) => p.startsWith('class:'))?.split(':')[1]?.toLowerCase();
        const clsParts = cls ? cls.split(',').map((c: string) => c.trim()) : [];
        const targetSets = clsParts.map((c: string) => ({
          zh: translateClass(c),
          en: c.charAt(0).toUpperCase() + c.slice(1),
          raw: c.toLowerCase()
        }));
        
        const lvl = parts.find((p: string) => p.startsWith('level:'))?.split(':')[1];
        const school = parts.find((p: string) => p.startsWith('school:'))?.split(':')[1]?.toLowerCase();

        resolvedOptions = getCatalogSpells()
          .filter(s => {
            const clsMatch = targetSets.length === 0 || s.classes?.some((c: string) => 
              targetSets.some((t: { zh: string; en: string; raw: string }) => c === t.zh || c === t.en || c.toLowerCase() === t.raw)
            );
            // 处理等级：支持 "2" (精确) 或 "0,1,2" (列表)
            let lvlMatch = true;
            if (lvl !== undefined) {
              const allowedLvls = lvl.split(',').map((v: string) => parseInt(v.trim()));
              lvlMatch = allowedLvls.includes(s.level);
            }
            // 处理学派
            const schoolMatch = !school || s.school?.toLowerCase() === school;

            return clsMatch && lvlMatch && schoolMatch;
          })
          .map(s => s.id);
      }
    }

    // 1.5 处理专长动态加载 (基于关键字)
    if (category === 'feat') {
      const hasGenericKeyword = resolvedOptions.some(opt => 
        ['General Feat', 'Origin Feat', 'Epic Boon', 'Fighting Style', 'Feat'].some(k => opt.includes(k))
      );
      
      if (hasGenericKeyword) {
        const keywords = resolvedOptions;
        const allFeatsList = getCatalogFeats();
        let pool = allFeatsList;
        
        // 如果指定了特定类别的关键字，则进行过滤
        if (keywords.includes('General Feat')) {
          pool = allFeatsList.filter(f => f.category === 'General');
        } else if (keywords.includes('Origin Feat')) {
          pool = allFeatsList.filter(f => f.category === 'Origin');
        } else if (keywords.includes('Epic Boon')) {
          pool = allFeatsList.filter(f => f.category === 'Epic Boon');
        } else if (keywords.some((k: string) => k === 'Fighting Style Feat' || k === 'Fighting Style')) {
          pool = allFeatsList.filter(f => f.category === 'Fighting Style');
        }

        resolvedOptions = pool.map(f => f.id);
      }
    }

    // 2. 处理专精动态加载 (基于当前所有熟练项)
    if (category === 'expertise' && (resolvedOptions.length === 0 || (resolvedOptions.length === 1 && resolvedOptions[0].toLowerCase().includes('any')))) {
      const allAvailableProficiencies = allProficiencies.skills.map((s: ProficiencySource) => normalizeSkillId(s.id));
      const allCurrentSkillsInClass = Object.entries(character?.classSelections || {})
        .filter(([cid]) => cid.includes(':base:prof:skills') || cid.includes(':prof:skills') || cid === 'primary_class_skills')
        .flatMap(([_, v]) => v);
      const otherExpertiseSelections = Object.entries(character?.classSelections || {})
        .filter(([cid]) => cid !== id && cid.includes('expertise'))
        .flatMap(([_, vals]) => vals);

      resolvedOptions = allAvailableProficiencies.filter(s => !otherExpertiseSelections.includes(s));
    }

    // 处理武器精通动态加载
    if (category === 'weaponMastery' && (resolvedOptions.length === 1 && (resolvedOptions[0].includes('Any') || resolvedOptions[0].includes('any')))) {
      const isMeleeOnly = resolvedOptions[0].toLowerCase().includes('melee');
      resolvedOptions = [
          'club', 'dagger', 'greatclub', 'handaxe', 'javelin', 'light hammer', 'mace', 'quarterstaff', 'sickle', 'spear',
          'battleaxe', 'flail', 'glaive', 'greataxe', 'greatsword', 'halberd', 'lance', 'longsword', 'maul', 'morningstar', 'pike', 'rapier', 'scimitar', 'shortsword', 'trident', 'war pick', 'warhammer', 'whip',
          'blowgun', 'crossbow, light', 'dart', 'shortbow', 'sling', 'crossbow, hand', 'crossbow, heavy', 'longbow', 'musket', 'pistol'
      ];
      if (isMeleeOnly) {
        const ranged = ['blowgun', 'crossbow, light', 'dart', 'shortbow', 'sling', 'crossbow, hand', 'crossbow, heavy', 'longbow', 'musket', 'pistol'];
        resolvedOptions = resolvedOptions.filter(w => !ranged.includes(w));
      }
    }
    
    // 3. 处理语言动态加载 (基于 filter)
    if (category === 'language' && (resolvedOptions.length === 0 || resolvedOptions[0] === 'Any')) {
      const filter = (selection as any).filter || '';
      if (filter) {
        const parts = filter.split(';');
        const typePart = parts.find((p: string) => p.startsWith('type:'))?.split(':')[1];
        if (typePart) {
          const types = typePart.split(',').map((t: string) => t.trim());
          resolvedOptions = allLanguages
            .filter(l => types.includes(l.type))
            .map(l => l.id);
        }
      } else {
        resolvedOptions = allLanguages.map(l => l.id);
      }
    }

    const finalOptions = resolvedOptions;

    // ── 查重逻辑 (Exclusion) ──────────────────────────────────────────
    // 聚合所有来源的选择项：种族、背景、职业
    const allSelections = [
      ...Object.values(character?.speciesSelections || {}).flat(),
      ...Object.values(character?.backgroundSelections || {}).flat(),
      ...Object.values(character?.classSelections || {}).flat(),
      ...(character?.selectedSkills || [])
    ];

    // 特殊处理法术：需要同时记录 ID 和 名称（防止跨来源重复学习同名法术）
    const takenSpellIds = new Set<string>();
    const takenSpellNames = new Set<string>();

    allSelections.forEach(val => {
      const spell = getSpellDefinition(val);
      if (spell) {
        takenSpellIds.add(spell.id);
        takenSpellNames.add(spell.name);
      }
    });
    
    // 还要加入固有的法术 (Innate Spells)
    if (character) {
      getInnateSpells(character).forEach(is => {
        const spell = getSpellDefinition(is.spellId);
        if (spell) {
          takenSpellIds.add(spell.id);
          takenSpellNames.add(spell.name);
        }
      });
    }

    const alreadySelectedInOtherSlots = allSelections.filter(val => {
      const currentChosen = character?.classSelections?.[id] || [];
      return !currentChosen.includes(val);
    }).map(v => (category === 'skill' || category === 'expertise') ? normalizeSkillId(v) : v);

    const isComplete = chosen.length === (selection.numToChoose || 1);

    const getTitle = () => {
      if (selection.name) return selection.name;
      switch(category) {
        case 'skill': return '技能熟练 Skill Proficiency';
        case 'expertise': return '技能专精 Skill Expertise';
        case 'tool': return '工具熟练 Tool Proficiency';
        case 'feat': return '专长选择 Feat Selection';
        case 'spell': return '法术选择 Spell Selection';
        default: return '选项选择 Selection';
      }
    };

    // Special rendering for spells/feats/custom (Card list + Description)
    if (category === 'feat' || category === 'spell' || category === 'custom') {
      const isSpell = category === 'spell';
      
      if (isSpell) {
         return (
             <div key={id} style={{ display: 'none', marginTop: 16, padding: 20, border: '1px solid #e5e5e7', borderRadius: 14, background: 'var(--color-bg-dark)' }}>
                 <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{getTitle()}</span>
                 </div>
                 <div style={{ marginTop: 12, fontSize: '14px', color: '#424245', lineHeight: 1.5 }}>
                     此职业特性的法术选择已整合至专属的 <strong style={{ color: 'var(--color-gold-accent)' }}>法术准备</strong> 页面。<br/>
                     <span style={{ fontSize: '13px', color: '#86868b' }}>请在完成本页面的职业基础配置后，点击"下一步"前往配置您的法术书/祈唤/已知法术。</span>
                 </div>
             </div>
         );
      }

      const items = finalOptions.map(opt => {
        const optId = typeof opt === 'object' ? (opt.id || opt.nameEn || opt.name) : opt;
        
        // Lookup in Feats
        const feat = getFeatDefinition(optId) || getCatalogFeats().find(f => f.id === optId || f.nameEn === optId);
        if (feat) return feat;

        // Lookup in Spells
        const spell = getSpellDefinition(optId);
        if (spell) return spell;

        // Lookup in Warlock Invocations (with default source XPHB)
        const invocation = WarlockInvocations2024.find(i => i.nameEn === optId || i.name === optId);
        if (invocation) {
          return invocation.source ? invocation : { ...invocation, source: 'XPHB' };
        }

        return (typeof opt === 'object' ? opt : null);
      }).filter(Boolean);

      // 使用翻译后的名称进行唯一化去重
      const translatedSources = Array.from(new Set(items.map(it => getSourceDisplayName(it?.source || ''))))
        .filter(Boolean)
        .sort((a, b) => {
          const wA = getSourceSortWeight(a);
          const wB = getSourceSortWeight(b);
          if (wA !== wB) return wA - wB;
          return a.localeCompare(b, 'zh-Hans-CN');
        });

      const effectiveSourceFilter = (activeSourceFilter && translatedSources.includes(activeSourceFilter)) ? activeSourceFilter : null;
      const filteredItems = effectiveSourceFilter 
        ? items.filter(it => getSourceDisplayName(it?.source || '') === effectiveSourceFilter)
        : items;

      const currentPreviewId = previewMap[id];
      const currentSelectedItem = currentPreviewId 
        ? items.find(it => it && (it.id === currentPreviewId || it.nameEn === currentPreviewId))
        : (items.find(it => it && chosen.includes(it.id)) || items[0]);

      return (
        <div key={id} style={{ 
          marginTop: 16, 
          padding: 20, 
          border: isComplete ? '2px solid #0071e3' : '1px solid #e5e5e7', 
          borderRadius: 14, 
          background: isComplete ? 'rgba(0, 113, 227, 0.03)' : 'var(--color-bg-dark)',
          boxShadow: isComplete ? '0 8px 20px rgba(0, 113, 227, 0.1)' : '0 2px 8px rgba(0,0,0,0.02)',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Apple-style status indicator bar */}
          <div style={{
            position: 'absolute',
            left: 0,
            top: 0,
            bottom: 0,
            width: 4,
            background: isComplete ? 'var(--color-gold-accent)' : 'transparent',
            opacity: 0.8
          }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <span style={{ 
              fontSize: '15px', 
              fontWeight: 700, 
              color: isComplete ? 'var(--color-gold-accent)' : 'var(--color-text-primary)',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              {getTitle()}
              {isComplete && <span style={{ fontSize: '14px' }}>✓</span>}
            </span>
            <div style={{ 
              fontSize: '11px', 
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: 10,
              background: isComplete ? 'rgba(0, 113, 227, 0.1)' : 'rgba(0,0,0,0.05)',
              color: isComplete ? 'var(--color-gold-accent)' : '#86868b'
            }}>
              已选 {chosen.length}/{selection.numToChoose || 1}
            </div>
          </div>

          {/* Source Filter Tabs */}
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px', borderBottom: '1px solid #eee', paddingBottom: '12px' }}>
            <PillButton 
              size="sm" 
              variant={effectiveSourceFilter === null ? 'primary' : 'outline'}
              onClick={() => setActiveSourceFilter(null)}
            >
              全部
            </PillButton>
            {translatedSources.map(displayName => (
              <PillButton 
                key={displayName}
                size="sm" 
                variant={effectiveSourceFilter === displayName ? 'primary' : 'outline'}
                onClick={() => setActiveSourceFilter(displayName)}
              >
                {displayName}
              </PillButton>
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: currentSelectedItem ? 16 : 0 }}>
            {filteredItems.map(item => {
              if (!item) return null;
              const itemId = item.id || item.nameEn;
              // 统一使用规范化后的 ID 进行比对，确保技能和专精的选择状态能正确显示
              const isSelected = chosen.includes(itemId);
              
              // 占用判定逻辑 (如果是可重复选取的专长，则不判定为占用)
              const isRepeatableFeat = (item as any).repeatable === true;
              let isOccupied = !isRepeatableFeat && (alreadySelectedInOtherSlots.includes(item.id) || 
                               (item.nameEn && alreadySelectedInOtherSlots.includes(item.nameEn)));

              // 专长前置条件判定 (Prerequisite Check)
              let prerequisiteError = '';
              if (character) {
                const feat = item as any;
                if (feat.prerequisiteLogic) {
                  const currentScores = computeAbilityScores(character).scores;
                  const logic = feat.prerequisiteLogic;
                  
                  // 等级检查
                  if (logic.level && totalLevel < logic.level) {
                    prerequisiteError = `等级不足 (需要 ${logic.level} 级)`;
                  }
                  
                  // 属性检查
                  if (!prerequisiteError && logic.abilities) {
                    const met = logic.abilities.some((a: any) => {
                      const key = normalizeAbilityKey(a.ability) as keyof AbilityScores;
                      return key && currentScores[key] >= a.min;
                    });
                    if (!met) {
                      prerequisiteError = `属性不足 (${logic.abilities.map((a: any) => `${a.ability} ${a.min}`).join(' 或 ')})`;
                    }
                  }

                  // 施法能力检查
                  if (!prerequisiteError && logic.spellcasting) {
                    const hasSpellcasting = character.classes?.some(c => {
                      const def = getClassDefinition(c.classId);
                      return def?.progression.some((p: any) => p.level <= c.level && p.spellcasting);
                    });
                    if (!hasSpellcasting) {
                      prerequisiteError = '需要施法能力';
                    }
                  }
                }
              }

              const isInvalid = !!prerequisiteError;

              return (
                <PillButton
                  key={itemId}
                  size="sm"
                  variant={isSelected ? 'primary' : 'outline'}
                  disabled={isOccupied || isInvalid}
                  onClick={() => {
                    if (isOccupied || isInvalid) return;
                    handleClassSelection(id, itemId, selection.numToChoose, category, finalOptions);
                  }}
                  title={prerequisiteError}
                  style={{ 
                    opacity: (isOccupied || isInvalid) ? 0.25 : 1,
                    cursor: (isOccupied || isInvalid) ? 'not-allowed' : 'pointer',
                    borderStyle: isInvalid ? 'dashed' : 'solid'
                  }}
                >
                  {item.name} {items.filter(it => it?.name === item.name).length > 1 ? `[${translateSource(item.source)}]` : ''}
                  {isOccupied && <span style={{ fontSize: '10px', marginLeft: 4 }}>(已选)</span>}
                </PillButton>
              );
            })}
          </div>

          {/* 高保真预览面板 (High-Fidelity Preview) */}
          {currentSelectedItem && (() => {
            const item = currentSelectedItem;
            const feat = item as any;

            return (
              <div className={styles.previewBox}>
                <div className={styles.previewHeader}>
                  <div>
                    <span className={styles.previewTitle}>{item.name}</span>
                    <span className={styles.previewSubtitle}>{item.nameEn}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--color-gold-accent)', fontWeight: 600 }}>{translateSource(item.source)}</span>
                </div>

                {feat?.prerequisite && (
                  <div style={{ fontSize: '12px', color: '#86868b', marginBottom: '8px', padding: '4px 8px', background: 'var(--color-bg-dark)', borderRadius: '4px', display: 'inline-block' }}>
                    前提: {feat.prerequisite}
                  </div>
                )}

                <MarkdownText text={item.description} className={styles.previewDescription} variant="clean" />
              </div>
            );
          })()}
        </div>
      );
    }

    return (
      <div key={id} style={{ 
        marginTop: 16, 
        padding: compact ? '12px 16px' : 20, 
        border: isComplete ? '2px solid #0071e3' : '1px solid #e5e5e7', 
        borderRadius: 14, 
        background: isComplete ? 'rgba(0, 113, 227, 0.03)' : 'var(--color-bg-dark)',
        boxShadow: isComplete ? '0 8px 20px rgba(0, 113, 227, 0.1)' : '0 2px 8px rgba(0,0,0,0.02)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Apple-style status indicator bar */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: isComplete ? 'var(--color-gold-accent)' : 'transparent',
          opacity: 0.8
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <span style={{ 
            fontSize: '15px', 
            fontWeight: 700, 
            color: isComplete ? 'var(--color-gold-accent)' : 'var(--color-text-primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            {getTitle()}
            {isComplete && <span style={{ fontSize: '14px' }}>✓</span>}
          </span>
          <div style={{ 
            fontSize: '11px', 
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 10,
            background: isComplete ? 'rgba(0, 113, 227, 0.1)' : 'rgba(0,0,0,0.05)',
            color: isComplete ? 'var(--color-gold-accent)' : '#86868b'
          }}>
            已选 {chosen.length}/{selection.numToChoose || 1}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {finalOptions.map(opt => {
            const optId = typeof opt === 'object' ? opt.nameEn : opt;
            const isAlreadySelected = alreadySelectedInOtherSlots.includes(normalizeSkillId(optId));
            
            if (category === 'skill' && (id.includes(':base:prof:skills') || id.includes(':prof:skills'))) {
              const classSpecificChosen = character?.classSelections?.[id] || [];
              if (classSpecificChosen.length > 0) {
                chosen = classSpecificChosen;
              } else {
                chosen = (character?.selectedSkills || []).filter(s => {
                  const nid = normalizeSkillId(s);
                  return finalOptions.some(opt => normalizeSkillId(opt) === nid) && !preSelectedProficiencies.includes(nid);
                });
              }
            }
            
            const isDisabled = isAlreadySelected && !id.includes('expertise');
            // 统一使用规范化后的 ID 进行比对
            const normalizedOptId = (category === 'skill' || category === 'expertise') ? normalizeSkillId(optId) : optId;
            const isChosen = chosen.includes(normalizedOptId);
            
            return (
              <PillButton
                key={optId}
                size="sm"
                variant={isChosen ? 'primary' : 'outline'}
                disabled={isDisabled}
                onClick={() => handleClassSelection(id, optId, selection.numToChoose, category, finalOptions)}
                style={{ 
                  opacity: isDisabled ? 0.4 : 1,
                  transform: isChosen ? 'scale(1.02)' : 'scale(1)',
                  boxShadow: isChosen ? '0 4px 10px var(--color-border-gold)' : 'none',
                  transition: 'all 0.2s ease'
                }}
              >
                {category === 'skill' || category === 'expertise' ? translateSkill(optId) : translateLabel(optId)}
                {isDisabled && <span style={{ fontSize: '10px', marginLeft: 4 }}>(已选)</span>}
              </PillButton>
            );
          })}
        </div>
      </div>
    );
  };

  if (!character) return <div className="page-container">加载中...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>职业进阶 <span style={{fontWeight:400, color:'#86868b', fontSize:'18px', marginLeft:'8px'}}>Class Growth & Progression</span></h2>
        </div>
      </div>

      <div className={styles.content}>
        {/* Main Progression Area */}
        <div className={styles.detailsPanel} style={{ width: '100%', maxWidth: '1000px', margin: '0 auto' }}>
          {classDefinition && primaryClassEntry ? (
            <div className={styles.detailsContent}>
              
              {/* Multiclass & Level Control Header */}
              <div style={{ 
                background: 'var(--color-bg-dark)', 
                padding: '24px', 
                borderRadius: '16px', 
                border: '1px solid #e5e5e7',
                marginBottom: '32px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 4px 20px rgba(0,0,0,0.03)'
              }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '20px', fontWeight: 700 }}>{translateClass(classDefinition.name)} 进阶配置</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--color-text-primary)' }}>
                      <input 
                        type="checkbox" 
                        checked={character.isMulticlassingEnabled}
                        onChange={(e) => updateActiveCharacter({ isMulticlassingEnabled: e.target.checked })}
                        style={{ width: '18px', height: '18px' }}
                      />
                      开启兼职 (Multiclassing)
                    </label>
                  </div>
                </div>

                <div style={{ 
                  background: 'var(--color-bg-dark)', 
                  padding: '12px 20px', 
                  borderRadius: '14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px'
                }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: '#86868b' }}>职业等级</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <button 
                      onClick={() => handleLevelChange(selectedClassId!, -1)}
                      disabled={primaryClassEntry.level <= 1}
                      style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #d2d2d7', background: 'var(--color-bg-dark)', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >-</button>
                    <span style={{ fontSize: '24px', fontWeight: 800, minWidth: '32px', textAlign: 'center' }}>{primaryClassEntry.level}</span>
                    <button 
                      onClick={() => handleLevelChange(selectedClassId!, 1)}
                      disabled={totalLevel >= 20}
                      style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid #d2d2d7', background: 'var(--color-bg-dark)', cursor: 'pointer', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    >+</button>
                  </div>
                </div>
              </div>

              {/* Subclass Selection */}
              {classDefinition.subClassInfo && primaryClassEntry.level >= classDefinition.subClassInfo.unlockLevel && (
                <div className={styles.traitsSection} style={{ marginBottom: '40px' }}>
                  <h4 className={styles.sectionTitle}>选择子职业 <span style={{fontWeight:400, color:'#86868b', fontSize:'14px'}}>Subclass Selection</span></h4>
                  
                  {/* Dynamic Subclass Description moved from the feature card */}
                  {subclassFeature?.description && (
                    <div style={{ 
                      fontSize: '14px', 
                      color: '#515154', 
                      lineHeight: 1.6, 
                      marginBottom: '20px',
                      padding: '16px',
                      background: '#f8f8fa',
                      borderRadius: '12px',
                      borderLeft: '4px solid #0071e3'
                    }}>
                      <MarkdownText text={subclassFeature.description} />
                    </div>
                  )}

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
                    {classDefinition.subClassInfo.options.map((sub: SubClass) => {
                      const subclassId = sub.catalogId || sub.nameEn || sub.name;
                      const isSelected = primaryClassEntry.subclassId === subclassId || primaryClassEntry.subclassId === sub.nameEn;
                      return (
                        <div 
                          key={subclassId}
                          onClick={() => handleSelectSubclass(subclassId)}
                          style={{
                            padding: '24px',
                            borderRadius: '16px',
                            background: isSelected ? 'rgba(197, 160, 89, 0.1)' : '#fff',
                            border: isSelected ? '2px solid #0071e3' : '1px solid #e5e5e7',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            boxShadow: isSelected ? '0 8px 24px rgba(0,113,227,0.12)' : 'none'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                            <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: isSelected ? '7px solid #0071e3' : '2px solid #d2d2d7', boxSizing: 'border-box' }} />
                            <div style={{ fontSize: '18px', fontWeight: 700 }}>{sub.name}</div>
                          </div>
                          <div style={{ fontSize: '14px', color: '#515154', lineHeight: 1.6 }}>
                            <MarkdownText text={sub.description} variant="clean" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Caster Guidance Banner */}
              {(classDefinition.spellcastingAbility || subclassFeature?.mechanics?.spellcastingType) && (
                <div style={{ 
                  margin: '0 0 32px 0', 
                  padding: '20px 24px', 
                  background: 'rgba(0, 113, 227, 0.04)', 
                  border: '1px solid rgba(0, 113, 227, 0.15)', 
                  borderRadius: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px'
                }}>
                  <div style={{ 
                    width: '40px', 
                    height: '40px', 
                    borderRadius: '12px', 
                    background: 'var(--color-gold-accent)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    color: '#fff'
                  }}>
                    <Sparkles size={20} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '2px' }}>已开启施法能力</div>
                    <div style={{ fontSize: '13px', color: '#424245' }}>
                      该职业/子职业具备施法特性。请在完成基础配置后，点击“下一步”前往专用页面准备您的法术。
                    </div>
                  </div>
                </div>
              )}

              {/* Progression Features */}
              <div className={styles.traitsSection}>
                <h4 className={styles.sectionTitle}>解锁特性与选择 <span style={{fontWeight:400, color:'#86868b', fontSize:'14px'}}>Unlocked Features & Choices</span></h4>
                <div className={styles.traitGrid} style={{ gridTemplateColumns: '1fr' }}>
                  {combinedFeatures.map((feature: ClassFeature, idx: number) => {
                    const isUnlocked = feature.level <= primaryClassEntry.level;
                    if (!isUnlocked) return null;

                    return (
                      <div 
                        key={`${feature.nameEn}-${idx}`} 
                        className={styles.traitCard}
                        style={{ 
                           borderLeft: '4px solid var(--color-primary)',
                           background: feature.name.includes('子职') ? '#fcf9ff' : '#fff',
                           padding: '24px',
                           marginBottom: '16px'
                        }}
                      >
                        <div className={styles.traitHeader}>
                          <span className={styles.traitName}>{feature.name}</span>
                          <span className={styles.traitNameEn}>{feature.nameEn}</span>
                          <span className={styles.usageBadge}>{feature.level} 级</span>
                        </div>
                        <div className={styles.traitPara}>
                          <MarkdownText text={feature.description} />
                        </div>

                        {/* Subclass Spells Table (Oath Spells, Domain Spells, etc.) */}
                        {feature.mechanics?.spells && feature.mechanics.spells.length > 1 && (
                          <div className={styles.spellTableContainer}>
                            <table className={styles.spellTable}>
                              <thead>
                                <tr>
                                  <th>等级</th>
                                  <th>法术</th>
                                </tr>
                              </thead>
                              <tbody>
                                {feature.mechanics.spells.map((group: any, gIdx: number) => (
                                  <tr key={gIdx}>
                                    <td className={styles.levelCell}>{group.level} 级</td>
                                    <td className={styles.spellsCell}>
                                      {group.spells.map((sNameEn: string, sIdx: number) => {
                                        const spell = getSpellDefinition(sNameEn);
                                        return (
                                          <span key={sIdx} className={styles.spellTag}>
                                            {spell ? spell.name : sNameEn}
                                          </span>
                                        );
                                      })}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {/* Feature Choices */}
                        {feature.mechanics?.choices?.map((choice: any) => (
                           renderChoice(
                             `cls:${selectedClassId}:feat:${feature.name}:${choice.id}`,
                             choice,
                             choice.type,
                             false,
                             feature
                           )
                        ))}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>
          ) : (
            <div className={styles.emptyState}>请先完成基础职业选择。</div>
          )}
        </div>
      </div>
    </div>
  );
}

