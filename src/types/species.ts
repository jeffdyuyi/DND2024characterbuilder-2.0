/**
 * D&D 2024 (5E Revised) Species Type Definitions
 * 遵循《数据处理核心原则》：保留原始文段，结构化提取信息。
 */

export type Size = 'Small' | 'Medium' | 'Large';

export interface Senses {
  darkvision?: number; // 距离（尺）
  tremorsense?: number;
  blindsight?: number;
  truesight?: number;
}

/**
 * 针对 D&D 2024 的可选项设计
 * 用于处理如龙裔选择龙种、精灵选择熟练技能等逻辑
 */
export interface Selection<T> {
  numToChoose: number;
  options: T[];
  name?: string; // 分组标题
  nameEn?: string;
  description?: string; // 可选的统一通用说明文案
  isLongRestChoice?: boolean; // 标记是否为长休整备项（角色卡生成后在每日整备区域处理）
  filter?: string; // 引擎过滤指令（如 "class:wizard;level:0" 或 "type:origin"）
  hostTraitName?: string; // 宿主特性的原生中文名称
  hostTraitNameEn?: string; // 宿主特性的原生英文名称
  levelRequirement?: number; // 生效等级门槛（默认 1 级）
  isGamePlayChoice?: boolean; // 标记是否为游戏中/进阶等级抉择
}

/**
 * 天生施法/种族法术结构
 * 支持 1/3/5 级解锁逻辑
 */
export interface InnateSpell {
  level: number; // 解锁等级
  spellId?: string; // 关联 src/data/spell 中的 ID (新规)
  spellName: string;
  spellNameEn: string;
  isPrepared: boolean; // 是否时刻准备
  freeCastsPerLongRest: number | 'Proficiency Bonus'; // 每日免费施展次数（通常为 1 或 Infinity 或 熟练加值）
  useSpellSlots: boolean; // 是否可以使用法术位施展
}

/**
 * 特质属性集合
 * 用于存储特质带来的机械性加成
 */
export interface TraitFeatures {
  speedBonus?: number; // 速度加成（如木精灵 +5）
  climbSpeed?: number | 'Walking Speed'; // 攀爬速度
  swimSpeed?: number | 'Walking Speed'; // 游泳速度
  flightSpeed?: number | 'Walking Speed'; // 飞行速度
  hpBonusPerLevel?: number; // 生命值上限加成（如矮人 +1）
  acBonus?: number; // AC 加成（如战俑 +1）
  senseUpgrade?: Senses; // 感官升级（如卓尔黑暗视觉 120尺）
  resistances?: string[]; // 伤害抗性
  resistanceChoices?: Selection<string>[]; // 伤害抗性自选 (如重生者 Strange Endurance 等)
  skillProficiencies?: (string | Selection<string>)[]; // 熟练项（支持固定与自选混合）
  toolProficiencies?: (string | Selection<string>)[];
  skillToolProficiencies?: Selection<string>[]; // 混合技能与工具熟练自选 (如涅非利亚人、特裘如精灵)
  weaponProficiencies?: (string | Selection<string>)[];
  armorProficiencies?: (string | Selection<string>)[];
  languages?: (string | Selection<string>)[];
  originFeats?: Selection<string>; // 2024 起源专长选择（如人类）
  spells?: (InnateSpell | Selection<InnateSpell>)[]; // 提供的法术（支持固定与自选/长休切换）
  spellcastingAbility?: Selection<string>; // 与该特质法术绑定的施法属性选择
  abilityScoreIncrease?: Record<string, number>; // 属性值加成
  passiveEffects?: string[]; // 其他被动效果描述
}

/**
 * 种族特质接口
 */
export interface Trait {
  id?: string; // 唯一标识 (可选，因为某些子特质可能不需要独立 ID)
  name: string;
  nameEn?: string;
  description: string; // 核心：必须完整保存用户提供的原始描述文段
  level?: number; // 解锁等级（如天启为 3 级）
  action?: 'Action' | 'Bonus Action' | 'Reaction' | 'None' | 'Magic Action';
  usage?: {
    limit: number | 'Proficiency Bonus';
    recovery: 'Short Rest' | 'Long Rest' | 'Short or Long Rest' | '1d4 Long Rests' | 'Dawn';
  };
  features?: TraitFeatures;
  mechanics?: any; // 机械逻辑数据，支持自动化计算
  scaling?: {
    diceCount: Record<number, number>; // level -> dice count, e.g. {1: 1, 5: 2, 11: 3, 17: 4}
    diceType: string; // e.g. "d10"
  };
  options?: Trait[]; // 子特质选项（如天启的三个变身选项）
  numToChoose?: number; // 如果存在，表示这是一个需要在构建器中进行的永久选择（如巨人先祖）
  representsSubSpecies?: boolean; // 如果为 true，该特质的渲染将包含亚种选择逻辑
  overwrite?: string; // 5etools 原生规则：该特质覆盖/替换基础种族的特质名称
  replacesTraitName?: string; // 前端/引擎渲染辅助：被该特质替代的母特质名称
}

/**
 * 种族属性值自选分配定义 (如 5etools 2024 / choose 格式)
 */
export interface AbilityScoreChoice {
  from: string[]; // 可选属性键，如 ["str", "dex", "con", "int", "wis", "cha"]
  count: number; // 需选数量，默认为 1 或 2
  amount: number; // 每次选择加值，默认为 1
  weights?: number[]; // 若有加值权重，如 [2, 1]
}

/**
 * 种族亚种/血系接口
 * 在 2024 规则中，Species 下通常包含 Lineage 或 SubSpecies
 */
export interface SubSpecies {
  id: string; // 唯一标识
  name: string;
  nameEn: string;
  description: string; // 亚种的原始描述
  abilityScoreIncrease?: Record<string, number>; // 固定属性值加成（主要用于 PHB2014）
  abilityChoices?: AbilityScoreChoice[]; // 动态属性值自选提升 (2024 / TCE 规则)
  traits: Trait[]; // 亚种特有的特质
  features?: TraitFeatures; // 亚种结构化特性（抗性、法术、感官升级等）
  source?: string; // 来源出处标识（如 PHB, EGW, MTF 等）
  page?: number; // 出版物页码
  otherSources?: { source: string; page?: number }[]; // 其它收录或重印出处
  overwrite?: {
    ability?: boolean;
    skillProficiencies?: boolean;
    languageProficiencies?: boolean;
    traitTags?: boolean;
    [key: string]: any;
  };
}

/**
 * 种族主接口
 */
export interface Species {
  id: string; // 唯一标识
  source: string; // 来源标识（如 "PHB2024", "PHB2014"）
  name: string;
  nameEn: string;
  description: string; // 种族的原始背景描述
  creatureType: string; // 生物类型（如类人）
  size: Size[]; // 可选体型列表
  speed: number; // 基础速度
  senses: Senses; // 基础感官
  abilityScoreIncrease?: Record<string, number>; // 固定属性值加成（主要用于 PHB2014）
  abilityChoices?: AbilityScoreChoice[]; // 动态属性值自选提升 (2024 / TCE 规则)
  traits: Trait[]; // 基础特质
  subSpecies?: Selection<SubSpecies>; // 亚种选择（如龙裔的龙种、精灵的血系）
}
