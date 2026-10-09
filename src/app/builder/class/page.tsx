'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCharacterStore } from '@/store/characterStore';
import OptionCard from '@/components/OptionCard';
import PillButton from '@/components/PillButton';
import { computeProficiencies, isProficientWithWeapon } from '@/engine/proficiency';
import styles from '../species/page.module.css'; // Reuse species layout styles
import classStyles from './class.module.css';
import { 
  getCatalogClasses, 
  getCatalogFeats, 
  getCatalogSpells, 
  getCatalogSpecies, 
  getCatalogBackgrounds 
} from '@/catalog';
import { WarlockInvocations2024 } from '@/mechanics-overlay/warlockInvocations';
import { allLanguages } from '@/rules/languages';
import { SubClass, ClassFeature, ClassLevelProgression, EquipmentRecord } from '@/types/class';
import { CharacterState, InventoryEntry } from '@/types/characterState';
import { 
  translateClass, 
  translateProficiency, 
  translateSkill,
  ALL_SKILLS,
  ALL_TOOLS,
  ARTISAN_TOOLS,
  MUSICAL_INSTRUMENTS,
  GAMING_SETS,
  WEAPON_MAP,
  normalizeSkillId,
  translateAbilityKey,
  normalizeAbilityKey,
  translateLabel,
  translateSource,
  translateSpellSchool
} from '@/engine/terminology';

import MarkdownText from '@/components/MarkdownText';
import { computeSpellcasting } from '@/engine/spellcasting';
import { computeAbilityScores } from '@/engine/ability';
import { getSpellDefinition, getClassDefinition, getSpeciesDefinition, getBackgroundDefinition, getFeatDefinition } from '@/engine/characterData';
import { useCatalog } from '@/platform/CatalogProvider';

/**
 * Local component for collapsible sections in description
 */
const CollapsibleSection: React.FC<{ title: string; children: React.ReactNode; defaultOpen?: boolean }> = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

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
        borderRadius: '12px',
        background: isChosen ? 'rgba(197, 160, 89, 0.1)' : 'var(--color-bg-dark)',
        border: isChosen ? '2px solid var(--color-gold-bright)' : '1px solid var(--color-border-dark)',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        position: 'relative',
        boxShadow: isChosen ? '0 4px 12px rgba(197, 160, 89, 0.15)' : 'none'
      }}
      onMouseEnter={(e) => {
        if (!isChosen) e.currentTarget.style.borderColor = 'var(--color-border-gold)';
        e.currentTarget.style.boxShadow = isChosen ? '0 4px 12px rgba(197, 160, 89, 0.2)' : '0 4px 12px rgba(0,0,0,0.2)';
      }}
      onMouseLeave={(e) => {
        if (!isChosen) e.currentTarget.style.borderColor = 'var(--color-border-dark)';
        e.currentTarget.style.boxShadow = isChosen ? '0 4px 12px rgba(197, 160, 89, 0.15)' : 'none';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <div style={{ 
            width: '18px', 
            height: '18px', 
            borderRadius: '50%', 
            border: isChosen ? '5px solid var(--color-gold-bright)' : '2px solid var(--color-border-dark)', 
            boxSizing: 'border-box',
            background: 'var(--color-bg-dark)',
            flexShrink: 0
          }} />
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {displayObj.name} <span style={{ fontSize: '11px', color: 'var(--color-text-secondary)', fontWeight: 400 }}>{displayObj.nameEn}</span>
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

export default function ClassPage() {
  const { status: catalogStatus } = useCatalog();
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { characters, updateActiveCharacter, loadCharacter } = useCharacterStore();
  const character = id ? characters[id] : null;

  const [selectedFeatSlot, setSelectedFeatSlot] = useState<number | null>(null);
  const [showMulticlassSelector, setShowMulticlassSelector] = useState(false);
  const [expandedSources, setExpandedSources] = useState<string[]>(['2024 核心规则 (Core)']);
  const [featSearch, setFeatSearch] = useState('');
  const [featSourceFilter, setFeatSourceFilter] = useState<string>('XPHB');
  const [previewMap, setPreviewMap] = useState<Record<string, string>>({});

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
  const classDefinition = useMemo<any>(() => 
    getClassDefinition(primaryClassEntry?.classId), 
    [primaryClassEntry?.classId]
  );
  const selectedClassId = primaryClassEntry?.classId;

  const spellcastingSummary = useMemo(() => {
    if (!character) return { casterLevel: 0, spellSlots: {}, cantripsKnown: 0, spellsPrepared: 0, featCapacity: 0, spellcastingAbility: undefined };
    return computeSpellcasting(character);
  }, [character]);

  // 切换职业时，自动回滚详情面板到顶部
  useEffect(() => {
    if (detailsPanelRef.current) {
      detailsPanelRef.current.scrollTop = 0;
    }
  }, [primaryClassEntry?.classId]);

  // 自动化：自动应用推荐选项 (defaultOptions)
  useEffect(() => {
    if (!character || !classDefinition) return;
    
    let updatedClassSelections = { ...(character.classSelections || {}) };
    let updatedSelectedSkills = [...(character.selectedSkills || [])];
    let updatedApplied = [...(character.defaultOptionsApplied || [])];
    let hasChanges = false;

    // 遍历所有已解锁特性
    combinedFeatures.forEach(f => {
      if (f.level <= primaryClassEntry.level && f.mechanics?.choices) {
        f.mechanics.choices.forEach((choice: any) => {
          if (choice.defaultOptions && !updatedApplied.includes(choice.id)) {
            // 如果是技能选择
            if (choice.type === 'skill') {
              const toAdd = choice.defaultOptions.filter((opt: string) => !updatedSelectedSkills.includes(normalizeSkillId(opt)));
              if (toAdd.length > 0) {
                updatedSelectedSkills = [...updatedSelectedSkills, ...toAdd];
                hasChanges = true;
              }
            } else {
              // 通用 classSelections
              if (!updatedClassSelections[choice.id] || updatedClassSelections[choice.id].length === 0) {
                updatedClassSelections[choice.id] = choice.defaultOptions;
                hasChanges = true;
              }
            }
            updatedApplied.push(choice.id);
          }
        });
      }
    });

    if (hasChanges) {
      updateActiveCharacter({
        classSelections: updatedClassSelections,
        selectedSkills: updatedSelectedSkills,
        defaultOptionsApplied: updatedApplied
      });
    }
  }, [character?.id, classDefinition?.nameEn, primaryClassEntry?.level]);


  const totalLevel = currentClasses.reduce((acc, c) => acc + c.level, 0);

  const handleSetPrimaryClass = (classId: string) => {
    const prevClassId = currentClasses[0]?.classId;
    let nextSelections = { ...(character?.classSelections || {}) };

    // 如果职业发生变化，清理旧职业的选择记录
    if (prevClassId && prevClassId !== classId) {
      Object.keys(nextSelections).forEach(key => {
        // 清理旧职业特有的 ID (符合 'cls:prevClassId:' 模式的)
        if (key.startsWith(`cls:${prevClassId}:`) || key === 'primary_class_skills' || key === 'primary_class_tools') {
          delete nextSelections[key];
        }
      });
    }

    // For single class flow, just set class at level 1
    const selectedDefinition = getClassDefinition(classId);
    updateActiveCharacter({
      classes: [{ classId, level: 1, isMulticlass: false, source: selectedDefinition?.source || 'PHB2024' }],
      classSelections: nextSelections
    });
    setSelectedFeatSlot(null);
  };

  const handleLevelChange = (classId: string, delta: number) => {
    // 职业基础页面不再允许修改等级
    return;
  };

  const handleSelectFeat = (classId: string, level: number, featId: string) => {
    let newSelectedFeats = [...(character?.selectedFeats || [])];
    newSelectedFeats = newSelectedFeats.filter(f => !(f.classId === classId && f.level === level));
    newSelectedFeats.push({ classId, level, featId });
    updateActiveCharacter({ selectedFeats: newSelectedFeats });
  };

  const handleSelectSubclass = (subclassId: string, targetClassId?: string) => {
    const targetId = targetClassId || primaryClassEntry?.classId;
    if (!targetId) return;

    const newClasses = currentClasses.map((entry) =>
      entry.classId === targetId ? { ...entry, subclassId } : entry
    );
    updateActiveCharacter({ classes: newClasses });
  };

  const handleEquipmentModeChange = (mode: 'choiceA' | 'choiceB' | 'choiceC' | 'package' | 'gold') => {
    if (!classDefinition) return;
    
    let updates: Partial<CharacterState> = {
      equipmentChoiceMode: mode
    };

    let records: EquipmentRecord[] = [];
    if (mode === 'choiceA' || mode === 'package') {
      records = classDefinition.startingEquipment.choiceARecords || [];
    } else if (mode === 'choiceB' || mode === 'gold') {
      const bRec = classDefinition.startingEquipment.choiceBRecord;
      records = Array.isArray(bRec) ? bRec : (bRec ? [bRec] : []);
    } else if (mode === 'choiceC') {
      const cRec = classDefinition.startingEquipment.choiceCRecord;
      records = Array.isArray(cRec) ? cRec : (cRec ? [cRec] : []);
    }

    // 1. Static items
    const items: InventoryEntry[] = records
      .filter((r: EquipmentRecord) => r.kind === 'item' && !r.selectionId)
      .map((r: EquipmentRecord) => ({
        id: r.itemId || Math.random().toString(36).substring(2, 11),
        name: r.label,
        quantity: r.quantity || 1,
        category: r.category as any || 'gear',
        itemId: r.itemId
      }));
    
    // 2. Resolve existing selections if any
    records
      .filter((r: EquipmentRecord) => r.selectionId)
      .forEach((r: EquipmentRecord) => {
        const selected = character?.classSelections?.[r.selectionId!]?.[0];
        if (selected) {
          items.push({
            id: r.selectionId!,
            name: translateProficiency(selected),
            quantity: 1,
            category: 'gear',
            itemId: selected
          });
        }
      });

    const currencyRecord = records.find((r: EquipmentRecord) => r.kind === 'currency');
    const currency = currencyRecord?.currency || {};
    
    updates.inventoryEntries = items;
    updates.currency = { gp: 0, sp: 0, ep: 0, cp: 0, pp: 0, ...currency };
    updates.equipmentIds = items.filter((i: InventoryEntry) => i.itemId).map((i: InventoryEntry) => i.itemId!);
    updates.startingEquipmentSynced = false;

    updateActiveCharacter(updates);
  };

  const handleEquipmentSelection = (selectionId: string, value: string) => {
    if (!classDefinition) return;
    
    const currentSelections = character?.classSelections || {};
    const nextSelections = {
      ...currentSelections,
      [selectionId]: [value]
    };

    // Update inventory entry for this selection slot
    const currentInventory = character?.inventoryEntries || [];
    const existingIdx = currentInventory.findIndex(i => i.id === selectionId);
    
    const newEntry = {
      id: selectionId,
      name: translateProficiency(value),
      quantity: 1,
      category: 'gear' as any,
      itemId: value
    };

    let nextInventory = [...currentInventory];
    if (existingIdx >= 0) {
      nextInventory[existingIdx] = newEntry;
    } else {
      nextInventory.push(newEntry);
    }

    updateActiveCharacter({
      classSelections: nextSelections,
      inventoryEntries: nextInventory,
      equipmentIds: Array.from(new Set([...(character?.equipmentIds || []), value]))
    });
  };





  const handleClassSelection = (choiceId: string, value: string, numToChoose: number = 1, category?: 'skill' | 'mastery' | 'custom' | 'feat' | 'subclass' | 'spell' | 'expertise' | 'tool' | 'weaponMastery' | 'fightingStyle' | 'language' | 'savingThrow', options: string[] = [], preSelected: string[] = []) => {
    if (category === 'subclass') {
      const newClasses = [...currentClasses];
      if (newClasses[0]) {
        newClasses[0] = { ...newClasses[0], subclassId: value };
        updateActiveCharacter({ classes: newClasses });
      }
    } else if (category === 'feat') {
       // Feats are handled via dedicated slots now, but keeping handler for compatibility
       const levelMatch = choiceId.match(/lvl(\d+)/);
       const level = levelMatch ? parseInt(levelMatch[1]) : 1;
       const slotId = `cls:${selectedClassId}:feat:feat_slot:lvl${level}`;
       const currentFeats = character?.selectedFeats || [];
       const existingIdx = currentFeats.findIndex(f => f.classId === selectedClassId && f.level === level);
       let nextFeats = [...currentFeats];
       if (existingIdx >= 0) {
         if (nextFeats[existingIdx].featId === value) nextFeats.splice(existingIdx, 1);
         else nextFeats[existingIdx] = { classId: selectedClassId as string, level, featId: value };
       } else {
         nextFeats.push({ classId: selectedClassId as string, level, featId: value });
       }
       updateActiveCharacter({ selectedFeats: nextFeats });
    } else {
      const currentSelections = character?.classSelections || {};
      let values = currentSelections[choiceId] || [];
      
      // Cumulative memory check for specific categories like weapon mastery
      const isMastery = category === 'mastery' || choiceId.includes('weapon_mastery');
      const otherSelectionsInSameCategory = isMastery 
        ? Object.entries(currentSelections)
            .filter(([id]) => id !== choiceId && id.includes('weapon_mastery'))
            .flatMap(([_, vals]) => vals)
        : [];

      if (values.includes(value)) {
        values = values.filter(v => v !== value);
      } else {
        if (otherSelectionsInSameCategory.includes(value)) return; // Prevent duplicate mastery
        if (values.length < numToChoose) {
          values = [...values, value];
        } else if (numToChoose === 1) {
          values = [value];
        }
      }
      updateActiveCharacter({
        classSelections: { ...currentSelections, [choiceId]: values },
        expertiseSkills: Array.from(new Set(Object.entries({ ...currentSelections, [choiceId]: values }).filter(([cid]) => cid.toLowerCase().includes('expertise') || cid.includes('专精')).flatMap(([_, vals]) => (vals || []).map(normalizeSkillId)))),



      });
    }
  };

  // Logic for exclusivity (already selected proficiencies)
  const preSelectedProficiencies = useMemo(() => {
    const profs: string[] = [];
    if (!character) return profs;

    // 1. From Species
    const species = getSpeciesDefinition(character) || getCatalogSpecies().find(s => s.id === character.speciesId);
    if (species) {
      const checkTrait = (traits: any[]) => {
        traits.forEach(trait => {
          if (trait.features?.skillProficiencies) {
            trait.features.skillProficiencies.forEach((s: any) => {
              if (typeof s === 'string') profs.push(normalizeSkillId(s));
            });
          }
          if (trait.features?.toolProficiencies) {
            trait.features.toolProficiencies.forEach((t: any) => {
              if (typeof t === 'string') profs.push(t.toLowerCase());
            });
          }
          if (trait.features?.languages) {
            trait.features.languages.forEach((l: any) => {
              if (typeof l === 'string') profs.push(l.toLowerCase());
            });
          }
          if (trait.options) checkTrait(trait.options);
        });
      };
      checkTrait(species.traits);
      if (character.subspeciesId && species.subSpecies?.options) {
        const sub = species.subSpecies.options.find(o => o.id === character.subspeciesId);
        if (sub) checkTrait(sub.traits);
      }
      
      // Add chosen ones from selections
      if (character.speciesSelections) {
        Object.values(character.speciesSelections).forEach(choices => {
          choices.forEach(c => {
             if (typeof c === 'string') profs.push(normalizeSkillId(c));
          });
        });
      }
    }

    // 2. From Background
    const background = getBackgroundDefinition(character) || getCatalogBackgrounds().find(b => b.id === character.backgroundId);
    if (background) {
      if (background.skillProficiencies) {
        background.skillProficiencies.forEach(s => {
          if (typeof s === 'string') profs.push(normalizeSkillId(s));
        });
      }
      if (background.toolProficiencies) {
        background.toolProficiencies.forEach(t => {
          if (typeof t === 'string') profs.push(t.toLowerCase());
        });
      }
      if (character.backgroundSelections) {
        Object.values(character.backgroundSelections).forEach(selected => {
          selected.forEach(s => {
            if (typeof s === 'string') profs.push(normalizeSkillId(s));
          });
        });
      }
    }

    // 3. From Background Selections (Redundant but safe)
    if (character.backgroundSelections) {
      Object.values(character.backgroundSelections).forEach(selected => {
        selected.forEach(s => {
          if (typeof s === 'string') profs.push(normalizeSkillId(s));
        });
      });
    }

    // 4. From Species Selections (Redundant but safe)
    if (character.speciesSelections) {
      Object.values(character.speciesSelections).forEach(selected => {
        selected.forEach(s => {
          if (typeof s === 'string') profs.push(normalizeSkillId(s));
        });
      });
    }
    return Array.from(new Set(profs));
  }, [character]);

  const allWeaponMasterySelections = useMemo(() => {
    const selections = character?.classSelections || {};
    return Object.entries(selections)
      .filter(([id]) => id.includes('weapon_mastery'))
      .reduce((acc, [id, vals]) => ({ ...acc, [id]: vals }), {} as Record<string, string[]>);
  }, [character?.classSelections]);

  // Weapon Mastery Filtering: Get current proficiencies
  const allProficiencies = useMemo(() => {
    if (!character) return { weapons: [], armor: [], skills: [], tools: [], languages: [], saves: [] };
    return computeProficiencies(character);
  }, [character]);

  const renderChoice = (id: string, selection: { name?: string; options: any[]; numToChoose: number; filter?: string; id?: string }, category: 'skill' | 'mastery' | 'custom' | 'feat' | 'subclass' | 'spell' | 'expertise' | 'tool' | 'weaponMastery' | 'fightingStyle' | 'language' | 'savingThrow' = 'custom', compact: boolean = false, parentFeature?: ClassFeature) => {
    // 2024 Rule: Multiclassing Proficiencies Override
    // Check if this class is NOT the first class
    const isMulticlassingThisClass = character?.classes?.[0]?.classId !== primaryClassEntry?.classId;
    if (isMulticlassingThisClass && category === 'skill' && classDefinition?.multiclassProficiencies?.skills) {
      selection = { ...selection, numToChoose: classDefinition.multiclassProficiencies.skills.numToChoose };
    }

    let chosen: string[] = [];
    
    // Expansion logic for generic keywords or filter strings
    let options = [...selection.options];
    
    // Support for filter string (e.g., "class:wizard;level:0")
    if ((selection as any).filter && (options.length === 0 || options[0] === 'Any')) {
      const filterStr = (selection as any).filter;
      const parts = filterStr.split(';').map((p: string) => p.trim());
      
      const cls = parts.find((p: string) => p.startsWith('class:'))?.split(':')[1]?.trim()?.toLowerCase();
      const lvl = parts.find((p: string) => p.startsWith('level:'))?.split(':')[1]?.trim();
      const school = parts.find((p: string) => p.startsWith('school:'))?.split(':')[1]?.trim()?.toLowerCase();
      const categoryFilter = parts.find((p: string) => p.startsWith('category:'))?.split(':')[1]?.trim();
      const typeFilter = parts.find((p: string) => p.startsWith('type:'))?.split(':')[1]?.trim();

      let isFeatFilter = false;
      let filtered = getCatalogSpells() as any[];

      if (categoryFilter) {
          isFeatFilter = true;
          const categories = categoryFilter.split(',').map((v: string) => v.trim());
          const featList = getCatalogFeats().filter(feat => categories.includes(feat.category));
          options = featList.map(feat => feat.id);
        } else if (typeFilter) {
            isFeatFilter = true;
            const types = typeFilter.split(',').map((v: string) => v.trim());
            const filteredTools: string[] = [];
            if (types.some((t: string) => t === '乐器' || t.toLowerCase().includes('musical'))) filteredTools.push(...MUSICAL_INSTRUMENTS);
            if (types.some((t: string) => t === '工匠工具' || t.toLowerCase().includes('artisan'))) filteredTools.push(...ARTISAN_TOOLS);
            if (types.some((t: string) => t === '游戏' || t.toLowerCase().includes('gaming'))) filteredTools.push(...GAMING_SETS);
            options = Array.from(new Set(filteredTools));
        } else {
          // Prepare class matchers
          const targetZh = cls ? translateClass(cls) : '';
          const targetEn = cls ? (cls.charAt(0).toUpperCase() + cls.slice(1)) : '';
          const allowedLvls = lvl ? lvl.split(',').map((v: string) => parseInt(v.trim())) : [];
          const targetSchools = school ? school.split(',').map((v: string) => v.trim().toLowerCase()) : [];

          filtered = filtered.filter(s => {
              const clsMatch = !cls || s.classes?.some((c: string) => 
                  c === targetZh || 
                  c === targetEn || 
                  c.toLowerCase() === cls || 
                  translateClass(c) === targetZh ||
                  translateClass(c) === translateClass(cls || '')
              );
              const lvlMatch = allowedLvls.length === 0 || allowedLvls.includes(s.level);
              const schoolMatch = targetSchools.length === 0 || targetSchools.some((ts: string) => {
                const sSchool = (s.school || '').toLowerCase();
                const tSchool = ts.toLowerCase();
                if (sSchool === tSchool) return true;
                
                const sZh = translateSpellSchool(s.school).replace('系', '');
                const tZh = translateSpellSchool(ts).replace('系', '');
                return sZh === tZh && sZh !== s.school; // 确保翻译成功且匹配
              });
              
              return clsMatch && lvlMatch && schoolMatch;
          });
          options = filtered.map(sp => sp.id); 
      }
    }
    // ── 关键词展开逻辑 (Keyword Expansion Logic) ──────────────────────────
    // 支持多个关键词同时存在，以及关键词与具体选项混合的情况
    const expandedOptions: string[] = [];
    const classNameZh = translateClass(classDefinition.nameEn);
    
    options.forEach(keyword => {
      if (typeof keyword !== 'string') {
        expandedOptions.push(keyword);
        return;
      }
      
      const lowKey = keyword.toLowerCase();
      if (keyword === 'Any' || keyword === 'Any Skill' || keyword === 'Any Skill Proficiency' || keyword === '任何技能') {
        if (category === 'weaponMastery') expandedOptions.push(...Object.keys(WEAPON_MAP));
        else if (category === 'tool') expandedOptions.push(...ALL_TOOLS);
        else expandedOptions.push(...ALL_SKILLS);
      } else if (keyword === 'Any Tool' || keyword === '任何工具') {
        expandedOptions.push(...ALL_TOOLS);
      } else if (lowKey === 'artisan\'s tools' || lowKey === 'artisan tools' || lowKey === 'artisan\'s tool' || lowKey === '工匠工具') {
        expandedOptions.push(...ARTISAN_TOOLS);
      } else if (lowKey === 'any musical instrument' || lowKey === 'musical instrument' || lowKey === 'musical instruments' || keyword === '任何乐器' || keyword === '乐器') {
        expandedOptions.push(...MUSICAL_INSTRUMENTS);
      } else if (lowKey === 'any gaming set' || lowKey === 'gaming set' || lowKey === 'gaming sets' || keyword === '任何游戏套装' || keyword === '游戏') {
        expandedOptions.push(...GAMING_SETS);
      } else if (keyword === 'General Feat') {
        expandedOptions.push(...getCatalogFeats().filter(f => f.category === 'General').map(f => f.id));
      } else if (keyword === 'Epic Boon') {
        expandedOptions.push(...getCatalogFeats().filter(f => f.category === 'Epic Boon').map(f => f.id));
      } else if (keyword === 'Fighting Style Feat') {
        expandedOptions.push(...getCatalogFeats().filter(f => f.category === 'Fighting Style').map(f => f.id));
      } else if (lowKey.includes('cantrips') || keyword.includes('戏法列表')) {
        expandedOptions.push(...getCatalogSpells().filter(s => s.level === 0 && (s.classes.includes(classNameZh) || s.classes.includes(classDefinition.nameEn))).map(s => s.nameEn));
      } else if (lowKey.includes('1st level spells') || keyword.includes('1环法术列表')) {
        expandedOptions.push(...getCatalogSpells().filter(s => s.level === 1 && (s.classes.includes(classNameZh) || s.classes.includes(classDefinition.nameEn))).map(s => s.nameEn));
      } else if (keyword === 'Cleric, Druid, or Wizard Spells' || keyword === '牧师、德鲁伊、法师法术列表') {
        expandedOptions.push(...getCatalogSpells().filter(s => s.level <= 3 && (s.classes.includes('牧师') || s.classes.includes('Cleric') || s.classes.includes('德鲁伊') || s.classes.includes('Druid') || s.classes.includes('法师') || s.classes.includes('Wizard'))).map(s => s.nameEn));
      } else {
        expandedOptions.push(keyword);
      }
    });

    if (expandedOptions.length > 0) {
      options = Array.from(new Set(expandedOptions));
    }

    // Filter Weapon Mastery options based on actual proficiencies (fallback, usually caught earlier)
    if (category === 'weaponMastery' || id.includes('weapon_mastery')) {
      const wpIds = allProficiencies.weapons.map(w => w.id);
      options = options.filter(opt => isProficientWithWeapon(opt, wpIds));
    }

    // ── 动态选项解析逻辑 (Dynamic Options Resolution) ──────────────────────────
    let resolvedOptions = [...options];



    // 提取当前所有已掌握熟练的技能集合 (用于专精置灰等逻辑)
    const allCurrentSkillsInClass = Object.entries(character?.classSelections || {})
      .filter(([cid]) => cid.includes(':base:prof:skills') || cid.includes(':prof:skills') || cid === 'primary_class_skills')
      .flatMap(([_, v]) => v);
      
    const allAvailableProficiencies = Array.from(new Set([
      ...(character?.selectedSkills || []),
      ...allCurrentSkillsInClass,
      ...preSelectedProficiencies
    ])).map(v => normalizeSkillId(v));

    // 2. 处理专精动态加载 (若未提供选项则 fallback 到全部技能)
    if (category === 'expertise' && (resolvedOptions.length === 0 || (resolvedOptions.length === 1 && resolvedOptions[0].toLowerCase().includes('any')))) {
      resolvedOptions = [...ALL_SKILLS];
    }

    const finalOptions = resolvedOptions;

    if (category === 'skill' && (id.includes(':base:prof:skills') || id.includes(':prof:skills'))) {
      // 优先从 classSelections 中读取（新标准 ID 模式）
      const classSpecificChosen = character?.classSelections?.[id] || [];
      if (classSpecificChosen.length > 0) {
        chosen = classSpecificChosen;
      } else {
        // 兼容模式：如果 classSelections 为空，从全局 selectedSkills 中反向过滤
        chosen = (character?.selectedSkills || []).filter(s => {
          const nid = normalizeSkillId(s);
          // 仅显示属于当前槽位选项、且非种族/背景预设的技能
          return finalOptions.some(opt => normalizeSkillId(opt) === nid) && !preSelectedProficiencies.includes(nid);
        });
      }
    } else if (category === 'subclass') {
      const sc = currentClasses[0]?.subclassId;
      chosen = sc ? [sc] : [];
    } else if (category === 'feat') {
      const levelMatch = id.match(/lvl(\d+)/);
      const level = levelMatch ? parseInt(levelMatch[1]) : 1;
      const f = (character?.selectedFeats || []).find(feat => feat.classId === selectedClassId && feat.level === level);
      chosen = f ? [f.featId] : [];
    } else {
      chosen = (character?.classSelections?.[id] || []);
    }
    
    const isComplete = chosen.length === selection.numToChoose;

    const getTitle = () => {
      if (selection.name) return selection.name;
      switch(category as string) {
        case 'skill': return '技能熟练 Skill Proficiency';
        case 'expertise': return '技能专精 Skill Expertise';
        case 'tool': return '工具熟练 Tool Proficiency';
        case 'subclass': return '子职业选择 Subclass Selection';
        case 'mastery': return '武器精通 Weapon Mastery';
        case 'feat': return selection.options[0] === 'Epic Boon' ? '传奇恩惠 Epic Boon' : '专长选择 Feat Selection';
        case 'spell': return '法术选择 Spell Selection';
        default: return '选项选择 Selection';
      }
    };

    // Description-Only Rule: Render selection and description, but NO nested mechanics
    if (category === 'feat' || category === 'spell') {
      const isSpell = category === 'spell';
      const items = finalOptions.map(optId => {
        if (isSpell) return getSpellDefinition(optId);
        return getFeatDefinition(optId) || getCatalogFeats().find(f => (f.id === optId || f.nameEn === optId));
      }).filter(Boolean);

      const currentSelectedId = chosen[0];
      const currentSelectedItem = items.find(it => it && (it.id === currentSelectedId || it.nameEn === currentSelectedId));

      return (
        <div key={id} style={{ marginTop: 16, padding: 20, border: isComplete ? '2px solid var(--color-gold-bright)' : '1px solid var(--color-border-dark)', borderRadius: 12, background: isComplete ? 'rgba(197, 160, 89, 0.08)' : 'var(--color-bg-dark)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{getTitle()}</span>
            <div style={{ fontSize: '11px', color: 'var(--color-text-secondary)' }}>已选 {chosen.length}/{selection.numToChoose}</div>
          </div>
          
          {/* Master View: Compact Capsules */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: currentSelectedItem ? 16 : 0 }}>
            {items.map(item => {
              if (!item) return null;
              const itemId = item.id || item.nameEn;
              const isSelected = chosen.includes(itemId);
              return (
                <PillButton
                  key={itemId}
                  size="sm"
                  variant={isSelected ? 'primary' : 'outline'}
                  onClick={() => handleClassSelection(id, itemId, selection.numToChoose, category, finalOptions, preSelectedProficiencies)}
                >
                  {item.name} {isSelected && '(已选)'}
                </PillButton>
              );
            })}
          </div>

          {/* Detail Pane: Description Only */}
          {currentSelectedItem && (
            <div style={{ 
              padding: '16px', 
              background: 'var(--color-bg-surface)', 
              borderRadius: '8px', 
              border: '1px solid var(--color-border-dark)',
              fontSize: '13px',
              color: 'var(--color-text-secondary)',
              lineHeight: 1.6
            }}>
              <div style={{ fontWeight: 600, marginBottom: 4, color: 'var(--color-text-primary)' }}>
                {currentSelectedItem.name} <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)', fontSize: '11px' }}>{currentSelectedItem.nameEn}</span>
              </div>
              <MarkdownText text={currentSelectedItem.description} />
              <div style={{ marginTop: 8, fontSize: '11px', color: 'var(--color-gold-bright)', fontStyle: 'italic' }}>
                * 请在后续的“{isSpell ? '法术准备' : '专长精选'}”页面完成详细配置。
              </div>
            </div>
          )}
        </div>
      );
    }

    // Cumulative exclusion for choices across different slots/levels
    // Optimization: Only exclude items from relevant categories to avoid equipment choices blocking proficiencies
    const allCurrentSelections = [
      // 1. 全局已选技能（背景/种族等）
      ...(character?.selectedSkills || []),
      // 2. 职业内部的其他选择
      ...Object.entries(character?.classSelections || {})
        .filter(([cid]) => {
          // 排除当前正在操作的槽位，防止自冲突
          if (cid === id) return false;

          // 特殊逻辑：专精 (Expertise)
          // 专精槽位只被“其他专精槽位”遮挡，而不被“熟练度槽位”遮挡
          if (id.includes('expertise')) {
            return cid.includes('expertise');
          }

          // 如果当前是熟练度槽位，只被其他熟练度槽位（包含 :prof:, skill, tool, proficiency 等关键词）遮挡
          const isCurrentProf = id.includes(':prof:') || id.includes('primary_class_');
          if (isCurrentProf) {
            return cid.includes(':prof:') || cid.includes('skill') || cid.includes('tool') || cid.includes('proficiency');
          }
          return true; 
        })
        .flatMap(([_, vals]) => vals)
    ].map(v => normalizeSkillId(v));

    const alreadySelectedInOtherSlots = allCurrentSelections;

    // ── 武器精通：隐藏信息卡，仅保留特性描述，选择移至角色卡 ─────────────────────
    if (category === 'weaponMastery' || category === 'mastery' || id.toLowerCase().includes('weapon_mastery')) {
      return null;
    }
    // ─────────────────────────────────────────────────────────────────
    // ─────────────────────────────────────────────────────────────────

    if (category === 'language') {
      const uniqueSources = Array.from(new Set(allLanguages.map(l => l.source))).filter(Boolean) as string[];
      const filteredLanguages = allLanguages.filter(l => {
        const categoryMatch = langCategory === 'All' || l.type === langCategory;
        const sourceMatch = langSource === 'All' || l.source === langSource;
        
        const keyword = finalOptions.length === 1 ? finalOptions[0] : '';
        let isAllowed = finalOptions.includes(l.name) || finalOptions.includes(l.nameEn) || finalOptions.includes('Any') || finalOptions.includes('any') || finalOptions.includes('Any Standard Language') || finalOptions.includes('Any Rare Language');
        
        if (keyword === 'Any standard language' || keyword === '任何标准语言' || keyword === 'Any Standard Language') {
          isAllowed = l.type === 'Standard';
        } else if (keyword === 'Any rare language' || keyword === '任何稀有语言' || keyword === 'Any Rare Language') {
          isAllowed = l.type === 'Rare';
        } else if (finalOptions.length === 0 || finalOptions[0] === 'Any' || finalOptions[0] === 'any') {
          isAllowed = true;
        }
        
        return categoryMatch && sourceMatch && isAllowed;
      });

      return (
        <div key={id} style={{ 
          marginTop: 16, 
          padding: compact ? '12px 16px' : 20, 
          border: isComplete ? '2px solid var(--color-gold-bright)' : '1px solid var(--color-border-dark)', 
          borderRadius: 12,
          background: isComplete ? 'rgba(197, 160, 89, 0.08)' : 'var(--color-bg-dark)',
          transition: 'all 0.3s ease',
          position: 'relative'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <span style={{ fontSize: '14px', fontWeight: 700, color: isComplete ? 'var(--color-gold-bright)' : 'var(--color-text-primary)' }}>
              {getTitle()}
              {isComplete && <span style={{ marginLeft: 6 }}>✓</span>}
            </span>
            <div style={{ 
              fontSize: '11px', 
              fontWeight: 700, 
              padding: '2px 8px', 
              borderRadius: 10, 
              background: isComplete ? 'rgba(0, 113, 227, 0.1)' : 'rgba(0,0,0,0.05)',
              color: isComplete ? 'var(--color-apple-blue)' : '#86868b'
            }}>
              已选 {chosen.length}/{selection.numToChoose}
            </div>
          </div>

          {/* Filter Controls */}
          <div style={{ marginBottom: 12, display: 'flex', gap: 8, flexWrap: 'wrap', padding: '10px', background: 'rgba(0,0,0,0.03)', borderRadius: 8 }}>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {['Standard', 'Rare', 'All'].map(cat => (
                <PillButton key={cat} size="sm" variant={langCategory === cat ? 'primary' : 'outline'} onClick={() => setLangCategory(cat)}>
                  {cat === 'Standard' ? '标准' : cat === 'Rare' ? '稀有' : '全部'}
                </PillButton>
              ))}
            </div>
            <div style={{ width: '1px', background: '#ddd', margin: '0 4px' }} />
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              <PillButton size="sm" variant={langSource === 'All' ? 'primary' : 'outline'} onClick={() => setLangSource('All')}>全部来源</PillButton>
              {uniqueSources.map(src => (
                <PillButton key={src} size="sm" variant={langSource === src ? 'primary' : 'outline'} onClick={() => setLangSource(src)}>
                  {src}
                </PillButton>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {filteredLanguages.map(lang => {
              const isChosen = chosen.includes(lang.nameEn);
              return (
                <PillButton
                  key={lang.id}
                  size="sm"
                  variant={isChosen ? 'primary' : 'outline'}
                  onClick={() => handleClassSelection(id, lang.nameEn, selection.numToChoose, category, finalOptions, preSelectedProficiencies)}
                >
                  {lang.name}
                </PillButton>
              );
            })}
            {filteredLanguages.length === 0 && (
              <p style={{ fontSize: '12px', color: '#86868b', width: '100%', textAlign: 'center', padding: '10px' }}>
                当前筛选条件下没有匹配的语言。
              </p>
            )}
          </div>
        </div>
      );
    }

    return (
      <div key={id} style={{ 
        marginTop: 16, 
        padding: compact ? '12px 16px' : 20, 
        border: isComplete ? '2px solid var(--color-gold-bright)' : '1px solid var(--color-border-dark)', 
        borderRadius: 14,
        background: isComplete ? 'rgba(197, 160, 89, 0.08)' : 'var(--color-bg-dark)',
        boxShadow: isComplete ? '0 8px 20px rgba(197, 160, 89, 0.1)' : '0 2px 8px rgba(0,0,0,0.1)',
        transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Gold accent indicator bar */}
        <div style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: 4,
          background: isComplete ? 'var(--color-gold-bright)' : 'transparent',
          opacity: 0.8
        }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: '14px', fontWeight: 700, color: isComplete ? 'var(--color-apple-blue)' : 'var(--color-text-primary)' }}>
            {getTitle()}
            {isComplete && <span style={{ marginLeft: 6 }}>✓</span>}
          </span>
          <div style={{ 
            fontSize: '11px', 
            fontWeight: 700, 
            padding: '2px 8px', 
            borderRadius: 10, 
            background: isComplete ? 'rgba(0, 113, 227, 0.1)' : 'rgba(0,0,0,0.05)',
            color: isComplete ? 'var(--color-apple-blue)' : '#86868b'
          }}>
            已选 {chosen.length}/{selection.numToChoose}
          </div>
        </div>
        {category === 'subclass' ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
            {classDefinition.subClassInfo?.options.map((sub: any) => {
              const subclassId = sub.catalogId || sub.nameEn || sub.name;
              const isChosen = chosen.includes(subclassId) || chosen.includes(sub.nameEn);
              const descParts = sub.description.split('\n\n');
              const subtitle = descParts.length > 1 ? descParts[0] : '';
              const mainDesc = descParts.length > 1 ? descParts.slice(1).join('\n\n') : sub.description;
              
              return (
                <div 
                  key={subclassId}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClassSelection(id, subclassId, selection.numToChoose, category, finalOptions, preSelectedProficiencies);
                  }}
                  style={{
                    padding: '20px',
                    borderRadius: '16px',
                    background: isChosen ? 'rgba(197, 160, 89, 0.12)' : 'var(--color-bg-dark)',
                    border: isChosen ? '2px solid var(--color-gold-bright)' : '1px solid var(--color-border-dark)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    boxShadow: isChosen ? '0 4px 12px rgba(0, 113, 227, 0.15)' : 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: isChosen ? '6px solid #0071e3' : '2px solid #d2d2d7', boxSizing: 'border-box' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--color-text-primary)' }}>{sub.name} <span style={{ fontSize: '12px', color: '#86868b', fontWeight: 400 }}>{sub.nameEn}</span></div>
                    </div>
                  </div>
                  {subtitle && <div style={{ fontSize: '13px', color: 'var(--color-text-primary)', fontWeight: 600 }}>{subtitle}</div>}
                  <div style={{ fontSize: '13px', color: '#515154', lineHeight: 1.6 }}>
                    <MarkdownText text={mainDesc} variant="clean" />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (id.includes('invocation') || id.includes('metamagic') || parentFeature?.options?.some(o => o.description || o.mechanics)) ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
            {finalOptions.map(opt => {
              // 优先级：魔契师祈唤反查 > 选项本身是对象 > 特性自带的 options 反查
              const isObject = typeof opt === 'object' && opt !== null;
              const optId = isObject ? (opt.nameEn || opt.name) : opt;
              
              const inv = id.includes('invocation') ? WarlockInvocations2024.find(i => i.name === optId || i.nameEn === optId) : null;
              const optDef = isObject ? opt : parentFeature?.options?.find(o => o.name === opt || o.nameEn === opt);
              
              const displayObj = inv || optDef;
              if (!displayObj) return (
                <div 
                  key={optId}
                  onClick={() => handleClassSelection(id, optId, selection.numToChoose, category, finalOptions, preSelectedProficiencies)}
                  className={`${styles.pill} ${chosen.includes(optId) ? styles.pillActive : ''}`}
                >
                  {translateLabel(optId)}
                </div>
              );

              const isChosen = chosen.includes(optId);
              return (
                <OptionCardInline
                  key={optId}
                  displayObj={displayObj}
                  isChosen={isChosen}
                  inv={inv}
                  onClick={() => handleClassSelection(id, optId, selection.numToChoose, category, finalOptions, preSelectedProficiencies)}
                />
              );
            })}
          </div>
        ) : (
        <>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {finalOptions.map((opt, idx) => {
              const isObject = typeof opt === 'object' && opt !== null;
              const optId = isObject ? (opt.nameEn || opt.name || idx.toString()) : opt;

              const isRepeatableFeat = isObject && (opt as any).repeatable === true;
              const isProficientForExpertise =
                category === 'expertise'
                  ? (optId === 'thievesTools' || allAvailableProficiencies.includes(normalizeSkillId(optId)))
                  : true;
              const isAlreadySelected = !isRepeatableFeat && alreadySelectedInOtherSlots.includes(normalizeSkillId(optId));
              const isPre = (category === 'skill' || category === 'tool') && preSelectedProficiencies.includes(normalizeSkillId(optId));
              const isDisabled = isPre || isAlreadySelected || !isProficientForExpertise;
              const isChosen = chosen.includes(optId);
              
              const getDisplayLabel = () => {
                if (isObject) return opt.name || opt.nameEn;
                if (category === 'skill' || category === 'expertise') return translateSkill(opt);
                if (category === 'tool') return translateProficiency(opt);
                // Check if it's a Fighting Style or other class feature option
                if (parentFeature?.options) {
                  const o = parentFeature.options.find(x => x.name === opt || x.nameEn === opt);
                  if (o) return o.name;
                }
                return translateLabel(opt);
              };
              
              return (
                <PillButton
                  key={optId}
                  size="sm"
                  variant={isChosen ? 'primary' : 'outline'}
                  disabled={isDisabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isDisabled) return;
                    setPreviewMap(prev => ({ ...prev, [id]: optId }));
                    handleClassSelection(id, optId, selection.numToChoose, category, finalOptions, preSelectedProficiencies);
                  }}
                  style={{
                    opacity: isDisabled ? 0.4 : 1,
                    cursor: isDisabled ? 'not-allowed' : 'pointer',
                    transform: isChosen ? 'scale(1.02)' : 'scale(1)',
                    boxShadow: isChosen ? '0 4px 10px var(--color-border-gold)' : 'none',
                    transition: 'all 0.2s ease'
                  }}
                >
                  {getDisplayLabel()}
                  {(selection as any).defaultOptions?.includes(optId) && <span style={{ fontSize: '10px', marginLeft: 4, color: isChosen ? '#fff' : 'var(--color-gold-accent)' }}>(推荐)</span>}
                  {(isPre || isAlreadySelected) && <span style={{ fontSize: '10px', marginLeft: 4 }}>(已选)</span>}
                  {category === 'expertise' && !isProficientForExpertise && <span style={{ fontSize: '10px', marginLeft: 4, opacity: 0.6 }}>(需熟练)</span>}
                </PillButton>
              );
            })}
          </div>

          {/* 法术/通用详情展示区 */}
          {(() => {
            const selectedIdInChoice = chosen[0];
            const currentPreviewId = previewMap[id];
            const activePreviewId = (currentPreviewId && finalOptions.includes(currentPreviewId)) ? currentPreviewId : null;
            const activeId = selectedIdInChoice || activePreviewId;
            
            if (!activeId || category === 'skill' || category === 'tool' || (category as string) === 'language') return null;
            
            let title = '';
            let name = '';
            let desc = '';
            
            const cat = category as string;
            if (cat === 'spell') {
              const spell = getSpellDefinition(activeId);
              if (spell) {
                const schoolZh = translateSpellSchool(spell.school);
                const sourceZh = translateSource(spell.source);
                title = `${spell.level === 0 ? '戏法' : spell.level + '环法术'} | ${schoolZh} | ${sourceZh}`;
                name = spell.name;
                desc = spell.description;
              }
            } else {
              // 兜底逻辑：处理 Fighting Style 或其他自定义选项
              const optDef = parentFeature?.options?.find(o => o.name === activeId || o.nameEn === activeId);
              if (optDef) {
                name = optDef.name;
                desc = optDef.description || '';
              }
            }
            
            if (!name || !desc) return null;

            return (
              <div style={{ 
                marginTop: '12px', 
                padding: '16px', 
                background: '#f8f9fa', 
                borderRadius: '12px', 
                border: '1px solid rgba(0,0,0,0.05)',
                fontSize: '14px',
                color: 'var(--color-text-primary)',
                lineHeight: 1.6
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  {title && (
                    <span style={{ 
                      fontSize: '10px', 
                      background: '#e8e8ed', 
                      padding: '2px 6px', 
                      borderRadius: '4px', 
                      color: '#86868b',
                      fontWeight: 600
                    }}>
                      {title}
                    </span>
                  )}
                  <span style={{ fontWeight: 700 }}>{name}</span>
                </div>
                <div style={{ color: '#515154' }}>
                  <MarkdownText text={desc} />
                </div>
              </div>
            );
          })()}
        </>
        )}
      </div>
    );
  };

  // Compute feat slots and subclass features to show
  const { combinedFeatures, featSlotCount } = useMemo(() => {
    if (!classDefinition || !primaryClassEntry) return { combinedFeatures: [], featSlotCount: 0 };
    
    let features = [...classDefinition.features];
    let slots = 0;
    
    // Add subclass features if selected
    if (primaryClassEntry.subclassId) {
      const sub = classDefinition.subClassInfo?.options.find((o: any) => o.catalogId === primaryClassEntry.subclassId || o.nameEn === primaryClassEntry.subclassId || o.name === primaryClassEntry.subclassId);
      if (sub && sub.traits) {
        features = [...features, ...sub.traits];
      }
    }
    
    // Count feat slots across all levels of the current class
    features.forEach(f => {
      if (f.level <= primaryClassEntry.level && f.mechanics?.choices?.some((c: any) => c.type === 'feat')) {
        slots += f.mechanics?.choices?.filter((c: any) => c.type === 'feat').reduce((acc: number, c: any) => acc + (c.numToChoose || 1), 0);
      }
    });

    return { 
      combinedFeatures: features
        .filter(f => !(f.name === '子职特性' && f.nameEn === 'Subclass Feature'))
        .sort((a, b) => a.level - b.level),
      featSlotCount: slots
    };
  }, [classDefinition, primaryClassEntry]);

  // Generic feat slot logic for multiple classes (for summary card)
  const allFeatSlots = useMemo(() => {
    let total = 0;
    currentClasses.forEach(cEntry => {
      const def = getClassDefinition(cEntry.classId);
      if (def) {
        def.features.forEach((f: ClassFeature) => {
          if (f.level <= cEntry.level) {
             f.mechanics?.choices?.filter((c: any) => c.type === 'feat').forEach((c: any) => {
               total += (c.numToChoose || 1);
             });
          }
        });
      }
    });
    return total;
  }, [currentClasses]);

  const generalFeats = useMemo(() => getCatalogFeats().filter(f => f.category === 'General' || f.category === 'Fighting Style'), []);

  const getFeatForSlot = (classId: string, level: number) => {
    const record = character?.selectedFeats?.find(f => f.classId === classId && f.level === level);
    if (!record) return null;
    return getFeatDefinition(record.featId) || getCatalogFeats().find(f => f.id === record.featId);
  };

  // Grouping logic
  const classGroups = useMemo(() => {
    const groups: Record<string, any[]> = {};
    const classList = getCatalogClasses();
    classList.forEach(cls => {
      const source = (cls as any).source || 'PHB2024';
      const groupName = source === 'PHB2024' || source === 'XPHB' ? '2024 核心规则 (Core)' : 
                        source === 'PHB' ? '2014 经典规则 (Legacy)' : 
                        source;
      if (!groups[groupName]) groups[groupName] = [];
      groups[groupName].push(cls);
    });
    return groups;
  }, [catalogStatus]);

  const toggleGroup = (groupName: string) => {
    setExpandedSources(prev => 
      prev.includes(groupName) ? prev.filter(g => g !== groupName) : [...prev, groupName]
    );
  };

  if (!character) return <div className="page-container">加载中...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>职业选择 <span style={{fontWeight:400, color:'#86868b', fontSize:'18px', marginLeft:'8px'}}>Class Selection</span></h2>
        </div>
      </div>

      <div className={styles.content}>
        {/* Selection List */}
        <div className={styles.list}>
          {Object.entries(classGroups).map(([groupName, classes]) => {
            const isExpanded = expandedSources.includes(groupName);
            return (
              <div key={groupName} className={styles.listGroup}>
                <div className={styles.groupHeader} onClick={() => toggleGroup(groupName)}>
                  <span>{groupName} ({classes.length})</span>
                  <span className={`${styles.groupIcon} ${isExpanded ? styles.groupIconExpanded : ''}`}>▶</span>
                </div>
                <div className={isExpanded ? styles.groupContent : styles.groupContentHidden}>
                  {classes.map((cls) => (
                    <OptionCard
                      key={cls.catalogId || `${cls.source}:${cls.nameEn}`}
                      title={translateClass(cls.name)}
                      subtitle={cls.nameEn}
                      compact
                      selected={primaryClassEntry?.classId === (cls.catalogId || cls.nameEn) || primaryClassEntry?.classId === cls.nameEn}
                      onClick={() => handleSetPrimaryClass(cls.catalogId || cls.nameEn)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {/* Details Panel */}
        <div className={styles.detailsPanel} ref={detailsPanelRef}>
          {classDefinition && primaryClassEntry ? (
            <div className={styles.detailsContent}>
              {/* Header Section */}
              <div className={styles.detailsHeader}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <h3 className={styles.detailsTitle}>
                      {translateClass(classDefinition.name)} 
                      <span className={styles.detailsSubtitle}>{classDefinition.nameEn}</span>
                    </h3>
                    <div className={styles.sourceBadge}>{classDefinition.source === 'XPHB' ? '2024 核心规则' : 'Legacy 经典规则'}</div>
                  </div>
                </div>
              </div>

              <CollapsibleSection title="职业概览 Class Overview" defaultOpen={true}>
                <div className={classStyles.descriptionBox}>
                  <MarkdownText text={classDefinition.description} />
                </div>
              </CollapsibleSection>

              {/* Core Traits Grid */}
              <div className={classStyles.coreTraitsGrid}>
                <div className={classStyles.coreTraitRow}>
                  <div className={classStyles.coreTraitLabel}>主要属性 Primary Ability</div>
                  <div className={classStyles.coreTraitValue}>
                    {classDefinition.primaryAbility.map((a: string) => (
                      <span key={a} style={{fontWeight:600}}>{translateAbilityKey(normalizeAbilityKey(a) || a)}</span>
                    ))}
                  </div>
                </div>
                <div className={classStyles.coreTraitRow}>
                  <div className={classStyles.coreTraitLabel}>生命值骰 Hit Die</div>
                  <div className={classStyles.coreTraitValue}>d{classDefinition.hitPointDie}</div>
                </div>
                <div className={classStyles.coreTraitRow}>
                  <div className={classStyles.coreTraitLabel}>豁免熟练 Saving Throws</div>
                  <div className={classStyles.coreTraitValue}>
                    {classDefinition.proficiencies.savingThrows.map((s: string) => translateAbilityKey(normalizeAbilityKey(s) || s)).join(', ')}
                  </div>
                </div>
                <div className={classStyles.coreTraitRow}>
                  <div className={classStyles.coreTraitLabel}>技能熟练 Skills</div>
                  <div className={classStyles.coreTraitValue} style={{flexDirection:'column', alignItems:'flex-start'}}>
                    <div style={{marginBottom: 8}}>
                      自选 {classDefinition.proficiencies.skills.numToChoose} 项：
                    </div>
                    {renderChoice(`cls:${classDefinition.nameEn}:base:prof:skills`, classDefinition.proficiencies.skills, 'skill', false)}
                  </div>
                </div>
                <div className={classStyles.coreTraitRow}>
                  <div className={classStyles.coreTraitLabel}>武器精通 Weapons</div>
                  <div className={classStyles.coreTraitValue}>
                    {classDefinition.proficiencies.weapons.map((w: string) => translateProficiency(w)).filter(Boolean).join(', ')}
                  </div>
                </div>
                <div className={classStyles.coreTraitRow}>
                  <div className={classStyles.coreTraitLabel}>护甲受训 Armor</div>
                  <div className={classStyles.coreTraitValue}>
                    {classDefinition.proficiencies.armor.length > 0 
                      ? classDefinition.proficiencies.armor.map((a: string) => translateProficiency(a)).filter(Boolean).join(', ') 
                      : '无'}
                  </div>
                </div>
                {classDefinition.proficiencies.tools && (
                  <div className={classStyles.coreTraitRow}>
                    <div className={classStyles.coreTraitLabel}>工具熟练 Tools</div>
                    <div className={classStyles.coreTraitValue}>
                      {Array.isArray(classDefinition.proficiencies.tools) 
                        ? (classDefinition.proficiencies.tools.length > 0 ? classDefinition.proficiencies.tools.map((t: string) => translateProficiency(t)).filter(Boolean).join(', ') : '无')
                        : renderChoice(`cls:${classDefinition.nameEn}:base:prof:tools`, classDefinition.proficiencies.tools, 'tool', false)
                      }
                    </div>
                  </div>
                )}
                {/* Conditional Spellcasting Row */}
                {(classDefinition as any).spellcasting || classDefinition.features.some((f: ClassFeature) => f.name.includes('施法') || f.nameEn?.toLowerCase().includes('spellcasting')) ? (
                  <div className={classStyles.coreTraitRow}>
                    <div className={classStyles.coreTraitLabel}>施法属性 Spellcasting</div>
                    <div className={classStyles.coreTraitValue}>
                      {classDefinition.primaryAbility.map((a: string) => translateAbilityKey(a)).join(' 或 ')}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* 起始装备选择 Starting Equipment Selection */}
              {(!primaryClassEntry.isMulticlass) && (
                <div style={{ margin: '32px 0' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: 700, color: 'var(--color-text-primary)', margin: 0 }}>
                      起始装备选择 Starting Equipment Selection
                    </h4>
                    <div style={{ 
                      fontSize: '11px', 
                      fontWeight: 700, 
                      padding: '2px 8px', 
                      borderRadius: 10, 
                      background: character.equipmentChoiceMode ? 'rgba(0, 113, 227, 0.1)' : 'rgba(0,0,0,0.05)',
                      color: character.equipmentChoiceMode ? 'var(--color-gold-accent)' : '#86868b'
                    }}>
                       {character.equipmentChoiceMode === 'choiceB' ? '起始金币' : (character.equipmentChoiceMode === 'choiceA' || character.equipmentChoiceMode === 'package') ? '起始装备' : '未选'}
                    </div>
                  </div>

                  <div className={classStyles.becomingGrid} style={{ 
                    gridTemplateColumns: classDefinition.startingEquipment.choiceC ? 'repeat(auto-fit, minmax(200px, 1fr))' : '1fr 1fr' 
                  }}>
                    {/* Choice A */}
                    <div 
                      className={`${classStyles.becomingCard} ${ (character.equipmentChoiceMode === 'choiceA' || character.equipmentChoiceMode === 'package') ? classStyles.becomingCardActive : ''}`}
                      onClick={() => handleEquipmentModeChange('choiceA')}
                      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
                    >
                      <div className={classStyles.becomingTitle}>
                        选项 A
                        <div style={{ 
                          width: '20px', 
                          height: '20px', 
                          borderRadius: '50%', 
                          border: (character.equipmentChoiceMode === 'choiceA' || character.equipmentChoiceMode === 'package') ? '6px solid #0071e3' : '2px solid #d2d2d7', 
                          boxSizing: 'border-box',
                          transition: 'all 0.2s ease'
                        }} />
                      </div>
                      <div className={classStyles.becomingDesc} style={{ flex: 1 }}>
                        <ul style={{ margin: '8px 0 0 0', paddingLeft: '18px', listStyleType: 'circle', fontSize: '12px' }}>
                          {classDefinition.startingEquipment.choiceA.map((item: any, idx: number) => (
                            <li key={idx} style={{ marginBottom: '4px' }}>
                              {typeof item === 'string' ? item : '自选项目'}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Choice B */}
                    <div 
                      className={`${classStyles.becomingCard} ${ (character.equipmentChoiceMode === 'choiceB' || character.equipmentChoiceMode === 'gold') ? classStyles.becomingCardActive : ''}`}
                      onClick={() => handleEquipmentModeChange('choiceB')}
                      style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
                    >
                      <div className={classStyles.becomingTitle}>
                        选项 B
                        <div style={{ 
                          width: '20px', 
                          height: '20px', 
                          borderRadius: '50%', 
                          border: (character.equipmentChoiceMode === 'choiceB' || character.equipmentChoiceMode === 'gold') ? '6px solid #0071e3' : '2px solid #d2d2d7', 
                          boxSizing: 'border-box',
                          transition: 'all 0.2s ease'
                        }} />
                      </div>
                      <div className={classStyles.becomingDesc} style={{ flex: 1 }}>
                         {classDefinition.startingEquipment.choiceB.includes('，') || classDefinition.startingEquipment.choiceB.includes(',') || classDefinition.startingEquipment.choiceB.includes(' 及') ? (
                           <ul style={{ margin: '8px 0 0 0', paddingLeft: '18px', listStyleType: 'circle', fontSize: '12px' }}>
                             {classDefinition.startingEquipment.choiceB.split(/[，,及]/).filter((s: string) => s.trim()).map((item: string, idx: number) => (
                               <li key={idx} style={{ marginBottom: '4px' }}>{item.trim()}</li>
                             ))}
                           </ul>
                         ) : (
                           <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                             <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text-primary)' }}>{classDefinition.startingEquipment.choiceB}</div>
                             <div style={{ fontSize: '11px', color: '#86868b', marginTop: '4px' }}>起始物资</div>
                           </div>
                         )}
                      </div>
                    </div>

                    {/* Choice C (Optional) */}
                    {classDefinition.startingEquipment.choiceC && (
                      <div 
                        className={`${classStyles.becomingCard} ${character.equipmentChoiceMode === 'choiceC' ? classStyles.becomingCardActive : ''}`}
                        onClick={() => handleEquipmentModeChange('choiceC')}
                        style={{ cursor: 'pointer', display: 'flex', flexDirection: 'column' }}
                      >
                        <div className={classStyles.becomingTitle}>
                          选项 C
                          <div style={{ 
                            width: '20px', 
                            height: '20px', 
                            borderRadius: '50%', 
                            border: character.equipmentChoiceMode === 'choiceC' ? '6px solid #0071e3' : '2px solid #d2d2d7', 
                            boxSizing: 'border-box',
                            transition: 'all 0.2s ease'
                          }} />
                        </div>
                        <div className={classStyles.becomingDesc} style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
                          <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--color-text-primary)' }}>{classDefinition.startingEquipment.choiceC}</div>
                          <div style={{ fontSize: '11px', color: '#86868b', marginTop: '4px' }}>起始金币</div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Nested choices for Packages */}
                  {(character.equipmentChoiceMode === 'choiceA' || character.equipmentChoiceMode === 'package') && classDefinition.startingEquipment.choiceARecords?.some((r: EquipmentRecord) => r.selectionId) && (
                    <div className={classStyles.fadeIn} style={{ 
                      marginTop: '16px', 
                      padding: '20px', 
                      background: 'var(--color-bg-dark)', 
                      borderRadius: '12px', 
                      border: '1px solid var(--color-border-dark)',
                    }}>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '12px' }}>
                        装备包内的额外选择：
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {classDefinition.startingEquipment.choiceARecords
                          .filter((r: EquipmentRecord) => r.selectionId)
                          .map((record: EquipmentRecord) => {
                            const selectionId = record.selectionId!;
                            const currentVal = character.classSelections?.[selectionId]?.[0] || '';
                            
                            // Determine options based on record label, itemId, selectionId
                            let rawOptions: string[] = [];
                            const recLabel = (record.label || '').toLowerCase();
                            const recItemId = (record.itemId || '').toLowerCase();
                            const selId = selectionId.toLowerCase();

                            const isInstrument = recLabel.includes('乐器') || recLabel.includes('instrument') || recItemId.includes('instrument') || selId.includes('instrument') || selId.includes('musical');
                            const isArtisanTool = recLabel.includes('工匠工具') || recItemId.includes('artisan') || selId.includes('artisan');
                            const isGamingSet = recLabel.includes('赌具') || recLabel.includes('游戏') || recItemId.includes('gaming') || selId.includes('gaming');

                            if (isInstrument && isArtisanTool) {
                              rawOptions = [...MUSICAL_INSTRUMENTS, ...ARTISAN_TOOLS];
                            } else if (isInstrument) {
                              rawOptions = MUSICAL_INSTRUMENTS;
                            } else if (isGamingSet) {
                              rawOptions = GAMING_SETS;
                            } else if (isArtisanTool || selId.includes('tool')) {
                              rawOptions = ARTISAN_TOOLS;
                            } else {
                              rawOptions = ALL_TOOLS;
                            }

                            // Deduplicate options based on translated display name
                            const seenDisplayNames = new Set<string>();
                            const options = rawOptions.filter(opt => {
                              const displayName = translateProficiency(opt);
                              if (!displayName || seenDisplayNames.has(displayName)) return false;
                              seenDisplayNames.add(displayName);
                              return true;
                            });

                            return (
                              <div key={selectionId}>
                                <div style={{ fontSize: '12px', color: '#86868b', marginBottom: '8px' }}>选择 {record.label}：</div>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                  {options.map(opt => (
                                    <PillButton
                                      key={opt}
                                      size="sm"
                                      variant={currentVal === opt ? 'primary' : 'outline'}
                                      onClick={() => handleEquipmentSelection(selectionId, opt)}
                                    >
                                      {translateProficiency(opt)}
                                    </PillButton>
                                  ))}
                                </div>
                              </div>
                            );
                          })
                        }
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* 旧版/自制职业可能提供 Becoming a Class 说明；5etools 核心职业通常没有该字段。 */}
              {classDefinition.becomingAClass && (
              <div className={classStyles.becomingGrid}>
                <div 
                  className={`${classStyles.becomingCard} ${!primaryClassEntry.isMulticlass ? classStyles.becomingCardActive : ''}`}
                  style={{ cursor: 'default' }}
                >
                  <div className={classStyles.becomingTitle}>
                    作为 1 级角色
                    {!primaryClassEntry.isMulticlass && <span style={{color:'var(--color-gold-accent)'}}>●</span>}
                  </div>
                  <div className={classStyles.becomingDesc} style={{whiteSpace:'pre-wrap'}}>
                    {classDefinition.becomingAClass.asLevel1}
                  </div>
                </div>

                <div 
                  className={`${classStyles.becomingCard} ${primaryClassEntry.isMulticlass ? classStyles.becomingCardActive : ''}`}
                  style={{ cursor: 'default' }}
                >
                  <div className={classStyles.becomingTitle}>
                    作为兼职角色
                    {primaryClassEntry.isMulticlass && <span style={{color:'var(--color-gold-accent)'}}>●</span>}
                  </div>
                  <div className={classStyles.becomingDesc} style={{whiteSpace:'pre-wrap'}}>
                    {classDefinition.becomingAClass.asMulticlass}
                </div>
                </div>
              </div>
              )}

              {/* Progression Table (Collapsible) */}
              <CollapsibleSection title="职业特性表 Progression Table">
                <div className={classStyles.progressionTableWrapper}>
                  <table className={classStyles.progressionTable}>
                    <thead>
                      <tr>
                        <th>等级</th>
                        <th>熟练</th>
                        <th>特性</th>
                        {classDefinition.progression?.[0]?.values?.map((v: any) => (
                          <th key={v.label}>{translateLabel(v.label)}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {classDefinition.progression?.map((row: ClassLevelProgression) => (
                        <tr key={row.level} style={{ opacity: primaryClassEntry.level >= row.level ? 1 : 0.4 }}>
                          <td style={{fontWeight:700}}>{row.level}</td>
                          <td>+{Math.floor((row.level - 1) / 4) + 2}</td>
                          <td style={{textAlign:'left', paddingLeft:16}}>
                            {classDefinition.features
                              .filter((f: ClassFeature) => f.level === row.level)
                              .map((f: ClassFeature) => f.name)
                              .join(', ') || '-'}
                          </td>
                          {row.values?.map((v: any) => (
                            <td key={v.label}>{v.value}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CollapsibleSection>
            </div>
          ) : (
            <div className={styles.emptyState}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: '1.2rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '8px' }}>尚未选择职业</p>
                <p style={{ color: '#86868b' }}>请在左侧选择你的主要职业。</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

