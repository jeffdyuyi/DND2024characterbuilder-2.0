/**
 * D&D 2024 (5E Revised) Feat Type Definitions
 * 遵循《数据处理核心原则》：保留原始文段，结构化提取信息。
 */

export interface Feat {
    id: string;          // 唯一标识 (如 'musket-master')
    source: string;      // 来源标识，如 "PHB2024"
    name: string;        // 中文名称
    nameEn: string;      // 英文名称
    category: 'Origin' | 'General' | 'Epic Boon' | 'Fighting Style' | 'Legacy'; // 专长分类
    description: string; // 完整的专长描述文段
    prerequisite?: string; // 前提条件 (用于中文显示，方便人类阅读)
    
    /**
     * 结构化前置条件逻辑
     * 用于前端引导式车卡器进行自动判定 (如判断等级是否达标、属性是否大于等于某个值等)
     */
    prerequisiteLogic?: {
        level?: number;
        abilities?: { ability: string, min: number, logic: 'AND' | 'OR' }[]; // 如: [{ability: '力量', min: 13, logic: 'OR'}, {ability: '敏捷', min: 13, logic: 'OR'}]
        proficiency?: string[]; // 如 ["中甲"] 或 ["重甲"]
        spellcasting?: boolean;
        feature?: string; // 需要拥有特定特性，如 "战斗风格特性"
    };
    
    repeatable?: boolean;  // 是否可多次选择

    /**
     * 结构化机械属性，用于未来的自动化计算
     */
    mechanics?: {
        passiveEffects?: string[]; // 被动效果说明

        // 熟练项
        skillProficiencies?: {
            count: number;
            options: string[]; // ["Any"] 或具体列表
        } | {
            count: number;
            options: string[];
        }[];
        toolProficiencies?: {
            count: number;
            options: string[];
        } | {
            count: number;
            options: string[];
        }[];
        expertise?: {
            count: number;
            options: string[]; // ["Any"] 或具体列表
        } | {
            count: number;
            options: string[];
        }[];
        sharedProficiencyPool?: {
            count: number;
            types: ('skill' | 'tool')[];
            options: string[]; // ["Any"] 或具体列表
        };
        weaponProficiencies?: string[] | {
            count: number;
            options: string[];
        } | {
            count: number;
            options: string[];
        }[];
        armorProficiencies?: string[];
        languageProficiencies?: {
            count: number;
            options: string[];
        } | {
            count: number;
            options: string[];
        }[];

        // 先攻
        initiative?: {
            proficiency?: boolean; // 是否加上熟练加值
            advantage?: boolean;
            bonus?: number;
            special?: string;
        };

        // 生命值
        hpBonus?: {
            perLevel: number;
            retroactive: boolean; // 是否追溯之前的等级
        } | {
            fixed: number;
        };

        // 法术习得
        spells?: {
            count: number;
            listOptions: string[]; // ["牧师", "德鲁伊", "法师"] 等
            level: number;
            prepared?: boolean;
            freeCastsPerLongRest?: number;
            scalingAbility?: 'Intelligence' | 'Wisdom' | 'Charisma' | 'Choice';
            ritualOnly?: boolean;
        }[];

        // 资源管理
        resources?: {
            name: string;
            maxUses: string | number; // 如 "熟练加值" 或 3
            recovery: 'Short Rest' | 'Long Rest' | 'Turn Start' | 'Initiative';
        }[];

        // 属性值提升 (ASI)
        abilityScoreImprovement?: {
            points: number;
            options: string[]; // ["Strength", "Dexterity", etc.]
            allowSplit?: boolean; // 是否允许拆分点数 (如 2 点拆分为 1+1)
        }[];

        // 战斗/动作相关
        actions?: {
            name: string;
            type: 'Action' | 'Bonus Action' | 'Reaction' | 'Other';
            description: string;
        }[];

        // 武器精通相关
        weaponMastery?: {
            count: number;
            options?: string[]; // 如 ["Simple Weapons", "Martial Weapons"]
        };

        // 属性加成 (AC/攻击/伤害等)
        bonuses?: {
            ac?: number;
            attack?: { [weaponType: string]: number };
            damage?: { [weaponType: string]: number };
            initiative?: number;
        };

        // 移动与感知
        speedBonus?: number;
        senseUpgrade?: {
            blindsight?: number;
            truesight?: number;
            darkvision?: number;
        };

        // 各种具体数值或特定逻辑标记
        specialTraits?: string[];
    };
}
