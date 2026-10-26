'use client';
import { useState } from 'react';
import type { SubClass } from '@/types/class';
import { getSourceDisplayName } from '@/config/sourceMapping';
import PillButton from './PillButton';
import MarkdownText from './MarkdownText';

export default function SubclassChoice({
  options,
  selectedId,
  onSelect,
  level,
  description,
}: {
  options: SubClass[];
  selectedId?: string;
  onSelect: (id: string) => void;
  level: number;
  description?: string;
}) {
  const [source, setSource] = useState('');
  const [search, setSearch] = useState('');
  const sources = [...new Set(options.map((option) => option.source || ''))].filter(Boolean);
  const selected = options.find((option) =>
    [option.catalogId, option.nameEn, option.name].includes(selectedId),
  );
  const effectiveSource = sources.includes(source) ? source : '';
  return (
    <div
      style={{
        marginTop: 16,
        padding: 20,
        border: '1px solid var(--color-border-dark)',
        borderRadius: 14,
        background: 'var(--color-bg-dark)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <strong>子职业选择</strong>
        <span>
          {level} 级 · 已选 {selected ? 1 : 0}/1
        </span>
      </div>
      {description && <MarkdownText text={description} />}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        {['', ...sources].map((value) => (
          <PillButton
            key={value}
            size="sm"
            variant={effectiveSource === value ? 'primary' : 'outline'}
            aria-pressed={effectiveSource === value}
            onClick={() => setSource(value)}
          >
            {value ? getSourceDisplayName(value) : '全部来源'}
          </PillButton>
        ))}
      </div>
      <input
        aria-label="搜索子职业"
        placeholder="搜索子职业…"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        style={{
          marginTop: 12,
          padding: 8,
          width: '100%',
          color: 'var(--color-text-primary)',
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border-dark)',
          borderRadius: 8,
        }}
      />
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
        {options
          .filter(
            (option) =>
              (!effectiveSource || option.source === effectiveSource) &&
              `${option.name} ${option.nameEn || ''}`.toLowerCase().includes(search.toLowerCase()),
          )
          .map((option) => {
            const id = option.catalogId || option.nameEn || option.name;
            return (
              <PillButton
                key={id}
                variant={selected === option ? 'primary' : 'outline'}
                aria-pressed={selected === option}
                onClick={() => onSelect(id)}
              >
                {option.name} · {getSourceDisplayName(option.source || '')}
              </PillButton>
            );
          })}
      </div>
      {selected && (
        <div style={{ marginTop: 12 }}>
          <strong>
            {selected.name} · {getSourceDisplayName(selected.source || '')}
          </strong>
          {selected.description && <MarkdownText text={selected.description} />}
        </div>
      )}
    </div>
  );
}
