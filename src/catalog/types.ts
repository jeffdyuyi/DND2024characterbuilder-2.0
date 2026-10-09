/**
 * D&D 5e / 5R Catalog Types
 * 对应《DND5R_5etools_rules_engine_agent_spec.md》规范 §8、§9、§18
 */

export type EntryKind =
  | 'class'
  | 'subclass'
  | 'classFeature'
  | 'subclassFeature'
  | 'race'
  | 'subrace'
  | 'background'
  | 'feat'
  | 'spell'
  | 'item'
  | 'baseitem'
  | 'magicvariant'
  | 'optionalfeature'
  | 'charoption'
  | 'reward'
  | 'boon'
  | 'cult'
  | 'condition'
  | 'language'
  | 'rule';

export type Edition = '2014' | '2024' | 'both';

/**
 * 核心统一目录条目 (CatalogEntry)
 * 无论数据来自 5etools、tjliqy/5etools-cn、homebrew 还是 legacy 旧数据，
 * 均归一化为此标准结构。
 */
export interface CatalogEntry {
  /** 稳定全局唯一 ID，格式如 "5etools:xphb:spell:fireball" 或 "legacy:phb:spell:fireball" */
  id: string;

  /** 条目类别 */
  kind: EntryKind;

  /** 中文主展示名称 */
  name: string;

  /** 英文原名 (可选) */
  englishName?: string;

  /** 出处代码 (如 XPHB, PHB, DMG, TCE, XGE 等) */
  source: string;

  /** 规则集版本划分 */
  edition: Edition;

  /** 来源书籍所在页码 (可选) */
  page?: number;

  /** 数据包标识 (如 "5etools-cn", "legacy", "homebrew-x") */
  sourcePackId: string;

  /** 数据修订/版本号 */
  revision?: string;

  /** 是否为 Homebrew 自定义/第三方 */
  isHomebrew?: boolean;

  /** 所属父条目标识或名称 (例如职业名称之于子职业，主种族名称之于亚种) */
  parent?: string;


  /** 文本段落条目或 5etools entries 树状结构 */
  entries?: unknown[];

  /** 纯文本摘要或描述 (用于列表及搜索卡片) */
  description?: string;

  /** 原始未清洗对象引用 (保留完整上下文) */
  raw: Record<string, unknown>;
}

/** 法术扩展条目 */
export interface SpellCatalogEntry extends CatalogEntry {
  kind: 'spell';
  spell: {
    level: number;
    school: string;
    classIds: string[];
    classGrants?: Array<{ name: string; source: string }>;
    subclassIds?: string[];
    ritual?: boolean;
    concentration?: boolean;
    castingTime?: string;
    range?: string;
    components?: {
      v?: boolean;
      s?: boolean;
      m?: string | boolean;
    };
    duration?: string;
  };
}

/** 统一 Catalog 服务接口 */
export interface CatalogService {
  /** 获取指定稳定 ID 的条目 */
  get(id: string): CatalogEntry | undefined;

  /** 按类型列出条目，支持按规则版本过滤 */
  list(kind: EntryKind, options?: { edition?: Edition; source?: string }): CatalogEntry[];

  /** 全局/分类型搜索 */
  search(query: string, options?: { kind?: EntryKind; edition?: Edition; limit?: number }): CatalogEntry[];

  /** 注册单个条目 (用于动态加载或 Homebrew 扩充) */
  register(entry: CatalogEntry): void;

  /** 批量注册条目 */
  registerMany(entries: CatalogEntry[]): void;
}
