
import { ItemItem } from '../types';

export type WeaponCategory = 'Simple' | 'Martial';
export type WeaponRangeType = 'Melee' | 'Ranged';

/**
 * 武器精通类型及其具体描述
 */
export interface WeaponMastery {
    name: string;
    nameEn: 'Slow' | 'Nick' | 'Vex' | 'Push' | 'Sap' | 'Cleave' | 'Graze' | 'Topple';
    description: string;
}

export interface Weapon extends ItemItem {
    /**
     * 武器分类 (简易/军用)
     */
    weaponCategory: WeaponCategory;

    /**
     * 武器射程分类 (近战/远程)
     */
    weaponRange: WeaponRangeType;

    /**
     * 伤害掷骰 (如 "1d8")
     */
    damage: string;

    /**
     * 伤害类型 (如 "挥砍")
     */
    damageType: string;

    /**
     * 武器词条 (属性)
     */
    properties: string[];

    /**
     * 武器精通 (Weapon Mastery)
     * 遵循 D&D 2024 规则
     */
    mastery: WeaponMastery;
}

import { getCatalogMasteryData, getCatalogPropertyData } from '@/catalog/adapters/equipmentRules';

export { getCatalogMasteryData, getCatalogPropertyData };

/**
 * 武器精通描述常量（静态兜底）
 */
export const STATIC_MASTERY_DATA: Record<WeaponMastery['nameEn'], WeaponMastery> = {
    Slow: {
        name: "缓速",
        nameEn: "Slow",
        description: "当你用这把武器命中了一个生物并造成伤害时，你可以将对方的速度减少 10 尺，持续至你的下一回合开始。如果该生物被拥有缓速词条的武器多次命中，其速度削减量也不会因此超过 10 尺。"
    },
    Nick: {
        name: "迅击",
        nameEn: "Nick",
        description: "当你发动由轻型词条所提供的额外的攻击时，你可以将这次攻击作为攻击动作的一部分，而非附赠动作。你每回合只能使用一次该能力。"
    },
    Vex: {
        name: "侵扰",
        nameEn: "Vex",
        description: "攻击命中后，你对该目标进行的下一次攻击检定具有优势。"
    },
    Push: {
        name: "推离",
        nameEn: "Push",
        description: "当你用这把武器命中了一个生物时，如果该生物的体型不超过大型，则你可以将这个生物从你身边直线推离至多 10 尺。"
    },
    Sap: {
        name: "削弱",
        nameEn: "Sap",
        description: "攻击命中后，目标在它的下个回合开始前的下一次攻击检定具有劣势。"
    },
    Cleave: {
        name: "横扫",
        nameEn: "Cleave",
        description: "当你用这把武器进行近战攻击命中了一个生物时，你可以对位于该生物 5 尺内且同样位于你触及内的另一个生物发动一次攻击。你为针对第二个生物的攻击进行伤害掷骰，但除非该伤害掷骰为负数，否则不加入你的属性调整值。"
    },
    Graze: {
        name: "擦掠",
        nameEn: "Graze",
        description: "当你以这把武器对一个生物发动的攻击检定失手时，你仍可以对目标生物造成一定伤害。其数额等同于此次攻击所使用的属性调整值。该伤害类型与武器造成的伤害类型一致。"
    },
    Topple: {
        name: "失衡",
        nameEn: "Topple",
        description: "当你用这把武器命中了一个生物时，你可以迫使该生物进行一次体质豁免（DC 8 + 你的属性调整值 + 你的熟练加值）。豁免失败则该生物陷入倒地状态。"
    }
};

/**
 * 武器词条描述常量（静态兜底）
 */
export const STATIC_PROPERTY_DATA: Record<string, { name: string; description: string }> = {
    "A": {
        name: "弹药 Ammunition",
        description: "使用具有弹药词条的武器发动远程攻击时，你必须拥有该武器需求的弹药。所需弹药的种类会与武器的射程写在一起。每次使用该武器攻击都会花费一枚弹药，且取出该弹药的行为视为此次攻击的一部分（你需要一只空手来为一把单手武器的弹药上膛或上弦）。在战斗结束后，你可以花费一分钟搜索战场，以回收你在战斗中所消耗的弹药的一半（向下取整），而剩下的那些弹药将会损失。"
    },
    "F": {
        name: "灵巧 Finesse",
        description: "使用一把灵巧武器发动攻击时，你可以自由选择此次攻击检定与伤害掷骰使用力量调整值还是敏捷调整值。但是攻击检定与伤害掷骰必须使用同一个调整值。"
    },
    "H": {
        name: "重型 Heavy",
        description: "如果你的力量属性值低于13点，则你用重型近战武器发动的攻击检定具有劣势；如果你的敏捷属性值低于13点，则你用重型远程武器发动的攻击检定具有劣势。"
    },
    "L": {
        name: "轻型 Light",
        description: "当你在自己回合中执行攻击动作，并用一把轻型武器发动一次攻击后，你可以在同一回合中用附赠动作发动一次额外的攻击。这次额外的攻击你必须使用另一把轻型武器发动，并且这次攻击的伤害无法加入你的属性调整值（除非该调整值为负数）。"
    },
    "LD": {
        name: "装填 Loading",
        description: "当你用这把装填武器通过一个动作、附赠动作或反应进行射击时，不论你正常情况下能发动多少次攻击，你都只能用其射出一发弹药。"
    },
    "R": {
        name: "射程 Range",
        description: "射程武器在其弹药词条或投掷词条后，会以括号标明其射程。射程会列出两个数字，第一个是武器的常规射程（单位为尺），第二个是武器的最大射程。攻击一个超出常规射程的目标时，你的攻击检定具有劣势；而你无法攻击一个处于最大射程之外的目标。"
    },
    "RE": {
        name: "触及 Reach",
        description: "使用触及武器攻击时，它为你的触及范围增加5尺。此触及范围增值同样会影响用它发动的借机攻击。"
    },
    "T": {
        name: "投掷 Thrown",
        description: "如果一把武器具有投掷词条，你可以把它投掷出去来发动一次远程攻击。同时，拔出这把武器可以视作这次攻击的一部分。如果投掷出去的武器是一把近战武器，则你在攻击检定和伤害掷骰中使用与你用其发动近战攻击时相同的属性调整值。"
    },
    "2H": {
        name: "双手 Two-Handed",
        description: "用双手武器攻击时，你需要双手并用。"
    },
    "V": {
        name: "多用 Versatile",
        description: "多用武器可以单手使用也可以双手使用。该词条后将跟随一个括号，其内的伤害数值即为双手持用该武器进行近战攻击时的伤害。"
    }
};

/**
 * 武器精通描述字典（动态代理）
 * 动态代理自 5etools Catalog，未加载或离线时自动透明回退至静态权威列表。
 */
export const MASTERY_DATA: Record<WeaponMastery['nameEn'], WeaponMastery> = new Proxy(STATIC_MASTERY_DATA, {
  get(target, prop, receiver) {
    const dynamic = getCatalogMasteryData(STATIC_MASTERY_DATA);
    return Reflect.get(dynamic, prop, dynamic);
  }
});

/**
 * 武器词条描述字典（动态代理）
 * 动态代理自 5etools Catalog，未加载或离线时自动透明回退至静态权威列表。
 */
export const PROPERTY_DATA: Record<string, { name: string; description: string }> = new Proxy(STATIC_PROPERTY_DATA, {
  get(target, prop, receiver) {
    const dynamic = getCatalogPropertyData(STATIC_PROPERTY_DATA);
    return Reflect.get(dynamic, prop, dynamic);
  }
});


