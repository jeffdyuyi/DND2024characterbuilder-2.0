export interface ClassFeature {
  name: string;
  nameEn?: string;
  level: number;
  description: string;
  source?: string;
  mechanics?: {
    passiveEffects?: (string | { text: string; condition?: string })[];
    speedBonus?: number;
    senseUpgrade?: { darkvision?: number; blindsight?: number; truesight?: number };
    skillProficiencies?: string[];
    spells?: {
      origin?: string;
      level?: number;
      spells: string[];
      prepared?: boolean;
      isFree?: boolean;
      count?: number;
      condition?: string;
    }[];
    resources?: {
      resourceName: string;
      recovery:
        | 'Short Rest'
        | 'Long Rest'
        | 'Initiative'
        | 'None'
        | 'Short or Long Rest'
        | 'Dawn'
        | '1d4 Long Rests';
      maxUses?: number;
      maxUsesStr?: string;
      maxUsesAbility?: string;
      maxUsesCalculation?: string;
      minUses?: number;
    }[];
    dynamicSkillBonuses?: {
      skill: string;
      ability: string;
      minBonus?: number;
      source?: string;
      condition?: string;
    }[];
    dynamicSavingThrowBonuses?: {
      save: 'all' | string;
      ability: string;
      minBonus?: number;
      source?: string;
      condition?: string;
    }[];
    dynamicInitiativeBonus?: {
      ability: string;
      minBonus?: number;
      source?: string;
      condition?: string;
    };
    dynamicAttackBonuses?: {
      ability: string;
      minBonus?: number;
      source?: string;
      condition?: string;
    }[];
    dynamicSpellSaveDCBonus?: {
      bonus: number;
      source?: string;
      condition?: string;
    };
    dynamicSpellAttackBonus?: {
      bonus: number;
      source?: string;
      condition?: string;
    };
    skillAbilityReplacements?: {
      skills: string[];
      replacementAbility: string;
      condition?: string;
    }[];
    spellsOptions?: any;
    weaponMasteryOptions?: number;
    // 计算支持字段
    acCalculation?: {
      base: number;
      modifiers: string[]; // 参与计算的属性名，如 ['敏捷', '体质']
      canUseShield: boolean;
      condition?: string;
    };
    statBonus?: { [abilityName: string]: number }; // 直接属性加成，如 { '力量': 4 }
    statMaxIncrease?: { [abilityName: string]: number }; // 属性上限提升，如 { '力量': 25 }
    attunementLimit?: number; // 同调魔法装备数量上限（基础规则为 3）
    attunementLimitBonus?: number; // 在当前上限上增加的同调槽位
    initiativeBonus?: boolean | number | string; // 是否有优势或固定加值
    choices?: {
      id: string; // 唯一标识符，用于记录用户选择
      type:
        | 'skill'
        | 'expertise'
        | 'feat'
        | 'spell'
        | 'fightingStyle'
        | 'weaponMastery'
        | 'subclass'
        | 'custom'
        | 'language'
        | 'tool'
        | 'mastery'
        | 'savingThrow';
      numToChoose: number;
      options: (string | any)[];
      defaultOptions?: string[]; // 预设/推荐的选择
      name?: string;
      nameEn?: string;
      filter?: string;
    }[];
    [key: string]: any;
  };
  options?: {
    name: string;
    nameEn?: string;
    description: string;
    mechanics?: ClassFeature['mechanics'];
  }[];
}

export interface ClassLevelProgression {
  level: number;
  proficiencyBonus: number;
  featuresUnlocked: string[];
  classSpecificCounters?: {
    rages?: number | string;
    rageDamage?: number;
    weaponMastery?: number;
    [key: string]: any;
  };
  values?: { label: string; value: string }[];
  spellcasting?: {
    cantripsKnown: number;
    spellsPrepared: number;
    spellSlots: {
      level1?: number;
      level2?: number;
      level3?: number;
      level4?: number;
      level5?: number;
      level6?: number;
      level7?: number;
      level8?: number;
      level9?: number;
    };
  };
}

export interface SubClass {
  catalogId?: string;
  source?: string;
  name: string;
  nameEn?: string;
  description: string;
  traits: ClassFeature[];
}

export interface EquipmentRecord {
  kind: 'item' | 'currency' | 'unresolved';
  label: string;
  itemId?: string;
  quantity?: number;
  category?: 'weapon' | 'armor' | 'shield' | 'gear' | 'tool';
  currency?: {
    gp?: number;
    sp?: number;
    cp?: number;
  };
  selectionId?: string;
  optionName?: string;
}

export interface ClassData {
  catalogId?: string;
  source: string;
  name: string;
  nameEn: string;
  description: string;
  becomingAClass?: {
    asLevel1: string;
    asMulticlass: string;
  };
  primaryAbility: string[];
  hitPointDie: number;
  proficiencies: {
    savingThrows: string[];
    skills: {
      numToChoose: number;
      options: string[];
      type?: string;
      filter?: string;
    };
    weapons: string[];
    armor: string[];
    tools?:
      | string[]
      | {
          numToChoose: number;
          options: string[];
          type?: string;
          filter?: string;
        };
  };
  startingEquipment: {
    choiceA: (string | { options: string[] })[];
    choiceB: string;
    choiceC?: string;
    choiceARecords?: EquipmentRecord[];
    choiceBRecord?: EquipmentRecord | EquipmentRecord[];
    choiceCRecord?: EquipmentRecord | EquipmentRecord[];
  };
  features: ClassFeature[];
  progression: ClassLevelProgression[];
  subClassInfo?: {
    unlockLevel: number;
    options: SubClass[];
  };
  spellcastingAbility?: string;
  casterProgression?: 'full' | 'half' | 'third' | 'pact' | string;
  preparedSpellsFormula?: string;
  spellList?: string[];
  multiclassProficiencies?: {
    skills?: {
      numToChoose: number;
      options: string[];
      type?: string;
      filter?: string;
    };
    weapons?: string[];
    armor?: string[];
    tools?:
      | string[]
      | {
          numToChoose: number;
          options: string[];
          type?: string;
          filter?: string;
        };
  };
}
