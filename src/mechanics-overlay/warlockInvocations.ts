import { ClassFeature } from '@/types/class';
import { getCatalogOptionalFeatures } from '@/catalog/adapters/characterOptions';

const STATIC_WARLOCK_INVOCATIONS_2024: ClassFeature[] = [
    {
        name: '幽影护甲',
        nameEn: 'Armor of Shadows',
        level: 1,
        description: '你能对自身无需法术位地施展法师护甲Mage Armor 。',
        mechanics: {
            spells: [{
                origin: '幽影护甲',
                spells: ['Mage Armor'],
                prepared: true,
                isFree: true
            }]
        }
    },
    {
        name: '魔能意志',
        nameEn: 'Eldritch Mind',
        level: 1,
        description: '你为保持专注所进行的体质豁免具有优势。',
        mechanics: {
            passiveEffects: ['你为保持专注所进行的体质豁免具有优势。']
        }
    },
    {
        name: '刃之魔契',
        nameEn: 'Pact of the Blade',
        level: 1,
        description: '以一个附赠动作，你在手中咒唤出一把契约武器（一把已与你建立连结的简易或军用近战武器）或者与一把你所触摸的魔法武器建立连结。你不能与一把已经被其他生物同调或是和另一魔契师建立连结的魔法武器建立连结。直到连结结束，你拥有其熟练，且你可以将其用作施法的法器。\n当你用你连结的武器发动攻击时，你能使用魅力调整值进行攻击检定和伤害掷骰，取代使用力量或敏捷，且你可以令该武器造成暗蚀、心灵或光耀伤害，来取代原先的伤害类型。\n你与武器的连结会在你再次使用此特性的附赠动作时，武器在你5尺外1分钟或更久或是你死亡时结束。一个被咒唤出的武器会在连结结束时消失。',
        mechanics: {
            passiveEffects: ['你可以使用魅力调整值进行契约武器的攻击检定和伤害掷骰。']
            // 具体武器熟练和法器逻辑在前端渲染处理
        }
    },
    {
        name: '链之魔契',
        nameEn: 'Pact of the Chain',
        level: 1,
        description: '你习得法术寻获魔宠Find Familiar且能以一个魔法动作无需法术位地施展之。\n每当你施展该法术，并为你的魔宠选择形态时，除了通常的形态选项，你还可以改为选择下列特殊形态之一： 小魔鬼Imp、 伪龙Pseudodragon、 小恶魔Quasit、 骷髅Skeleton、 史拉蟾蝌蚪Slaad Tadpole、 求索斯芬克斯Sphinx of Wonder、 小仙灵Sprite或毒蛇Venomous Snake （魔宠的数据见附录B）。\n此外，当你执行攻击动作时可以放弃自己动作攻击中的一次攻击，转而让你的魔宠使用其反应发动一次攻击。',
        mechanics: {
            spells: [{
                origin: '链之魔契',
                spells: ['Find Familiar'],
                prepared: true,
                isFree: true
            }]
        }
    },
    {
        name: '书之魔契',
        nameEn: 'Pact of the Tome',
        level: 1,
        description: '在一次短休或长休结束时，你将幽影聚在手中，编织为一本书册。这本书（由你决定外观）中承载着只有你能理解的骇人魔法，令你获得以下增益。书册会在你以此特性咒唤另一本书或死亡时消失。\n戏法和仪式Cantrips and Rituals。当书册出现时，选择三道戏法和两道带有仪式标签的一环法术。这些法术可以来自任何职业的法术列表，且不能是你已经准备了的法术。当这本书册在你的角色身上时，你总是准备了这些法术，且对你而言这些法术是魔契师法术。\n施法法器Spallcasting Focus。你可以将此书册作为施法法器。',
        mechanics: {
            choices: [
                {
                    id: 'warlock_pact_tome_cantrips',
                    type: 'spell',
                    numToChoose: 3,
                    filter: 'level:0',
                    options: []
                },
                {
                    id: 'warlock_pact_tome_rituals',
                    type: 'spell',
                    numToChoose: 2,
                    filter: 'level:1;tags:ritual',
                    options: []
                }
            ]
        }
    },
    {
        name: '苦痛魔爆',
        nameEn: 'Agonizing Blast',
        level: 2,
        description: '先决：魔契师等级2+，知晓一道能造成伤害的魔契师戏法\n选择一道你已知的造成伤害的魔契师戏法。你可以将你的魅力调整值加到该法术的每次伤害掷骰中。\n复选Repeatable。你可以多次选择本祈唤。每次这么做时，你都必须选择不同的满足先决的戏法。',
        mechanics: {
            choices: [{
                id: 'warlock_agonizing_blast_target',
                type: 'custom',
                numToChoose: 1,
                options: ['Eldritch Blast', 'Toll the Dead', 'Chill Touch', 'Other Cantrips']
            }]
        }
    },
    {
        name: '魔鬼视界',
        nameEn: 'Devil\'s Sight',
        level: 2,
        description: '先决：魔契师等级2+\n你在黑暗和微光光照中拥有120尺的可视距离，而无论其属于魔法性的还是非魔法性的。',
        mechanics: {
            senseUpgrade: { darkvision: 120 }
        }
    },
    {
        name: '魔能长枪',
        nameEn: 'Eldritch Spear',
        level: 2,
        description: '先决：魔契师等级2+，知晓一道造成伤害的魔契师戏法\n选择一道你已知的造成伤害且射程至少为10尺的魔契师戏法。当你施展此法术时，其射程增加等于你魔契师等级30倍的尺数。\n复选Repeatable。你可以多次选择本祈唤。每次这么做时，你都必须选择不同的满足先决的戏法。',
        mechanics: {
            choices: [{
                id: 'warlock_eldritch_spear_target',
                type: 'custom',
                numToChoose: 1,
                options: ['Eldritch Blast', 'Other Cantrips']
            }]
        }
    },
    {
        name: '邪魔活力',
        nameEn: 'Fiendish Vigor',
        level: 2,
        description: '先决：魔契师等级2+\n你能无需法术位地施展虚假生命False Life 。当你以此特性施展该法术时，你不需要掷骰来决定临时生命值 ，你自动在此骰子上获得最大值。',
        mechanics: {
            spells: [{
                origin: '邪魔活力',
                spells: ['False Life'],
                prepared: true,
                isFree: true
            }]
        }
    },
    {
        name: '原初之一的教习',
        nameEn: 'Lessons of the First Ones',
        level: 2,
        description: '先决：魔契师等级2+\n你从多元宇宙中的一位亘古存在那里收获了知识，令你习得一项由你选择的起源专长（见第五章）。\n复选Repeatable。你可以多次选择本祈唤。每次这么做时，你都必须选择不同的起源专长。',
        mechanics: {
            choices: [{
                id: 'warlock_lessons_origin_feat',
                type: 'feat',
                numToChoose: 1,
                filter: 'category:Origin',
                options: []
            }]
        }
    },
    {
        name: '千面之颜',
        nameEn: 'Mask of Many Faces',
        level: 2,
        description: '先决：魔契师等级2+\n你能无需法术位地施展易容术Disguise Self。',
        mechanics: {
            spells: [{
                origin: '千面之颜',
                spells: ['Disguise Self'],
                prepared: true,
                isFree: true
            }]
        }
    },
    {
        name: '幻象迷踪',
        nameEn: 'Misty Visions',
        level: 2,
        description: '先决：魔契师等级2+\n你能无需法术位地施展无声幻影Silent Image。',
        mechanics: {
            spells: [{
                origin: '幻象迷踪',
                spells: ['Silent Image'],
                prepared: true,
                isFree: true
            }]
        }
    },
    {
        name: '超凡跳跃',
        nameEn: 'Otherworldly Leap',
        level: 2,
        description: '先决：魔契师等级2+\n你能对自身无需法术位地施展跳跃术Jump 。',
        mechanics: {
            spells: [{
                origin: '超凡跳跃',
                spells: ['Jump'],
                prepared: true,
                isFree: true
            }]
        }
    },
    {
        name: '斥力魔爆',
        nameEn: 'Repelling Blast',
        level: 2,
        description: '先决：魔契师等级2+，知晓一道通过攻击检定造成伤害的魔契师戏法\n选择一道你已知的需要一次攻击检定的魔契师戏法。当你用该戏法命中一名体型不超过大型的生物时，你可以将目标推开至多10尺。\n复选Repeatable。 你可以多次选择本祈唤。每次这么做时，你都必须选择不同的满足先决的戏法。',
        mechanics: {
            choices: [{
                id: 'warlock_repelling_blast_target',
                type: 'custom',
                numToChoose: 1,
                options: ['Eldritch Blast', 'Other Cantrips']
            }]
        }
    },
    {
        name: '星移步法',
        nameEn: 'Ascendant Step',
        level: 5,
        description: '先决：魔契师等级5+\n你能对自身无需法术位地施展浮空术Levitate。',
        mechanics: {
            spells: [{
                origin: '星移步法',
                spells: ['Levitate'],
                prepared: true,
                isFree: true
            }]
        }
    },
    {
        name: '魔能斩',
        nameEn: 'Eldritch Smite',
        level: 5,
        description: '先决：魔契师等级5+，具有刃之魔契祈唤\n每回合一次，当你用契约武器命中一个生物时，你可以消耗一枚契约魔法特性的法术位，以此对目标造成额外 1d8+每法术位环阶1d8 点的力场伤害，如果目标的体型在巨型或以下，则你还可以令目标陷入倒地状态。',
        mechanics: {
            passiveEffects: ['每回合一次，命中时可消耗法术位造成额外力场伤害并令目标倒地。']
        }
    },
    {
        name: '共视感官',
        nameEn: 'Gaze of Two Minds',
        level: 5,
        description: '先决：魔契师等级5+\n你能够以附赠动作触碰一个自愿的生物，并与其建立起感官的连接。连接状态持续到你下回合结束时终止。其间，只要你与该生物还处于同一位面中，你就可以用附赠动作继续维持连接，使其持续时间延长至你下回合结束时终止。如果你不再使用这种方式延续持续时间，这种连接便会结束。\n以所连接生物的感官进行观察时，你将拥有该生物所有的特殊感官的增益，且如果你们之间的距离不超过60尺，你就可以如同在该生物的位置上般施展法术。',
        mechanics: {
            passiveEffects: ['可以共享生物感官，并在其位置施法（60尺内）。']
        }
    },
    {
        name: '深海馈赠',
        nameEn: 'Gift of the Depths',
        level: 5,
        description: '先决：魔契师等级5+\n你可以在水下呼吸，且你具有等于你速度的游泳速度。\n此外，你还可以无需法术位地施展一次水下呼吸Water Breathing。完成一次长休时，你重获以此法施展该法术的能力。',
        mechanics: {
            passiveEffects: ['水下呼吸', '获得游泳速度'],
            spells: [{
                origin: '深海馈赠',
                spells: ['Water Breathing'],
                prepared: true,
                isFree: true
            }]
        }
    },
    {
        name: '链主赋能',
        nameEn: 'Investment of the Chain Master',
        level: 5,
        description: '先决：魔契师等级5+，具有链之魔契祈唤\n当你施展寻获魔宠Find Familiar 时，你将一定程度的魔能力量灌注给被召唤的魔宠，给予这个生物以下增益：\n翔空/潜渊Aerial or Aquatic。 该魔宠获得40尺的飞行速度或游泳速度（由你选择）。\n迅捷打击Quick Attack。 以一个附赠动作，你可以指挥你的魔宠执行攻击动作。\n光影注能Necrotic or Radiant Damage。该魔宠造成钝击、穿刺或挥砍伤害时，你可以改为令其造成光耀或暗蚀伤害。\n你的豁免DC Your Save DC。若该魔宠强迫一个生物进行豁免检定，则它改为使用你的法术豁免DC。\n抗性Resistance。若该魔宠受到伤害，则你可以使用反应给予它对于那次伤害的抗性。',
        mechanics: {
            passiveEffects: ['魔宠获得飞行/游泳速度', '可以附赠动作指挥魔宠攻击', '魔宠使用你的法术豁免DC']
        }
    },
    {
        name: '万形之主',
        nameEn: 'Master of Myriad Forms',
        level: 5,
        description: '先决：魔契师等级5+\n你能无需法术位地施展变身术Alter Self 。',
        mechanics: {
            spells: [{
                origin: '万形之主',
                spells: ['Alter Self'],
                prepared: true,
                isFree: true
            }]
        }
    },
    {
        name: '融身入影',
        nameEn: 'One with Shadows',
        level: 5,
        description: '先决：魔契师等级5+\n若身处微光或黑暗环境，你能对自身无需法术位地施展隐形术Invisibility。',
        mechanics: {
            spells: [{
                origin: '融身入影',
                spells: ['Invisibility'],
                prepared: true,
                isFree: true
            }]
        }
    },
    {
        name: '饥渴魔刃',
        nameEn: 'Thirsting Blade',
        level: 5,
        description: '先决：魔契师等级5+，具有刃之魔契祈唤\n你获得额外攻击特性（仅可使用你的契约武器）。此特性令你在自己的回合内执行攻击动作时可以用该武器攻击两次而非一次。',
        mechanics: {
            passiveEffects: ['契约武器可攻击两次（额外攻击）。']
        }
    },
    {
        name: '坟茔殁语',
        nameEn: 'Whispers of the Grave',
        level: 7,
        description: '先决：魔契师等级7+\n你能无需法术位地施展死者交谈Speak With Dead。',
        mechanics: {
            spells: [{
                origin: '坟茔殁语',
                spells: ['Speak With Dead'],
                prepared: true,
                isFree: true
            }]
        }
    },
    {
        name: '饮命者',
        nameEn: 'Lifedrinker',
        level: 9,
        description: '先决：魔契师等级9+，具有刃之魔契祈唤\n每回合一次，当你用契约武器命中一个生物时，你可以对其额外造成1d6的暗蚀、心灵或光耀伤害（由你选择），且你可以投掷并消耗一颗你的生命骰，恢复等于其骰值再加上你的体质调整值（最小为1）的生命值。',
        mechanics: {
            passiveEffects: ['命中时造成额外1d6伤害并可消耗生命骰回血。']
        }
    },
    {
        name: '守护馈赠',
        nameEn: 'Gift of the Protectors',
        level: 9,
        description: '先决：魔契师等级9+，具有书之魔契祈唤\n你召唤影之书时，一张新的书页会在其中出现。在你的允许之下，一个生物可以使用一个动作来将他的名字写在这一页上，这一页能包括的名字数量等于你的魅力调整值（至少为1）。当一个名字在这一页上的生物生命值降为0，但是还没有立刻死亡，这个生物的生命值魔法地变为1。每当这个魔法效应被触发，直至你完成长休，没有任何生物可以再次触发该效应。\n你能够以一个魔法动作，以触摸的形式消除一个在书页上的名字。',
        mechanics: {
            passiveEffects: ['影之书保护名单上的生物免于降至0HP（1次/长休）。']
        }
    },
    {
        name: '穹宇尽视',
        nameEn: 'Visions of Distant Realms',
        level: 9,
        description: '先决：魔契师等级9+\n你能无需法术位地施展秘法眼Arcane Eye。',
        mechanics: {
            spells: [{
                origin: '穹宇尽视',
                spells: ['Arcane Eye'],
                prepared: true,
                isFree: true
            }]
        }
    },
    {
        name: '灭世魔刃',
        nameEn: 'Devouring Blade',
        level: 12,
        description: '先决：魔契师等级12+，具有饥渴魔刃祈唤\n饥渴魔刃祈唤为你提供的额外攻击次数变为两次而非一次。',
        mechanics: {
            passiveEffects: ['契约武器可攻击三次。']
        }
    },
    {
        name: '巫术视界',
        nameEn: 'Witch Sight',
        level: 15,
        description: '先决：魔契师等级15+\n你具有30尺真实视觉 。',
        mechanics: {
            senseUpgrade: { truesight: 30 }
        }
    }
];

/**
 * 动态融合 5etools 魔能祈唤条目与 Mechanics Overlay 机制覆盖
 * 遵循《准则》：数据动态自省提取，Overlay 仅注入计算与法术机制，离线时安全兜底。
 */
export function getWarlockInvocations(source?: string): ClassFeature[] {
  const dynamicInvocations = getCatalogOptionalFeatures('EI', source);
  if (!dynamicInvocations || dynamicInvocations.length === 0) {
    return STATIC_WARLOCK_INVOCATIONS_2024;
  }

  const overlayMap = new Map<string, ClassFeature>();
  for (const feat of STATIC_WARLOCK_INVOCATIONS_2024) {
    if (feat.nameEn) overlayMap.set(feat.nameEn.toLowerCase().replace(/[-_\s']/g, ''), feat);
    overlayMap.set(feat.name.toLowerCase().replace(/[-_\s']/g, ''), feat);
  }

  return dynamicInvocations.map((item) => {
    const key = (item.nameEn || item.name).toLowerCase().replace(/[-_\s']/g, '');
    const overlay = overlayMap.get(key) || overlayMap.get(item.name.toLowerCase().replace(/[-_\s']/g, ''));

    let level = 1;
    const prereq = Array.isArray(item.prerequisites) ? item.prerequisites : [];
    for (const p of prereq as any[]) {
      if (typeof p?.level === 'number') level = p.level;
      else if (typeof p?.level?.level === 'number') level = p.level.level;
    }

    return {
      name: item.name,
      nameEn: item.nameEn,
      level: overlay?.level ?? level,
      description: item.description,
      mechanics: overlay?.mechanics,
    };
  });
}

/**
 * 2024 默认魔契师祈唤集合（动态代理）
 * 动态代理自 5etools Catalog，未加载或离线时自动透明回退至静态权威列表。
 */
export const WarlockInvocations2024: ClassFeature[] = new Proxy(STATIC_WARLOCK_INVOCATIONS_2024, {
  get(target, prop, receiver) {
    const dynamic = getWarlockInvocations();
    const value = Reflect.get(dynamic, prop, dynamic);
    if (typeof value === 'function') {
      return value.bind(dynamic);
    }
    return value;
  }
});



