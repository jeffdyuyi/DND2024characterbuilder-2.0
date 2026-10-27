import { getCatalogLanguages } from '@/catalog/adapters/languages';
import type { Language } from '@/types/language';

export { getCatalogLanguages };

/** Legacy array-shaped access for callers that read the loaded catalog at render time. */
export const ALL_GAME_LANGUAGES: Language[] = new Proxy([] as Language[], {
  get(_target, prop) {
    const dynamic = getCatalogLanguages();
    const value = Reflect.get(dynamic, prop, dynamic);
    if (typeof value === 'function') {
      return value.bind(dynamic);
    }
    return value;
  },
});

export const allLanguages = ALL_GAME_LANGUAGES;
