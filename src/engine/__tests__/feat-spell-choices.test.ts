import { expect, it } from 'vitest';
import { catalogEntryToSpell } from '@/catalog/adapters/spells';
import { normalizeSpell } from '@/source/fiveetools-cn/normalizers/spell';
import { getFeatSpellCandidates, toggleFeatSpellChoice } from '../featSpellChoices';

const make = (name: string, level: number, classes: string[], school = 'V', ritual = false) =>
  catalogEntryToSpell(
    normalizeSpell({
      name,
      ENG_name: name,
      source: 'XPHB',
      level,
      classes,
      school,
      meta: { ritual },
    }),
  );
const wizard = make('Wizard Cantrip', 0, ['法师']);
const cleric = make('Cleric Cantrip', 0, ['牧师']);
const first = make('First Level', 1, ['法师'], 'divination');
const ritual = make('Ritual Spell', 1, ['法师'], 'divination', true);
const second = make('Second Level', 2, ['法师']);
const pool = [wizard, cleric, first, ritual, second];
const req = { count: 1, listOptions: ['wizard', 'cleric'], level: 1 };

it('按当前职业法表和环阶筛选，职业并集不扩大到其他环阶', () => {
  expect(getFeatSpellCandidates({ ...req, level: 0 }, 'wizard', pool)).toEqual([wizard]);
  expect(getFeatSpellCandidates({ ...req, level: 0 }, 'wizard, cleric', pool)).toEqual([
    wizard,
    cleric,
  ]);
});

it('保留学派、仪式列表和ritualOnly限制', () => {
  expect(getFeatSpellCandidates(req, 'divination', pool)).toEqual([first, ritual]);
  expect(getFeatSpellCandidates(req, 'ritual', pool)).toEqual([ritual]);
  expect(getFeatSpellCandidates({ ...req, ritualOnly: true }, 'wizard', pool)).toEqual([ritual]);
  expect(getFeatSpellCandidates(req, 'Any', pool)).toEqual([first, ritual]);
});

it('固定引用保持原ID或英文名匹配，不从调用方未提供的目录补回', () => {
  expect(getFeatSpellCandidates({ ...req, listOptions: [first.id] }, 'cleric', pool)).toEqual([
    first,
  ]);
  expect(getFeatSpellCandidates({ ...req, listOptions: [first.nameEn] }, 'cleric', pool)).toEqual([
    first,
  ]);
  expect(getFeatSpellCandidates(req, 'wizard', [])).toEqual([]);
});

it('选满只替换当前环阶最早项，其他环阶和未知手动ID保留，输入不变', () => {
  const selected = [wizard.id, first.id, 'manual', second.id];
  const snapshot = JSON.stringify(selected);
  expect(toggleFeatSpellChoice(selected, ritual.id, req, pool)).toEqual([
    wizard.id,
    'manual',
    second.id,
    ritual.id,
  ]);
  expect(JSON.stringify(selected)).toBe(snapshot);
  expect(toggleFeatSpellChoice(selected, first.id, req, pool)).toEqual([
    wizard.id,
    'manual',
    second.id,
  ]);
});

it('多名额选择保留其他已选项及原顺序', () => {
  expect(toggleFeatSpellChoice([first.id], ritual.id, { ...req, count: 2 }, pool)).toEqual([
    first.id,
    ritual.id,
  ]);
});
