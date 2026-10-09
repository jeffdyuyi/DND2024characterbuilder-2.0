'use client';

import React, { useState, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import GlassNav from '@/components/GlassNav';
import { useHomebrewStore, Monster } from '@/store/homebrewStore';
import {
  Sparkles,
  Eye,
  Bold,
  Italic,
  List,
  Heading,
  Dices,
  Save,
  ArrowLeft,
  FileCode,
  Shield,
  Zap,
} from 'lucide-react';
import styles from './page.module.css';

type TabKey = 'spells' | 'monsters' | 'items' | 'classes' | 'species' | 'backgrounds' | 'feats';

const CATEGORY_TABS: { key: TabKey; label: string }[] = [
  { key: 'spells', label: '法术 (Spells)' },
  { key: 'monsters', label: '怪物 (Monsters)' },
  { key: 'items', label: '装备与物品 (Items)' },
  { key: 'feats', label: '专长 (Feats)' },
  { key: 'species', label: '种族 (Species)' },
  { key: 'backgrounds', label: '背景 (Backgrounds)' },
  { key: 'classes', label: '职业与子职 (Classes)' },
];

function HomebrewCreateContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialType = (searchParams.get('type') as TabKey) || 'spells';

  const [activeTab, setActiveTab] = useState<TabKey>(initialType);
  const homebrewState = useHomebrewStore();

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 表单完整字段 State
  const [formData, setFormData] = useState({
    id: '',
    name: '',
    nameEn: '',
    // 法术
    level: 1,
    school: '塑能系',
    castingTime: '1 动作',
    range: '60 尺',
    components: 'V, S',
    materials: '',
    duration: '立即',
    classes: ['法师'],
    // 怪物
    cr: '1',
    monsterSize: '中型',
    type: '类人生物',
    alignment: '中立',
    ac: 12,
    hp: 20,
    speed: '30 尺',
    str: 10,
    dex: 10,
    con: 10,
    int: 10,
    wis: 10,
    cha: 10,
    monsterSkills: '',
    monsterResistances: '',
    monsterSenses: '被动察觉 10',
    monsterLanguages: '通用语',
    // 装备与物品
    itemType: '奇物',
    rarity: '非普通',
    attunement: '无需同调',
    cost: '100 gp',
    weight: '1 磅',
    // 专长
    category: 'General',
    prerequisite: '无',
    // 种族
    creatureType: '类人生物',
    size: 'Medium',
    senses: '黑暗视觉 60 尺',
    // 背景
    abilityScores: '敏捷, 体质, 感知',
    featRecommendation: '警戒',
    skills: '运动, 生存',
    // 职业
    hitDie: 'd8',
    primaryAbility: '智力',
    // 大段描述文本
    description: '',
  });

  useEffect(() => {
    const typeParam = searchParams.get('type') as TabKey;
    if (typeParam && CATEGORY_TABS.some((t) => t.key === typeParam)) {
      setActiveTab(typeParam);
    }
  }, [searchParams]);

  // 智能 Slug 自动生成与查重
  const generateSmartSlug = (nameStr: string, nameEnStr: string, explicitId: string): string => {
    if (explicitId && explicitId.trim()) {
      return explicitId.trim().toLowerCase().replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
    }

    let baseSlug = '';
    if (nameEnStr && nameEnStr.trim()) {
      baseSlug = nameEnStr.trim().toLowerCase().replace(/[^a-z0-9\s_-]/g, '').replace(/\s+/g, '-');
    } else {
      baseSlug = nameStr.trim().toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, '').replace(/[\s\u4e00-\u9fa5]+/g, 'hb-item');
    }

    if (!baseSlug || baseSlug === 'hb-item') {
      baseSlug = `homebrew-${Date.now().toString(36)}`;
    }

    const currentCategoryList = ((homebrewState as any)[activeTab] as any[]) || [];
    let finalId = baseSlug;
    let counter = 1;
    while (currentCategoryList.some((item) => item.id === finalId)) {
      finalId = `${baseSlug}-${counter}`;
      counter++;
    }

    return finalId;
  };

  // Markdown 编辑器文本插值助手
  const insertMarkdown = (prefix: string, suffix: string = '', defaultText: string = '') => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = formData.description.substring(start, end) || defaultText;
    const replacement = `${prefix}${selected}${suffix}`;

    const newText =
      formData.description.substring(0, start) + replacement + formData.description.substring(end);

    setFormData({ ...formData, description: newText });

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selected.length);
    }, 0);
  };

  // 计算属性调整值格式化 (+2, -1)
  const calcModStr = (score: number) => {
    const mod = Math.floor((score - 10) / 2);
    return mod >= 0 ? `+${mod}` : `${mod}`;
  };

  const getCrDetails = (crStr: string) => {
    const crMap: Record<string, { xp: string; pb: string }> = {
      '0': { xp: '0 或 10', pb: '+2' },
      '1/8': { xp: '25', pb: '+2' },
      '1/4': { xp: '50', pb: '+2' },
      '1/2': { xp: '100', pb: '+2' },
      '1': { xp: '200', pb: '+2' },
      '2': { xp: '450', pb: '+2' },
      '3': { xp: '700', pb: '+2' },
      '4': { xp: '1,100', pb: '+2' },
      '5': { xp: '1,800', pb: '+3' },
      '6': { xp: '2,300', pb: '+3' },
      '7': { xp: '2,900', pb: '+3' },
      '8': { xp: '3,900', pb: '+3' },
      '9': { xp: '5,000', pb: '+4' },
      '10': { xp: '5,900', pb: '+4' },
      '11': { xp: '7,200', pb: '+4' },
      '12': { xp: '8,400', pb: '+4' },
      '13': { xp: '10,000', pb: '+5' },
      '14': { xp: '11,500', pb: '+5' },
      '15': { xp: '13,000', pb: '+5' },
      '16': { xp: '15,000', pb: '+5' },
      '17': { xp: '18,000', pb: '+6' },
      '18': { xp: '20,000', pb: '+6' },
      '19': { xp: '22,000', pb: '+6' },
      '20': { xp: '25,000', pb: '+6' },
      '25': { xp: '75,000', pb: '+8' },
      '30': { xp: '155,000', pb: '+9' },
    };
    return crMap[crStr] || { xp: '自定义 XP', pb: '+2' };
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('请填写条目的中文名称！');
      return;
    }

    const generatedId = generateSmartSlug(formData.name, formData.nameEn, formData.id);

    if (activeTab === 'spells') {
      const compStr = formData.materials
        ? `${formData.components} (${formData.materials})`
        : formData.components;
      homebrewState.addEntry('spells', {
        id: generatedId,
        name: formData.name,
        nameEn: formData.nameEn || formData.name,
        source: 'HOMEBREW',
        level: Number(formData.level) || 0,
        school: formData.school,
        castingTime: formData.castingTime,
        range: formData.range,
        components: compStr,
        duration: formData.duration,
        classes: formData.classes,
        description: formData.description,
      });
    } else if (activeTab === 'monsters') {
      homebrewState.addEntry('monsters', {
        id: generatedId,
        name: formData.name,
        nameEn: formData.nameEn || formData.name,
        source: 'HOMEBREW',
        cr: formData.cr,
        type: formData.type || '类人生物',
        alignment: formData.alignment || '中立',
        ac: Number(formData.ac) || 10,
        hp: Number(formData.hp) || 10,
        speed: formData.speed,
        stats: {
          str: Number(formData.str) || 10,
          dex: Number(formData.dex) || 10,
          con: Number(formData.con) || 10,
          int: Number(formData.int) || 10,
          wis: Number(formData.wis) || 10,
          cha: Number(formData.cha) || 10,
        },
        description: formData.description,
      } as Monster);
    } else if (activeTab === 'items') {
      const fullType = `${formData.rarity} ${formData.itemType} (${formData.attunement})`;
      homebrewState.addEntry('items', {
        id: generatedId,
        name: formData.name,
        nameEn: formData.nameEn || formData.name,
        source: 'HOMEBREW',
        type: fullType,
        description: `重量：${formData.weight} | 价值：${formData.cost}\n\n${formData.description}`,
      });
    } else if (activeTab === 'feats') {
      homebrewState.addEntry('feats', {
        id: generatedId,
        name: formData.name,
        nameEn: formData.nameEn || formData.name,
        source: 'HOMEBREW',
        category: formData.category as any,
        prerequisite: formData.prerequisite,
        description: formData.description,
      });
    } else if (activeTab === 'species') {
      homebrewState.addEntry('species', {
        id: generatedId,
        name: formData.name,
        nameEn: formData.nameEn || formData.name,
        source: 'HOMEBREW',
        description: formData.description,
        creatureType: formData.creatureType,
        size: [formData.size],
        speed: parseInt(formData.speed) || 30,
        traits: [{ name: '核心特质', description: formData.description }],
      } as any);
    } else if (activeTab === 'backgrounds') {
      homebrewState.addEntry('backgrounds', {
        id: generatedId,
        name: formData.name,
        nameEn: formData.nameEn || formData.name,
        source: 'HOMEBREW',
        abilityScoreOptions: formData.abilityScores.split(',').map((s) => s.trim()),
        feat: { name: formData.featRecommendation, nameEn: '' },
        skillProficiencies: formData.skills.split(',').map((s) => s.trim()),
        equipment: { choiceA: ['默认装备包'] },
        description: formData.description,
      } as any);
    } else if (activeTab === 'classes') {
      homebrewState.addEntry('classes' as any, {
        id: generatedId,
        name: formData.name,
        nameEn: formData.nameEn || formData.name,
        source: 'HOMEBREW',
        hitDie: formData.hitDie,
        primaryAbility: formData.primaryAbility,
        description: formData.description,
      } as any);
    }

    alert(`成功创建原创第三方条目「${formData.name}」！`);
    router.push('/homebrew');
  };

  const toggleClassSelect = (cls: string) => {
    if (formData.classes.includes(cls)) {
      setFormData({ ...formData, classes: formData.classes.filter((c) => c !== cls) });
    } else {
      setFormData({ ...formData, classes: [...formData.classes, cls] });
    }
  };

  return (
    <div className={styles.container}>
      <GlassNav title="新建第三方内容" backLabel="第三方库" backHref="/homebrew" />

      <main className={styles.main}>
        {/* 顶部分类选择栏 */}
        <div className={styles.topBar}>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>
              <Sparkles size={22} />
              新建第三方内容
            </h1>
          </div>

          <div className={styles.categorySelector}>
            {CATEGORY_TABS.map((tab) => (
              <button
                key={tab.key}
                className={`${styles.catBtn} ${activeTab === tab.key ? styles.catBtnActive : ''}`}
                onClick={() => setActiveTab(tab.key)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* 左右双栏分屏工作区 */}
        <div className={styles.workspace}>
          {/* 左侧：全面表单填写区 */}
          <form className={styles.editorPanel} onSubmit={handleSave}>
            <div className={styles.sectionTitle}>
              <Zap size={18} />
              基础识别信息
            </div>

            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.label}>中文名称 *</label>
                <input
                  type="text"
                  className={styles.input}
                  required
                  placeholder="如：冰霜新星"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>英文原名 (Name En)</label>
                <input
                  type="text"
                  className={styles.input}
                  placeholder="如：Frost Nova"
                  value={formData.nameEn}
                  onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                />
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>唯一 Identifier ID (留空自动推导)</label>
              <input
                type="text"
                className={styles.input}
                placeholder={
                  formData.name || formData.nameEn
                    ? `自动推导：${generateSmartSlug(formData.name, formData.nameEn, '')}`
                    : '如：frost-nova-custom'
                }
                value={formData.id}
                onChange={(e) => setFormData({ ...formData, id: e.target.value })}
              />
            </div>

            {/* 1. 法术专属字段 */}
            {activeTab === 'spells' && (
              <>
                <div className={styles.sectionTitle}>✨ 法术属性配置</div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>法术环阶</label>
                    <select
                      className={styles.select}
                      value={formData.level}
                      onChange={(e) => setFormData({ ...formData, level: Number(e.target.value) })}
                    >
                      <option value={0}>戏法 (0 环)</option>
                      <option value={1}>1 环</option>
                      <option value={2}>2 环</option>
                      <option value={3}>3 环</option>
                      <option value={4}>4 环</option>
                      <option value={5}>5 环</option>
                      <option value={6}>6 环</option>
                      <option value={7}>7 环</option>
                      <option value={8}>8 环</option>
                      <option value={9}>9 环</option>
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label className={styles.label}>魔法学派</label>
                    <select
                      className={styles.select}
                      value={formData.school}
                      onChange={(e) => setFormData({ ...formData, school: e.target.value })}
                    >
                      <option value="塑能系">塑能系 (Evocation)</option>
                      <option value="防护系">防护系 (Abjuration)</option>
                      <option value="咒法系">咒法系 (Conjuration)</option>
                      <option value="预言系">预言系 (Divination)</option>
                      <option value="惑控系">惑控系 (Enchantment)</option>
                      <option value="幻术系">幻术系 (Illusion)</option>
                      <option value="死灵系">死灵系 (Necromancy)</option>
                      <option value="变化系">变化系 (Transmutation)</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>施法时间</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="如：1 动作 / 1 附赠动作"
                      value={formData.castingTime}
                      onChange={(e) => setFormData({ ...formData, castingTime: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>施法距离</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="如：60 尺 / 触碰 / 自身"
                      value={formData.range}
                      onChange={(e) => setFormData({ ...formData, range: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>施法成分</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="如：V, S"
                      value={formData.components}
                      onChange={(e) => setFormData({ ...formData, components: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>材料具体说明</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="如：一块价值 50 gp 的冰晶"
                      value={formData.materials}
                      onChange={(e) => setFormData({ ...formData, materials: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>适用职业 (多选)</label>
                  <div className={styles.checkboxGroup}>
                    {['吟游诗人', '牧师', '德鲁伊', '圣武士', '游侠', '术士', '邪术师', '法师', '奇械师'].map(
                      (cls) => (
                        <label key={cls} className={styles.checkboxLabel}>
                          <input
                            type="checkbox"
                            checked={formData.classes.includes(cls)}
                            onChange={() => toggleClassSelect(cls)}
                          />
                          {cls}
                        </label>
                      )
                    )}
                  </div>
                </div>
              </>
            )}

            {/* 2. 怪物专属字段 */}
            {activeTab === 'monsters' && (
              <>
                <div className={styles.sectionTitle}>🐉 怪物面版配置</div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>挑战等级 (CR)</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="如：1 / 1/2 / 5"
                      value={formData.cr}
                      onChange={(e) => setFormData({ ...formData, cr: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>生物类型</label>
                    <select
                      className={styles.select}
                      value={formData.type}
                      onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    >
                      <option value="类人生物">类人生物 (Humanoid)</option>
                      <option value="野兽">野兽 (Beast)</option>
                      <option value="巨龙">巨龙 (Dragon)</option>
                      <option value="邪魔">邪魔 (Fiend)</option>
                      <option value="死灵">死灵 (Undead)</option>
                      <option value="异怪">异怪 (Aberration)</option>
                      <option value="元素">元素 (Elemental)</option>
                      <option value="构装体">构装体 (Construct)</option>
                      <option value="妖精">妖精 (Fey)</option>
                      <option value="巨人">巨人 (Giant)</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>护甲等级 (AC)</label>
                    <input
                      type="number"
                      className={styles.input}
                      value={formData.ac}
                      onChange={(e) => setFormData({ ...formData, ac: Number(e.target.value) })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>生命值 (HP)</label>
                    <input
                      type="number"
                      className={styles.input}
                      value={formData.hp}
                      onChange={(e) => setFormData({ ...formData, hp: Number(e.target.value) })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>移动速度</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="如：30 尺，飞行 60 尺"
                      value={formData.speed}
                      onChange={(e) => setFormData({ ...formData, speed: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>属性六维 (Ability Scores)</label>
                  <div className={styles.statsGrid}>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>力量</span>
                      <input
                        type="number"
                        className={styles.statInput}
                        value={formData.str}
                        onChange={(e) => setFormData({ ...formData, str: Number(e.target.value) })}
                      />
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>敏捷</span>
                      <input
                        type="number"
                        className={styles.statInput}
                        value={formData.dex}
                        onChange={(e) => setFormData({ ...formData, dex: Number(e.target.value) })}
                      />
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>体质</span>
                      <input
                        type="number"
                        className={styles.statInput}
                        value={formData.con}
                        onChange={(e) => setFormData({ ...formData, con: Number(e.target.value) })}
                      />
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>智力</span>
                      <input
                        type="number"
                        className={styles.statInput}
                        value={formData.int}
                        onChange={(e) => setFormData({ ...formData, int: Number(e.target.value) })}
                      />
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>感知</span>
                      <input
                        type="number"
                        className={styles.statInput}
                        value={formData.wis}
                        onChange={(e) => setFormData({ ...formData, wis: Number(e.target.value) })}
                      />
                    </div>
                    <div className={styles.statItem}>
                      <span className={styles.statLabel}>魅力</span>
                      <input
                        type="number"
                        className={styles.statInput}
                        value={formData.cha}
                        onChange={(e) => setFormData({ ...formData, cha: Number(e.target.value) })}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>技能熟练</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="如：奥秘 +13, 历史 +13, 察觉 +10"
                      value={formData.monsterSkills}
                      onChange={(e) => setFormData({ ...formData, monsterSkills: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>伤害抗性与免疫</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="如：寒冷, 闪电; 非魔法攻击免疫"
                      value={formData.monsterResistances}
                      onChange={(e) => setFormData({ ...formData, monsterResistances: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>感官</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="如：真实视觉 120 尺，被动察觉 20"
                      value={formData.monsterSenses}
                      onChange={(e) => setFormData({ ...formData, monsterSenses: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>语言</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="如：通用语, 深渊语, 所有"
                      value={formData.monsterLanguages}
                      onChange={(e) => setFormData({ ...formData, monsterLanguages: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            {/* 3. 装备与物品专属字段 */}
            {activeTab === 'items' && (
              <>
                <div className={styles.sectionTitle}>🛡️ 装备物品属性</div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>物品分类</label>
                    <select
                      className={styles.select}
                      value={formData.itemType}
                      onChange={(e) => setFormData({ ...formData, itemType: e.target.value })}
                    >
                      <option value="奇物">奇物 (Wondrous Item)</option>
                      <option value="近战武器">近战武器 (Melee Weapon)</option>
                      <option value="远程武器">远程武器 (Ranged Weapon)</option>
                      <option value="防具/盾牌">防具 / 盾牌 (Armor / Shield)</option>
                      <option value="药水">药水 (Potion)</option>
                      <option value="卷轴">卷轴 (Scroll)</option>
                      <option value="魔杖/法杖">魔杖 / 法杖 (Wand / Staff)</option>
                      <option value="戒指">戒指 (Ring)</option>
                      <option value="冒险装备">冒险装备 (Adventuring Gear)</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>稀有度</label>
                    <select
                      className={styles.select}
                      value={formData.rarity}
                      onChange={(e) => setFormData({ ...formData, rarity: e.target.value })}
                    >
                      <option value="普通">普通 (Common)</option>
                      <option value="非普通">非普通 (Uncommon)</option>
                      <option value="珍稀">珍稀 (Rare)</option>
                      <option value="极珍稀">极珍稀 (Very Rare)</option>
                      <option value="传说">传说 (Legendary)</option>
                      <option value="神器">神器 (Artifact)</option>
                    </select>
                  </div>
                </div>

                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>同调要求</label>
                    <select
                      className={styles.select}
                      value={formData.attunement}
                      onChange={(e) => setFormData({ ...formData, attunement: e.target.value })}
                    >
                      <option value="无需同调">无需同调</option>
                      <option value="需要同调">需要同调</option>
                      <option value="需由施法者同调">需由施法者同调</option>
                    </select>
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>价格 / 价值</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="如：500 gp"
                      value={formData.cost}
                      onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>重量</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="如：2 磅"
                      value={formData.weight}
                      onChange={(e) => setFormData({ ...formData, weight: e.target.value })}
                    />
                  </div>
                </div>
              </>
            )}

            {/* 4. 专长专属字段 */}
            {activeTab === 'feats' && (
              <div className={styles.formRow}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>专长分类 (2024)</label>
                  <select
                    className={styles.select}
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  >
                    <option value="Origin">起源专长 (Origin Feat)</option>
                    <option value="General">通用专长 (General Feat)</option>
                    <option value="Fighting Style">战斗风格 (Fighting Style Feat)</option>
                    <option value="Epic Boon">史诗恩惠 (Epic Boon Feat)</option>
                  </select>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>先决条件</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="如：等级 4+ / 力量 13+"
                    value={formData.prerequisite}
                    onChange={(e) => setFormData({ ...formData, prerequisite: e.target.value })}
                  />
                </div>
              </div>
            )}

            {/* 大段描述文本区域（包含 Markdown 工具栏） */}
            <div className={styles.formGroup}>
              <div className={styles.sectionTitle}>
                <FileCode size={18} />
                详细规则描述与效应文本 (Markdown 支持)
              </div>

              <div className={styles.markdownWrapper}>
                <div className={styles.markdownToolbar}>
                  <button
                    type="button"
                    className={styles.mdBtn}
                    onClick={() => insertMarkdown('**', '**', '加粗文本')}
                    title="加粗"
                  >
                    <Bold size={13} />
                    加粗
                  </button>
                  <button
                    type="button"
                    className={styles.mdBtn}
                    onClick={() => insertMarkdown('*', '*', '斜体文本')}
                    title="斜体"
                  >
                    <Italic size={13} />
                    斜体
                  </button>
                  <button
                    type="button"
                    className={styles.mdBtn}
                    onClick={() => insertMarkdown('### ', '', '小标题')}
                    title="标题"
                  >
                    <Heading size={13} />
                    标题
                  </button>
                  <button
                    type="button"
                    className={styles.mdBtn}
                    onClick={() => insertMarkdown('- ', '', '列表项')}
                    title="无序列表"
                  >
                    <List size={13} />
                    列表
                  </button>
                  <button
                    type="button"
                    className={styles.mdBtn}
                    onClick={() => insertMarkdown('{@dice ', '}', '2d6+3')}
                    title="掷骰表达式"
                  >
                    <Dices size={13} />
                    掷骰表达式
                  </button>
                  <button
                    type="button"
                    className={styles.mdBtn}
                    onClick={() => insertMarkdown('{@damage ', '}', '2d8 寒冷')}
                    title="伤害表达式"
                  >
                    <Shield size={13} />
                    伤害表达式
                  </button>
                </div>

                <textarea
                  ref={textareaRef}
                  className={styles.markdownTextarea}
                  placeholder="在此输入详细规则描述，支持自动换行与手动回车，支持 Markdown 语法与上方快捷按钮..."
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>

            <div className={styles.saveBar}>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnSecondary}`}
                onClick={() => router.push('/homebrew')}
              >
                <ArrowLeft size={16} />
                取消并返回
              </button>
              <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                <Save size={16} />
                保存并添加到本地库
              </button>
            </div>
          </form>

          {/* 右侧：实时卡片预览区 (Sticky Live Card Preview) */}
          <div className={styles.previewPanel}>
            <div className={styles.previewHeader}>
              <div className={styles.previewTitle}>
                <Eye size={18} />
                实时卡片预览
              </div>
            </div>

            {activeTab === 'monsters' ? (
              <div className={styles.monsterStatblock}>
                <div className={styles.monsterHeader}>
                  <div>
                    <div className={styles.monsterNameCN}>{formData.name || '未命名怪物'}</div>
                    {formData.nameEn && <div className={styles.monsterNameEN}>{formData.nameEn}</div>}
                  </div>
                  <span className={styles.badge}>第三方怪物</span>
                </div>

                <div className={styles.monsterTypeRow}>
                  {formData.monsterSize} {formData.type}，{formData.alignment}
                </div>

                <div className={styles.taperedRule} />

                {/* 4 列 Vitals 行 */}
                <div className={styles.monsterVitalsGrid}>
                  <div className={styles.vitalBox}>
                    <span className={styles.vitalLabel}>AC (护甲等级)</span>
                    <span className={styles.vitalVal}>{formData.ac}</span>
                  </div>
                  <div className={styles.vitalBox}>
                    <span className={styles.vitalLabel}>HP (生命值)</span>
                    <span className={styles.vitalVal}>{formData.hp}</span>
                  </div>
                  <div className={styles.vitalBox}>
                    <span className={styles.vitalLabel}>移动速度</span>
                    <span className={styles.vitalVal}>{formData.speed}</span>
                  </div>
                  <div className={styles.vitalBox}>
                    <span className={styles.vitalLabel}>CR (挑战等级)</span>
                    <span className={styles.vitalVal}>
                      {formData.cr} (XP {getCrDetails(formData.cr).xp}; PB {getCrDetails(formData.cr).pb})
                    </span>
                  </div>
                </div>

                <div className={styles.taperedRule} />

                {/* 6 列 官方属性与豁免表格 */}
                <table className={styles.monsterStatsTable}>
                  <thead>
                    <tr>
                      <th>力量 (STR)</th>
                      <th>敏捷 (DEX)</th>
                      <th>体质 (CON)</th>
                      <th>智力 (INT)</th>
                      <th>感知 (WIS)</th>
                      <th>魅力 (CHA)</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>{formData.str} <span className={styles.statModHighlight}>({calcModStr(formData.str)})</span></td>
                      <td>{formData.dex} <span className={styles.statModHighlight}>({calcModStr(formData.dex)})</span></td>
                      <td>{formData.con} <span className={styles.statModHighlight}>({calcModStr(formData.con)})</span></td>
                      <td>{formData.int} <span className={styles.statModHighlight}>({calcModStr(formData.int)})</span></td>
                      <td>{formData.wis} <span className={styles.statModHighlight}>({calcModStr(formData.wis)})</span></td>
                      <td>{formData.cha} <span className={styles.statModHighlight}>({calcModStr(formData.cha)})</span></td>
                    </tr>
                  </tbody>
                </table>

                <div className={styles.taperedRule} />

                {/* 技能、抗性、感官、语言列表区 */}
                <div className={styles.monsterTraitsList}>
                  {formData.monsterSkills && (
                    <div className={styles.monsterTraitLine}>
                      <span className={styles.monsterTraitLabel}>技能：</span>{formData.monsterSkills}
                    </div>
                  )}
                  {formData.monsterResistances && (
                    <div className={styles.monsterTraitLine}>
                      <span className={styles.monsterTraitLabel}>伤害抗性/免疫：</span>{formData.monsterResistances}
                    </div>
                  )}
                  <div className={styles.monsterTraitLine}>
                    <span className={styles.monsterTraitLabel}>感官：</span>{formData.monsterSenses || '被动察觉 10'}
                  </div>
                  <div className={styles.monsterTraitLine}>
                    <span className={styles.monsterTraitLabel}>语言：</span>{formData.monsterLanguages || '通用语'}
                  </div>
                </div>

                <div className={styles.taperedRule} />

                {/* 动作与特质 Markdown 正文 */}
                <div className={styles.cardBody}>
                  {formData.description || (
                    <span style={{ color: 'var(--color-text-secondary, rgba(255,255,255,0.5))', fontStyle: 'italic' }}>
                      在此输入怪物的特质、动作与反应等描述...
                    </span>
                  )}
                </div>
              </div>
            ) : (
              <div className={styles.previewCard}>
                <div className={styles.cardHeader}>
                  <div>
                    <div className={styles.cardTitleCN}>
                      {formData.name || '未命名条目'}
                    </div>
                    {formData.nameEn && <div className={styles.cardTitleEN}>{formData.nameEn}</div>}
                  </div>
                  <span className={styles.badge}>第三方</span>
                </div>

                {/* 分类元数据高亮 */}
                {activeTab === 'spells' && (
                  <div className={styles.cardMetaRow}>
                    <div className={styles.metaItem}>🔮 {formData.level === 0 ? '戏法' : `${formData.level} 环`} · {formData.school}</div>
                    <div className={styles.metaItem}>⏱️ {formData.castingTime}</div>
                    <div className={styles.metaItem}>🎯 {formData.range}</div>
                    <div className={styles.metaItem}>✋ {formData.components}</div>
                  </div>
                )}

                {activeTab === 'items' && (
                  <div className={styles.cardMetaRow}>
                    <div className={styles.metaItem}>📦 {formData.rarity} {formData.itemType}</div>
                    <div className={styles.metaItem}>🔗 {formData.attunement}</div>
                    <div className={styles.metaItem}>💰 {formData.cost} · ⚖️ {formData.weight}</div>
                  </div>
                )}

                {activeTab === 'feats' && (
                  <div className={styles.cardMetaRow}>
                    <div className={styles.metaItem}>📜 分类：{formData.category}</div>
                    <div className={styles.metaItem}>📌 先决条件：{formData.prerequisite}</div>
                  </div>
                )}

                {/* 正文描述即时渲染区 */}
                <div className={styles.cardBody}>
                  {formData.description || (
                    <span style={{ color: 'var(--color-text-secondary, rgba(255,255,255,0.5))', fontStyle: 'italic' }}>
                      在此输入描述，此处将实时展示卡片规则正文...
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default function HomebrewCreatePage() {
  return (
    <Suspense fallback={<div style={{ padding: 40, color: '#fff' }}>加载中...</div>}>
      <HomebrewCreateContent />
    </Suspense>
  );
}
