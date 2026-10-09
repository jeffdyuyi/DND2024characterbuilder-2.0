'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCatalog } from './CatalogProvider';
import { getCatalogStats, initCatalog, loadHomebrewAll } from './catalogLoader';
import {
  CacheInventory,
  clearCache,
  clearExpiredCache,
  getCacheInventory,
  removeCacheFile,
} from './catalogCache';
import styles from './ResourceCacheManager.module.css';

const bytes = (value: number) =>
  value < 1024
    ? `${value} B`
    : value < 1024 ** 2
      ? `${(value / 1024).toFixed(1)} KB`
      : `${(value / 1024 ** 2).toFixed(1)} MB`;
const states: Record<string, string> = {
  idle: '待加载',
  loading: '加载中',
  ready: '可用',
  complete: '完整',
  partial: '部分可用',
  error: '失败',
  disabled: '未启用',
  empty: '无数据',
};

export default function ResourceCacheManager() {
  const { stats, refreshCatalog } = useCatalog();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [inventory, setInventory] = useState<CacheInventory>();
  const [estimate, setEstimate] = useState<StorageEstimate>();
  const [persistent, setPersistent] = useState<boolean>();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [limit, setLimit] = useState(50);
  const [confirmClear, setConfirmClear] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const locked =
    busy ||
    stats.status === 'loading' ||
    Object.values(stats.sources).some((source) => source.state === 'loading');
  const inspect = async () => {
    setInventory(await getCacheInventory());
    const storage = navigator.storage;
    const [usage, retained] = await Promise.allSettled([
      storage?.estimate?.(),
      storage?.persisted?.(),
    ]);
    setEstimate(usage.status === 'fulfilled' ? usage.value : undefined);
    setPersistent(retained.status === 'fulfilled' ? retained.value : undefined);
  };
  const run = async (action: () => Promise<string>) => {
    if (busy) return;
    setBusy(true);
    setMessage('');
    setError('');
    try {
      setMessage(await action());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      try {
        await inspect();
      } catch (cause) {
        setError(`无法读取缓存清单：${String(cause)}`);
        setInventory(undefined);
      }
      setBusy(false);
    }
  };
  useEffect(() => {
    if (!open) return;
    dialog.current?.showModal();
    void run(async () => '');
    // 仅打开时读取清单，避免每个下载事件都扫描全部 JSON。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  const files =
    inventory?.files.filter((file) => file.url.toLowerCase().includes(query.toLowerCase())) || [];
  const total = inventory?.files.reduce((sum, file) => sum + file.bytes, 0) || 0;
  const syncResult = () => {
    const result = getCatalogStats();
    return result.status === 'complete'
      ? '本轮加载结束，请核对下方来源状态。缓存写入失败会单独列出。'
      : '本轮存在未完成或失败的资源。旧缓存已保留，可重试；详见来源状态。';
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>
        资源缓存管理
      </button>
      {open &&
        createPortal(
          <dialog
            ref={dialog}
            className={styles.dialog}
            onClose={() => setOpen(false)}
            aria-labelledby="resource-cache-title"
          >
            <header>
              <h2 id="resource-cache-title">资源缓存管理</h2>
              <button type="button" onClick={() => dialog.current?.close()}>
                关闭
              </button>
            </header>
            <section>
              <h3>浏览器存储</h3>
              <p>
                同源占用估算：{estimate?.usage === undefined ? '不可用' : bytes(estimate.usage)} /
                配额：{estimate?.quota === undefined ? '不可用' : bytes(estimate.quota)}
              </p>
              {estimate?.quota && estimate.usage !== undefined ? (
                <progress aria-label="同源存储占比" max={estimate.quota} value={estimate.usage} />
              ) : null}
              <p>
                项目资源 JSON：{inventory ? bytes(total) : '未读取'} ·{' '}
                {inventory?.files.length ?? '—'} 个文件 ·{' '}
                {inventory?.storage === 'memory'
                  ? '仅内存，本次会话结束后丢失'
                  : inventory
                    ? 'IndexedDB'
                    : '状态未知'}
              </p>
              <p>
                同源估算可能包含此 GitHub Pages 域名下的其他项目；JSON
                大小不含数据库开销，两者口径不同。浏览器 HTTP 缓存不在此清单中。
              </p>
              <div className={styles.actions}>
                <span>
                  离线保留：
                  {persistent === undefined
                    ? '状态不可用'
                    : persistent
                      ? '已获持久存储许可'
                      : '普通缓存，浏览器可能回收'}
                </span>
                <button
                  disabled={busy || persistent === true}
                  onClick={() =>
                    void run(async () => {
                      if (!navigator.storage?.persist) return '此浏览器不支持持久存储申请。';
                      return (await navigator.storage.persist())
                        ? '已获准持久存储，仍受浏览器配额限制。'
                        : '浏览器未批准持久存储，现有缓存仍可使用。';
                    })
                  }
                >
                  申请保留缓存
                </button>
                <button disabled={busy} onClick={() => void run(async () => '')}>
                  刷新统计
                </button>
              </div>
            </section>
            <section>
              <h3>资源同步</h3>
              <p>
                书籍选择控制角色候选范围，不等于按书下载。同步成功的文件才替换旧缓存；失败副本保留。Homebrew
                全量同步可能耗时较长。
              </p>
              {Object.entries(stats.sources).map(([key, source]) => (
                <div key={key} className={styles.source}>
                  <strong>
                    {key === 'fiveetoolsCn' ? '5etools-cn' : 'tjliqy/homebrew'} ·{' '}
                    {states[source.state] || source.state}
                  </strong>
                  <p>
                    文件 {source.loadedFiles}/{source.expectedFiles} · 失败 {source.failedFiles} ·
                    条目 {source.entries}
                  </p>
                  {source.message && <p>{source.message}</p>}
                </div>
              ))}
              <div className={styles.actions}>
                <button
                  disabled={locked}
                  onClick={() =>
                    void run(async () => {
                      await refreshCatalog();
                      return syncResult();
                    })
                  }
                >
                  重新同步主源及扩展索引
                </button>
                <button
                  disabled={locked}
                  onClick={() =>
                    void run(async () => {
                      await initCatalog();
                      return syncResult();
                    })
                  }
                >
                  重试主源加载（复用缓存）
                </button>
                <button
                  disabled={locked}
                  onClick={() =>
                    void run(async () => {
                      await loadHomebrewAll({ refresh: true });
                      return getCatalogStats().sources.homebrew.state === 'complete'
                        ? '扩展全量同步结束。'
                        : '扩展仍有未完成资源，请查看来源状态；旧缓存保留。';
                    })
                  }
                >
                  同步 Homebrew 全量
                </button>
                <button
                  disabled={locked}
                  onClick={() =>
                    void run(async () => {
                      await loadHomebrewAll();
                      return getCatalogStats().sources.homebrew.state === 'complete'
                        ? '扩展加载结束。'
                        : '扩展仍未完整，请查看来源状态。';
                    })
                  }
                >
                  重试扩展（复用缓存）
                </button>
              </div>
            </section>
            <section>
              <h3>本项目缓存文件</h3>
              <p>
                清理只操作项目规则资源库，保留角色存档与用户原创资料。当前页面已载入的数据仍在内存中；刷新页面后重新加载，后台请求也可能重新写入缓存。清理会减少离线可用资源。
              </p>
              <div className={styles.actions}>
                <button
                  disabled={locked || !inventory}
                  onClick={() =>
                    void run(async () => `已清理 ${await clearExpiredCache()} 个过期文件。`)
                  }
                >
                  清理过期缓存
                </button>
                <button disabled={locked || !inventory} onClick={() => setConfirmClear(true)}>
                  清理全部资源缓存…
                </button>
              </div>
              {confirmClear && (
                <div className={styles.actions}>
                  <span>确认清理本项目所有规则资源缓存？下次使用需重新下载。</span>
                  <button
                    disabled={locked}
                    onClick={() =>
                      void run(async () => {
                        await clearCache();
                        setConfirmClear(false);
                        return '本项目资源缓存已清理，角色存档未修改。';
                      })
                    }
                  >
                    确认清理
                  </button>
                  <button onClick={() => setConfirmClear(false)}>取消</button>
                </div>
              )}
              <input
                type="search"
                aria-label="搜索缓存文件"
                placeholder="搜索文件路径"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setLimit(50);
                }}
              />
              <div className={styles.files}>
                {files.slice(0, limit).map((file) => (
                  <div key={file.url} className={styles.file}>
                    <code>{file.url}</code>
                    <p>
                      {bytes(file.bytes)} · {file.expired ? '过期／版本失效' : '有效'} ·{' '}
                      {Number.isFinite(file.cachedAt)
                        ? new Date(file.cachedAt).toLocaleString('zh-CN')
                        : '时间未知'}
                    </p>
                    <small>修订：{file.revision || '未知'}</small>
                    <button
                      disabled={locked}
                      onClick={() =>
                        void run(async () => {
                          await removeCacheFile(file.url);
                          return '已删除该文件缓存，角色选择保留。';
                        })
                      }
                    >
                      删除缓存
                    </button>
                  </div>
                ))}
                {!files.length && (
                  <p>{inventory ? '没有匹配的缓存文件。' : '尚未取得缓存清单。'}</p>
                )}
              </div>
              {files.length > limit && (
                <button onClick={() => setLimit(limit + 50)}>
                  显示更多（已显示 {limit}/{files.length}）
                </button>
              )}
              {!!inventory?.writeFailures.length && (
                <div role="alert">
                  <h3>未持久保存的文件</h3>
                  {inventory.writeFailures.map((failure) => (
                    <p key={failure.url}>
                      {failure.url}：{failure.message}
                    </p>
                  ))}
                </div>
              )}
            </section>
            {busy && <p role="status">正在处理，请稍候…</p>}
            {message && <p role="status">{message}</p>}
            {error && <p role="alert">{error}</p>}
          </dialog>,
          document.body,
        )}
    </>
  );
}
