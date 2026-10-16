import type { CatalogEntry } from '@/catalog/types';

export type SpellGrantMode = 'known' | 'prepared' | 'innate' | 'expanded';
export interface SpellReference {
  name: string;
  source: string;
  /** 原生 # 后缀保留，不能把环阶/戏法标记当成名称。 */
  suffix?: string;
  raw: string;
}
export interface SpellGrantRule {
  id: string;
  mode: SpellGrantMode;
  gate: { kind: 'none' | 'level' | 'spellLevel'; value?: number; raw: string };
  /** daily不等于长休；次数键含义与正文须在运行时适配阶段核对。 */
  usage: {
    kind: 'unspecified' | 'will' | 'ritual' | 'daily' | 'rest' | 'weekly' | 'yearly' | 'resource';
    key?: string;
  };
  selection:
    | { kind: 'fixed'; spell: SpellReference }
    | { kind: 'choose'; count: number; from?: SpellReference[]; filter?: string }
    | { kind: 'all'; filter: string };
  /** 同一个资源分组保留关联，不擅自给每道法术复制次数。 */
  resourceGroupId: string;
  raw: unknown;
}
export interface ParsedSpellGrants {
  origin: Pick<
    CatalogEntry,
    'id' | 'kind' | 'name' | 'source' | 'sourcePackId' | 'edition' | 'revision'
  >;
  /** 多块的互斥/累加关系不能仅据数组存在而推断。 */
  blockRelationship: 'single' | 'unspecified';
  blocks: {
    id: string;
    /** 元数据无法区分多个块时仍使用内容身份；这类块跨修订不能自动迁移选择。 */
    identityStability: 'metadata' | 'content';
    name?: string;
    nameEn?: string;
    /** 仅保留原生资源名称，不推断资源池容量、消耗或恢复方式。 */
    resourceName?: string;
    ability?:
      { kind: 'fixed'; value: string } | { kind: 'choose'; from: string[] } | { kind: 'inherit' };
    rules: SpellGrantRule[];
    /** 含未识别条件的块不可直接激活，必须先处理诊断。 */
    requiresReview: boolean;
    raw: unknown;
  }[];
  /** attachedSpells可能只是法术书收录或引用索引，绝不直接变成施法授予。 */
  associations: { path: string; spell: SpellReference; raw: unknown }[];
  diagnostics: { code: string; path: string; message: string; raw: unknown }[];
}
