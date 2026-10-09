import { describe, expect, it } from 'vitest';
import { getSourceSortWeight, sortBySourcePriority } from '@/config/sourceMapping';

describe('建卡书籍优先顺序', () => {
  it('玩家手册双版本、塔莎和珊娜萨优先于其他官方来源', () => {
    const input = ['MPMM', 'XDMG', 'SCAG', 'XGE', 'TCE', 'PHB', 'XPHB'].map((source) => ({
      source,
    }));
    expect(sortBySourcePriority(input).map((item) => item.source)).toEqual([
      'XPHB',
      'PHB',
      'TCE',
      'XGE',
      'MPMM',
      'XDMG',
      'SCAG',
    ]);
    expect(input[0].source).toBe('MPMM');
    expect(getSourceSortWeight('PHB2024')).toBe(getSourceSortWeight('XPHB'));
    expect(getSourceSortWeight('2014 玩家手册')).toBe(getSourceSortWeight('PHB'));
    expect(getSourceSortWeight('塔莎的万事坩埚')).toBe(getSourceSortWeight('TCE'));
    expect(getSourceSortWeight('珊娜萨的万事指南')).toBe(getSourceSortWeight('XGE'));
    expect(getSourceSortWeight('其他资料 2014')).toBeGreaterThan(getSourceSortWeight('XGE'));
  });
});
