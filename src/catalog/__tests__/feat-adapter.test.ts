import { describe, it, expect } from 'vitest';
import { defaultCatalog } from '../catalog';
import { getCatalogFeats, catalogEntryToFeat } from '../adapters/feats';
import { getFeatDefinition } from '@/engine/characterData';
import { normalizeFeat } from '@/source/fiveetools-cn/normalizers/feat';

describe('Catalog Feat Adapter Tests', () => {


  it('should prioritize 5etools feat when registered into catalog', () => {
    const raw5eFeat = {
      name: '测试专长',
      ENG_name: 'Test Feat',
      source: 'XPHB',
      category: 'G',
      entries: ['这是一个来自5etools的专长测试描述。'],
      repeatable: true,
    };

    const entry = normalizeFeat(raw5eFeat, '5etools-cn');
    defaultCatalog.register(entry);

    const def = getFeatDefinition(entry.id);
    expect(def).toBeDefined();
    expect(def?.name).toBe('测试专长');
    expect(def?.category).toBe('General');
    expect(def?.repeatable).toBe(true);
    expect(def?.description).toContain('这是一个来自5etools的专长测试描述。');

    const all = getCatalogFeats();
    const found = all.find((f) => f.id === entry.id);
    expect(found).toBeDefined();
  });
});

