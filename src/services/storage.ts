import type { PlayHistory, PlayerSettings, CacheSettings, FavoriteItem } from '@/types';
import { createStorageStore, notifyStorageChange } from '@/services/store';

const HISTORY_KEY = 'bismuth_history';
const PLAYER_SETTINGS_KEY = 'bismuth_player';
const CACHE_SETTINGS_KEY = 'bismuth_cache_settings';
const CORS_PROXY_LIST_KEY = 'bismuth_cors_proxy_list';
const CORS_PROXY_ENABLED_KEY = 'bismuth_cors_proxy_enabled';
const DISCLAIMER_AGREED_KEY = 'bismuth_disclaimer_agreed';
const FAVORITES_KEY = 'bismuth_favorites';

// 与 api.ts 中 SOURCES_KEY 保持一致（此处直读 localStorage，避免循环依赖）
const SOURCES_KEY = 'bismuth_video_sources';

// 源被删除后，对应历史/收藏条目的保留窗口（30 分钟后物理删除）
const PENDING_DELETE_TTL = 30 * 60 * 1000;

// 检查指定影视源是否仍存在（老数据无 sourceId 视为存活）
function isSourceAlive(sourceId: string): boolean {
  if (!sourceId) return true;
  try {
    const raw = localStorage.getItem(SOURCES_KEY);
    if (!raw) return false;
    const sources = JSON.parse(raw);
    return Array.isArray(sources) && sources.some((s: { id: string }) => s.id === sourceId);
  } catch {
    return true; // 数据异常时不误删
  }
}

// 清理接口：为条目补待清理标记 / 超时物理删除
interface PurgeableItem {
  sourceId?: string;
  pendingDeleteAt?: number;
}

function purgeStaleItems<T extends PurgeableItem>(items: T[], persist: (items: T[]) => void): T[] {
  const now = Date.now();
  let changed = false;
  const result: T[] = [];

  for (const item of items) {
    if (!isSourceAlive(item.sourceId || '')) {
      if (!item.pendingDeleteAt) {
        // 首次发现源缺失：打上待清理标记（30 分钟保留窗口）
        item.pendingDeleteAt = now;
        changed = true;
      } else if (now - item.pendingDeleteAt > PENDING_DELETE_TTL) {
        // 超过保留窗口：物理删除
        changed = true;
        continue;
      }
    } else if (item.pendingDeleteAt) {
      // 源已恢复（同 ID 重新添加）：清除待清理标记，条目救回
      // 不清除会导致红标永久残留，且残留的过期时间戳会让二次删源跳过 30 分钟宽限
      delete item.pendingDeleteAt;
      changed = true;
    }
    result.push(item);
  }

  if (changed) persist(result);
  return result;
}

// 获取播放历史（读取时顺带执行源缺失清理：打标记/超时删除）
export function getPlayHistory(): PlayHistory[] {
  const stored = localStorage.getItem(HISTORY_KEY);
  if (stored) {
    try {
      const history = JSON.parse(stored) as PlayHistory[];
      if (!Array.isArray(history)) return [];
      return purgeStaleItems(history, (items) => {
        if (items.length > 0) {
          localStorage.setItem(HISTORY_KEY, JSON.stringify(items));
        } else {
          localStorage.removeItem(HISTORY_KEY);
        }
      });
    } catch {
      return [];
    }
  }
  return [];
}

// 条目身份匹配：不同影视源可能出现相同 vod_id，
// 因此除 vod_id 外还需匹配 sourceId（双方均无 sourceId 的老数据视为同一条）
function isSameEntry(aSourceId: string | undefined, bSourceId: string | undefined): boolean {
  return (aSourceId || '') === (bSourceId || '');
}

// 添加播放历史
export function addPlayHistory(history: PlayHistory): void {
  const histories = getPlayHistory();
  const existingIndex = histories.findIndex(
    h => h.vod_id === history.vod_id && isSameEntry(h.sourceId, history.sourceId)
  );

  if (existingIndex >= 0) {
    histories[existingIndex] = history;
  } else {
    // 老数据（无 sourceId）的同 vod_id 条目已被新记录取代，一并移除避免重复卡片
    const upgraded = histories.filter(
      h => !(h.vod_id === history.vod_id && !(h.sourceId || '').trim())
    );
    upgraded.unshift(history);
    histories.length = 0;
    histories.push(...upgraded);
  }

  // 最多保留指定条数（默认 50，可在播放器设置中调整）
  const limit = getHistoryLimit();
  while (histories.length > limit) {
    histories.pop();
  }

  localStorage.setItem(HISTORY_KEY, JSON.stringify(histories));
  notifyStorageChange();
}

// 删除播放历史（sourceId 缺省时删除该 vod_id 的所有条目）
export function removePlayHistory(vodId: number, sourceId?: string): void {
  const histories = getPlayHistory().filter(
    h => !(h.vod_id === vodId && (sourceId === undefined || isSameEntry(h.sourceId, sourceId)))
  );
  localStorage.setItem(HISTORY_KEY, JSON.stringify(histories));
  notifyStorageChange();
}

// 清空播放历史
export function clearPlayHistory(): void {
  localStorage.removeItem(HISTORY_KEY);
  notifyStorageChange();
}

// 更新某条历史的播放进度（SimPlayer 通过 onProgress 上报）
// 高频写入（约每 3 秒），只写 localStorage 不触发 React 通知，避免播放期间无关组件重渲染
export function updatePlayHistoryProgress(
  vodId: number,
  sourceId: string,
  progress: number,
  episode: number,
): void {
  const histories = getPlayHistory();
  const idx = histories.findIndex(
    h => h.vod_id === vodId && isSameEntry(h.sourceId, sourceId),
  );
  if (idx < 0) return;
  histories[idx] = { ...histories[idx], progress, episode, timestamp: Date.now() };
  localStorage.setItem(HISTORY_KEY, JSON.stringify(histories));
}

// 清除所有历史的播放进度（播放器右键菜单「删除播放缓存」的新落点）
export function clearAllPlayProgress(): void {
  const histories = getPlayHistory();
  if (histories.length === 0) return;
  const reset = histories.map(h => ({ ...h, progress: 0 }));
  localStorage.setItem(HISTORY_KEY, JSON.stringify(reset));
  notifyStorageChange();
}

// 获取播放器设置
export function getPlayerSettings(): PlayerSettings {
  const stored = localStorage.getItem(PLAYER_SETTINGS_KEY);
  if (stored) {
    try {
      // 合并默认值：兼容旧数据缺失新增字段（如 autoNext）
      return { ...getDefaultPlayerSettings(), ...JSON.parse(stored) };
    } catch {
      return getDefaultPlayerSettings();
    }
  }
  return getDefaultPlayerSettings();
}

// 默认播放器设置
export function getDefaultPlayerSettings(): PlayerSettings {
  return {
    playerMode: 'builtin',
    playerUrl: 'https://ericq521.web.app/ckplayer/?v=',
    autoResume: true,
    autoNext: false,
    blockEthics: false,
    // 默认屏蔽词表（模糊匹配）：覆盖常见的伦理/成人分类标签
    blockKeywords: [
      { word: '伦理', mode: 'fuzzy' },
      { word: '情色', mode: 'fuzzy' },
      { word: '成人', mode: 'fuzzy' },
      { word: '色情', mode: 'fuzzy' },
      { word: '18禁', mode: 'fuzzy' },
      { word: '三级', mode: 'fuzzy' },
      { word: '午夜', mode: 'fuzzy' },
      { word: '福利', mode: 'fuzzy' },
      { word: '偷拍', mode: 'fuzzy' },
      { word: '无码', mode: 'fuzzy' },
      { word: '有码', mode: 'fuzzy' },
    ],
  };
}

// 底层写入播放器设置（不通知，供 store 复用）
function persistPlayerSettings(settings: PlayerSettings): void {
  localStorage.setItem(PLAYER_SETTINGS_KEY, JSON.stringify(settings));
}

// 保存播放器设置
export function savePlayerSettings(settings: PlayerSettings): void {
  persistPlayerSettings(settings);
  notifyStorageChange();
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
  notifyStorageChange();
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
  notifyStorageChange();
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
  notifyStorageChange();
}

// 检查是否已同意免责声明
export function isDisclaimerAgreed(): boolean {
  return localStorage.getItem(DISCLAIMER_AGREED_KEY) === 'true';
}

// 设置免责声明同意状态
export function setDisclaimerAgreed(agreed: boolean): void {
  localStorage.setItem(DISCLAIMER_AGREED_KEY, String(agreed));
  notifyStorageChange();
}

// ========== 收藏功能 ==========

// 获取收藏列表（读取时顺带执行源缺失清理：打标记/超时删除）
export function getFavorites(): FavoriteItem[] {
  const stored = localStorage.getItem(FAVORITES_KEY);
  if (stored) {
    try {
      const favorites = JSON.parse(stored) as FavoriteItem[];
      if (!Array.isArray(favorites)) return [];
      return purgeStaleItems(favorites, (items) => {
        if (items.length > 0) {
          localStorage.setItem(FAVORITES_KEY, JSON.stringify(items));
        } else {
          localStorage.removeItem(FAVORITES_KEY);
        }
      });
    } catch {
      return [];
    }
  }
  return [];
}

// 添加收藏（身份键 vod_id + sourceId，见 isSameEntry；无 sourceId 老条目被新收藏取代）
export function addFavorite(item: FavoriteItem): void {
  const favorites = getFavorites();
  const existingIndex = favorites.findIndex(
    f => f.vod_id === item.vod_id && isSameEntry(f.sourceId, item.sourceId)
  );
  if (existingIndex >= 0) {
    favorites[existingIndex] = item;
  } else {
    const upgraded = favorites.filter(
      f => !(f.vod_id === item.vod_id && !(f.sourceId || '').trim())
    );
    upgraded.unshift(item);
    favorites.length = 0;
    favorites.push(...upgraded);
  }
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  notifyStorageChange();
}

// 移除收藏（sourceId 缺省时移除该 vod_id 的所有条目）
export function removeFavorite(vodId: number, sourceId?: string): void {
  const favorites = getFavorites().filter(
    f => !(f.vod_id === vodId && (sourceId === undefined || isSameEntry(f.sourceId, sourceId)))
  );
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites));
  notifyStorageChange();
}

// 检查是否已收藏（按 vod_id + sourceId）
export function isFavorite(vodId: number, sourceId?: string): boolean {
  return getFavorites().some(
    f => f.vod_id === vodId && (sourceId === undefined || isSameEntry(f.sourceId, sourceId))
  );
}

// 切换收藏状态
export function toggleFavorite(item: FavoriteItem): boolean {
  if (isFavorite(item.vod_id, item.sourceId)) {
    removeFavorite(item.vod_id, item.sourceId);
    return false;
  } else {
    addFavorite(item);
    return true;
  }
}

// 清空所有收藏
export function clearFavorites(): void {
  localStorage.removeItem(FAVORITES_KEY);
  notifyStorageChange();
}

// ========== 历史条数上限（可配置，默认 50） ==========

const HISTORY_LIMIT_KEY = 'bismuth_history_limit';
const DEFAULT_HISTORY_LIMIT = 50;

export function getHistoryLimit(): number {
  const raw = localStorage.getItem(HISTORY_LIMIT_KEY);
  const n = raw === null ? DEFAULT_HISTORY_LIMIT : Number(raw);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_HISTORY_LIMIT;
}

export function setHistoryLimit(limit: number): void {
  localStorage.setItem(HISTORY_LIMIT_KEY, String(limit));
  notifyStorageChange();
}

// ========== 订阅 hooks（设置变更实时反映，P1#9） ==========

export const usePlayerSettings = createStorageStore(
  PLAYER_SETTINGS_KEY,
  getPlayerSettings,
  persistPlayerSettings,
).useValue;

export const useCacheSettings = createStorageStore(
  CACHE_SETTINGS_KEY,
  getCacheSettings,
  (settings) => localStorage.setItem(CACHE_SETTINGS_KEY, JSON.stringify(settings)),
).useValue;

export const useCorsProxyList = createStorageStore(
  CORS_PROXY_LIST_KEY,
  getCorsProxyList,
  (list) => localStorage.setItem(CORS_PROXY_LIST_KEY, JSON.stringify(list)),
).useValue;

export const useCorsProxyEnabled = createStorageStore(
  CORS_PROXY_ENABLED_KEY,
  isCorsProxyEnabled,
  (enabled) => localStorage.setItem(CORS_PROXY_ENABLED_KEY, String(enabled)),
).useValue;

// 历史/收藏为只读订阅（写入走 add/remove/clear 等专用函数）
export const usePlayHistory = createStorageStore(
  HISTORY_KEY,
  getPlayHistory,
  () => { throw new Error('历史写入请使用 addPlayHistory/removePlayHistory/clearPlayHistory'); },
).useValue;

export const useFavorites = createStorageStore(
  FAVORITES_KEY,
  getFavorites,
  () => { throw new Error('收藏写入请使用 addFavorite/removeFavorite/toggleFavorite'); },
).useValue;
