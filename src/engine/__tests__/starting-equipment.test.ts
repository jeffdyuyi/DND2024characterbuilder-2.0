import { getEquipmentChoiceCandidates } from '@/catalog/equipmentChoices';
import { catalogEntryToClass } from '@/catalog/adapters/classes';
import { normalizeItem } from '@/source/fiveetools-cn/normalizers/item';
import { beforeEach, expect, it } from 'vitest';
import { defaultCatalog } from '@/catalog/catalog';
import { normalizeClass } from '@/source/fiveetools-cn/normalizers/class';
import { useCharacterStore } from '@/store/characterStore';
import {
  buildEquipmentState,
  getStartingEquipmentKey,
  parseStartingGoldFormula,
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
it('2014随机起始金币须确定结果，改额只结算差额且不产生伪物品', () => {
  const legacy = normalizeClass({
    name: '随机金币测试职业',
    source: 'PHB',
    startingEquipment: {
      defaultData: [{ _: ['盾牌|PHB'] }],
      goldAlternative: '{@dice 2d4 × 10|2d4 × 10|起始金币}',
    },
  });
  defaultCatalog.register(legacy);
  const original = {
    ...state(),
    classes: [{ classId: legacy.id, source: 'PHB', level: 1, isMulticlass: false }],
  };
  const first = apply(original);
  expect(parseStartingGoldFormula('2d4 × 10')).toEqual({ count: 2, faces: 4, multiplier: 10 });
  expect(() => apply(first, { equipmentChoiceMode: 'gold' })).toThrow('请先掷骰或填写');
  const selected = apply(first, {
    equipmentChoiceMode: 'gold',
    startingGoldRoll: { classId: legacy.id, amount: 50 },
  });
  expect(totalInCP(selected.currency)).toBe(5000);
  expect(selected.inventoryEntries).toEqual([]);
  selected.inventoryEntries.push({ id: 'manual', name: '购买物品' });
  const edited = apply(selected, { startingGoldRoll: { classId: legacy.id, amount: 60 } });
  expect(totalInCP(edited.currency)).toBe(6000);
  expect(edited.inventoryEntries.map((entry) => entry.name)).toContain('购买物品');
  expect(apply(edited).currency).toEqual(edited.currency);
  const back = apply(edited, { equipmentChoiceMode: 'package' });
  expect(totalInCP(back.currency)).toBe(0);
  expect(back.inventoryEntries.map((entry) => entry.name)).toEqual(['盾牌', '购买物品']);
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
it('从提供C方案的职业换到只提供A/B的职业时恢复A方案并保留购买物品', () => {
  const oldClass = apply(state(), { equipmentChoiceMode: 'choiceC' });
  oldClass.inventoryEntries.push({ id: 'purchased:test', name: '购买物品' });
  const legacy = normalizeClass({
    name: '逐行装备职业',
    source: 'PHB',
    startingEquipment: {
      defaultData: [{ a: ['盾牌|phb'], b: [{ equipmentType: 'weaponSimple' }] }],
      default: ['(a) 一个盾牌或(b)任意简易武器'],
    },
  });
  defaultCatalog.register(legacy);
  const replaced = apply(oldClass, {
    classes: [{ classId: legacy.id, source: 'PHB', level: 1, isMulticlass: false }],
  });
  expect(replaced.equipmentChoiceMode).toBe('package');
  expect(replaced.inventoryEntries.map((item) => item.name)).toContain('盾牌');
  expect(replaced.inventoryEntries.map((item) => item.name)).toContain('购买物品');
  expect(totalInCP(replaced.currency)).toBe(0);
  expect(apply(replaced).inventoryEntries).toEqual(replaced.inventoryEntries);

  const stale = { ...oldClass, classes: replaced.classes };
  expect(getStartingEquipmentKey(stale)).not.toBe(oldClass.startingEquipmentGrant?.key);
  expect(apply(stale).equipmentChoiceMode).toBe('package');
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

it('原生结构化装备保留书籍及资料包身份和数量，不用同名新版或第三方替换', () => {
  const name = '来源测试道具';
  const phb = normalizeItem({ name, source: 'PHB' });
  const xphb = normalizeItem({ name, source: 'XPHB' });
  const thirdParty = normalizeItem({ name, source: 'PHB' }, 'homebrew-test');
  defaultCatalog.registerMany([xphb, thirdParty, phb]);
  const cls = normalizeClass({
    name: '来源测试职业',
    source: 'XPHB',
    startingEquipment: {
      defaultData: [
        {
          A: [{ item: name + '|PHB', quantity: 8 }, { value: 900 }],
          B: [{ item: name + '|XPHB', quantity: 2 }, { value: 1100 }],
        },
      ],
    },
  });
  defaultCatalog.register(cls);
  const original = state();
  original.classes[0].classId = cls.id;
  const a = buildEquipmentState(original, 'package');
  expect(a.inventoryEntries).toHaveLength(1);
  expect(a.inventoryEntries[0]).toMatchObject({ itemId: phb.id, name, quantity: 8 });
  expect(totalInCP(a.currency)).toBe(900);
  const b = buildEquipmentState(original, 'gold');
  expect(b.inventoryEntries[0]).toMatchObject({ itemId: xphb.id, name, quantity: 2 });
  expect(totalInCP(b.currency)).toBe(1100);
});
it('原引用来源尚未加载时保留可追溯记录，后加载才绑定，不改写raw或钱包', () => {
  const name = '后加载测试道具';
  defaultCatalog.register(normalizeItem({ name, source: 'XPHB' }));
  const raw = {
    name: '后加载测试职业',
    source: 'XPHB',
    startingEquipment: {
      defaultData: [
        { A: [{ item: name + '|PHB', quantity: 3 }, { value: 900 }], B: [{ value: 5000 }] },
      ],
    },
  };
  const before = JSON.stringify(raw);
  const cls = normalizeClass(raw);
  defaultCatalog.register(cls);
  const original = state();
  original.classes[0].classId = cls.id;
  let current = apply(original);
  expect(current.inventoryEntries[0].itemId).toBeUndefined();
  expect(current.inventoryEntries[0].notes).toContain(name + '|PHB');
  expect(current.inventoryEntries[0].quantity).toBe(3);
  const item = normalizeItem({ name, source: 'PHB' });
  defaultCatalog.register(item);
  current.currency = { cp: 0, sp: 0, ep: 0, gp: 4, pp: 0 };
  current = apply(current);
  expect(current.inventoryEntries[0].itemId).toBe(item.id);
  expect(totalInCP(current.currency)).toBe(400);
  expect(JSON.stringify(raw)).toBe(before);
});
it('同包同书存在多个同名候选时不擅自任选一件', () => {
  const name = '冲突测试道具';
  defaultCatalog.registerMany([
    normalizeItem({ name, source: 'PHB' }),
    normalizeItem({ name, source: 'PHB' }, '5etools-cn', 'baseitem'),
  ]);
  const cls = normalizeClass({
    name: '冲突测试职业',
    source: 'XPHB',
    startingEquipment: { defaultData: [{ A: [{ item: name + '|PHB' }], B: [{ value: 5000 }] }] },
  });
  defaultCatalog.register(cls);
  const original = state();
  original.classes[0].classId = cls.id;
  const result = buildEquipmentState(original, 'package');
  expect(result.inventoryEntries[0].itemId).toBeUndefined();
  expect(result.inventoryEntries[0].notes).toContain('未找到唯一的同来源物品');
});

it('2014逐行分支与抽象装备按原生字段生成候选，保存精确物品身份', () => {
  const simple = normalizeItem({
    name: '旧简易近战',
    source: 'PHB',
    type: 'M',
    weaponCategory: 'simple',
  });
  const ranged = normalizeItem({
    name: '旧简易远程',
    source: 'PHB',
    type: 'R',
    weaponCategory: 'simple',
  });
  const martial = normalizeItem({
    name: '旧军用近战',
    source: 'PHB',
    type: 'M',
    weaponCategory: 'martial',
  });
  const modern = normalizeItem({
    name: '新简易近战',
    source: 'XPHB',
    type: 'M|XPHB',
    weaponCategory: 'simple',
  });
  const focus = normalizeItem({
    name: '测试木质法杖',
    source: 'PHB',
    type: 'SCF',
    scfType: 'druid',
  });
  const wrongFocus = normalizeItem({
    name: '测试奥术法杖',
    source: 'PHB',
    type: 'SCF',
    scfType: 'arcane',
  });
  const magic = normalizeItem({
    name: '测试魔法简易近战',
    source: 'PHB',
    type: 'M',
    weaponCategory: 'simple',
    rarity: 'rare',
  });
  const brew = normalizeItem(
    { name: '第三方简易近战', source: 'PHB', type: 'M', weaponCategory: 'simple' },
    'homebrew-test',
  );
  defaultCatalog.registerMany([simple, ranged, martial, modern, focus, wrongFocus, magic, brew]);
  const raw = {
    name: '2014逐行测试职业',
    source: 'PHB',
    startingEquipment: {
      default: [
        '(a) {@item 旧固定装备|PHB} 或(b) {@filter 简易近战武器|items|source=phb|type=简易武器;近战武器=sand}',
        '固定物资与法器',
      ],
      defaultData: [
        { a: ['旧固定装备|PHB'], b: [{ equipmentType: 'weaponSimpleMelee' }] },
        {
          _: [
            { item: '旧固定装备|PHB', quantity: 2 },
            { equipmentType: 'focusSpellcastingDruidic' },
          ],
        },
      ],
    },
  };
  const before = JSON.stringify(raw);
  const cls = normalizeClass(raw);
  defaultCatalog.register(cls);
  const def = catalogEntryToClass(cls);
  const rows = def.startingEquipment.choiceRows!;
  const weapon = rows[0].options[1].records[0],
    focusSlot = rows[1].fixedRecords[1];
  const original = state();
  original.classes[0] = { classId: cls.id, source: 'PHB', level: 1, isMulticlass: false };
  const ids = getEquipmentChoiceCandidates(weapon, original).map((item) => item.id);
  expect(ids).toContain(simple.id);
  for (const invalid of [ranged, martial, modern, magic, brew])
    expect(ids).not.toContain(invalid.id);
  expect(getEquipmentChoiceCandidates(focusSlot, original).map((item) => item.id)).toContain(
    focus.id,
  );
  expect(getEquipmentChoiceCandidates(focusSlot, original).map((item) => item.id)).not.toContain(
    wrongFocus.id,
  );
  original.classSelections = {
    [rows[0].id]: ['b'],
    [weapon.selectionId!]: [simple.id],
    [focusSlot.selectionId!]: [focus.id],
  };
  let current = apply(original);
  expect(current.inventoryEntries).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ itemId: simple.id, quantity: 1 }),
      expect.objectContaining({ itemId: focus.id, quantity: 1 }),
      expect.objectContaining({ name: '旧固定装备', quantity: 2 }),
    ]),
  );
  current = JSON.parse(JSON.stringify(current));
  expect(apply(current).inventoryEntries).toEqual(current.inventoryEntries);
  current = apply(current, {
    classSelections: { ...current.classSelections, [rows[0].id]: ['a'] },
  });
  expect(current.inventoryEntries.some((item) => item.itemId === simple.id)).toBe(false);
  expect(current.inventoryEntries.some((item) => item.itemId === focus.id)).toBe(true);
  expect(JSON.stringify(raw)).toBe(before);
});
it('2014旧套组文字唯一匹配时恢复原分支，歧义时拒绝写入而不是默认猜选', () => {
  const cls = normalizeClass({
    name: '旧套组恢复测试职业',
    source: 'PHB',
    startingEquipment: { defaultData: [{ a: ['甲|PHB'], b: ['乙|PHB'] }, { _: ['丙|PHB'] }] },
  });
  defaultCatalog.register(cls);
  const original = state();
  original.classes[0].classId = cls.id;
  original.selectedClassPackage = '乙，丙';
  expect(
    buildEquipmentState(original, 'package').inventoryEntries.map((item) => item.name),
  ).toEqual(['乙', '丙']);
  const ambiguous = normalizeClass({
    name: '旧套组歧义测试职业',
    source: 'PHB',
    startingEquipment: { defaultData: [{ a: ['同名|PHB'], b: ['同名|XPHB'] }] },
  });
  defaultCatalog.register(ambiguous);
  original.classes[0].classId = ambiguous.id;
  original.selectedClassPackage = '同名';
  const before = JSON.stringify(original);
  expect(() => apply(original)).toThrow('无法唯一匹配');
  expect(JSON.stringify(original)).toBe(before);
});
it('未知抽象类别保留未解决记录，多件自选独立记入各槽位', () => {
  const cls = normalizeClass({
    name: '多槽装备测试职业',
    source: 'PHB',
    startingEquipment: {
      defaultData: [
        {
          _: [
            { equipmentType: 'instrumentMusical', quantity: 2 },
            { equipmentType: 'unknownCategory' },
          ],
        },
      ],
    },
  });
  defaultCatalog.register(cls);
  const rows = catalogEntryToClass(cls).startingEquipment.choiceRows!;
  expect(rows[0].fixedRecords).toHaveLength(3);
  expect(new Set(rows[0].fixedRecords.map((record) => record.selectionId)).size).toBe(3);
  const unknown = rows[0].fixedRecords[2];
  expect(getEquipmentChoiceCandidates(unknown)).toEqual([]);
  const original = state();
  original.classes[0].classId = cls.id;
  const result = buildEquipmentState(original, 'package');
  expect(result.inventoryEntries).toHaveLength(3);
  expect(new Set(result.inventoryEntries.map((item) => item.id)).size).toBe(3);
  expect(result.inventoryEntries.every((item) => !item.itemId)).toBe(true);
});

it('旧机器键套组文字仍恢复正确分支，多件相同自选物品保持独立实例', () => {
  const instrument = normalizeItem({ name: '独立槽位测试乐器', source: 'PHB', type: 'INS' });
  defaultCatalog.register(instrument);
  const cls = normalizeClass({
    name: '旧机器键套组测试职业',
    source: 'PHB',
    startingEquipment: {
      defaultData: [
        { a: ['固定物品|PHB'], b: [{ equipmentType: 'instrumentMusical', quantity: 2 }] },
      ],
    },
  });
  defaultCatalog.register(cls);
  const original = state();
  original.classes[0].classId = cls.id;
  original.selectedClassPackage = '自选instrumentMusical';
  const rows = catalogEntryToClass(cls).startingEquipment.choiceRows!;
  original.classSelections = Object.fromEntries(
    rows[0].options[1].records.map((record) => [record.selectionId!, [instrument.id]]),
  );
  const result = buildEquipmentState(original, 'package');
  expect(result.inventoryEntries).toHaveLength(2);
  expect(
    result.inventoryEntries.every((item) => item.itemId === instrument.id && item.quantity === 1),
  ).toBe(true);
  expect(new Set(result.inventoryEntries.map((item) => item.id)).size).toBe(2);
});

it('逐行选择键绑定来源与AST内容，行顺序改变不串用记录，重复行仍独立', () => {
  const first = { a: ['甲|PHB'], b: [{ equipmentType: 'weaponSimple' }] };
  const second = { _: ['乙|PHB'] };
  const definition = (rows: unknown[]) =>
    catalogEntryToClass(
      normalizeClass({
        name: '稳定装备键测试职业',
        source: 'PHB',
        startingEquipment: { defaultData: rows },
      }),
    ).startingEquipment.choiceRows!;
  const original = definition([first, second]);
  const reordered = definition([second, first]);
  expect(original[0].id).toBe(reordered[1].id);
  expect(original[1].id).toBe(reordered[0].id);
  const repeated = definition([first, first]);
  expect(repeated[0].id).not.toBe(repeated[1].id);
});

it('同一行存在无法绑定到分支的不同来源过滤时不扩大候选', () => {
  const cls = normalizeClass({
    name: '冲突来源过滤测试职业',
    source: 'PHB',
    startingEquipment: {
      default: ['{@filter 简易|items|source=phb} 或 {@filter 简易|items|source=xphb}'],
      defaultData: [
        { a: [{ equipmentType: 'weaponSimple' }], b: [{ equipmentType: 'weaponSimple' }] },
      ],
    },
  });
  const record = catalogEntryToClass(cls).startingEquipment.choiceRows![0].options[0].records[0];
  expect(record.equipmentFilterUnresolved).toBe(true);
  expect(getEquipmentChoiceCandidates(record)).toEqual([]);
});
