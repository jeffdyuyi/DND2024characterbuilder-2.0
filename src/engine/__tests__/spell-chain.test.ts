import { describe, expect, it } from 'vitest';
import { defaultCatalog } from '@/catalog/catalog';
import { normalizeClass } from '@/source/fiveetools-cn/normalizers/class';
import { normalizeSpell } from '@/source/fiveetools-cn/normalizers/spell';
import { catalogEntryToClass } from '@/catalog/adapters/classes';
import { catalogEntryToSpell } from '@/catalog/adapters/spells';
import { computeSpellcasting, computeSpellProgression, deriveCharacterSpellSelection, isSpellAvailableToClass } from '../spellcasting';

const baseState = (classes: any[]) => ({
  id: 'spell-chain', name: '法术测试', playerName: '', classes,
  baseAbilityScores: { str: 8, dex: 10, con: 12, int: 16, wis: 14, cha: 16 },
  backgroundAbilityBonuses: {}, selectedFeats: [], selectedSkills: [], expertiseSkills: [],
  equipmentIds: [], inventoryEntries: [], equippedWeaponIds: [], attunedItemIds: [],
  currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 }, preparedSpellIds: [], cantripIds: [], knownSpellIds: [],
  spellbookIds: [], spellSlotUsage: {}, resourceUsage: {}, selectedLanguages: [],
}) as any;

const spellRows = Array.from({ length: 20 }, (_, index) =>
  index === 0 ? [2, 0, 0] : index === 1 ? [3, 0, 0] : [4, 2, 0]
);

describe('公共法术全链路', () => {
  it('按职业来源区分 2014 与 2024 法表授权', () => {
    const spell = catalogEntryToSpell(normalizeSpell({
      name: '测试法术', source: 'TST', level: 1,
      _classGrants: [{ name: '法师', source: 'PHB' }, { name: 'Wizard', source: 'XPHB' }],
    }));
    const wizard2014 = catalogEntryToClass(normalizeClass({ name: '法师', ENG_name: 'Wizard', source: 'PHB' }));
    const wizard2024 = catalogEntryToClass(normalizeClass({ name: '法师', ENG_name: 'Wizard', source: 'XPHB' }));
    const wrongSource = catalogEntryToClass(normalizeClass({ name: '法师', ENG_name: 'Wizard', source: 'CUSTOM' }));
    expect(isSpellAvailableToClass(spell, wizard2014)).toBe(true);
    expect(isSpellAvailableToClass(spell, wizard2024)).toBe(true);
    expect(isSpellAvailableToClass(spell, wrongSource)).toBe(false);
  });

  it('稳定职业 ID 下正确计算全施法者与 2024 半施法者兼职法术位', () => {
    const wizard = normalizeClass({
      name: '链路法师', ENG_name: 'Chain Wizard', source: 'XPHB', casterProgression: 'full',
      spellcastingAbility: 'int', preparedSpells: '<$level$> + <$int_mod$>', cantripProgression: Array(20).fill(3),
      classTableGroups: [{ rowsSpellProgression: spellRows }],
    });
    const paladin = normalizeClass({
      name: '链路圣武士', ENG_name: 'Chain Paladin', source: 'XPHB', casterProgression: 'half',
      spellcastingAbility: 'cha', preparedSpells: '<$level$> + <$cha_mod$>', cantripProgression: Array(20).fill(0),
      classTableGroups: [{ rowsSpellProgression: spellRows }],
    });
    defaultCatalog.register(wizard);
    defaultCatalog.register(paladin);
    const state = baseState([
      { classId: wizard.id, source: 'XPHB', level: 3, isMulticlass: false },
      { classId: paladin.id, source: 'XPHB', level: 3, isMulticlass: true },
    ]);
    const stats = computeSpellcasting(state);
    expect(stats.casterLevel).toBe(5);
    expect(stats.spellSlots).toMatchObject({ 1: 4, 2: 3, 3: 2 });
    expect(stats.spellsPrepared).toBe(12);
    expect(computeSpellProgression(state, wizard.id)[0].newSpells).toBe(4);
  });

  it('替换旧法术后可从保存的逐级选择稳定重建最终法表', () => {
    const wizard = normalizeClass({
      name: '重建法师', ENG_name: 'Restore Wizard', source: 'XPHB', casterProgression: 'full',
      spellcastingAbility: 'int', preparedSpellsProgression: [2], cantripProgression: Array(20).fill(1),
      classTableGroups: [{ rowsSpellProgression: spellRows }],
    });
    defaultCatalog.register(wizard);
    const oldSpell = normalizeSpell({ name: '旧法术', source: 'XPHB', level: 1 });
    const newSpell = normalizeSpell({ name: '新法术', source: 'XPHB', level: 1 });
    const cantrip = normalizeSpell({ name: '测试戏法', source: 'XPHB', level: 0 });
    [oldSpell, newSpell, cantrip].forEach((spell) => defaultCatalog.register(spell));
    const state = baseState([{ classId: wizard.id, source: 'XPHB', level: 1, isMulticlass: false }]);
    state.spellsByLevel = { [wizard.id]: { 1: {
      cantrips: [cantrip.id], spells: [oldSpell.id, newSpell.id], replacedSpell: oldSpell.id,
      extra: { wizard_spellbook_lvl1: [oldSpell.id, newSpell.id] },
    } } };
    const first = deriveCharacterSpellSelection(state);
    const reopened = deriveCharacterSpellSelection(JSON.parse(JSON.stringify(state)));
    expect(first).toEqual(reopened);
    expect(first.cantripIds).toEqual([cantrip.id]);
    expect(first.preparedSpellIds).toEqual([newSpell.id]);
    expect(first.spellbookIds).toEqual([oldSpell.id, newSpell.id]);
  });
});
