'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { getCatalogSpells } from '@/catalog';
import { Spell } from '@/types/spell';
import { CharacterState, ClassSpellSelection } from '@/types/characterState';
import { useCharacterStore } from '@/store/characterStore';
import { getSpellDefinition, getClassDefinition } from '@/engine/characterData';
import {
  getInnateSpells,
  computeSpellProgression,
  deriveCharacterSpellSelection,
  isSpellAvailableToClass,
} from '@/engine/spellcasting';
import { useCatalog } from '@/platform/CatalogProvider';
import {
  formatActionType,
  translateSpellSchool,
  formatSpellRange,
  formatSpellDuration,
  formatSpellComponent,
  translateSource,
  translateClass,
} from '@/engine/terminology';
import { getSourceSortWeight } from '@/config/sourceMapping';
import MarkdownText from '@/components/MarkdownText';
import PillButton from '@/components/PillButton';
import { Check, Lock, ChevronLeft, ChevronRight, Info, Sparkles, RotateCcw } from 'lucide-react';

interface SpellPoolSectionProps {
  slotId: string;
  title: string;
  spells: Spell[];
  current: number;
  limit: number;
  sel: ClassSpellSelection;
  isWizardBase: boolean;
  book: string[];
  allSelections: { cantrips: string[]; spells: string[] };
  innateSpellIds: string[];
  currentStep: any;
  toggleSelection: (spell: Spell) => void;
  toggleExtraSelection: (choiceId: string, spellId: string, limit: number) => void;
}

const SpellPoolSection: React.FC<SpellPoolSectionProps> = ({
  slotId,
  title,
  spells,
  current,
  limit,
  sel,
  isWizardBase,
  book,
  allSelections,
  innateSpellIds,
  currentStep,
  toggleSelection,
  toggleExtraSelection,
}) => {
  const isBase = slotId.startsWith('base');
  const sorted = [...spells].sort((a, b) => a.level - b.level || a.name.localeCompare(b.name));

  // 每个分组独立管理其预览状态
  const [previewId, setPreviewId] = useState<string | null>(null);

  // 默认预览：第一个已选法术，或当前正在查看的法术
  const currentSelections = isBase
    ? sorted[0]?.level === 0
      ? sel.cantrips
      : sel.spells
    : sel.extra?.[slotId] || [];
  const activePreview = getSpellDefinition(
    previewId || (currentSelections.length > 0 ? currentSelections[0] : null) || '',
  );
  const isDone = limit > 0 && current >= limit;

  // 获取已选法术的名称列表，用于标题下方的摘要展示
  const selectedSpellNames = useMemo(() => {
    return currentSelections.map((id) => getSpellDefinition(id)?.name || id);
  }, [currentSelections]);

  return (
    <div style={{ marginBottom: 32 }}>
      {/* 分组标题与摘要 */}
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          marginBottom: 16,
          gap: 20,
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <h3
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: 'var(--color-text-primary)',
                margin: 0,
              }}
            >
              {title}
            </h3>
            {limit > 0 && (
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '2px 10px',
                  borderRadius: 12,
                  background: isDone ? 'rgba(52, 199, 89, 0.1)' : 'var(--color-bg-dark)',
                  color: isDone ? '#34c759' : '#86868b',
                  border: `1px solid ${isDone ? '#34c759' : '#d2d2d7'}`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  transition: 'all 0.2s',
                }}
              >
                {isDone && <Check size={11} strokeWidth={3} />}
                {isDone ? '已完成' : `已选 ${current} / ${limit}`}
              </span>
            )}
          </div>
          {/* 已选法术名称列表 (用户要求：已经选择过的法术名称会出现在对应等级下方) */}
          {selectedSpellNames.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {selectedSpellNames.map((name, i) => (
                <span
                  key={i}
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-gold-accent)',
                    background: 'var(--color-bg-subtle)',
                    padding: '1px 6px',
                    borderRadius: 4,
                    fontWeight: 500,
                  }}
                >
                  {name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* 法术选择池 */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {sorted.map((spell) => {
            let isSelected = false;
            let slotLimit = 0;
            if (isBase) {
              isSelected = (spell.level === 0 ? sel.cantrips : sel.spells).includes(spell.id);
              slotLimit = spell.level === 0 ? currentStep.newCantrips : currentStep.newSpells;
            } else {
              isSelected = (sel.extra?.[slotId] || []).includes(spell.id);
              slotLimit =
                currentStep.extraChoices.find((ec: any) => ec.id === slotId)?.numToChoose || 0;
            }
            const isSelectedElsewhere =
              (allSelections.cantrips.includes(spell.id) ||
                allSelections.spells.includes(spell.id)) &&
              !isSelected;
            const isInnate = innateSpellIds.includes(spell.id);
            const needsSpellbook = isWizardBase && spell.level > 0 && !book.includes(spell.id);
            const isDisabled = (isSelectedElsewhere || isInnate || needsSpellbook) && !isSelected;
            const isPreviewing = activePreview?.id === spell.id;

            return (
              <PillButton
                key={spell.id}
                size="sm"
                variant={isSelected ? 'primary' : 'outline'}
                disabled={isDisabled}
                onClick={() => {
                  setPreviewId(spell.id); // 点击预览
                  if (!isDisabled) {
                    if (isBase) toggleSelection(spell);
                    else toggleExtraSelection(slotId, spell.id, slotLimit);
                  }
                }}
                style={{
                  opacity: isDisabled ? 0.35 : 1,
                  boxShadow: isPreviewing ? '0 0 0 2px var(--color-border-gold)' : 'none',
                  borderWidth: isPreviewing ? '2px' : '1px',
                }}
              >
                {spell.level > 0 && (
                  <span style={{ opacity: 0.6, marginRight: 4 }}>{spell.level}环</span>
                )}
                {spell.name}
                {isSelected && <span style={{ fontSize: '10px', marginLeft: 4 }}>✓</span>}
                {isSelectedElsewhere && (
                  <span style={{ fontSize: '10px', marginLeft: 4, opacity: 0.7 }}>(已选)</span>
                )}
              </PillButton>
            );
          })}
        </div>

        {/* 详情预览面板 - 增加滚动条支持 */}
        {activePreview && (
          <div
            style={{
              marginTop: 4,
              padding: '16px 20px',
              maxHeight: '350px',
              overflowY: 'auto',
              background: 'var(--color-bg-dark)',
              border: '1px solid #e5e5e7',
              borderRadius: '12px',
              boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
              animation: 'none',
              scrollbarWidth: 'thin',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 12,
                borderBottom: '1px solid var(--color-border-dark)',
                paddingBottom: 8,
                position: 'sticky',
                top: 0,
                background: 'var(--color-bg-dark)',
                zIndex: 1,
              }}
            >
              <div>
                <span
                  style={{
                    fontSize: '16px',
                    fontWeight: 700,
                    color: 'var(--color-text-primary)',
                    fontFamily: 'var(--font-family-serif)',
                  }}
                >
                  {activePreview.name}
                </span>
                <span
                  style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginLeft: 8 }}
                >
                  {activePreview.nameEn}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span
                  style={{
                    fontSize: '11px',
                    background: 'var(--color-bg-dark)',
                    border: '1px solid var(--color-border-dark)',
                    color: 'var(--color-gold-bright)',
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  {activePreview.level === 0 ? '戏法' : `${activePreview.level}环`}
                </span>
                <span
                  style={{
                    fontSize: '11px',
                    background: 'var(--color-bg-dark)',
                    border: '1px solid var(--color-border-dark)',
                    color: 'var(--color-gold-bright)',
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  {translateSpellSchool(activePreview.school)}
                </span>
              </div>
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '16px',
                marginBottom: 12,
                fontSize: '12px',
                color: 'var(--color-text-secondary)',
              }}
            >
              <span>
                <b>施法：</b>
                {formatActionType(activePreview.castingTime)}
              </span>
              <span>
                <b>射程：</b>
                {formatSpellRange(activePreview.range)}
              </span>
              <span>
                <b>持续：</b>
                {formatSpellDuration(activePreview.duration)}
              </span>
              {activePreview.components && (
                <span>
                  <b>成分：</b>
                  {formatSpellComponent(activePreview.components)}
                </span>
              )}
            </div>
            <MarkdownText
              text={activePreview.description}
              variant="clean"
              style={{ fontSize: '13px', lineHeight: 1.6, color: 'var(--color-text-secondary)' }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

interface SpellListProps {
  casterLevel: number;
  spellSlots: Record<number, number>;
  cantripsKnown: number;
  spellsPrepared: number;
  spellcastingAbility?: string;
  character: CharacterState;
}

export default function SpellList({ character }: SpellListProps) {
  const { status: catalogStatus } = useCatalog();
  const { updateActiveCharacter } = useCharacterStore();
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const [activeClassId, setActiveClassId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeClassId && character.classes?.length > 0) {
      setActiveClassId(character.classes[0].classId);
    }
  }, [character.classes, activeClassId]);

  const spellsByLevel = character.spellsByLevel || {};
  const currentClassEntry = character.classes?.find((c) => c.classId === activeClassId);
  const currentClassDef = activeClassId ? getClassDefinition(activeClassId) : null;
  const currentClassSelections = activeClassId ? spellsByLevel[activeClassId] || {} : {};
  // const isWizard = currentClassDef?.nameEn === 'Wizard'; // Duplicate removed

  const [isReplaceCantripOpenMap, setIsReplaceCantripOpenMap] = useState<Record<number, boolean>>(
    {},
  );
  const [isReplaceSpellOpenMap, setIsReplaceSpellOpenMap] = useState<Record<number, boolean>>({});

  const progressionSteps = useMemo(() => {
    if (!activeClassId) return [];
    return computeSpellProgression(character, activeClassId);
  }, [character, activeClassId]);

  const currentStep = progressionSteps[activeStepIndex];

  // 收集在所有等级被替换的旧法术/戏法ID集合
  const replacedSpellIds = useMemo(() => {
    const set = new Set<string>();
    Object.values(currentClassSelections).forEach((sel) => {
      if (sel.replacedCantrip) set.add(sel.replacedCantrip);
      if (sel.replacedSpell) set.add(sel.replacedSpell);
      if (sel.replaced) set.add(sel.replaced);
    });
    return set;
  }, [currentClassSelections]);

  const allSelectionsFromProgression = useMemo(() => {
    const cantrips: string[] = [];
    const spells: string[] = [];
    Object.entries(currentClassSelections).forEach(([lvlStr, sel]) => {
      sel.cantrips.forEach((id) => {
        if (!replacedSpellIds.has(id)) cantrips.push(id);
      });
      sel.spells.forEach((id) => {
        if (!replacedSpellIds.has(id)) spells.push(id);
      });
      if (sel.extra)
        Object.entries(sel.extra).forEach(([slotId, ids]) => {
          if (slotId.startsWith('wizard_spellbook')) return;

          ids.forEach((id) => {
            if (!replacedSpellIds.has(id)) {
              const def = getSpellDefinition(id);
              if (def?.level === 0) cantrips.push(id);
              else spells.push(id);
            }
          });
        });
    });
    return { cantrips, spells };
  }, [currentClassSelections, replacedSpellIds]);

  // 收集在当前等级之前已选的旧戏法（排除了在其他等级已被替换的戏法）
  const previousPreparedCantrips = useMemo(() => {
    if (!currentStep || currentStep.level <= 1) return [];

    const candidateIds: string[] = [];
    const replacedInOtherSteps = new Set<string>();

    Object.entries(currentClassSelections).forEach(([lvlStr, sel]) => {
      const stepLvl = Number(lvlStr);
      if (stepLvl < currentStep.level) {
        candidateIds.push(...sel.cantrips);
        if (sel.extra) {
          Object.entries(sel.extra).forEach(([slotId, ids]) => {
            if (!slotId.startsWith('wizard_spellbook')) {
              ids.forEach((id) => {
                if (getSpellDefinition(id)?.level === 0) candidateIds.push(id);
              });
            }
          });
        }
      }
      if (stepLvl !== currentStep.level && sel.replacedCantrip) {
        replacedInOtherSteps.add(sel.replacedCantrip);
      }
    });

    const availableIds = candidateIds.filter((id) => !replacedInOtherSteps.has(id));
    return Array.from(new Set(availableIds))
      .map((id) => getSpellDefinition(id))
      .filter(Boolean) as Spell[];
  }, [currentClassSelections, currentStep]);

  // 收集在当前等级之前已选的旧法术(1阶+)（排除了在其他等级已被替换的法术）
  const previousPreparedSpells = useMemo(() => {
    if (!currentStep || currentStep.level <= 1) return [];

    const candidateIds: string[] = [];
    const replacedInOtherSteps = new Set<string>();

    Object.entries(currentClassSelections).forEach(([lvlStr, sel]) => {
      const stepLvl = Number(lvlStr);
      if (stepLvl < currentStep.level) {
        candidateIds.push(...sel.spells);
        if (sel.extra) {
          Object.entries(sel.extra).forEach(([slotId, ids]) => {
            if (!slotId.startsWith('wizard_spellbook')) {
              ids.forEach((id) => {
                if (getSpellDefinition(id)?.level !== 0) candidateIds.push(id);
              });
            }
          });
        }
      }
      if (stepLvl !== currentStep.level && (sel.replacedSpell || sel.replaced)) {
        const rId = sel.replacedSpell || sel.replaced;
        if (rId) replacedInOtherSteps.add(rId);
      }
    });

    const availableIds = candidateIds.filter((id) => !replacedInOtherSteps.has(id));
    return Array.from(new Set(availableIds))
      .map((id) => getSpellDefinition(id))
      .filter(Boolean) as Spell[];
  }, [currentClassSelections, currentStep]);

  const sel = currentStep
    ? currentClassSelections[currentStep.level] || { cantrips: [], spells: [], extra: {} }
    : { cantrips: [], spells: [], extra: {} };

  const isReplaceCantripOpen = currentStep ? !!isReplaceCantripOpenMap[currentStep.level] : false;
  const isReplaceSpellOpen = currentStep ? !!isReplaceSpellOpenMap[currentStep.level] : false;

  const activeReplacedCantrip = sel.replacedCantrip;
  const activeReplacedSpell = sel.replacedSpell || sel.replaced;

  const cantripLimit = currentStep ? currentStep.newCantrips + (activeReplacedCantrip ? 1 : 0) : 0;
  const spellLimit = currentStep ? currentStep.newSpells + (activeReplacedSpell ? 1 : 0) : 0;

  const toggleCantripReplacementMode = (open: boolean) => {
    if (!currentStep) return;
    setIsReplaceCantripOpenMap((prev) => ({ ...prev, [currentStep.level]: open }));
    if (!open && sel.replacedCantrip) {
      handleClearReplacedCantrip();
    }
  };

  const toggleSpellReplacementMode = (open: boolean) => {
    if (!currentStep) return;
    setIsReplaceSpellOpenMap((prev) => ({ ...prev, [currentStep.level]: open }));
    if (!open && (sel.replacedSpell || sel.replaced)) {
      handleClearReplacedSpell();
    }
  };

  const handleSelectReplacedCantrip = (spell: Spell) => {
    if (!currentStep || !currentClassEntry) return;
    const level = currentStep.level;
    const stepSelection = currentClassSelections[level] || { cantrips: [], spells: [], extra: {} };

    const isSame = stepSelection.replacedCantrip === spell.id;
    const nextReplaced = isSame ? undefined : spell.id;

    const nextStepSel: ClassSpellSelection = {
      ...stepSelection,
      replacedCantrip: nextReplaced,
    };

    if (!nextReplaced) {
      if (nextStepSel.cantrips.length > currentStep.newCantrips) {
        nextStepSel.cantrips = nextStepSel.cantrips.slice(0, currentStep.newCantrips);
      }
    }

    updateSpellState({
      ...currentClassSelections,
      [level]: nextStepSel,
    });
  };

  const handleClearReplacedCantrip = () => {
    if (!currentStep || !currentClassEntry) return;
    const level = currentStep.level;
    const stepSelection = currentClassSelections[level] || { cantrips: [], spells: [], extra: {} };

    const nextStepSel: ClassSpellSelection = {
      ...stepSelection,
      replacedCantrip: undefined,
      cantrips: stepSelection.cantrips.slice(0, currentStep.newCantrips),
    };

    updateSpellState({
      ...currentClassSelections,
      [level]: nextStepSel,
    });
  };

  const handleSelectReplacedSpell = (spell: Spell) => {
    if (!currentStep || !currentClassEntry) return;
    const level = currentStep.level;
    const stepSelection = currentClassSelections[level] || { cantrips: [], spells: [], extra: {} };

    const isSame = stepSelection.replacedSpell === spell.id || stepSelection.replaced === spell.id;
    const nextReplaced = isSame ? undefined : spell.id;

    const nextStepSel: ClassSpellSelection = {
      ...stepSelection,
      replacedSpell: nextReplaced,
      replaced: nextReplaced,
    };

    if (!nextReplaced) {
      if (nextStepSel.spells.length > currentStep.newSpells) {
        nextStepSel.spells = nextStepSel.spells.slice(0, currentStep.newSpells);
      }
    }

    updateSpellState({
      ...currentClassSelections,
      [level]: nextStepSel,
    });
  };

  const handleClearReplacedSpell = () => {
    if (!currentStep || !currentClassEntry) return;
    const level = currentStep.level;
    const stepSelection = currentClassSelections[level] || { cantrips: [], spells: [], extra: {} };

    const nextStepSel: ClassSpellSelection = {
      ...stepSelection,
      replacedSpell: undefined,
      replaced: undefined,
      spells: stepSelection.spells.slice(0, currentStep.newSpells),
    };

    updateSpellState({
      ...currentClassSelections,
      [level]: nextStepSel,
    });
  };

  const [sourceFilter, setSourceFilter] = useState<string | null>('2024 玩家手册');

  const allSpells = useMemo(() => {
    return getCatalogSpells({ allowHomebrew: Boolean(character?.allowHomebrew) });
  }, [catalogStatus, character?.allowHomebrew]);

  const availableSpellsForStep = useMemo(() => {
    if (!currentStep) return [];
    const spells = allSpells.filter((s) => {
      // 基础匹配：环阶与职业
      const levelMatch = s.level <= currentStep.maxSpellLevel;
      const ownNames = new Set(
        [currentClassDef?.name, currentClassDef?.nameEn].filter(Boolean).map((name) =>
          String(name)
            .toLowerCase()
            .replace(/[-_\s]+/g, ''),
        ),
      );
      const additionalClasses = new Set(
        currentStep.allowedClasses
          .map((name: string) => name.toLowerCase().replace(/[-_\s]+/g, ''))
          .filter((name: string) => !ownNames.has(name)),
      );
      const additionalMatch = s.classes.some((name) =>
        additionalClasses.has(name.toLowerCase().replace(/[-_\s]+/g, '')),
      );
      const classMatch = currentClassDef
        ? isSpellAvailableToClass(s, currentClassDef) || additionalMatch
        : false;

      if (!levelMatch || !classMatch) return false;

      // 扩展匹配：如果 Step 定义了额外 filter (用于处理 2014 版子职学派限制等)
      if (currentStep.filter) {
        const parts = currentStep.filter.split(';').map((p) => p.trim());
        const targetSchool = parts
          .find((p) => p.startsWith('school:'))
          ?.split(':')[1]
          ?.trim()
          ?.toLowerCase();

        if (targetSchool) {
          const schools = targetSchool.split(',').map((v) => v.trim().toLowerCase());
          const match = schools.some((ts) => {
            const sSchool = (s.school || '').toLowerCase();
            if (sSchool === ts) return true;
            const sZh = translateSpellSchool(s.school).replace('系', '');
            const tZh = translateSpellSchool(ts).replace('系', '');
            return sZh === tZh && sZh !== s.school;
          });
          if (!match) return false;
        }
      }

      return true;
    });
    const uniqueMap = new Map<string, Spell>();
    spells.forEach((s) => {
      if (!uniqueMap.has(s.id)) uniqueMap.set(s.id, s);
    });
    return Array.from(uniqueMap.values());
  }, [currentStep, currentClassDef, allSpells]);

  const availableSources = useMemo(() => {
    const s = new Set<string>();
    availableSpellsForStep.forEach((spell) => {
      s.add(translateSource(spell.source));
    });
    return Array.from(s).sort((a, b) => {
      const wA = getSourceSortWeight(a);
      const wB = getSourceSortWeight(b);
      if (wA !== wB) return wA - wB;
      return a.localeCompare(b, 'zh-Hans-CN');
    });
  }, [availableSpellsForStep]);

  const filteredSpells = useMemo(() => {
    const effective = sourceFilter && availableSources.includes(sourceFilter) ? sourceFilter : null;
    if (!effective) return availableSpellsForStep;
    return availableSpellsForStep.filter((s) => translateSource(s.source) === effective);
  }, [availableSpellsForStep, sourceFilter]);

  const innateSpells = useMemo(() => getInnateSpells(character), [character]);
  const innateSpellIds = useMemo(() => innateSpells.map((s) => s.spellId), [innateSpells]);

  const getSpellbookForWizard = useMemo(() => {
    if (currentClassDef?.nameEn !== 'Wizard') return [];
    const book: string[] = [];
    Object.values(currentClassSelections).forEach((sel) => {
      if (sel.extra)
        Object.entries(sel.extra).forEach(([id, ids]) => {
          if (id.startsWith('wizard_spellbook')) book.push(...ids);
        });
    });
    return book;
  }, [currentClassSelections, currentClassDef]);

  const isStepComplete = (index: number) => {
    const step = progressionSteps[index];
    if (!step) return false;
    const stepSel = currentClassSelections[step.level] || { cantrips: [], spells: [], extra: {} };

    const reqCantrips = step.newCantrips + (stepSel.replacedCantrip ? 1 : 0);
    const reqSpells = step.newSpells + (stepSel.replacedSpell || stepSel.replaced ? 1 : 0);

    const baseOk = stepSel.cantrips.length === reqCantrips && stepSel.spells.length === reqSpells;
    const extraOk = step.extraChoices.every(
      (ec) => (stepSel.extra?.[ec.id]?.length || 0) === ec.numToChoose,
    );
    return baseOk && extraOk;
  };

  const toggleSelection = (spell: Spell) => {
    if (!currentStep || !currentClassEntry) return;
    const level = currentStep.level;
    const stepSelection = currentClassSelections[level] || { cantrips: [], spells: [], extra: {} };
    const isCantrip = spell.level === 0;
    const list = isCantrip ? stepSelection.cantrips : stepSelection.spells;
    const limit = isCantrip ? cantripLimit : spellLimit;
    const exists = list.includes(spell.id);
    let newList = [...list];

    if (exists) {
      newList = newList.filter((id) => id !== spell.id);
    } else {
      if (newList.length >= limit && limit > 0) {
        newList.shift();
      }
      newList.push(spell.id);
    }
    updateSpellState({
      ...currentClassSelections,
      [level]: { ...stepSelection, [isCantrip ? 'cantrips' : 'spells']: newList },
    });
  };

  const toggleExtraSelection = (choiceId: string, spellId: string, limit: number) => {
    if (!currentStep || !currentClassEntry) return;
    const level = currentStep.level;
    const stepSelection = currentClassSelections[level] || { cantrips: [], spells: [], extra: {} };
    const extraMap = stepSelection.extra || {};
    const currentList = extraMap[choiceId] || [];
    const exists = currentList.includes(spellId);
    let nextList = [...currentList];

    if (exists) {
      nextList = nextList.filter((id) => id !== spellId);
    } else {
      if (nextList.length >= limit && limit > 0) {
        nextList.shift();
      }
      nextList.push(spellId);
    }
    updateSpellState({
      ...currentClassSelections,
      [level]: { ...stepSelection, extra: { ...extraMap, [choiceId]: nextList } },
    });
  };

  const updateSpellState = (nextSelections: Record<number, ClassSpellSelection>) => {
    if (!currentClassEntry) return;
    const nextSpellsByLevel = { ...spellsByLevel, [currentClassEntry.classId]: nextSelections };
    const globalCantrips: string[] = [];
    const globalSpells: string[] = [];

    Object.keys(nextSpellsByLevel).forEach((clsId) => {
      const classSels = nextSpellsByLevel[clsId];
      const progSteps = computeSpellProgression(character, clsId);

      const replacedIds = new Set<string>();
      Object.values(classSels).forEach((sel) => {
        if (sel.replacedCantrip) replacedIds.add(sel.replacedCantrip);
        if (sel.replacedSpell) replacedIds.add(sel.replacedSpell);
        if (sel.replaced) replacedIds.add(sel.replaced);
      });

      Object.entries(classSels).forEach(([lvlStr, sel]) => {
        sel.cantrips.forEach((id) => {
          if (!replacedIds.has(id)) globalCantrips.push(id);
        });
        sel.spells.forEach((id) => {
          if (!replacedIds.has(id)) globalSpells.push(id);
        });
        if (sel.extra) {
          const step = progSteps.find((s) => s.level === Number(lvlStr));
          if (step) {
            const validIds = step.extraChoices.map((ec) => ec.id);
            Object.entries(sel.extra).forEach(([slotId, ids]) => {
              if (validIds.includes(slotId))
                ids.forEach((id) => {
                  const def = getSpellDefinition(id);
                  if (def?.level === 0) {
                    if (!replacedIds.has(id)) globalCantrips.push(id);
                  } else {
                    if (!replacedIds.has(id)) globalSpells.push(id);
                  }
                });
            });
          }
        }
      });
    });
    const derived = deriveCharacterSpellSelection({
      ...character,
      spellsByLevel: nextSpellsByLevel,
    });
    updateActiveCharacter({ spellsByLevel: nextSpellsByLevel, ...derived });
  };

  if (!currentClassEntry || progressionSteps.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#86868b' }}>
        <Info size={40} style={{ marginBottom: 12 }} />
        <h3>尚未具备施法能力</h3>
        <p>请先选择具有施法能力的职业。</p>
      </div>
    );
  }

  const hasMultipleClasses = (character.classes?.length || 0) > 1;

  const baseCantrips = availableSpellsForStep.filter((s) => s.level === 0);
  const baseSpells = availableSpellsForStep.filter(
    (s) =>
      s.level > 0 && (currentClassDef?.nameEn !== 'Wizard' || getSpellbookForWizard.includes(s.id)),
  );
  const isWizard = currentClassDef?.nameEn === 'Wizard';

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {hasMultipleClasses && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {character.classes.map((c) => {
            const def = getClassDefinition(c.classId);
            const isActive = activeClassId === c.classId;
            return (
              <PillButton
                key={c.classId}
                variant={isActive ? 'primary' : 'outline'}
                size="sm"
                onClick={() => setActiveClassId(c.classId)}
              >
                {def?.name || c.classId}（等级 {c.level}）
              </PillButton>
            );
          })}
        </div>
      )}

      {/* 等级导航 */}
      <div
        style={{ display: 'flex', gap: 4, marginBottom: 20, overflowX: 'auto', padding: '2px 0' }}
      >
        {progressionSteps.map((step, i) => {
          const isActive = i === activeStepIndex;
          const done = isStepComplete(i);
          const locked = i > activeStepIndex + 1; // Allow jumping only to the next immediate level, or any previously unlocked level
          return (
            <button
              key={step.level}
              disabled={locked}
              onClick={() => !locked && setActiveStepIndex(i)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 12px',
                borderRadius: 20,
                border: `1px solid ${isActive ? 'var(--color-gold-accent)' : done ? '#34c759' : '#d2d2d7'}`,
                background: isActive
                  ? 'var(--color-gold-accent)'
                  : done
                    ? 'rgba(52, 199, 89, 0.05)'
                    : '#fff',
                color: isActive ? '#fff' : done ? '#34c759' : '#555',
                fontSize: '13px',
                fontWeight: isActive ? 700 : 500,
                cursor: locked ? 'not-allowed' : 'pointer',
                opacity: locked ? 0.4 : 1,
                transition: 'all 0.15s',
                flexShrink: 0,
              }}
            >
              {done ? <Check size={12} strokeWidth={3} /> : locked ? <Lock size={11} /> : null}
              {step.level}级
            </button>
          );
        })}
      </div>

      {currentStep && (
        <div>
          {/* 页面标题与第三方开关 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              marginBottom: 24,
              paddingBottom: 12,
              borderBottom: '1px solid #e5e5e7',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: '18px', fontWeight: 700 }}>
                {currentClassDef?.name} 等级 {currentStep.level}
              </span>
              {isStepComplete(activeStepIndex) ? (
                <span
                  style={{
                    fontSize: '11px',
                    background: 'rgba(52, 199, 89, 0.1)',
                    color: '#34c759',
                    padding: '2px 10px',
                    borderRadius: 12,
                    border: '1px solid #34c759',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Check size={11} strokeWidth={3} />
                  已完成配置
                </span>
              ) : (
                <span
                  style={{
                    fontSize: '11px',
                    background: 'rgba(255, 149, 0, 0.1)',
                    color: '#ff9500',
                    padding: '2px 10px',
                    borderRadius: 12,
                    border: '1px solid #ff9500',
                  }}
                >
                  待完善
                </span>
              )}
            </div>
            <PillButton
              size="sm"
              variant={character?.allowHomebrew ? 'primary' : 'outline'}
              onClick={async () => {
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

          {/* 特性提示 */}
          {currentStep.specialFeatures.map((f, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                gap: 8,
                padding: '10px 14px',
                background: 'var(--color-bg-dark)',
                borderRadius: 8,
                fontSize: '13px',
                marginBottom: 20,
                borderLeft: '3px solid #0071e3',
              }}
            >
              <Info size={15} color="var(--color-gold-accent)" style={{ flexShrink: 0 }} />
              <span>{f}</span>
            </div>
          ))}

          {/* 始终准备法术 */}
          {currentStep.alwaysPreparedSpells && currentStep.alwaysPreparedSpells.length > 0 && (
            <div
              style={{
                marginBottom: 32,
                padding: '12px 16px',
                background: 'rgba(0,113,227,0.03)',
                borderRadius: 12,
                border: '1px solid rgba(0,113,227,0.1)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: 'var(--color-gold-accent)',
                  fontWeight: 700,
                  fontSize: '13px',
                  marginBottom: 12,
                }}
              >
                <Sparkles size={14} /> 特性赠予法术（始终准备）
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {currentStep.alwaysPreparedSpells.map((id) => {
                  const def = getSpellDefinition(id);
                  return (
                    <span
                      key={id}
                      style={{
                        fontSize: '12px',
                        background: 'var(--color-bg-dark)',
                        border: '1px solid var(--color-border-dark)',
                        borderRadius: 6,
                        padding: '4px 10px',
                        color: 'var(--color-gold-bright)',
                      }}
                    >
                      {def?.name || id}
                      <span style={{ color: 'var(--color-text-secondary)', marginLeft: 4 }}>
                        {def?.level !== undefined && (def.level === 0 ? '戏法' : `${def.level}环`)}
                      </span>
                    </span>
                  );
                })}
              </div>
            </div>
          )}

          {/* 1. 替换已知戏法 (Replacing a Cantrip) 替换开关 */}
          {currentStep.level > 1 &&
            currentStep.canReplace &&
            previousPreparedCantrips.length > 0 && (
              <div
                style={{
                  marginBottom: 20,
                  padding: '16px 20px',
                  background:
                    sel.replacedCantrip !== undefined || isReplaceCantripOpen
                      ? 'rgba(0, 113, 227, 0.03)'
                      : 'var(--color-bg-dark)',
                  borderRadius: 14,
                  border: `1px solid ${sel.replacedCantrip !== undefined || isReplaceCantripOpen ? 'rgba(0, 113, 227, 0.3)' : 'var(--color-border-dark)'}`,
                  boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                  transition: 'all 0.2s ease',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom:
                      sel.replacedCantrip !== undefined || isReplaceCantripOpen ? 14 : 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      style={{
                        width: 34,
                        height: 34,
                        borderRadius: 10,
                        background:
                          sel.replacedCantrip !== undefined || isReplaceCantripOpen
                            ? 'var(--color-gold-accent)'
                            : 'var(--color-bg-dark)',
                        color:
                          sel.replacedCantrip !== undefined || isReplaceCantripOpen
                            ? '#fff'
                            : 'var(--color-gold-accent)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      <RotateCcw size={18} />
                    </div>
                    <div>
                      <div
                        style={{
                          fontSize: '14px',
                          fontWeight: 700,
                          color: 'var(--color-text-primary)',
                        }}
                      >
                        替换已知戏法（Replacing a Cantrip）
                      </div>
                      <div style={{ fontSize: '12px', color: '#86868b' }}>
                        升级时可将 1 道旧戏法替换为 1 道同职业新戏法（选填）。
                      </div>
                    </div>
                  </div>

                  {/* Toggle Switch */}
                  <label
                    onClick={() =>
                      toggleCantripReplacementMode(
                        !isReplaceCantripOpen && sel.replacedCantrip === undefined,
                      )
                    }
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      cursor: 'pointer',
                      gap: 8,
                      userSelect: 'none',
                    }}
                  >
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color:
                          sel.replacedCantrip !== undefined || isReplaceCantripOpen
                            ? 'var(--color-gold-accent)'
                            : '#86868b',
                      }}
                    >
                      {sel.replacedCantrip !== undefined || isReplaceCantripOpen
                        ? '已开启'
                        : '关闭'}
                    </span>
                    <div
                      style={{
                        width: 44,
                        height: 24,
                        borderRadius: 12,
                        background:
                          sel.replacedCantrip !== undefined || isReplaceCantripOpen
                            ? 'var(--color-gold-accent)'
                            : 'var(--color-border-dark)',
                        position: 'relative',
                        transition: 'background-color 0.2s',
                        padding: 2,
                      }}
                    >
                      <div
                        style={{
                          width: 20,
                          height: 20,
                          borderRadius: 10,
                          background: 'var(--color-bg-dark)',
                          position: 'absolute',
                          top: 2,
                          left: sel.replacedCantrip !== undefined || isReplaceCantripOpen ? 22 : 2,
                          transition: 'left 0.2s',
                          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        }}
                      />
                    </div>
                  </label>
                </div>

                {/* 展开的戏法替换控制区 */}
                {(sel.replacedCantrip !== undefined || isReplaceCantripOpen) && (
                  <div style={{ paddingTop: 12, borderTop: '1px solid #e5e5e7', marginTop: 12 }}>
                    <p
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: 'var(--color-text-primary)',
                        marginBottom: 8,
                      }}
                    >
                      选择 1 道要替换掉的旧戏法：
                    </p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                      {previousPreparedCantrips.map((spell) => {
                        const isReplacedThis = sel.replacedCantrip === spell.id;
                        return (
                          <PillButton
                            key={spell.id}
                            size="sm"
                            variant={isReplacedThis ? 'primary' : 'outline'}
                            onClick={() => handleSelectReplacedCantrip(spell)}
                            style={{
                              borderColor: isReplacedThis ? '#ff9500' : undefined,
                              background: isReplacedThis ? '#ff9500' : undefined,
                              color: isReplacedThis ? '#fff' : undefined,
                            }}
                          >
                            {spell.name}
                            {isReplacedThis && (
                              <span style={{ marginLeft: 4, fontSize: '10px' }}> (替换)</span>
                            )}
                          </PillButton>
                        );
                      })}
                    </div>

                    {sel.replacedCantrip ? (
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#34c759',
                          background: 'rgba(52, 199, 89, 0.08)',
                          padding: '8px 12px',
                          borderRadius: 8,
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <Check size={14} strokeWidth={3} /> 已选中要替换掉的旧戏法：
                        <b>{getSpellDefinition(sel.replacedCantrip)?.name}</b>
                        。基础戏法选择配额已自动 +1！
                      </div>
                    ) : (
                      <div
                        style={{
                          fontSize: '12px',
                          color: '#ff9500',
                          background: 'rgba(255, 149, 0, 0.08)',
                          padding: '8px 12px',
                          borderRadius: 8,
                        }}
                      >
                        请点击上方任意一道旧戏法，将其替换为新的戏法。
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

          {/* 2. 替换已准备法术 (Changing Your Prepared Spells) 替换开关 */}
          {currentStep.level > 1 && currentStep.canReplace && previousPreparedSpells.length > 0 && (
            <div
              style={{
                marginBottom: 28,
                padding: '16px 20px',
                background:
                  activeReplacedSpell !== undefined || isReplaceSpellOpen
                    ? 'rgba(0, 113, 227, 0.03)'
                    : 'var(--color-bg-dark)',
                borderRadius: 14,
                border: `1px solid ${activeReplacedSpell !== undefined || isReplaceSpellOpen ? 'rgba(0, 113, 227, 0.3)' : 'var(--color-border-dark)'}`,
                boxShadow: '0 2px 8px rgba(0,0,0,0.02)',
                transition: 'all 0.2s ease',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: activeReplacedSpell !== undefined || isReplaceSpellOpen ? 14 : 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 10,
                      background:
                        activeReplacedSpell !== undefined || isReplaceSpellOpen
                          ? 'var(--color-gold-accent)'
                          : 'var(--color-bg-dark)',
                      color:
                        activeReplacedSpell !== undefined || isReplaceSpellOpen
                          ? '#fff'
                          : 'var(--color-gold-accent)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <RotateCcw size={18} />
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: 'var(--color-text-primary)',
                      }}
                    >
                      替换已准备法术（Changing Your Prepared Spells）
                    </div>
                    <div style={{ fontSize: '12px', color: '#86868b' }}>
                      升级时可将 1 道旧法术替换为 1 道具有法术位的合规新法术（选填）。
                    </div>
                  </div>
                </div>

                {/* Toggle Switch */}
                <label
                  onClick={() =>
                    toggleSpellReplacementMode(
                      !isReplaceSpellOpen && activeReplacedSpell === undefined,
                    )
                  }
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    gap: 8,
                    userSelect: 'none',
                  }}
                >
                  <span
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color:
                        activeReplacedSpell !== undefined || isReplaceSpellOpen
                          ? 'var(--color-gold-accent)'
                          : '#86868b',
                    }}
                  >
                    {activeReplacedSpell !== undefined || isReplaceSpellOpen ? '已开启' : '关闭'}
                  </span>
                  <div
                    style={{
                      width: 44,
                      height: 24,
                      borderRadius: 12,
                      background:
                        activeReplacedSpell !== undefined || isReplaceSpellOpen
                          ? 'var(--color-gold-accent)'
                          : 'var(--color-border-dark)',
                      position: 'relative',
                      transition: 'background-color 0.2s',
                      padding: 2,
                    }}
                  >
                    <div
                      style={{
                        width: 20,
                        height: 20,
                        borderRadius: 10,
                        background: 'var(--color-bg-dark)',
                        position: 'absolute',
                        top: 2,
                        left: activeReplacedSpell !== undefined || isReplaceSpellOpen ? 22 : 2,
                        transition: 'left 0.2s',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                      }}
                    />
                  </div>
                </label>
              </div>

              {/* 展开的法术替换控制区 */}
              {(activeReplacedSpell !== undefined || isReplaceSpellOpen) && (
                <div style={{ paddingTop: 12, borderTop: '1px solid #e5e5e7', marginTop: 12 }}>
                  <p
                    style={{
                      fontSize: '12px',
                      fontWeight: 600,
                      color: 'var(--color-text-primary)',
                      marginBottom: 8,
                    }}
                  >
                    选择 1 道要替换掉的旧法术(1阶+)：
                  </p>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
                    {previousPreparedSpells.map((spell) => {
                      const isReplacedThis = activeReplacedSpell === spell.id;
                      return (
                        <PillButton
                          key={spell.id}
                          size="sm"
                          variant={isReplacedThis ? 'primary' : 'outline'}
                          onClick={() => handleSelectReplacedSpell(spell)}
                          style={{
                            borderColor: isReplacedThis ? '#ff3b30' : undefined,
                            background: isReplacedThis ? '#ff3b30' : undefined,
                            color: isReplacedThis ? '#fff' : undefined,
                          }}
                        >
                          {spell.level > 0 && (
                            <span style={{ opacity: 0.8, marginRight: 4 }}>{spell.level}环</span>
                          )}
                          {spell.name}
                          {isReplacedThis && (
                            <span style={{ marginLeft: 4, fontSize: '10px' }}> (替换)</span>
                          )}
                        </PillButton>
                      );
                    })}
                  </div>

                  {activeReplacedSpell ? (
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#34c759',
                        background: 'rgba(52, 199, 89, 0.08)',
                        padding: '8px 12px',
                        borderRadius: 8,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <Check size={14} strokeWidth={3} /> 已选中要替换掉的旧法术：
                      <b>{getSpellDefinition(activeReplacedSpell)?.name}</b>。基础法术选择配额已自动
                      +1！
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: '12px',
                        color: '#ff9500',
                        background: 'rgba(255, 149, 0, 0.08)',
                        padding: '8px 12px',
                        borderRadius: 8,
                      }}
                    >
                      请点击上方任意一道旧法术，将其替换为新的法术。
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 来源筛选 */}
          {availableSources.length > 1 && (
            <div style={{ marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: '13px',
                  fontWeight: 600,
                  color: '#86868b',
                }}
              >
                筛选来源:
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <PillButton
                  size="xs"
                  variant={
                    !sourceFilter || !availableSources.includes(sourceFilter)
                      ? 'primary'
                      : 'outline'
                  }
                  onClick={() => setSourceFilter(null)}
                  style={{ fontSize: '11px', padding: '2px 10px', minHeight: '24px' }}
                >
                  全部
                </PillButton>
                {availableSources.map((source) => (
                  <PillButton
                    key={source}
                    size="xs"
                    variant={
                      sourceFilter === source && availableSources.includes(sourceFilter)
                        ? 'primary'
                        : 'outline'
                    }
                    onClick={() => setSourceFilter(source)}
                    style={{ fontSize: '11px', padding: '2px 10px', minHeight: '24px' }}
                  >
                    {source}
                  </PillButton>
                ))}
              </div>
            </div>
          )}

          {/* 基础戏法 */}
          {(currentStep.newCantrips > 0 || cantripLimit > 0) && (
            <SpellPoolSection
              slotId="base-cantrips"
              title="基础戏法选择"
              spells={filteredSpells.filter((s) => s.level === 0)}
              current={sel.cantrips.length}
              limit={cantripLimit}
              sel={sel}
              isWizardBase={isWizard}
              book={[]}
              allSelections={allSelectionsFromProgression}
              innateSpellIds={innateSpellIds}
              currentStep={currentStep}
              toggleSelection={toggleSelection}
              toggleExtraSelection={toggleExtraSelection}
            />
          )}

          {/* 基础法术 */}
          {(currentStep.newSpells > 0 || spellLimit > 0) && (
            <>
              {isWizard && (
                <div
                  style={{
                    fontSize: '12px',
                    color: '#86868b',
                    marginBottom: 12,
                    padding: '8px 12px',
                    background: 'var(--color-bg-dark)',
                    borderRadius: 8,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <Info size={14} /> 提示：法师仅可准备已抄入法术书的法术。
                </div>
              )}
              <SpellPoolSection
                slotId="base-spells"
                title="基础法术选择"
                spells={filteredSpells.filter((s) => s.level > 0)}
                current={sel.spells.length}
                limit={spellLimit}
                sel={sel}
                isWizardBase={isWizard}
                book={getSpellbookForWizard}
                allSelections={allSelectionsFromProgression}
                innateSpellIds={innateSpellIds}
                currentStep={currentStep}
                toggleSelection={toggleSelection}
                toggleExtraSelection={toggleExtraSelection}
              />
            </>
          )}

          {/* 额外选择槽 */}
          {currentStep.extraChoices.map((choice) => {
            const ec = choice;
            let filteredPool = filteredSpells;
            if (ec.filter) {
              const parts = ec.filter.split(';').map((p) => p.trim());
              const targetClass = parts
                .find((p) => p.startsWith('class:'))
                ?.split(':')[1]
                ?.trim()
                ?.toLowerCase();
              const targetLevel = parts
                .find((p) => p.startsWith('level:'))
                ?.split(':')[1]
                ?.trim();
              const targetSchool = parts
                .find((p) => p.startsWith('school:'))
                ?.split(':')[1]
                ?.trim()
                ?.toLowerCase();

              filteredPool = filteredPool.filter((s) => {
                let match = true;
                if (targetClass) {
                  match =
                    match &&
                    s.classes.some((c) => {
                      const lowC = c.toLowerCase();
                      if (lowC === targetClass) return true;
                      const classDef = getClassDefinition(c);
                      return (
                        classDef?.nameEn.toLowerCase() === targetClass ||
                        c.toLowerCase() === targetClass
                      );
                    });
                }
                if (targetLevel) {
                  const allowedLvls = targetLevel
                    .split(',')
                    .map((v) => {
                      if (v.includes('-')) {
                        const [min, max] = v.split('-').map(Number);
                        return Array.from({ length: max - min + 1 }, (_, i) => min + i);
                      }
                      return [Number(v.trim())];
                    })
                    .flat();
                  match = match && allowedLvls.includes(s.level);
                }
                if (targetSchool) {
                  const schools = targetSchool.split(',').map((v) => v.trim().toLowerCase());
                  match =
                    match &&
                    schools.some((ts) => {
                      const sSchool = (s.school || '').toLowerCase();
                      if (sSchool === ts) return true;
                      const sZh = translateSpellSchool(s.school).replace('系', '');
                      const tZh = translateSpellSchool(ts).replace('系', '');
                      return sZh === tZh && sZh !== s.school;
                    });
                }
                return match;
              });
            }
            const current = sel.extra?.[ec.id]?.length || 0;
            return (
              <SpellPoolSection
                key={ec.id}
                slotId={ec.id}
                title={ec.label}
                spells={filteredPool}
                current={current}
                limit={ec.numToChoose}
                sel={sel}
                isWizardBase={false}
                book={[]}
                allSelections={allSelectionsFromProgression}
                innateSpellIds={innateSpellIds}
                currentStep={currentStep}
                toggleSelection={toggleSelection}
                toggleExtraSelection={toggleExtraSelection}
              />
            );
          })}

          {/* 底部导航与确认 */}
          <div
            style={{
              marginTop: 40,
              paddingTop: 32,
              borderTop: '2px solid #f5f5f7',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 20,
            }}
          >
            {!isStepComplete(activeStepIndex) && (
              <div
                style={{
                  color: 'var(--color-gold-accent)',
                  fontSize: '13px',
                  background: 'var(--color-bg-subtle)',
                  padding: '10px 16px',
                  borderRadius: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  border: '1px solid var(--color-border-gold)',
                  marginBottom: 8,
                }}
              >
                <Info size={16} />
                <div style={{ flex: 1 }}>
                  <b>配置未完成</b>：你可以继续到下一等级，但请记得在<b>角色卡</b>中补完。
                </div>
              </div>
            )}
            <div
              style={{ display: 'flex', gap: 16, width: '100%', justifyContent: 'space-between' }}
            >
              <PillButton
                variant="outline"
                disabled={activeStepIndex === 0}
                onClick={() => setActiveStepIndex((p) => p - 1)}
              >
                <ChevronLeft size={16} /> 上一等级
              </PillButton>

              <PillButton
                variant="primary"
                disabled={activeStepIndex === progressionSteps.length - 1}
                onClick={() => setActiveStepIndex((p) => p + 1)}
                style={{ padding: '12px 40px', fontSize: '15px', fontWeight: 700 }}
              >
                确认选择并解锁下一等级 <ChevronRight size={18} />
              </PillButton>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
