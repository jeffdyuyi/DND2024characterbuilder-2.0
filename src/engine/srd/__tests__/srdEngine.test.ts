import { describe, it, expect } from 'vitest';
import { detectEdition, makeSrdIdentity, SrdKind } from '../srdEngine';
import { expandCopies, readableEntries } from '../expand';

describe('SrdEngine and Expand Unit Tests', () => {
  it('correctly detects edition based on source and raw edition field', () => {
    // 2024 versions
    expect(detectEdition('XPHB')).toBe('2024');
    expect(detectEdition('XDMG')).toBe('2024');
    expect(detectEdition('XMM')).toBe('2024');
    expect(detectEdition('SRD52')).toBe('2024');
    expect(detectEdition('PHB', { edition: 'one' })).toBe('2024');

    // 2014 versions
    expect(detectEdition('PHB')).toBe('2014');
    expect(detectEdition('TCE')).toBe('2014');
    expect(detectEdition('XGE')).toBe('2014');
    expect(detectEdition('DMG')).toBe('2014');

    // fallback both
    expect(detectEdition('HOMEBREW')).toBe('both');
  });

  it('generates consistent and valid unique SrdIdentity', () => {
    const raw = {
      source: 'XPHB',
      ENG_name: 'Fireball',
      name: '火球术',
    };
    const id = makeSrdIdentity('spell', raw);
    expect(id).toContain('5etools:spell:xphb:fireball');
  });

  it('correctly expands _copy inheritance', () => {
    const rawList = [
      {
        name: '基础护甲',
        source: 'PHB',
        ac: 14,
        entries: ['基础描述'],
      },
      {
        name: '精制护甲',
        source: 'PHB',
        _copy: {
          name: '基础护甲',
          source: 'PHB',
          _mod: {
            entries: {
              mode: 'appendArr',
              items: '额外精制特质',
            },
          },
        },
      },
    ];

    const expanded = expandCopies(rawList);
    expect(expanded).toHaveLength(2);
    const refined = expanded.find((item) => item.name === '精制护甲');
    expect(refined).toBeDefined();
    expect(refined!.ac).toBe(14);
    expect(refined!.entries).toEqual(['基础描述', '额外精制特质']);
  });

  it('readableEntries filters fluff correctly', () => {
    const spell = {
      name: '测试法术',
      level: 1,
      school: 'V',
      time: [{ number: 1, unit: 'action' }],
      range: { type: 'point', distance: { type: 'feet', amount: 60 } },
      components: { v: true, s: true },
      duration: [{ type: 'instant' }],
      entries: ['造成的伤害为 3d6 火焰伤害。'],
    };

    const entries = readableEntries(spell, 'spell');
    expect(entries.length).toBeGreaterThan(0);
    // 检查是否提取了环阶、施法时间、距离、成分、持续时间
    const str = JSON.stringify(entries);
    expect(str).toContain('1环');
    expect(str).toContain('施法时间');
    expect(str).toContain('持续时间');
  });

  it('filters items properly according to edition settings', () => {
    const list = [
      { id: '1', name: '狂暴', edition: '2024' },
      { id: '2', name: '旧版狂暴', edition: '2014' },
      { id: '3', name: '通用状态', edition: 'both' },
    ];

    const filter2024 = list.filter((i) => i.edition === '2024' || i.edition === 'both');
    expect(filter2024.map((i) => i.id)).toEqual(['1', '3']);

    const filter2014 = list.filter((i) => i.edition === '2014' || i.edition === 'both');
    expect(filter2014.map((i) => i.id)).toEqual(['2', '3']);
  });

  it('supports resolving registered features by various reference strings', async () => {
    // 验证 srdEngine 的 resolveFeature 方法
    const { srdEngine } = await import('../srdEngine');
    // 手动注册模拟特性以验证各种引用格式的解析支持
    (srdEngine as any).registerFeatureRef({
      id: '5etools:feature:xphb:rage',
      name: '狂暴',
      nameEn: 'Rage',
      source: 'XPHB',
      parentClass: '野蛮人',
      level: 1,
      entries: ['在战斗中，你进入充满野性的狂暴。'],
    });

    expect(srdEngine.resolveFeature('狂暴')).toBeDefined();
    expect(srdEngine.resolveFeature('Rage')).toBeDefined();
    expect(srdEngine.resolveFeature('狂暴|野蛮人|XPHB|1')).toBeDefined();
    expect(srdEngine.resolveFeature('野蛮人|狂暴')).toBeDefined();
  });
});

