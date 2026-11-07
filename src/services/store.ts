// 通用本地存储订阅基础设施
// 配合 React useSyncExternalStore，让设置变更在同标签页内实时反映（P1#9）。
//
// 背景：window 的 'storage' 事件只在「其他标签页」写入时触发，同标签页 setItem 不会通知；
// 且 useSyncExternalStore 要求 getSnapshot 在数据未变时返回「稳定引用」，直接每次 JSON.parse
// 会产生新对象导致无限重渲染。这里用「每个 store 独立的监听器 + 快照缓存」解决这两个问题，
// 并让局部写入只通知对应 store，不打扰其他订阅者。

import { useSyncExternalStore } from 'react';

type Listener = () => void;
type Emit = () => void;

// 全部 store 的局部 emit，用于全局通知（跨标签 storage 事件 / 手动 notifyStorageChange）
const allStores = new Set<Emit>();

function emitAll(): void {
  allStores.forEach((e) => e());
}

// 跨标签页同步：其他标签页写入时浏览器会派发 storage 事件
if (typeof window !== 'undefined') {
  window.addEventListener('storage', emitAll);
}

/** 同标签页写入 localStorage 后手动调用，通知所有 store 的订阅者 */
export function notifyStorageChange(): void {
  emitAll();
}

export interface StorageStore<T> {
  /** 读取当前值（带缓存，数据未变时引用稳定） */
  getValue: () => T;
  /** 写入并通知本 store 的订阅者 */
  setValue: (value: T) => void;
  /** 仅清空本 store 缓存并通知其订阅者（高频局部写入用，不影响其他 store） */
  notify: () => void;
  /** React 订阅 hook：挂载后本 store 变更会自动重渲染 */
  useValue: () => T;
}

/**
 * 创建一个绑定到特定存储键的外部 store。
 * @param _key 存储键标识（仅作文档/调试标识，缓存按 store 实例隔离）
 * @param read 纯读取函数（无副作用，负责解析与默认值合并）
 * @param write 写入函数（负责写 localStorage，不需要再手动通知）
 */
export function createStorageStore<T>(
  _key: string,
  read: () => T,
  write: (value: T) => void,
): StorageStore<T> {
  const keyListeners = new Set<Listener>();
  let cache: T;
  let hasCache = false;

  const getValue = (): T => {
    if (!hasCache) {
      cache = read();
      hasCache = true;
    }
    return cache;
  };

  const emit = (): void => {
    hasCache = false; // 清空本 store 缓存，下次读取拿到新值
    keyListeners.forEach((l) => l());
  };
  allStores.add(emit);

  const subscribe = (listener: Listener): (() => void) => {
    keyListeners.add(listener);
    return () => keyListeners.delete(listener);
  };

  const setValue = (value: T): void => {
    write(value);
    emit();
  };

  const useValue = (): T => useSyncExternalStore(subscribe, getValue);

  return { getValue, setValue, notify: emit, useValue };
}
