'use client';

import { useState } from 'react';
import PillButton from '@/components/PillButton';
import { getSourceDisplayName } from '@/config/sourceMapping';

export interface ChoiceFacets {
  sources?: string[];
  types?: string[];
}

export function filterChoiceOptions<T>(
  options: T[],
  facets: ChoiceFacets[],
  source: string,
  type: string,
): T[] {
  return options.filter((_, index) => {
    const facet = facets[index];
    return (!source || facet.sources?.includes(source)) && (!type || facet.types?.includes(type));
  });
}

interface ChoiceFilterListProps<T> {
  options: T[];
  getFacets: (option: T) => ChoiceFacets;
  render: (options: T[]) => React.ReactNode;
  typeLabels?: Record<string, string>;
}

export default function ChoiceFilterList<T>({
  options,
  getFacets,
  render,
  typeLabels = {},
}: ChoiceFilterListProps<T>) {
  const [source, setSource] = useState('');
  const [type, setType] = useState('');
  const facets = options.map(getFacets);
  const sources = [...new Set(facets.flatMap((facet) => facet.sources || []).filter(Boolean))];
  const types = [...new Set(facets.flatMap((facet) => facet.types || []).filter(Boolean))];
  const activeSource = sources.includes(source) ? source : '';
  const activeType = types.includes(type) ? type : '';
  const visible = filterChoiceOptions(options, facets, activeSource, activeType);

  const filterRow = (
    label: string,
    values: string[],
    active: string,
    select: (value: string) => void,
    display: (value: string) => string,
  ) =>
    values.length > 1 && (
      <div
        role="group"
        aria-label={`${label}筛选`}
        style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}
      >
        {['', ...values].map((value) => (
          <PillButton
            key={value}
            type="button"
            size="sm"
            variant={active === value ? 'primary' : 'outline'}
            aria-pressed={active === value}
            onClick={() => select(value)}
          >
            {value ? display(value) : `全部${label}`}
          </PillButton>
        ))}
      </div>
    );

  return (
    <>
      {(sources.length > 1 || types.length > 1) && (
        <div style={{ display: 'grid', gap: 8, marginBottom: 12 }}>
          {filterRow('类型', types, activeType, setType, (value) => typeLabels[value] || value)}
          {filterRow('来源', sources, activeSource, setSource, getSourceDisplayName)}
        </div>
      )}
      {render(visible)}
    </>
  );
}
