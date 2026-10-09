import { describe, it, expect } from 'vitest';
import { defaultCatalog } from '../catalog';
import { getCatalogItems, catalogEntryToItem, instantiateMagicVariants, isMagicItemDefinition } from '../adapters/items';
import { InMemoryCatalogService } from '../catalog';
import { findItemById, findItemByName } from '@/engine/characterData';
import { normalizeItem } from '@/source/fiveetools-cn/normalizers/item';

describe('Catalog Item Adapter Tests', () => {


  it('should prioritize 5etools item when registered into catalog', () => {
    const raw5eItem = {
      name: '测试魔法剑',
      ENG_name: 'Test Magic Sword',
      source: 'DMG',
      type: 'M',
      value: 50000,
      weight: 3,
      entries: ['这是一柄来自5etools的魔法测试长剑。'],
    };

    const entry = normalizeItem(raw5eItem, '5etools-cn');
    defaultCatalog.register(entry);

    const foundById = findItemById(entry.id);
    expect(foundById).toBeDefined();
    expect(foundById?.name).toBe('测试魔法剑');
    expect(foundById?.cost).toBe('500 GP');
    expect(foundById?.weight).toBe('3 磅');

    const all = getCatalogItems();
    const found = all.find((i) => i.id === entry.id);
    expect(found).toBeDefined();
  });

  it('converts public armor and shield data for the combat engine', () => {
    const medium = catalogEntryToItem(normalizeItem({ name: '测试中甲', source: 'XPHB', type: 'MA', ac: 14, value: 5000, stealth: true }, 'test')) as any;
    expect(medium.acStructured).toEqual({ base: 14, dexModEnabled: true, dexModMax: 2 });
    expect(medium.armorCategory).toBe('Medium');
    expect(medium.cost).toBe('50 GP');
    expect(medium.stealthDisadvantage).toBe(true);

    const shield = catalogEntryToItem(normalizeItem({ name: '测试盾牌', source: 'XPHB', type: 'S', ac: 2 }, 'test')) as any;
    expect(shield.acStructured).toEqual({ base: 0, dexModEnabled: false, bonus: 2 });
    expect(shield.armorCategory).toBe('Shield');
  });

  it('classifies public tool type codes as tools', () => {
    const tool = catalogEntryToItem(normalizeItem({ name: '书法工具', source: 'XPHB', type: 'AT' }, 'test')) as any;
    expect(tool.category).toBe('tool');
  });

  it('normalizes magic item calculation and attunement fields', () => {
    const item = catalogEntryToItem(normalizeItem({
      name: '测试法器', source: 'DMG', bonusAc: '+1', bonusSpellSaveDc: '+2',
      bonusSpellAttack: 2, ability: { str: 19 }, reqAttune: 'by a spellcaster',
    }, 'test')) as any;
    expect(item.bonusAc).toBe(1);
    expect(item.bonusSpellSaveDc).toBe(2);
    expect(item.bonusSpellAttack).toBe(2);
    expect(item.abilitySet).toEqual({ str: 19 });
    expect(item.requiresAttunement).toBe(true);
    expect(isMagicItemDefinition(item)).toBe(true);
  });

  it('materializes magicvariant templates against matching public base items', () => {
    const catalog = new InMemoryCatalogService();
    catalog.register(normalizeItem({
      name: '长剑', ENG_name: 'Longsword', source: 'XPHB', type: 'M', weaponCategory: 'martial', dmg1: '1d8', dmgType: 'S', property: ['V'],
    }, '5etools-cn', 'baseitem'));
    catalog.register(normalizeItem({
      name: '短弓', ENG_name: 'Shortbow', source: 'XPHB', type: 'R', weaponCategory: 'martial', dmg1: '1d6', dmgType: 'P',
    }, '5etools-cn', 'baseitem'));
    catalog.register(normalizeItem({
      name: '+1武器', ENG_name: 'Weapon, +1', source: 'XDMG', requires: [{ type: 'M' }],
      excludes: [{ name: '短弓' }], inherits: { namePrefix: '+1 ', rarity: 'uncommon', bonusWeapon: '+1', reqAttune: true, entries: ['攻击和伤害检定获得+1。'] },
    }, '5etools-cn', 'magicvariant'));

    const instances = instantiateMagicVariants(catalog, '5etools-cn');
    expect(instances).toHaveLength(1);
    const item = catalogEntryToItem(instances[0]) as any;
    expect(item.name).toBe('+1 长剑');
    expect(item.category).toBe('weapon');
    expect(item.damage).toBe('1d8');
    expect(item.properties).toEqual(['V']);
    expect(item.bonusWeapon).toBe(1);
    expect(item.requiresAttunement).toBe(true);
    expect(item.baseItemId).toBeTruthy();
  });
});

