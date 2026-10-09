import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { defaultCatalog } from '../catalog';
import { normalizeRace, normalizeSubrace } from '@/source/fiveetools-cn/normalizers/race';
import { normalizeSpell } from '@/source/fiveetools-cn/normalizers/spell';
import { getCatalogSpecies } from '../adapters/species';
import { computeProficiencies } from '@/engine/proficiency';
import { getInnateSpells } from '@/engine/spellcasting';
import { translateProficiency } from '@/engine/terminology';
import { CharacterState } from '@/types/characterState';

describe('Species Skill and Tool Proficiencies Verification', () => {
  beforeAll(() => {
    const fixturePath = path.resolve(process.cwd(), 'tests/fixtures/races.json');
    const data = JSON.parse(readFileSync(fixturePath, 'utf-8'));

    // 注册依尼翠人类与涅非利亚
    const psiHuman = data.race.find((r: any) => r.name === '人类 (依尼翠)' && r.source === 'PSI');
    if (psiHuman) defaultCatalog.register(normalizeRace(psiHuman));
    const nephalia = data.subrace.find((s: any) => s.name === '涅非利亚' && s.source === 'PSI');
    if (nephalia) defaultCatalog.register(normalizeSubrace(nephalia));

    // 注册赞迪卡精灵与特裘如
    const pszElf = data.race.find((r: any) => r.name === '精灵 (赞迪卡)' && r.source === 'PSZ');
    if (pszElf) defaultCatalog.register(normalizeRace(pszElf));
    const tajuru = data.subrace.find((s: any) => s.name === '特裘如精灵' && s.source === 'PSZ');
    if (tajuru) defaultCatalog.register(normalizeSubrace(tajuru));

    // 注册吉斯人与吉斯洋基人
    const mtfGith = data.race.find((r: any) => r.name === '吉斯人' && r.source === 'MTF');
    if (mtfGith) defaultCatalog.register(normalizeRace(mtfGith));
    const githyanki = data.subrace.find((s: any) => s.name === '吉斯洋基人' && s.source === 'MTF');
    if (githyanki) defaultCatalog.register(normalizeSubrace(githyanki));

    // 注册半血裔 (VRGR)
    const dhampir = data.race.find((r: any) => r.name === '半血裔' && r.source === 'VRGR');
    if (dhampir) defaultCatalog.register(normalizeRace(dhampir));

    // 注册依夏兰人类 (PSX)
    const psxHuman = data.race.find((r: any) => r.name === '人类 (依夏兰)' && r.source === 'PSX');
    if (psxHuman) defaultCatalog.register(normalizeRace(psxHuman));

    // 注册精灵 (PHB) 与半身人 (PHB)
    const phbElf = data.race.find((r: any) => r.name === '精灵' && r.source === 'PHB');
    if (phbElf) defaultCatalog.register(normalizeRace(phbElf));
    const phbHalfling = data.race.find((r: any) => r.name === '半身人' && r.source === 'PHB');
    if (phbHalfling) defaultCatalog.register(normalizeRace(phbHalfling));

    // 注册重生者 (RHW)
    const rhwReborn = data.race.find((r: any) => r.name === '重生者' && r.source === 'RHW');
    if (rhwReborn) defaultCatalog.register(normalizeRace(rhwReborn));

    // 注册幻身灵 (EFA)
    const efaChangeling = data.race.find((r: any) => r.name === '幻身灵' && r.source === 'EFA');
    if (efaChangeling) defaultCatalog.register(normalizeRace(efaChangeling));

    // 注册科拉瓦 (EFA)
    const efaKhoravar = data.race.find((r: any) => r.name === '科拉瓦' && r.source === 'EFA');
    if (efaKhoravar) defaultCatalog.register(normalizeRace(efaKhoravar));

    // 注册星界精灵 (AAG)
    const aagAstralElf = data.race.find((r: any) => r.name === '星界精灵' && r.source === 'AAG');
    if (aagAstralElf) defaultCatalog.register(normalizeRace(aagAstralElf));
  });

  it('inspects Ixalan Human (PSX) language traits without duplicate choices', () => {
    const speciesList = getCatalogSpecies();
    const psxHuman = speciesList.find((s) => s.name.includes('人类') && s.source === 'PSX');
    expect(psxHuman).toBeDefined();

    const langTrait = psxHuman?.traits.find((t) => t.name === '语言');
    expect(langTrait).toBeDefined();
    const selections = (langTrait?.features?.languages || []).filter(
      (l): l is { numToChoose: number; options: string[] } =>
        typeof l === 'object' && 'numToChoose' in l,
    );
    expect(selections).toHaveLength(1);
    expect(selections[0].numToChoose).toBe(1);
  });

  it('correctly parses Nephalia (PSI) 4 hybrid skill/tool proficiencies', () => {
    const speciesList = getCatalogSpecies();
    const psiHuman = speciesList.find((s) => s.name.includes('人类') && s.source === 'PSI');
    expect(psiHuman).toBeDefined();

    const nephalia = psiHuman?.subSpecies?.options.find(
      (sub) => sub.name.includes('涅非利亚') || sub.nameEn?.toLowerCase().includes('nephalia'),
    );
    expect(nephalia).toBeDefined();

    const hybrid = nephalia?.features?.skillToolProficiencies?.[0];
    expect(hybrid).toBeDefined();
    expect(hybrid?.numToChoose).toBe(4);
    expect(hybrid?.options).toEqual(['anySkill', 'anyTool']);

    const trait = nephalia?.traits.find((t) => t.features?.skillToolProficiencies?.length);
    expect(trait).toBeDefined();
    expect(trait?.features?.skillToolProficiencies?.[0].numToChoose).toBe(4);
  });

  it('correctly parses Tajuru Elf (PSZ) 2 hybrid skill/tool proficiencies', () => {
    const speciesList = getCatalogSpecies();
    const pszElf = speciesList.find((s) => s.name.includes('精灵') && s.source === 'PSZ');
    expect(pszElf).toBeDefined();

    const tajuru = pszElf?.subSpecies?.options.find(
      (sub) => sub.name.includes('特裘如') || sub.nameEn?.toLowerCase().includes('tajuru'),
    );
    expect(tajuru).toBeDefined();

    const hybrid = tajuru?.features?.skillToolProficiencies?.[0];
    expect(hybrid).toBeDefined();
    expect(hybrid?.numToChoose).toBe(2);
    expect(hybrid?.options).toEqual(['anySkill', 'anyTool']);
  });

  it('correctly parses Githyanki (MTF) hybrid skill/tool and language choice', () => {
    const speciesList = getCatalogSpecies();
    const gith = speciesList.find((s) => s.name.includes('吉斯') && s.source === 'MTF');
    expect(gith).toBeDefined();

    const githyanki = gith?.subSpecies?.options.find(
      (sub) => sub.name.includes('吉斯洋基') || sub.nameEn?.toLowerCase().includes('githyanki'),
    );
    expect(githyanki).toBeDefined();

    const hybrid = githyanki?.features?.skillToolProficiencies?.[0];
    expect(hybrid).toBeDefined();
    expect(hybrid?.numToChoose).toBe(1);

    const lang = githyanki?.features?.languages?.find(
      (l: any) => typeof l === 'object' && l.numToChoose === 1,
    );
    expect(lang).toBeDefined();
  });

  it('correctly parses Dhampir (VRGR) Ancestral Legacy 2 free skills', () => {
    const speciesList = getCatalogSpecies();
    const dhampir = speciesList.find(
      (s) => s.name.includes('半血裔') || s.nameEn?.toLowerCase().includes('dhampir'),
    );
    expect(dhampir).toBeDefined();

    const legacyTrait = dhampir?.traits.find(
      (t) => t.name.includes('先祖遗赠') || t.nameEn?.toLowerCase().includes('ancestral legacy'),
    );
    expect(legacyTrait).toBeDefined();

    const skillChoice = legacyTrait?.features?.skillProficiencies?.[0];
    expect(skillChoice).toBeDefined();
    expect((skillChoice as any)?.numToChoose).toBe(2);
  });

  it('engine correctly classifies hybrid selections into skills and tools', () => {
    const speciesList = getCatalogSpecies();
    const psiHuman = speciesList.find((s) => s.name.includes('人类') && s.source === 'PSI');
    const nephalia = psiHuman?.subSpecies?.options.find(
      (sub) => sub.name.includes('涅非利亚') || sub.nameEn?.toLowerCase().includes('nephalia'),
    );

    const mockCharacter: CharacterState = {
      speciesId: psiHuman!.id,
      subspeciesId: nephalia!.id,
      speciesSelections: {
        [`sp:${psiHuman!.id}:sub:${nephalia!.id}:skilltool-0`]: [
          'athletics',
          'stealth',
          "thieves' tools",
          "alchemist's supplies",
        ],
      },
      stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      characterLevel: 1,
      totalLevel: 1,
    } as any;

    const computed = computeProficiencies(mockCharacter);
    const skillIds = computed.skills.map((s) => s.id);
    const toolIds = computed.tools.map((t) => t.id);

    expect(skillIds).toContain('athletics');
    expect(skillIds).toContain('stealth');
    expect(toolIds).toContain("thieves' tools");
    expect(toolIds).toContain("alchemist's supplies");
  });

  it('ensures Elf (PHB) and Halfling (PHB) languages are clean without verb/conjunction phrases', () => {
    const speciesList = getCatalogSpecies();
    const elf = speciesList.find((s) => s.name === '精灵' && s.source === 'PHB');
    expect(elf).toBeDefined();

    const langTrait = elf?.traits.find((t) => t.name === '语言');
    expect(langTrait).toBeDefined();
    const languages = langTrait?.features?.languages || [];
    expect(languages).toContain('elvish');
    expect(languages).not.toContain('学习精灵语');
    expect(languages.some((l: any) => typeof l === 'string' && l.includes('学习'))).toBe(false);

    const halfling = speciesList.find((s) => s.name === '半身人' && s.source === 'PHB');
    expect(halfling).toBeDefined();
    const halflingLang = halfling?.traits.find((t) => t.name === '语言')?.features?.languages || [];
    expect(halflingLang).toContain('halfling');
    expect(halflingLang).not.toContain('虽然半身人语');
    expect(halflingLang.some((l: any) => typeof l === 'string' && l.includes('虽然'))).toBe(false);
  });

  it('ensures Reborn (RHW) parses resistanceChoices (Strange Endurance) correctly', () => {
    const speciesList = getCatalogSpecies();
    const reborn = speciesList.find((s) => s.name.includes('重生者') && s.source === 'RHW');
    expect(reborn).toBeDefined();

    // 宿主特性“奇异耐性 Strange Endurance”
    const enduranceTrait = reborn?.traits.find((t) => t.name === '奇异耐性');
    expect(enduranceTrait).toBeDefined();
    expect(enduranceTrait?.features?.resistanceChoices).toBeDefined();
    expect(enduranceTrait?.features?.resistanceChoices).toHaveLength(1);

    const choice = enduranceTrait!.features!.resistanceChoices![0];
    expect(choice.numToChoose).toBe(1);
    expect(choice.options).toEqual(['寒冷', '暗蚀', '毒素']);

    // 种族外层聚合的 features
    expect((reborn as any)?.features?.resistanceChoices).toBeDefined();
    expect((reborn as any)?.features?.resistanceChoices?.[0].options).toEqual([
      '寒冷',
      '暗蚀',
      '毒素',
    ]);
  });

  it('ensures species choices (resistances, languages, skills, tools) propagate end-to-end to character proficiencies', () => {
    const speciesList = getCatalogSpecies();
    const reborn = speciesList.find((s) => s.name.includes('重生者') && s.source === 'RHW');
    expect(reborn).toBeDefined();

    // 注册测试戏法
    const cantrip = normalizeSpell({
      name: '火焰箭',
      ENG_name: 'Fire Bolt',
      source: 'PHB',
      level: 0,
      entries: [],
    });
    defaultCatalog.register(cantrip);

    const mockCharacter: CharacterState = {
      id: 'test-reborn',
      name: '测试重生者',
      speciesId: reborn!.id,
      speciesSource: reborn!.source,
      classes: [{ classId: 'fighter', level: 1 }],
      speciesSelections: {
        [`sp:${reborn!.id}:trait:strangeendurance:resist-0`]: ['寒冷'],
        [`sp:${reborn!.id}:trait:language:lang-0`]: ['dwarvish'],
        [`sp:${reborn!.id}:trait:knowledge:skill-0`]: ['stealth'],
        [`sp:${reborn!.id}:trait:knowledge:tool-0`]: ['alchemistSupplies'],
        [`sp:${reborn!.id}:trait:innate-spells:spell-0`]: [cantrip.id],
        [`sp:${reborn!.id}:trait:innate-spellcasting-ability`]: ['智力'],
      },
      stats: { str: 10, dex: 10, con: 10, int: 14, wis: 10, cha: 10 },
      characterLevel: 1,
      totalLevel: 1,
    } as any;

    const computed = computeProficiencies(mockCharacter);

    // 验证伤害抗性传导
    expect(computed.resistances).toBeDefined();
    expect(computed.resistances.some((r) => r.id === '寒冷')).toBe(true);

    // 验证语言传导
    expect(computed.languages.some((l) => l.id === 'dwarvish')).toBe(true);

    // 验证技能传导
    expect(computed.skills.some((s) => s.id === 'stealth')).toBe(true);

    // 验证工具传导
    expect(computed.tools.some((t) => t.id === 'alchemistSupplies')).toBe(true);

    // 验证天生戏法传导与施法属性
    const innate = getInnateSpells(mockCharacter);
    expect(innate).toBeDefined();
  });

  it('correctly parses Changeling (EFA) instincts with 5 skills including performance, and normalizes persuasion with ability', () => {
    const speciesList = getCatalogSpecies();
    const changeling = speciesList.find((s) => s.name === '幻身灵' && s.source === 'EFA');
    expect(changeling).toBeDefined();

    const instinctsTrait = changeling?.traits.find((t) => t.name === '幻身灵本能');
    expect(instinctsTrait).toBeDefined();

    const skillChoice = instinctsTrait?.features?.skillProficiencies?.[0] as any;
    expect(skillChoice).toBeDefined();
    expect(skillChoice?.numToChoose).toBe(2);
    // 自动补齐 5etools 元数据遗漏的表演与游说
    expect(skillChoice?.options).toContain('表演');
    expect(skillChoice?.options).toContain('游说');
    expect(skillChoice?.options).toHaveLength(5);

    // 验证游说翻译带魅力属性
    expect(translateProficiency('游说')).toBe('游说（魅力）');
  });

  it('correctly parses Khoravar (EFA) Skill Versatility as hybrid skill/tool choice, allowing tool selection', () => {
    const speciesList = getCatalogSpecies();
    const khoravar = speciesList.find((s) => s.name === '科拉瓦' && s.source === 'EFA');
    expect(khoravar).toBeDefined();

    const versatileTrait = khoravar?.traits.find((t) => t.name === '多才多艺');
    expect(versatileTrait).toBeDefined();

    // 必须被识别为 skillToolProficiencies 混合熟练，而非纯技能
    const hybridChoice = versatileTrait?.features?.skillToolProficiencies?.[0] as any;
    expect(hybridChoice).toBeDefined();
    expect(hybridChoice?.numToChoose).toBe(1);
    expect(hybridChoice?.options).toEqual(['anySkill', 'anyTool']);
    expect(versatileTrait?.features?.skillProficiencies).toBeUndefined();

    // 验证选工具时的传导
    const mockCharacter: CharacterState = {
      id: 'test-khoravar',
      name: '测试科拉瓦',
      speciesId: khoravar!.id,
      speciesSource: khoravar!.source,
      classes: [{ classId: 'bard', level: 1 }],
      speciesSelections: {
        [`sp:${khoravar!.id}:trait:${versatileTrait!.id}:skilltool-0`]: ["smith's tools"],
      },
      stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      characterLevel: 1,
      totalLevel: 1,
    } as any;

    const computed = computeProficiencies(mockCharacter);
    expect(computed.tools.some((t) => t.id === "smith's tools")).toBe(true);
  });

  it('inspects Astral Elf (AAG) Astral Trance features', () => {
    const speciesList = getCatalogSpecies();
    const astralElf = speciesList.find((s) => s.name === '星界精灵' && s.source === 'AAG');
    expect(astralElf).toBeDefined();

    const tranceTrait = astralElf?.traits.find((t) => t.name === '星界出神');
    expect(tranceTrait).toBeDefined();
    expect(tranceTrait?.features).toBeDefined();
  });
});
