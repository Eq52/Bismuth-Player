import type { VideoItem, ApiResponse, VideoSource } from '@/types';
import { getCache, setCache } from './cache';
import { isCorsProxyEnabled, getCorsProxyList, setCorsProxyList, getPlayerSettings } from './storage';
import { isDesktopMode, desktopApiUrl } from './desktop';

// 判断是否为伦理片/成人内容（用于内容过滤）
function isEthicsContent(name?: string): boolean {
  if (!name) return false;
  // 匹配常见的伦理片分类名和标签
  return /伦理片|伦理|情色片|情色|成人片|成人|色情|18禁|三级片|三级|午夜|福利片|国产自拍|偷拍|无码|有码/.test(name);
}

// 默认无影视源 - 用户需自行添加
export const DEFAULT_SOURCES: VideoSource[] = [];

// 存储键名（统一 bismuth_ 前缀，兼容旧数据自动迁移）
const SOURCES_KEY = 'bismuth_video_sources';
const CURRENT_SOURCE_KEY = 'bismuth_current_source_id';
const OLD_SOURCES_KEY = 'video_sources';
const OLD_CURRENT_SOURCE_KEY = 'current_source_id';

// 带迁移的读取：先读新键，没有就读旧键并自动迁移
function readWithMigration<T>(newKey: string, oldKey: string, parse: (raw: string) => T | null): T | null {
  const fresh = localStorage.getItem(newKey);
  if (fresh !== null) {
    return parse(fresh);
  }
  const legacy = localStorage.getItem(oldKey);
  if (legacy !== null) {
    const parsed = parse(legacy);
    // 迁移到新键，删除旧键
    localStorage.setItem(newKey, legacy);
    localStorage.removeItem(oldKey);
    return parsed;
  }
  return null;
}

// 缓存有效期配置（分钟）
const CACHE_TTL = {
  videoList: 10,      // 列表缓存10分钟
  videoDetail: 60,    // 详情缓存1小时
  categories: 30,     // 分类缓存30分钟
};

// 构建完整URL（根据设置决定是否添加代理）
// 桌面版（Bismuth Desktop）：内置本地代理自动启用，免配置，一律走同源 /?url= 转发
function buildUrl(apiUrl: string, proxy?: string): string {
  if (isDesktopMode()) {
    return desktopApiUrl(apiUrl);
  }
  if (!isCorsProxyEnabled()) {
    return apiUrl;
  }
  const p = proxy || getCorsProxyList()[0];
  return `${p}${encodeURIComponent(apiUrl)}`;
}

// 轮换代理：将列表第一个移到末尾，并持久化
function rotateProxy(): string {
  const list = getCorsProxyList();
  if (list.length <= 1) return list[0] || '';
  const first = list.shift()!;
  list.push(first);
  setCorsProxyList(list);
  return list[0];
}

// 验证 API 响应格式，防止 malformed JSON 导致消费端崩溃
function safeApiResponse(data: any): ApiResponse {
  if (data && typeof data === 'object' && Array.isArray(data.list)) {
    // 类型归一化：苹果CMS分页字段可能是字符串也可能是数字，统一转 number
    return {
      code: Number(data.code) || 0,
      msg: String(data.msg || ''),
      page: data.page !== undefined ? Number(data.page) : undefined,
      pagecount: data.pagecount !== undefined ? Number(data.pagecount) : undefined,
      limit: data.limit !== undefined ? Number(data.limit) : undefined,
      total: data.total !== undefined ? Number(data.total) : undefined,
      list: data.list,
      // 透传 class 字段（分类数据，getCategories 需要）
      ...(data.class !== undefined ? { class: data.class } : {}),
    } as ApiResponse;
  }
  return { code: Number(data?.code) || 0, msg: String(data?.msg || 'Invalid API response'), list: [] };
}

// 带重试的请求（保留原始 URL 变量，不依赖字符串反解）
async function fetchWithRetry(originalUrl: string, retries = 2): Promise<Response> {
  let lastError: Error | null = null;
  // 桌面版内置代理唯一且常驻，无需轮换（也避免误改用户配置的外部代理列表）
  const useProxy = !isDesktopMode() && isCorsProxyEnabled();
  let proxyUrl = buildUrl(originalUrl);

  for (let i = 0; i <= retries; i++) {
    try {
      const response = await fetch(proxyUrl, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
      });

      if (response.ok) {
        return response;
      }

      // 消费响应体以释放连接并记录调试信息
      await response.text().catch(() => '');
      lastError = new Error(`请求失败，HTTP 状态码: ${response.status}`);

      if (i < retries && useProxy) {
        rotateProxy();
        proxyUrl = buildUrl(originalUrl);
      }
    } catch (error) {
      lastError = error as Error;
      if (i < retries && useProxy) {
        rotateProxy();
        proxyUrl = buildUrl(originalUrl);
      }
    }
  }

  throw lastError || new Error('请求失败');
}

// 获取当前选中的影视源
export function getCurrentSource(): VideoSource | null {
  const sources = getSources();
  if (sources.length === 0) return null;
  const currentId = readWithMigration<string>(
    CURRENT_SOURCE_KEY,
    OLD_CURRENT_SOURCE_KEY,
    (raw) => raw
  );
  return sources.find(s => s.id === currentId) || sources[0] || null;
}

// 获取所有影视源
export function getSources(): VideoSource[] {
  const result = readWithMigration<VideoSource[]>(
    SOURCES_KEY,
    OLD_SOURCES_KEY,
    (raw) => {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
  );
  return result || [];
}

// 保存影视源
export function saveSources(sources: VideoSource[]): void {
  localStorage.setItem(SOURCES_KEY, JSON.stringify(sources));
}

// 设置当前影视源
export function setCurrentSource(sourceId: string): void {
  localStorage.setItem(CURRENT_SOURCE_KEY, sourceId);
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
    
    const response = await fetchWithRetry(url);
    return safeApiResponse(await response.json());
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

  const response = await fetchWithRetry(url);
  const data = safeApiResponse(await response.json());
  
  // 🔞 伦理片过滤：如果开启了屏蔽伦理片设置，过滤掉伦理片视频
  const settings = getPlayerSettings();
  if (settings.blockEthics && data.list && data.list.length > 0) {
    data.list = data.list.filter(v => !isEthicsContent(v.type_name));
    // 更新 total（如果存在）
    if (data.total !== undefined) {
      data.total = data.list.length;
    }
  }
  
  // 缓存结果
  if (data.code === 1 || data.code === 200) {
    setCache(cacheKey, data, CACHE_TTL.videoList);
    console.log('[Cache] 缓存列表:', cacheKey, `TTL: ${CACHE_TTL.videoList}分钟`);
  }
  
  return data;
}

// 指定影视源已被删除时抛出（详情页/播放器据此渲染专属错误提示）
export class SourceDeletedError extends Error {
  sourceId: string;
  sourceName: string;
  constructor(sourceId: string, sourceName: string = '') {
    super('对应影视源被删除');
    this.name = 'SourceDeletedError';
    this.sourceId = sourceId;
    this.sourceName = sourceName;
  }
}

// 获取影视详情（带缓存）
// sourceId/sourceName：历史/收藏跨源播放时传入条目标注的源，
// 从该源拉取数据且不影响当前选中的源；不传则用当前源（老数据兼容）
export async function getVideoDetail(
  id: number,
  sourceId?: string,
  sourceName?: string
): Promise<VideoItem | null> {
  // 解析目标源：优先条目标注的源，找不到说明源已被删除
  let source: VideoSource | null;
  if (sourceId) {
    const found = getSources().find(s => s.id === sourceId);
    if (!found) {
      throw new SourceDeletedError(sourceId, sourceName);
    }
    source = found;
  } else {
    source = getCurrentSource();
  }
  if (!source) return null;

  // 生成缓存键（带源 ID，避免不同源同 ID 影片串缓存）
  const cacheKey = generateCacheKey('videoDetail', { id, source: source.id });
  
  // 尝试从缓存获取
  const cached = getCache<VideoItem>(cacheKey);
  if (cached) {
    console.log('[Cache] 命中详情缓存:', cacheKey);
    return cached;
  }
  
  const url = `${source.url}?ac=detail&ids=${id}`;
  
  const response = await fetchWithRetry(url);
  const data = safeApiResponse(await response.json());
  
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
// 分类项（含层级信息）
export interface CategoryItem {
  id: string;
  name: string;
  type_id: number;
  type_pid: number;
}

export async function getCategories(): Promise<CategoryItem[]> {
  const source = getCurrentSource();
  if (!source) {
    return [{ id: 'all', name: '全部', type_id: 0, type_pid: -1 }];
  }
  
  // 生成缓存键
  const cacheKey = generateCacheKey('categories', {});
  
  // 尝试从缓存获取
  const cached = getCache<CategoryItem[]>(cacheKey);
  if (cached) {
    console.log('[Cache] 命中分类缓存');
    return cached;
  }
  
  // 苹果CMS不带参数时返回 list + class；带 ?ac=videolist 时不返回 class
  const url = source.url;
  
  try {
    const response = await fetchWithRetry(url);
    const data = await response.json();
    
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid API response');
    }
    
    let categories: CategoryItem[];
    
    if (data.class && Array.isArray(data.class)) {
      categories = [
        { id: 'all', name: '全部', type_id: 0, type_pid: -1 },
        ...data.class.map((c: any) => ({
          id: String(c.type_id),
          name: c.type_name,
          type_id: Number(c.type_id),
          type_pid: Number(c.type_pid)
        }))
      ];
    } else {
      // 默认分类（fallback）
      categories = [
        { id: 'all', name: '全部', type_id: 0, type_pid: -1 },
        { id: '2', name: '电视剧', type_id: 2, type_pid: 0 },
        { id: '1', name: '电影', type_id: 1, type_pid: 0 },
        { id: '3', name: '综艺', type_id: 3, type_pid: 0 },
        { id: '4', name: '动漫', type_id: 4, type_pid: 0 }
      ];
    }
    
    // 🔞 伦理片过滤：如果开启了屏蔽伦理片设置，过滤掉伦理片分类
    const settings = getPlayerSettings();
    if (settings.blockEthics) {
      const ethicsIds = new Set<number>();
      // 先找出所有伦理片顶级分类的 id
      categories.forEach(c => {
        if (c.type_pid === 0 && isEthicsContent(c.name)) {
          ethicsIds.add(c.type_id);
        }
      });
      // 过滤掉伦理片顶级分类及其子分类
      categories = categories.filter(c => 
        c.type_id === 0 || (!ethicsIds.has(c.type_id) && !ethicsIds.has(c.type_pid))
      );
    }
    
    // 缓存结果
    setCache(cacheKey, categories, CACHE_TTL.categories);
    console.log('[Cache] 缓存分类:', `TTL: ${CACHE_TTL.categories}分钟`);
    return categories;
  } catch (error) {
    console.error('获取分类失败:', error);
    return [
      { id: 'all', name: '全部', type_id: 0, type_pid: -1 },
      { id: '2', name: '电视剧', type_id: 2, type_pid: 0 },
      { id: '1', name: '电影', type_id: 1, type_pid: 0 },
      { id: '3', name: '综艺', type_id: 3, type_pid: 0 },
      { id: '4', name: '动漫', type_id: 4, type_pid: 0 }
    ];
  }
}

// 解析播放地址（支持多播放源，以 $$$ 分隔，默认使用第一个源）
export function parsePlayUrls(vod_play_url?: string, _vod_play_from?: string): { name: string; url: string }[] {
  if (!vod_play_url) return [];
  
  const episodes: { name: string; url: string }[] = [];
  // 多个播放源以 $$$ 分隔，取第一个源（也是大多数 API 的默认行为）
  const sourceUrl = vod_play_url.split('$$$')[0];
  const lines = sourceUrl.split('#');
  
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
    const response = await fetchWithRetry(testUrl);
    const data = await response.json();
    return data && (data.code === 1 || data.code === 200);
  } catch {
    return false;
  }
}
