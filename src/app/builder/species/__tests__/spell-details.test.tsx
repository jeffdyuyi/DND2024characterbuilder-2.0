import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { defaultCatalog, getCatalogSpecies, getCatalogSpells } from '@/catalog';
import { normalizeRace, normalizeSubrace } from '@/source/fiveetools-cn/normalizers/race';
import { normalizeSpell } from '@/source/fiveetools-cn/normalizers/spell';
import type { InnateSpell, Selection } from '@/types/species';
import { SpeciesSpellChoiceDetails, TraitSpellList } from '../SpeciesTraitSpellList';

const text = (id: string) => `法术正文标记-${id}`;
const occurrences = (html: string, value: string) => html.split(value).length - 1;
let groups: Selection<InnateSpell>[];

beforeAll(() => {
  const data = JSON.parse(readFileSync('tests/fixtures/races.json', 'utf8'));
  for (const raw of data.race || []) defaultCatalog.register(normalizeRace(raw, '5etools-cn'));
  for (const raw of data.subrace || [])
    defaultCatalog.register(normalizeSubrace(raw, '5etools-cn'));
  const species = getCatalogSpecies();
  const astral = species.find((s) => s.nameEn === 'Astral Elf' && s.source === 'AAG')!;
  const elf = species.find((s) => s.name === '精灵' && s.source === 'XPHB')!;
  const gnome = species.find((s) => s.name === '侏儒' && s.source === 'XPHB')!;
  const traits = [
    astral.traits.find((t) => t.nameEn === 'Astral Fire')!,
    elf
      .subSpecies!.options.find((s) => s.name.includes('高等精灵'))!
      .traits.find((t) => t.features?.spells?.some((s) => 'numToChoose' in s))!,
    gnome.traits.find((t) => t.features?.spells?.some((s) => 'numToChoose' in s))!,
  ];
  groups = traits.map(
    (t) => t.features!.spells!.find((s) => 'numToChoose' in s) as Selection<InnateSpell>,
  );
  for (const group of groups) {
    for (const option of group.options) {
      const id = option.spellId!;
      const source = id.split(':')[2].toUpperCase();
      const name = decodeURIComponent(id.split(':').at(-1)!);
      const entry = normalizeSpell({
        name,
        source,
        level: 0,
        school: 'V',
        entries: [text(id)],
        components: { v: true, s: true },
      });
      expect(entry.id).toBe(id);
      defaultCatalog.register(entry);
    }
  }
  defaultCatalog.register(
    normalizeSpell({
      name: '固定法术测试',
      source: 'TEST',
      level: 1,
      entries: ['固定正文标记', { name: '升环效应', entries: ['升环正文标记'] }],
      components: { v: true, s: true },
    }),
  );
});

it.each([0, 1, 2])('真实样本选择组 %s：预览和已选相同法术时正文只出现一次', (index) => {
  const choice = groups[index];
  const id = choice.options[0].spellId!;
  const candidates = getCatalogSpells().filter((s) =>
    choice.options.some((o) => o.spellId === s.id),
  );
  const html = renderToStaticMarkup(
    <>
      <SpeciesSpellChoiceDetails
        choice={choice}
        candidateSpells={candidates}
        selectedSpellIds={[id]}
        previewSpellId={id}
      />
      <TraitSpellList spells={[choice]} selectedSpellIds={[id]} remainingOnly />
    </>,
  );
  expect(occurrences(html, text(id))).toBe(1);
  expect(html).toContain('成分:');
});

it('重开已保存选择时无需点击即可显示详情，其他选择组的预览不会混入', () => {
  const choice = groups[0];
  const id = choice.options[0].spellId!;
  const foreignId = groups[1].options[0].spellId!;
  const candidates = getCatalogSpells().filter((s) =>
    choice.options.some((o) => o.spellId === s.id),
  );
  for (const previewSpellId of [null, foreignId]) {
    const html = renderToStaticMarkup(
      <SpeciesSpellChoiceDetails
        choice={choice}
        candidateSpells={candidates}
        selectedSpellIds={[id]}
        previewSpellId={previewSpellId}
      />,
    );
    expect(occurrences(html, text(id))).toBe(1);
    expect(html).not.toContain(text(foreignId));
  }
});

it('多选组保留各已选法术，预览中的重复引用不会增加一份详情', () => {
  const choice = { ...groups[0], numToChoose: 2 };
  const ids = choice.options.slice(0, 2).map((o) => o.spellId!);
  const html = renderToStaticMarkup(
    <SpeciesSpellChoiceDetails
      choice={choice}
      candidateSpells={getCatalogSpells().filter((s) => ids.includes(s.id))}
      selectedSpellIds={ids}
      previewSpellId={ids[1]}
    />,
  );
  for (const id of ids) expect(occurrences(html, text(id))).toBe(1);
});

it('动态筛选组即使没有显式 options 仍能展示已选法术', () => {
  const id = groups[0].options[0].spellId!;
  const choice = { numToChoose: 1, filter: 'level:0' } as Selection<InnateSpell>;
  const html = renderToStaticMarkup(
    <SpeciesSpellChoiceDetails
      choice={choice}
      candidateSpells={getCatalogSpells().filter((s) => s.id === id)}
      selectedSpellIds={[id]}
    />,
  );
  expect(occurrences(html, text(id))).toBe(1);
});

it('固定法术保留正文、解锁等级、使用次数、成分与升环内容', () => {
  const spell = getCatalogSpells().find((s) => s.name === '固定法术测试')!;
  const innate: InnateSpell = {
    spellId: spell.id,
    spellName: spell.name,
    spellNameEn: spell.nameEn,
    level: 5,
    isPrepared: true,
    freeCastsPerLongRest: 1,
    useSpellSlots: true,
  };
  const html = renderToStaticMarkup(
    <TraitSpellList
      spells={[groups[0], innate, innate]}
      selectedSpellIds={[groups[0].options[0].spellId!]}
      remainingOnly
    />,
  );
  expect(occurrences(html, '固定正文标记')).toBe(1);
  expect(html).toContain('5');
  expect(html).toContain('级解锁');
  expect(html).toContain('1次/长休');
  expect(html).toContain('成分:');
  expect(html).toContain('升环正文标记');
  expect(occurrences(html, '升环正文标记')).toBe(1);
  expect(html).not.toContain(text(groups[0].options[0].spellId!));
});

it('长休整备选项未由建卡选择器接管，仍保留已选详情', () => {
  const choice = { ...groups[0], isLongRestChoice: true };
  const id = choice.options[0].spellId!;
  const html = renderToStaticMarkup(
    <TraitSpellList spells={[choice]} selectedSpellIds={[id]} remainingOnly />,
  );
  expect(occurrences(html, text(id))).toBe(1);
});
