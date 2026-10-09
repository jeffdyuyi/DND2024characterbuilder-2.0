'use client';

import ResourceCacheManager from './ResourceCacheManager';
import { Database } from 'lucide-react';
import { useCatalog } from './CatalogProvider';
import styles from './CatalogStatus.module.css';

export default function CatalogStatus({ compact = false }: { compact?: boolean }) {
  const { stats } = useCatalog();
  const label = {
    idle: '待加载',
    loading: '加载中',
    ready: '核心可用',
    partial: '部分可用',
    complete: '完整',
    error: '失败',
  }[stats.status];
  return (
    <details className={`${styles.status} ${compact ? styles.compact : ''}`}>
      <summary aria-label={`数据状态：${label}`} title={compact ? `数据状态：${label}` : undefined}>
        {compact ? <Database size={17} aria-hidden="true" /> : <>数据 · {label}</>}
        {compact && (
          <span
            className={`${styles.statusDot} ${styles[`status_${stats.status}`]}`}
            aria-hidden="true"
          />
        )}
      </summary>
      <div className={styles.panel}>
        <span className={styles.panelTitle}>数据状态</span>
        {Object.entries(stats.sources).map(([name, source]) => (
          <div key={name} className={styles.source}>
            <strong className={styles.sourceName}>
              {name === 'fiveetoolsCn' ? '5etools-cn' : 'tjliqy/homebrew'}：{source.state}
            </strong>
            <div className={styles.sourceRow}>
              文件 {source.loadedFiles}/{source.expectedFiles}，失败 {source.failedFiles}，条目{' '}
              {source.entries}
            </div>
            <div className={styles.sourceRow}>
              缓存 {source.cacheHits || 0}，过期缓存 {source.staleCacheHits || 0}，网络{' '}
              {source.networkRequests || 0}，镜像 {source.mirrorHits || 0}
            </div>
            {source.message && <div className={styles.message}>{source.message}</div>}
          </div>
        ))}
        <p className={styles.refreshHint}>查看下载缓存、同步资源或清理过期文件。</p>
        <ResourceCacheManager />
      </div>
    </details>
  );
}
