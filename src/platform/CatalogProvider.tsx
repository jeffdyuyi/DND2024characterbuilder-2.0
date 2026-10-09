'use client';

/**
 * 目录数据上下文与提供者 (CatalogProvider)
 * 对应《5etools全量数据接入与引擎保留实施路线图》Phase A-3
 *
 * 持有状态：idle | loading | ready | partial | complete | error
 * 首批数据 (Core: 种族/背景/专长/职业) 到达后立即开放交互，
 * 次批（法术）与末批（物品）在后台静默就绪，卡面顶部带有优雅的状态微动效。
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { useCharacterStore } from '@/store/characterStore';
import { clearCache } from './catalogCache';
import {
  CatalogStats,
  CatalogStatus,
  getCatalogStats,
  initCatalog,
  subscribeCatalog,
} from './catalogLoader';

interface CatalogContextType {
  stats: CatalogStats;
  status: CatalogStatus;
  isReady: boolean;
  isComplete: boolean;
  retry: () => Promise<void>;
  refreshCatalog: () => Promise<void>;
}

const CatalogContext = createContext<CatalogContextType>({
  stats: getCatalogStats(),
  status: 'idle',
  isReady: true,
  isComplete: false,
  retry: async () => {},
  refreshCatalog: async () => {},
});

export function useCatalog() {
  return useContext(CatalogContext);
}

export function CatalogProvider({ children }: { children: React.ReactNode }) {
  const [stats, setStats] = useState<CatalogStats>(() => getCatalogStats());

  useEffect(() => {
    // 订阅加载状态变更
    const unsubscribe = subscribeCatalog((newStats) => {
      setStats(newStats);
    });

    // 启动数据总线
    initCatalog().catch((err) => {
      console.error('[CatalogProvider] 初始化加载失败:', err);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (stats.status === 'ready' || stats.status === 'complete') {
      useCharacterStore.getState().migrateCatalogReferences();
    }
  }, [stats.status]);

  const handleRetry = async () => {
    await initCatalog({ force: true });
  };

  const handleCatalogRefresh = async () => {
    // Catalog 使用独立 IndexedDB；角色存档位于 Local Storage，不在清理范围内。
    await clearCache();
    // 重载页面以清空内存 Catalog，随后初始化流程会从双远程数据源重新拉取。
    window.location.reload();
  };

  const isReady =
    stats.status === 'ready' ||
    stats.status === 'partial' ||
    stats.status === 'complete' ||
    stats.coreLoaded;
  const isComplete = stats.status === 'complete';

  return (
    <CatalogContext.Provider
      value={{
        stats,
        status: stats.status,
        isReady,
        isComplete,
        retry: handleRetry,
        refreshCatalog: handleCatalogRefresh,
      }}
    >
      {/* 顶部数据流状态指示器 (微动效，完成后平滑隐入) */}
      <div className="catalog-status-bar fixed top-0 left-0 right-0 z-50 pointer-events-none">
        {stats.status === 'loading' && (
          <div className="h-0.5 bg-gradient-to-r from-amber-600 via-amber-400 to-amber-200 animate-pulse transition-all duration-300 w-full" />
        )}
        {(stats.status === 'ready' || stats.status === 'partial') && !isComplete && (
          <div className="h-0.5 bg-gradient-to-r from-indigo-500 via-purple-400 to-amber-400 transition-all duration-500 w-full opacity-70" />
        )}
      </div>
      {/* 如果遇到致命错误且没有任何兜底数据 */}
      {stats.status === 'error' && !isReady ? (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-950 text-slate-100">
          <div className="max-w-md w-full bg-slate-900/90 border border-red-500/30 rounded-xl p-6 shadow-2xl backdrop-blur-md text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-950/60 border border-red-500/40 text-red-400 flex items-center justify-center mx-auto text-xl font-bold">
              !
            </div>
            <h2 className="text-lg font-semibold text-slate-100">5etools 数据总线初始化失败</h2>
            <p className="text-sm text-slate-400">
              {stats.error || '无法从数据源拉取核心规则数据，且本地离线缓存未命中。'}
            </p>
            <button
              onClick={handleRetry}
              className="pointer-events-auto px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white text-sm font-medium rounded-lg transition-colors shadow-lg shadow-amber-900/20"
            >
              重新连接拉取
            </button>
          </div>
        </div>
      ) : (
        children
      )}
    </CatalogContext.Provider>
  );
}
