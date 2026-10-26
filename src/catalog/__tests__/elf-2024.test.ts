import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { normalizeRace } from '@/source/fiveetools-cn/normalizers/race';
import { defaultCatalog } from '../catalog';
import { getSpeciesDefinition, getSubspeciesDefinition } from '@/engine/characterData';
import { CharacterState } from '@/types/characterState';
import { resolveEntries } from '@/source/resolver/copy';
import { catalogEntryToSpecies } from '../adapters/species';

describe('2024 Elf regressions and display structure', () => {
  it('preserves Lorwyn lineages through copy resolution, selection and saved lookup', () => {
    const { race } = JSON.parse(readFileSync('tests/fixtures/races.json', 'utf8'));
    const originals = race.filter(
      (raw: any) => raw.ENG_name === 'Elf' && ['XPHB', 'LFL'].includes(raw.source),
    );
    const snapshot = JSON.stringify(originals);
    const { resolved, warnings } = resolveEntries(originals);
    expect(warnings).toEqual([]);
    const entry = normalizeRace(resolved.find((raw: any) => raw.source === 'LFL')!);
    defaultCatalog.register(entry);
    const species = catalogEntryToSpecies(entry);
    const options = species.subSpecies!.options;
    expect(options.map((option) => option.nameEn)).toEqual([
      'Lorwyn Lineage',
      'Shadowmoor Lineage',
    ]);
    expect(options.every((option) => option.source === 'LFL')).toBe(true);
    expect(options[0].features?.spells).toEqual(
      expect.arrayContaining([expect.objectContaining({ spellName: '命令术', level: 3 })]),
    );
    expect(options[1].features?.senseUpgrade?.darkvision).toBe(120);
    for (const option of options) {
      const saved = JSON.parse(JSON.stringify({ speciesId: entry.id, subspeciesId: option.id }));
      expect(getSubspeciesDefinition(saved)?.nameEn).toBe(option.nameEn);
    }
    const core = catalogEntryToSpecies(
      normalizeRace(resolved.find((raw: any) => raw.source === 'XPHB')!),
    );
    expect(core.subSpecies?.options).toHaveLength(3);
    expect(core.subSpecies?.options.every((option) => option.source === 'XPHB')).toBe(true);
    expect(JSON.stringify(originals)).toBe(snapshot);
  });

  it('keeps authored versions for every copied race in the upstream fixture', () => {
    const { race } = JSON.parse(readFileSync('tests/fixtures/races.json', 'utf8'));
    const { resolved } = resolveEntries(race);
    const copied = race.filter((raw: any) => raw._copy && raw._versions);
    expect(copied.length).toBeGreaterThan(0);
    for (const raw of copied) {
      const result = resolved.find(
        (entry: any) => entry.name === raw.name && entry.source === raw.source,
      );
      expect(result?._versions, `${raw.name}|${raw.source}`).toEqual(raw._versions);
    }
  });

  it('correctly assigns Elven Lineage as representsSubSpecies host instead of darkvision', () => {
    const rawRaces = JSON.parse(readFileSync('tests/fixtures/races.json', 'utf8'));
    const elfRaw = rawRaces.race.find(
      (r: any) => (r.name === '精灵' || r.ENG_name === 'Elf') && r.source === 'XPHB',
    );
    const entry = normalizeRace(elfRaw);
    defaultCatalog.register(entry);

    const character: CharacterState = {
      speciesId: entry.id,
      speciesSource: 'XPHB',
      classes: [],
      selectedFeats: [],
      inventoryEntries: [],
      equipmentIds: [],
      baseAbilityScores: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      speciesSelections: {},
    } as unknown as CharacterState;

    const species = getSpeciesDefinition(character)!;

    // 1. 验证代表亚种的宿主特质为【精灵血系】，而不是【黑暗视觉】
    const darkvision = species.traits.find((t) => t.id === 'darkvision' || t.name === '黑暗视觉');
    expect(darkvision?.representsSubSpecies).toBeFalsy();

    const lineage = species.traits.find((t) => t.id === 'elvenlineage' || t.name === '精灵血系');
    expect(lineage?.representsSubSpecies).toBe(true);

    // 2. 验证宿主特质不会被错误挂上表格中高等精灵特有的自选戏法
    expect(lineage?.features?.spells).toBeUndefined();

    // 3. 验证亚种选项拥有干净的名字且包含正确的加成和专属特质
    expect(species.subSpecies?.options).toHaveLength(3);
    const drow = species.subSpecies!.options.find((o) => o.name.includes('卓尔'))!;
    const highElf = species.subSpecies!.options.find((o) => o.name.includes('高等精灵'))!;
    const woodElf = species.subSpecies!.options.find((o) => o.name.includes('木精灵'))!;

    expect(drow.name).toBe('卓尔血统');
    expect(drow.features?.senseUpgrade?.darkvision).toBe(120);
    expect(drow.traits.some((t) => t.name.includes('卓尔'))).toBe(true);

    expect(highElf.name).toBe('高等精灵血系');
    expect(highElf.traits.some((t) => t.name.includes('高等精灵'))).toBe(true);

    // 4. 验证高等精灵法术列表结构：包含默认预设戏法魔法伎俩与法师戏法筛选器，以及3级/5级法术
    const highElfSpells = highElf.features?.spells || [];
    expect(highElfSpells).toHaveLength(3);
    const cantripChoice: any = highElfSpells[0];
    expect(cantripChoice.numToChoose).toBe(1);
    expect(cantripChoice.defaultSpellName).toBe('魔法伎俩');
    expect(cantripChoice.filter).toBe('level:0;class:法师');
    expect(cantripChoice.options[0].spellName).toBe('魔法伎俩');
    expect(cantripChoice.options[0].level).toBe(0);

    const lv3Spell: any = highElfSpells[1];
    expect(lv3Spell.spellName).toBe('侦测魔法');
    expect(lv3Spell.level).toBe(3);

    const lv5Spell: any = highElfSpells[2];
    expect(lv5Spell.spellName).toBe('迷踪步');
    expect(lv5Spell.level).toBe(5);

    expect(woodElf.name).toBe('木精灵血系');
    expect(woodElf.features?.speedBonus).toBe(5);
    expect(woodElf.traits.some((t) => t.name.includes('木精灵'))).toBe(true);
  });
});
