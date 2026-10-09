'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, X, Sparkles, PlusCircle } from 'lucide-react';
import { searchAll, SearchResultItem, CategoryFilter } from '@/platform/searchIndexer';
import { useCharacterStore } from '@/store/characterStore';
import styles from './SearchModal.module.css';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  editionFilter?: '5e' | '2024' | 'all';
}

export default function SearchModal({ isOpen, onClose, editionFilter }: SearchModalProps) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>('all');
  const [edition, setEdition] = useState<'5e' | '2024' | 'all'>('2024');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const activeCharacterId = useCharacterStore((state) => state.activeCharacterId);
  const updateActiveCharacter = useCharacterStore((state) => state.updateActiveCharacter);

  useEffect(() => {
    const saved = (localStorage.getItem('dnd2024-rule-edition') as '5e' | '2024' | 'all') || editionFilter || '2024';
    setEdition(saved);
  }, [editionFilter]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
      performSearch(query, activeCategory, edition);
    }
  }, [isOpen, activeCategory, edition]);

  const performSearch = (q: string, cat: CategoryFilter, ed: '5e' | '2024' | 'all' = edition) => {
    const res = searchAll(q, ed, cat);
    setResults(res);
    setSelectedIndex(0);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    performSearch(val, activeCategory, edition);
  };

  const handleCategoryChange = (cat: CategoryFilter) => {
    setActiveCategory(cat);
    performSearch(query, cat, edition);
  };

  const handleEditionChange = (ed: '5e' | '2024' | 'all') => {
    setEdition(ed);
    localStorage.setItem('dnd2024-rule-edition', ed);
    performSearch(query, activeCategory, ed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
    }
  };

  const handleAddToCharacter = (item: SearchResultItem) => {
    if (!activeCharacterId) return;
    if (item.category === 'spell') {
      const char = useCharacterStore.getState().characters[activeCharacterId];
      if (char) {
        const currentSpells = char.knownSpellIds || [];
        if (!currentSpells.includes(item.id)) {
          updateActiveCharacter({ knownSpellIds: [...currentSpells, item.id] });
          alert(`已添加法术「${item.name}」至当前角色卡`);
        } else {
          alert(`法术「${item.name}」已存在于角色卡中`);
        }
      }
    } else if (item.category === 'feat') {
      const char = useCharacterStore.getState().characters[activeCharacterId];
      if (char) {
        const currentFeats = char.selectedFeats || [];
        if (!currentFeats.some((f) => f.featId === item.id)) {
          const mainClass = char.classes[0]?.classId || 'general';
          updateActiveCharacter({
            selectedFeats: [...currentFeats, { classId: mainClass, level: 1, featId: item.id }]
          });
          alert(`已添加专长「${item.name}」至当前角色卡`);
        } else {
          alert(`专长「${item.name}」已存在于角色卡中`);
        }
      }
    } else {
      alert(`已记录「${item.name}」`);
    }
  };

  if (!isOpen) return null;

  const selectedItem = results[selectedIndex] || null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <div className={styles.header}>
          <Search size={20} className={styles.searchIcon} />
          <input
            ref={inputRef}
            type="text"
            className={styles.searchInput}
            placeholder="搜索法术、专长、装备、种族、背景、怪物..."
            value={query}
            onChange={handleInputChange}
          />
          <span className={styles.kbdHint}>ESC</span>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer' }}
          >
            <X size={18} />
          </button>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tabBtn} ${activeCategory === 'all' ? styles.tabBtnActive : ''}`}
              onClick={() => handleCategoryChange('all')}
            >
              全部
            </button>
            <button
              className={`${styles.tabBtn} ${activeCategory === 'spell' ? styles.tabBtnActive : ''}`}
              onClick={() => handleCategoryChange('spell')}
            >
              法术
            </button>
            <button
              className={`${styles.tabBtn} ${activeCategory === 'feat' ? styles.tabBtnActive : ''}`}
              onClick={() => handleCategoryChange('feat')}
            >
              专长
            </button>
            <button
              className={`${styles.tabBtn} ${activeCategory === 'species' ? styles.tabBtnActive : ''}`}
              onClick={() => handleCategoryChange('species')}
            >
              种族
            </button>
            <button
              className={`${styles.tabBtn} ${activeCategory === 'background' ? styles.tabBtnActive : ''}`}
              onClick={() => handleCategoryChange('background')}
            >
              背景
            </button>
            <button
              className={`${styles.tabBtn} ${activeCategory === 'item' ? styles.tabBtnActive : ''}`}
              onClick={() => handleCategoryChange('item')}
            >
              装备与物品
            </button>
            <button
              className={`${styles.tabBtn} ${activeCategory === 'monster' ? styles.tabBtnActive : ''}`}
              onClick={() => handleCategoryChange('monster')}
            >
              怪物
            </button>
          </div>

          <div className={styles.editionGroup}>
            <button
              className={`${styles.editionBtn} ${edition === '2024' ? styles.editionBtnActive : ''}`}
              onClick={() => handleEditionChange('2024')}
              title="优先展示 2024 (XPHB) 规则数据"
            >
              2024
            </button>
            <button
              className={`${styles.editionBtn} ${edition === '5e' ? styles.editionBtnActive : ''}`}
              onClick={() => handleEditionChange('5e')}
              title="仅展示 2014 (PHB) 经典 5e 数据"
            >
              5e (2014)
            </button>
            <button
              className={`${styles.editionBtn} ${edition === 'all' ? styles.editionBtnActive : ''}`}
              onClick={() => handleEditionChange('all')}
              title="展示所有版本资源"
            >
              全部
            </button>
          </div>
        </div>

        <div className={styles.body}>
          {results.length === 0 ? (
            <div className={styles.emptyState}>未找到匹配「{query}」的相关资源数据</div>
          ) : (
            <div className={styles.resultsList}>
              {results.map((item, idx) => (
                <div
                  key={`${item.category}-${item.id}-${idx}`}
                  className={`${styles.resultCard} ${idx === selectedIndex ? styles.resultCardActive : ''}`}
                  onClick={() => setSelectedIndex(idx)}
                >
                  <div className={styles.cardHeader}>
                    <div className={styles.cardTitleGroup}>
                      <span className={styles.cardTitle}>{item.name}</span>
                      {item.nameEn && <span className={styles.cardTitleEn}>{item.nameEn}</span>}
                    </div>
                    <div className={styles.badgeGroup}>
                      {item.isHomebrew && <span className={styles.badgeHomebrew}>原创第三方</span>}
                      <span className={styles.badgeCategory}>{item.categoryLabel}</span>
                    </div>
                  </div>
                  {item.type && <div className={styles.cardMeta}>{item.type}</div>}
                  <div className={styles.cardSnippet}>{item.description}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedItem && (
          <div className={styles.drawer}>
            <div className={styles.drawerHeader}>
              <div className={styles.drawerTitle}>
                {selectedItem.name} {selectedItem.nameEn ? `(${selectedItem.nameEn})` : ''}
              </div>
              {activeCharacterId && (selectedItem.category === 'spell' || selectedItem.category === 'feat') && (
                <button
                  onClick={() => handleAddToCharacter(selectedItem)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 12px',
                    borderRadius: 6,
                    background: 'rgba(212, 175, 55, 0.2)',
                    border: '1px solid rgba(212, 175, 55, 0.4)',
                    color: '#ffd700',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                  }}
                >
                  <PlusCircle size={14} />
                  加入当前角色卡
                </button>
              )}
            </div>
            <div className={styles.drawerText}>{selectedItem.description}</div>
          </div>
        )}
      </div>
    </div>
  );
}
