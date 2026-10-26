'use client';
import { useBuilderChoices } from '@/platform/useBuilderChoices';

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCharacterStore } from '@/store/characterStore';
import type { CharacterOptionDefinition } from '@/catalog/adapters/characterOptions';
import { getSourceDisplayName } from '@/config/sourceMapping';
import PillButton from '@/components/PillButton';
import { useCatalog } from '@/platform/CatalogProvider';
import OptionCard from '@/components/OptionCard';
import MarkdownText from '@/components/MarkdownText';
import styles from '../species/page.module.css';

const TYPE_NAMES: Record<string, string> = {
  EI: '魔能祈唤',
  MM: '超魔法',
  FS: '战斗风格',
  PB: '魔契恩泽',
  AI: '注魔',
  ED: '元素戒律',
  AS: '奥术射击',
};
const KIND_NAMES: Record<string, string> = {
  optionalfeature: '其他可选特性',
  charoption: '角色选项',
  reward: '恩惠与奖励',
  boon: '邪魔恩惠',
  cult: '教团选项',
};
const REWARD_NAMES: Record<string, string> = {
  Charm: '护符',
  Blessing: '祝福',
  Boon: '恩赐',
  EpicBoon: '传奇恩惠',
  Other: '其他奖励',
  'Draconic Gift': '巨龙赠礼',
  'Piety Trait': '虔诚特质',
  Curse: '诅咒',
  'Fragment of Suffering': '苦难碎片',
  Inhabitation: '寄宿灵',
};
const categoryOf = (option: CharacterOptionDefinition) => {
  const code = option.featureTypes
    .map((type) => type.split('|')[0].toUpperCase())
    .find((type) => TYPE_NAMES[type]);
  if (code) return TYPE_NAMES[code];
  if (option.kind === 'reward' && option.type) return REWARD_NAMES[option.type] || option.type;
  return KIND_NAMES[option.kind] || option.kind;
};
function prerequisiteText(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(prerequisiteText).filter(Boolean).join('；');
  if (!value || typeof value !== 'object') return '';
  const rule = value as Record<string, unknown>;
  const level =
    rule.level && typeof rule.level === 'object'
      ? (rule.level as Record<string, unknown>)
      : undefined;
  const className =
    level?.class && typeof level.class === 'object'
      ? (level.class as Record<string, unknown>).name
      : undefined;
  return (
    [
      level ? `${className ? `${className} ` : ''}${level.level} 级` : '',
      rule.spellcasting ? '具备施法能力' : '',
      rule.pact ? `魔契：${prerequisiteText(rule.pact)}` : '',
      rule.feature ? `特性：${prerequisiteText(rule.feature)}` : '',
    ]
      .filter(Boolean)
      .join('；') || '其他前提请参见原文'
  );
}

export default function CharacterOptionsPage() {
  const choices = useBuilderChoices();
  const id = useSearchParams().get('id');
  const { characters, loadCharacter, updateActiveCharacter } = useCharacterStore();
  const { status } = useCatalog();
  const character = id ? characters[id] : undefined;
  const [filter, setFilter] = useState('魔能祈唤');
  const [source, setSource] = useState('全部来源');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>();
  const [showCount, setShowCount] = useState(60);
  const all = useMemo(() => choices.getCatalogCharacterOptions(), [status, choices]);
  const categories = useMemo(() => ['全部', ...new Set(all.map(categoryOf))], [all]);
  useEffect(() => {
    if (categories.length > 1 && !categories.includes(filter)) setFilter(categories[1]);
  }, [categories, filter]);
  const sources = useMemo(
    () => [
      '全部来源',
      ...new Set(
        all
          .filter((option) => filter === '全部' || categoryOf(option) === filter)
          .map((option) => option.source),
      ),
    ],
    [all, filter],
  );
  const visible = useMemo(
    () =>
      all.filter((option) => {
        if (filter !== '全部' && categoryOf(option) !== filter) return false;
        if (source !== '全部来源' && option.source !== source) return false;
        const needle = query.trim().toLowerCase();
        return (
          !needle ||
          `${option.name} ${option.nameEn || ''} ${option.source} ${option.type || ''}`
            .toLowerCase()
            .includes(needle)
        );
      }),
    [all, filter, source, query],
  );
  const selected = visible.find((option) => option.id === selectedId) || visible[0];

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
        <div className={styles.list} aria-label="选项分类">
          {categories.map((name) => (
            <PillButton
              key={name}
              size="sm"
              variant={filter === name ? 'primary' : 'outline'}
              onClick={() => {
                setFilter(name);
                setSource('全部来源');
                setSelectedId(undefined);
                setShowCount(60);
              }}
            >
              {name}（
              {name === '全部'
                ? all.length
                : all.filter((option) => categoryOf(option) === name).length}
              ）
            </PillButton>
          ))}
          <strong style={{ margin: '14px 8px 4px' }}>已选项目</strong>
          {chosen.map((ref) => {
            const option = all.find((item) => item.id === ref);
            return (
              <button
                key={ref}
                type="button"
                onClick={() => {
                  if (option) {
                    setFilter('全部');
                    setSource('全部来源');
                    setQuery('');
                    setSelectedId(ref);
                  }
                }}
                style={{
                  padding: 8,
                  color: 'var(--color-text-primary)',
                  background: 'var(--color-bg-surface)',
                  border: '1px solid var(--color-border-dark)',
                }}
              >
                {option?.name || `当前范围外：${ref}`}
              </button>
            );
          })}
        </div>
        <div className={styles.detailsPanel}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
            {sources.map((name) => (
              <PillButton
                key={name}
                size="sm"
                variant={source === name ? 'primary' : 'outline'}
                onClick={() => {
                  setSource(name);
                  setSelectedId(undefined);
                  setShowCount(60);
                }}
              >
                {name === '全部来源' ? name : getSourceDisplayName(name)}
              </PillButton>
            ))}
          </div>
          <input
            aria-label="搜索附加选项"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索选项名称或来源"
            style={{
              width: '100%',
              padding: 10,
              marginBottom: 12,
              color: 'var(--color-text-primary)',
              background: 'var(--color-bg-dark)',
              border: '1px solid var(--color-border-dark)',
              borderRadius: 8,
            }}
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(180px, 280px) minmax(0, 1fr)',
              gap: 20,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {visible.slice(0, showCount).map((option) => (
                <OptionCard
                  key={option.id}
                  title={option.name}
                  subtitle={`${categoryOf(option)} · ${getSourceDisplayName(option.source)}`}
                  selected={selected?.id === option.id}
                  onClick={() => setSelectedId(option.id)}
                />
              ))}
              {visible.length > showCount && (
                <PillButton size="sm" onClick={() => setShowCount(showCount + 60)}>
                  显示更多（{showCount}/{visible.length}）
                </PillButton>
              )}
            </div>
            {selected ? (
              <div className={styles.detailsContent}>
                <h2>{selected.name}</h2>
                <p style={{ color: 'var(--color-text-secondary)' }}>
                  {selected.nameEn} · {getSourceDisplayName(selected.source)}
                </p>
                {selected.prerequisites.length > 0 && (
                  <div
                    style={{
                      padding: 12,
                      background: 'var(--color-bg-surface-elevated)',
                      borderRadius: 8,
                    }}
                  >
                    前提条件：{prerequisiteText(selected.prerequisites)}
                  </div>
                )}
                <MarkdownText text={selected.description || '源数据没有提供说明文本。'} />
                {selected.automationStatus === 'manual' && (
                  <p style={{ color: '#b45309' }}>
                    该条目的机制尚未结构化，将保留原文并由玩家或 DM 人工处理。
                  </p>
                )}
                <button
                  disabled={
                    !chosen.includes(selected.id) &&
                    !all.some((option) => option.id === selected.id)
                  }
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
    </div>
  );
}
