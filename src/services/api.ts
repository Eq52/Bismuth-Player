import type { VideoItem, ApiResponse, VideoSource } from '@/types';
import { getCache, setCache } from './cache';
import { isCorsProxyEnabled } from './storage';

// CORS代理列表 - 按优先级排序
const CORS_PROXIES = [
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://api.cors.lol/?url='
];

// 默认无影视源 - 用户需自行添加
export const DEFAULT_SOURCES: VideoSource[] = [];

// 缓存有效期配置（分钟）
const CACHE_TTL = {
  videoList: 10,      // 列表缓存10分钟
  videoDetail: 60,    // 详情缓存1小时
  categories: 30,     // 分类缓存30分钟
  search: 5,          // 搜索缓存5分钟
};

// 获取当前使用的代理（带轮换机制）
function getProxyUrl(): string {
  return localStorage.getItem('cors_proxy') || CORS_PROXIES[0];
}

// 轮换代理（当当前代理失败时）
export function rotateProxy(): string {
  const current = getProxyUrl();
  const currentIndex = CORS_PROXIES.indexOf(current);
  const nextIndex = (currentIndex + 1) % CORS_PROXIES.length;
  const nextProxy = CORS_PROXIES[nextIndex];
  localStorage.setItem('cors_proxy', nextProxy);
  return nextProxy;
}

// 构建完整URL（根据设置决定是否添加代理）
function buildUrl(apiUrl: string): string {
  if (!isCorsProxyEnabled()) {
    return apiUrl;
  }
  const proxy = getProxyUrl();
  return `${proxy}${encodeURIComponent(apiUrl)}`;
}

// 带重试的请求
async function fetchWithRetry(url: string, retries = 2): Promise<Response> {
  let lastError: Error | null = null;
  const useProxy = isCorsProxyEnabled();

  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
        },
      });

      if (response.ok) {
        return response;
      }

      // 如果失败且还有重试次数，且启用了代理，尝试轮换代理
      if (i < retries && useProxy) {
        rotateProxy();
        url = buildUrl(decodeURIComponent(url.split('quest=')[1] || url.split('url=')[1] || ''));
      }
    } catch (error) {
      lastError = error as Error;
      if (i < retries && useProxy) {
        rotateProxy();
        url = buildUrl(decodeURIComponent(url.split('quest=')[1] || url.split('url=')[1] || ''));
      }
    }
  }

  throw lastError || new Error('请求失败');
}

// 获取当前选中的影视源
export function getCurrentSource(): VideoSource | null {
  const sources = getSources();
  if (sources.length === 0) return null;
  const currentId = localStorage.getItem('current_source_id');
  return sources.find(s => s.id === currentId) || sources[0] || null;
}

// 获取所有影视源
export function getSources(): VideoSource[] {
  const stored = localStorage.getItem('video_sources');
  if (stored) {
    try {
      const sources = JSON.parse(stored);
      return Array.isArray(sources) ? sources : [];
    } catch {
      return [];
    }
  }
  return [];
}

// 保存影视源
export function saveSources(sources: VideoSource[]): void {
  localStorage.setItem('video_sources', JSON.stringify(sources));
}

// 设置当前影视源
export function setCurrentSource(sourceId: string): void {
  localStorage.setItem('current_source_id', sourceId);
}

// 添加影视源
export function addSource(source: VideoSource): void {
  const sources = getSources();
  // 检查ID是否已存在
  if (sources.some(s => s.id === source.id)) {
    throw new Error('影视源ID已存在');
  }
  sources.push(source);
  saveSources(sources);
}

// 删除影视源
export function removeSource(sourceId: string): void {
  const sources = getSources().filter(s => s.id !== sourceId);
  saveSources(sources);
}

// 生成缓存键
function generateCacheKey(type: string, params: Record<string, unknown>): string {
  const source = getCurrentSource();
  const sourceId = source?.id || 'none';
  // 确保所有值都是字符串，避免 undefined 导致的问题
  const paramStr = Object.entries(params)
    .filter(([_, v]) => v !== undefined && v !== null && v !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}=${String(v)}`)
    .join('&');
  return `${type}_${sourceId}_${paramStr || 'default'}`;
}

// 获取影视列表（带缓存）
export async function getVideoList(
  page: number = 1,
  limit: number = 18,
  type?: string,
  wd?: string
): Promise<ApiResponse> {
  const source = getCurrentSource();
  if (!source) {
    return { code: 0, msg: '请先添加影视源', list: [] };
  }
  
  // 搜索请求不使用缓存，每次都获取最新结果
  if (wd && wd.trim() !== '') {
    let url = `${source.url}?ac=videolist&wd=${encodeURIComponent(wd)}&limit=${limit}`;
    if (page > 1) {
      url += `&pg=${page}`;
    }
    
    const response = await fetchWithRetry(buildUrl(url));
    const data: ApiResponse = await response.json();
    return data;
  }
  
  // 普通列表请求使用缓存
  const cacheKey = generateCacheKey('videoList', { page, limit, type: type || 'all' });
  
  // 尝试从缓存获取
  const cached = getCache<ApiResponse>(cacheKey);
  if (cached) {
    console.log('[Cache] 命中列表缓存:', cacheKey);
    return cached;
  }
  
  let url = `${source.url}?ac=videolist&pg=${page}&limit=${limit}`;
  
  if (type && type !== 'all') {
    url += `&t=${type}`;
  }

  const response = await fetchWithRetry(buildUrl(url));
  const data: ApiResponse = await response.json();
  
  // 缓存结果
  if (data.code === 1 || data.code === 200) {
    setCache(cacheKey, data, CACHE_TTL.videoList);
    console.log('[Cache] 缓存列表:', cacheKey, `TTL: ${CACHE_TTL.videoList}分钟`);
  }
  
  return data;
}

// 获取影视详情（带缓存）
export async function getVideoDetail(id: number): Promise<VideoItem | null> {
  const source = getCurrentSource();
  if (!source) return null;
  
  // 生成缓存键
  const cacheKey = generateCacheKey('videoDetail', { id });
  
  // 尝试从缓存获取
  const cached = getCache<VideoItem>(cacheKey);
  if (cached) {
    console.log('[Cache] 命中详情缓存:', cacheKey);
    return cached;
  }
  
  const url = `${source.url}?ac=detail&ids=${id}`;
  
  const response = await fetchWithRetry(buildUrl(url));
  const data: ApiResponse = await response.json();
  
  if (data.list && data.list.length > 0) {
    const video = data.list[0];
    // 缓存结果
    setCache(cacheKey, video, CACHE_TTL.videoDetail);
    console.log('[Cache] 缓存详情:', cacheKey, `TTL: ${CACHE_TTL.videoDetail}分钟`);
    return video;
  }
  return null;
}

// 搜索影视（不使用缓存，确保搜索结果实时）
export async function searchVideos(wd: string, page: number = 1, limit: number = 18): Promise<ApiResponse> {
  return getVideoList(page, limit, undefined, wd);
}

// 获取分类列表（带缓存）
export async function getCategories(): Promise<{ id: string; name: string }[]> {
  const source = getCurrentSource();
  if (!source) {
    return [{ id: 'all', name: '全部' }];
  }
  
  // 生成缓存键
  const cacheKey = generateCacheKey('categories', {});
  
  // 尝试从缓存获取
  const cached = getCache<{ id: string; name: string }[]>(cacheKey);
  if (cached) {
    console.log('[Cache] 命中分类缓存');
    return cached;
  }
  
  const url = `${source.url}?ac=videolist`;
  
  try {
    const response = await fetchWithRetry(buildUrl(url));
    const data = await response.json();
    
    let categories: { id: string; name: string }[];
    
    if (data.class && Array.isArray(data.class)) {
      categories = [
        { id: 'all', name: '全部' },
        ...data.class.map((c: any) => ({ id: String(c.type_id), name: c.type_name }))
      ];
    } else {
      // 默认分类
      categories = [
        { id: 'all', name: '全部' },
        { id: '2', name: '电视剧' },
        { id: '1', name: '电影' },
        { id: '3', name: '综艺' },
        { id: '4', name: '动漫' }
      ];
    }
    
    // 缓存结果
    setCache(cacheKey, categories, CACHE_TTL.categories);
    console.log('[Cache] 缓存分类:', `TTL: ${CACHE_TTL.categories}分钟`);
    return categories;
  } catch (error) {
    console.error('获取分类失败:', error);
    return [
      { id: 'all', name: '全部' },
      { id: '2', name: '电视剧' },
      { id: '1', name: '电影' },
      { id: '3', name: '综艺' },
      { id: '4', name: '动漫' }
    ];
  }
}

// 解析播放地址
export function parsePlayUrls(vod_play_url?: string, _vod_play_from?: string): { name: string; url: string }[] {
  if (!vod_play_url) return [];
  
  const episodes: { name: string; url: string }[] = [];
  const lines = vod_play_url.split('#');
  
  for (const line of lines) {
    const parts = line.split('$');
    if (parts.length >= 2) {
      episodes.push({
        name: parts[0],
        url: parts[1]
      });
    }
  }
  
  return episodes;
}

// 测试影视源是否可用
export async function testSource(url: string): Promise<boolean> {
  try {
    const testUrl = `${url}?ac=videolist&limit=1`;
    const response = await fetchWithRetry(buildUrl(testUrl));
    const data = await response.json();
    return data.code === 1 || data.code === 200;
  } catch {
    return false;
  }
}
