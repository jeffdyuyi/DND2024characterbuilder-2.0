'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import GlassNav from '@/components/GlassNav';
import { useHomebrewStore, HomebrewDataState, Monster, HomebrewPack } from '@/store/homebrewStore';
import { getStorageUsage } from '@/utils/safeStorage';
import {
  Sparkles,
  Download,
  Upload,
  Plus,
  Trash2,
  Edit,
  Search,
  FileJson,
  Package,
  Eye,
  EyeOff,
  HardDrive,
  Settings,
  FolderPlus,
  ChevronDown,
  Check,
} from 'lucide-react';
import styles from './page.module.css';

type TabKey = 'spells' | 'monsters' | 'items' | 'classes' | 'species' | 'backgrounds' | 'feats';

const TAB_CONFIG: { key: TabKey; label: string }[] = [
  { key: 'spells', label: '法术' },
  { key: 'monsters', label: '怪物' },
  { key: 'items', label: '装备与物品' },
  { key: 'classes', label: '职业' },
  { key: 'species', label: '种族' },
  { key: 'backgrounds', label: '背景' },
  { key: 'feats', label: '专长' },
];

export default function HomebrewPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabKey>('spells');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const homebrewState = useHomebrewStore();

  // 资源包管理 State
  const [selectedPackFilter, setSelectedPackFilter] = useState<string>('current'); // 'current' | 'all'
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [isPackModalOpen, setIsPackModalOpen] = useState(false);
  const [packModalMode, setPackModalMode] = useState<'create' | 'edit'>('create');
  const [packFormData, setPackFormData] = useState({
    name: '',
    author: '',
    description: '',
    version: '1.0.0',
  });
  const [storageUsage, setStorageUsage] = useState({ usedBytes: 0, keysCount: 0 });

  useEffect(() => {
    setStorageUsage(getStorageUsage());
  }, [homebrewState.packs]);

  // 点击外部关闭下拉菜单
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const currentPack: HomebrewPack | undefined =
    homebrewState.packs.find((p) => p.id === homebrewState.activePackId) ||
    homebrewState.packs[0];

  // 完整中文化分类表单 State
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
    isRitual: false,
    classes: ['法师'],
    // 怪物
    cr: '1',
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
    // 描述
    description: '',
  });

  const handleExport = () => {
    const jsonStr = homebrewState.exportAsJSON(currentPack?.id);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${currentPack?.name || 'dnd2024-homebrew'}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSingleCard = (item: any) => {
    const targetPackId = item.sourcePackId || currentPack?.id;
    const jsonStr = homebrewState.exportSingleCardJSON(activeTab, item.id, targetPackId);
    if (!jsonStr) return;
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${item.name || 'card'}.card.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenCreatePack = () => {
    setPackModalMode('create');
    setPackFormData({
      name: '',
      author: '本地用户',
      description: '',
      version: '1.0.0',
    });
    setIsPackModalOpen(true);
  };

  const handleOpenEditPack = () => {
    if (!currentPack) return;
    setPackModalMode('edit');
    setPackFormData({
      name: currentPack.name,
      author: currentPack.author || '',
      description: currentPack.description || '',
      version: currentPack.version || '1.0.0',
    });
    setIsPackModalOpen(true);
  };

  const handleSavePackForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!packFormData.name.trim()) {
      alert('请填写资源包名称');
      return;
    }
    if (packModalMode === 'create') {
      homebrewState.createPack(packFormData.name.trim(), {
        author: packFormData.author.trim(),
        description: packFormData.description.trim(),
        version: packFormData.version.trim(),
      });
    } else if (currentPack) {
      homebrewState.updatePack(currentPack.id, {
        name: packFormData.name.trim(),
        author: packFormData.author.trim(),
        description: packFormData.description.trim(),
        version: packFormData.version.trim(),
      });
    }
    setIsPackModalOpen(false);
  };

  const handleDeletePack = () => {
    if (!currentPack) return;
    if (
      confirm(
        `确定要删除资源包「${currentPack.name}」吗？\n该包内的所有自制卡片将被永久删除（若只剩最后一个包将重置为空包）。`
      )
    ) {
      homebrewState.deletePack(currentPack.id);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      if (content) {
        const res = homebrewState.importFromJSON(content);
        if (res.success) {
          alert(`成功导入资源包！共识别载入 ${res.count} 张卡片条目。`);
        } else {
          alert(`导入失败：${res.error}`);
        }
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 智能 Slug 自动生成与查重函数
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

    // 检查重复 ID
    const currentCategoryList = ((homebrewState as any)[activeTab] as any[]) || [];
    let finalId = baseSlug;
    let counter = 1;
    while (currentCategoryList.some((item) => item.id === finalId)) {
      finalId = `${baseSlug}-${counter}`;
      counter++;
    }

    return finalId;
  };

  const handleSaveForm = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      alert('请填写名称');
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

    setIsModalOpen(false);
    setFormData({
      id: '',
      name: '',
      nameEn: '',
      level: 1,
      school: '塑能系',
      castingTime: '1 动作',
      range: '60 尺',
      components: 'V, S',
      materials: '',
      duration: '立即',
      isRitual: false,
      classes: ['法师'],
      cr: '1',
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
      itemType: '奇物',
      rarity: '非普通',
      attunement: '无需同调',
      cost: '100 gp',
      weight: '1 磅',
      category: 'General',
      prerequisite: '无',
      creatureType: '类人生物',
      size: 'Medium',
      senses: '黑暗视觉 60 尺',
      abilityScores: '敏捷, 体质, 感知',
      featRecommendation: '警戒',
      skills: '运动, 生存',
      hitDie: 'd8',
      primaryAbility: '智力',
      description: '',
    });
  };

  const getActiveList = () => {
    const q = searchQuery.toLowerCase().trim();
    let list: any[] = [];
    if (selectedPackFilter === 'all') {
      if (activeTab === 'spells') list = homebrewState.spells;
      else if (activeTab === 'monsters') list = homebrewState.monsters;
      else if (activeTab === 'items') list = homebrewState.items;
      else if (activeTab === 'classes') list = (homebrewState as any).classes || [];
      else if (activeTab === 'species') list = homebrewState.species;
      else if (activeTab === 'backgrounds') list = homebrewState.backgrounds;
      else if (activeTab === 'feats') list = homebrewState.feats;
    } else {
      const d = currentPack?.data;
      if (d) {
        const rawList = Array.isArray(d[activeTab]) ? (d[activeTab] as any[]) : [];
        list = rawList.map((item) => ({
          ...item,
          sourcePackId: currentPack.id,
          sourcePackName: currentPack.name,
        }));
      }
    }

    if (!q) return list;
    return list.filter(
      (item) =>
        item.name.toLowerCase().includes(q) ||
        (item.nameEn && item.nameEn.toLowerCase().includes(q)) ||
        (item.description && item.description.toLowerCase().includes(q))
    );
  };

  const activeList = getActiveList();

  const toggleClassSelect = (cls: string) => {
    if (formData.classes.includes(cls)) {
      setFormData({ ...formData, classes: formData.classes.filter((c) => c !== cls) });
    } else {
      setFormData({ ...formData, classes: [...formData.classes, cls] });
    }
  };

  return (
    <div className={styles.container}>
      <GlassNav title="原创第三方" backLabel="角色库" backHref="/" />

      <main className={styles.main}>
        <div className={styles.headerSection}>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>
              <Sparkles size={28} />
              原创第三方库
            </h1>
            <p className={styles.subtitle}>
              管理与导出自定义法术、怪物、装备、种族、背景及专长，数据自动保存在本地。
            </p>
          </div>

          <div className={styles.actionGroup}>
            <div className={styles.storageBar} title="本地 safeLocalStorage 存储用量统计">
              <HardDrive size={13} />
              <span>{(storageUsage.usedBytes / 1024).toFixed(1)} KB / 5 MB</span>
            </div>
            <button className={`${styles.btn} ${styles.btnOutline}`} onClick={handleExport}>
              <Download size={16} />
              导出当前包
            </button>
            <button className={`${styles.btn} ${styles.btnOutline}`} onClick={handleImportClick}>
              <Upload size={16} />
              导入资源包
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />

            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              onClick={() => router.push(`/homebrew/create?type=${activeTab}`)}
            >
              <Plus size={16} />
              新建卡片
            </button>
          </div>
        </div>

        {/* 资源包控制与切换面板 (对标 4E-NEXT) */}
        <div className={styles.packControlPanel}>
          <div className={styles.packInfoGroup}>
            <div className={styles.customSelectWrapper} ref={dropdownRef}>
              <button
                type="button"
                className={styles.customSelectTrigger}
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                title="选择或切换当前自制卡包"
              >
                <div className={styles.triggerText}>
                  <Package size={16} color="var(--color-gold-bright)" />
                  <span>
                    {selectedPackFilter === 'all'
                      ? '🌐 全部已启用卡包汇总'
                      : `📦 ${currentPack?.name || '卡包'} ${currentPack?.version ? `v${currentPack.version}` : ''}${currentPack?.enabled ? '' : ' (已停用)'}`}
                  </span>
                </div>
                <ChevronDown
                  size={14}
                  className={`${styles.chevronIcon} ${isDropdownOpen ? styles.chevronOpen : ''}`}
                />
              </button>

              {isDropdownOpen && (
                <div className={styles.customSelectMenu}>
                  {homebrewState.packs.map((p) => {
                    const isSelected = selectedPackFilter !== 'all' && currentPack?.id === p.id;
                    return (
                      <div
                        key={p.id}
                        className={`${styles.customSelectOption} ${isSelected ? styles.customSelectOptionActive : ''}`}
                        onClick={() => {
                          setSelectedPackFilter('current');
                          homebrewState.setActivePack(p.id);
                          setIsDropdownOpen(false);
                        }}
                      >
                        <div className={styles.optionMain}>
                          <span>📦 {p.name}</span>
                          {p.version && <span className={styles.optionVersion}>v{p.version}</span>}
                          {!p.enabled && <span className={styles.optionDisabledTag}>已停用</span>}
                        </div>
                        {isSelected && <Check size={14} color="var(--color-gold-bright)" />}
                      </div>
                    );
                  })}
                  <div
                    className={`${styles.customSelectOption} ${selectedPackFilter === 'all' ? styles.customSelectOptionActive : ''}`}
                    onClick={() => {
                      setSelectedPackFilter('all');
                      setIsDropdownOpen(false);
                    }}
                  >
                    <div className={styles.optionMain}>
                      <span>🌐 全部已启用卡包汇总</span>
                    </div>
                    {selectedPackFilter === 'all' && <Check size={14} color="var(--color-gold-bright)" />}
                  </div>
                </div>
              )}
            </div>

            {selectedPackFilter !== 'all' && currentPack && (
              <>
                <div
                  className={styles.packToggleSwitch}
                  onClick={() => homebrewState.togglePackEnabled(currentPack.id)}
                  title={currentPack.enabled ? '点击停用（不参与规则创建与索引）' : '点击启用（参与角色创建）'}
                >
                  <div
                    className={`${styles.switchTrack} ${currentPack.enabled ? styles.switchTrackActive : ''}`}
                  >
                    <div
                      className={`${styles.switchThumb} ${currentPack.enabled ? styles.switchThumbActive : ''}`}
                    />
                  </div>
                  <span>{currentPack.enabled ? '全局生效中' : '离线停用'}</span>
                </div>

                <div className={styles.packMetaBadge}>
                  作者: {currentPack.author || '本地'} | 卡片数:{' '}
                  {(currentPack.data.spells?.length || 0) +
                    (currentPack.data.items?.length || 0) +
                    (currentPack.data.monsters?.length || 0) +
                    (currentPack.data.feats?.length || 0) +
                    (currentPack.data.species?.length || 0) +
                    (currentPack.data.backgrounds?.length || 0) +
                    (currentPack.data.classes?.length || 0)}
                </div>
              </>
            )}
          </div>

          <div className={styles.packBtnGroup}>
            <button
              className={`${styles.btn} ${styles.btnOutline}`}
              style={{ fontSize: 13, padding: '5px 10px' }}
              onClick={handleOpenCreatePack}
              title="新建独立卡包"
            >
              <FolderPlus size={14} />
              新建卡包
            </button>
            {selectedPackFilter !== 'all' && currentPack && (
              <>
                <button
                  className={`${styles.btn} ${styles.btnOutline}`}
                  style={{ fontSize: 13, padding: '5px 10px' }}
                  onClick={handleOpenEditPack}
                  title="编辑包信息"
                >
                  <Settings size={14} />
                  包属性
                </button>
                <button
                  className={`${styles.btn} ${styles.btnOutline}`}
                  style={{ fontSize: 13, padding: '5px 10px', color: '#f87171' }}
                  onClick={handleDeletePack}
                  title="删除当前包"
                >
                  <Trash2 size={14} />
                  删除包
                </button>
              </>
            )}
          </div>
        </div>

        {/* 7 大分类中文化 Tab */}
        <div className={styles.tabBar}>
          {TAB_CONFIG.map((tab) => (
            <button
              key={tab.key}
              className={`${styles.tabItem} ${activeTab === tab.key ? styles.tabItemActive : ''}`}
              onClick={() => setActiveTab(tab.key)}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* 搜索与筛选工具栏 */}
        <div className={styles.filterBar}>
          <div className={styles.searchBox}>
            <Search size={16} color="rgba(255,255,255,0.4)" />
            <input
              type="text"
              className={styles.searchInput}
              placeholder={`在【${TAB_CONFIG.find((t) => t.key === activeTab)?.label}】中搜索...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>

        {/* 列表渲染或空状态 */}
        {activeList.length === 0 ? (
          <div className={styles.emptyState}>
            <FileJson size={48} className={styles.emptyIcon} />
            <div className={styles.emptyTitle}>
              目前还没有【{TAB_CONFIG.find((t) => t.key === activeTab)?.label}】的第三方条目
            </div>
            <div className={styles.emptySub}>
              点击右上角的“新建第三方条目”按钮跳转至制作页面开始定制，或点击“导入扩展包”加载已有数据包。
            </div>
            <button
              className={`${styles.btn} ${styles.btnPrimary}`}
              style={{ marginTop: 12 }}
              onClick={() => router.push(`/homebrew/create?type=${activeTab}`)}
            >
              <Plus size={16} />
              立即创造
            </button>
          </div>
        ) : (
          <div className={styles.grid}>
            {activeList.map((item) => (
              <div key={item.id} className={styles.card}>
                <div>
                  <div className={styles.cardTop}>
                    <div>
                      <div className={styles.cardTitle}>{item.name}</div>
                      {item.nameEn && <div className={styles.cardSubtitle}>{item.nameEn}</div>}
                    </div>
                    <span className={styles.badge}>原创第三方</span>
                  </div>
                  <div className={styles.cardDesc} style={{ marginTop: 10 }}>
                    {item.description || '暂无说明描述'}
                  </div>
                </div>

                <div className={styles.cardFooter}>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary, #9aa0b8)' }}>
                    {item.sourcePackName ? `所属: ${item.sourcePackName}` : '原创卡片'}
                  </div>
                  <div className={styles.cardFooterActions}>
                    <button
                      className={styles.iconBtn}
                      onClick={() => {
                        const targetPackId = item.sourcePackId || currentPack?.id;
                        if (targetPackId) {
                          homebrewState.toggleEntryEnabledInPack(
                            targetPackId,
                            activeTab as any,
                            item.id,
                            item.enabled === false ? true : false
                          );
                        }
                      }}
                      title={item.enabled !== false ? '点击停用单卡' : '点击启用单卡'}
                    >
                      {item.enabled !== false ? <Eye size={15} color="#22c55e" /> : <EyeOff size={15} color="#f87171" />}
                    </button>
                    <button
                      className={styles.iconBtn}
                      onClick={() => handleExportSingleCard(item)}
                      title="导出此单卡 JSON"
                    >
                      <Download size={15} />
                    </button>
                    <button
                      className={styles.iconBtn}
                      onClick={() => {
                        if (confirm(`确定要删除条目「${item.name}」吗？`)) {
                          const targetPackId = item.sourcePackId || currentPack?.id;
                          if (targetPackId) {
                            homebrewState.deleteEntryFromPack(targetPackId, activeTab as any, item.id);
                          } else {
                            homebrewState.deleteEntry(activeTab as any, item.id);
                          }
                        }
                      }}
                      title="删除卡片"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* 资源包元数据 Modal 弹窗 */}
      {isPackModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsPackModalOpen(false)}>
          <div className={styles.modalWindow} onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                {packModalMode === 'create' ? '新建原创第三方卡包' : '编辑卡包属性'}
              </div>
              <button
                onClick={() => setIsPackModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSavePackForm}>
              <div className={styles.modalBody}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>卡包名称 *</label>
                  <input
                    type="text"
                    className={styles.input}
                    required
                    placeholder="如：绝冬城私设扩充包"
                    value={packFormData.name}
                    onChange={(e) => setPackFormData({ ...packFormData, name: e.target.value })}
                  />
                </div>
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>作者</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="作者或团队名"
                      value={packFormData.author}
                      onChange={(e) => setPackFormData({ ...packFormData, author: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>版本号</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="1.0.0"
                      value={packFormData.version}
                      onChange={(e) => setPackFormData({ ...packFormData, version: e.target.value })}
                    />
                  </div>
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>包说明简介</label>
                  <textarea
                    className={styles.textarea}
                    rows={3}
                    placeholder="简要说明此卡包包含的战役背景、规则调整或适用战役..."
                    value={packFormData.description}
                    onChange={(e) => setPackFormData({ ...packFormData, description: e.target.value })}
                  />
                </div>
              </div>
              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnOutline}`}
                  onClick={() => setIsPackModalOpen(false)}
                >
                  取消
                </button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                  保存卡包
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 创建自制内容 Modal 弹窗 */}
      {isModalOpen && (
        <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div className={styles.modalWindow} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <div className={styles.modalTitle}>
                新增【{TAB_CONFIG.find((t) => t.key === activeTab)?.label}】原创/第三方条目
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer' }}
              >
                ×
              </button>
            </div>

            <form onSubmit={handleSaveForm}>
              <div className={styles.modalBody}>
                {/* 通用基础属性 */}
                <div className={styles.formRow}>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>中文名称 *</label>
                    <input
                      type="text"
                      className={styles.input}
                      required
                      placeholder="如：冰霜打击"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    />
                  </div>
                  <div className={styles.formGroup}>
                    <label className={styles.label}>英文原名 (Name En)</label>
                    <input
                      type="text"
                      className={styles.input}
                      placeholder="如：Frost Strike"
                      value={formData.nameEn}
                      onChange={(e) => setFormData({ ...formData, nameEn: e.target.value })}
                    />
                  </div>
                </div>

                <div className={styles.formGroup}>
                  <label className={styles.label}>唯一 Identifier ID (留空根据名称自动推导)</label>
                  <input
                    type="text"
                    className={styles.input}
                    placeholder={
                      formData.name || formData.nameEn
                        ? `自动生成 ID：${generateSmartSlug(formData.name, formData.nameEn, '')}`
                        : '如：frost-strike-custom'
                    }
                    value={formData.id}
                    onChange={(e) => setFormData({ ...formData, id: e.target.value })}
                  />
                </div>

                {/* 1. 法术专属字段 */}
                {activeTab === 'spells' && (
                  <>
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
                          placeholder="如：V, S 或 V, S, M"
                          value={formData.components}
                          onChange={(e) => setFormData({ ...formData, components: e.target.value })}
                        />
                      </div>
                      <div className={styles.formGroup}>
                        <label className={styles.label}>材料说明 (可选)</label>
                        <input
                          type="text"
                          className={styles.input}
                          placeholder="如：一块价值 50 gp 的水晶"
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
                  </>
                )}

                {/* 3. 装备与物品专属字段 */}
                {activeTab === 'items' && (
                  <>
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

                {/* 5. 种族专属字段 */}
                {activeTab === 'species' && (
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>体型</label>
                      <select
                        className={styles.select}
                        value={formData.size}
                        onChange={(e) => setFormData({ ...formData, size: e.target.value })}
                      >
                        <option value="Medium">中型 (Medium)</option>
                        <option value="Small">小型 (Small)</option>
                        <option value="Medium or Small">中型或小型 (Medium or Small)</option>
                      </select>
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>基础速度</label>
                      <input
                        type="text"
                        className={styles.input}
                        placeholder="如：30 尺"
                        value={formData.speed}
                        onChange={(e) => setFormData({ ...formData, speed: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {/* 6. 背景专属字段 */}
                {activeTab === 'backgrounds' && (
                  <div className={styles.formRow}>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>2024 属性加成建议</label>
                      <input
                        type="text"
                        className={styles.input}
                        placeholder="如：敏捷, 体质, 感知"
                        value={formData.abilityScores}
                        onChange={(e) => setFormData({ ...formData, abilityScores: e.target.value })}
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label className={styles.label}>建议起源专长</label>
                      <input
                        type="text"
                        className={styles.input}
                        placeholder="如：警戒 / 幸运"
                        value={formData.featRecommendation}
                        onChange={(e) => setFormData({ ...formData, featRecommendation: e.target.value })}
                      />
                    </div>
                  </div>
                )}

                {/* 通用规则与效果描述文本框 */}
                <div className={styles.formGroup}>
                  <label className={styles.label}>核心效果与规则文本描述</label>
                  <textarea
                    className={styles.textarea}
                    placeholder="在此填写该条目的详细规则描述文本与效应说明..."
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnOutline}`}
                  onClick={() => setIsModalOpen(false)}
                >
                  取消
                </button>
                <button type="submit" className={`${styles.btn} ${styles.btnPrimary}`}>
                  保存至本地
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
