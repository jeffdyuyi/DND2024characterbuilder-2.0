'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  User,
  BookOpen,
  Sparkles,
  Sun,
  Moon,
  Info,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  MessageCircle,
} from 'lucide-react';
import CatalogStatus from '@/platform/CatalogStatus';
import styles from './AppSidebar.module.css';

const D20Icon = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 2L2.5 7.5L2.5 16.5L12 22L21.5 16.5L21.5 7.5L12 2Z" />
    <path d="M12 22V12" />
    <path d="M12 12L2.5 7.5" />
    <path d="M12 12L21.5 7.5" />
    <path d="M12 2L2.5 7.5" />
    <path d="M12 2L21.5 7.5" />
    <path d="M2.5 16.5L12 12" />
    <path d="M21.5 16.5L12 12" />
  </svg>
);

export default function AppSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(true);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => {
    // 读取折叠状态
    const savedCollapsed = localStorage.getItem('dnd2024-sidebar-collapsed');
    if (savedCollapsed !== null) {
      setIsCollapsed(savedCollapsed === 'true');
    }

    // 读取主题
    const savedTheme = localStorage.getItem('dnd2024-theme') === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    setTheme(savedTheme);
  }, []);

  useEffect(() => {
    // 动态同步全局 CSS 变量 --sidebar-width
    const width = isCollapsed ? '56px' : '220px';
    document.documentElement.style.setProperty('--sidebar-width', width);
  }, [isCollapsed]);

  const toggleCollapse = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem('dnd2024-sidebar-collapsed', String(next));
  };

  const toggleTheme = () => {
    const activeTheme = document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    const nextTheme = activeTheme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('dnd2024-theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  const navItems = [
    { label: '角色库', path: '/', icon: <User size={18} /> },
    { label: '官方资源库', path: '/srd', icon: <BookOpen size={18} style={{ color: 'var(--color-apple-blue, #3b82f6)' }} /> },
    { label: '原创第三方', path: '/homebrew', icon: <Sparkles size={18} style={{ color: 'var(--color-gold-bright, #ffd700)' }} /> },
    { label: '规则速查', path: '/quick-ref', icon: <BookOpen size={18} /> },
  ];

  return (
    <>
      <aside className={`${styles.sidebar} ${isCollapsed ? styles.sidebarCollapsed : styles.sidebarExpanded}`}>
        {/* 顶部 Logo 与折叠按钮 */}
        <div className={styles.header}>
          <div className={styles.logoArea} onClick={() => router.push('/')} title="返回角色库首页">
            <D20Icon size={22} />
            {!isCollapsed && <span className={styles.logoText}>DND工具</span>}
          </div>
          <button
            className={styles.toggleBtn}
            onClick={toggleCollapse}
            aria-label={isCollapsed ? '展开侧边栏' : '收起侧边栏'}
            title={isCollapsed ? '展开侧边栏 (220px)' : '收起为图标栏 (56px)'}
          >
            {isCollapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
          </button>
        </div>

        {/* 主导航条目 */}
        <nav className={styles.navSection}>
          {!isCollapsed && <div className={styles.sectionTitle}>主航道</div>}
          {navItems.map((item) => {
            const isActive = item.path === '/' ? pathname === '/' : pathname.startsWith(item.path);
            return (
              <a
                key={item.path}
                className={`${styles.navItem} ${isActive ? styles.navItemActive : ''}`}
                onClick={() => router.push(item.path)}
                title={isCollapsed ? item.label : undefined}
              >
                <div className={styles.itemIcon}>{item.icon}</div>
                {!isCollapsed && <span className={styles.itemLabel}>{item.label}</span>}
              </a>
            );
          })}
        </nav>

        {/* 底部系统状态与偏好 */}
        <div className={styles.footer}>
          {!isCollapsed ? (
            <>
              <div style={{ padding: '0 4px 6px' }}>
                <CatalogStatus />
              </div>
              <button className={styles.footerBtn} onClick={toggleTheme}>
                <div className={styles.itemIcon}>
                  {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
                </div>
                <span>{theme === 'dark' ? '浅色模式' : '深色模式'}</span>
              </button>
              <button className={styles.footerBtn} onClick={() => setShowInfo(true)}>
                <div className={styles.itemIcon}><Info size={17} /></div>
                <span>关于与社区</span>
              </button>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 4 }} title="数据加载状态">
                <CatalogStatus compact />
              </div>
              <button
                className={styles.footerBtn}
                onClick={toggleTheme}
                title={theme === 'dark' ? '切换到浅色主题' : '切换到深色像素主题'}
                style={{ justifyContent: 'center' }}
              >
                {theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
              </button>
              <button
                className={styles.footerBtn}
                onClick={() => setShowInfo(true)}
                title="关于不咕鸟与社区交流群"
                style={{ justifyContent: 'center' }}
              >
                <Info size={17} />
              </button>
            </>
          )}
        </div>
      </aside>

      {/* 作者关于弹窗 */}
      {showInfo && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            backdropFilter: 'blur(6px)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
          onClick={() => setShowInfo(false)}
        >
          <div
            style={{
              width: '90%',
              maxWidth: 420,
              background: 'var(--color-bg-surface, #141622)',
              border: '1px solid var(--color-border-gold, #c5a059)',
              borderRadius: 12,
              padding: 24,
              boxShadow: '0 20px 50px rgba(0,0,0,0.5)',
              color: 'var(--color-text-primary, #ffffff)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, borderBottom: '1px solid var(--color-border-dark)', paddingBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, fontFamily: 'var(--font-family-serif)' }}>作者与交流群</h3>
              <button onClick={() => setShowInfo(false)} style={{ background: 'transparent', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 18 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 13, color: 'var(--color-text-secondary)' }}>
              <div><strong>作者：</strong> 不咕鸟（基德）</div>
              <div><strong>AI 辅助：</strong> Antigravity Gemini</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <strong>TRPG 创想俱乐部：</strong>
                <span style={{ color: 'var(--color-apple-blue)', fontWeight: 600 }}>261751459</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <strong>官方主页：</strong>
                <a href="https://nogubird.top/" target="_blank" rel="noreferrer" style={{ color: 'var(--color-apple-blue)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}>
                  nogubird.top <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
