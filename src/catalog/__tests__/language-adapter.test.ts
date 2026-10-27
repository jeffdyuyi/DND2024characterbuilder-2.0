import { describe, it, expect } from 'vitest';
import { defaultCatalog } from '@/catalog/catalog';
import { normalizeLanguage } from '@/source/fiveetools-cn/normalizers/language';
import { catalogEntryToLanguage, getCatalogLanguages } from '@/catalog/adapters/languages';
import { ALL_GAME_LANGUAGES } from '@/rules/languages';
import { translateProficiency } from '@/engine/terminology';
import { addStructuredTraits } from '@/catalog/adapters/speciesChoices';

describe('Language Catalog Adapter & 5etools Normalizer', () => {
  it('正确将 5etools languages.json 原始条目归一化为 CatalogEntry', () => {
    const raw5e = {
      name: '深渊语',
      ENG_name: 'Abyssal',
      source: 'XPHB',
      edition: 'one',
      page: 37,
      type: 'rare',
      origin: '深渊的恶魔',
      typicalSpeakers: ['恶魔'],
    };

    const entry = normalizeLanguage(raw5e, '5etools-cn');
    expect(entry.kind).toBe('language');
    expect(entry.name).toBe('深渊语');
    expect(entry.englishName).toBe('Abyssal');
    expect(entry.source).toBe('XPHB');
    expect(entry.edition).toBe('2024');

    const language = catalogEntryToLanguage(entry);
    expect(language.id).toBe('abyssal');
    expect(language.name).toBe('深渊语');
    expect(language.type).toBe('Rare');
    expect(language.origin).toBe('深渊的恶魔');
  });

  it('目录未加载时不把本地静态语言伪装成来源候选', () => {
    expect(getCatalogLanguages()).toEqual([]);
    expect(ALL_GAME_LANGUAGES.length).toBe(0);
  });

  it('translateProficiency 确保所有 5etools 语言键均正确转换为中文', () => {
    expect(translateProficiency('common')).toBe('通用语');
    expect(translateProficiency('auran')).toBe('气族语');
    expect(translateProficiency('aquan')).toBe('水族语');
    expect(translateProficiency('ignan')).toBe('火族语');
    expect(translateProficiency('terran')).toBe('土族语');
    expect(translateProficiency('elvish')).toBe('精灵语');
    expect(translateProficiency('dwarvish')).toBe('矮人语');
    expect(translateProficiency('deep speech')).toBe('深语');
    expect(translateProficiency('风族语')).toBe('风族语');
  });

  it('只展示已加载的来源条目，并保留同名语言的书源区分', () => {
    defaultCatalog.register({
      id: '5etools-cn:language:xphb:abyssal',
      kind: 'language',
      name: '深渊语',
      englishName: 'Abyssal',
      source: 'XPHB',
      edition: '2024',
      sourcePackId: '5etools-cn',
      raw: { type: 'rare' },
    });
    defaultCatalog.register({
      id: '5etools-cn:language:phb:abyssal',
      kind: 'language',
      name: '深渊语',
      englishName: 'Abyssal',
      source: 'PHB',
      edition: '2014',
      sourcePackId: '5etools-cn',
      raw: { type: 'exotic' },
    });
    expect(getCatalogLanguages().map((language) => language.source)).toEqual(['XPHB', 'PHB']);
    expect(getCatalogLanguages({ source: 'XPHB' })).toMatchObject([
      { id: 'abyssal', name: '深渊语', source: 'XPHB', type: 'Rare' },
    ]);
    expect(ALL_GAME_LANGUAGES.length).toBe(2);
  });

  it('Kenku（天狗）5etools 语料解析后掌握语言正确转换为中文', () => {
    const kenkuRaw = {
      name: '天狗',
      ENG_name: 'Kenku',
      source: 'DMG',
      languageProficiencies: [{ common: true, auran: true }],
      entries: [
        {
          name: '语言',
          ENG_name: 'Languages',
          entries: ['你可以读、写通用语和风族语，但你只能使用你的拟声特性来说话。'],
        },
      ],
    };
    const traits: any[] = [
      {
        id: 'languages',
        name: '语言',
        description: '你可以读、写通用语和风族语，但你只能使用你的拟声特性来说话。',
      },
    ];
    addStructuredTraits(traits, kenkuRaw, '5etools-cn');
    const langTrait = traits.find((t) => t.id === 'languages');
    expect(langTrait).toBeDefined();
    expect(langTrait.features?.languages).toBeDefined();

    // 验证无论输出是 '风族语' 还是 'auran'，经由 translateProficiency 渲染后 100% 为中文
    const displayedLanguages = langTrait.features.languages.map((l: string) =>
      translateProficiency(l),
    );
    expect(displayedLanguages).toContain('通用语');
    expect(displayedLanguages.some((l: string) => l === '风族语' || l === '气族语')).toBe(true);
    expect(displayedLanguages).not.toContain('auran');
  });
});
