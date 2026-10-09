import { describe, it, expect, beforeEach } from 'vitest';
import {
  useHomebrewStore,
  deriveActiveData,
  sanitizeHomebrewEntry,
  HomebrewPack,
} from '../homebrewStore';
import {
  exportPackToJSON,
  exportSingleCardToJSON,
  parseImportedJSON,
} from '@/utils/homebrewConverter';

describe('HomebrewPack 架构与存储驱动测试', () => {
  beforeEach(() => {
    // 重置 store 状态
    const store = useHomebrewStore.getState();
    const packs = store.packs;
    packs.forEach((p) => store.deletePack(p.id));
    const defaultPack = store.createPack('测试初始包', { author: '测试员', version: '1.0.0' });
    store.setActivePack(defaultPack.id);
  });

  it('创建卡包与包内添加条目正确，且自动同步到全局活跃列表', () => {
    const store = useHomebrewStore.getState();
    const pack = store.createPack('绝冬城法术包', { author: '艾尔敏斯特', version: '1.2.0' });
    expect(pack.name).toBe('绝冬城法术包');

    // 向新包添加法术
    store.addEntryToPack(pack.id, 'spells', {
      id: 'spell-frost-beam',
      name: '极寒射线',
      nameEn: 'Frost Beam',
      level: 2,
      school: '塑能系',
      description: '射出一道刺骨冰霜射线。',
    } as any);

    const updatedState = useHomebrewStore.getState();
    // 全局活跃法术列表中应包含此法术
    const activeSpell = updatedState.spells.find((s) => s.id === 'spell-frost-beam');
    expect(activeSpell).toBeDefined();
    expect(activeSpell?.name).toBe('极寒射线');
    expect(activeSpell?.sourcePackId).toBe(pack.id);
  });

  it('整包一键停用 (enabled: false) 时，包内条目自动从全局活跃列表中撤出', () => {
    const store = useHomebrewStore.getState();
    const pack = store.createPack('鸦阁私设包', { author: '斯特拉德' });

    store.addEntryToPack(pack.id, 'feats', {
      id: 'feat-vampiric-gaze',
      name: '吸血鬼凝视',
      nameEn: 'Vampiric Gaze',
      category: 'General',
      description: '凝视目标使其震慑。',
    } as any);

    // 启用状态下存在
    expect(useHomebrewStore.getState().feats.some((f) => f.id === 'feat-vampiric-gaze')).toBe(true);

    // 停用卡包
    store.togglePackEnabled(pack.id, false);
    // 撤出活跃列表
    expect(useHomebrewStore.getState().feats.some((f) => f.id === 'feat-vampiric-gaze')).toBe(
      false,
    );

    // 重新启用
    store.togglePackEnabled(pack.id, true);
    expect(useHomebrewStore.getState().feats.some((f) => f.id === 'feat-vampiric-gaze')).toBe(true);
  });

  it('旧版散落扁平条目自动升级迁移为独立卡包', () => {
    // 模拟旧版本没有 packs 字段的 persisted 数据
    const legacyPersisted = {
      spells: [{ id: 'legacy-spell-1', name: '旧版法术', level: 1, description: '旧数据' }],
      items: [{ id: 'legacy-item-1', name: '旧版魔法剑', type: '武器', description: '旧武器' }],
      monsters: [],
      feats: [],
      species: [],
      backgrounds: [],
      classes: [],
    };

    const migrated = (useHomebrewStore as any).persist?.getOptions()?.migrate?.(legacyPersisted, 2);
    expect(migrated).toBeDefined();
    expect(migrated.packs.length).toBeGreaterThan(0);
    const legacyPack = migrated.packs.find((p: any) => p.name.includes('本地自制卡包 (自动迁移)'));
    expect(legacyPack).toBeDefined();
    expect(legacyPack.data.spells.length).toBe(1);
    expect(legacyPack.data.spells[0].name).toBe('旧版法术');
    expect(legacyPack.data.items[0].name).toBe('旧版魔法剑');
  });

  it('单卡与整包导出 JSON 包含 5etools 和本系统标准字段', () => {
    const store = useHomebrewStore.getState();
    const pack = store.createPack('导出测试包', { author: '作者A', version: '2.0.0' });
    store.addEntryToPack(pack.id, 'spells', {
      id: 'spell-fire-nova',
      name: '火焰新星',
      nameEn: 'Fire Nova',
      level: 3,
      school: '塑能系',
      description: '爆发火焰冲击波。',
    } as any);

    // 整包导出
    const packJson = store.exportAsJSON(pack.id);
    const parsed = JSON.parse(packJson);
    expect(parsed._meta).toBeDefined();
    expect(parsed._meta.sources[0].full).toBe('导出测试包');
    expect(parsed.spell.length).toBe(1);
    expect(parsed.spell[0].name).toBe('火焰新星');
    expect(parsed.dnd2024Pack.id).toBe(pack.id);

    // 单卡导出
    const singleCardJson = store.exportSingleCardJSON('spells', 'spell-fire-nova', pack.id);
    expect(singleCardJson).not.toBeNull();
    const singleParsed = JSON.parse(singleCardJson!);
    expect(singleParsed.category).toBe('spells');
    expect(singleParsed.card.name).toBe('火焰新星');
  });

  it('智能导入：兼容 5etools 原生 homebrew 格式', () => {
    const raw5etoolsJson = JSON.stringify({
      _meta: {
        sources: [
          {
            json: 'TomeOfMagic',
            abbreviation: 'ToM',
            full: 'Tome of Magic Expansion',
            authors: ['Archmage'],
            version: '1.0.0',
          },
        ],
      },
      spell: [
        {
          name: '奥术风暴',
          ENG_name: 'Arcane Storm',
          source: 'ToM',
          level: 4,
          school: '塑能',
          entries: ['唤来奥术风暴打击敌人。'],
        },
      ],
      item: [
        {
          name: '秘银护符',
          ENG_name: 'Mithral Amulet',
          source: 'ToM',
          type: '奇物',
          rarity: 'rare',
          entries: ['提升法术豁免 DC。'],
        },
      ],
    });

    const store = useHomebrewStore.getState();
    const importRes = store.importFromJSON(raw5etoolsJson);
    expect(importRes.success).toBe(true);
    expect(importRes.count).toBe(2);

    const activeState = useHomebrewStore.getState();
    const importedSpell = activeState.spells.find((s) => s.name === '奥术风暴');
    expect(importedSpell).toBeDefined();
    expect(importedSpell?.nameEn).toBe('Arcane Storm');
    expect(importedSpell?.level).toBe(4);

    const importedItem = activeState.items.find((i) => i.name === '秘银护符');
    expect(importedItem).toBeDefined();
  });
});
