'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCharacterStore } from '@/store/characterStore';
import { CharacterOptionKind, getCatalogCharacterOptions } from '@/catalog';
import { useCatalog } from '@/platform/CatalogProvider';
import OptionCard from '@/components/OptionCard';
import MarkdownText from '@/components/MarkdownText';
import styles from '../species/page.module.css';

const FILTERS: Array<{ key: 'all' | CharacterOptionKind; label: string }> = [
  { key: 'all', label: '全部' },
  { key: 'optionalfeature', label: '可选特性' },
  { key: 'charoption', label: '角色选项/黑暗赠礼' },
  { key: 'reward', label: '祝福、恩惠与奖励' },
  { key: 'boon', label: '邪魔恩惠' },
  { key: 'cult', label: '教团选项' },
];

export default function CharacterOptionsPage() {
  const id = useSearchParams().get('id');
  const { characters, loadCharacter, updateActiveCharacter } = useCharacterStore();
  const { status } = useCatalog();
  const character = id ? characters[id] : undefined;
  const [filter, setFilter] = useState<'all' | CharacterOptionKind>('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>();
  const all = useMemo(() => getCatalogCharacterOptions(), [status]);
  const visible = useMemo(
    () =>
      all.filter((option) => {
        if (filter !== 'all' && option.kind !== filter) return false;
        const needle = query.trim().toLowerCase();
        return (
          !needle ||
          `${option.name} ${option.nameEn || ''} ${option.source} ${option.type || ''}`
            .toLowerCase()
            .includes(needle)
        );
      }),
    [all, filter, query],
  );
  const selected = all.find((option) => option.id === selectedId) || visible[0];

  useEffect(() => {
    if (id) loadCharacter(id);
  }, [id, loadCharacter]);
  if (!character) return <div className="page-container">加载中...</div>;

  const chosen = character.selectedCharacterOptionIds || [];
  const toggle = (optionId: string) =>
    updateActiveCharacter({
      selectedCharacterOptionIds: chosen.includes(optionId)
        ? chosen.filter((value) => value !== optionId)
        : [...chosen, optionId],
    });

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <h2 className={styles.title}>附加角色选项</h2>
        </div>
      </div>
      <div className={styles.content}>
        <div className={styles.list}>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索名称、来源或类型"
            style={{ margin: 8, padding: 10, borderRadius: 8, border: '1px solid #475569' }}
          />
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as any)}
            style={{ margin: '0 8px 10px', padding: 8 }}
          >
            {FILTERS.map((item) => (
              <option key={item.key} value={item.key}>
                {item.label}
              </option>
            ))}
          </select>
          {visible.map((option) => (
            <OptionCard
              key={option.id}
              title={option.name}
              subtitle={`${option.type || FILTERS.find((item) => item.key === option.kind)?.label || option.kind} · ${option.source}`}
              selected={selected?.id === option.id}
              onClick={() => setSelectedId(option.id)}
            />
          ))}
        </div>
        <div className={styles.detailsPanel}>
          {selected ? (
            <div className={styles.detailsContent}>
              <h2>{selected.name}</h2>
              <p style={{ color: '#64748b' }}>
                {selected.nameEn} · {selected.source}
              </p>
              {selected.prerequisites.length > 0 && (
                <div
                  style={{
                    padding: 12,
                    background: 'var(--color-bg-surface-elevated)',
                    borderRadius: 8,
                  }}
                >
                  前提条件：{JSON.stringify(selected.prerequisites)}
                </div>
              )}
              <MarkdownText text={selected.description || '源数据没有提供说明文本。'} />
              {selected.automationStatus === 'manual' && (
                <p style={{ color: '#b45309' }}>
                  该条目的机制尚未结构化，将保留原文并由玩家或 DM 人工处理。
                </p>
              )}
              <button
                onClick={() => toggle(selected.id)}
                style={{ marginTop: 20, padding: '10px 18px', borderRadius: 8 }}
              >
                {chosen.includes(selected.id) ? '从角色移除' : '添加到角色'}
              </button>
            </div>
          ) : (
            <div className={styles.emptyState}>当前筛选下没有可用条目。</div>
          )}
        </div>
      </div>
    </div>
  );
}
