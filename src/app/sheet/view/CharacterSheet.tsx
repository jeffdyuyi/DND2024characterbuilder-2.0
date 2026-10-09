'use client';
import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCharacterStore } from '@/store/characterStore';
import { useCatalog } from '@/platform/CatalogProvider';
import { CharacterState } from '@/types/characterState';
import { CatalogStats } from '@/platform/catalogLoader';
import GlassNav from '@/components/GlassNav';
import PillButton from '@/components/PillButton';
import { computeAbilityScores } from '@/engine/ability';
import { computeCombatStats } from '@/engine/combat';
import { exportToFVTT } from '@/engine/fvttExport';
import { exportToJSON, importFromJSON, exportToMarkdown } from '@/engine/importExport';
import { computeProficiencies } from '@/engine/proficiency';
import { computeSpellcasting, getInnateSpells } from '@/engine/spellcasting';
import { buildCharacterSheetView } from '@/engine/viewAdapter';
import {
  getBackgroundDefinition,
  getClassDefinition,
  getFeatDefinition,
  getSpeciesDefinition,
  getSpellDefinition,
  getSubclassDefinition,
} from '@/engine/characterData';
import { formatSpellRange, formatSpellDuration, formatSpellComponent, translateSpellSchool, formatActionType } from '@/engine/terminology';
import MarkdownText from '@/components/MarkdownText';
import styles from '../sheet.module.css';

import SpellsTab from '../[id]/tabs/SpellsTab';
import InventoryTab from '../[id]/tabs/InventoryTab';
import FeaturesTab from '../[id]/tabs/FeaturesTab';
import ProfileTab from '../[id]/tabs/ProfileTab';
import AdventureTab from '../[id]/tabs/AdventureTab';
import OverviewTab from '../[id]/tabs/OverviewTab';

const TABS = [
  '主面板',
  '法术',
  '种族',
  '职业',
  '背景',
  '专长',
  '选项',
  '物品',
  '档案',
  '冒险',
];

const DeathSaveTracker = ({ successes, failures, onUpdate }: any) => (
  <div className={styles.trackerItem}>
    <div className={styles.trackerLabel}>死亡豁免</div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'center' }}>
      <div className={styles.bubbleRow}>
        {[1, 2, 3].map(i => (
          <div key={`s-${i}`} className={`${styles.bubble} ${i <= successes ? styles.bubbleSuccess : ''}`} onClick={() => onUpdate('success', i === successes ? i - 1 : i)} />
        ))}
        <span style={{ fontSize: 10, marginLeft: 4, color: 'var(--color-success)' }}>成功</span>
      </div>
      <div className={styles.bubbleRow}>
        {[1, 2, 3].map(i => (
          <div key={`f-${i}`} className={`${styles.bubble} ${i <= failures ? styles.bubbleDanger : ''}`} onClick={() => onUpdate('failure', i === failures ? i - 1 : i)} />
        ))}
        <span style={{ fontSize: 10, marginLeft: 4, color: 'var(--color-danger)' }}>失败</span>
      </div>
    </div>
  </div>
);

// 组件内部已移至 SpellsTab.tsx 处理

export default function CharacterSheetPage() {
  const searchParams = useSearchParams();
  const { characters } = useCharacterStore();
  const { stats } = useCatalog();
  const character = characters[searchParams.get('id') || ''];
  if (!character) return <div style={{ padding: 40, textAlign: 'center' }}>角色加载中...</div>;
  return <LoadedCharacterSheet key={character.id} character={character} catalogStats={stats} />;
}

function LoadedCharacterSheet({ character, catalogStats }: { character: CharacterState; catalogStats: CatalogStats }) {
  const router = useRouter();
  const id = character.id;
  const { updateActiveCharacter } = useCharacterStore();

  const [activeTab, setActiveTab] = useState(0);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    if (!character && id) {
      // router.push('/');
    }
  }, [character, id, router]);

  const sheetView = useMemo(() => buildCharacterSheetView(character!), [character, catalogStats]);
  const { computed, final, flags } = sheetView;
  const { ability, combat, proficiencies, spellcasting, totalLevel, proficiencyBonus } = computed;

  // 增强的施法数据解析，修复 DC/攻击加值显示
  const safeAbilityKey = spellcasting.abilityKey;
  const spellDC = final.spellSaveDc || (8 + proficiencyBonus + (safeAbilityKey ? (final.modifiers as any)[safeAbilityKey] || 0 : 0));
  const spellAttack = final.spellAttackBonus || (proficiencyBonus + (safeAbilityKey ? (final.modifiers as any)[safeAbilityKey] || 0 : 0));

  const species = getSpeciesDefinition(character!);
  const background = getBackgroundDefinition(character!);
  const primaryClass = character?.classes[0] ? getClassDefinition(character.classes[0].classId) : undefined;
  const subclass = getSubclassDefinition(character!);

  const innate = getInnateSpells(character);
  const innateDefinitions = innate.map(s => getSpellDefinition(s.spellId)).filter(Boolean);
  const cantripDetails = [...new Set([...(character.cantripIds || []), ...innateDefinitions.filter(s => s!.level === 0).map(s => s!.id)])].map(getSpellDefinition).filter(Boolean);
  const spellDetails = [...new Set([...(character.preparedSpellIds || []), ...innateDefinitions.filter(s => s!.level > 0).map(s => s!.id)])].map(getSpellDefinition).filter(Boolean);
  const spellbookDetails = (character?.spellbookIds || []).map(getSpellDefinition).filter(Boolean);

  const spellSourceMap = useMemo(() => {
    const map: Record<string, string> = {};
    if (character) {
      const innateSpells = getInnateSpells(character);
      innateSpells.forEach(s => {
        map[s.spellId] = s.source;
      });
      (character.cantripIds || []).forEach(id => {
        if (!map[id]) map[id] = primaryClass?.name || '职业';
      });
      (character.preparedSpellIds || []).forEach(id => {
        if (!map[id]) map[id] = primaryClass?.name || '职业';
      });
    }
    return map;
  }, [character, primaryClass, catalogStats]);

  if (!character) return <div style={{ padding: 40, textAlign: 'center' }}>角色加载中...</div>;

  const handleDownloadFVTT = () => {
    const json = exportToFVTT(character!);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fvtt-Actor-${character!.name || 'Unnamed'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadJSON = () => {
    const json = exportToJSON(character!);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `character-${character!.name || 'Unnamed'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadMD = () => {
    const md = exportToMarkdown(character!, {
      species, background, primaryClass, subclass,
      ability, combat, proficiencies, spellcasting,
      featDetails: (character!.selectedFeats || []).map((f: any) => getFeatDefinition(f.featId)).filter(Boolean),
      spellDetails: spellDetails as any[],
      cantripDetails: cantripDetails as any[]
    });
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `character-${character!.name || 'Unnamed'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJSON = async (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const jsonStr = event.target?.result as string;
        const importedChar = await importFromJSON(jsonStr);
        updateActiveCharacter(importedChar);
        alert('导入成功！');
      } catch (err) {
        alert(err instanceof Error ? err.message : '导入失败');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className={styles.sheetContainer} data-class={primaryClass?.nameEn.toLowerCase() || 'wizard'}>
      <GlassNav
        backLabel="角色库"
        backHref="/"
        title="角色卡"
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {/* 全局编辑开关 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', borderRight: '1px solid #eee' }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: isEditMode ? 'var(--color-warning, #f59e0b)' : 'var(--color-text-tertiary)', whiteSpace: 'nowrap', transition: 'color 0.2s' }}>
                {isEditMode ? '⚠ 编辑中' : '查看模式'}
              </span>
              <div
                onClick={() => setIsEditMode(!isEditMode)}
                style={{ width: 40, height: 20, borderRadius: 10, background: isEditMode ? 'var(--color-warning, #f59e0b)' : '#d2d2d7', position: 'relative', cursor: 'pointer', transition: 'background 0.3s', flexShrink: 0 }}
              >
                <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 2, left: isEditMode ? 22 : 2, transition: 'left 0.3s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)' }} />
              </div>
            </div>
            <PillButton size="sm" variant="outline" onClick={() => router.push(`/builder/species?id=${id}`)}>引导编辑</PillButton>
            <div className={styles.exportDropdown}>
              <details style={{ position: 'relative' }}>
                <summary style={{ listStyle: 'none', cursor: 'pointer' }}>
                  <PillButton size="sm" variant="outline">导出 / 导入 ▾</PillButton>
                </summary>
                <div style={{
                  position: 'absolute',
                  right: 0,
                  top: 'calc(100% + 6px)',
                  background: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-dark)',
                  borderRadius: '10px',
                  boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  minWidth: '150px',
                  zIndex: 120,
                  whiteSpace: 'nowrap'
                }}>
                  <button onClick={handleDownloadJSON} className={styles.dropdownItem}>导出 JSON 存档</button>
                  <button onClick={() => document.getElementById('json-import-input')?.click()} className={styles.dropdownItem}>导入 JSON 存档</button>
                  <button onClick={handleDownloadMD} className={styles.dropdownItem}>导出 Markdown (MD)</button>
                  <button onClick={handleDownloadFVTT} className={styles.dropdownItem}>导出 Foundry VTT</button>
                </div>
              </details>
            </div>
            <input id="json-import-input" type="file" accept=".json" style={{ display: 'none' }} onChange={handleImportJSON} />
          </div>
        }
      />

      {/* 顶板已移除，内容已整合至“主面板”标签页 */}

      <nav className={styles.tabBar}>
        <div className={styles.tabScroll}>
          {TABS.map((tab, index) => (
            <button
              key={tab}
              className={`${styles.tabButton} ${activeTab === index ? styles.tabButtonActive : ''}`}
              onClick={() => setActiveTab(index)}
            >
              {tab}
            </button>
          ))}
        </div>
      </nav>

      <main className={styles.mainContent} key={activeTab}>
        {activeTab === 0 && (
          <OverviewTab 
            character={character}
            species={species}
            background={background}
            primaryClass={primaryClass}
            subclass={subclass}
            totalLevel={totalLevel}
            pb={proficiencyBonus}
            sheetView={sheetView}
            updateActiveCharacter={updateActiveCharacter}
            router={router}
            id={id}
            setActiveTab={setActiveTab}
            isEditMode={isEditMode}
          />
        )}

        {activeTab === 1 && (
          <SpellsTab 
            character={character}
            spellcasting={{
              ...spellcasting,
              spellDC: spellDC,
              spellAttack: spellAttack
            }}
            primaryClass={primaryClass}
            cantripDetails={cantripDetails}
            spellDetails={spellDetails}
            spellbookDetails={spellbookDetails}
            spellSourceMap={spellSourceMap}
            spellSlotUsage={character.spellSlotUsage || {}}
            updateActiveCharacter={updateActiveCharacter}
            router={router}
            id={id}
          />
        )}

        {[2, 3, 4, 5, 6].map((idx, i) => (
          activeTab === idx && (
            <FeaturesTab 
              key={idx}
              character={character}
              router={router}
              id={id}
              activeCategory={(['种族', '职业', '背景', '专长', '附加选项'] as const)[i]}
              onUpdateResource={(name: string, val: any) => {
                const current = character.resourceUsage || {};
                updateActiveCharacter({ resourceUsage: { ...current, [name]: val } });
              }}
            />
          )
        ))}

        {activeTab === 7 && (
          <InventoryTab 
            character={character}
            updateActiveCharacter={updateActiveCharacter}
            isEditMode={isEditMode}
          />
        )}

        {activeTab === 8 && (
          <ProfileTab character={character} updateActiveCharacter={updateActiveCharacter} router={router} id={id} />
        )}

        {activeTab === 9 && (
          <AdventureTab character={character} updateActiveCharacter={updateActiveCharacter} />
        )}
      </main>
    </div>
  );
}
