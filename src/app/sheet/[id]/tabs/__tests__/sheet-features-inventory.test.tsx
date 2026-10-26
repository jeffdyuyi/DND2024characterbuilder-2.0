import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

vi.mock('@/engine/characterData', () => ({
  getSpeciesDefinition: () => undefined,
  getBackgroundDefinition: () => undefined,
  getClassDefinition: (id: string) => ({
    name: id,
    nameEn: id,
    source: 'XPHB',
    hitPointDie: 8,
    proficiencies: { savingThrows: [] },
    features: [{ name: `${id}基础`, level: 1, description: `${id}正文` }],
  }),
  getSubclassDefinition: (character: any) => ({
    name: `${character.classes[0].classId}子职业`,
    traits: [{ name: `${character.classes[0].classId}进阶`, level: 2, description: '子职业正文' }],
  }),
  getFeatDefinition: () => undefined,
  getSpellDefinition: () => undefined,
  findItemById: () => undefined,
  getAttunementStatus: () => ({ count: 0, limit: 3 }),
  isProficientWithArmor: () => false,
}));
vi.mock('@/catalog', () => ({
  getCatalogCharacterOptions: () => [],
  getCatalogItems: () => [],
  isMagicItemDefinition: () => false,
}));
vi.mock('@/platform/CatalogProvider', () => ({ useCatalog: () => ({ status: 'ready' }) }));
vi.mock('@/engine/ability', () => ({
  computeAbilityScores: () => ({
    modifiers: { str: -1, dex: -1, con: -1, int: -1, wis: -1, cha: -1 },
  }),
}));
vi.mock('@/components/PillButton', () => ({
  default: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
}));

import FeaturesTab from '../FeaturesTab';
import InventoryTab from '../InventoryTab';

const character = {
  id: 'sheet-test',
  name: '测试角色',
  classes: [
    { classId: '吟游诗人', level: 1, subclassId: 'A' },
    { classId: '法师', level: 2, subclassId: 'B' },
  ],
  baseAbilityScores: { str: 8, dex: 8, con: 8, int: 8, wis: 8, cha: 8 },
  selectedFeats: [],
  classSelections: {},
  inventoryEntries: [],
  currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
  attunedItemIds: [],
  containers: [],
};

it('正式卡展示每个已获得职业与对应等级子职业特性', () => {
  const html = renderToStaticMarkup(
    <FeaturesTab
      character={character}
      router={{ push() {} }}
      id={character.id}
      activeCategory="职业"
      onUpdateResource={() => {}}
    />,
  );
  expect(html).toContain('吟游诗人基础');
  expect(html).toContain('法师基础');
  expect(html).toContain('法师进阶');
  expect(html).not.toContain('吟游诗人进阶');
});

it('物品页在查看模式提供编辑入口，编辑模式提供目录与自定义入口', () => {
  const view = renderToStaticMarkup(
    <InventoryTab
      character={character as any}
      updateActiveCharacter={() => {}}
      isEditMode={false}
      onEnableEdit={() => {}}
    />,
  );
  const edit = renderToStaticMarkup(
    <InventoryTab
      character={character as any}
      updateActiveCharacter={() => {}}
      isEditMode
      onEnableEdit={() => {}}
    />,
  );
  expect(view).toContain('编辑物品与钱币');
  expect(edit).toContain('添加物品');
  expect(edit).toContain('自定义物品');
});
