/**
 * D&D 2024 (5E Revised) Base Item Type Definitions
 * 遵循《数据处理核心原则》：所有装备项的基础接口。
 */

export interface ItemItem {
    id: string;          // 唯一标识 (如 'dagger-2024')
    name: string;        // 中文名称
    nameEn?: string;     // 英文名称
    source: string;      // 来源标识 (如 'XPHB', 'PHB2024')
    type: string;        // 类型 (如 '近战武器', '重甲', '盾牌')
    cost?: string;       // 价值
    weight?: string;     // 重量
    description?: string;// 描述
    tags?: string[];     // 标签
}
