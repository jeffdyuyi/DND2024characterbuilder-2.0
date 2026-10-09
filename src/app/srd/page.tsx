'use client';

import React, { useState, useEffect, useMemo, useTransition } from 'react';
import GlassNav from '@/components/GlassNav';
import {
  Users,
  GraduationCap,
  Award,
  Sliders,
  Scroll,
  Shield,
  BookOpen,
  Info,
  Skull,
  Search,
  Eye,
  X,
  Library,
  ArrowLeft,
  Filter,
} from 'lucide-react';
import styles from './page.module.css';
import { srdEngine, SrdKind, SrdEntry } from '@/engine/srd/srdEngine';
import SrdEntries from '@/components/SrdEntries';

type RuleEdition = '2024' | '2014' | 'all';

interface TabItem {
  key: SrdKind;
  label: string;
  en: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

// 切换式横轴列表选项（参考图 2 简洁高效风格）
const SRD_TABS: TabItem[] = [
  { key: 'race', label: '种族', en: 'Species', icon: Users },
  { key: 'class', label: '职业', en: 'Classes', icon: GraduationCap },
  { key: 'feat', label: '专长', en: 'Feats', icon: Award },
  { key: 'feature', label: '职业能力 & 选项', en: 'Features', icon: Sliders },
  { key: 'background', label: '背景', en: 'Backgrounds', icon: Scroll },
  { key: 'item', label: '物品', en: 'Items', icon: Shield },
  { key: 'spell', label: '法术', en: 'Spells', icon: BookOpen },
  { key: 'rule', label: '术语汇编', en: 'Glossary', icon: Info },
  { key: 'condition', label: '异常状态', en: 'Conditions', icon: Skull },
];

// 职业二级分类
const CLASS_SUB_CATEGORIES = [
  { key: 'all', label: '全部' },
  { key: 'core', label: '核心职业 (Core Classes)' },
  { key: 'subclass', label: '分支子职 (Subclasses)' },
];

// 职业特性与选项二级分类
const FEATURE_SUB_CATEGORIES = [
  { key: 'all', label: '全部' },
  { key: 'CF', label: '核心职业特性' },
  { key: 'EI', label: '魔能祈魂 (Invocations)' },
  { key: 'FS', label: '战斗风格 (Styles)' },
  { key: 'MM', label: '超魔选项 (Metamagic)' },
  { key: 'MV', label: '战技 (Maneuvers)' },
  { key: 'OF', label: '其他选项' },
];

export default function SrdPage() {
  const [activeTab, setActiveTab] = useState<SrdKind>('race');
  const [edition, setEdition] = useState<RuleEdition>('2024'); // 默认初始以 2024 版规则为主
  const [searchQuery, setSearchQuery] = useState('');
  const [subCategoryFilter, setSubCategoryFilter] = useState('all');
  const [parentClassFilter, setParentClassFilter] = useState('all');
  const [availableClasses, setAvailableClasses] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [rawEntries, setRawEntries] = useState<SrdEntry[]>([]);

  // 详情模态历史栈，支持深入点击特性与返回
  const [modalHistory, setModalHistory] = useState<SrdEntry[]>([]);
  const [displayCount, setDisplayCount] = useState(48);
  const [, startTransition] = useTransition();

  // 当前处于顶层的详情条目
  const activeModalEntry = modalHistory.length > 0 ? modalHistory[modalHistory.length - 1] : null;

  // 预载职业列表供下拉筛选
  useEffect(() => {
    srdEngine.getAvailableClasses().then(setAvailableClasses).catch(() => {});
  }, []);

  // 当切换选项卡时重置子分类与加载条目
  useEffect(() => {
    let active = true;
    setLoading(true);
    setDisplayCount(48);
    setSubCategoryFilter('all');
    setParentClassFilter('all');

    srdEngine
      .getEntries(activeTab)
      .then((data) => {
        if (!active) return;
        setRawEntries(data);
        setLoading(false);
      })
      .catch((err) => {
        if (!active) return;
        console.error('[SRD] 加载条目失败:', err);
        setRawEntries([]);
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeTab]);

  // 根据版本 (2024 / 2014)、二级分类、母职业、搜索词综合过滤
  const filteredEntries = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return rawEntries.filter((item) => {
      // 1. 版本过滤
      if (edition === '2024') {
        if (item.edition !== '2024' && item.edition !== 'both') return false;
      } else if (edition === '2014') {
        if (item.edition !== '2014' && item.edition !== 'both') return false;
      }

      // 2. 二级子分类过滤 (仅针对 class 或 feature)
      if (activeTab === 'class') {
        if (subCategoryFilter !== 'all' && item.subCategory !== subCategoryFilter) return false;
      } else if (activeTab === 'feature') {
        if (subCategoryFilter !== 'all' && item.subCategory !== subCategoryFilter) return false;
      }

      // 3. 母职业快速过滤
      if (parentClassFilter !== 'all') {
        const itemClass = item.parentClass || (item.name.includes(':') ? item.name.split(':')[0].trim() : item.name);
        if (!itemClass.toLowerCase().includes(parentClassFilter.toLowerCase())) return false;
      }

      // 4. 关键词搜索
      if (q) {
        const matchName = item.name.toLowerCase().includes(q);
        const matchEn = item.nameEn.toLowerCase().includes(q);
        const matchSrc = item.source.toLowerCase().includes(q);
        const matchDesc = (item.description || '').toLowerCase().includes(q);
        const matchType = (item.type || '').toLowerCase().includes(q);
        const matchClass = (item.parentClass || '').toLowerCase().includes(q);
        if (!matchName && !matchEn && !matchSrc && !matchDesc && !matchType && !matchClass) {
          return false;
        }
      }

      return true;
    });
  }, [rawEntries, edition, activeTab, subCategoryFilter, parentClassFilter, searchQuery]);

  const visibleEntries = useMemo(() => {
    return filteredEntries.slice(0, displayCount);
  }, [filteredEntries, displayCount]);

  const handleTabClick = (tab: TabItem) => {
    startTransition(() => {
      setActiveTab(tab.key);
      setSearchQuery('');
    });
  };

  // 处理文本内引用的点击：支持弹窗内多级深入跳转
  const handleLinkReference = (reference: string) => {
    // 1. 先尝试从全局特性字典解析
    const resolvedFeature = srdEngine.resolveFeature(reference);
    if (resolvedFeature) {
      setModalHistory((prev) => [...prev, resolvedFeature]);
      return;
    }

    // 2. 从当前已加载条目中解析
    const parts = reference.split('|');
    const targetName = parts[0].trim().toLowerCase();
    const found = rawEntries.find(
      (e) => e.name.toLowerCase() === targetName || e.nameEn.toLowerCase() === targetName
    );
    if (found) {
      setModalHistory((prev) => [...prev, found]);
    }
  };

  // 弹窗历史回退
  const handleModalBack = () => {
    setModalHistory((prev) => prev.slice(0, -1));
  };

  return (
    <div className={styles.container}>
      <GlassNav />

      <main className={styles.main}>
        {/* 顶部标题栏与规则版本切换器（参考图 2 样式） */}
        <div className={styles.header}>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>
              <Library size={28} />
              官方资源查阅库
            </h1>
            <p className={styles.subtitle}>
              全面接入 5etools 镜像数据 · 覆盖 2024 Core 与 2014 经典规则 · 客户端高速持久缓存
            </p>
          </div>

          {/* 规则版本切换胶囊 */}
          <div className={styles.editionSwitcher}>
            <button
              className={`${styles.editionBtn} ${edition === '2024' ? styles.editionBtnActive2024 : ''}`}
              onClick={() => setEdition('2024')}
              title="优先展示 2024 新版 (XPHB / 5R) 规则"
            >
              ⭐ 2024 新版 (默认)
            </button>
            <button
              className={`${styles.editionBtn} ${edition === '2014' ? styles.editionBtnActive2014 : ''}`}
              onClick={() => setEdition('2014')}
              title="切换为 2014 经典 5E (PHB/DMG/扩展) 规则"
            >
              📜 2014 经典 5E
            </button>
            <button
              className={`${styles.editionBtn} ${edition === 'all' ? styles.editionBtnActiveAll : ''}`}
              onClick={() => setEdition('all')}
              title="查看全部官方条目"
            >
              🌐 全部规则
            </button>
          </div>
        </div>

        {/* 切换式横轴选项卡（参考图 2 简洁高效呈现） */}
        <div className={styles.tabs}>
          {SRD_TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                className={`${styles.tabBtn} ${isActive ? styles.tabBtnActive : ''}`}
                onClick={() => handleTabClick(tab)}
              >
                <Icon size={16} className={styles.tabIcon} />
                <span>
                  {tab.label} <small style={{ opacity: 0.65, fontSize: '0.78rem' }}>({tab.en})</small>
                </span>
              </button>
            );
          })}
        </div>

        {/* 二级筛选栏（仅在职业与职业特性选项卡下展示，提供多维层次感） */}
        {(activeTab === 'class' || activeTab === 'feature') && (
          <div className={styles.subCategoryBar}>
            <div className={styles.pillGroup}>
              {(activeTab === 'class' ? CLASS_SUB_CATEGORIES : FEATURE_SUB_CATEGORIES).map((sub) => (
                <button
                  key={sub.key}
                  className={`${styles.subPill} ${subCategoryFilter === sub.key ? styles.subPillActive : ''}`}
                  onClick={() => setSubCategoryFilter(sub.key)}
                >
                  {sub.label}
                </button>
              ))}
            </div>

            {/* 母职业快速过滤下拉 */}
            <div className={styles.classSelectWrap}>
              <Filter size={14} style={{ color: 'var(--color-gold-bright)' }} />
              <span>关联职业:</span>
              <select
                className={styles.classSelect}
                value={parentClassFilter}
                onChange={(e) => setParentClassFilter(e.target.value)}
              >
                <option value="all">全部职业 (All Classes)</option>
                {availableClasses.map((cls) => (
                  <option key={cls} value={cls}>
                    {cls}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* 检索工具栏 */}
        <div className={styles.filterBar}>
          <div className={styles.searchBox}>
            <Search size={15} style={{ color: 'var(--color-gold-bright)' }} />
            <input
              type="text"
              className={styles.searchInput}
              placeholder="搜索当前条目（支持中文名、英文名、出处、描述）..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <X
                size={14}
                style={{ cursor: 'pointer', color: 'var(--color-text-secondary)' }}
                onClick={() => setSearchQuery('')}
              />
            )}
          </div>

          <div className={styles.countStats}>
            <span>规则版本:</span>
            <span className={styles.countHighlight}>
              {edition === '2024' ? '2024 Core' : edition === '2014' ? '2014 经典' : '全部官方'}
            </span>
            <span style={{ margin: '0 4px', opacity: 0.4 }}>|</span>
            <span>已筛选</span>
            <span className={styles.countHighlight}>{filteredEntries.length}</span>
            <span>个条目</span>
          </div>
        </div>

        {/* 内容展示区 */}
        {loading ? (
          <div className={styles.loadingBox}>
            <div className={styles.spinner} />
            <p>正在读取并解析 5etools 镜像条目...</p>
          </div>
        ) : filteredEntries.length === 0 ? (
          <div className={styles.emptyBox}>
            <p>未找到符合条件的条目。可尝试切换规则版本、重置二级分类或调整关键词。</p>
          </div>
        ) : (
          <>
            <div className={styles.grid}>
              {visibleEntries.map((item) => (
                <div key={item.id} className={styles.card} onClick={() => setModalHistory([item])}>
                  <div className={styles.cardTop}>
                    <div>
                      <div className={styles.cardTitle}>{item.name}</div>
                      {item.nameEn && item.nameEn !== item.name && (
                        <div className={styles.cardSubtitle}>{item.nameEn}</div>
                      )}
                    </div>
                    <div className={styles.badgeGroup}>
                      <span className={item.edition === '2024' ? styles.badge2024 : styles.badge2014}>
                        {item.edition === '2024' ? '2024' : item.edition === '2014' ? '2014' : '双版'}
                      </span>
                      <span className={styles.badge}>
                        {item.subCategoryLabel || item.categoryLabel}
                      </span>
                    </div>
                  </div>

                  {item.type && <div className={styles.cardType}>{item.type}</div>}

                  {item.prerequisite && (
                    <div className={styles.prereqBox}>
                      <strong>先决条件：</strong>
                      {item.prerequisite}
                    </div>
                  )}

                  <p className={styles.cardDesc}>{item.description || '无简要描述，点击查看详细规则。'}</p>

                  <div className={styles.cardBottom}>
                    <span>📖 出处：{item.source}</span>
                    <span className={styles.viewDetail}>
                      <Eye size={14} /> 查阅详情
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {visibleEntries.length < filteredEntries.length && (
              <button
                className={styles.loadMoreBtn}
                onClick={() => setDisplayCount((prev) => prev + 48)}
              >
                加载更多条目（还剩 {filteredEntries.length - visibleEntries.length} 项）
              </button>
            )}
          </>
        )}

        {/* 详情模态抽屉（支持多层级深入查看与返回） */}
        {activeModalEntry && (
          <div className={styles.modalOverlay} onClick={() => setModalHistory([])}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
              {/* 弹窗多层级导航条 */}
              {modalHistory.length > 1 && (
                <div className={styles.modalNav}>
                  <button className={styles.historyBackBtn} onClick={handleModalBack}>
                    <ArrowLeft size={14} />
                    返回上一层：{modalHistory[modalHistory.length - 2].name}
                  </button>
                  <span className={styles.historyDepth}>
                    （层级 {modalHistory.length}）
                  </span>
                </div>
              )}

              <div className={styles.modalHeader}>
                <div className={styles.modalTitleGroup}>
                  <h2 className={styles.modalTitle}>{activeModalEntry.name}</h2>
                  {activeModalEntry.nameEn && activeModalEntry.nameEn !== activeModalEntry.name && (
                    <span className={styles.modalSubtitle}>{activeModalEntry.nameEn}</span>
                  )}
                </div>
                <button className={styles.modalCloseBtn} onClick={() => setModalHistory([])}>
                  <X size={20} />
                </button>
              </div>

              <div className={styles.modalBody}>
                <div className={styles.modalMeta}>
                  <span className={styles.modalMetaItem}>
                    <strong>分类：</strong>
                    {activeModalEntry.subCategoryLabel || activeModalEntry.categoryLabel}
                  </span>
                  {activeModalEntry.parentClass && (
                    <span className={styles.modalMetaItem}>
                      <strong>所属职业：</strong>
                      {activeModalEntry.parentClass}
                    </span>
                  )}
                  <span className={styles.modalMetaItem}>
                    <strong>规则版本：</strong>
                    {activeModalEntry.edition === '2024'
                      ? '2024 规则集 (XPHB)'
                      : activeModalEntry.edition === '2014'
                      ? '2014 经典版 (PHB)'
                      : '双版通用'}
                  </span>
                  <span className={styles.modalMetaItem}>
                    <strong>出版物出处：</strong>
                    {activeModalEntry.source}
                  </span>
                  {activeModalEntry.type && (
                    <span className={styles.modalMetaItem}>
                      <strong>规格：</strong>
                      {activeModalEntry.type}
                    </span>
                  )}
                </div>

                {activeModalEntry.prerequisite && (
                  <div className={styles.prereqBox}>
                    <strong>先决条件：</strong>
                    {activeModalEntry.prerequisite}
                  </div>
                )}

                <SrdEntries
                  value={
                    activeModalEntry.entries && activeModalEntry.entries.length > 0
                      ? activeModalEntry.entries
                      : [activeModalEntry.description || '无详细内容']
                  }
                  onLink={handleLinkReference}
                />
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
