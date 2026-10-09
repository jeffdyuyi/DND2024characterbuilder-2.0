import { describe, expect, it } from 'vitest';
import { defaultCatalog } from '../catalog';
import { createBuilderChoices, getExcludedCharacterChoices } from '../builderChoices';
import type { CatalogEntry, EntryKind } from '../types';
import { useCharacterStore } from '@/store/characterStore';
import { getSpellDefinition } from '@/engine/characterData';
import type { SourceSelection } from '@/types/sourceSelection';

function register(
  kind: EntryKind,
  source: string,
  pack = '5etools-cn',
  name = '界面来源测试',
): CatalogEntry {
  const entry: CatalogEntry = {
    id: `${pack}:${source}:${kind}:${name}`,
    source,
    sourcePackId: pack,
    name,
    englishName: name,
    kind,
    edition: 'both',
    raw: { name, source, type: kind === 'item' ? 'AT' : undefined },
  };
  defaultCatalog.register(entry);
  return entry;
}
const selected = (source: string): SourceSelection => ({
  mode: 'selected',
  books: [{ source, sourcePackId: '5etools-cn' }],
});

describe('建卡界面候选与已选详情的分离', () => {
  it('切换角色或书籍后，各主列表和嵌套查询使用当前配置，不能用局部参数绕过', () => {
    for (const kind of [
      'class',
      'race',
      'background',
      'feat',
      'spell',
      'item',
      'charoption',
    ] as EntryKind[]) {
      register(kind, 'UI-A');
      register(kind, 'UI-B');
      register(kind, 'UI-A', 'homebrew-ui');
    }
    const a = createBuilderChoices({ sourceSelection: selected('UI-A'), allowHomebrew: false });
    const b = createBuilderChoices({ sourceSelection: selected('UI-B'), allowHomebrew: true });
    for (const choices of [a, b]) {
      for (const query of [
        choices.getCatalogClasses,
        choices.getCatalogSpecies,
        choices.getCatalogBackgrounds,
        choices.getCatalogFeats,
        choices.getCatalogSpells,
        choices.getCatalogItems,
        choices.getCatalogCharacterOptions,
      ]) {
        expect(query().every((item) => item.source === (choices === a ? 'UI-A' : 'UI-B'))).toBe(
          true,
        );
        expect(query().length).toBeGreaterThan(0);
      }
    }
    expect(a.getCatalogSpells({ allowHomebrew: true }).some((spell) => spell.isHomebrew)).toBe(
      false,
    );
    expect(a.getCatalogSpells({ source: 'UI-B' })).toEqual([]);
  });

  it('固定候选列表按稳定 ID 和带出处名称筛选；技能与普通分支文字保持原样', () => {
    const a = register('spell', 'UI-A');
    const b = register('spell', 'UI-B');
    const choices = createBuilderChoices({ sourceSelection: selected('UI-A') });
    expect(choices.filterOptions([a.id, b.id], 'spell')).toEqual([a.id]);
    expect(choices.filterOptions(['界面来源测试|UI-A', '界面来源测试|UI-B'], 'spell')).toEqual([
      '界面来源测试|UI-A',
    ]);
    expect(choices.filterOptions(['athletics', 'stealth'], 'skill')).toEqual([
      'athletics',
      'stealth',
    ]);
    expect(choices.filterOptions(['分支甲', '分支乙'], 'custom')).toEqual(['分支甲', '分支乙']);
  });

  it('父职业被保留时仍按子职独立来源筛候选，不改写原列表', () => {
    const parent = register('class', 'UI-A');
    const subA = register('subclass', 'UI-A');
    const subB = register('subclass', 'UI-B');
    const full = [
      { catalogId: subA.id, source: 'UI-A' },
      { catalogId: subB.id, source: 'UI-B' },
    ];
    const choices = createBuilderChoices({ sourceSelection: selected('UI-A') });
    expect(choices.filterNested(full, parent.id)).toEqual([full[0]]);
    expect(full).toHaveLength(2);
    expect(choices.filterNested(undefined, parent.id)).toEqual([]);
  });

  it('关闭书籍后已选法术与装备仍可读取，提示涵盖逐级施法选择且不扫描角色备注', () => {
    const spell = register('spell', 'UI-B');
    const item = register('item', 'UI-B');
    const store = useCharacterStore.getState();
    const id = store.createCharacter();
    try {
      store.updateActiveCharacter({
        knownSpellIds: [spell.id],
        spellsByLevel: { wizard: { 1: { cantrips: [spell.id], spells: [] } } },
        inventoryEntries: [{ id: 'inventory-test', itemId: item.id, name: item.name }],
        name: item.id,
      });
      store.updateCharacterSources(id, { sourceSelection: selected('UI-A'), allowHomebrew: false });
      const character = useCharacterStore.getState().characters[id];
      const before = JSON.stringify(character);
      expect(createBuilderChoices(character).getCatalogSpells()).not.toContainEqual(
        expect.objectContaining({ id: spell.id }),
      );
      expect(getExcludedCharacterChoices(character).map((entry) => entry.id)).toEqual([
        spell.id,
        item.id,
      ]);
      expect(getSpellDefinition(spell.id)?.id).toBe(spell.id);
      expect(JSON.stringify(character)).toBe(before);
    } finally {
      store.deleteCharacter(id);
    }
  });

  it('后续加载只进入“全部允许”范围，不自动扩大指定书籍白名单', () => {
    const all = createBuilderChoices({});
    const limited = createBuilderChoices({ sourceSelection: selected('UI-A') });
    const later = register('spell', 'UI-LATER');
    expect(all.getCatalogSpells().some((spell) => spell.id === later.id)).toBe(true);
    expect(limited.getCatalogSpells().some((spell) => spell.id === later.id)).toBe(false);
    expect(
      createBuilderChoices({ sourceSelection: { mode: 'selected', books: [] } }).getCatalogSpells(),
    ).toEqual([]);
  });
});
