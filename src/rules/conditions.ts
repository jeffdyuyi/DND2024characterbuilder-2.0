import { Condition } from '../types/condition';
import { getCatalogConditions } from '@/catalog/adapters/conditions';

export { getCatalogConditions };

/**
 * D&D 异常状态静态兜底数据
 */
export const STATIC_CONDITIONS: Condition[] = [
    {
        id: 'blinded',
        name: '目盲',
        description: '目盲状态期间，你将遭受以下这些效应。\n看不见Can\'t See。你无法视物，且会自动失败于任何需要视觉的属性检定。\n攻击影响Attacks Affected。以你为目标的攻击检定具有优势，而你进行的攻击检定具有劣势。',
        mechanics: {
            disadvantageOnAttacks: true,
            advantageToBeHit: true,
            special: '自动失败需要视觉的属性检定'
        }
    },
    {
        id: 'charmed',
        name: '魅惑',
        description: '魅惑状态期间，你将遭受以下这些效应。\n无法伤害魅惑源Can\'t Harm the Charmer。你无法攻击魅惑源，也无法将其作为伤害性能力或魔法效应的对象。\n社交优势Social Advantage。魅惑源对你进行的任何有关社交的属性检定均具有优势。',
        mechanics: {
            special: '无法伤害魅惑源，魅惑源对其社交检定具有优势'
        }
    },
    {
        id: 'deafened',
        name: '耳聋',
        description: '耳聋状态期间，你将遭受以下这个效应。\n听不见Can\'t Hear。你无法听声，且会自动失败于任何依赖听觉的属性检定。',
        mechanics: {
            special: '自动失败依赖听觉的属性检定'
        }
    },
    {
        id: 'exhaustion',
        name: '力竭',
        description: '力竭状态期间，你将遭受以下这些效应。\n力竭等级Exhaustion Levels。此状态可叠加。每次你获得此状态，力竭等级都增加1级。当你力竭等级累加到6级你将死亡。\nD20检定影响D20 Tests Affected。当你进行一次D20检定时，此次检定将减去你力竭等级2倍的值。\n速度降低Speed Reduced。你的速度减少等于你力竭等级5倍尺。\n移除力竭等级Removing Exhaustion Levels。你可以依靠完成长休来降低1级力竭等级。当你力竭等级降至0时，此状态结束。',
        mechanics: {
            special: 'D20检定减去等级*2，速度减去等级*5，6级死亡'
        }
    },
    {
        id: 'frightened',
        name: '恐慌',
        description: '恐慌状态期间，你将遭受以下这些效应。\n属性检定与攻击影响Ability Checks and Attacks Affected。只要恐惧源在你的视线范围内，你进行的属性检定与攻击检定就具有劣势。\n无法靠近Can\'t Approach。你无法自愿地向靠近恐惧源的方向移动。',
        mechanics: {
            disadvantageOnAttacks: true,
            special: '看见恐惧源时属性检定与攻击检定劣势，无法向其靠近'
        }
    },
    {
        id: 'grappled',
        name: '受擒',
        description: '受擒状态期间，你将遭受以下这些效应。\n速度归零Speed 0。你的速度变为0，且无法被增加。\n攻击影响Attacks Affected。除擒抱者外，你对其他任何目标进行的攻击检定都具有劣势。\n带动Movable。擒抱者移动时，其可以拖拽或承载你，但其每移动1尺都需要为此额外消耗1尺移动力。若你的体型为微型或你的体型小于擒抱者两级及以上，擒抱者拖拽/承载你将不需要额外消耗移动力。',
        mechanics: {
            speedZero: true,
            disadvantageOnAttacks: true,
            special: '对除擒抱者外的目标攻击劣势'
        }
    },
    {
        id: 'incapacitated',
        name: '失能',
        description: '失能状态期间，你将遭受以下这些效应。\n无法行动Inactive。你无法执行任何动作、附赠动作以及反应。\n无法专注No Concentration。你的专注将被打断。\n无法说话Speechless。你无法说话。\n措手不及Surprised。如果你在陷入失能状态期间投掷先攻，你的先攻检定将具有劣势。',
        mechanics: {
            incapacitated: true,
            special: '无法执行动作/附赠动作/反应，打断专注，无法说话，先攻劣势'
        }
    },
    {
        id: 'invisible',
        name: '隐形',
        description: '隐形状态期间，你将获得以下这些效应。\n出其不意Surprise。如果你在投掷先攻时处于隐形状态，你的先攻检定将具有优势。\n隐蔽Concealed。任何需要能够看见目标的效应都不会影响到你，除非效应的源头能通过某种方式看到你。你所着装或携带的一切装备也同样会被隐蔽起来。\n攻击影响Attacks Affected。以你为目标的攻击检定具有劣势，而你进行的攻击检定具有优势。如果一个生物能以某种方式看见你，那么你在面对该生物时不会获得这一增益。',
        mechanics: {
            disadvantageOnAttacks: false, // 自身优势
            advantageToBeHit: false,      // 被打劣势
            special: '先攻优势，攻击优势，被打劣势，除非被看见'
        }
    },
    {
        id: 'paralyzed',
        name: '麻痹',
        description: '麻痹状态期间，你将遭受以下这些效应。\n失能Incapacitated。你陷入失能状态。\n速度归零Speed 0。你的速度变为0，且无法被增加。\n豁免影响Saving Throws Affected。你自动失败于力量豁免检定与敏捷豁免检定。\n攻击影响Attacks Affected。以你为目标的攻击检定具有优势。\n自动重击Automatic Critical Hits。若攻击者位于你5尺内，其任何命中你的攻击检定都会变为重击。',
        mechanics: {
            incapacitated: true,
            speedZero: true,
            advantageToBeHit: true,
            failSavingThrows: ['力量', '敏捷'],
            special: '5尺内被命中自动重击'
        }
    },
    {
        id: 'petrified',
        name: '石化',
        description: '石化状态期间，你将遭受以下这些效应。\n化为非活动材质Turned to Inanimate Substance。你与你穿着或携带的所有非魔法物品将被变化为坚固的、非活动的材质（通常是石头）。你的重量变为原本的十倍，且你将停止老化。\n失能Incapacitated。你陷入失能状态。\n速度归零Speed 0。你的速度变为0，且无法被增加。\n攻击影响Attacks Affected。以你为目标的攻击检定具有优势。\n豁免影响Saving Affected。你自动失败于力量豁免检定与敏捷豁免检定。\n伤害全抗Resist Damage。你具有所有伤害的抗性。\n中毒免疫Poison Immunity。你具有中毒状态的免疫。',
        mechanics: {
            incapacitated: true,
            speedZero: true,
            advantageToBeHit: true,
            failSavingThrows: ['力量', '敏捷'],
            immuneTo: ['poisoned'],
            special: '重量10倍，老化停止，所有伤害抗性'
        }
    },
    {
        id: 'poisoned',
        name: '中毒',
        description: '中毒状态期间，你将遭受以下这个效应。\n属性检定与攻击影响Ability Checks and Attacks Affected。你进行的攻击检定与属性检定具有劣势。',
        mechanics: {
            disadvantageOnAttacks: true,
            special: '攻击和属性检定劣势'
        }
    },
    {
        id: 'prone',
        name: '倒地',
        description: '倒地状态期间，你将遭受以下这些效应。\n阻碍移动Restricted Movement。你唯二的移动选项是匍匐移动或是消耗你速度一半数值（向下取整）的移动力起立，并由此终止这一状态。如果你的速度为0，你无法起立。\n攻击影响Attacks Affected。你进行的攻击检定具有劣势。若攻击者位于你5尺内，其以你为目标的攻击检定具有优势；若攻击者不位于你5尺内，其以你为目标的攻击检定具有劣势。',
        mechanics: {
            disadvantageOnAttacks: true,
            special: '5尺内被攻击优势，5尺外被攻击劣势，起立消耗一半速度'
        }
    },
    {
        id: 'restrained',
        name: '束缚',
        description: '束缚状态期间，你将遭受以下这些效应。\n速度归零Speed 0。你的速度变为0，且无法被增加。\n攻击影响Attacks Affected。以你为目标的攻击检定具有优势，而你进行的攻击检定具有劣势。\n豁免影响Saving Affected。你进行的敏捷豁免检定具有劣势。',
        mechanics: {
            speedZero: true,
            disadvantageOnAttacks: true,
            advantageToBeHit: true,
            special: '敏捷豁免劣势'
        }
    },
    {
        id: 'stunned',
        name: '震慑',
        description: '震慑状态期间，你将遭受以下这些效应。\n失能Incapacitated。 你陷入失能状态。\n豁免影响Saving Throws Affected。你自动失败于力量豁免检定与敏捷豁免检定。\n攻击影响Attacks Affected。以你为目标的攻击检定具有优势。',
        mechanics: {
            incapacitated: true,
            advantageToBeHit: true,
            failSavingThrows: ['力量', '敏捷']
        }
    },
    {
        id: 'unconscious',
        name: '昏迷',
        description: '昏迷状态期间，你将遭受以下这些效应。\n迟钝Inert。你陷入失能状态与倒地状态，你手上持握的东西也会全数掉落。此状态结束时，倒地状态并不会因此结束。\n速度归零Speed 0。你的速度变为0，且无法被增加。\n攻击影响Attacks Affected。以你为目标的攻击检定具有优势。\n豁免影响Saving Throws Affected。你自动失败于力量豁免检定与敏捷豁免检定。\n自动重击Automatic Critical Hits。若攻击者位于你5尺内，其任何命中你的攻击检定都会变为重击。\n无知觉Unaware。你无法感知到你周遭的事物。',
        mechanics: {
            incapacitated: true,
            speedZero: true,
            advantageToBeHit: true,
            failSavingThrows: ['力量', '敏捷'],
            special: '掉落持握物，5尺内被命中自动重击，无知觉'
        }
    },
    {
        id: 'bloodied',
        name: '浴血',
        description: '在一名生物具有的生命值只有一半或不足一半期间，其处于浴血状态。',
        mechanics: {
            special: 'HP <= 50%'
        }
    }
];

/**
 * 全量游戏异常状态
 * 动态代理自 5etools Catalog，未加载或离线时自动透明回退至静态权威列表。
 */
export const ALL_CONDITIONS: Condition[] = new Proxy(STATIC_CONDITIONS, {
  get(target, prop, receiver) {
    const dynamic = getCatalogConditions(STATIC_CONDITIONS);
    const value = Reflect.get(dynamic, prop, dynamic);
    if (typeof value === 'function') {
      return value.bind(dynamic);
    }
    return value;
  },
});


