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
  const books = [...loaded];
  if (selection.mode === 'selected')
    for (const book of selection.books) {
      if (!books.some((b) => sourceBookKey(b) === sourceBookKey(book))) {
        books.push({
          ...book,
          isHomebrew: book.sourcePackId.startsWith('homebrew'),
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
    if (open) dialog.current?.showModal();
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
            onClose={() => setOpen(false)}
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
              {[false, true].map((brew) => (
                <fieldset key={String(brew)} disabled={brew && !value.allowHomebrew}>
                  <legend>
                    {brew ? '第三方资料' : '官方资料'} ·{' '}
                    {books.filter((book) => book.isHomebrew === brew).length} 本
                  </legend>
                  <div className={styles.grid}>
                    {books
                      .filter(
                        (book) =>
                          book.isHomebrew === brew &&
                          `${getSourceDisplayName(book.source)} ${book.source} ${book.sourcePackId}`
                            .toLowerCase()
                            .includes(query.toLowerCase()),
                      )
                      .map((book) => (
                        <label className={styles.book} key={sourceBookKey(book)}>
                          <input
                            type="checkbox"
                            checked={selectedKeys.has(sourceBookKey(book))}
                            onChange={(event) => toggle(book, event.target.checked)}
                          />
                          <span>
                            {getSourceDisplayName(book.source)}{' '}
                            <small>
                              {book.source} · {book.sourcePackId} ·{' '}
                              {book.entryCount ? `${book.entryCount} 条` : '尚未载入'}
                            </small>
                          </span>
                        </label>
                      ))}
                  </div>
                  {!books.some((book) => book.isHomebrew === brew) && (
                    <p>
                      {brew
                        ? brewBusy
                          ? '正在加载，下载与依赖解析完成后将在此生成书籍卡片。'
                          : '尚无已加载的第三方书目，请查看上方状态并加载资料。'
                        : '暂无已加载的官方书目。'}
                    </p>
                  )}
                  {books.some((book) => book.isHomebrew === brew) &&
                    !books.some(
                      (book) =>
                        book.isHomebrew === brew &&
                        `${getSourceDisplayName(book.source)} ${book.source} ${book.sourcePackId}`
                          .toLowerCase()
                          .includes(query.toLowerCase()),
                    ) && <p>没有匹配的书籍，请调整搜索词。</p>}
                </fieldset>
              ))}
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
