'use client';
import { useState } from 'react';
import ChoiceFilterList from './ChoiceFilterList';
import PillButton from './PillButton';
import MarkdownText from './MarkdownText';
import { getSourceDisplayName } from '@/config/sourceMapping';
import { matchesStyleReference } from '@/catalog/fightingStyles';
import type { CharacterOptionDefinition } from '@/catalog/adapters/characterOptions';

export default function FightingStyleChoice({
  options,
  selected,
  count = 1,
  onChange,
  disabledIds = [],
}: {
  options: CharacterOptionDefinition[];
  selected: string[];
  count?: number;
  onChange?: (id: string) => void;
  disabledIds?: string[];
}) {
  const [previewId, setPreviewId] = useState('');
  const preview =
    options.find((entry) => entry.id === previewId) ||
    options.find((entry) => selected.some((id) => matchesStyleReference(entry, id))) ||
    options[0];
  return (
    <section aria-label="战斗风格选择" style={{ marginTop: 16 }}>
      {onChange && (
        <>
          <p>
            战斗风格 · 已选{' '}
            {
              options.filter((entry) => selected.some((id) => matchesStyleReference(entry, id)))
                .length
            }
            /{count}
          </p>
          <ChoiceFilterList
            options={options}
            getFacets={(entry) => ({ sources: [entry.source] })}
            render={(visible) => (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {visible.map((entry) => (
                  <PillButton
                    key={entry.id}
                    size="sm"
                    disabled={
                      disabledIds.includes(entry.id) &&
                      !selected.some((id) => matchesStyleReference(entry, id))
                    }
                    variant={
                      selected.some((id) => matchesStyleReference(entry, id))
                        ? 'primary'
                        : 'outline'
                    }
                    onClick={() => {
                      setPreviewId(entry.id);
                      onChange(entry.id);
                    }}
                  >
                    {entry.name} · {getSourceDisplayName(entry.source)}
                  </PillButton>
                ))}
              </div>
            )}
          />
        </>
      )}
      {preview && (
        <div
          style={{
            marginTop: 12,
            padding: 16,
            background: 'var(--color-bg-card)',
            color: 'var(--color-text-primary)',
            border: '1px solid var(--color-border-subtle)',
            borderRadius: 12,
          }}
        >
          <strong>{preview.name}</strong> · {getSourceDisplayName(preview.source)}
          <MarkdownText text={preview.description} />
        </div>
      )}
      {!options.length && <p role="status">可用来源中尚未加载符合条件的战斗风格。</p>}
    </section>
  );
}
