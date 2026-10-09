import { describe, it, expect } from 'vitest';
import { normalizeCondition } from '@/source/fiveetools-cn/normalizers/condition';
import { catalogEntryToCondition, getCatalogConditions } from '@/catalog/adapters/conditions';
import { ALL_CONDITIONS } from '@/rules/conditions';

describe('Condition Catalog Adapter & 5etools Normalizer', () => {
  it('正确将 5etools conditions.json 原始条目归一化为 CatalogEntry 并注入 Mechanics Overlay', () => {
    const raw5e = {
      name: '目盲',
      ENG_name: 'Blinded',
      source: 'XPHB',
      page: 361,
      entries: [
        '目盲状态期间，你将遭受以下效应。',
        '你无法视物，且会自动失败于任何需要视觉的属性检定。',
      ],
    };

    const entry = normalizeCondition(raw5e, '5etools-cn');
    expect(entry.kind).toBe('condition');
    expect(entry.name).toBe('目盲');
    expect(entry.englishName).toBe('Blinded');
    expect(entry.source).toBe('XPHB');
    expect(entry.edition).toBe('2024');

    const condition = catalogEntryToCondition(entry);
    expect(condition.id).toBe('blinded');
    expect(condition.name).toBe('目盲');
    expect(condition.description).toContain('你无法视物');
    // 验证规则引擎计算标记被正确注入
    expect(condition.mechanics?.disadvantageOnAttacks).toBe(true);
    expect(condition.mechanics?.advantageToBeHit).toBe(true);
  });

  it('未加载外部数据时平滑回退到静态兜底列表', () => {
    const conditions = getCatalogConditions(ALL_CONDITIONS);
    expect(conditions.length).toBeGreaterThanOrEqual(15);
    expect(conditions.some((c) => c.id === 'paralyzed')).toBe(true);
    expect(ALL_CONDITIONS.some((c) => c.name === '力竭')).toBe(true);
  });
});
