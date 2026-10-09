import { PHB_LANGUAGES } from './phb_languages';
import { THIRD_PARTY_LANGUAGES } from './third_party_languages';
import { getCatalogLanguages } from '@/catalog/adapters/languages';

export * from './phb_languages';
export * from './third_party_languages';
export { getCatalogLanguages };

const STATIC_LANGUAGES = [...PHB_LANGUAGES, ...THIRD_PARTY_LANGUAGES];

/**
 * 全量游戏语言
 * 动态代理自 5etools Catalog，未加载或离线时自动透明回退至静态权威列表。
 */
export const ALL_GAME_LANGUAGES: typeof STATIC_LANGUAGES = new Proxy(STATIC_LANGUAGES, {
  get(target, prop, receiver) {
    const dynamic = getCatalogLanguages();
    const value = Reflect.get(dynamic, prop, dynamic);
    if (typeof value === 'function') {
      return value.bind(dynamic);
    }
    return value;
  },
});

export const allLanguages = ALL_GAME_LANGUAGES;
