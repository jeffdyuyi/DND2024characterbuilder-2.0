/**
 * D&D 2024 (5R) Spell Type Definitions
 * 遵循《数据处理核心原则》：保留原始文段，结构化提取信息。
 */

export interface Spell {
  id: string; // 唯一标识，建议使用英文 ID (如 'acid-splash')
  name: string; // 中文名称
  nameEn: string; // 英文名称
  source: string; // 来源标识，如 "PHB2024"
  level: number; // 环位 (0-9)，0 为戏法 (Cantrip)
  school: string; // 魔法学派
  castingTime: string; // 施法时间
  range: string; // 施法距离
  components: string; // 施法材料 (V/S/M)
  duration: string; // 持续时间
  ritual?: boolean; // 是否为仪式法术
  classes: string[]; // 所属职业列表
  classGrants?: { name: string; source: string }[];
  description: string; // 完整的法术描述文段
  higherLevel?: string; // 更高环阶/等级描述文段 (Higher Levels)
  isHomebrew?: boolean; // 是否为第三方/Homebrew内容
  sourcePackId?: string; // 数据包标识
}
