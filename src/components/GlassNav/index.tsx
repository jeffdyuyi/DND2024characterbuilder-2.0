'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChevronLeft, Search } from 'lucide-react';
import SearchModal from '../SearchModal';
import styles from './GlassNav.module.css';

interface GlassNavProps {
  title?: string;
  backLabel?: string;
  backHref?: string;
  actions?: React.ReactNode;
}

export default function GlassNav({ title, backLabel, backHref, actions }: GlassNavProps) {
  const router = useRouter();
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <>
      <nav className={styles.glassNav}>
        <div className={styles.glassNav__inner}>
          {/* 左侧：返回上级与页面标题 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            {backLabel && (
              <button className={styles.glassNav__back} onClick={handleBack} title={`返回${backLabel}`}>
                <ChevronLeft size={16} />
                <span>{backLabel}</span>
              </button>
            )}

            {title && (
              <h1 className={styles.glassNav__title} style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
                {title}
              </h1>
            )}
          </div>

          {/* 右侧：搜索框 + 页面专属操作 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div className={styles.searchTrigger} onClick={() => setIsSearchOpen(true)} title="快捷键 Ctrl+K 搜索全库资源">
              <Search size={14} />
              <span>搜索资源...</span>
              <kbd className={styles.searchTriggerKbd}>Ctrl+K</kbd>
            </div>

            {actions && (
              <div className={styles.glassNav__actions}>
                {actions}
              </div>
            )}
          </div>
        </div>
      </nav>

      <SearchModal
        isOpen={isSearchOpen}
        onClose={() => setIsSearchOpen(false)}
      />
    </>
  );
}
