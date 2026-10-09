import React, { useState, useMemo } from 'react';
import styles from '../../sheet.module.css';
import { findItemById, getAttunementStatus, isProficientWithArmor } from '@/engine/characterData';
import { getCatalogItems, isMagicItemDefinition } from '@/catalog';
import { useCatalog } from '@/platform/CatalogProvider';
import type { Armor } from '@/types/equipment';
import { CharacterState, InventoryEntry } from '@/types/characterState';
import {
  Search,
  Plus,
  X,
  Settings,
  FlaskConical,
  Wand2,
  Coins,
  Truck,
  ChevronRight,
} from 'lucide-react';
import PillButton from '@/components/PillButton';

import ItemDetailContent from '@/components/ItemDetailContent';

interface InventoryTabProps {
  character: CharacterState;
  updateActiveCharacter: (data: Partial<CharacterState>) => void;
  isEditMode: boolean;
}

const InventoryTab: React.FC<InventoryTabProps> = ({
  character,
  updateActiveCharacter,
  isEditMode,
}) => {
  const { status: catalogStatus } = useCatalog();
  const catalogItems = useMemo(() => getCatalogItems(), [catalogStatus]);
  const inventory = (character.inventoryEntries || []).filter(
    (e: InventoryEntry) => e.category !== 'package',
  );
  const attunedIds = character.attunedItemIds || [];
  const attunement = getAttunementStatus(character);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Search state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchCategory, setSearchCategory] = useState<string>('all');
  const [isMagicOnly, setIsMagicOnly] = useState(false);

  // Container state
  const [activeContainerId, setActiveContainerId] = useState<string>('player');
  const [isContainerModalOpen, setIsContainerModalOpen] = useState(false);

  // Update state helper
  const syncEquipment = (newInventory: InventoryEntry[]) => {
    const armor = newInventory.find((e) => e.equipped && e.category === 'armor')?.id || undefined;
    const shield = newInventory.find((e) => e.equipped && e.category === 'shield')?.id || undefined;
    const weapons = newInventory
      .filter((e) => e.equipped && e.category === 'weapon')
      .map((e) => e.id);

    return {
      inventoryEntries: newInventory,
      equippedArmorId: armor,
      equippedShieldId: shield,
      equippedWeaponIds: weapons,
    };
  };

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const updateQuantity = (id: string, delta: number) => {
    if (!isEditMode) return;
    const updated = character.inventoryEntries.map((e) => {
      if (e.id === id) {
        const newQty = Math.max(0, (e.quantity || 1) + delta);
        return { ...e, quantity: newQty };
      }
      return e;
    });
    updateActiveCharacter({ inventoryEntries: updated });
  };

  const toggleHand = (id: string, hand: 'main' | 'off') => {
    if (!isEditMode) return;
    const entry = character.inventoryEntries.find((e) => e.id === id);
    if (!entry || entry.category !== 'weapon') return;

    const subDef = findItemById(entry.itemId) as any;
    const isTwoHanded = subDef?.properties?.includes('2H');

    let currentWeapons = [...(character.equippedWeaponIds || [])];
    let mainHand: string | undefined = currentWeapons[0];
    let offHand: string | undefined = currentWeapons[1];

    if (hand === 'main') {
      if (mainHand === id) {
        mainHand = undefined;
      } else {
        mainHand = id;
        if (isTwoHanded) offHand = undefined;
        if (offHand === id) offHand = undefined;
      }
    } else {
      if (offHand === id) {
        offHand = undefined;
      } else {
        // Check if main hand is two-handed
        const mainEntry = character.inventoryEntries.find((e) => e.id === mainHand);
        const mainDef = findItemById(mainEntry?.itemId) as any;
        if (mainDef?.properties?.includes('2H')) return;

        offHand = id;
        if (mainHand === id) mainHand = undefined;
      }
    }

    const nextWeapons = [mainHand, offHand].filter((wid): wid is string => !!wid);
    const nextEntries = character.inventoryEntries.map((e) => ({
      ...e,
      equipped:
        nextWeapons.includes(e.id) ||
        e.id === character.equippedArmorId ||
        e.id === character.equippedShieldId,
    }));
    updateActiveCharacter({
      equippedWeaponIds: nextWeapons,
      inventoryEntries: nextEntries,
    });
  };

  const addItemToInventory = (item: any) => {
    if (!isEditMode) return;

    // Check if item already exists in the TARGET container to increment quantity
    const existingIndex = isMagicItemDefinition(item)
      ? -1
      : character.inventoryEntries.findIndex(
          (e) => e.itemId === item.id && (e.locationId || 'player') === activeContainerId,
        );

    if (existingIndex > -1) {
      const updated = character.inventoryEntries.map((e, i) =>
        i === existingIndex ? { ...e, quantity: (e.quantity || 1) + 1 } : e,
      );
      updateActiveCharacter({ inventoryEntries: updated });
    } else {
      const newEntry: InventoryEntry = {
        id: `${item.id}-${Math.random().toString(36).substr(2, 9)}`,
        name: item.name,
        quantity: 1,
        itemId: item.id,
        category:
          item.category || (item.weaponCategory ? 'weapon' : item.armorCategory ? 'armor' : 'gear'),
        source: item.source,
        weight: item.weight || '---',
        locationId: activeContainerId,
      };
      updateActiveCharacter({ inventoryEntries: [...character.inventoryEntries, newEntry] });
    }
  };

  const addContainer = (item: any) => {
    if (!isEditMode) return;
    const newContainer = {
      id: `container-${Math.random().toString(36).substr(2, 9)}`,
      name: item.name,
      itemId: item.id,
      type: item.category === 'vehicle' ? 'vehicle' : ('mount' as any),
    };
    updateActiveCharacter({
      containers: [...(character.containers || []), newContainer],
    });
    setIsSearchOpen(false);
  };

  const removeContainer = (id: string) => {
    if (!isEditMode) return;
    // Move all items back to player first
    const updatedEntries = character.inventoryEntries.map((e) =>
      e.locationId === id ? { ...e, locationId: 'player' } : e,
    );
    const updatedContainers = (character.containers || []).filter((c) => c.id !== id);
    updateActiveCharacter({
      inventoryEntries: updatedEntries,
      containers: updatedContainers,
    });
    if (activeContainerId === id) setActiveContainerId('player');
  };

  const updateContainer = (id: string, data: Partial<any>) => {
    if (!isEditMode) return;
    const updated = (character.containers || []).map((c) => (c.id === id ? { ...c, ...data } : c));
    updateActiveCharacter({ containers: updated });
  };

  const toggleEquip = (id: string) => {
    if (!isEditMode) return;
    const entry = inventory.find((e) => e.id === id);
    if (!entry) return;

    const updated = character.inventoryEntries.map((e) => {
      if (e.id === id) {
        return { ...e, equipped: !e.equipped };
      }
      // Exclusive logic for armor/shield
      if (
        (entry.category === 'armor' && e.category === 'armor' && e.id !== id) ||
        (entry.category === 'shield' && e.category === 'shield' && e.id !== id)
      ) {
        return { ...e, equipped: false };
      }
      return e;
    });

    updateActiveCharacter(syncEquipment(updated));
  };

  const toggleAttune = (id: string) => {
    if (!isEditMode) return;
    const isAttuned = attunedIds.includes(id);
    let nextIds = [...attunedIds];
    if (isAttuned) {
      nextIds = attunedIds.filter((aid) => aid !== id);
    } else {
      if (attunement.count >= attunement.limit) return;
      nextIds = [...attunedIds, id];
    }
    updateActiveCharacter({ attunedItemIds: nextIds });
  };

  const toggleVersatile = (id: string, val: boolean) => {
    if (!isEditMode) return;
    const updated = character.inventoryEntries.map((e) =>
      e.id === id ? { ...e, versatileTwoHanded: val } : e,
    );
    updateActiveCharacter({ inventoryEntries: updated });
  };

  const removeItem = (id: string) => {
    if (!isEditMode) return;
    const updated = character.inventoryEntries.filter((e) => e.id !== id);
    updateActiveCharacter({
      ...syncEquipment(updated),
      attunedItemIds: attunedIds.filter((attunedId) => attunedId !== id),
    });
    if (expandedId === id) setExpandedId(null);
  };

  const unpackPackage = (entry: InventoryEntry, detailedItem: any) => {
    if (!isEditMode || !detailedItem?.contentsDetailed) return;

    const newEntries: InventoryEntry[] = detailedItem.contentsDetailed.map((sub: any) => {
      const subDef = findItemById(sub.id) as any;
      return {
        id: `${sub.id || 'item'}-${Math.random().toString(36).substr(2, 9)}`,
        name: sub.name,
        quantity: sub.quantity || 1,
        itemId: sub.id,
        category: subDef?.category || 'gear',
        source: `来自套组: ${entry.name}`,
        weight: subDef?.weight || '---',
      };
    });

    const updated = [...character.inventoryEntries.filter((e) => e.id !== entry.id), ...newEntries];
    updateActiveCharacter({ inventoryEntries: updated });
    setExpandedId(null);
  };

  const getCategoryLabel = (category?: string) => {
    switch (category) {
      case 'weapon':
        return '武器';
      case 'armor':
        return '护甲';
      case 'shield':
        return '盾牌';
      case 'gear':
        return '冒险物品';
      case 'tool':
        return '工具';
      case 'vehicle':
        return '载具';
      case 'currency':
        return '货币';
      default:
        return '其他';
    }
  };

  const getItemWeight = (entry: InventoryEntry): number => {
    const detailedItem = entry.itemId ? (findItemById(entry.itemId) as any) : null;
    if (detailedItem?.contentsDetailed) {
      return (
        detailedItem.contentsDetailed.reduce((sum: number, sub: any) => {
          const subDef = sub.id ? findItemById(sub.id) : null;
          const wStr = subDef?.weight || '0';
          const w = parseFloat(wStr.replace(/[^\d.]/g, '')) || 0;
          return sum + w * (sub.quantity || 1);
        }, 0) * (entry.quantity || 1)
      );
    }
    const wStr = entry.weight || '0';
    const w = parseFloat(wStr.replace(/[^\d.]/g, '')) || 0;
    return w * (entry.quantity || 1);
  };

  const inventoryContainers = useMemo(() => {
    const base = [
      {
        id: 'player',
        name: '个人背包',
        type: 'container',
        capacity: character.baseAbilityScores.str * 15,
      },
    ];
    const storedContainers = (character.containers || []).map((c) => {
      const detailed = c.itemId ? (findItemById(c.itemId) as any) : null;
      return {
        ...c,
        capacity: c.customCapacity || parseFloat(detailed?.containerCapacity || '0') || 0,
      };
    });
    return [...base, ...storedContainers];
  }, [character.containers, character.baseAbilityScores.str]);

  const currentInventory = (character.inventoryEntries || []).filter(
    (e: InventoryEntry) =>
      e.category !== 'package' && (e.locationId || 'player') === activeContainerId,
  );

  const moveItem = (id: string, targetLocationId: string) => {
    if (!isEditMode) return;
    const updated = character.inventoryEntries.map((e) =>
      e.id === id ? { ...e, locationId: targetLocationId } : e,
    );
    updateActiveCharacter({ inventoryEntries: updated });
  };

  const categorizedInventory = useMemo(() => {
    const groups = [
      { id: 'magic', label: '魔法物品', items: [] as InventoryEntry[] },
      { id: 'weapon', label: '武器', items: [] as InventoryEntry[] },
      { id: 'armor', label: '护甲与盾牌', items: [] as InventoryEntry[] },
      { id: 'tool', label: '工具', items: [] as InventoryEntry[] },
      { id: 'vehicle', label: '载具与坐骑', items: [] as InventoryEntry[] },
      { id: 'gear', label: '冒险物品', items: [] as InventoryEntry[] },
    ];

    currentInventory.forEach((entry) => {
      const detailedItem = entry.itemId ? findItemById(entry.itemId) : undefined;
      const isMagic = isMagicItemDefinition(detailedItem);
      if (isMagic) groups[0].items.push(entry);
      else if (entry.category === 'weapon') groups[1].items.push(entry);
      else if (entry.category === 'armor' || entry.category === 'shield')
        groups[2].items.push(entry);
      else if (entry.category === 'tool') groups[3].items.push(entry);
      else if (entry.category === 'vehicle') groups[4].items.push(entry);
      else groups[5].items.push(entry);
    });

    return groups.filter((g) => g.items.length > 0);
  }, [currentInventory]);

  const weightStats = useMemo(() => {
    const encMode = character.encumbranceMode || 'standard';

    // 1. Items Weight for the SPECIFIC container being viewed
    let totalItemsWeight = 0;
    (character.inventoryEntries || []).forEach((e) => {
      if ((e.locationId || 'player') === activeContainerId) {
        const w = getItemWeight(e);
        totalItemsWeight += w;
      }
    });

    // 2. Currency Weight (only if viewing player and mode is full)
    let currencyWeight = 0;
    if (activeContainerId === 'player' && encMode === 'full') {
      const totalCoins =
        (character.currency.pp || 0) +
        (character.currency.gp || 0) +
        (character.currency.ep || 0) +
        (character.currency.sp || 0) +
        (character.currency.cp || 0);
      currencyWeight = totalCoins / 50;
    }

    const currentContainer = inventoryContainers.find((c) => c.id === activeContainerId);
    const capacity = currentContainer?.capacity || character.baseAbilityScores.str * 15;
    const strength = character.baseAbilityScores.str;

    return {
      total: totalItemsWeight + currencyWeight,
      capacity: capacity,
      items: totalItemsWeight,
      currency: currencyWeight,
      mode: encMode,
      thresholds:
        activeContainerId === 'player'
          ? {
              encumbered: strength * 5,
              heavilyEncumbered: strength * 10,
            }
          : null,
    };
  }, [character, activeContainerId, inventoryContainers]);

  const renderItemRow = (entry: InventoryEntry) => {
    const isExpanded = expandedId === entry.id;
    const detailedItem = entry.itemId ? (findItemById(entry.itemId) as any) : null;
    const displayWeight = getItemWeight(entry);
    const isAttuned = attunedIds.includes(entry.id);
    const needsAttunement = Boolean(
      detailedItem?.requiresAttunement || entry.notes?.toLowerCase().includes('attunement'),
    );
    const canEquip =
      ['weapon', 'armor', 'shield'].includes(entry.category || '') || needsAttunement;

    const isMainHand = character.equippedWeaponIds?.[0] === entry.id;
    const isOffHand = character.equippedWeaponIds?.[1] === entry.id;
    const isTwoHanded = (findItemById(entry.itemId) as any)?.properties?.includes('2H');
    const isVersatile = (findItemById(entry.itemId) as any)?.properties?.some((p: string) =>
      p.startsWith('V'),
    );

    return (
      <div
        key={entry.id}
        className={`${styles.inventoryRow} ${isExpanded ? styles.rowExpanded : ''}`}
      >
        <div className={styles.rowMain} onClick={() => toggleExpand(entry.id)}>
          <div
            style={{
              flex: 2,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              overflow: 'hidden',
            }}
          >
            {entry.equipped && (
              <span style={{ color: 'var(--color-success)', fontSize: 16 }}>●</span>
            )}
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {entry.name}
            </span>
            <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
              {isMainHand && (
                <span
                  style={{
                    fontSize: 9,
                    background: 'var(--color-primary)',
                    color: 'white',
                    padding: '1px 6px',
                    borderRadius: 4,
                    fontWeight: 800,
                  }}
                >
                  主手
                </span>
              )}
              {isOffHand && (
                <span
                  style={{
                    fontSize: 9,
                    background: '#6366f1',
                    color: 'white',
                    padding: '1px 6px',
                    borderRadius: 4,
                    fontWeight: 800,
                  }}
                >
                  副手
                </span>
              )}
              {needsAttunement && (
                <span
                  className={styles.badge}
                  style={{
                    fontSize: 9,
                    padding: '1px 6px',
                    background: isAttuned ? 'var(--color-warning)' : 'rgba(0,0,0,0.05)',
                    color: isAttuned ? '#fff' : 'var(--color-text-tertiary)',
                    border: isAttuned ? 'none' : '1px solid var(--color-border-subtle)',
                  }}
                >
                  {isAttuned ? '已同调' : '需同调'}
                </span>
              )}
            </div>
          </div>
          <div
            style={{
              width: 50,
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
              fontSize: 13,
            }}
          >
            x{entry.quantity || 1}
          </div>
          <div
            style={{
              width: 50,
              textAlign: 'center',
              color: 'var(--color-text-tertiary)',
              fontSize: 11,
            }}
          >
            {displayWeight > 0 ? `${displayWeight.toFixed(1)}` : '-'}
          </div>
          <div
            style={{
              width: 140,
              textAlign: 'right',
              display: 'flex',
              gap: 4,
              justifyContent: 'flex-end',
              alignItems: 'center',
            }}
          >
            {entry.category === 'weapon' ? (
              <div
                style={{
                  display: 'flex',
                  background: 'rgba(0,0,0,0.05)',
                  padding: '2px',
                  borderRadius: '6px',
                  gap: 2,
                }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleHand(entry.id, 'main');
                  }}
                  style={{
                    padding: '2px 6px',
                    borderRadius: '4px',
                    fontSize: 9,
                    border: 'none',
                    background: isMainHand ? 'var(--color-primary)' : 'transparent',
                    color: isMainHand ? 'white' : 'var(--color-text-tertiary)',
                    cursor: isEditMode ? 'pointer' : 'default',
                    fontWeight: 800,
                  }}
                >
                  主
                </button>
                {!isTwoHanded && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleHand(entry.id, 'off');
                    }}
                    style={{
                      padding: '2px 6px',
                      borderRadius: '4px',
                      fontSize: 9,
                      border: 'none',
                      background: isOffHand ? '#6366f1' : 'transparent',
                      color: isOffHand ? 'white' : 'var(--color-text-tertiary)',
                      cursor: isEditMode ? 'pointer' : 'default',
                      fontWeight: 800,
                    }}
                  >
                    副
                  </button>
                )}
              </div>
            ) : canEquip ? (
              <button
                className={styles.actionButton}
                style={{
                  padding: '2px 8px',
                  fontSize: 10,
                  borderColor: entry.equipped ? 'var(--color-success)' : 'var(--color-primary)',
                  color: entry.equipped ? 'var(--color-success)' : 'var(--color-primary)',
                  background: entry.equipped ? 'rgba(52, 199, 89, 0.05)' : 'transparent',
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleEquip(entry.id);
                }}
              >
                {entry.equipped ? '卸下' : '装备'}
              </button>
            ) : null}
            <button
              className={styles.deleteButton}
              style={{ padding: '2px 8px', fontSize: 10, opacity: isEditMode ? 1 : 0.5 }}
              onClick={(e) => {
                e.stopPropagation();
                removeItem(entry.id);
              }}
            >
              移除
            </button>
          </div>
        </div>

        {isExpanded && (
          <div className={styles.rowDetail}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <ItemDetailContent item={detailedItem || entry} category={entry.category || ''} />

              {detailedItem?.contentsDetailed && (
                <div
                  style={{
                    marginTop: 4,
                    padding: '12px',
                    background: 'var(--color-bg-light)',
                    borderRadius: 8,
                    border: '1px solid var(--color-border-subtle)',
                  }}
                >
                  <div
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      color: 'var(--color-text-secondary)',
                      marginBottom: 10,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span>套组包含物品</span>
                    <button
                      className={styles.actionButton}
                      style={{ padding: '2px 8px', fontSize: 10 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        unpackPackage(entry, detailedItem);
                      }}
                    >
                      释放到清单
                    </button>
                  </div>
                  <div
                    style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '6px 12px' }}
                  >
                    {detailedItem.contentsDetailed.map((sub: any, idx: number) => (
                      <React.Fragment key={idx}>
                        <div
                          style={{
                            fontSize: 13,
                            color: 'var(--color-text-primary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                        >
                          <span style={{ color: 'var(--color-text-tertiary)' }}>•</span>
                          {sub.name}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: 'var(--color-text-tertiary)',
                            textAlign: 'right',
                          }}
                        >
                          <span style={{ color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                            x{sub.quantity || 1}
                          </span>
                          <span style={{ marginLeft: 8, opacity: 0.7 }}>
                            ({(findItemById(sub.id) as any)?.weight || '-'})
                          </span>
                        </div>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 8,
                marginTop: 16,
                paddingTop: 12,
                borderTop: '1px solid var(--color-border-subtle)',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--color-text-tertiary)' }}>
                    存放在：
                  </span>
                  <select
                    value={entry.locationId || 'player'}
                    onChange={(e) => moveItem(entry.id, e.target.value)}
                    disabled={!isEditMode}
                    style={{
                      fontSize: 11,
                      padding: '2px 8px',
                      borderRadius: 4,
                      border: '1px solid var(--color-border-subtle)',
                      background: 'rgba(0,0,0,0.02)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {inventoryContainers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {isVersatile && (isMainHand || isOffHand) && (
                  <div
                    style={{
                      padding: '8px 12px',
                      background: 'white',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border-subtle)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        color: 'var(--color-text-secondary)',
                      }}
                    >
                      多用 (Versatile) 模式切换：
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        background: 'rgba(0,0,0,0.05)',
                        padding: '2px',
                        borderRadius: '6px',
                        gap: 2,
                      }}
                    >
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleVersatile(entry.id, false);
                        }}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          border: 'none',
                          background: !entry.versatileTwoHanded
                            ? 'var(--color-primary)'
                            : 'transparent',
                          color: !entry.versatileTwoHanded ? 'white' : 'var(--color-text-tertiary)',
                          cursor: isEditMode ? 'pointer' : 'default',
                          fontWeight: 700,
                        }}
                      >
                        单手
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleVersatile(entry.id, true);
                        }}
                        style={{
                          padding: '3px 10px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          border: 'none',
                          background: entry.versatileTwoHanded
                            ? 'var(--color-primary)'
                            : 'transparent',
                          color: entry.versatileTwoHanded ? 'white' : 'var(--color-text-tertiary)',
                          cursor: isEditMode ? 'pointer' : 'default',
                          fontWeight: 700,
                        }}
                      >
                        双手
                      </button>
                    </div>
                  </div>
                )}

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    width: '100%',
                  }}
                >
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div className={styles.qtyControl}>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateQuantity(entry.id, -1);
                        }}
                      >
                        -
                      </button>
                      <span>{entry.quantity || 1}</span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateQuantity(entry.id, 1);
                        }}
                      >
                        +
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {needsAttunement && (
                      <button
                        className={styles.actionButton}
                        style={{
                          borderColor: isAttuned
                            ? 'var(--color-warning)'
                            : 'var(--color-text-tertiary)',
                          color: isAttuned ? 'var(--color-warning)' : 'var(--color-text-tertiary)',
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleAttune(entry.id);
                        }}
                        disabled={!isAttuned && attunement.count >= attunement.limit}
                        title={
                          !isAttuned && attunement.count >= attunement.limit
                            ? `同调名额已满（${attunement.count}/${attunement.limit}）`
                            : undefined
                        }
                      >
                        {isAttuned ? '解除同调' : '开始同调'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 16 }}>
        {/* 左侧：分类清单 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 容器 Tabs */}
          {inventoryContainers.length > 1 && (
            <div
              style={{
                display: 'flex',
                gap: 8,
                overflowX: 'auto',
                paddingBottom: 4,
                alignItems: 'center',
              }}
            >
              {inventoryContainers.map((c) => (
                <div
                  key={c.id}
                  style={{ position: 'relative', display: 'flex', alignItems: 'center' }}
                >
                  <button
                    onClick={() => setActiveContainerId(c.id)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: 12,
                      fontSize: 13,
                      fontWeight: 700,
                      whiteSpace: 'nowrap',
                      border: 'none',
                      background:
                        activeContainerId === c.id ? 'var(--color-primary)' : 'rgba(0,0,0,0.05)',
                      color: activeContainerId === c.id ? 'white' : 'var(--color-text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      paddingRight: isEditMode && c.id !== 'player' ? 32 : 16,
                    }}
                  >
                    {c.id === 'player' ? <Plus size={14} /> : <Truck size={14} />}
                    {c.name}
                  </button>
                  {isEditMode && c.id !== 'player' && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeContainer(c.id);
                      }}
                      style={{
                        position: 'absolute',
                        right: 8,
                        border: 'none',
                        background: 'transparent',
                        color:
                          activeContainerId === c.id
                            ? 'rgba(255,255,255,0.6)'
                            : 'var(--color-text-tertiary)',
                        cursor: 'pointer',
                        padding: 4,
                      }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className={styles.card} style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '16px 24px',
                borderBottom: '1px solid var(--color-border-subtle)',
                background: 'rgba(0,0,0,0.01)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 16,
                  fontWeight: 700,
                  color: 'var(--color-text-primary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                }}
              >
                {inventoryContainers.find((c) => c.id === activeContainerId)?.name || '物品清单'}
                {isEditMode && (
                  <div style={{ display: 'flex', gap: 8 }}>
                    <PillButton
                      size="xs"
                      onClick={() => {
                        setIsMagicOnly(false);
                        setIsSearchOpen(true);
                      }}
                    >
                      <Plus size={12} style={{ marginRight: 4 }} /> 添加物品
                    </PillButton>
                    <PillButton
                      size="xs"
                      variant="outline"
                      style={{ color: '#9333ea', borderColor: '#9333ea' }}
                      onClick={() => {
                        setIsMagicOnly(true);
                        setIsSearchOpen(true);
                      }}
                    >
                      <Wand2 size={12} style={{ marginRight: 4 }} /> 魔法物品
                    </PillButton>
                  </div>
                )}
              </h3>
            </div>

            {categorizedInventory.length > 0 ? (
              categorizedInventory.map((group) => (
                <div
                  key={group.id}
                  style={{ borderBottom: '1px solid var(--color-border-subtle)' }}
                >
                  <div
                    style={{
                      padding: '10px 24px',
                      background: 'rgba(0,0,0,0.02)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 800,
                        color: 'var(--color-text-secondary)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {group.label}
                    </span>
                    {group.id === 'magic' && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-warning)' }}>
                        已同调 {attunement.count} / {attunement.limit}
                        {attunement.overLimit && ' · 超出当前同调上限，需由 DM 确认'}
                      </div>
                    )}
                  </div>
                  <div className={styles.inventoryTable}>
                    <div className={styles.inventoryHeader}>
                      <div style={{ flex: 2 }}>物品名称</div>
                      <div style={{ width: 50, textAlign: 'center' }}>数量</div>
                      <div style={{ width: 50, textAlign: 'center' }}>重量</div>
                      <div style={{ width: 140, textAlign: 'right' }}>操作 Actions</div>
                    </div>
                    {group.items.map(renderItemRow)}
                  </div>
                </div>
              ))
            ) : (
              <div
                style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-tertiary)' }}
              >
                暂无物品条目，点击“添加物品”开始配置
              </div>
            )}
          </div>
        </div>

        {/* 右侧：统计与状态 */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {/* 负重统计卡片 */}
          <div className={styles.card} style={{ padding: 20 }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 16,
              }}
            >
              <h4
                style={{
                  margin: 0,
                  fontSize: 14,
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {activeContainerId === 'player' ? '个人负重 Encumbrance' : '载重容量 Capacity'}
                {isEditMode && activeContainerId === 'player' && (
                  <button
                    onClick={() => {
                      const modes: ('full' | 'standard' | 'simple')[] = [
                        'full',
                        'standard',
                        'simple',
                      ];
                      const current = character.encumbranceMode || 'standard';
                      const next = modes[(modes.indexOf(current) + 1) % modes.length];
                      updateActiveCharacter({ encumbranceMode: next });
                    }}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      color: 'var(--color-text-tertiary)',
                      padding: 0,
                    }}
                    title="切换负重计算模式"
                  >
                    <Settings size={14} />
                  </button>
                )}
              </h4>
              {weightStats.mode === 'simple' && activeContainerId === 'player' && (
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--color-text-tertiary)',
                    background: 'rgba(0,0,0,0.05)',
                    padding: '2px 6px',
                    borderRadius: 4,
                  }}
                >
                  已隐藏
                </span>
              )}
            </div>

            {(weightStats.mode !== 'simple' || activeContainerId !== 'player') && (
              <>
                <div
                  style={{
                    position: 'relative',
                    height: 12,
                    background: 'rgba(0,0,0,0.05)',
                    borderRadius: 6,
                    marginBottom: 16,
                    overflow: 'hidden',
                  }}
                >
                  {/* Threshold Markers */}
                  {weightStats.thresholds && (
                    <>
                      <div
                        style={{
                          position: 'absolute',
                          left: `${(weightStats.thresholds.encumbered / weightStats.capacity) * 100}%`,
                          top: 0,
                          bottom: 0,
                          width: 2,
                          background: 'rgba(0,0,0,0.1)',
                          zIndex: 2,
                        }}
                        title="负重 (Encumbered)"
                      />
                      <div
                        style={{
                          position: 'absolute',
                          left: `${(weightStats.thresholds.heavilyEncumbered / weightStats.capacity) * 100}%`,
                          top: 0,
                          bottom: 0,
                          width: 2,
                          background: 'rgba(0,0,0,0.1)',
                          zIndex: 2,
                        }}
                        title="严重负重 (Heavily Encumbered)"
                      />
                    </>
                  )}
                  <div
                    style={{
                      width: `${Math.min(100, (weightStats.total / weightStats.capacity) * 100)}%`,
                      height: '100%',
                      background:
                        weightStats.total > weightStats.capacity
                          ? 'var(--color-error)'
                          : weightStats.thresholds &&
                              weightStats.total > weightStats.thresholds.heavilyEncumbered
                            ? '#f59e0b'
                            : weightStats.thresholds &&
                                weightStats.total > weightStats.thresholds.encumbered
                              ? '#6366f1'
                              : 'var(--color-primary)',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>

                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-end',
                  }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div
                      style={{
                        fontSize: 24,
                        fontWeight: 800,
                        color:
                          weightStats.total > weightStats.capacity
                            ? 'var(--color-error)'
                            : 'var(--color-text-primary)',
                      }}
                    >
                      {weightStats.total.toFixed(1)}{' '}
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: 500,
                          color: 'var(--color-text-tertiary)',
                        }}
                      >
                        / {weightStats.capacity} lb
                      </span>
                    </div>
                    {weightStats.thresholds &&
                      weightStats.total > weightStats.thresholds.encumbered && (
                        <div
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            color:
                              weightStats.total > weightStats.thresholds.heavilyEncumbered
                                ? '#f59e0b'
                                : '#6366f1',
                            marginTop: 2,
                          }}
                        >
                          {weightStats.total > weightStats.thresholds.heavilyEncumbered
                            ? '⚠️ 严重负重 (速度 -20ft)'
                            : '⚡ 负重 (速度 -10ft)'}
                        </div>
                      )}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: 'var(--color-text-tertiary)',
                      textAlign: 'right',
                    }}
                  >
                    {weightStats.mode === 'full' &&
                      weightStats.currency > 0 &&
                      activeContainerId === 'player' && (
                        <div>货币重量: {weightStats.currency.toFixed(1)} lb</div>
                      )}
                    <div>物品重量: {weightStats.items.toFixed(1)} lb</div>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* 钱包卡片 */}
          <div className={styles.card} style={{ padding: 20 }}>
            <h4
              style={{
                margin: 0,
                fontSize: 14,
                fontWeight: 700,
                marginBottom: 16,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              钱包 Currency
              <Coins size={16} color="var(--color-warning)" />
            </h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {Object.entries(character.currency || { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 })
                .reverse()
                .map(([key, val]) => (
                  <div
                    key={key}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 13,
                        fontWeight: 600,
                        color: 'var(--color-text-secondary)',
                        textTransform: 'uppercase',
                      }}
                    >
                      {key}
                    </span>
                    <input
                      type="number"
                      value={val as number}
                      onChange={(e) =>
                        isEditMode &&
                        updateActiveCharacter({
                          currency: { ...character.currency, [key]: parseInt(e.target.value) || 0 },
                        })
                      }
                      readOnly={!isEditMode}
                      className={styles.qtyInput}
                      style={{ width: 80, textAlign: 'right' }}
                    />
                  </div>
                ))}
            </div>
          </div>

          <div className={styles.card}>
            <h2 className={styles.cardTitle}>当前穿戴</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {(() => {
                const armor = inventory.find((c) => c.id === character.equippedArmorId);
                const shield = inventory.find((c) => c.id === character.equippedShieldId);
                const weapons = character.equippedWeaponIds
                  ?.map((id) => inventory.find((c) => c.id === id))
                  .filter(Boolean);

                return (
                  <>
                    <div className={styles.equippedItem}>
                      <span className={styles.equippedLabel}>护甲</span>
                      <span className={styles.equippedValue}>{armor?.name || '未装备'}</span>
                    </div>
                    <div className={styles.equippedItem}>
                      <span className={styles.equippedLabel}>盾牌</span>
                      <span className={styles.equippedValue}>{shield?.name || '未装备'}</span>
                    </div>
                    <div
                      className={styles.equippedItem}
                      style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 6 }}
                    >
                      <span className={styles.equippedLabel}>已就绪武器</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {weapons?.length ? (
                          weapons.map((w) => (
                            <span
                              key={w!.id}
                              style={{
                                fontSize: 12,
                                fontWeight: 600,
                                background: 'rgba(0,0,0,0.05)',
                                padding: '2px 8px',
                                borderRadius: 4,
                              }}
                            >
                              {w!.name}
                            </span>
                          ))
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--color-text-tertiary)' }}>
                            无
                          </span>
                        )}
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      </div>
      {/* 搜索添加 Modal */}
      {isSearchOpen && (
        <div className={styles.overlay} onClick={() => setIsSearchOpen(false)}>
          <div
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 600, height: '80vh', display: 'flex', flexDirection: 'column' }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 20,
              }}
            >
              <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>从库中添加物品</h2>
              <button
                onClick={() => setIsSearchOpen(false)}
                style={{
                  border: 'none',
                  background: 'transparent',
                  cursor: 'pointer',
                  color: 'var(--color-text-tertiary)',
                }}
              >
                <X size={24} />
              </button>
            </div>

            <div style={{ position: 'relative', marginBottom: 20 }}>
              <Search
                style={{
                  position: 'absolute',
                  left: 12,
                  top: 12,
                  color: 'var(--color-text-tertiary)',
                }}
                size={20}
              />
              <input
                className={styles.inputField}
                style={{ paddingLeft: 44 }}
                placeholder="搜索物品名称 (如：长剑、治疗药水...)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>

            <div
              style={{
                display: 'flex',
                gap: 8,
                marginBottom: 16,
                overflowX: 'auto',
                paddingBottom: 4,
              }}
            >
              {[
                { id: 'all', label: '全部' },
                { id: 'magic', label: '魔法物品' },
                { id: 'weapon', label: '武器' },
                { id: 'armor', label: '护甲' },
                { id: 'gear', label: '冒险物品' },
                { id: 'tool', label: '工具' },
                { id: 'vehicle', label: '载具/坐骑' },
              ].map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => {
                    setSearchCategory(cat.id);
                    setIsMagicOnly(cat.id === 'magic');
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 20,
                    fontSize: 12,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                    border: '1px solid',
                    background:
                      searchCategory === cat.id || (isMagicOnly && cat.id === 'magic')
                        ? 'var(--color-primary)'
                        : 'transparent',
                    borderColor:
                      searchCategory === cat.id || (isMagicOnly && cat.id === 'magic')
                        ? 'var(--color-primary)'
                        : 'var(--color-border-subtle)',
                    color:
                      searchCategory === cat.id || (isMagicOnly && cat.id === 'magic')
                        ? 'white'
                        : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    boxShadow:
                      searchCategory === cat.id || (isMagicOnly && cat.id === 'magic')
                        ? '0 2px 8px rgba(0,113,227,0.3)'
                        : 'none',
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
              {catalogItems
                .filter((item) => {
                  const matchesQuery =
                    item.name.includes(searchQuery) ||
                    (item as any).nameEn?.toLowerCase().includes(searchQuery.toLowerCase());

                  if (!matchesQuery) return false;

                  const itemCat =
                    (item as any).category ||
                    ((item as any).weaponCategory
                      ? 'weapon'
                      : (item as any).armorCategory
                        ? 'armor'
                        : 'gear');
                  const isMagic = isMagicItemDefinition(item);

                  if (isMagicOnly && !isMagic) return false;
                  if (searchCategory === 'all') return true;
                  if (searchCategory === 'magic') return isMagic;

                  return itemCat === searchCategory;
                })
                .slice(0, 50)
                .map((item) => {
                  const itemCat =
                    (item as any).category ||
                    ((item as any).weaponCategory
                      ? 'weapon'
                      : (item as any).armorCategory
                        ? 'armor'
                        : 'gear');
                  const isWeapon = (item as any).weaponCategory;
                  const isArmor = (item as any).armorCategory;

                  return (
                    <div
                      key={item.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '12px 16px',
                        borderRadius: 12,
                        marginBottom: 8,
                        background: 'rgba(0,0,0,0.02)',
                        border: '1px solid transparent',
                        transition: 'all 0.2s',
                      }}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, fontSize: 14 }}>{item.name}</span>
                          <span
                            style={{
                              fontSize: 10,
                              color: 'var(--color-text-tertiary)',
                              background: 'rgba(0,0,0,0.05)',
                              padding: '1px 6px',
                              borderRadius: 4,
                            }}
                          >
                            {getCategoryLabel(itemCat)}
                          </span>
                        </div>
                        <div
                          style={{
                            fontSize: 11,
                            color: 'var(--color-text-tertiary)',
                            marginTop: 2,
                            display: 'flex',
                            gap: 10,
                          }}
                        >
                          <span>{(item as any).nameEn}</span>
                          {isWeapon && (
                            <span style={{ color: 'var(--color-primary)', fontWeight: 600 }}>
                              {(item as any).damage} {(item as any).damageType}
                            </span>
                          )}
                          {isArmor && (
                            <span style={{ color: 'var(--color-success)', fontWeight: 600 }}>
                              AC {(item as any).ac}
                            </span>
                          )}
                          {item.weight && <span>{item.weight} lb</span>}
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 8 }}>
                        {itemCat === 'vehicle' ||
                        itemCat === 'mount' ||
                        (item as any).containerCapacity ? (
                          <PillButton
                            size="xs"
                            variant="primary"
                            style={{
                              background: 'var(--color-warning)',
                              borderColor: 'var(--color-warning)',
                            }}
                            onClick={() => addContainer(item)}
                          >
                            作为载具添加
                          </PillButton>
                        ) : (
                          <PillButton size="xs" onClick={() => addItemToInventory(item)}>
                            添加
                          </PillButton>
                        )}
                      </div>
                    </div>
                  );
                })}
              {catalogItems.filter((item) => item.name.includes(searchQuery)).length === 0 && (
                <div
                  style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-tertiary)' }}
                >
                  未找到匹配的物品
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryTab;
