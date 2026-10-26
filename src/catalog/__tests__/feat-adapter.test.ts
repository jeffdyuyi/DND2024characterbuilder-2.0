import { describe, it, expect } from 'vitest';
import { defaultCatalog } from '../catalog';
import { getCatalogFeats, catalogEntryToFeat } from '../adapters/feats';
import { getFeatDefinition } from '@/engine/characterData';
import { normalizeFeat } from '@/source/fiveetools-cn/normalizers/feat';

describe('Catalog Feat Adapter Tests', () => {
  it('从原生属性分配法条提取两点配置，不将其他描述误判为属性提升', () => {
    const feat = catalogEntryToFeat(
      normalizeFeat(
        {
          name: '属性分配测试',
          ENG_name: 'Ability Allocation',
          source: 'XPHB',
          category: 'G',
          entries: ['你选择的一项属性提升 2，或者你选择的两项属性各提升 1。你无法使其超过 20。'],
        },
        '5etools-cn',
      ),
    );
    expect(feat.mechanics?.abilityScoreImprovement).toEqual([
      { points: 2, options: ['str', 'dex', 'con', 'int', 'wis', 'cha'], allowSplit: true },
    ]);
    const other = catalogEntryToFeat(
      normalizeFeat(
        {
          name: '其他测试',
          source: 'XPHB',
          entries: ['你可以使一项属性提升 2。'],
        },
        '5etools-cn',
      ),
    );
    expect(other.mechanics?.abilityScoreImprovement).toBeUndefined();
  });
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
