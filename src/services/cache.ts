import { getCacheSettings } from './storage';

// 缓存键前缀
const CACHE_PREFIX = 'bismuth_cache_';

// LRU 容量上限：条目数与估算字节数（localStorage 常见上限约 5MB，为其他数据留足余量）
const MAX_CACHE_ITEMS = 150;
const MAX_CACHE_BYTES = 3 * 1024 * 1024;

// 命中后刷新 lastAccess 的最小间隔（毫秒），避免高频访问反复写 localStorage
const LRU_TOUCH_THROTTLE = 30_000;

// 缓存项类型
interface CacheItem<T> {
  data: T;
  timestamp: number;   // 写入时间（TTL 新鲜度依据）
  ttl: number;         // 缓存有效期（毫秒）
  lastAccess: number;  // 最近访问时间（LRU 淘汰依据）
}

// 生成缓存键
function generateCacheKey(key: string): string {
  // 使用完整键名，确保唯一性
  // 对特殊字符进行处理，避免localStorage键名问题
  const safeKey = key.replace(/[^a-zA-Z0-9_-]/g, '_');
  return CACHE_PREFIX + safeKey;
}

// 检查缓存是否有效
function isCacheValid<T>(item: CacheItem<T>): boolean {
  const now = Date.now();
  return now - item.timestamp < item.ttl;
}

// 收集所有缓存项的索引（键 + 最近访问时间），兼容旧结构（缺 lastAccess 时回退到写入时间）
function collectCacheIndex(): { key: string; lastAccess: number }[] {
  const items: { key: string; lastAccess: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_PREFIX)) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const item: CacheItem<unknown> = JSON.parse(stored);
          items.push({ key, lastAccess: item.lastAccess ?? item.timestamp ?? 0 });
        }
      } catch {
        // 忽略无法解析的项
      }
    }
  }
  return items;
}

// 估算当前 API 缓存占用的字节数（UTF-16 每字符 2 字节）
function getCacheBytes(): number {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_PREFIX)) {
      const stored = localStorage.getItem(key);
      if (stored) total += stored.length * 2;
    }
  }
  return total;
}

// 按 LRU 淘汰最久未访问的 count 项
function evictLeastRecentlyUsed(count: number): void {
  if (count <= 0) return;
  const items = collectCacheIndex();
  items.sort((a, b) => a.lastAccess - b.lastAccess); // 最久未访问在前
  items.slice(0, count).forEach(({ key }) => localStorage.removeItem(key));
}

// 主动容量控制：写入后若超上限，按 LRU 淘汰最久未访问直到达标
function enforceCacheLimit(): void {
  const items = collectCacheIndex().sort((a, b) => a.lastAccess - b.lastAccess);
  if (items.length <= MAX_CACHE_ITEMS && getCacheBytes() <= MAX_CACHE_BYTES) return;

  let removed = 0;
  while (items.length > 0 && (items.length > MAX_CACHE_ITEMS || getCacheBytes() > MAX_CACHE_BYTES)) {
    const target = items.shift();
    if (!target) break;
    if (localStorage.getItem(target.key) !== null) {
      localStorage.removeItem(target.key);
      removed++;
    }
  }
  if (removed > 0) {
    console.log(`[Cache] LRU 淘汰 ${removed} 项（上限 ${MAX_CACHE_ITEMS} 项 / ${(MAX_CACHE_BYTES / 1024 / 1024).toFixed(1)}MB）`);
  }
}

// 获取缓存
export function getCache<T>(key: string): T | null {
  const settings = getCacheSettings();
  if (!settings.enabled) return null;

  try {
    const cacheKey = generateCacheKey(key);
    const stored = localStorage.getItem(cacheKey);
    if (!stored) return null;

    const item: CacheItem<T> = JSON.parse(stored);

    if (!isCacheValid(item)) {
      // 缓存过期，删除
      localStorage.removeItem(cacheKey);
      return null;
    }

    // LRU：命中即刷新最近访问时间（节流，避免高频访问反复写）
    const now = Date.now();
    if (item.lastAccess !== undefined && now - item.lastAccess > LRU_TOUCH_THROTTLE) {
      item.lastAccess = now;
      localStorage.setItem(cacheKey, JSON.stringify(item));
    }

    return item.data;
  } catch {
    return null;
  }
}

// 设置缓存
export function setCache<T>(key: string, data: T, ttlMinutes: number = 30): void {
  const settings = getCacheSettings();
  if (!settings.enabled) return;

  const now = Date.now();
  const item: CacheItem<T> = {
    data,
    timestamp: now,
    ttl: ttlMinutes * 60 * 1000,
    lastAccess: now
  };
  const cacheKey = generateCacheKey(key);

  try {
    localStorage.setItem(cacheKey, JSON.stringify(item));
  } catch (error) {
    // 存储空间不足，LRU 兜底淘汰后重试
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      evictLeastRecentlyUsed(Math.ceil(collectCacheIndex().length * 0.3) || 10);
      try {
        localStorage.setItem(cacheKey, JSON.stringify(item));
      } catch {
        // 忽略
      }
    }
  }

  // 主动容量控制：超上限按 LRU 淘汰最久未访问
  enforceCacheLimit();
}

// 删除特定缓存
export function removeCache(key: string): void {
  localStorage.removeItem(generateCacheKey(key));
}

// 清理所有API缓存
export function clearApiCache(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_PREFIX)) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
}

// 清理过期缓存
export function cleanupExpiredCache(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_PREFIX)) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const item: CacheItem<unknown> = JSON.parse(stored);
          if (!isCacheValid(item)) {
            keysToRemove.push(key);
          }
        }
      } catch {
        keysToRemove.push(key);
      }
    }
  }
  keysToRemove.forEach(key => localStorage.removeItem(key));
}

// 获取缓存统计
export function getCacheStats(): { count: number; size: string } {
  let count = 0;
  let totalSize = 0;

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_PREFIX)) {
      const stored = localStorage.getItem(key);
      if (stored) {
        count++;
        totalSize += stored.length * 2; // UTF-16 每个字符2字节
      }
    }
  }

  // 格式化大小
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return { count, size: formatBytes(totalSize) };
}
