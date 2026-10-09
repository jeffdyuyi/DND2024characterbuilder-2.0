/**
 * D&D 2024 Alignment Type Definition
 * 遵循《数据处理核心原则》：保留原始文段。
 */

export interface Alignment {
  id: string; // 简写标识 (如 'LG')
  name: string; // 中文名称 (如 '守序善良')
  nameEn: string; // 英文名称 (如 'Lawful Good')
  description: string; // 完整的阵营描述文段
}
