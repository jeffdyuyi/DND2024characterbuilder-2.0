'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  defaultCatalog,
  getLoadedSourceBooks,
  sourceBookKey,
  validateSourceSelection,
} from '@/catalog';
import { getSourceDisplayName } from '@/config/sourceMapping';
import type { SourceSelection, SourceBook } from '@/types/sourceSelection';
import { useCatalog } from '@/platform/CatalogProvider';
import { getCatalogStats, loadHomebrewAll } from '@/platform/catalogLoader';
import styles from './SourceBookPicker.module.css';
import {
  exportSourceSettings,
  importSourceSettings,
  groupSourceBooks,
  toggleSourceGroup,
  type SourceBookSummary,
} from '@/catalog/sourceSettings';
import { getCacheInventory, type CacheInventory } from '@/platform/catalogCache';
import ResourceCacheManager from '@/platform/ResourceCacheManager';

export interface SourceBookSettings {
  sourceSelection?: SourceSelection;
  allowHomebrew?: boolean;
}

export default function SourceBookPicker({
  value,
  onChange,
}: {
  value: SourceBookSettings;
  onChange: (value: { sourceSelection: SourceSelection; allowHomebrew: boolean }) => void;
}) {
  const { stats, isComplete } = useCatalog();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [configCode, setConfigCode] = useState('');
  const [configMessage, setConfigMessage] = useState('');
  const [configError, setConfigError] = useState('');
  const [cache, setCache] = useState<CacheInventory>();
  const [cacheError, setCacheError] = useState('');
  const [cacheBusy, setCacheBusy] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const brewStatus = stats.sources.homebrew;
  const brewBusy = loading || brewStatus.state === 'loading';
  const brewStates: Record<string, string> = {
    idle: '尚未加载',
    loading: '加载中',
    ready: '索引已就绪',
    complete: '加载完成',
    partial: '部分可用',
    error: '加载失败',
    empty: '无可用条目',
    disabled: '数据源未启用',
  };
  let selection: SourceSelection;
  try {
    selection = validateSourceSelection(value.sourceSelection || { mode: 'all' });
  } catch {
    selection = { mode: 'selected', books: [] };
  }
  const loaded = useMemo(() => getLoadedSourceBooks(defaultCatalog), [stats]);
  const books: SourceBookSummary[] = [...loaded];
  if (selection.mode === 'selected')
    for (const book of selection.books) {
      if (!books.some((b) => sourceBookKey(b) === sourceBookKey(book))) {
        books.push({
          ...book,
          isHomebrew: book.sourcePackId.toLowerCase().startsWith('homebrew'),
          entryCount: 0,
        });
      }
    }
  const selectedKeys = new Set(
    selection.mode === 'selected' ? selection.books.map(sourceBookKey) : books.map(sourceBookKey),
  );
  const summary = selection.mode === 'all' ? '全部允许书籍' : `已选 ${selection.books.length} 本书`;
  const update = (sourceSelection: SourceSelection, allowHomebrew = Boolean(value.allowHomebrew)) =>
    onChange({ sourceSelection, allowHomebrew });
  const inspectCache = async () => {
    setCacheBusy(true);
    setCacheError('');
    try {
      setCache(await getCacheInventory());
    } catch {
      setCache(undefined);
      setCacheError('无法读取缓存清单，请在资源缓存管理中重试。');
    } finally {
      setCacheBusy(false);
    }
  };
  const groups = groupSourceBooks(books);
  const queryText = query.trim().toLowerCase();
  const matchesQuery = (book: SourceBookSummary) =>
    `${getSourceDisplayName(book.source)} ${book.source} ${book.sourcePackId}`
      .toLowerCase()
      .includes(queryText);
  const toggle = (book: SourceBook, checked: boolean) => {
    const current = selection.mode === 'selected' ? selection.books : books;
    update({
      mode: 'selected',
      books: checked
        ? [...current, book]
        : current.filter((b) => sourceBookKey(b) !== sourceBookKey(book)),
    });
  };
  const loadBrew = async () => {
    if (brewBusy) return;
    setLoading(true);
    setError('');
    try {
      await loadHomebrewAll();
      const result = getCatalogStats().sources.homebrew;
      if (result.state === 'partial' || result.state === 'error' || result.state === 'empty') {
        setError('第三方书目尚不完整，已成功载入的资源仍可使用；可重试或查看侧栏数据状态。');
      }
    } catch {
      setError('第三方资源加载失败，可重试；已有选择会保留。');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (open) {
      dialog.current?.showModal();
      void inspectCache();
    }
  }, [open]);
  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        aria-haspopup="dialog"
      >
        本角色可用资料 · {summary} · 第三方{value.allowHomebrew ? '开' : '关'}
      </button>
      {open &&
        createPortal(
          <dialog
            ref={dialog}
            className={styles.dialog}
            aria-labelledby="source-books-title"
            onClose={(event) => {
              if (event.target === event.currentTarget) setOpen(false);
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className={styles.header}>
              <h2 id="source-books-title">本角色可用资料</h2>
              <button
                type="button"
                onClick={() => dialog.current?.close()}
                aria-label="关闭书籍选择"
              >
                关闭
              </button>
            </div>
            <p>
              控制建卡候选范围。关闭书籍不会删除已有选择，也不会清除缓存；2014 与 2024
              规则仍可分别选择。
            </p>
            <details className={styles.config}>
              <summary>来源配置码 · 导入 / 导出</summary>
              <p>只共享书籍范围和第三方开关，不包含角色、规则正文或缓存。导入不会自动下载。</p>
              <textarea
                aria-label="来源配置码"
                value={configCode}
                onChange={(event) => {
                  setConfigCode(event.target.value);
                  setConfigError('');
                  setConfigMessage('');
                }}
                placeholder="生成配置码，或粘贴其他玩家分享的配置"
                rows={5}
              />
              <div className={styles.controls}>
                <button
                  type="button"
                  onClick={() => {
                    setConfigError('');
                    try {
                      setConfigCode(exportSourceSettings(value));
                      setConfigMessage('配置码已生成。');
                    } catch {
                      setConfigError('当前来源配置无效，无法导出，请重新选择。');
                    }
                  }}
                >
                  生成配置码
                </button>
                <button
                  type="button"
                  disabled={!configCode.trim()}
                  onClick={async () => {
                    setConfigError('');
                    try {
                      await navigator.clipboard.writeText(configCode);
                      setConfigMessage('配置码已复制。');
                    } catch {
                      setConfigError('无法自动复制，请手动选中配置码复制。');
                    }
                  }}
                >
                  复制
                </button>
                <button
                  type="button"
                  disabled={!configCode.trim()}
                  onClick={() => {
                    setConfigMessage('');
                    setConfigError('');
                    try {
                      const settings = importSourceSettings(configCode);
                      onChange(settings);
                      setConfigMessage('配置已应用；未载入来源会保留，可另行加载资料。');
                    } catch (cause) {
                      setConfigError(
                        cause instanceof Error ? cause.message : '配置无效，原选择已保留。',
                      );
                    }
                  }}
                >
                  应用配置码
                </button>
              </div>
              {configMessage && <p role="status">{configMessage}</p>}
              {configError && <p role="alert">{configError}</p>}
            </details>
            <div className={styles.controls}>
              <label>
                <input
                  type="radio"
                  name="source-mode"
                  checked={selection.mode === 'all'}
                  onChange={() => update({ mode: 'all' })}
                />
                全部允许（含后续加载书籍）
              </label>
              <label>
                <input
                  type="radio"
                  name="source-mode"
                  checked={selection.mode === 'selected'}
                  onChange={() =>
                    update({
                      mode: 'selected',
                      books: loaded.filter((b) => !b.isHomebrew || value.allowHomebrew),
                    })
                  }
                />
                指定书籍
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={Boolean(value.allowHomebrew)}
                  onChange={(event) => {
                    update(selection, event.target.checked);
                    if (event.target.checked) void loadBrew();
                  }}
                />
                第三方扩展 / Homebrew
              </label>
            </div>
            <div className={styles.controls}>
              <input
                type="search"
                aria-label="搜索书籍"
                placeholder="搜索书名或出处代码"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <button type="button" onClick={() => update({ mode: 'selected', books: [] })}>
                清空书籍选择
              </button>
            </div>
            <p>书目来自当前已加载资源。勾选书籍只改变可用范围，不代表单独下载或删除该书。</p>
            <section className={styles.brewStatus} aria-label="离线资源状态">
              <strong>离线资源 · 文件缓存</strong>
              {cache ? (
                <p>
                  {cache.storage === 'indexeddb' ? '已保存至浏览器' : '仅本次会话内存'} ·{' '}
                  {cache.files.length} 个文件，其中{' '}
                  {cache.files.filter((file) => !file.expired).length} 个有效，{' '}
                  {cache.files.filter((file) => file.expired).length} 个过期或版本失效。{' '}
                  {cache.writeFailures.length > 0 &&
                    `${cache.writeFailures.length} 个文件未持久保存。`}
                </p>
              ) : (
                <p role="status">{cacheBusy ? '正在读取缓存清单…' : '尚未读取缓存清单。'}</p>
              )}
              <p>
                清单在打开时读取，可手动刷新。文件缓存与本角色使用权限分别保存；条目已载入不代表书籍依赖全部解析成功，也不保证断网重开网站。
              </p>
              <div className={styles.controls}>
                <button type="button" disabled={cacheBusy} onClick={() => void inspectCache()}>
                  {cacheBusy ? '读取中…' : '刷新缓存状态'}
                </button>
                <ResourceCacheManager />
              </div>
              {cacheError && <p role="alert">{cacheError}</p>}
            </section>
            {!isComplete && (
              <p role="status">资源尚未全部就绪，书目会随加载更新；未载入的已选书籍会保留。</p>
            )}
            <section className={styles.brewStatus} aria-label="第三方资料加载状态">
              <strong>第三方资料 · {brewStates[brewStatus.state] || brewStatus.state}</strong>
              <p role="status">
                {brewStatus.message ||
                  (brewStatus.entries > 0
                    ? '已载入资源可在下方选择。'
                    : '尚未载入第三方内容。启用第三方只控制使用权限，书目需加载后生成。')}
              </p>
              <p>
                文件成功 {brewStatus.loadedFiles}/{brewStatus.expectedFiles} · 失败{' '}
                {brewStatus.failedFiles} · 已注册 {brewStatus.entries} 条
              </p>
              {brewStatus.state === 'loading' && brewStatus.expectedFiles > 0 && (
                <progress
                  aria-label="第三方文件处理进度"
                  max={brewStatus.expectedFiles}
                  value={brewStatus.loadedFiles + brewStatus.failedFiles}
                />
              )}
              {!value.allowHomebrew && (
                <p>本角色未启用第三方资料；仍可下载资源，启用顶部第三方开关后才能用于此角色。</p>
              )}
              <button type="button" disabled={brewBusy} onClick={() => void loadBrew()}>
                {brewBusy
                  ? '正在加载…'
                  : brewStatus.state === 'error' || brewStatus.state === 'partial'
                    ? '重试加载第三方资料'
                    : '加载第三方资料（复用缓存）'}
              </button>
            </section>
            {error && (
              <p role="alert">
                {error}
                <button type="button" disabled={brewBusy} onClick={() => void loadBrew()}>
                  重试
                </button>
              </p>
            )}
            <div className={styles.books}>
              {groups.map((group) => {
                const visible = group.books.filter(matchesQuery);
                const eligible = group.books.filter(
                  (book) => !book.isHomebrew || value.allowHomebrew,
                );
                const selectedCount = group.books.filter((book) =>
                  selectedKeys.has(sourceBookKey(book)),
                ).length;
                const enabledSelected = eligible.filter((book) =>
                  selectedKeys.has(sourceBookKey(book)),
                ).length;
                if (queryText && !visible.length) return null;
                return (
                  <details
                    key={`${group.id}:${queryText ? 'search' : 'browse'}`}
                    className={styles.group}
                    open={Boolean(queryText) || group.id === 'official'}
                  >
                    <summary>
                      <span>
                        {group.label} · 已选 {selectedCount}/{group.books.length}
                      </span>
                    </summary>
                    <div className={styles.controls}>
                      <label>
                        <input
                          type="checkbox"
                          aria-label={`选择${group.label}全部书籍`}
                          disabled={!eligible.length}
                          checked={eligible.length > 0 && enabledSelected === eligible.length}
                          ref={(element) => {
                            if (element)
                              element.indeterminate =
                                enabledSelected > 0 && enabledSelected < eligible.length;
                          }}
                          onChange={(event) =>
                            update(
                              toggleSourceGroup(selection, books, eligible, event.target.checked),
                            )
                          }
                        />
                        本组全选（{eligible.length} 本可选书籍）
                      </label>
                      {queryText && (
                        <span>
                          搜索显示 {visible.length}/{group.books.length} 本；全选仍作用于整个分组。
                        </span>
                      )}
                    </div>
                    <div className={styles.grid}>
                      {visible.map((book) => {
                        const selected = selectedKeys.has(sourceBookKey(book));
                        const permitted =
                          selected && (!book.isHomebrew || Boolean(value.allowHomebrew));
                        return (
                          <label className={styles.book} key={sourceBookKey(book)}>
                            <input
                              type="checkbox"
                              disabled={book.isHomebrew && !value.allowHomebrew}
                              checked={selected}
                              onChange={(event) => toggle(book, event.target.checked)}
                            />
                            <span>
                              {getSourceDisplayName(book.source)}
                              <small>
                                {book.source} · {book.sourcePackId}
                              </small>
                              <small>
                                本角色：
                                {permitted
                                  ? '允许使用'
                                  : book.isHomebrew && !value.allowHomebrew
                                    ? '第三方权限关闭'
                                    : '未选择'}
                              </small>
                              <small>
                                目录状态：
                                {book.entryCount
                                  ? `已载入 ${book.entryCount} 条`
                                  : '尚未载入，选择已保留'}
                              </small>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
              {queryText && !books.some(matchesQuery) && <p>没有匹配的书籍，请调整搜索词。</p>}
              {books.length === 0 && <p>暂无已加载书籍，请等待数据加载。</p>}
            </div>
            <p className={styles.footer}>
              {summary}；修改立即应用；新建时随角色保存。
              <button type="button" onClick={() => dialog.current?.close()}>
                完成
              </button>
            </p>
          </dialog>,
          document.body,
        )}
    </>
  );
}
