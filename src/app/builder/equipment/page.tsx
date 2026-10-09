'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCharacterStore } from '@/store/characterStore';
import PillButton from '@/components/PillButton';
import OptionCard from '@/components/OptionCard';
import styles from '../species/page.module.css';
import { findItemById, findItemByName, getBackgroundDefinition, getPrimaryClassDefinition, isProficientWithArmor } from '@/engine/characterData';
import { CharacterState, InventoryEntry } from '@/types/characterState';
import { Background, BackgroundEquipmentRecord } from '@/types/background';
import { ClassData, EquipmentRecord } from '@/types/class';
import { getCatalogItems } from '@/catalog';
import type { Armor, Weapon } from '@/types/equipment';
import { ALL_TOOLS, translateProficiency } from '@/engine/terminology';
import { totalInCP, fromCPToCurrency, deductCurrency, parsePriceToCP } from '@/utils/currencyUtils';
import { Selection } from '@/types/species';
import MarkdownText from '@/components/MarkdownText';
import ItemDetailContent from '@/components/ItemDetailContent';
import { ChevronDown, ChevronUp, Sword, Shield as ShieldIcon, Hammer, Package, FlaskConical, Box, Coins, Dice5, Search, ShoppingCart, Info, Sparkles, Wand2, Split } from 'lucide-react';
import { deductCP } from '@/utils/currencyUtils';

type Currency = CharacterState['currency'];

const currencyOrder: (keyof Currency)[] = ['pp', 'gp', 'ep', 'sp', 'cp'];

function emptyCurrency(): Currency {
  return { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
}

function parseCurrency(label: string): Partial<Currency> | null {
  const normalized = label.replace(/\s+/g, '').toUpperCase();
  const match = normalized.match(/^(\d+)(PP|GP|EP|SP|CP)$/);
  if (!match) return null;
  return { [match[2].toLowerCase() as keyof Currency]: parseInt(match[1], 10) };
}

function mergeCurrency(base: Currency, patch: Partial<Currency>): Currency {
  return {
    cp: base.cp + (patch.cp ?? 0),
    sp: base.sp + (patch.sp ?? 0),
    ep: base.ep + (patch.ep ?? 0),
    gp: base.gp + (patch.gp ?? 0),
    pp: base.pp + (patch.pp ?? 0),
  };
}

function getCategoryFromItem(item?: { armorCategory?: string; weaponCategory?: string }): InventoryEntry['category'] {
  if (!item) return 'other';
  if ('weaponCategory' in item) return 'weapon';
  if (item.armorCategory === 'Shield') return 'shield';
  if (item.armorCategory) return 'armor';
  return 'gear';
}

function getItemCategory(input: any): InventoryEntry['category'] {
  if (!input) return 'other';
  
  // 如果输入是字符串，则视为 type 字段进行基础匹配
  if (typeof input === 'string') {
    if (input.includes('武器')) return 'weapon';
    if (input.includes('盾') || input.includes('甲')) return 'armor'; // 盾牌归入护甲
    if (input.includes('工具') || input.includes('赌具') || input.includes('游戏具')) return 'tool';
    return 'gear';
  }

  const item = input;
  const type = item.type || '';
  const tags = item.tags || [];
  
  if (type.includes('武器') || item.weaponCategory) return 'weapon';
  if (type.includes('盾') || item.armorCategory === 'Shield' || type.includes('甲') || item.armorCategory) return 'armor'; // 盾牌归入护甲
  if (tags.includes('工匠工具') || tags.includes('游戏具') || tags.includes('游戏') || tags.includes('乐器') || type.includes('工具') || type.includes('赌具')) return 'tool';
  if (tags.includes('坐骑') || tags.includes('载具')) return 'vehicle';
  if (type.includes('弹药') || type.includes('法器') || type.includes('套组') || type.includes('杂物') || tags.includes('冒险道具')) return 'gear';
  return 'other';
}

function expandEquipmentOptions(choiceA: (string | { options: string[] })[]): string[] {
  let combinations: string[][] = [[]];

  choiceA.forEach((entry) => {
    if (typeof entry === 'string') {
      combinations = combinations.map((combo) => [...combo, entry]);
      return;
    }

    const next: string[][] = [];
    entry.options.forEach((option) => {
      combinations.forEach((combo) => next.push([...combo, option]));
    });
    combinations = next;
  });

  return combinations.map((combo) => combo.join('，'));
}

function parseLabelWithQuantity(label: string) {
  // 匹配形如 "2把匕首", "10支箭", "5GP" 的模式
  // 1. 尝试匹配阿拉伯数字开头的情况
  const match = label.match(/^(\d+)\s*(把|支|个|件|条|双|套|枚|张|份|瓶|卷|副|包|盒|根|GP|SP|CP|PP|EP)?\s*(.*)$/i);
  if (match) {
    const qty = parseInt(match[1], 10);
    const unit = match[2];
    const rest = match[3].trim();
    
    // 如果单位是货币，直接返回货币
    if (['GP', 'SP', 'CP', 'PP', 'EP'].includes(unit?.toUpperCase())) {
      return { quantity: qty, name: unit.toUpperCase(), isCurrency: true };
    }
    
    return { quantity: qty, name: rest || unit };
  }

  // 2. 尝试匹配中文数字量词开头的情况 (如 "一枚俄佐立徽章", "一套高档服装", "一瓶蓝墨水")
  const matchCn = label.match(/^([一二三四五六七八九十两])\s*(把|支|个|件|条|双|套|枚|张|份|瓶|卷|副|包|盒|根)\s*(.*)$/);
  if (matchCn) {
    const cnDigits: Record<string, number> = { '一': 1, '二': 2, '两': 2, '三': 3, '四': 4, '五': 5, '六': 6, '七': 7, '八': 8, '九': 9, '十': 10 };
    const qty = cnDigits[matchCn[1]] || 1;
    const rest = matchCn[3].trim();
    return { quantity: qty, name: rest };
  }

  return { quantity: 1, name: label };
}

function labelsToInventoryEntries(labels: string[], source: string) {
  const inventoryEntries: InventoryEntry[] = [];
  let currency = emptyCurrency();

  // 若传入的标签包含逗号、连词等复合长句，先平铺拆解
  const flattened: string[] = [];
  labels.forEach((l) => {
    if (typeof l !== 'string') return;
    if (l.includes('，') || l.includes('、') || l.includes('以及') || l.includes('还有')) {
      const parts = l.split(/[，,;；、]|(?:\s*以及\s*|\s*还有\s*)/).map(p => p.trim()).filter(Boolean);
      flattened.push(...parts);
    } else {
      flattened.push(l);
    }
  });

  flattened.forEach((label) => {
    const trimmed = label.trim();
    if (!trimmed) return;

    // 检查并提取内含货币，例如 "小包（内含 10 GP）" 或 "一条腰带小包内装有10gp"
    const embeddedCurMatch = trimmed.match(/(?:[（(]?内含|[（(]?内装有|装有)\s*(\d+)\s*(GP|SP|CP|PP|EP)[）)]?/i);
    let cleanTrimmed = trimmed;
    if (embeddedCurMatch) {
      const amt = parseInt(embeddedCurMatch[1], 10);
      const curType = embeddedCurMatch[2].toLowerCase() as keyof Currency;
      currency = mergeCurrency(currency, { [curType]: amt });
      cleanTrimmed = trimmed.replace(/(?:[（(]?内含|[（(]?内装有|装有)\s*(\d+)\s*(GP|SP|CP|PP|EP)[）)]?/i, '').replace(/[（(].*?[）)]/g, '').trim();
    }

    // 首先尝试解析整条为货币
    const parsedCurrency = parseCurrency(cleanTrimmed);
    if (parsedCurrency) {
      currency = mergeCurrency(currency, parsedCurrency);
      return;
    }

    // 解析数量与名称
    const { quantity, name, isCurrency } = parseLabelWithQuantity(cleanTrimmed);
    
    if (isCurrency) {
      const curKey = name.toLowerCase() as keyof Currency;
      currency = mergeCurrency(currency, { [curKey]: quantity });
      return;
    }

    if (!name) return;

    // 尝试根据名称搜索物品
    const matchedItem = findItemByName(name);

    inventoryEntries.push({
      id: matchedItem ? `${source}:${matchedItem.id}` : `${source}:${trimmed}`,
      name: matchedItem?.name || name,
      source,
      quantity,
      category: getItemCategory(matchedItem),
      itemId: matchedItem?.id,
      weight: matchedItem?.weight
    });
  });

  return { inventoryEntries, currency };
}

function toInventoryCategory(category?: BackgroundEquipmentRecord['category']): InventoryEntry['category'] {
  if (category === 'weapon' || category === 'armor' || category === 'shield') return category;
  if (category === 'tool' || category === 'gear') return 'gear';
  return 'other';
}

function resolveSelectableItemId(selectedValue: string): string | undefined {
  if (!selectedValue) return undefined;
  const cleanId = selectedValue.split('|')[0].trim();
  const cleanName = selectedValue.replace(/\s*\[.*?\]$/, '').trim();
  const normalized = cleanId.toLowerCase();

  // 1. 尝试通过翻译名查找 (解决 ID 映射问题)
  // 如果选中了 'alchemistSupplies', translateProficiency 会返回 '炼金工具'
  // 然后 findItemByName 会找到 'alchemists-supplies-full'
  const name = translateProficiency(selectedValue);
  if (name && name !== selectedValue) {
    const item = findItemByName(name) || findItemByName(cleanName);
    if (item) return item.id;
  }

  // 2. 优先尝试直接在物品库中查找
  const item = findItemByName(selectedValue) || findItemByName(cleanName) || findItemById(selectedValue) || findItemById(cleanId);
  if (item) return item.id;

  // 3. 类别回退 (针对模糊匹配)
  if (normalized.includes('bagpipes') ||
      normalized.includes('drum') ||
      normalized.includes('dulcimer') ||
      normalized.includes('flute') ||
      normalized.includes('lute') ||
      normalized.includes('lyre') ||
      normalized.includes('horn') ||
      normalized.includes('pan flute') ||
      normalized.includes('shawm') ||
      normalized.includes('viol') ||
      normalized.includes('musical') ||
      normalized.includes('instrument')) {
    return 'musical-instruments-full';
  }

  if (normalized.includes('supplies') || normalized.includes('tools') || normalized.includes('utensils') || normalized.includes('artisan')) {
    return 'artisan-tools-full';
  }

  if (normalized.includes('set') || normalized.includes('gaming')) {
    return 'gaming-set-full';
  }

  return undefined;
}

function resolveEquipmentRecord(record: EquipmentRecord | BackgroundEquipmentRecord, sourceName: string, character: CharacterState) {
  if (record.kind === 'currency') {
    return {
      inventoryEntries: [] as InventoryEntry[],
      currency: mergeCurrency(emptyCurrency(), record.currency || {}),
    };
  }

  let resolvedItemId = record.itemId;
  let resolvedLabel = record.label;
  let extraCurrency = record.currency ? mergeCurrency(emptyCurrency(), record.currency) : emptyCurrency();

  // 防御性处理：若 label 仍混有末尾货币（如 "旅行服装， 30 GP" 或 "旅行服装 30 GP"），提取货币并净化装备名
  const compoundMatch = resolvedLabel.match(/(?:[，,\s]+|\s+)(\d+)\s*(GP|SP|CP|PP|EP|金币|银币|铜币|枚金币|枚)$/i);
  if (compoundMatch) {
    const amt = parseInt(compoundMatch[1], 10);
    const unit = compoundMatch[2].toLowerCase();
    const curKey: keyof Currency = (unit === '金币' || unit === 'gp' || unit === '枚' || unit === '枚金币') ? 'gp' :
                                  (unit === '银币' || unit === 'sp') ? 'sp' :
                                  (unit === '铜币' || unit === 'cp') ? 'cp' :
                                  (unit as keyof Currency);
    extraCurrency = mergeCurrency(extraCurrency, { [curKey]: amt });
    resolvedLabel = resolvedLabel.slice(0, compoundMatch.index).trim();
    if (!resolvedItemId) {
      const found = findItemByName(resolvedLabel);
      if (found) resolvedItemId = found.id;
    }
  }

  // 处理自选项 (Selection)
  if (!resolvedItemId && record.selectionId) {
    const selectedValue = character.backgroundSelections?.[record.selectionId]?.[0] || 
                          character.classSelections?.[record.selectionId]?.[0];
    if (selectedValue) {
      resolvedLabel = `${record.label}：${selectedValue}`;
      resolvedItemId = resolveSelectableItemId(selectedValue);
    }
  }

  const resolvedItem = resolvedItemId ? findItemById(resolvedItemId) : undefined;
  const itemId = resolvedItem?.id;

  return {
    inventoryEntries: [
      {
        id: itemId ? `${sourceName}:${itemId}:${resolvedLabel}` : `${sourceName}-unresolved:${resolvedLabel}`,
        name: resolvedItem?.name || resolvedLabel,
        quantity: record.quantity,
        source: sourceName,
        category: record.category ? toInventoryCategory(record.category as any) : getItemCategory(resolvedItem),
        itemId,
        weight: resolvedItem?.weight,
        notes: itemId ? undefined : '未映射到具体物品数据，保留原文记录',
      },
    ],
    currency: extraCurrency,
  };
}

function buildBackgroundEquipmentState(background: Background | undefined, character: CharacterState) {
  if (!background?.equipment) {
    return { inventoryEntries: [] as InventoryEntry[], currency: emptyCurrency() };
  }

  const selectedChoice = character.backgroundSelections?.[`bg:${background.id}:equipment`]?.[0];
  const useChoiceB = selectedChoice === 'choiceB';
  const records = useChoiceB
    ? (background.equipment.choiceBRecord ? [background.equipment.choiceBRecord] : [])
    : (background.equipment.choiceARecords || []);

  if (records.length > 0) {
    return records.reduce(
      (acc, record) => {
        const resolved = resolveEquipmentRecord(record, '背景起始装备', character);
        acc.inventoryEntries.push(...resolved.inventoryEntries);
        acc.currency = mergeCurrency(acc.currency, resolved.currency);
        return acc;
      },
      { inventoryEntries: [] as InventoryEntry[], currency: emptyCurrency() }
    );
  }

  if (!useChoiceB && background.equipment.choiceA.length) {
    return labelsToInventoryEntries(background.equipment.choiceA as string[], `背景: ${background.name}`);
  }

  if (useChoiceB && background.equipment.choiceB) {
    const parsedCurrency = parseCurrency(background.equipment.choiceB);
    return {
      inventoryEntries: [] as InventoryEntry[],
      currency: parsedCurrency ? mergeCurrency(emptyCurrency(), parsedCurrency) : emptyCurrency(),
    };
  }

  return { inventoryEntries: [] as InventoryEntry[], currency: emptyCurrency() };
}

function buildClassEquipmentState(primaryClass: ClassData | undefined, character: CharacterState, mode: 'package' | 'gold' | 'choiceC', selectedPackageText?: string) {
  if (!primaryClass) return { inventoryEntries: [] as InventoryEntry[], currency: emptyCurrency() };

  const { startingEquipment } = primaryClass;

  // --- 方案 B 处理 (通常标记为 gold) ---
  if (mode === 'gold') {
    // 优先尝试结构化记录 (如战士的方案B包含单品)
    const choiceBRecord = (startingEquipment as any).choiceBRecord;
    if (choiceBRecord) {
      const records = Array.isArray(choiceBRecord) ? choiceBRecord : [choiceBRecord];
      return records.reduce(
        (acc, record) => {
          const resolved = resolveEquipmentRecord(record, `职业: ${primaryClass.name} (方案B)`, character);
          acc.inventoryEntries.push(...resolved.inventoryEntries);
          acc.currency = mergeCurrency(acc.currency, resolved.currency);
          return acc;
        },
        { inventoryEntries: [] as InventoryEntry[], currency: emptyCurrency() }
      );
    }
    
    // 回退到解析字符串
    if (startingEquipment.choiceB) {
      const parsedClassGold = parseCurrency(startingEquipment.choiceB.replace(/\s+/g, ''));
      return {
        inventoryEntries: [] as InventoryEntry[],
        currency: parsedClassGold ? mergeCurrency(emptyCurrency(), parsedClassGold) : emptyCurrency(),
      };
    }
    return { inventoryEntries: [] as InventoryEntry[], currency: emptyCurrency() };
  }

  // --- 方案 C 处理 ---
  if (mode === 'choiceC') {
    const choiceCRecord = (startingEquipment as any).choiceCRecord;
    if (choiceCRecord) {
      const records = Array.isArray(choiceCRecord) ? choiceCRecord : [choiceCRecord];
      return records.reduce(
        (acc, record) => {
          const resolved = resolveEquipmentRecord(record, `职业: ${primaryClass.name} (方案C)`, character);
          acc.inventoryEntries.push(...resolved.inventoryEntries);
          acc.currency = mergeCurrency(acc.currency, resolved.currency);
          return acc;
        },
        { inventoryEntries: [] as InventoryEntry[], currency: emptyCurrency() }
      );
    }
    
    if (startingEquipment.choiceC) {
      const labels = startingEquipment.choiceC.split(/[，,]/).map(s => s.trim()).filter(Boolean);
      return labelsToInventoryEntries(labels, `职业: ${primaryClass.name} (方案C)`);
    }
    return { inventoryEntries: [] as InventoryEntry[], currency: emptyCurrency() };
  }

  // --- 方案 A 处理 (通常标记为 package) ---
  const classPackageOptions = expandEquipmentOptions(startingEquipment.choiceA || []);
  const effectivePackageText = selectedPackageText || (classPackageOptions.length > 0 ? classPackageOptions[0] : undefined);

  const choiceARecords = startingEquipment.choiceARecords;
  if (choiceARecords && choiceARecords.length > 0) {
    const filteredRecords = choiceARecords.filter(r => !r.optionName || r.optionName === effectivePackageText);
    return filteredRecords.reduce(
      (acc, record) => {
        const resolved = resolveEquipmentRecord(record, `职业: ${primaryClass.name} (方案A)`, character);
        acc.inventoryEntries.push(...resolved.inventoryEntries);
        acc.currency = mergeCurrency(acc.currency, resolved.currency);
        return acc;
      },
      { inventoryEntries: [] as InventoryEntry[], currency: emptyCurrency() }
    );
  }

  if (effectivePackageText) {
    const packageLabels = effectivePackageText.split(/[，,]/).map(p => p.trim()).filter(Boolean);
    return labelsToInventoryEntries(packageLabels, `职业: ${primaryClass.name} (方案A)`);
  }

  return { inventoryEntries: [] as InventoryEntry[], currency: emptyCurrency() };
}

function buildEquipmentState(character: CharacterState, mode: 'package' | 'gold' | 'choiceC', selectedPackage?: string) {
  const primaryClass = getPrimaryClassDefinition(character);
  const background = getBackgroundDefinition(character);

  const backgroundResult = buildBackgroundEquipmentState(background, character);
  const classResult = buildClassEquipmentState(primaryClass, character, mode, selectedPackage);

  const inventoryEntries: InventoryEntry[] = [
    ...backgroundResult.inventoryEntries,
    ...classResult.inventoryEntries
  ];
  const currency = mergeCurrency(backgroundResult.currency, classResult.currency);

  return { inventoryEntries, currency };
}

function EquipmentOptionCard({ 
  title, 
  description,
  selected, 
  onClick 
}: { 
  title: string; 
  description?: string;
  selected: boolean; 
  onClick: () => void 
}) {
  return (
    <div 
      className={`${styles.optionCard} ${selected ? styles.selected : ''}`} 
      onClick={onClick}
      style={{
        padding: '12px 20px',
        borderRadius: '12px',
        border: selected ? '2px solid #0071e3' : '1px solid #e5e5e7',
        backgroundColor: selected ? 'rgba(197, 160, 89, 0.1)' : 'var(--color-bg-dark)',
        cursor: 'pointer',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: selected ? '0 4px 12px rgba(0, 113, 227, 0.1)' : '0 2px 4px rgba(0,0,0,0.02)',
        width: '100%',
        minHeight: '64px'
      }}
      onMouseEnter={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = '#d2d2d7';
          e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.05)';
        }
      }}
      onMouseLeave={(e) => {
        if (!selected) {
          e.currentTarget.style.borderColor = 'var(--color-border-dark)';
          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.02)';
        }
      }}
    >
      {/* Radio Indicator */}
      <div style={{
        width: '20px',
        height: '20px',
        borderRadius: '50%',
        border: selected ? '2px solid #0071e3' : '2px solid #d2d2d7',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        backgroundColor: 'white',
        transition: 'all 0.2s'
      }}>
        {selected && (
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: 'var(--color-gold-accent)'
          }} />
        )}
      </div>

      <div style={{ flex: 1 }}>
        <div style={{ 
          fontWeight: 'bold', 
          fontSize: '1rem', 
          color: selected ? 'var(--color-gold-accent)' : 'var(--color-text-primary)',
          transition: 'color 0.2s',
          lineHeight: 1.2
        }}>
          {title}
        </div>
        {description && (
          <div style={{ 
            fontSize: '0.75rem', 
            color: '#86868b', 
            marginTop: 4, 
            lineHeight: 1.4,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden'
          }}>
            {description}
          </div>
        )}
      </div>

      {selected && (
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          background: 'var(--color-gold-accent)',
          color: 'white',
          padding: '2px 8px',
          fontSize: '0.6rem',
          fontWeight: 'bold',
          borderBottomLeftRadius: '8px',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          Selected
        </div>
      )}
    </div>
  );
}

// 辅助函数：根据物品 ID 获取详细描述
function getItemDetails(entry: InventoryEntry) {
  const item = 
    findItemById(entry.itemId);
  
  return item;
}

function InventoryItemRow({ 
  entry, 
  character,
  isMainHand,
  isOffHand,
  isEquipped,
  onToggleMainHand,
  onToggleOffHand,
  onToggleEquip, 
  onToggleVersatile,
  onUnpack,
  onSplit,
  onRemove 
}: { 
  entry: InventoryEntry; 
  character: CharacterState;
  isMainHand?: boolean;
  isOffHand?: boolean;
  isEquipped?: boolean;
  onToggleMainHand?: () => void;
  onToggleOffHand?: () => void;
  onToggleEquip?: () => void; 
  onToggleVersatile?: (val: boolean) => void;
  onUnpack?: () => void;
  onSplit?: () => void;
  onRemove?: () => void; 
}) {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const details = getItemDetails(entry);
  
  const isWeapon = entry.category === 'weapon';
  const isArmor = entry.category === 'armor';
  const isShield = entry.category === 'shield';
  const isPackage = (details as any)?.contentsDetailed?.length > 0;
  
  const weaponDetails = isWeapon ? (details as Weapon) : null;
  const armorDetails = (isArmor || isShield) ? (details as Armor) : null;

  const isTwoHanded = weaponDetails?.properties?.includes('2H');
  const isVersatile = weaponDetails?.properties?.some((p: string) => p.startsWith('V'));
  
  // 护甲熟练检查
  const isProficient = React.useMemo(() => {
    if (!character || !armorDetails) return true;
    return isProficientWithArmor(character, armorDetails);
  }, [character, armorDetails]);

  return (
    <div style={{ borderBottom: '1px solid #f1f5f9', overflow: 'hidden', transition: 'all 0.3s ease' }}>
      <div 
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          padding: '14px 24px', 
          gap: 16,
          cursor: 'pointer',
          background: isExpanded ? '#f8fafc' : 'white',
          transition: 'background 0.2s ease'
        }}
        onClick={() => setIsExpanded(!isExpanded)}
        onMouseEnter={(e) => !isExpanded && (e.currentTarget.style.background = '#fcfdfe')}
        onMouseLeave={(e) => !isExpanded && (e.currentTarget.style.background = 'white')}
      >
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 800, color: '#0f172a', fontSize: '1rem' }}>{entry.name}</span>
            {entry.quantity && entry.quantity > 1 && (
              <span style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>×{entry.quantity}</span>
            )}
            {isPackage && (
              <span style={{ 
                fontSize: '0.65rem', 
                padding: '2px 6px', 
                background: '#e0e7ff', 
                color: '#4338ca', 
                borderRadius: '6px',
                fontWeight: 'bold',
                textTransform: 'uppercase'
              }}>
                套组
              </span>
            )}
          </div>
          
          {/* 简易效果展示区 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: '0.75rem', color: '#64748b' }}>
            {isWeapon && weaponDetails && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#2563eb', fontWeight: 600 }}>
                  <Sword size={12} />
                  {weaponDetails.damage} {weaponDetails.damageType}
                </div>
                {weaponDetails.mastery && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#7e22ce' }}>
                    <Sparkles size={12} />
                    {weaponDetails.mastery.name}
                  </div>
                )}
                {weaponDetails.properties && (
                  <div style={{ opacity: 0.7 }}>{weaponDetails.properties.join(', ')}</div>
                )}
              </>
            )}
            {(isArmor || isShield) && armorDetails && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#059669', fontWeight: 600 }}>
                  <ShieldIcon size={12} />
                  AC {armorDetails.ac}
                </div>
                <div style={{ opacity: 0.7 }}>
                  {armorDetails.armorCategory === 'Light' ? '轻甲' : 
                   armorDetails.armorCategory === 'Medium' ? '中甲' : 
                   armorDetails.armorCategory === 'Shield' ? '盾牌' : '重甲'}
                </div>
                {armorDetails.stealthDisadvantage && (
                  <div style={{ color: '#ef4444', fontWeight: 600 }}>隐匿劣势</div>
                )}
              </>
            )}
            {!isWeapon && !isArmor && !isShield && entry.weight && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <Package size={12} style={{ opacity: 0.5 }} />
                {entry.weight}
              </div>
            )}
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          {/* 状态标签 */}
          {(isEquipped || isMainHand || isOffHand) && (
            <div style={{ display: 'flex', gap: 4 }}>
              {isMainHand && <span style={{ fontSize: '0.65rem', background: '#2563eb', color: 'white', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>主手</span>}
              {isOffHand && <span style={{ fontSize: '0.65rem', background: '#6366f1', color: 'white', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>副手</span>}
              {(isArmor || isShield) && isEquipped && <span style={{ fontSize: '0.65rem', background: '#059669', color: 'white', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>已穿戴</span>}
              {!isProficient && <span style={{ fontSize: '0.65rem', background: '#ef4444', color: 'white', padding: '2px 8px', borderRadius: '4px', fontWeight: 'bold' }}>未受训</span>}
            </div>
          )}

          <div style={{ display: 'flex', gap: 8 }} onClick={e => e.stopPropagation()}>
            {isWeapon && (
              <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '10px', gap: 2 }}>
                <button 
                  onClick={onToggleMainHand}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '8px',
                    fontSize: '0.8rem',
                    border: 'none',
                    background: isMainHand ? '#2563eb' : 'transparent',
                    color: isMainHand ? 'white' : '#64748b',
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    transition: 'all 0.2s',
                    boxShadow: isMainHand ? '0 2px 4px rgba(37, 99, 235, 0.2)' : 'none'
                  }}
                >
                  主手
                </button>
                {!isTwoHanded && (
                  <button 
                    onClick={onToggleOffHand}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '0.8rem',
                      border: 'none',
                      background: isOffHand ? '#6366f1' : 'transparent',
                      color: isOffHand ? 'white' : '#64748b',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      transition: 'all 0.2s',
                      boxShadow: isOffHand ? '0 2px 4px rgba(99, 102, 241, 0.2)' : 'none'
                    }}
                  >
                    副手
                  </button>
                )}
              </div>
            )}
            {(isArmor || isShield) && (
              <button 
                onClick={onToggleEquip}
                style={{
                  padding: '6px 16px',
                  borderRadius: '10px',
                  fontSize: '0.8rem',
                  border: isEquipped ? 'none' : '1px solid #e2e8f0',
                  background: isEquipped ? '#059669' : 'white',
                  color: isEquipped ? 'white' : '#64748b',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  transition: 'all 0.2s',
                  boxShadow: isEquipped ? '0 2px 4px rgba(5, 150, 105, 0.2)' : 'none'
                }}
              >
                {isEquipped ? '卸下' : '装备'}
              </button>
            )}
            
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {entry.quantity && entry.quantity > 1 && (
                <button 
                  onClick={(e) => { e.stopPropagation(); onSplit?.(); }}
                  title="拆分为单个物品"
                  style={{
                    border: 'none',
                    background: '#f1f5f9',
                    width: '32px',
                    height: '32px',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#64748b',
                    transition: 'all 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#e2e8f0'}
                  onMouseLeave={(e) => e.currentTarget.style.background = '#f1f5f9'}
                >
                  <Split size={14} />
                </button>
              )}
              <div style={{ 
                width: '32px', 
                height: '32px', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                color: '#94a3b8',
                transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
              }}>
                <ChevronDown size={20} />
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {isExpanded && (
        <div style={{ padding: '0 16px 16px 16px', fontSize: '0.9rem', color: 'var(--color-text-secondary)', background: 'var(--color-bg-dark)' }}>
          <div style={{ 
            padding: '16px', 
            background: '#f8fafc', 
            borderRadius: '12px', 
            border: '1px solid #e2e8f0'
          }}>
            <ItemDetailContent item={details} category={entry.category || ''} />
            
            {isVersatile && (isMainHand || isOffHand) && (
              <div style={{ 
                marginTop: 12, 
                padding: '10px 12px', 
                background: 'var(--color-bg-dark)', 
                borderRadius: '8px', 
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between'
              }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b' }}>多用 (Versatile) 模式切换：</div>
                <div style={{ display: 'flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px', gap: 2 }}>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onToggleVersatile?.(false); }}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      border: 'none',
                      background: !entry.versatileTwoHanded ? '#7e22ce' : 'transparent',
                      color: !entry.versatileTwoHanded ? 'white' : '#64748b',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      transition: 'all 0.2s'
                    }}
                  >
                    单手
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onToggleVersatile?.(true); }}
                    style={{
                      padding: '4px 12px',
                      borderRadius: '6px',
                      fontSize: '0.75rem',
                      border: 'none',
                      background: entry.versatileTwoHanded ? '#7e22ce' : 'transparent',
                      color: entry.versatileTwoHanded ? 'white' : '#64748b',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      transition: 'all 0.2s'
                    }}
                  >
                    双手
                  </button>
                </div>
              </div>
            )}

            {(details as any)?.contentsDetailed && (
              <div style={{ 
                marginTop: 16, 
                padding: '16px', 
                background: 'var(--color-bg-dark)', 
                borderRadius: '12px', 
                border: '1px solid #e2e8f0'
              }}>
                <div style={{ 
                  fontSize: '0.85rem', 
                  fontWeight: 'bold', 
                  color: '#1e293b', 
                  marginBottom: 12, 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center' 
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Package size={16} color="#6366f1" />
                    <span>套组明细</span>
                  </div>
                  <button 
                    onClick={(e) => { e.stopPropagation(); onUnpack?.(); }}
                    style={{
                      padding: '6px 14px',
                      borderRadius: '999px',
                      fontSize: '0.75rem',
                      border: 'none',
                      background: '#6366f1',
                      color: 'white',
                      cursor: 'pointer',
                      fontWeight: 'bold'
                    }}
                  >
                    拆分到库存
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: '8px 16px' }}>
                  {((details as any).contentsDetailed as any[]).map((sub: any, idx: number) => {
                    const subDef = findItemById(sub.id);
                    return (
                      <React.Fragment key={idx}>
                        <div style={{ fontSize: '0.8rem', color: '#334155' }}>{sub.name}</div>
                        <div style={{ fontSize: '0.8rem', color: '#64748b', fontWeight: 600 }}>x{sub.quantity || 1}</div>
                        <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{subDef?.weight || '---'}</div>
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ShopItemRow({ 
  item, 
  onBuy, 
  canAfford 
}: { 
  item: any; 
  onBuy: () => void; 
  canAfford: boolean;
}) {
  const [isExpanded, setIsExpanded] = React.useState(false); // 默认收起以方便查看
  const category = getItemCategory(item);
  
  return (
    <div style={{ 
      margin: '12px 32px', 
      borderRadius: '16px', 
      border: '1px solid #e2e8f0', 
      background: 'var(--color-bg-dark)',
      overflow: 'hidden',
      boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
      transition: 'all 0.3s ease'
    }}>
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          padding: '16px 20px', 
          gap: 16,
          background: isExpanded ? '#f8fafc' : 'white',
          borderBottom: isExpanded ? '1px solid #f1f5f9' : 'none',
          cursor: 'pointer',
          transition: 'background 0.2s ease'
        }}
        onMouseEnter={(e) => !isExpanded && (e.currentTarget.style.background = '#f8fafc')}
        onMouseLeave={(e) => !isExpanded && (e.currentTarget.style.background = 'white')}
      >
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          justifyContent: 'center',
          color: '#94a3b8',
          transition: 'transform 0.3s ease',
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)'
        }}>
          <ChevronDown size={20} />
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontWeight: 800, fontSize: '1.1rem', color: '#0f172a' }}>{item.name}</span>
            <span style={{ fontSize: '0.65rem', padding: '2px 6px', background: '#e2e8f0', color: '#64748b', borderRadius: '4px', fontWeight: 'bold' }}>{item.source}</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 6 }}>
            {category === 'weapon' && <Sword size={12} />}
            {category === 'armor' && <ShieldIcon size={12} />}
            {category === 'tool' && <Hammer size={12} />}
            {category === 'vehicle' && <Dice5 size={12} />}
            {item.type || '装备'}
          </div>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontWeight: '900', fontSize: '1.1rem', color: canAfford ? '#059669' : '#ef4444' }}>{item.cost || '---'}</div>
            <div style={{ fontSize: '0.7rem', color: '#94a3b8', fontWeight: 600 }}>{item.weight || '---'}</div>
          </div>
          
          <button 
            onClick={(e) => { e.stopPropagation(); onBuy(); }}
            disabled={!canAfford}
            style={{
              padding: '10px 24px',
              borderRadius: '12px',
              fontSize: '0.9rem',
              border: 'none',
              background: canAfford ? '#2563eb' : '#e2e8f0',
              color: 'white',
              cursor: canAfford ? 'pointer' : 'not-allowed',
              fontWeight: '900',
              boxShadow: canAfford ? '0 4px 12px rgba(37, 99, 235, 0.2)' : 'none',
              transition: 'all 0.2s'
            }}
          >
            购买
          </button>
        </div>
      </div>
      
      {isExpanded && (
        <div style={{ 
          padding: '20px', 
          background: 'var(--color-bg-dark)',
          animation: 'slideDown 0.3s ease-out'
        }}>
          <ItemDetailContent item={item} category={category} />
        </div>
      )}
    </div>
  );
}

export default function EquipmentPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { characters, updateActiveCharacter, loadCharacter } = useCharacterStore();
  const character = id ? characters[id] : null;
  const automaticSyncAttempt = useRef<string | null>(null);

  useEffect(() => {
    if (id) loadCharacter(id);
  }, [id, loadCharacter]);

  const primaryClass = useMemo(() => (character ? getPrimaryClassDefinition(character) : undefined), [character]);
  const background = useMemo(() => (character ? getBackgroundDefinition(character) : undefined), [character]);

  const classPackageOptions = useMemo(() => {
    if (!primaryClass) return [];
    return expandEquipmentOptions(primaryClass.startingEquipment.choiceA);
  }, [primaryClass]);

  const selectedPackage = character?.selectedClassPackage || (classPackageOptions.length > 0 ? classPackageOptions[0] : undefined);

  const [activeTab, setActiveTab] = useState<'inventory' | 'shop'>('inventory');
  const [shopSearch, setShopSearch] = useState('');
  const [shopCategory, setShopCategory] = useState('all');
  
  // 武器子筛选状态
  const [weaponTypeFilter, setWeaponTypeFilter] = useState<'all' | 'Simple' | 'Martial'>('all');
  const [weaponRangeFilter, setWeaponRangeFilter] = useState<'all' | 'Melee' | 'Ranged'>('all');

  const handleBuyItem = (item: any) => {
    if (!character) return;
    const priceCP = parsePriceToCP(item.cost);
    const totalCP = totalInCP(character.currency);
    
    if (totalCP < priceCP) {
      alert('金币不足！');
      return;
    }

    const nextCurrency = deductCP(character.currency, priceCP);
    const newEntry: InventoryEntry = {
      id: `purchased:${item.id}:${Date.now()}`,
      itemId: item.id,
      name: item.name,
      quantity: 1,
      source: item.source,
      category: getItemCategory(item),
      weight: item.weight,
    };

    updateActiveCharacter({
      currency: nextCurrency,
      inventoryEntries: [...character.inventoryEntries, newEntry]
    });
  };

  const shopItems = useMemo(() => {
    const catalogItems = getCatalogItems();
    const all = catalogItems;
    const filteredBase = all.filter(item => (item as any).type !== '货币');

    return filteredBase.filter(item => {
      const cat = getItemCategory(item);
      
      if (shopCategory === 'weapon') {
        if (cat !== 'weapon') return false;
        
        const weapon = item as Weapon;
        const matchesType = weaponTypeFilter === 'all' || weapon.weaponCategory === weaponTypeFilter;
        const matchesRange = weaponRangeFilter === 'all' || weapon.weaponRange === weaponRangeFilter;
        
        return matchesType && matchesRange;
      }
      
      if (shopCategory === 'armor') return cat === 'armor';
      if (shopCategory === 'tool') return cat === 'tool';
      if (shopCategory === 'gear') return cat === 'gear';
      if (shopCategory === 'vehicle') return cat === 'vehicle';
      return cat === 'other';
    });
  }, [shopCategory, weaponTypeFilter, weaponRangeFilter]);

  const applyEquipmentState = React.useCallback((params: {
    classMode?: 'package' | 'gold' | 'choiceC';
    classPackage?: string;
    backgroundMode?: 'choiceA' | 'choiceB';
  }) => {
    if (!character) return;

    // 确定新的选择模式
    const newClassMode = params.classMode ?? (character.equipmentChoiceMode as any) ?? 'package';
    const currentBGChoice = background?.id ? character.backgroundSelections?.[`bg:${background.id}:equipment`]?.[0] : undefined;
    const newBGMode = params.backgroundMode ?? currentBGChoice ?? 'choiceA';
    const newClassPackage = params.classPackage || selectedPackage || (classPackageOptions.length > 0 ? classPackageOptions[0] : undefined);
    
    // 更新选择记录 (同步逻辑)
    const nextBackgroundSelections = { ...character.backgroundSelections };
    if (background?.id) {
      nextBackgroundSelections[`bg:${background.id}:equipment`] = [newBGMode];
    }

    // 计算起始装备结果
    const { inventoryEntries, currency } = buildEquipmentState(
      { ...character, backgroundSelections: nextBackgroundSelections, equipmentChoiceMode: newClassMode }, 
      newClassMode, 
      newClassPackage
    );

    // 保留非起始装备条目 (如已装备标记、商店购买的物品、手动添加的物品等)
    const preservedInventoryEntries = character.inventoryEntries.filter((entry) => {
      const isStarting = entry.source?.startsWith('背景') || entry.source?.startsWith('职业');
      return !isStarting;
    });

    updateActiveCharacter({
      equipmentChoiceMode: newClassMode,
      selectedClassPackage: newClassPackage,
      backgroundSelections: nextBackgroundSelections,
      inventoryEntries: [...inventoryEntries, ...preservedInventoryEntries],
      currency,
      startingEquipmentSynced: true,
    });
  }, [character, background, selectedPackage, classPackageOptions, updateActiveCharacter]);

  // 自动同步/初始化起始装备
  useEffect(() => {
    if (!character) return;
    if (!primaryClass && !background) return;

    // 检查角色是否有起始装备记录
    const hasStartingEntries = character.inventoryEntries.some(
      (entry) => entry.source?.startsWith('背景') || entry.source?.startsWith('职业')
    );

    // 检查职业和背景是否与当前装备匹配
    const isClassSynced = !primaryClass || character.inventoryEntries.some((entry) => entry.source?.includes(primaryClass.name)) || character.equipmentChoiceMode === 'gold';

    const syncKey = [
      character.id,
      primaryClass?.catalogId || primaryClass?.name || '',
      background?.id || '',
      character.equipmentChoiceMode || 'package',
      selectedPackage || '',
    ].join('|');
    if ((!character.startingEquipmentSynced || !hasStartingEntries || !isClassSynced) && automaticSyncAttempt.current !== syncKey) {
      automaticSyncAttempt.current = syncKey;
      applyEquipmentState({});
    }
  }, [character, primaryClass, background, selectedPackage, applyEquipmentState]);

  const upsertEquippedItem = (entry: InventoryEntry, hand?: 'main' | 'off') => {
    if (!character) return;
    
    const itemId = entry.id; // 使用实例 ID 区分同名物品
    if (!itemId) return;

    let updates: Partial<CharacterState> = {};
    const currentInventory = [...character.inventoryEntries];
    
    if (entry.category === 'weapon') {
      const details = getItemDetails(entry) as Weapon;
      const isTwoHanded = details?.properties?.includes('2H');
      
      // 获取当前已装备的武器 ID（按顺序对应主手、副手）
      // 我们假设存储在 equippedWeaponIds 的前两项是有意义的手位
      let currentWeapons = [...(character.equippedWeaponIds || [])];
      let mainHand: string | undefined = currentWeapons[0];
      let offHand: string | undefined = currentWeapons[1];

      if (hand === 'main') {
        if (mainHand === itemId) {
          mainHand = undefined;
        } else {
          mainHand = itemId;
          // 如果换上的是双手武器，自动卸下副手
          if (isTwoHanded) {
            offHand = undefined;
          }
          // 如果主手之前在副手位置，先从副手移除
          if (offHand === itemId) offHand = undefined;
        }
      } else if (hand === 'off') {
        if (offHand === itemId) {
          offHand = undefined;
        } else {
          // 检查主手是否为双手武器
          const mainItem = currentInventory.find(e => e.id === mainHand);
          const mainDetails = mainItem ? getItemDetails(mainItem) as Weapon : null;
          if (mainDetails?.properties?.includes('2H')) {
            return; // 无法装备副手
          }
          offHand = itemId;
          // 如果副手之前在主手位置，先从主手移除
          if (mainHand === itemId) mainHand = undefined;
        }
      }

      updates.equippedWeaponIds = [mainHand, offHand].filter((id): id is string => !!id);
    } else if (entry.category === 'armor') {
      updates.equippedArmorId = character.equippedArmorId === itemId ? undefined : itemId;
    } else if (entry.category === 'shield') {
      updates.equippedShieldId = character.equippedShieldId === itemId ? undefined : itemId;
    }
    
    updateActiveCharacter(updates);
  };

  const toggleVersatile = (entryId: string, isTwoHanded: boolean) => {
    if (!character) return;
    const updatedEntries = character.inventoryEntries.map(e => 
      e.id === entryId ? { ...e, versatileTwoHanded: isTwoHanded } : e
    );
    updateActiveCharacter({ inventoryEntries: updatedEntries });
  };

  const handleUnpack = (entry: InventoryEntry) => {
    if (!character) return;
    const details = getItemDetails(entry) as any;
    if (!details?.contentsDetailed) return;

    // 创建新条目
    const newEntries: InventoryEntry[] = details.contentsDetailed.map((sub: any) => ({
      id: `${sub.id || 'item'}-${Math.random().toString(36).substr(2, 9)}`,
      name: sub.name,
      quantity: sub.quantity || 1,
      itemId: sub.id,
      category: 'gear', // 套组内的通常是杂物
      source: `来自套组: ${entry.name}`,
      weight: findItemById(sub.id)?.weight || '---'
    }));

    // 移除旧套组并添加新单品
    const updated = [
      ...character.inventoryEntries.filter(e => e.id !== entry.id),
      ...newEntries
    ];
    updateActiveCharacter({ inventoryEntries: updated });
  };

  const handleSplit = (entry: InventoryEntry) => {
    if (!character || (entry.quantity || 1) <= 1) return;
    
    // 更新原条目数量
    const updatedEntries = character.inventoryEntries.map(e => {
      if (e.id === entry.id) {
        return { ...e, quantity: (e.quantity || 1) - 1 };
      }
      return e;
    });

    // 创建新条目 (数量为1)
    const newEntry: InventoryEntry = {
      ...entry,
      id: `${entry.itemId}-${Math.random().toString(36).substr(2, 9)}`,
      quantity: 1,
      // 新拆分出的物品默认不装备
      versatileTwoHanded: entry.versatileTwoHanded
    };

    updateActiveCharacter({ inventoryEntries: [...updatedEntries, newEntry] });
  };

  const inventoryGroups = useMemo(() => {
    if (!character) return {};
    
    const groups: Record<string, InventoryEntry[]> = {
      'magic': [],
      'weapon': [],
      'protection': [],
      'tool': [],
      'gear': [],
      'consumable': [],
      'other': []
    };

    character.inventoryEntries.forEach(entry => {
      if (entry.category === 'spell' || entry.notes?.includes('魔法')) groups.magic.push(entry);
      else if (entry.category === 'weapon') groups.weapon.push(entry);
      else if (entry.category === 'armor' || entry.category === 'shield') groups.protection.push(entry);
      else if (ALL_TOOLS.some(t => t === entry.itemId || translateProficiency(t) === entry.name)) groups.tool.push(entry);
      else if (entry.tags?.includes('弹药') || entry.tags?.includes('药剂') || entry.tags?.includes('卷轴')) groups.consumable.push(entry);
      else if (entry.category === 'gear') groups.gear.push(entry);
      else groups.other.push(entry);
    });

    return groups;
  }, [character?.inventoryEntries]);

  const groupConfigs = [
    { id: 'magic', label: '魔法物品', icon: <Sparkles size={18} color="#9333ea" /> },
    { id: 'weapon', label: '武器', icon: <Sword size={18} /> },
    { id: 'protection', label: '护甲与盾牌', icon: <ShieldIcon size={18} /> },
    { id: 'tool', label: '工具', icon: <Hammer size={18} /> },
    { id: 'gear', label: '冒险道具', icon: <Package size={18} /> },
    { id: 'consumable', label: '消耗品', icon: <FlaskConical size={18} /> },
    { id: 'other', label: '其他', icon: <Box size={18} /> },
  ];

  const armorOptions = getCatalogItems().filter((item: any) => item.armorCategory && item.armorCategory !== 'Shield') as Armor[];
  const shieldOptions = getCatalogItems().filter((item: any) => item.armorCategory === 'Shield') as Armor[];

  const totalLevel = useMemo(() => character?.classes?.reduce((sum, c) => sum + (c.level || 0), 0) || 0, [character?.classes]);

  const higherLevelGoldConfig = useMemo(() => {
    if (totalLevel <= 4) return null;
    if (totalLevel <= 10) return { base: 500, multiplier: 25, magic: '1件不常见魔法物品' };
    if (totalLevel <= 16) return { base: 5000, multiplier: 250, magic: '2件不常见魔法物品' };
    return { base: 20000, multiplier: 2500, magic: '2件不常见魔法物品, 1件稀有魔法物品' };
  }, [totalLevel]);

  const handleRollHigherLevelGold = () => {
    if (!character || !higherLevelGoldConfig || character.higherLevelGoldRolled) return;

    const d10 = Math.floor(Math.random() * 10) + 1;
    const additional = d10 * higherLevelGoldConfig.multiplier;
    const totalGP = higherLevelGoldConfig.base + additional;

    updateActiveCharacter({
      higherLevelGoldRolled: true,
      higherLevelGoldAmount: totalGP,
      higherLevelGoldApplied: false
    });
  };

  const handleApplyHigherLevelGold = () => {
    if (!character || !character.higherLevelGoldAmount || character.higherLevelGoldApplied) return;

    if (window.confirm(`确定要将 ${character.higherLevelGoldAmount} GP 补偿金直接加入行囊（钱包）吗？此操作不可撤销。`)) {
      updateActiveCharacter({
        higherLevelGoldApplied: true,
        currency: {
          ...character.currency,
          gp: character.currency.gp + character.higherLevelGoldAmount
        }
      });
    }
  };

  if (!character) return <div className="page-container">加载中...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div>
          <h2 className={styles.title}>装备配置</h2>
          <p className={styles.subtitle}>统合背景与职业的起始装备，并支持高等级金币补偿与商店购买。</p>
        </div>
      </div>

      <div className={styles.content} style={{ gridTemplateColumns: '380px 1fr' }}>
        {/* 左侧：选择面板 */}
        <div className={styles.list} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* 背景选择区块 */}
          <section>
            <h4 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ opacity: 0.5 }}>01</span> 背景起始装备
            </h4>
            {(() => {
              const bgChoice = character.backgroundSelections?.[`bg:${background?.id}:equipment`]?.[0] || 'choiceA';
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <EquipmentOptionCard
                    title="方案 A：起始装备"
                    selected={bgChoice === 'choiceA'}
                    onClick={() => applyEquipmentState({ backgroundMode: 'choiceA' })}
                  />
                  <EquipmentOptionCard
                    title="方案 B：起始金币"
                    selected={bgChoice === 'choiceB'}
                    onClick={() => applyEquipmentState({ backgroundMode: 'choiceB' })}
                  />
                </div>
              );
            })()}
          </section>

          {/* 职业选择区块 */}
          <section>
            <h4 style={{ marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ opacity: 0.5 }}>02</span> 职业起始装备
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <EquipmentOptionCard
                title="方案 A：职业套组"
                description={Array.isArray(primaryClass?.startingEquipment.choiceA) 
                  ? primaryClass.startingEquipment.choiceA.map(i => typeof i === 'string' ? i : '可选项目').join(', ') 
                  : undefined}
                selected={(character.equipmentChoiceMode ?? 'package') === 'package'}
                onClick={() => applyEquipmentState({ classMode: 'package' })}
              />
              <EquipmentOptionCard
                title={primaryClass?.startingEquipment.choiceB?.includes('GP') && !primaryClass?.startingEquipment.choiceB?.includes('，') ? "方案 B：起始金币" : "方案 B：职业套组"}
                description={primaryClass?.startingEquipment.choiceB}
                selected={character.equipmentChoiceMode === 'gold'}
                onClick={() => applyEquipmentState({ classMode: 'gold' })}
              />
              {primaryClass?.startingEquipment.choiceC && (
                <EquipmentOptionCard
                  title={primaryClass.startingEquipment.choiceC.endsWith('GP') ? "方案 C：起始金币" : "方案 C：特选方案"}
                  description={primaryClass.startingEquipment.choiceC}
                  selected={character.equipmentChoiceMode === 'choiceC'}
                  onClick={() => applyEquipmentState({ classMode: 'choiceC' })}
                />
              )}
            </div>

            {/* 如果选择了职业套组，展示具体子方案 */}
            {(character.equipmentChoiceMode ?? 'package') === 'package' && classPackageOptions.length > 1 && (
              <div style={{ marginTop: 16, padding: '12px', background: 'rgba(0,0,0,0.03)', borderRadius: '12px' }}>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: 8, opacity: 0.7 }}>选择具体套组内容：</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {classPackageOptions.map((option) => {
                    const isSelected = selectedPackage === option;
                    return (
                      <div 
                        key={option}
                        onClick={() => applyEquipmentState({ classPackage: option })}
                        style={{
                          padding: '10px 14px',
                          borderRadius: '10px',
                          fontSize: '0.85rem',
                          fontWeight: isSelected ? '600' : 'normal',
                          background: isSelected ? 'rgba(197, 160, 89, 0.1)' : 'white',
                          color: isSelected ? 'var(--color-gold-accent)' : 'var(--color-text-primary)',
                          cursor: 'pointer',
                          border: isSelected ? '2px solid #0071e3' : '1px solid #e5e5e7',
                          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          transform: isSelected ? 'scale(1.01)' : 'scale(1)',
                          boxShadow: isSelected ? '0 4px 12px rgba(0, 113, 227, 0.1)' : 'none'
                        }}
                      >
                        <div style={{
                          width: '14px',
                          height: '14px',
                          borderRadius: '50%',
                          border: isSelected ? '1.5px solid #0071e3' : '1.5px solid #d2d2d7',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'white'
                        }}>
                          {isSelected && <div style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: 'var(--color-gold-accent)' }} />}
                        </div>
                        {option}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </section>

          {/* 高等级金币补偿 */}
          {higherLevelGoldConfig && (
            <section style={{ 
              padding: '20px', 
              background: 'linear-gradient(135deg, #FFF9C4 0%, #FFF59D 100%)', 
              borderRadius: '16px',
              border: '1px solid rgba(251, 192, 45, 0.3)',
              boxShadow: '0 4px 12px rgba(251, 192, 45, 0.1)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <Coins size={20} color="#F57F17" />
                <h4 style={{ margin: 0, color: '#F57F17' }}>高等级起始补偿</h4>
              </div>
              
              <div style={{ fontSize: '0.85rem', color: '#795548', lineHeight: 1.5, marginBottom: 16 }}>
                检测到角色等级为 <strong>{totalLevel} 级</strong>。根据规则，您可以获得：
                <ul style={{ margin: '8px 0', paddingLeft: '20px' }}>
                  <li>基础金币: {higherLevelGoldConfig.base} GP</li>
                  <li>额外金币: 1d10 × {higherLevelGoldConfig.multiplier} GP</li>
                  <li style={{ opacity: 0.6 }}>魔法物品: {higherLevelGoldConfig.magic} (预留)</li>
                </ul>
              </div>

              {character.higherLevelGoldRolled ? (
                <div style={{ 
                  background: 'var(--color-bg-surface-elevated)',
                  padding: '16px', 
                  borderRadius: '12px', 
                  textAlign: 'center',
                  border: (character.higherLevelGoldApplied || (character.higherLevelGoldRolled && character.higherLevelGoldApplied === undefined)) ? '1px solid #F57F17' : '1px dashed #F57F17'
                }}>
                  <div style={{ fontSize: '0.75rem', opacity: 0.6, marginBottom: 4 }}>
                    {(character.higherLevelGoldApplied || (character.higherLevelGoldRolled && character.higherLevelGoldApplied === undefined)) ? '已领取补偿金额' : '待领取补偿金额'}
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#F57F17', marginBottom: (character.higherLevelGoldApplied || (character.higherLevelGoldRolled && character.higherLevelGoldApplied === undefined)) ? 0 : 12 }}>
                    + {character.higherLevelGoldAmount} GP
                  </div>
                  
                  {!(character.higherLevelGoldApplied || (character.higherLevelGoldRolled && character.higherLevelGoldApplied === undefined)) && (
                    <button 
                      onClick={handleApplyHigherLevelGold}
                      style={{
                        width: '100%',
                        padding: '8px',
                        borderRadius: '8px',
                        background: '#F57F17',
                        color: 'white',
                        border: 'none',
                        fontWeight: 'bold',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6,
                        fontSize: '0.9rem'
                      }}
                    >
                      <ShoppingCart size={16} />
                      直接加入背包
                    </button>
                  )}
                </div>
              ) : (
                <button 
                  onClick={handleRollHigherLevelGold}
                  style={{
                    width: '100%',
                    padding: '12px',
                    borderRadius: '12px',
                    background: '#F57F17',
                    color: 'white',
                    border: 'none',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                    boxShadow: '0 4px 10px rgba(245, 127, 23, 0.2)'
                  }}
                >
                  <Dice5 size={18} />
                  立即掷骰领金币
                </button>
              )}
            </section>
          )}

          {/* 货币总览 */}
          <section style={{ marginTop: 'auto', padding: '20px', background: 'var(--color-bg-dark)', color: 'white', borderRadius: '16px' }}>
            <h4 style={{ marginBottom: 16, fontSize: '1rem' }}>当前资产总览</h4>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              {['pp', 'gp', 'ep', 'sp', 'cp'].map((key) => (
                <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>{key.toUpperCase()}</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>{character.currency[key as keyof typeof character.currency]}</span>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 16, paddingTop: 16, borderTop: '1px solid rgba(255,255,255,0.1)', fontSize: '0.85rem', textAlign: 'center' }}>
              折合金币: {(totalInCP(character.currency) / 100).toFixed(2)} GP
            </div>
          </section>
        </div>

        {/* 右侧：详细内容面板 (分类库存视图 / 商店) */}
        <div className={styles.detailsPanel} style={{ background: 'var(--color-bg-dark)', borderRadius: '24px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          
          {/* 选项卡切换 */}
          <div style={{ display: 'flex', borderBottom: '1px solid rgba(0,0,0,0.05)' }}>
            <button 
              onClick={() => setActiveTab('inventory')}
              style={{
                flex: 1,
                padding: '16px',
                border: 'none',
                background: activeTab === 'inventory' ? 'white' : 'rgba(0,0,0,0.02)',
                color: activeTab === 'inventory' ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
                fontWeight: 'bold',
                cursor: 'pointer',
                borderBottom: activeTab === 'inventory' ? '3px solid var(--color-primary)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              <Package size={18} />
              我的库存
            </button>
            <button 
              onClick={() => setActiveTab('shop')}
              style={{
                flex: 1,
                padding: '16px',
                border: 'none',
                background: activeTab === 'shop' ? 'white' : 'rgba(0,0,0,0.02)',
                color: activeTab === 'shop' ? 'var(--color-primary)' : 'var(--color-text-tertiary)',
                fontWeight: 'bold',
                cursor: 'pointer',
                borderBottom: activeTab === 'shop' ? '3px solid var(--color-primary)' : 'none',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8
              }}
            >
              <ShoppingCart size={18} />
              铁匠铺与杂货店
            </button>
          </div>

          <div className={styles.detailsContent} style={{ flex: 1, padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            {activeTab === 'inventory' ? (
              <>
                <div style={{ padding: '24px 32px', borderBottom: '1px solid rgba(0,0,0,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 className={styles.detailsTitle} style={{ margin: 0 }}>当前库存清单</h3>
                  <div style={{ fontSize: '0.85rem', color: 'var(--color-text-tertiary)' }}>
                    总重: {character.inventoryEntries.reduce((acc, entry) => {
                      const w = parseFloat(entry.weight || '0');
                      return acc + (isNaN(w) ? 0 : w * (entry.quantity || 1));
                    }, 0).toFixed(1)} 磅
                  </div>
                </div>

                <div style={{ overflowY: 'auto', flex: 1, padding: '0 0 32px 0' }}>
                  {groupConfigs.map(group => {
                    const items = inventoryGroups[group.id] || [];
                    if (items.length === 0) return null;

                    return (
                      <div key={group.id} style={{ marginTop: 24 }}>
                        <div style={{ 
                          padding: '12px 32px 12px 32px', 
                          display: 'flex', 
                          alignItems: 'center', 
                          gap: 12, 
                          color: '#2563eb', // 更鲜艳的蓝色
                          fontSize: '1rem', // 稍微变大
                          fontWeight: '800', // 更粗
                          textTransform: 'uppercase',
                          letterSpacing: '0.08em',
                          background: 'linear-gradient(to right, rgba(37, 99, 235, 0.08), transparent)', // 增加渐变背景增强层次感
                          borderLeft: '4px solid #2563eb', // 增加侧边条
                          marginBottom: '4px'
                        }}>
                          {group.icon}
                          {group.label}
                          <span style={{ marginLeft: 'auto', opacity: 0.5, fontWeight: 'normal' }}>{items.length} 件</span>
                        </div>
                        <div style={{ borderTop: '1px solid rgba(0,0,0,0.05)' }}>
                          {items.map(entry => {
                            const isMainHand = character.equippedWeaponIds?.[0] === entry.id;
                            const isOffHand = character.equippedWeaponIds?.[1] === entry.id;
                            const isArmorEquipped = character.equippedArmorId === entry.id;
                            const isShieldEquipped = character.equippedShieldId === entry.id;
                            const isEquipped = isMainHand || isOffHand || isArmorEquipped || isShieldEquipped;
                            const details = getItemDetails(entry);
                            const isWeapon = entry.category === 'weapon';
                            const weaponDetails = isWeapon ? (details as Weapon) : null;
                            const armorDetails = (isArmorEquipped || isShieldEquipped) ? (details as Armor) : null;
                            
                            const isDualWielder = character.selectedFeats.some(f => f.featId === 'dual-wielder-xphb');
                            
                            // 检查轻型组合限制
                            const mainItemId = character.equippedWeaponIds?.[0];
                            const offItemId = character.equippedWeaponIds?.[1];
                            const mainItem = character.inventoryEntries.find(e => e.id === mainItemId);
                            const offItem = character.inventoryEntries.find(e => e.id === offItemId);
                            const mainDetails = mainItem ? getItemDetails(mainItem) as Weapon : null;
                            const offDetails = offItem ? getItemDetails(offItem) as Weapon : null;
                            
                            const isLightComboRestricted = !isDualWielder && 
                              (character.equippedWeaponIds?.length || 0) === 2 && 
                              (!mainDetails?.properties?.includes('L') || !offDetails?.properties?.includes('L'));

                            // 护甲受训提示
                            const isProficient = !armorDetails || isProficientWithArmor(character, armorDetails);

                            return (
                              <div key={entry.id}>
                                <InventoryItemRow 
                                  entry={entry} 
                                  character={character}
                                  isMainHand={isMainHand}
                                  isOffHand={isOffHand}
                                  isEquipped={isEquipped}
                                  onToggleMainHand={() => upsertEquippedItem(entry, 'main')}
                                  onToggleOffHand={() => upsertEquippedItem(entry, 'off')}
                                  onToggleEquip={() => upsertEquippedItem(entry)}
                                  onToggleVersatile={(val) => toggleVersatile(entry.id, val)}
                                  onUnpack={() => handleUnpack(entry)}
                                  onSplit={() => handleSplit(entry)}
                                />
                                {isLightComboRestricted && entry.category === 'weapon' && (isMainHand || isOffHand) && (
                                  <div style={{ fontSize: '0.7rem', color: '#ef4444', padding: '4px 32px', background: '#fef2f2', borderBottom: '1px solid rgba(239, 68, 68, 0.1)' }}>
                                    ⚠️ 非轻型双持：由于缺乏“双持客”专长且主/副手不全为轻型，你无法使用附赠动作发动额外攻击。
                                  </div>
                                )}
                                {!isProficient && (isArmorEquipped || isShieldEquipped) && (
                                  <div style={{ fontSize: '0.7rem', color: '#ef4444', padding: '4px 32px', background: '#fef2f2', borderBottom: '1px solid rgba(239, 68, 68, 0.1)' }}>
                                    ⚠️ 未受训警告：你未获得此护甲/盾牌的受训，D20 力量/敏捷检定将具有劣势，且无法施法。{isShieldEquipped && '你无法获得其 AC 增益。'}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}

                  {character.inventoryEntries.length === 0 && (
                    <div style={{ padding: '80px 32px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                      <Package size={48} style={{ marginBottom: 16, opacity: 0.2 }} />
                      <p>当前库存为空，请在左侧选择起始方案。</p>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div style={{ padding: '0', borderBottom: '1px solid rgba(0,0,0,0.05)', background: '#f8fafc' }}>
                  <div style={{ 
                    display: 'flex', 
                    overflowX: 'auto', 
                    padding: '12px 24px', 
                    gap: 8,
                    scrollbarWidth: 'none', // 隐藏滚动条
                    msOverflowStyle: 'none'
                  }}>
                    {[
                      { id: 'all', label: '全部', icon: <Box size={16} /> },
                      { id: 'weapon', label: '武器', icon: <Sword size={16} /> },
                      { id: 'armor', label: '护甲与盾牌', icon: <ShieldIcon size={16} /> },
                      { id: 'tool', label: '工具', icon: <Hammer size={16} /> },
                      { id: 'gear', label: '冒险物品', icon: <FlaskConical size={16} /> },
                      { id: 'vehicle', label: '坐骑载具', icon: <Dice5 size={16} /> },
                      { id: 'other', label: '其他', icon: <Box size={16} /> }
                    ].map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => setShopCategory(cat.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '10px 18px',
                          borderRadius: '12px',
                          border: 'none',
                          background: shopCategory === cat.id ? '#2563eb' : 'white',
                          color: shopCategory === cat.id ? 'white' : '#64748b',
                          fontSize: '0.85rem',
                          fontWeight: 'bold',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          boxShadow: shopCategory === cat.id ? '0 4px 12px rgba(37, 99, 235, 0.2)' : '0 2px 4px rgba(0,0,0,0.02)',
                          transition: 'all 0.2s'
                        }}
                      >
                        {cat.icon}
                        {cat.label}
                      </button>
                    ))}
                  </div>

                  {/* 武器子筛选栏 - 仅在选择武器分类时显示 */}
                  {shopCategory === 'weapon' && (
                    <div style={{ 
                      padding: '0 24px 16px 24px', 
                      display: 'flex', 
                      flexDirection: 'column', 
                      gap: 12,
                      animation: 'fadeIn 0.2s ease-out' 
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold', width: 40 }}>类别:</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {[
                            { id: 'all', label: '全部' },
                            { id: 'Simple', label: '简易武器' },
                            { id: 'Martial', label: '军用武器' }
                          ].map(t => (
                            <button
                              key={t.id}
                              onClick={() => setWeaponTypeFilter(t.id as any)}
                              style={{
                                padding: '4px 12px',
                                borderRadius: '8px',
                                border: '1px solid',
                                borderColor: weaponTypeFilter === t.id ? '#2563eb' : '#e2e8f0',
                                background: weaponTypeFilter === t.id ? '#eff6ff' : 'white',
                                color: weaponTypeFilter === t.id ? '#2563eb' : '#64748b',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                            >
                              {t.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontWeight: 'bold', width: 40 }}>距离:</span>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {[
                            { id: 'all', label: '全部' },
                            { id: 'Melee', label: '近战' },
                            { id: 'Ranged', label: '远程' }
                          ].map(r => (
                            <button
                              key={r.id}
                              onClick={() => setWeaponRangeFilter(r.id as any)}
                              style={{
                                padding: '4px 12px',
                                borderRadius: '8px',
                                border: '1px solid',
                                borderColor: weaponRangeFilter === r.id ? '#2563eb' : '#e2e8f0',
                                background: weaponRangeFilter === r.id ? '#eff6ff' : 'white',
                                color: weaponRangeFilter === r.id ? '#2563eb' : '#64748b',
                                fontSize: '0.75rem',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                            >
                              {r.label}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: '#1e40af', background: '#eff6ff', padding: '10px 32px', borderTop: '1px solid #dbeafe' }}>
                    <Info size={14} />
                    <span>商店包含所有核心规则书中的装备，购买将自动处理金币找零。</span>
                  </div>
                </div>

                <div style={{ overflowY: 'auto', flex: 1, paddingBottom: 32 }}>
                  {shopItems.length > 0 ? (
                    shopItems.map(item => (
                      <ShopItemRow 
                        key={item.id} 
                        item={item} 
                        canAfford={totalInCP(character.currency) >= parsePriceToCP(item.cost || '')}
                        onBuy={() => handleBuyItem(item)}
                      />
                    ))
                  ) : (
                    <div style={{ padding: '80px 32px', textAlign: 'center', color: 'var(--color-text-tertiary)' }}>
                      <Search size={48} style={{ marginBottom: 16, opacity: 0.2 }} />
                      <p>未找到匹配的装备。</p>
                    </div>
                  )}

                  {/* 魔法物品占位区域 */}
                  <div style={{ margin: '32px', padding: '24px', borderRadius: '16px', background: 'linear-gradient(135deg, #f3e8ff 0%, #e9d5ff 100%)', border: '1px solid #d8b4fe', textAlign: 'center' }}>
                    <Wand2 size={32} color="#9333ea" style={{ marginBottom: 12 }} />
                    <h4 style={{ margin: '0 0 8px 0', color: '#7e22ce' }}>寻找魔法物品？</h4>
                    <p style={{ fontSize: '0.85rem', color: '#9333ea', margin: 0, opacity: 0.8 }}>
                      魔法物品库正在构建中。如有需求，请咨询您的 DM 并手动添加。
                    </p>
                    <button 
                      disabled
                      style={{ 
                        marginTop: 16, 
                        padding: '8px 20px', 
                        borderRadius: '999px', 
                        border: 'none', 
                        background: '#9333ea', 
                        color: 'white', 
                        fontSize: '0.8rem', 
                        fontWeight: 'bold',
                        opacity: 0.5,
                        cursor: 'not-allowed'
                      }}
                    >
                      即将开放
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
