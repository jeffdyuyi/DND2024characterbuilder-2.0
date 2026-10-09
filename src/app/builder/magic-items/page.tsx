'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCharacterStore } from '@/store/characterStore';
import OptionCard from '@/components/OptionCard';
import ItemDetailContent from '@/components/ItemDetailContent';
import { getCatalogItems, isMagicItemDefinition } from '@/catalog';
import { useCatalog } from '@/platform/CatalogProvider';
import { getAttunementStatus } from '@/engine/characterData';
import { InventoryEntry } from '@/types/characterState';
import styles from '../species/page.module.css';

export default function MagicItemsPage() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');
  const { characters, loadCharacter, updateActiveCharacter } = useCharacterStore();
  const { status } = useCatalog();
  const character = id ? characters[id] : null;
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>();
  const items = useMemo(() => getCatalogItems().filter(isMagicItemDefinition), [status]);
  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items;
    return items.filter((item) => `${item.name} ${(item as any).nameEn || ''} ${(item as any).source || ''}`.toLowerCase().includes(normalized));
  }, [items, query]);
  const selected = items.find((item) => item.id === selectedId) || filteredItems[0];

  const detailsPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (id) loadCharacter(id);
  }, [id, loadCharacter]);

  if (!character) return <div className="page-container">加载中...</div>;

  const attunement = getAttunementStatus(character);
  const addItem = () => {
    if (!selected) return;
    const entry: InventoryEntry = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${selected.id}-${Date.now()}`,
      itemId: selected.id,
      name: selected.name,
      quantity: 1,
      category: (selected as any).category || 'gear',
      source: (selected as any).source,
      weight: (selected as any).weight,
      locationId: 'player',
    };
    updateActiveCharacter({ inventoryEntries: [...(character.inventoryEntries || []), entry] });
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>魔法物品</h2>
          <span style={{ marginLeft: 16, color: '#64748b' }}>同调 {attunement.count}/{attunement.limit}</span>
        </div>
      </div>

      <div className={styles.content}>
        <div className={styles.list}>
          <div style={{ padding: '4px 8px 12px' }}>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索名称或来源"
              style={{ width: '100%', padding: 10, borderRadius: 8, border: '1px solid #475569' }} />
          </div>
          {filteredItems.map((item) => (
            <OptionCard key={item.id} title={item.name}
              subtitle={`${(item as any).rarity || '魔法物品'} · ${(item as any).source || '未知来源'}${(item as any).requiresAttunement ? ' · 需同调' : ''}`}
              selected={selected?.id === item.id} onClick={() => setSelectedId(item.id)} />
          ))}
        </div>

        <div className={styles.detailsPanel} ref={detailsPanelRef}>
          {selected ? <div className={styles.detailsContent}>
            <h2>{selected.name}</h2>
            <p style={{ color: '#64748b' }}>{(selected as any).nameEn} · {(selected as any).source}</p>
            <ItemDetailContent item={selected} category={(selected as any).category} />
            <button onClick={addItem} style={{ marginTop: 24, padding: '10px 18px', borderRadius: 8, cursor: 'pointer' }}>加入库存</button>
          </div> : <div className={styles.emptyState}>公共数据源中暂无可用魔法物品。</div>}
        </div>
      </div>
    </div>
  );
}
