export interface AbilityScores {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
}

export interface Currency {
  cp: number;
  sp: number;
  ep: number;
  gp: number;
  pp: number;
}

export interface MulticlassEntry {
  classId: string;
  source: string;
  level: number;
  isMulticlass: boolean;
  subclassId?: string;
}

export interface ContentReferenceSnapshot {
  id: string;
  kind: string;
  name: string;
  englishName?: string;
  source: string;
  sourcePackId: string;
  revision?: string;
}

export interface InventoryContainer {
  id: string;
  name: string;
  itemId?: string; // Used to pull base stats from the library (e.g. Mule, Wagon)
  customCapacity?: number; // Override capacity in lbs
  type: 'mount' | 'vehicle' | 'container' | 'other';
}

export interface InventoryEntry {
  id: string;
  name: string;
  quantity?: number;
  source?: string;
  category?:
    | 'weapon'
    | 'armor'
    | 'shield'
    | 'gear'
    | 'package'
    | 'currency'
    | 'spell'
    | 'feature'
    | 'other'
    | 'tool'
    | 'vehicle';
  itemId?: string;
  equipped?: boolean;
  notes?: string;
  weight?: string;
  tags?: string[];
  versatileTwoHanded?: boolean;
  locationId?: string; // 'player' (default) or container.id
}

export interface DeathSaveTrack {
  success: number;
  failure: number;
}

export interface FeatChoices {
  featId: string;
  ability?: keyof AbilityScores; // 专长带来的属性提升选择 (如 +1 力量)
  asi?: Partial<AbilityScores>; // 复杂属性提升 (如 ASI 专长的 +2 或 +1+1)
  skills?: string[]; // 专长带来的技能熟练选择
  tools?: string[]; // 专长带来的工具熟练选择
  expertise?: string[]; // 专长带来的专精选择
  languages?: string[]; // 专长带来的语言选择
  spellList?: string; // 专长带来的法术列表选择 (如：牧师、德鲁伊、法师)
  spells?: string[]; // 专长带来的法术选择 (戏法或 1 环法术)
  weaponMasteries?: string[]; // 专长带来的武器精通选择
  other?: any; // 其他特定专长的自定义选择
}

export interface ClassSpellSelection {
  cantrips: string[];
  spells: string[];
  extra?: Record<string, string[]>; // 新增：choiceId -> [chosen spellIds]
  replaced?: string; // 兼容旧版：被替换的法术ID
  replacedCantrip?: string; // 2024规则：被替换的旧戏法ID
  replacedSpell?: string; // 2024规则：被替换的旧法术(1阶+)ID
}

export interface CustomMarker {
  id: string;
  name: string;
  color?: string;
  description?: string;
  sourceId?: string; // 关联的特性 ID (如 'spell-mastery')
}

export interface CharacterManualOverrides {
  ac?: number;
  maxHp?: number;
  speed?: number;
  initiative?: number;
  proficiencyBonus?: number;
  passivePerception?: number;
  spellSaveDc?: number;
  spellAttackBonus?: number;
  abilityScores?: Partial<AbilityScores>;
  notes?: Record<string, string>;
}

export interface CharacterState {
  id: string;
  // Meta
  name: string;
  playerName: string;
  avatarUrl?: string;
  allowHomebrew?: boolean; // 【第三方扩展 / Homebrew 开关】

  // Step 1: Species
  speciesId?: string;
  speciesSource?: string;
  subspeciesId?: string;
  size?: 'Medium' | 'Small';
  speciesSelections?: Record<string, string[]>; // traitId -> [chosen options]
  speciesAbilityBonuses?: Partial<AbilityScores>; // 种族属性值自选分配 (+2/+1, +1+1+1 等)
  useSpeciesASI?: boolean;

  // Step 2: Background
  backgroundId?: string;
  backgroundSource?: string;
  backgroundVariantId?: string;
  backgroundAbilityBonuses: Partial<AbilityScores>;
  backgroundSelections?: Record<string, string[]>; // traitId/choiceId -> [chosen options]
  originFeatId?: string;

  // Step 3: Class
  classes: MulticlassEntry[];
  classSelections?: Record<string, string[]>; // classId/featureId -> [chosen options]

  // Step 4: Abilities
  baseAbilityScores: AbilityScores;
  // Step 4.5: Feats
  selectedFeats: { classId: string; level: number; featId: string }[];
  /** 可选职业特性、角色创建选项、赠礼、祝福、恩惠等稳定 Catalog ID。 */
  selectedCharacterOptionIds?: string[];
  featSelections?: Record<string, FeatChoices>; // slotId -> 专长及内部精细化选择

  // Step 5: Skills
  selectedSkills: string[];
  expertiseSkills: string[];

  // Step 6: Equipment
  equipmentChoiceMode?: 'choiceA' | 'choiceB' | 'choiceC' | 'package' | 'gold';
  equipmentIds: string[];
  inventoryEntries: InventoryEntry[];
  equippedArmorId?: string;
  equippedShieldId?: string;
  equippedWeaponIds: string[];
  attunedItemIds: string[]; // 新增：已同调的魔法物品 ID 列表
  currency: Currency;
  higherLevelGoldRolled?: boolean; // 新增：是否已掷高等级起始金币
  higherLevelGoldAmount?: number; // 新增：掷出的额外金币金额 (GP)
  higherLevelGoldApplied?: boolean; // 新增：是否已领取到钱包
  selectedClassPackage?: string; // 选择的具体职业套组方案
  startingEquipmentSynced?: boolean; // 是否已自动同步/初始化起始装备

  // Inventory & Encumbrance System
  encumbranceMode?: 'full' | 'standard' | 'simple';
  containers?: InventoryContainer[];

  // Step 6.5: Combat snapshot / manual trackers
  currentHp?: number;
  tempHp?: number;
  hitDiceUsed?: number;
  hitDiceUsedMap?: Record<string, number>; // 新增：分面数的生命骰消耗记录 (如: 'd8': 2, 'd10': 1)
  deathSaves?: DeathSaveTrack;
  inspiration?: boolean;
  concentration?: boolean;
  exhaustion?: number;
  isMulticlassingEnabled?: boolean;
  conditions?: string[]; // 异常状态 (如：失能、中毒)
  activeConditions?: string[]; // 激活的特性状态 (如：'荒野变形期间', '狂暴激活期间')
  defaultOptionsApplied?: string[]; // 记录哪些 id 的选择已经应用了推荐项

  // Step 7: Spells
  preparedSpellIds: string[];
  cantripIds: string[];
  knownSpellIds: string[];
  spellbookIds: string[];
  spellsByLevel?: Record<string, Record<number, ClassSpellSelection>>; // classId -> level -> choices
  spellSlotUsage: Record<number, number>;
  resourceUsage: Record<string, number>; // 新增：特性资源消耗追踪 (如: { 'rage': 2, 'ki': 3 })

  // Step 8: Languages
  selectedLanguages: string[];

  // Step 9: Alignment
  alignment?: string;

  // Step 10: Details
  faith?: string;
  gender?: string;
  pronouns?: string; // 新增：代词
  lifestyle?: string; // 新增：生活方式
  age?: string;
  height?: string;
  weight?: string;
  eyes?: string; // 眼瞳
  eyeColor?: string; // 兼容旧版本别名
  skin?: string; // 肤色
  skinColor?: string; // 兼容旧版本别名
  hair?: string; // 发色
  hairColor?: string; // 兼容旧版本别名
  appearance?: string;
  personalityTraits?: string;
  ideals?: string;
  bonds?: string;
  flaws?: string;
  backstory?: string;
  allies?: string; // 新增：盟友
  enemies?: string; // 新增：敌人
  organizations?: string;
  partyNotes?: string;
  npcNotes?: string;
  otherNotes?: string; // 新增：其他笔记
  customMarkers?: CustomMarker[];
  hpCalculationMode?: 'fixed' | 'rolled' | 'custom';
  rolledHpTotal?: number; // Keep for backward compatibility if needed, but we'll prefer hpLevelRolls
  hpLevelRolls?: Record<number, number | 'fixed'>;
  customMaxHp?: number;

  proficiencies?: {
    skills?: string[];
    saves?: string[];
    tools?: string[];
    languages?: string[];
  };

  // 新增：结构化记录
  adventureLogs?: { id: string; date: string; content: string }[];
  quests?: { id: string; title: string; completed: boolean }[];

  // 新增：手动覆盖与优化计划相关字段
  manualOverrides?: CharacterManualOverrides;
  schemaVersion?: number;
  /** Catalog 条目的最后已知显示信息；源暂时不可用时仍可保留引用和名称。 */
  contentSnapshots?: Record<string, ContentReferenceSnapshot>;
}
