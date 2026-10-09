/**
 * D&D 语言类型定义
 */
export type LanguageCategory = 'Standard' | 'Rare' | 'Exotic';

export interface Language {
  id: string;
  name: string;
  nameEn: string;
  type: LanguageCategory;
  source?: string; // 来源书籍，如 XPHB, PHB 等
  typicalSpeakers?: string[];
  script?: string;
  origin?: string;
  dialects?: string[]; // 如原初语包含的方言
}
