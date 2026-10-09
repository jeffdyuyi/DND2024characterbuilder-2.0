/** 书籍身份包含数据包，避免第三方与官方使用相同 source 代码时串选。 */
export interface SourceBook {
  sourcePackId: string;
  source: string;
}

/** 缺省/全部保持旧存档行为；selected + [] 明确表示不允许任何书籍。 */
export type SourceSelection = { mode: 'all' } | { mode: 'selected'; books: SourceBook[] };

export interface CharacterSourcePolicy {
  selection?: SourceSelection;
  allowHomebrew: boolean;
}
