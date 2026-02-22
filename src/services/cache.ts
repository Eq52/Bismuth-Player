import { getCacheSettings } from './storage';

// 缓存键前缀
const CACHE_PREFIX = 'bismuth_cache_';

// 缓存项类型
interface CacheItem<T> {
  data: T;
  timestamp: number;
  ttl: number; // 缓存有效期（毫秒）
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

// 获取缓存
export function getCache<T>(key: string): T | null {
  const settings = getCacheSettings();
  if (!settings.enabled) return null;

  try {
    const stored = localStorage.getItem(generateCacheKey(key));
    if (!stored) return null;

    const item: CacheItem<T> = JSON.parse(stored);
    
    if (!isCacheValid(item)) {
      // 缓存过期，删除
      localStorage.removeItem(generateCacheKey(key));
      return null;
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

  try {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      ttl: ttlMinutes * 60 * 1000
    };
    localStorage.setItem(generateCacheKey(key), JSON.stringify(item));
  } catch (error) {
    // 存储空间不足，清理旧缓存
    if (error instanceof Error && error.name === 'QuotaExceededError') {
      cleanupOldCache();
      try {
        const item: CacheItem<T> = {
          data,
          timestamp: Date.now(),
          ttl: ttlMinutes * 60 * 1000
        };
        localStorage.setItem(generateCacheKey(key), JSON.stringify(item));
      } catch {
        // 忽略
      }
    }
  }
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

// 清理旧缓存（保留最近50个）
function cleanupOldCache(): void {
  const cacheItems: { key: string; timestamp: number }[] = [];
  
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && key.startsWith(CACHE_PREFIX)) {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const item: CacheItem<unknown> = JSON.parse(stored);
          cacheItems.push({ key, timestamp: item.timestamp });
        }
      } catch {
        // 忽略
      }
    }
  }
  
  // 按时间排序，删除最旧的
  cacheItems.sort((a, b) => a.timestamp - b.timestamp);
  const toRemove = cacheItems.slice(0, Math.ceil(cacheItems.length * 0.3)); // 删除30%最旧的
  toRemove.forEach(({ key }) => localStorage.removeItem(key));
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
