import type { PlayHistory, PlayerSettings, CacheSettings } from '@/types';

const HISTORY_KEY = 'bismuth_history';
const PLAYER_SETTINGS_KEY = 'bismuth_player';
const CACHE_SETTINGS_KEY = 'bismuth_cache_settings';
const CORS_PROXY_LIST_KEY = 'bismuth_cors_proxy_list';
const CORS_PROXY_ENABLED_KEY = 'bismuth_cors_proxy_enabled';
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

const DEFAULT_CORS_PROXIES = [
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://api.cors.lol/?url=',
];

// 获取 CORS 代理列表
export function getCorsProxyList(): string[] {
  const stored = localStorage.getItem(CORS_PROXY_LIST_KEY);
  if (stored) {
    try {
      const list = JSON.parse(stored);
      return Array.isArray(list) && list.length > 0 ? list : DEFAULT_CORS_PROXIES;
    } catch {
      return DEFAULT_CORS_PROXIES;
    }
  }
  return DEFAULT_CORS_PROXIES;
}

// 保存 CORS 代理列表
export function setCorsProxyList(proxies: string[]): void {
  localStorage.setItem(CORS_PROXY_LIST_KEY, JSON.stringify(proxies));
}

// 添加单个 CORS 代理（去重）
export function addCorsProxy(proxy: string): void {
  const list = getCorsProxyList();
  if (!list.includes(proxy)) {
    list.push(proxy);
    setCorsProxyList(list);
  }
}

// 删除单个 CORS 代理
export function removeCorsProxy(index: number): void {
  const list = getCorsProxyList();
  if (index >= 0 && index < list.length) {
    list.splice(index, 1);
    if (list.length === 0) list.push(...DEFAULT_CORS_PROXIES);
    setCorsProxyList(list);
  }
}

// 获取当前活跃的 CORS 代理（列表第一个）
export function getCorsProxy(): string {
  const list = getCorsProxyList();
  return list[0] || DEFAULT_CORS_PROXIES[0];
}

// 是否启用 CORS 代理（默认启用）
export function isCorsProxyEnabled(): boolean {
  return localStorage.getItem(CORS_PROXY_ENABLED_KEY) !== 'false';
}

// 设置是否启用 CORS 代理
export function setCorsProxyEnabled(enabled: boolean): void {
  localStorage.setItem(CORS_PROXY_ENABLED_KEY, String(enabled));
}

// 检查是否已同意免责声明
export function isDisclaimerAgreed(): boolean {
  return localStorage.getItem(DISCLAIMER_AGREED_KEY) === 'true';
}

// 设置免责声明同意状态
export function setDisclaimerAgreed(agreed: boolean): void {
  localStorage.setItem(DISCLAIMER_AGREED_KEY, String(agreed));
}
