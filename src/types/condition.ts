/**
 * D&D 2024 异常状态类型定义
 * 遵循《数据处理核心原则》：保留原始文段，结构化提取信息。
 */

export interface Condition {
  id: string; // 英文标识 (如 'blinded')
  name: string; // 中文名称 (如 '目盲')
  description: string; // 完整的状态描述文段 (HTML/Markdown 格式保留原始文本)

  /**
   * 结构化效果 (用于自动化计算)
   */
  mechanics?: {
    speedZero?: boolean; // 速度归零
    incapacitated?: boolean; // 陷入失能
    disadvantageOnAttacks?: boolean; // 攻击检定劣势
    advantageToBeHit?: boolean; // 被攻击时具有优势
    failSavingThrows?: string[]; // 自动失败的豁免项 (如 ['力量', '敏捷'])
    immuneTo?: string[]; // 免疫的状态
    special?: string; // 其他特殊机械逻辑描述
  };
}
