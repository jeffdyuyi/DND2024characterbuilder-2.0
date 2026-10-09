import { describe, it, expect, beforeEach } from 'vitest';
import { defaultCatalog } from '@/catalog/catalog';
import { normalizeSpell } from '@/source/fiveetools-cn/normalizers/spell';
import { getCatalogSpells } from '@/catalog/adapters/spells';

describe('第三方扩展 / Homebrew 开关与原生字段引用测试', () => {
  beforeEach(() => {
    // 注入官方戏法与第三方 Homebrew 戏法
    defaultCatalog.register(normalizeSpell({
      name: '舞光术',
      ENG_name: 'Dancing Lights',
      source: 'XPHB',
      level: 0,
      classes: { fromClassList: [{ name: 'Wizard', source: 'XPHB' }] },
      entries: ['你在施法距离内升起最多四个微弱的光团。'],
    }, '5etools-cn'));

    // 阴魂虚空 2024 中的 Preserve（GrimHollowPG24，无中文译名，纯英文原生）
    defaultCatalog.register(normalizeSpell({
      name: 'Preserve',
      ENG_name: 'Preserve',
      source: 'GrimHollowPG24',
      level: 0,
      classes: { fromClassList: [{ name: 'Wizard', source: 'GrimHollowPG24' }] },
      entries: ['You touch a corpse or other remains...'],
    }, 'homebrew-tjliqy'));

    // MCDM 折磨骑士中的 仇杀剑 / Vengeful Blade（IllR，5etools 原生双语）
    defaultCatalog.register(normalizeSpell({
      name: '仇杀剑',
      ENG_name: 'Vengeful Blade',
      source: 'IllR',
      level: 0,
      classes: { fromClassList: [{ name: 'Wizard', source: 'IllR' }] },
      entries: ['作为施法的一部分，你用武器进行一次近战攻击。'],
    }, 'homebrew-tjliqy'));
  });

  it('当 allowHomebrew 为 false 时，只返回官方出版物法术，排除第三方内容', () => {
    const spells = getCatalogSpells({ allowHomebrew: false });
    const spellNames = spells.map(s => s.name);
    
    expect(spellNames).toContain('舞光术');
    expect(spellNames).not.toContain('Preserve');
    expect(spellNames).not.toContain('仇杀剑');
  });

  it('当 allowHomebrew 为 true 时，返回包含第三方扩展的全部候选法术', () => {
    const spells = getCatalogSpells({ allowHomebrew: true });
    const spellNames = spells.map(s => s.name);
    
    expect(spellNames).toContain('舞光术');
    expect(spellNames).toContain('Preserve');
    expect(spellNames).toContain('仇杀剑');
  });

  it('第三方内容零篡改：原生保留原始字段，不擅自机翻英文或篡改出处代码', () => {
    const spells = getCatalogSpells({ allowHomebrew: true });
    
    const preserve = spells.find(s => s.name === 'Preserve');
    expect(preserve).toBeDefined();
    expect(preserve?.name).toBe('Preserve'); // 绝不擅自机翻为“保存术”或“防腐术”
    expect(preserve?.source).toBe('GrimHollowPG24');
    expect(preserve?.isHomebrew).toBe(true);

    const vengefulBlade = spells.find(s => s.name === '仇杀剑');
    expect(vengefulBlade).toBeDefined();
    expect(vengefulBlade?.name).toBe('仇杀剑');
    expect(vengefulBlade?.nameEn).toBe('Vengeful Blade');
    expect(vengefulBlade?.source).toBe('IllR');
    expect(vengefulBlade?.isHomebrew).toBe(true);
  });
});
