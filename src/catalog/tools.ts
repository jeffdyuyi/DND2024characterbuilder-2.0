/**
 * 全量 5etools 工具集管理与提取服务 (Tools Service)
 * 对应《DND5R_5etools_rules_engine_agent_spec.md》规范 §8、§9、§18
 *
 * 核心原则：
 * 1. 动态自省：全面从 Catalog (item 与 baseitem) 动态提取官方扩展 (SCAG/FRHoF/ERLW等) 及第三方 Homebrew 中的新增乐器、赌具、工匠工具；
 * 2. 语料零篡改：提取 5etools 原生中文名与英文名，严禁自主臆测机翻；
 * 3. 稳健兜底：内建官方已知全量标准与扩展工具清单，确保离线与首屏未完全加载时工具齐备。
 */

import { defaultCatalog } from './catalog';
import { getSourceDisplayName, getSourceSortWeight } from '@/config/sourceMapping';

export type ToolCategory = 'Artisan' | 'Gaming' | 'Musical' | 'Other' | 'Vehicle';

export interface CatalogToolEntry {
  id: string; // 规范化小写标识符 (单来源如 "birdpipes", 多来源如 "drum|xphb")
  name: string; // 5etools 中文名 (单来源如 "鸟箫", 多来源如 "鼓 [2024 玩家手册]")
  nameEn: string; // 英文原名 (如 "Birdpipes", "Smith's Tools")
  category: ToolCategory;
  source: string;
  isHomebrew?: boolean;
  aliasId?: string;
}

// 1. 全量官方工匠工具 (17种标准工匠工具)
export const STANDARD_ARTISAN_TOOLS = [
  "alchemist's supplies",
  "brewer's supplies",
  "calligrapher's supplies",
  "carpenter's tools",
  "cartographer's tools",
  "cobbler's tools",
  "cook's utensils",
  "glassblower's tools",
  "jeweler's tools",
  "leatherworker's tools",
  "mason's tools",
  "painter's supplies",
  "potter's tools",
  "smith's tools",
  "tinker's tools",
  "weaver's tools",
  "woodcarver's tools",
];

// 2. 全量官方与扩展赌具 (PHB核心 + 扩展书)
export const STANDARD_GAMING_SETS = [
  'dice set',
  'dragonchess set',
  'playing card set',
  'playing cards',
  'three-dragon ante set',
  // 扩展与变体赌具
  'bone dice',
  'chess set',
  'bowling set',
];

// 3. 全量官方与扩展乐器 (PHB核心10种 + SCAG扩展11种 + FRHoF及其他扩展)
export const STANDARD_MUSICAL_INSTRUMENTS = [
  // PHB 核心乐器
  'bagpipes',
  'drum',
  'dulcimer',
  'flute',
  'lute',
  'lyre',
  'horn',
  'pan flute',
  'shawm',
  'viol',
  // SCAG (剑湾冒险者指南) 扩展乐器
  'birdpipes',
  'glaur',
  'hand drum',
  'longhorn',
  'songhorn',
  'tantan',
  'thelarr',
  'tocken',
  'wargong',
  'yarting',
  'zulkoon',
  // FRHoF / 吟游诗人古乐器
  'bandore',
  'cittern',
  'violoncello',
];

// 4. 全量其他工具 (2014 Other Tools / 2024 Other Tools)
export const STANDARD_OTHER_TOOLS = [
  'disguise kit',
  'forgery kit',
  'herbalism kit',
  "navigator's tools",
  "poisoner's kit",
  "thieves' tools",
];

// 5. 全量载具
export const STANDARD_VEHICLES = [
  'vehicles (land)',
  'vehicles (water)',
  'vehicles (air)',
  'vehicles (space)',
];

export const ALL_STANDARD_TOOLS = [
  ...STANDARD_ARTISAN_TOOLS,
  ...STANDARD_GAMING_SETS,
  ...STANDARD_MUSICAL_INSTRUMENTS,
  ...STANDARD_OTHER_TOOLS,
  ...STANDARD_VEHICLES,
];

// 离线/默认中文映射兜底表
const BASE_TOOL_NAMES_ZH: Record<string, string> = {
  // 工匠工具
  "alchemist's supplies": '炼金术士用品',
  "brewer's supplies": '酿酒人用品',
  "calligrapher's supplies": '书法家用品',
  "carpenter's tools": '木工工具',
  "cartographer's tools": '制图师工具',
  "cobbler's tools": '鞋匠工具',
  "cook's utensils": '厨师用具',
  "glassblower's tools": '吹玻璃工工具',
  "jeweler's tools": '珠宝匠工具',
  "leatherworker's tools": '皮匠工具',
  "mason's tools": '石匠工具',
  "painter's supplies": '画师用品',
  "potter's tools": '陶匠工具',
  "smith's tools": '铁匠工具',
  "tinker's tools": '修补匠工具',
  "weaver's tools": '织工工具',
  "woodcarver's tools": '木雕工具',
  // 赌具
  'dice set': '骰子组',
  'dragonchess set': '龙棋组',
  'playing card set': '整副纸牌',
  'playing cards': '纸牌',
  'three-dragon ante set': '整副三龙牌',
  'bone dice': '骨骰',
  'chess set': '国际象棋组',
  'bowling set': '九柱球组',
  // 乐器
  'bagpipes': '风笛',
  'drum': '鼓',
  'dulcimer': '扬琴',
  'flute': '长笛',
  'lute': '鲁特琴',
  'lyre': '里拉琴',
  'horn': '号角',
  'pan flute': '排箫',
  'shawm': '芦笛',
  'viol': '提琴',
  'birdpipes': '鸟箫',
  'glaur': '格劳尔号',
  'hand drum': '手鼓',
  'longhorn': '长号角',
  'songhorn': '歌唱号角',
  'tantan': '镗镗',
  'thelarr': '斯拉尔管',
  'tocken': '托肯',
  'wargong': '战锣',
  'yarting': '雅廷琴',
  'zulkoon': '咒昆琴',
  'bandore': '班多里琴',
  'cittern': '西特琴',
  'violoncello': '大提琴',
  // 其他工具
  'disguise kit': '易容工具',
  'forgery kit': '文书伪造工具',
  'herbalism kit': '草药工具',
  "navigator's tools": '领航工具',
  "poisoner's kit": '制毒工具',
  "thieves' tools": '盗贼工具',
  // 载具
  'vehicles (land)': '陆地载具',
  'vehicles (water)': '水上载具',
  'vehicles (air)': '空中载具',
  'vehicles (space)': '太空载具',
};

function normalizeKey(str: string): string {
  return String(str || '').toLowerCase().trim().replace(/['’]s/g, '').replace(/s['’]/g, 's').replace(/[^a-z0-9]/g, '');
}

/**
 * 基于 5etools 标准 AST 属性动态判定是否为魔法物品或变体（严禁按物品名硬编码）
 */
function isMagicToolItem(raw: any, entry?: any): boolean {
  if (!raw) return false;
  if (entry?.kind === 'magicvariant') return true;
  if (raw.rarity && String(raw.rarity).toLowerCase() !== 'none') return true;
  if (raw.reqAttune || raw.tier || raw.wondrous || raw.baseItem) return true;
  if (raw.type && String(raw.type).includes('$M')) return true;
  if (raw.bonusWeapon || raw.bonusAc || raw.bonusSpellAttack || raw.bonusSpellSaveDc) return true;
  return false;
}

let cachedToolEntries: CatalogToolEntry[] | null = null;
let cachedCatalogFingerprint = '';

/**
 * 手动使工具内存缓存失效（通常在动态注册批量 Homebrew 物品后由系统调度）
 */
export function invalidateCatalogToolCache(): void {
  cachedToolEntries = null;
  cachedCatalogFingerprint = '';
}

/**
 * 动态从 5etools Catalog (包含 item, baseitem, 及 homebrew 物品) 提取全部工具条目
 * 严禁硬编码；严格过滤魔法物品变体；相同工具同时存在于多个来源 (如 2024 XPHB 与 2014 PHB) 时予以来源区分
 * 引入惰性单例缓存，在 Catalog 数据无变化时直接 O(1) 返回，保障真实用户端与开发端极致流畅
 */
export function getCatalogToolEntries(): CatalogToolEntry[] {
  const rawItems = defaultCatalog.list('item');
  const rawBaseItems = defaultCatalog.list('baseitem');
  const currentFingerprint = `${rawItems.length}:${rawBaseItems.length}`;
  if (cachedToolEntries && cachedCatalogFingerprint === currentFingerprint) {
    return cachedToolEntries;
  }

  interface IntermediateEntry {
    normKey: string;
    name: string;
    nameEn: string;
    category: ToolCategory;
    source: string;
    isHomebrew?: boolean;
    entryId?: string;
  }

  const rawEntries = [...rawItems, ...rawBaseItems];
  const candidates: IntermediateEntry[] = [];
  const dedupSet = new Set<string>();

  // 1. 扫描 Catalog 中的已加载普通基础物品与扩展物品
  for (const entry of rawEntries) {
    const raw = entry.raw as any;
    if (!raw) continue;
    if (isMagicToolItem(raw, entry)) continue;

    const rawType = String(raw.type || '').split('|')[0].toUpperCase();
    let category: ToolCategory | undefined;
    if (rawType === 'AT') category = 'Artisan';
    else if (rawType === 'GS') category = 'Gaming';
    else if (rawType === 'INS') category = 'Musical';
    else if (rawType === 'T') category = 'Other';
    else if (rawType === 'VEH' || rawType === 'SHP' || rawType === 'AIR') category = 'Vehicle';

    if (!category) continue;

    const rawEn = raw.ENG_name || entry.englishName || entry.name;
    const rawZh = entry.name || raw.name || rawEn;
    const source = String(entry.source || raw.source || 'PHB').toUpperCase();
    const normKey = rawEn.toLowerCase().trim();

    const dedupKey = `${normKey}:::${source}`;
    if (!dedupSet.has(dedupKey)) {
      dedupSet.add(dedupKey);
      candidates.push({
        normKey,
        name: rawZh,
        nameEn: rawEn,
        category,
        source,
        isHomebrew: entry.isHomebrew,
        entryId: entry.id,
      });
    }
  }

  // 2. 离线标准集兜底补充（若 catalog 完全未载入）
  const addFallback = (list: string[], cat: ToolCategory) => {
    for (const id of list) {
      const normKey = id.toLowerCase().trim();
      const dedupKey = `${normKey}:::PHB`;
      if (!dedupSet.has(dedupKey) && !candidates.some(c => c.normKey === normKey)) {
        dedupSet.add(dedupKey);
        candidates.push({
          normKey,
          name: BASE_TOOL_NAMES_ZH[id] || id,
          nameEn: id.charAt(0).toUpperCase() + id.slice(1),
          category: cat,
          source: 'PHB',
        });
      }
    }
  };

  addFallback(STANDARD_ARTISAN_TOOLS, 'Artisan');
  addFallback(STANDARD_GAMING_SETS, 'Gaming');
  addFallback(STANDARD_MUSICAL_INSTRUMENTS, 'Musical');
  addFallback(STANDARD_OTHER_TOOLS, 'Other');
  addFallback(STANDARD_VEHICLES, 'Vehicle');

  // 3. 统计每个 normKey 出现的不同来源数
  const keySourcesMap = new Map<string, Set<string>>();
  for (const item of candidates) {
    if (!keySourcesMap.has(item.normKey)) {
      keySourcesMap.set(item.normKey, new Set());
    }
    keySourcesMap.get(item.normKey)!.add(item.source);
  }

  // 4. 构建最终条目并区分多来源
  const result: CatalogToolEntry[] = candidates.map(item => {
    const multiSources = keySourcesMap.get(item.normKey)!.size > 1;
    const sourceDisplay = getSourceDisplayName(item.source);
    const id = multiSources ? `${item.normKey}|${item.source.toLowerCase()}` : item.normKey;
    const name = multiSources ? `${item.name} [${sourceDisplay}]` : item.name;

    const cleanEntryId = item.entryId
      ? (item.entryId.includes(':') ? item.entryId.split(':').pop()!.toLowerCase().trim() : item.entryId.toLowerCase().trim())
      : undefined;

    return {
      id,
      name,
      nameEn: item.nameEn,
      category: item.category,
      source: item.source,
      isHomebrew: item.isHomebrew,
      ...(cleanEntryId && cleanEntryId !== id && !cleanEntryId.includes('%') ? { aliasId: cleanEntryId } : {})
    } as CatalogToolEntry;
  });

  // 5. 排序：相同基础工具聚集，2024 (XPHB) 优先，2014 (PHB) 次之，扩展书其后
  result.sort((a, b) => {
    const baseA = a.id.split('|')[0];
    const baseB = b.id.split('|')[0];
    if (baseA !== baseB) {
      return baseA.localeCompare(baseB);
    }
    const weightA = getSourceSortWeight(a.source);
    const weightB = getSourceSortWeight(b.source);
    if (weightA !== weightB) return weightA - weightB;
    return a.source.localeCompare(b.source);
  });

  cachedToolEntries = result;
  cachedCatalogFingerprint = currentFingerprint;
  return result;
}

/**
 * 动态从 5etools Catalog 获取指定类别的全量工具清单 (支持官方扩展书与第三方 Homebrew)
 */
export function getCatalogTools(category?: ToolCategory): string[] {
  const entries = getCatalogToolEntries();
  const filtered = category ? entries.filter(e => e.category === category) : entries;
  const ids = new Set<string>();
  for (const e of filtered) {
    ids.add(e.id);
    if (e.aliasId && !e.aliasId.includes('%')) {
      ids.add(e.aliasId);
    }
  }
  return Array.from(ids);
}

/**
 * 判断指定工具归属的分类 (Artisan / Gaming / Musical / Other / Vehicle)
 * 全面支持模糊匹配、中英文、带 -full 后缀或来源后缀 (如 "drum|xphb")，且支持 Catalog 动态发现的扩展工具
 */
export function getToolCategory(term: string): ToolCategory | 'Unknown' {
  if (!term) return 'Unknown';
  const baseTerm = term.includes('|') ? term.split('|')[0] : term;
  const norm = normalizeKey(baseTerm);

  // 1. 尝试直接与已发现的 Catalog 条目匹配
  const entries = getCatalogToolEntries();
  for (const entry of entries) {
    if (
      normalizeKey(entry.id) === norm ||
      normalizeKey(entry.id.split('|')[0]) === norm ||
      normalizeKey(entry.nameEn) === norm ||
      normalizeKey(entry.name.replace(/\s*\[.*?\]$/, '')) === norm
    ) {
      return entry.category;
    }
  }

  // 2. 常见语义别名快速判定
  if (norm.includes('artisan') || norm.includes('工匠')) return 'Artisan';
  if (norm.includes('gaming') || norm.includes('赌具') || norm.includes('游戏套件')) return 'Gaming';
  if (norm.includes('musical') || norm.includes('instrument') || norm.includes('乐器')) return 'Musical';
  if (norm.includes('vehicle') || norm.includes('载具')) return 'Vehicle';

  // 3. 静态回退比对
  if (STANDARD_ARTISAN_TOOLS.some(t => normalizeKey(t) === norm)) return 'Artisan';
  if (STANDARD_GAMING_SETS.some(t => normalizeKey(t) === norm)) return 'Gaming';
  if (STANDARD_MUSICAL_INSTRUMENTS.some(t => normalizeKey(t) === norm)) return 'Musical';
  if (STANDARD_OTHER_TOOLS.some(t => normalizeKey(t) === norm)) return 'Other';
  if (STANDARD_VEHICLES.some(t => normalizeKey(t) === norm)) return 'Vehicle';

  return 'Unknown';
}

/**
 * 获取工具的中文显示名，支持直接解析带来源标识的工具 ID (如 "drum|xphb" -> "鼓 [2024 玩家手册]")
 */
export function getToolDisplayName(term: string): string {
  if (!term) return '';
  const entries = getCatalogToolEntries();

  // 1. 精确匹配 entry.id (例如 "drum|xphb" 或 "birdpipes")
  const exact = entries.find(e => e.id.toLowerCase() === term.toLowerCase());
  if (exact && exact.name) return exact.name;

  // 2. 如果包含来源区分符 (例如 "drum|xphb") 但未命中已存条目
  if (term.includes('|')) {
    const [baseKey, source] = term.split('|');
    const sourceDisplay = getSourceDisplayName(source.toUpperCase());
    const matchedBase = entries.find(e => 
      e.id.split('|')[0].toLowerCase() === baseKey.toLowerCase() ||
      normalizeKey(e.nameEn) === normalizeKey(baseKey)
    );
    const pureName = matchedBase?.name?.replace(/\s*\[.*?\]$/, '') || BASE_TOOL_NAMES_ZH[baseKey] || baseKey;
    return `${pureName} [${sourceDisplay}]`;
  }

  const norm = normalizeKey(term);

  // 3. 检查内建映射
  if (BASE_TOOL_NAMES_ZH[term]) return BASE_TOOL_NAMES_ZH[term];
  if (BASE_TOOL_NAMES_ZH[term.toLowerCase()]) return BASE_TOOL_NAMES_ZH[term.toLowerCase()];

  // 4. 检查 Catalog 条目
  const matched = entries.find(e => 
    normalizeKey(e.id) === norm || 
    normalizeKey(e.nameEn) === norm || 
    normalizeKey(e.name.replace(/\s*\[.*?\]$/, '')) === norm
  );
  if (matched && matched.name) {
    // 若查询的是基础名，返回其纯净基础中文名（去除括号后缀）
    return matched.name.replace(/\s*\[.*?\]$/, '');
  }

  return term;
}
