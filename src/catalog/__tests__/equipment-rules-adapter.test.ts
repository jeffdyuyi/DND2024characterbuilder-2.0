import { describe, it, expect } from 'vitest';
import { normalizeItemProperty, normalizeItemMastery } from '@/source/fiveetools-cn/normalizers/rule';
import { getCatalogMasteryData, getCatalogPropertyData } from '@/catalog/adapters/equipmentRules';
import { MASTERY_DATA, PROPERTY_DATA } from '@/rules/equipment';

describe('Equipment Rules Catalog Adapter & Normalizer', () => {
  it('正确将 5etools items-base.json 中的 itemMastery 归一化为 rule 条目', () => {
    const rawMastery = {
      name: '横扫',
      ENG_name: 'Cleave',
      source: 'XPHB',
      page: 214,
      entries: [
        '当你用这把武器进行的近战攻击检定命中一个生物时...'
      ]
    };

    const entry = normalizeItemMastery(rawMastery, '5etools-cn');
    expect(entry.kind).toBe('rule');
    expect(entry.name).toBe('横扫');
    expect(entry.englishName).toBe('Cleave');
    expect(entry.description).toContain('当你用这把武器');
  });

  it('正确将 5etools items-base.json 中的 itemProperty 归一化为 rule 条目', () => {
    const rawProp = {
      abbreviation: '2H',
      source: 'XPHB',
      page: 214,
      entries: [
        {
          name: '双手',
          ENG_name: 'Two-Handed',
          entries: ['用双手武器攻击时，你需要双手并用。']
        }
      ]
    };

    const entry = normalizeItemProperty(rawProp, '5etools-cn');
    expect(entry.kind).toBe('rule');
    expect(entry.name).toBe('双手');
    expect(entry.englishName).toBe('Two-Handed');
    expect(entry.description).toContain('用双手武器攻击时');
  });

  it('未加载外部数据时平滑回退到静态兜底列表', () => {
    expect(MASTERY_DATA.Slow).toBeDefined();
    expect(MASTERY_DATA.Slow.name).toBe('缓速');
    expect(MASTERY_DATA.Nick.name).toBe('迅击');

    expect(PROPERTY_DATA['2H']).toBeDefined();
    expect(PROPERTY_DATA['2H'].name).toContain('双手');
    expect(PROPERTY_DATA['F'].name).toContain('灵巧');
  });
});
