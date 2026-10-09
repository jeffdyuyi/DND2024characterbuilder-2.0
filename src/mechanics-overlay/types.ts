/**
 * Mechanics Overlay 类型定义
 * 对应《5etools全量数据接入与引擎保留实施路线图》Phase B
 */

export interface AcCalculationOverlay {
  base: number;
  modifiers: string[];
  canUseShield: boolean;
  condition?: string;
}

export interface FeatureMechanicsOverlay {
  acCalculation?: AcCalculationOverlay;
  acBonus?: number;
  acBonusCondition?: string;
  statBonus?: Record<string, number>;
  statMaxIncrease?: Record<string, number>;
  spellcastingType?: 'full' | 'half' | 'third' | 'warlock' | '1/2' | '1/3';
  spellcastingAbility?: 'Strength' | 'Dexterity' | 'Constitution' | 'Intelligence' | 'Wisdom' | 'Charisma' | string;
  [key: string]: any;
}

export interface TraitOverlay {
  name: string;
  nameEn?: string;
  level?: number;
  mechanics: FeatureMechanicsOverlay;
}

export interface ClassMechanicsOverlay {
  spellcastingType?: 'full' | 'half' | 'third' | 'warlock' | '1/2' | '1/3';
  spellcastingAbility?: string;
  features?: TraitOverlay[];
}

export interface SubclassMechanicsOverlay {
  className?: string;
  spellcastingType?: 'full' | 'half' | 'third' | 'warlock' | '1/2' | '1/3';
  spellcastingAbility?: string;
  traits?: TraitOverlay[];
}

export interface RaceMechanicsOverlay {
  traits?: TraitOverlay[];
  mechanics?: FeatureMechanicsOverlay;
}
