import { Selection } from './species';

export interface CharacteristicOption {
  id: string;
  text: string;
}

export interface BackgroundCurrency {
  cp?: number;
  sp?: number;
  ep?: number;
  gp?: number;
  pp?: number;
}

export type BackgroundEquipmentCategory = 'weapon' | 'armor' | 'shield' | 'gear' | 'tool';

export interface BackgroundEquipmentRecord {
  kind: 'item' | 'currency' | 'unresolved';
  label: string;
  itemId?: string;
  quantity?: number;
  category?: BackgroundEquipmentCategory;
  currency?: BackgroundCurrency;
  selectionId?: string;
  /** 每个二选一标签对应的原始结构化物品，保留数量、货币与出处。 */
  choices?: Record<string, BackgroundEquipmentRecord[]>;
}

export interface BackgroundVariant {
  id: string; // 变体唯一标识 (如 'spy')
  name: string; // 变体中文名称
  nameEn: string; // 变体英文名称
  description: string; // 变体具体描述
  overrides?: Partial<Background>; // 变体带来的数据覆盖 (如角斗士替换乐器为武器)
}

export interface FlavorTable {
  name: string;
  dice?: string;
  rows: { id: number; content: string }[];
}

export interface Background {
  id: string; // 唯一标识 (如 'acolyte')
  source: string; // 来源标识，如 "PHB2024"
  name: string; // 中文名称
  nameEn: string; // 英文名称
  description: string; // 完整的背景描述文段

  /**
   * 背景变体 (Variants)
   * 例如“罪犯”背景下的“间谍”变体。选中变体后，角色卡的背景名称会发生改变。
   */
  variants?: BackgroundVariant[];

  /**
   * 属性值建议（Ability Scores）
   * 2024 规则中，每个背景提供 3 个属性。
   * 2014 规则中此项通常为空，但为了支持“按同名背景限制选择”，可以填入建议值。
   */
  abilityScoreOptions?: string[];

  /**
   * 起源专长（Origin Feat）
   * 2024 背景建议必须。2014 背景无此项。
   * UI 逻辑应支持：固定分配（2024）、可选分配（2014 适配）、不分配。
   */
  feat?: {
    name: string;
    nameEn: string;
    description?: string;
    mechanicsOverride?: any;
  };

  /**
   * 是否强制要求属性与专长 (Rule Enforcement)
   * true: 必须从上述选项中选择 (2024 核心模式)
   * false: 允许自由分配或不分配 (2014/自由模式)
   */
  enforceRules?: boolean;

  /**
   * 技能熟练（Skill Proficiencies）
   */
  skillProficiencies: (string | Selection<string>)[];

  /**
   * 工具熟练（Tool Proficiency）
   */
  toolProficiencies?: (string | Selection<string>)[];

  /**
   * 语言（Languages）
   * 2014 背景经常提供语言项。
   */
  languages?: (string | Selection<string>)[];

  /**
   * 初始装备（Starting Equipment）
   */
  equipment: {
    choiceA: (string | Selection<string>)[];
    choiceB?: string;
    choiceARecords?: BackgroundEquipmentRecord[];
    choiceBRecord?: BackgroundEquipmentRecord;
  };

  /**
   * 背景特性 (Legacy Feature - 2014)
   * 在 2024 规则中被移除，但在混合模式下可作为开关项。
   */
  legacyFeature?: {
    name: string;
    nameEn: string;
    description: string;
  };

  /**
   * 风味表格 (Flavor Tables)
   * 用于存储如“命定事件”、“作案手法”等背景特有的随机表。
   */
  flavorTables?: FlavorTable[];

  /**
   * 建议特征 (Suggested Characteristics - 2014)
   * 包含人格特质、理想、牵绊、缺点。支持纯文本数组或带 ID 的对象数组。
   */
  suggestedCharacteristics?: {
    personalityTraits: (string | CharacteristicOption)[];
    ideals: (string | CharacteristicOption)[];
    bonds: (string | CharacteristicOption)[];
    flaws: (string | CharacteristicOption)[];
  };
}
