import { describe, it, expect } from 'vitest';
import { defaultCatalog } from '../catalog';
import { getCatalogSpecies, getCatalogSubspecies, catalogEntryToSpecies, catalogEntryToSubspecies } from '../adapters/species';
import { getSpeciesDefinition, getSubspeciesDefinition } from '@/engine/characterData';
import { normalizeRace } from '@/source/fiveetools-cn/normalizers/race';
import { CharacterState } from '@/types/characterState';

describe('Catalog Species Adapter Tests', () => {



  it('should prioritize 5etools species when registered into catalog', () => {
    const raw5eRace = {
      name: '测试种族',
      ENG_name: 'Test Race',
      source: 'XPHB',
      speed: 35,
      size: ['Medium'],
      entries: [
        {
          name: '测试特质',
          entries: ['这是一个来自5etools的种族测试特质。'],
        },
      ],
    };

    const entry = normalizeRace(raw5eRace, '5etools-cn');
    defaultCatalog.register(entry);

    const dummyState = { speciesId: entry.id } as CharacterState;
    const def = getSpeciesDefinition(dummyState);
    expect(def).toBeDefined();
    expect(def?.name).toBe('测试种族');
    expect(def?.speed).toBe(35);
    expect(def?.traits.length).toBeGreaterThan(0);

    const all = getCatalogSpecies();
    const found = all.find((s) => s.id === entry.id);
    expect(found).toBeDefined();
  });

  it('uses race fluff as the species description while keeping rule entries as traits', () => {
    const entry = normalizeRace({
      name: '测试精灵', ENG_name: 'Test Elf', source: 'XPHB',
      entries: [{ name: '黑暗视觉', ENG_name: 'Darkvision', entries: ['你拥有黑暗视觉。'] }],
      fluff: { name: '测试精灵', ENG_name: 'Test Elf', source: 'XPHB', entries: ['这是未经改写的种族背景设定。'] },
    });
    const species = catalogEntryToSpecies(entry);

    expect(species.description).toBe('这是未经改写的种族背景设定。');
    expect(species.traits[0].description).toBe('你拥有黑暗视觉。');
  });
});

