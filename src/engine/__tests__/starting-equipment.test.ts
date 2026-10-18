import { beforeEach, expect, it } from 'vitest';
import { defaultCatalog } from '@/catalog/catalog';
import { normalizeClass } from '@/source/fiveetools-cn/normalizers/class';
import { useCharacterStore } from '@/store/characterStore';
import {
  buildEquipmentState,
  normalizeEquipmentMode,
  reconcileStartingEquipment,
} from '../startingEquipment';
import { totalInCP } from '@/utils/currencyUtils';
import type { CharacterState } from '@/types/characterState';

const definition = normalizeClass({
  name: '同步测试职业',
  source: 'TST',
  startingEquipment: {
    defaultData: [
      {
        A: [{ item: '同步测试护甲|TST' }, { value: 900 }],
        B: [{ item: '同步测试长弓|TST' }, { value: 1100 }],
        C: [{ value: 15500 }],
      },
    ],
  },
});
beforeEach(() => defaultCatalog.register(definition));
function state(): CharacterState {
  const store = useCharacterStore.getState();
  const id = store.createCharacter();
  const character = structuredClone(useCharacterStore.getState().characters[id]);
  store.deleteCharacter(id);
  character.classes = [{ classId: definition.id, source: 'TST', level: 1, isMulticlass: false }];
  return character;
}
function apply(current: CharacterState, updates: Partial<CharacterState> = {}) {
  return {
    ...current,
    ...updates,
    ...reconcileStartingEquipment(current, { ...current, ...updates }),
  };
}
it('所有旧方案别名对应同一解析，B装备不再丢失且无效旧套组不跨方案应用', () => {
  const original = state();
  expect(normalizeEquipmentMode('choiceA')).toBe('package');
  expect(normalizeEquipmentMode('choiceB')).toBe('gold');
  expect(buildEquipmentState(original, 'choiceB')).toEqual(buildEquipmentState(original, 'gold'));
  const b = buildEquipmentState(original, 'choiceB');
  expect(b.inventoryEntries.map((item) => item.name)).toContain('同步测试长弓');
  expect(totalInCP(b.currency)).toBe(1100);
  expect(buildEquipmentState(original, 'choiceA', '已过时的其他套组')).toEqual(
    buildEquipmentState(original, 'package'),
  );
});
it('新角色发放一次，重复进入和JSON往返后不补发已花金币或已移除物品', () => {
  const first = apply(state());
  expect(totalInCP(first.currency)).toBe(900);
  const changed = JSON.parse(JSON.stringify(first)) as CharacterState;
  changed.currency = { cp: 0, sp: 0, ep: 0, gp: 4, pp: 0 };
  changed.inventoryEntries = [];
  const again = apply(changed);
  expect(again.currency).toEqual(changed.currency);
  expect(again.inventoryEntries).toEqual([]);
});
it('A/B/C切换只调整差额，保留手动购买物品、金币支出和装备元数据', () => {
  const original = state();
  original.currency.gp = 20;
  original.inventoryEntries = [
    { id: 'manual', name: '手动物品' },
    { id: 'purchased:test', name: '购买物品', itemId: 'purchased-item' },
  ];
  original.equipmentIds = ['purchased-item', '旧手动引用'];
  original.equippedWeaponIds = ['purchased:test'];
  let current = apply(original);
  expect(totalInCP(current.currency)).toBe(2900);
  const armor = current.inventoryEntries.find((item) => item.name === '同步测试护甲')!;
  armor.equipped = true;
  armor.notes = '用户备注';
  armor.locationId = 'bag';
  current.equippedArmorId = armor.id;
  current = apply(current, { equipmentChoiceMode: 'choiceB' });
  expect(totalInCP(current.currency)).toBe(3100);
  expect(current.inventoryEntries.map((item) => item.id)).toEqual(
    expect.arrayContaining(['manual', 'purchased:test']),
  );
  expect(current.inventoryEntries.some((item) => item.name === '同步测试护甲')).toBe(false);
  expect(current.equippedArmorId).toBeUndefined();
  expect(current.equippedWeaponIds).toEqual(['purchased:test']);
  expect(current.equipmentIds).toContain('旧手动引用');
  current.currency.gp -= 1;
  const spent = totalInCP(current.currency);
  current = apply(current, { equipmentChoiceMode: 'choiceC' });
  expect(totalInCP(current.currency)).toBe(spent + 14400);
});
it('相同发放物品的装备标记、备注和容器位置不被其他方案变化覆盖', () => {
  const original = apply(state());
  original.inventoryEntries[0].equipped = true;
  original.inventoryEntries[0].notes = '备注';
  original.inventoryEntries[0].locationId = 'bag';
  original.startingEquipmentSynced = false;
  const updated = apply(original);
  expect(updated.inventoryEntries[0]).toMatchObject({
    equipped: true,
    notes: '备注',
    locationId: 'bag',
  });
});
it('已花掉原方案金币且余额不足时拒绝整次切换，不清库存或生成负余额', () => {
  const original = apply(state(), { equipmentChoiceMode: 'choiceC' });
  original.currency = { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 };
  const before = JSON.stringify(original);
  expect(() => apply(original, { equipmentChoiceMode: 'package' })).toThrow('余额不足');
  expect(JSON.stringify(original)).toBe(before);
});
it('按用户确认旧钱包首次重算一次，保留手动和归属不明物品', () => {
  const original = state();
  delete original.startingEquipmentGrant;
  original.startingEquipmentSynced = true;
  original.currency.gp = 999;
  original.inventoryEntries = [
    { id: '职业: 旧职业 (方案A):旧物品', source: '职业: 旧职业 (方案A)', name: '旧起始物品' },
    { id: 'unknown', source: '职业调查所得', name: '归属不明物品' },
    { id: 'manual', name: '手动物品' },
  ];
  const updated = apply(original);
  expect(totalInCP(updated.currency)).toBe(900);
  expect(updated.inventoryEntries.map((item) => item.id)).toEqual(
    expect.arrayContaining(['unknown', 'manual']),
  );
  expect(updated.inventoryEntries.some((item) => item.name === '旧起始物品')).toBe(false);
  updated.currency.gp = 2;
  expect(apply(updated).currency.gp).toBe(2);
});
it('真实存储动作保存账本，职业替换后移除原方案，手动物品保留', () => {
  const store = useCharacterStore.getState();
  const id = store.createCharacter();
  try {
    const original = useCharacterStore.getState().characters[id];
    const next = {
      ...original,
      classes: [{ classId: definition.id, source: 'TST', level: 1, isMulticlass: false }],
    };
    store.updateActiveCharacter({ ...next, ...reconcileStartingEquipment(original, next) });
    const saved = useCharacterStore.getState().characters[id];
    expect(saved.startingEquipmentGrant?.inventoryIds).toHaveLength(1);
    const replacement = {
      ...saved,
      classes: [],
      inventoryEntries: [...saved.inventoryEntries, { id: 'manual', name: '手动' }],
    };
    store.updateActiveCharacter({
      ...replacement,
      ...reconcileStartingEquipment(replacement, replacement),
    });
    const changed = useCharacterStore.getState().characters[id];
    expect(changed.inventoryEntries).toEqual([{ id: 'manual', name: '手动' }]);
    expect(totalInCP(changed.currency)).toBe(0);
  } finally {
    store.deleteCharacter(id);
  }
});
