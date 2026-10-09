import { describe, it, expect } from 'vitest';
import { defaultCatalog } from '../catalog';
import { getCatalogSpells, catalogEntryToSpell } from '../adapters/spells';
import { getSpellDefinition } from '@/engine/characterData';
import { normalizeSpell } from '@/source/fiveetools-cn/normalizers/spell';

describe('Catalog Spell Adapter & Integration Tests', () => {
  it('should prioritize 5etools spell when registered into catalog', () => {
    // 模拟从 5etools-cn 加载一个新法术
    const raw5eSpell = {
      name: '测试5etools法术',
      ENG_name: 'Test 5e Spell',
      source: 'XPHB',
      level: 2,
      school: 'V',
      time: [{ number: 1, unit: 'action' }],
      range: { type: 'point', distance: { type: 'feet', amount: 60 } },
      components: { v: true, s: true },
      duration: [{ type: 'instant' }],
      entries: ['这是一个来自5etools的法术测试描述。'],
      classes: {
        fromClassList: [{ name: 'Wizard', source: 'XPHB' }],
      },
    };

    const entry = normalizeSpell(raw5eSpell, '5etools-cn');
    defaultCatalog.register(entry);

    // 验证 getSpellDefinition 能直接查到 5etools 条目
    const def = getSpellDefinition(entry.id);
    expect(def).toBeDefined();
    expect(def?.name).toBe('测试5etools法术');
    expect(def?.description).toContain('这是一个来自5etools的法术测试描述。');
    expect(def?.classes).toContain('Wizard');
    expect(def?.classes).toContain('法师');

    // 验证 getCatalogSpells 包含该法术
    const all = getCatalogSpells();
    const found = all.find((s) => s.id === entry.id);
    expect(found).toBeDefined();
  });
});
