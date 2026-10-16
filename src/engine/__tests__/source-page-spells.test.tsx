import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, expect, it, vi } from 'vitest';
import { defaultCatalog } from '@/catalog/catalog';
import { createBuilderChoices } from '@/catalog/builderChoices';
import { normalizeSpell } from '@/source/fiveetools-cn/normalizers/spell';
import { normalizeFeat } from '@/source/fiveetools-cn/normalizers/feat';
import type { CharacterState } from '@/types/characterState';
import {
  buildSpellSourceMap,
  deriveCharacterSpellSelection,
  getInnateSpells,
} from '../spellcasting';
import { getSpellDefinition } from '../characterData';
import { exportToJSON, importFromJSON } from '../importExport';

const update = vi.hoisted(() => vi.fn());
vi.mock('@/platform/useBuilderChoices', () => ({
  useBuilderChoices: () => createBuilderChoices({}),
}));
vi.mock('@/platform/CatalogProvider', () => ({ useCatalog: () => ({ status: 'ready' }) }));
vi.mock('@/store/characterStore', () => ({
  useCharacterStore: () => ({ updateActiveCharacter: update }),
}));
vi.mock('../characterData', async (load) => ({
  ...(await load<typeof import('../characterData')>()),
  getSpeciesDefinition: (state: CharacterState) =>
    state.speciesId === 'test-species'
      ? {
          traits: [
            {
              id: 'magic',
              features: {
                spells: [
                  {
                    numToChoose: 1,
                    options: [
                      { spellId: first.id, level: 1, isPrepared: true },
                      { spellId: second.id, level: 1, isPrepared: true },
                    ],
                  },
                ],
              },
            },
          ],
        }
      : undefined,
  getSubspeciesDefinition: () => undefined,
}));
import SpellList from '@/app/builder/spells/SpellList';
import SpellsTab from '@/app/sheet/[id]/tabs/SpellsTab';

const first = normalizeSpell({ name: '来源选择甲', source: 'PHB', level: 0, entries: [] });
const second = normalizeSpell({ name: '来源选择乙', source: 'PHB', level: 0, entries: [] });
const feat = normalizeFeat({ name: '样本专长', source: 'PHB', entries: [] });
function state(): CharacterState {
  return {
    id: 'source-pages',
    name: '双层入口',
    playerName: '',
    classes: [],
    speciesId: 'test-species',
    baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
    backgroundAbilityBonuses: {},
    selectedFeats: [],
    selectedSkills: [],
    expertiseSkills: [],
    equipmentIds: [],
    inventoryEntries: [],
    equippedWeaponIds: [],
    attunedItemIds: [],
    currency: { cp: 0, sp: 0, ep: 0, gp: 0, pp: 0 },
    preparedSpellIds: [],
    cantripIds: [],
    knownSpellIds: [],
    spellbookIds: [],
    spellSlotUsage: {},
    resourceUsage: {},
    selectedLanguages: [],
    speciesSelections: { 'sp:test-species:trait:magic:spell-0': [first.id] },
  };
}
const render = (character: CharacterState) =>
  renderToStaticMarkup(
    <SpellList
      character={character}
      casterLevel={0}
      spellSlots={{}}
      cantripsKnown={0}
      spellsPrepared={0}
    />,
  );
beforeEach(() => {
  update.mockClear();
  defaultCatalog.registerMany([first, second, feat]);
});

it('无职业选法时仍显示来源页结果，且不误报没有施法能力、不写角色', () => {
  const character = state();
  const snapshot = JSON.stringify(character);
  const html = render(character);
  expect(html).toContain('来源页已获得的法术');
  expect(html).toContain('来源选择甲');
  expect(html).toContain('没有需要配置的职业法术选项');
  expect(html).not.toContain('尚未具备施法能力');
  expect(update).not.toHaveBeenCalled();
  expect(JSON.stringify(character)).toBe(snapshot);
});

it('来源页改选或取消后，法术页和最终派生读取同一记录，JSON重开保持结果', async () => {
  const character = state();
  character.speciesSelections!['sp:test-species:trait:magic:spell-0'] = [second.id];
  const reopened = await importFromJSON(exportToJSON(character));
  expect(render(reopened)).toContain('来源选择乙');
  expect(render(reopened)).not.toContain('来源选择甲');
  expect(deriveCharacterSpellSelection(reopened).cantripIds).toEqual([second.id]);
  reopened.speciesSelections!['sp:test-species:trait:magic:spell-0'] = [];
  expect(render(reopened)).not.toContain('来源页已获得的法术');
  expect(getInnateSpells(reopened)).toEqual([]);
  expect(deriveCharacterSpellSelection(reopened).cantripIds).toEqual([]);
});

it('背景专长槽位与种族同法术只显示一行，保留两个来源且不改变槽位', () => {
  const character = state();
  character.featSelections = { 'background-feat': { featId: feat.id, spells: [first.id] } };
  const snapshot = JSON.stringify(character);
  const html = render(character);
  expect(html.match(/来源选择甲/g)).toHaveLength(1);
  expect(html).toContain('专长: 样本专长');
  expect(html).toContain('种族');
  expect(getInnateSpells(character)).toHaveLength(2);
  expect(deriveCharacterSpellSelection(character).cantripIds).toEqual([first.id]);
  const sheet = renderToStaticMarkup(
    <SpellsTab
      character={character}
      spellcasting={{ spellSlots: {}, cantripsKnown: 1, spellsPrepared: 0 }}
      primaryClass={undefined}
      cantripDetails={[getSpellDefinition(first.id)]}
      spellDetails={[]}
      spellbookDetails={[]}
      spellSourceMap={buildSpellSourceMap(getInnateSpells(character), [], '职业')}
      spellSlotUsage={{}}
      updateActiveCharacter={() => {}}
      router={{ push() {} }}
      id={character.id}
    />,
  );
  expect(sheet.match(/来源选择甲/g)).toHaveLength(1);
  expect(sheet).toContain('专长: 样本专长');
  expect(sheet).toContain('种族');
  expect(JSON.stringify(character)).toBe(snapshot);
});

it('没有任何已生效授予时不展示空列表', () => {
  const character = state();
  character.speciesId = undefined;
  const html = render(character);
  expect(html).not.toContain('来源页已获得的法术');
  expect(html).toContain('尚未具备施法能力');
});
