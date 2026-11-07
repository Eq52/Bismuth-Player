// 通用本地存储订阅基础设施
// 配合 React useSyncExternalStore，让设置变更在同标签页内实时反映（P1#9）。
//
// 背景：window 的 'storage' 事件只在「其他标签页」写入时触发，同标签页 setItem 不会通知；
// 且 useSyncExternalStore 要求 getSnapshot 在数据未变时返回「稳定引用」，直接每次 JSON.parse
// 会产生新对象导致无限重渲染。这里用内部监听器 + 快照缓存解决这两个问题。

import { useSyncExternalStore } from 'react';

type Listener = () => void;

const listeners = new Set<Listener>();
// 快照缓存：key -> 解析后的值；任何写入后整体清空，保证下次读取拿到新值，未变期间引用稳定
const snapshotCache = new Map<string, unknown>();

function emitChange(): void {
  snapshotCache.clear();
  listeners.forEach((l) => l());
}

// 跨标签页同步：其他标签页写入时浏览器会派发 storage 事件
if (typeof window !== 'undefined') {
  window.addEventListener('storage', emitChange);
}

function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** 同标签页写入 localStorage 后手动调用，通知所有订阅者 */
export function notifyStorageChange(): void {
  emitChange();
}

export interface StorageStore<T> {
  /** 读取当前值（带缓存，数据未变时引用稳定） */
  getValue: () => T;
  /** 写入并通知所有订阅者 */
  setValue: (value: T) => void;
  /** React 订阅 hook：挂载后设置变更会自动重渲染 */
  useValue: () => T;
}

/**
 * 创建一个绑定到特定存储键的外部 store。
 * @param key 缓存标识（通常与 localStorage 键一致）
 * @param read 纯读取函数（无副作用，负责解析与默认值合并）
 * @param write 写入函数（负责写 localStorage，不需要再手动通知）
 */
export function createStorageStore<T>(
  key: string,
  read: () => T,
  write: (value: T) => void,
): StorageStore<T> {
  const getValue = (): T => {
    if (!snapshotCache.has(key)) {
      snapshotCache.set(key, read());
    }
    return snapshotCache.get(key) as T;
  };

  const setValue = (value: T): void => {
    write(value);
    emitChange();
  };

  const useValue = (): T => useSyncExternalStore(subscribe, getValue);

  return { getValue, setValue, useValue };
}
