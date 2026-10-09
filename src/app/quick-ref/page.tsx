'use client';

import React, { useState } from 'react';
import GlassNav from '@/components/GlassNav';
import { ALL_CONDITIONS } from '@/rules/conditions';
import { BookOpen, Search, ShieldAlert, Zap, Flame, HeartPulse, Activity } from 'lucide-react';
import styles from './page.module.css';

type TabKey = 'conditions' | 'actions' | 'exhaustion' | 'damage';

interface CombatAction {
  id: string;
  name: string;
  nameEn: string;
  type: string;
  description: string;
}

const COMBAT_ACTIONS: CombatAction[] = [
  {
    id: 'magic-action',
    name: '魔法动作 (Magic Action)',
    nameEn: 'Magic Action',
    type: '2024 核心动作',
    description: '施展一个施法时间为 1 动作的法术，或者激活需要魔力动作的奇物/魔法物品能力。',
  },
  {
    id: 'attack',
    name: '攻击动作 (Attack)',
    nameEn: 'Attack Action',
    type: '基础动作',
    description: '进行一次近战或远程武器攻击。具备“多重攻击”特质的职业可在一次攻击动作中多次攻击。可触发 2024 武器精通效果（如推翻、击退、减速）。',
  },
  {
    id: 'bonus-action',
    name: '附赠动作 (Bonus Action)',
    nameEn: 'Bonus Action',
    type: '特定动作',
    description: '由特定的法术、职业特性（如游荡者的灵巧动作、狂暴、副手攻击）触发。每回合最多使用一次附赠动作。',
  },
  {
    id: 'reaction',
    name: '反应 (Reaction)',
    nameEn: 'Reaction',
    type: '回合外回应',
    description: '由特定诱因触发的瞬间回应（如敌人离开攻击范围引发借机攻击，或施展《护盾术》）。每轮只能使用一次反应。',
  },
  {
    id: 'dash',
    name: '疾走 (Dash)',
    nameEn: 'Dash',
    type: '移动动作',
    description: '使你获得额外的移动距离，数值等于你当前本回合的最高移动速度。',
  },
  {
    id: 'disengage',
    name: '撤退/避险 (Disengage)',
    nameEn: 'Disengage',
    type: '战术动作',
    description: '本回合内你接下来的移动不会引发借机攻击。',
  },
  {
    id: 'hide',
    name: '藏匿 (Hide)',
    nameEn: 'Hide',
    type: '隐匿动作',
    description: '尝试进行一次 DC 15 的敏捷(隐匿)检定。成功时你获得隐形状态，直到你进行攻击、施法、大声说话或被察觉。',
  },
  {
    id: 'search',
    name: '查探 (Search)',
    nameEn: 'Search',
    type: '感知/智力检定',
    description: '进行一次智力(调查)或感知(察觉)检定，用于寻找隐藏的陷阱、门线或隐形生物。',
  },
  {
    id: 'help',
    name: '帮助 (Help)',
    nameEn: 'Help',
    type: '战术辅助',
    description: '辅助 5 尺内的一名盟友，使其下一次 d20 检定或下一次对某目标的攻击检定获得优势。',
  },
];

const DAMAGE_TYPES = [
  { name: '强酸 (Acid)', desc: '腐蚀性液体、龙息或酸性物质' },
  { name: '钝击 (Bludgeoning)', desc: '锤击、坠落、挤压或钝重伤害' },
  { name: '寒冷 (Cold)', desc: '极寒冰霜、冷气龙息或死寒风暴' },
  { name: '火焰 (Fire)', desc: '烈焰、熔岩、火球术或灼热龙息' },
  { name: '力场 (Force)', desc: '纯粹魔法能量（如魔爆术、魔法飞弹）' },
  { name: '闪电 (Lightning)', desc: '雷电突袭、闪电束或电击术' },
  { name: '死灵 (Necrotic)', desc: '枯萎腐朽、灵魂抽干或死灵能流' },
  { name: '穿刺 (Piercing)', desc: '箭矢、匕首、尖刺或刺击伤害' },
  { name: '毒素 (Poison)', desc: '毒气、毒液或毒药侵蚀' },
  { name: '心灵 (Psychic)', desc: '精神冲击、心灵震慑或脑部撕裂' },
  { name: '光辉 (Radiant)', desc: '神圣光芒、日光或天堂惩戒能量' },
  { name: '挥砍 (Slashing)', desc: '长剑、巨斧、利刃或爪击切削' },
  { name: '雷鸣 (Thunder)', desc: '剧烈音爆、冲击波或声波轰击' },
];

export default function QuickRefPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('conditions');
  const [searchQuery, setSearchQuery] = useState('');
  const [exhaustionLevel, setExhaustionLevel] = useState(1);

  const filterList = <T extends { name: string; description?: string }>(list: T[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(
      (item) => item.name.toLowerCase().includes(q) || (item.description && item.description.toLowerCase().includes(q))
    );
  };

  const filteredConditions = filterList(ALL_CONDITIONS);
  const filteredActions = filterList(COMBAT_ACTIONS);
  const filteredDamage = filterList(DAMAGE_TYPES);

  return (
    <div className={styles.container}>
      <GlassNav title="规则速查" backLabel="角色库" backHref="/" />

      <main className={styles.main}>
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>
              <BookOpen size={28} />
              规则速查
            </h1>
            <p className={styles.subtitle}>
              快速检索异常状态、战斗动作、2024 力竭计算器与伤害类型说明。
            </p>
          </div>

          <div className={styles.searchBox}>
            <Search size={16} color="var(--color-gold-bright, #e6c278)" />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="搜索状态、动作、规则关键词..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* 分类选项卡 */}
        <div className={styles.tabs}>
          <button
            className={`${styles.tabBtn} ${activeTab === 'conditions' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('conditions')}
          >
            <ShieldAlert size={14} style={{ display: 'inline', marginRight: 6 }} />
            异常状态 (Conditions)
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'actions' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('actions')}
          >
            <Zap size={14} style={{ display: 'inline', marginRight: 6 }} />
            战斗动作 (Actions)
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'exhaustion' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('exhaustion')}
          >
            <HeartPulse size={14} style={{ display: 'inline', marginRight: 6 }} />
            力竭计算器 (2024 Exhaustion)
          </button>
          <button
            className={`${styles.tabBtn} ${activeTab === 'damage' ? styles.tabBtnActive : ''}`}
            onClick={() => setActiveTab('damage')}
          >
            <Flame size={14} style={{ display: 'inline', marginRight: 6 }} />
            伤害类型 (Damage Types)
          </button>
        </div>

        {/* 1. 异常状态选项卡 */}
        {activeTab === 'conditions' && (
          <div className={styles.grid}>
            {filteredConditions.map((cond) => (
              <div key={cond.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitle}>{cond.name}</div>
                  <span className={styles.cardTag}>异常状态</span>
                </div>
                <div className={styles.cardContent}>{cond.description}</div>
              </div>
            ))}
          </div>
        )}

        {/* 2. 战斗动作选项卡 */}
        {activeTab === 'actions' && (
          <div className={styles.grid}>
            {filteredActions.map((act) => (
              <div key={act.id} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitle}>{act.name}</div>
                  <span className={styles.cardTag}>{act.type}</span>
                </div>
                <div className={styles.cardContent}>{act.description}</div>
              </div>
            ))}
          </div>
        )}

        {/* 3. 2024 版力竭计算器选项卡 */}
        {activeTab === 'exhaustion' && (
          <div>
            <div className={styles.exhaustionCalculator}>
              <div className={styles.calcTitle}>
                <Activity size={20} />
                D&D 2024 简易力竭系统计算器 (Exhaustion Calculator)
              </div>
              <p style={{ fontSize: '0.88rem', color: 'rgba(255,255,255,0.7)', margin: 0 }}>
                2024 修订规则中，力竭状态为可叠加的 1-6 级。每次获得力竭，力竭等级 +1。
              </p>

              <div className={styles.calcControls}>
                <button
                  className={styles.calcBtn}
                  onClick={() => setExhaustionLevel((prev) => Math.max(0, prev - 1))}
                >
                  -
                </button>
                <div className={styles.levelDisplay}>第 {exhaustionLevel} 级</div>
                <button
                  className={styles.calcBtn}
                  onClick={() => setExhaustionLevel((prev) => Math.min(6, prev + 1))}
                >
                  +
                </button>
              </div>

              <div className={styles.calcResults}>
                <div className={styles.resultItem}>
                  🎯 <strong>所有 D20 检定减益：</strong>{' '}
                  <span className={styles.resultHighlight}>-{exhaustionLevel * 2}</span>
                </div>
                <div className={styles.resultItem}>
                  🏃 <strong>移动速度扣减：</strong>{' '}
                  <span className={styles.resultHighlight}>-{exhaustionLevel * 5} 尺</span>
                </div>
                <div className={styles.resultItem}>
                  💀 <strong>生存判定：</strong>{' '}
                  {exhaustionLevel >= 6 ? (
                    <span className={styles.resultHighlight} style={{ fontSize: '1.05rem' }}>
                      已达到 6 级力竭：角色死亡 (Dead)
                    </span>
                  ) : (
                    <span>完成一次长休可降低 1 级力竭状态</span>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.grid}>
              {filteredConditions
                .filter((c) => c.id === 'exhaustion')
                .map((cond) => (
                  <div key={cond.id} className={styles.card} style={{ gridColumn: '1 / -1' }}>
                    <div className={styles.cardHeader}>
                      <div className={styles.cardTitle}>{cond.name}（官方原文规则）</div>
                    </div>
                    <div className={styles.cardContent}>{cond.description}</div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 4. 伤害类型选项卡 */}
        {activeTab === 'damage' && (
          <div className={styles.grid}>
            {filteredDamage.map((dmg, idx) => (
              <div key={idx} className={styles.card}>
                <div className={styles.cardHeader}>
                  <div className={styles.cardTitle}>{dmg.name}</div>
                  <span className={styles.cardTag}>伤害类型</span>
                </div>
                <div className={styles.cardContent}>{dmg.desc}</div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

