import type { PlayHistory, PlayerSettings, CacheSettings } from '@/types';

const HISTORY_KEY = 'bismuth_history';
const PLAYER_SETTINGS_KEY = 'bismuth_player';
const CACHE_SETTINGS_KEY = 'bismuth_cache';
const CORS_PROXY_KEY = 'bismuth_proxy';
const DISCLAIMER_AGREED_KEY = 'bismuth_disclaimer_agreed';

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
    playerMode: 'builtin',
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

// 获取CORS代理
export function getCorsProxy(): string {
  return localStorage.getItem(CORS_PROXY_KEY) || 'https://api.codetabs.com/v1/proxy?quest=';
}

// 设置CORS代理
export function setCorsProxy(proxy: string): void {
  localStorage.setItem(CORS_PROXY_KEY, proxy);
}

// 是否启用CORS代理（默认启用）
export function isCorsProxyEnabled(): boolean {
  return localStorage.getItem('bismuth_cors_proxy_enabled') !== 'false';
}

// 设置是否启用CORS代理
export function setCorsProxyEnabled(enabled: boolean): void {
  localStorage.setItem('bismuth_cors_proxy_enabled', String(enabled));
}

// 检查是否已同意免责声明
export function isDisclaimerAgreed(): boolean {
  return localStorage.getItem(DISCLAIMER_AGREED_KEY) === 'true';
}

// 设置免责声明同意状态
export function setDisclaimerAgreed(agreed: boolean): void {
  localStorage.setItem(DISCLAIMER_AGREED_KEY, String(agreed));
}
