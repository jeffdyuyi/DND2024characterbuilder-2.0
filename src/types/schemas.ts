/**
 * Zod Runtime Validation Schemas
 * Phase 9: 运行时防腐层
 * 
 * 这些 Schema 与 src/types/ 中的 TypeScript 接口一一对应。
 * 它们被用于在数据导出时进行 safeParse，
 * 确保残缺/畸形的数据文件不会打穿 UI 层。
 */

import { z } from 'zod';

// ==============================
// Species Schema
// ==============================

const SensesSchema = z.object({
    darkvision: z.number().optional(),
    tremorsense: z.number().optional(),
    blindsight: z.number().optional(),
    truesight: z.number().optional(),
}).passthrough();

/**
 * 通用选择器 Schema
 */
const SelectionSchema = (optionSchema: z.ZodTypeAny) => z.object({
    numToChoose: z.number(),
    options: z.array(optionSchema),
    name: z.string().optional(),
    nameEn: z.string().optional(),
    description: z.string().optional(),
    isLongRestChoice: z.boolean().optional(),
    filter: z.string().optional(),
}).passthrough();

/**
 * 熟练项 Schema (支持 字符串 或 选择器)
 */
const ProficiencySchema = z.union([
    z.string(),
    SelectionSchema(z.string())
]);

/**
 * 基础法术 Schema (支持 字符串ID 或 完整对象)
 */
const InnateSpellSchema = z.union([
    z.string(),
    z.object({
        level: z.number().optional(),
        spellId: z.string().optional(),
        spellName: z.string().optional(),
        spellNameEn: z.string().optional(),
        isPrepared: z.boolean().optional(),
        freeCastsPerLongRest: z.any().optional(), // 兼容 Infinity, 'Proficiency Bonus' 等
        useSpellSlots: z.boolean().optional(),
    }).passthrough()
]);

const TraitFeaturesSchema = z.object({
    speedBonus: z.number().optional(),
    climbSpeed: z.union([z.number(), z.literal('Walking Speed')]).optional(),
    swimSpeed: z.union([z.number(), z.literal('Walking Speed')]).optional(),
    flightSpeed: z.union([z.number(), z.literal('Walking Speed')]).optional(),
    hpBonusPerLevel: z.number().optional(),
    acBonus: z.number().optional(),
    senseUpgrade: SensesSchema.optional(),
    resistances: z.array(z.string()).optional(),
    resistanceChoices: z.array(SelectionSchema(z.string())).optional(),
    skillProficiencies: z.array(ProficiencySchema).optional(),
    toolProficiencies: z.array(ProficiencySchema).optional(),
    weaponProficiencies: z.array(ProficiencySchema).optional(),
    armorProficiencies: z.array(ProficiencySchema).optional(),
    languages: z.array(ProficiencySchema).optional(),
    originFeats: SelectionSchema(z.string()).optional(),
    spells: z.array(z.any()).optional(),
    passiveEffects: z.array(z.string()).optional(),
}).passthrough().optional();

const TraitSchema: z.ZodType<any> = z.object({
    id: z.string().optional(),
    name: z.string(),
    nameEn: z.string().optional(),
    description: z.string(),
    level: z.number().optional(),
    action: z.enum(['Action', 'Bonus Action', 'Reaction', 'None', 'Magic Action']).optional(),
    usage: z.object({
        limit: z.union([z.number(), z.literal('Proficiency Bonus')]),
        recovery: z.string(),
    }).optional(),
    features: z.any().optional(),
    scaling: z.object({
        diceCount: z.record(z.string(), z.number()),
        diceType: z.string(),
    }).optional(),
    options: z.array(z.lazy(() => TraitSchema)).optional(),
    numToChoose: z.number().optional(),
    representsSubSpecies: z.boolean().optional(),
}).passthrough();

const SubSpeciesSchema = z.object({
    id: z.string(),
    name: z.string(),
    nameEn: z.string(),
    description: z.string(),
    abilityScoreIncrease: z.record(z.string(), z.number()).optional(),
    traits: z.array(TraitSchema),
}).passthrough();

export const SpeciesSchema = z.object({
    id: z.string(),
    source: z.string(),
    name: z.string(),
    nameEn: z.string(),
    description: z.string(),
    creatureType: z.string(),
    size: z.union([
        z.array(z.enum(['Small', 'Medium', 'Large'])),
        z.enum(['Small', 'Medium', 'Large']) // 兼容单字符串格式
    ]),
    speed: z.number(),
    senses: z.any(), // 极度放宽感官校验
    abilityScoreIncrease: z.record(z.string(), z.number()).optional(),
    traits: z.array(TraitSchema),
    subSpecies: SelectionSchema(SubSpeciesSchema).optional(),
}).passthrough();

// ==============================
// Background Schema
// ==============================

const CharacteristicOptionSchema = z.object({
    id: z.string(),
    text: z.string(),
});

const BackgroundCharacteristicSchema = z.union([
    z.string(),
    CharacteristicOptionSchema
]);

const BackgroundCurrencySchema = z.object({
    cp: z.number().optional(),
    sp: z.number().optional(),
    ep: z.number().optional(),
    gp: z.number().optional(),
    pp: z.number().optional(),
});

const BackgroundEquipmentRecordSchema = z.object({
    kind: z.enum(['item', 'currency', 'unresolved']),
    label: z.string(),
    itemId: z.string().optional(),
    quantity: z.number().optional(),
    category: z.enum(['weapon', 'armor', 'shield', 'gear', 'tool']).optional(),
    currency: BackgroundCurrencySchema.optional(),
    selectionId: z.string().optional(),
});

export const BackgroundSchema = z.object({
    id: z.string(),
    source: z.string(),
    name: z.string(),
    nameEn: z.string(),
    description: z.string(),
    skillProficiencies: z.array(ProficiencySchema),
    toolProficiencies: z.array(ProficiencySchema).optional(),
    languages: z.array(ProficiencySchema).optional(),
    equipment: z.object({
        choiceA: z.array(ProficiencySchema),
        choiceB: z.string().optional(),
        choiceARecords: z.array(BackgroundEquipmentRecordSchema).optional(),
        choiceBRecord: BackgroundEquipmentRecordSchema.optional(),
    }),
    suggestedCharacteristics: z.object({
        personalityTraits: z.array(BackgroundCharacteristicSchema),
        ideals: z.array(BackgroundCharacteristicSchema),
        bonds: z.array(BackgroundCharacteristicSchema),
        flaws: z.array(BackgroundCharacteristicSchema),
    }).optional(),
}).passthrough();

// ==============================
// Feat Schema
// ==============================

export const FeatSchema = z.object({
    id: z.string(),
    source: z.string(),
    name: z.string(),
    nameEn: z.string(),
    category: z.enum(['Origin', 'General', 'Epic Boon', 'Fighting Style', 'Legacy']),
    description: z.string(),
}).passthrough();

// ==============================
// Spell Schema
// ==============================

export const SpellSchema = z.object({
    id: z.string(),
    name: z.string(),
    nameEn: z.string(),
    source: z.string(),
    level: z.number().min(0).max(9),
    school: z.string(),
    castingTime: z.string(),
    range: z.string(),
    components: z.string(),
    duration: z.string(),
    classes: z.array(z.string()),
    description: z.string(),
}).passthrough();

// ==============================
// Class Schema (宽松版 — 职业数据结构极为复杂，仅校验骨架)
// ==============================

export const ClassDataSchema = z.object({
    source: z.string(),
    name: z.string(),
    nameEn: z.string(),
    description: z.string(),
    hitPointDie: z.number(),
    primaryAbility: z.array(z.string()),
}).passthrough();

// ==============================
// Item / Armor Schema
// ==============================

export const ItemSchema = z.object({
    id: z.string(),
    name: z.string(),
    source: z.string(),
    type: z.string(),
}).passthrough();

export const ArmorSchema = ItemSchema.extend({
    armorCategory: z.enum(['Light', 'Medium', 'Heavy', 'Shield']),
    acStructured: z.object({
        base: z.number(),
        dexModEnabled: z.boolean(),
        dexModMax: z.number().optional(),
        bonus: z.number().optional(),
    }),
    stealthDisadvantage: z.boolean(),
}).passthrough();

// ==============================
// Safe Parse Utility (核心防腐函数)
// ==============================

/**
 * 接收一个 Zod Schema 和一个原始数据数组，
 * 返回仅包含通过校验的合法实体的新数组。
 * 所有不合格的实体会在 console.warn 中输出诊断信息而非抛出异常。
 * 
 * TOutput 泛型参数允许调用方将返回类型锁定为原始 TypeScript 接口，
 * 避免 Zod `.passthrough()` 产生的 `& {[k: string]: unknown}` 污染下游组件。
 */
export function safeParseArray<TOutput = any>(
    schema: z.ZodTypeAny,
    rawData: unknown[],
    entityLabel: string
): TOutput[] {
    const results: TOutput[] = [];
    for (const item of rawData) {
        const parsed = schema.safeParse(item);
        if (parsed.success) {
            results.push(parsed.data as TOutput);
        } else {
            const name = (item && typeof item === 'object' && 'name' in item) ? (item as any).name : '未知';
            console.error(
                `[数据防腐层] ${entityLabel} "${name}" 校验未通过:`,
                {
                    issues: parsed.error.issues,
                    itemSnippet: JSON.stringify(item).slice(0, 500) + '...'
                }
            );
        }
    }
    return results;
}
