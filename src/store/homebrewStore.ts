import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { safeLocalStorage } from '@/utils/safeStorage';
import { Spell } from '@/types/spell';
import { Feat } from '@/types/feat';
import { ItemItem } from '@/types/item';
import { Species } from '@/types/species';
import { Background } from '@/types/background';
import {
  exportPackToJSON,
  exportSingleCardToJSON,
  parseImportedJSON,
  generateSlug,
} from '@/utils/homebrewConverter';

export interface Monster {
  id: string;
  name: string;
  nameEn: string;
  source: string;
  cr: string;
  type: string;
  alignment: string;
  ac: number;
  hp: number;
  speed: string;
  stats: { str: number; dex: number; con: number; int: number; wis: number; cha: number };
  description: string;
  isHomebrew?: boolean;
  enabled?: boolean;
  sourcePackId?: string;
  sourcePackName?: string;
}

export interface HomebrewItemWithFlags {
  isHomebrew?: boolean;
  enabled?: boolean;
  sourcePackId?: string;
  sourcePackName?: string;
  [key: string]: any;
}

export interface HomebrewDataState {
  spells: (Spell & HomebrewItemWithFlags)[];
  monsters: Monster[];
  items: (ItemItem & HomebrewItemWithFlags)[];
  feats: (Feat & HomebrewItemWithFlags)[];
  species: (Species & HomebrewItemWithFlags)[];
  backgrounds: (Background & HomebrewItemWithFlags)[];
  classes?: any[];
}

export interface HomebrewPackMeta {
  name: string;
  author?: string;
  description?: string;
  version?: string;
  icon?: string;
}

export interface HomebrewPack extends HomebrewPackMeta {
  id: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
  data: HomebrewDataState;
}

export type HomebrewEntryOf<K extends keyof HomebrewDataState> = NonNullable<
  HomebrewDataState[K]
>[number];

export interface HomebrewStore extends HomebrewDataState {
  // Pack 级管理架构（对标 4E-NEXT HomebrewPools 体系）
  packs: HomebrewPack[];
  activePackId: string;

  // Pack 动作
  setActivePack: (packId: string) => void;
  createPack: (name: string, meta?: Partial<HomebrewPackMeta>) => HomebrewPack;
  updatePack: (packId: string, updates: Partial<HomebrewPackMeta>) => void;
  deletePack: (packId: string) => void;
  togglePackEnabled: (packId: string, enabled?: boolean) => void;

  // 包内精准 CRUD 动作
  addEntryToPack: <K extends keyof HomebrewDataState>(
    packId: string,
    category: K,
    entry: HomebrewEntryOf<K>,
  ) => void;
  updateEntryInPack: <K extends keyof HomebrewDataState>(
    packId: string,
    category: K,
    id: string,
    updates: Partial<HomebrewEntryOf<K>>,
  ) => void;
  deleteEntryFromPack: <K extends keyof HomebrewDataState>(
    packId: string,
    category: K,
    id: string,
  ) => void;
  toggleEntryEnabledInPack: <K extends keyof HomebrewDataState>(
    packId: string,
    category: K,
    id: string,
    enabled?: boolean,
  ) => void;

  // 向下兼容 CRUD（默认作用于当前激活的包）
  addEntry: <K extends keyof HomebrewDataState>(category: K, entry: HomebrewEntryOf<K>) => void;
  updateEntry: <K extends keyof HomebrewDataState>(
    category: K,
    id: string,
    updates: Partial<HomebrewEntryOf<K>>,
  ) => void;
  deleteEntry: <K extends keyof HomebrewDataState>(category: K, id: string) => void;
  toggleEntryEnabled: <K extends keyof HomebrewDataState>(
    category: K,
    id: string,
    enabled?: boolean,
  ) => void;
  clearCategory: (category: keyof HomebrewDataState) => void;

  // 导入与导出动作
  exportAsJSON: (packId?: string) => string;
  exportSingleCardJSON: (
    category: keyof HomebrewDataState,
    id: string,
    packId?: string,
  ) => string | null;
  importFromJSON: (jsonStr: string) => {
    success: boolean;
    count: number;
    skipped: number;
    error?: string;
  };
}

/** 运行时防御清洗函数：过滤无效对象，确保关键标识与名称合法 */
export function sanitizeHomebrewEntry<T extends Record<string, any>>(raw: any): T | null {
  if (!raw || typeof raw !== 'object') return null;
  const id = typeof raw.id === 'string' && raw.id.trim() ? raw.id.trim() : '';
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : '';
  if (!id || !name) return null;

  return {
    ...raw,
    id,
    name,
    nameEn: typeof raw.nameEn === 'string' ? raw.nameEn : raw.nameEn || '',
    description: typeof raw.description === 'string' ? raw.description : '',
    isHomebrew: true,
    enabled: raw.enabled !== false,
  } as T;
}

export function sanitizeList<T extends Record<string, any>>(list: any): T[] {
  if (!Array.isArray(list)) return [];
  const result: T[] = [];
  for (const item of list) {
    const cleaned = sanitizeHomebrewEntry<T>(item);
    if (cleaned) {
      result.push(cleaned);
    }
  }
  return result;
}

/** 从所有已启用的 packs 中汇聚展平当前活跃的全局条目视图（供 searchIndexer 和 catalog 零修改使用） */
export function deriveActiveData(packs: HomebrewPack[]): HomebrewDataState {
  const result: HomebrewDataState = {
    spells: [],
    monsters: [],
    items: [],
    feats: [],
    species: [],
    backgrounds: [],
    classes: [],
  };

  for (const pack of packs) {
    if (!pack || pack.enabled === false) continue;
    const d = pack.data;
    if (!d) continue;

    const tag = (entry: any) => ({
      ...entry,
      isHomebrew: true,
      sourcePackId: pack.id,
      sourcePackName: pack.name,
    });

    if (Array.isArray(d.spells)) {
      result.spells.push(...d.spells.filter((e) => e && e.enabled !== false).map(tag));
    }
    if (Array.isArray(d.monsters)) {
      result.monsters.push(...d.monsters.filter((e) => e && e.enabled !== false).map(tag));
    }
    if (Array.isArray(d.items)) {
      result.items.push(...d.items.filter((e) => e && e.enabled !== false).map(tag));
    }
    if (Array.isArray(d.feats)) {
      result.feats.push(...d.feats.filter((e) => e && e.enabled !== false).map(tag));
    }
    if (Array.isArray(d.species)) {
      result.species.push(...d.species.filter((e) => e && e.enabled !== false).map(tag));
    }
    if (Array.isArray(d.backgrounds)) {
      result.backgrounds.push(...d.backgrounds.filter((e) => e && e.enabled !== false).map(tag));
    }
    if (Array.isArray(d.classes)) {
      result.classes!.push(...d.classes.filter((e) => e && e.enabled !== false).map(tag));
    }
  }

  return result;
}

function createDefaultPack(name: string, meta: Partial<HomebrewPackMeta> = {}): HomebrewPack {
  const now = new Date().toISOString();
  return {
    id: `pack-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    author: meta.author || '本地用户',
    description: meta.description || '默认卡包',
    version: meta.version || '1.0.0',
    icon: meta.icon || 'book',
    enabled: true,
    createdAt: now,
    updatedAt: now,
    data: {
      spells: [],
      monsters: [],
      items: [],
      feats: [],
      species: [],
      backgrounds: [],
      classes: [],
    },
  };
}

const INITIAL_PACK = createDefaultPack('我的原创私设包');

export const useHomebrewStore = create<HomebrewStore>()(
  persist(
    (set, get) => ({
      packs: [INITIAL_PACK],
      activePackId: INITIAL_PACK.id,
      ...deriveActiveData([INITIAL_PACK]),

      setActivePack: (packId: string) => {
        set({ activePackId: packId });
      },

      createPack: (name: string, meta = {}) => {
        const pack = createDefaultPack(name, meta);
        set((state) => {
          const nextPacks = [...state.packs, pack];
          return {
            packs: nextPacks,
            activePackId: pack.id,
            ...deriveActiveData(nextPacks),
          };
        });
        return pack;
      },

      updatePack: (packId: string, updates: Partial<HomebrewPackMeta>) => {
        set((state) => {
          const nextPacks = state.packs.map((p) =>
            p.id === packId ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p,
          );
          return {
            packs: nextPacks,
            ...deriveActiveData(nextPacks),
          };
        });
      },

      deletePack: (packId: string) => {
        set((state) => {
          const nextPacks = state.packs.filter((p) => p.id !== packId);
          // 若全部删完，补充一个默认包
          const safePacks =
            nextPacks.length > 0 ? nextPacks : [createDefaultPack('我的原创私设包')];
          const nextActiveId = state.activePackId === packId ? safePacks[0].id : state.activePackId;
          return {
            packs: safePacks,
            activePackId: nextActiveId,
            ...deriveActiveData(safePacks),
          };
        });
      },

      togglePackEnabled: (packId: string, enabled?: boolean) => {
        set((state) => {
          const nextPacks = state.packs.map((p) => {
            if (p.id !== packId) return p;
            const nextVal = typeof enabled === 'boolean' ? enabled : !p.enabled;
            return { ...p, enabled: nextVal, updatedAt: new Date().toISOString() };
          });
          return {
            packs: nextPacks,
            ...deriveActiveData(nextPacks),
          };
        });
      },

      addEntryToPack: (packId, category, entry) => {
        const itemWithFlag = sanitizeHomebrewEntry(entry) || {
          ...entry,
          isHomebrew: true,
          enabled: true,
        };

        set((state) => {
          let found = false;
          const nextPacks = state.packs.map((p) => {
            if (p.id !== packId) return p;
            found = true;
            const currentList = Array.isArray(p.data[category]) ? (p.data[category] as any[]) : [];
            return {
              ...p,
              updatedAt: new Date().toISOString(),
              data: {
                ...p.data,
                [category]: [...currentList, itemWithFlag],
              },
            };
          });

          if (!found) return state;
          return {
            packs: nextPacks,
            ...deriveActiveData(nextPacks),
          };
        });
      },

      updateEntryInPack: (packId, category, id, updates) => {
        set((state) => {
          const nextPacks = state.packs.map((p) => {
            if (p.id !== packId) return p;
            const currentList = Array.isArray(p.data[category]) ? (p.data[category] as any[]) : [];
            const nextList = currentList.map((item) =>
              item.id === id ? { ...item, ...updates } : item,
            );
            return {
              ...p,
              updatedAt: new Date().toISOString(),
              data: {
                ...p.data,
                [category]: nextList,
              },
            };
          });
          return {
            packs: nextPacks,
            ...deriveActiveData(nextPacks),
          };
        });
      },

      deleteEntryFromPack: (packId, category, id) => {
        set((state) => {
          const nextPacks = state.packs.map((p) => {
            if (p.id !== packId) return p;
            const currentList = Array.isArray(p.data[category]) ? (p.data[category] as any[]) : [];
            const nextList = currentList.filter((item) => item.id !== id);
            return {
              ...p,
              updatedAt: new Date().toISOString(),
              data: {
                ...p.data,
                [category]: nextList,
              },
            };
          });
          return {
            packs: nextPacks,
            ...deriveActiveData(nextPacks),
          };
        });
      },

      toggleEntryEnabledInPack: (packId, category, id, enabled) => {
        set((state) => {
          const nextPacks = state.packs.map((p) => {
            if (p.id !== packId) return p;
            const currentList = Array.isArray(p.data[category]) ? (p.data[category] as any[]) : [];
            const nextList = currentList.map((item) => {
              if (item.id !== id) return item;
              const nextVal = typeof enabled === 'boolean' ? enabled : !(item.enabled !== false);
              return { ...item, enabled: nextVal };
            });
            return {
              ...p,
              updatedAt: new Date().toISOString(),
              data: {
                ...p.data,
                [category]: nextList,
              },
            };
          });
          return {
            packs: nextPacks,
            ...deriveActiveData(nextPacks),
          };
        });
      },

      // 向下兼容方法（自动路由至 activePack）
      addEntry: (category, entry) => {
        const state = get();
        const targetPackId = state.activePackId || state.packs[0]?.id || INITIAL_PACK.id;
        state.addEntryToPack(targetPackId, category, entry);
      },

      updateEntry: (category, id, updates) => {
        const state = get();
        // 查找包含该 ID 的包
        const pack = state.packs.find((p) => (p.data[category] as any[])?.some((i) => i.id === id));
        if (pack) {
          state.updateEntryInPack(pack.id, category, id, updates);
        } else if (state.activePackId) {
          state.updateEntryInPack(state.activePackId, category, id, updates);
        }
      },

      deleteEntry: (category, id) => {
        const state = get();
        const pack = state.packs.find((p) => (p.data[category] as any[])?.some((i) => i.id === id));
        if (pack) {
          state.deleteEntryFromPack(pack.id, category, id);
        }
      },

      toggleEntryEnabled: (category, id, enabled) => {
        const state = get();
        const pack = state.packs.find((p) => (p.data[category] as any[])?.some((i) => i.id === id));
        if (pack) {
          state.toggleEntryEnabledInPack(pack.id, category, id, enabled);
        }
      },

      clearCategory: (category) => {
        set((state) => {
          const nextPacks = state.packs.map((p) => {
            if (p.id !== state.activePackId) return p;
            return {
              ...p,
              data: {
                ...p.data,
                [category]: [],
              },
            };
          });
          return {
            packs: nextPacks,
            ...deriveActiveData(nextPacks),
          };
        });
      },

      exportAsJSON: (packId?: string) => {
        const state = get();
        const targetPack =
          (packId ? state.packs.find((p) => p.id === packId) : null) ||
          state.packs.find((p) => p.id === state.activePackId) ||
          state.packs[0];

        if (!targetPack) {
          return JSON.stringify({ version: '2.0.0', data: deriveActiveData(state.packs) }, null, 2);
        }

        return exportPackToJSON(targetPack);
      },

      exportSingleCardJSON: (category, id, packId) => {
        const state = get();
        const pack = packId
          ? state.packs.find((p) => p.id === packId)
          : state.packs.find((p) => (p.data[category] as any[])?.some((item) => item.id === id));

        const card = (pack?.data[category] as any[])?.find((item) => item.id === id);
        if (!card) return null;
        return exportSingleCardToJSON(category, card, pack?.name || '原创私设');
      },

      importFromJSON: (jsonStr: string) => {
        try {
          const { pack, summary } = parseImportedJSON(jsonStr);

          // 确保 ID 不发生冲突
          const state = get();
          let finalId = pack.id;
          let counter = 1;
          while (state.packs.some((p) => p.id === finalId)) {
            finalId = `${pack.id}-${counter}`;
            counter++;
          }
          pack.id = finalId;

          set((s) => {
            const nextPacks = [...s.packs, pack];
            return {
              packs: nextPacks,
              activePackId: pack.id,
              ...deriveActiveData(nextPacks),
            };
          });

          return { success: true, count: summary.total, skipped: 0 };
        } catch (e: any) {
          return { success: false, count: 0, skipped: 0, error: e.message || 'JSON 解析失败' };
        }
      },
    }),
    {
      name: 'dnd2024-homebrew-storage',
      version: 3,
      storage: createJSONStorage(() => safeLocalStorage),
      migrate: (persisted: any, version: number) => {
        if (!persisted || typeof persisted !== 'object') return persisted;

        let packs: HomebrewPack[] = Array.isArray(persisted.packs) ? persisted.packs : [];

        // 迁移旧版扁平散落条目（版本 < 3 或无 packs 字段）
        if (packs.length === 0) {
          const spells = sanitizeList<HomebrewDataState['spells'][number]>(persisted.spells);
          const monsters = sanitizeList<Monster>(persisted.monsters);
          const items = sanitizeList<HomebrewDataState['items'][number]>(persisted.items);
          const feats = sanitizeList<HomebrewDataState['feats'][number]>(persisted.feats);
          const species = sanitizeList<HomebrewDataState['species'][number]>(persisted.species);
          const backgrounds = sanitizeList<HomebrewDataState['backgrounds'][number]>(
            persisted.backgrounds,
          );
          const classes = sanitizeList<any>(persisted.classes);

          const hasLegacy =
            spells.length > 0 ||
            monsters.length > 0 ||
            items.length > 0 ||
            feats.length > 0 ||
            species.length > 0 ||
            backgrounds.length > 0 ||
            classes.length > 0;

          if (hasLegacy) {
            packs.push({
              id: 'pack-legacy-migrated',
              name: '本地自制卡包 (自动迁移)',
              author: '本地用户',
              description: '由系统从旧版本存储中自动恢复并升级为卡包模式的自制数据。',
              version: '1.0.0',
              icon: 'book',
              enabled: true,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              data: {
                spells,
                monsters,
                items,
                feats,
                species,
                backgrounds,
                classes,
              },
            });
          }
        }

        if (packs.length === 0) {
          packs.push(createDefaultPack('我的原创私设包'));
        }

        const activePackId =
          persisted.activePackId && packs.some((p) => p.id === persisted.activePackId)
            ? persisted.activePackId
            : packs[0].id;

        const activeData = deriveActiveData(packs);

        return {
          ...persisted,
          packs,
          activePackId,
          ...activeData,
        };
      },
    },
  ),
);
