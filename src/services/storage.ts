import type { PlayHistory, PlayerSettings, CacheSettings } from '@/types';

const HISTORY_KEY = 'bismuth_history';
const PLAYER_SETTINGS_KEY = 'bismuth_player';
const CACHE_SETTINGS_KEY = 'bismuth_cache';
const CORS_PROXY_KEY = 'bismuth_proxy';

// 获取播放历史
export function getPlayHistory(): PlayHistory[] {
  const stored = localStorage.getItem(HISTORY_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return [];
    }
  }
  return [];
}

// 添加播放历史
export function addPlayHistory(history: PlayHistory): void {
  const histories = getPlayHistory();
  const existingIndex = histories.findIndex(h => h.vod_id === history.vod_id);
  
  if (existingIndex >= 0) {
    histories[existingIndex] = history;
  } else {
    histories.unshift(history);
  }
  
  // 最多保留50条
  if (histories.length > 50) {
    histories.pop();
  }
  
  localStorage.setItem(HISTORY_KEY, JSON.stringify(histories));
}

// 删除播放历史
export function removePlayHistory(vodId: number): void {
  const histories = getPlayHistory().filter(h => h.vod_id !== vodId);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(histories));
}

// 清空播放历史
export function clearPlayHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
}

// 获取播放器设置
export function getPlayerSettings(): PlayerSettings {
  const stored = localStorage.getItem(PLAYER_SETTINGS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return getDefaultPlayerSettings();
    }
  }
  return getDefaultPlayerSettings();
}

// 默认播放器设置
function getDefaultPlayerSettings(): PlayerSettings {
  return {
    playerUrl: 'https://ericq521.web.app/ckplayer/?v=',
    autoResume: true
  };
}

// 保存播放器设置
export function savePlayerSettings(settings: PlayerSettings): void {
  localStorage.setItem(PLAYER_SETTINGS_KEY, JSON.stringify(settings));
}

// 获取缓存设置
export function getCacheSettings(): CacheSettings {
  const stored = localStorage.getItem(CACHE_SETTINGS_KEY);
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {
      return { enabled: true };
    }
  }
  return { enabled: true };
}

// 保存缓存设置
export function saveCacheSettings(settings: CacheSettings): void {
  localStorage.setItem(CACHE_SETTINGS_KEY, JSON.stringify(settings));
}

// 获取缓存大小
export async function getCacheSize(): Promise<string> {
  if ('storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      const usage = estimate.usage || 0;
      return formatBytes(usage);
    } catch {
      return '0 B';
    }
  }
  return '0 B';
}

// 清除缓存
export async function clearCache(): Promise<void> {
  if ('caches' in window) {
    const cacheNames = await caches.keys();
    await Promise.all(cacheNames.map(name => caches.delete(name)));
  }
}

// 格式化字节
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

// 获取CORS代理
export function getCorsProxy(): string {
  return localStorage.getItem(CORS_PROXY_KEY) || 'https://api.codetabs.com/v1/proxy?quest=';
}

// 设置CORS代理
export function setCorsProxy(proxy: string): void {
  localStorage.setItem(CORS_PROXY_KEY, proxy);
}
