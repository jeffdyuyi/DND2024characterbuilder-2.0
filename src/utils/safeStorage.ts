// 安全存储引擎：针对 localStorage 写入提供配额检查、权限异常捕获与失败广播机制
import { StateStorage } from 'zustand/middleware';

export type StorageFailureReason = 'quota' | 'unavailable';

export interface StorageFailure {
  key: string;
  reason: StorageFailureReason;
  bytes: number;
  at: number;
  message?: string;
}

type FailureListener = (failure: StorageFailure) => void;

const failureListeners = new Set<FailureListener>();
let lastFailure: StorageFailure | null = null;

export function isQuotaExceeded(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const e = err as { name?: string; code?: number };
  return (
    e.name === 'QuotaExceededError' ||
    e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    e.code === 22 ||
    e.code === 1014
  );
}

function broadcastFailure(key: string, reason: StorageFailureReason, bytes: number, err: unknown) {
  const failure: StorageFailure = {
    key,
    reason,
    bytes,
    at: Date.now(),
    message: err instanceof Error ? err.message : String(err),
  };
  lastFailure = failure;
  failureListeners.forEach((fn) => {
    try {
      fn(failure);
    } catch {
      // 保证单个订阅方异常不影响其他监听者
    }
  });
}

/** 订阅存储写入异常 */
export function subscribeStorageFailure(fn: FailureListener): () => void {
  failureListeners.add(fn);
  return () => {
    failureListeners.delete(fn);
  };
}

/** 获取最近一次写入失败快照 */
export function getLastStorageFailure(): StorageFailure | null {
  return lastFailure;
}

/** 清理失败记录 */
export function clearLastStorageFailure(): void {
  lastFailure = null;
}

/** 获取 localStorage 占用字节统计（UTF-16 码元估算） */
export function getStorageUsage(): { usedBytes: number; keysCount: number; available: boolean } {
  if (typeof window === 'undefined' || !window.localStorage) {
    return { usedBytes: 0, keysCount: 0, available: false };
  }
  try {
    let used = 0;
    const len = window.localStorage.length;
    for (let i = 0; i < len; i++) {
      const k = window.localStorage.key(i);
      if (k) {
        const v = window.localStorage.getItem(k) ?? '';
        used += (k.length + v.length) * 2; // UTF-16 字节估算
      }
    }
    return { usedBytes: used, keysCount: len, available: true };
  } catch {
    return { usedBytes: 0, keysCount: 0, available: false };
  }
}

/** 独立安全的 setItem 调用 */
export function safeSetItem(key: string, value: string): boolean {
  if (typeof window === 'undefined' || !window.localStorage) {
    return false;
  }
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch (err) {
    const reason = isQuotaExceeded(err) ? 'quota' : 'unavailable';
    const bytes = (key.length + value.length) * 2;
    broadcastFailure(key, reason, bytes, err);
    return false;
  }
}

/** 供 Zustand persist 使用的 safeStateStorage */
export const safeLocalStorage: StateStorage = {
  getItem: (name: string): string | null => {
    if (typeof window === 'undefined' || !window.localStorage) return null;
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: string): void => {
    safeSetItem(name, value);
  },
  removeItem: (name: string): void => {
    if (typeof window === 'undefined' || !window.localStorage) return;
    try {
      window.localStorage.removeItem(name);
    } catch {
      // 忽略移除时的静默异常
    }
  },
};
