'use client';

import { useMemo } from 'react';
import { useSearchParams } from 'next/navigation';
import { useCharacterStore } from '@/store/characterStore';
import { useCatalog } from './CatalogProvider';
import { createBuilderChoices } from '@/catalog/builderChoices';

export function useBuilderChoices() {
  const id = useSearchParams().get('id') || '';
  const character = useCharacterStore((state) => state.characters[id]);
  const { stats } = useCatalog();
  return useMemo(
    () => createBuilderChoices(character || {}),
    [character?.sourceSelection, character?.allowHomebrew, stats],
  );
}
