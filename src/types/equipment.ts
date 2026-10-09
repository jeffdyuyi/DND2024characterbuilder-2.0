import { ItemItem } from './index';

export interface Armor extends ItemItem {
  armorCategory: 'Light' | 'Medium' | 'Heavy' | 'Shield';
  ac?: string;
  acStructured: { base: number; dexModEnabled: boolean; dexModMax?: number; bonus?: number };
  stealthDisadvantage: boolean;
  strengthRequirement?: number;
}

export type WeaponCategory = 'Simple' | 'Martial';
export type WeaponRangeType = 'Melee' | 'Ranged';
export interface WeaponMastery {
  name: string;
  nameEn: 'Slow' | 'Nick' | 'Vex' | 'Push' | 'Sap' | 'Cleave' | 'Graze' | 'Topple';
  description: string;
}
export interface Weapon extends ItemItem {
  weaponCategory: WeaponCategory;
  weaponRange: WeaponRangeType;
  damage: string;
  damageType: string;
  properties: string[];
  mastery: WeaponMastery;
}

export interface VehicleStats {
  speed?: string;
  crew?: string;
  passengers?: string;
  cargo?: string;
  ac?: number;
  hp?: number;
  damageThreshold?: number;
}
export interface Gear extends ItemItem {
  quantity?: number;
  capacity?: string;
  contents?: string[];
  vehicleStats?: VehicleStats;
  carryingCapacity?: string;
  page?: number;
  rarity?: string;
  reprintedAs?: string[];
  contentsDetailed?: { id?: string; name: string; quantity?: number; source?: string }[];
}

export interface ToolUtilize {
  action: string;
  dc: string;
  description: string;
}
export interface Tool extends ItemItem {
  toolAbility?: string;
  toolUtilize?: ToolUtilize[];
  toolCraft?: string[];
  components?: string;
  synergies?: { skill: string; description: string }[];
  specialUses?: { name: string; description: string }[];
  toolVariants?: string[];
}

export type AnyItem = Armor | Gear | Tool | Weapon | ItemItem;
