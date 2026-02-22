import type { VideoItem, ApiResponse, VideoSource } from '@/types';

// CORS代理列表 - 按优先级排序
const CORS_PROXIES = [
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://api.cors.lol/?url='
];

// 默认无影视源 - 用户需自行添加
export const DEFAULT_SOURCES: VideoSource[] = [];

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

// 构建完整URL（添加代理）
function buildUrl(apiUrl: string): string {
  const proxy = getProxyUrl();
  return `${proxy}${encodeURIComponent(apiUrl)}`;
}

// 带重试的请求
async function fetchWithRetry(url: string, retries = 2): Promise<Response> {
  let lastError: Error | null = null;
  
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
      
      // 如果失败且还有重试次数，尝试轮换代理
      if (i < retries) {
        rotateProxy();
        url = buildUrl(decodeURIComponent(url.split('quest=')[1] || url.split('url=')[1] || ''));
      }
    } catch (error) {
      lastError = error as Error;
      if (i < retries) {
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

// 获取影视列表
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
  
  let url = `${source.url}?ac=list&pg=${page}&limit=${limit}`;
  
  if (type && type !== 'all') {
    url += `&t=${type}`;
  }
  if (wd) {
    url = `${source.url}?ac=list&wd=${encodeURIComponent(wd)}&limit=${limit}`;
  }

  const response = await fetchWithRetry(buildUrl(url));
  const data = await response.json();
  return data;
}

// 获取影视详情
export async function getVideoDetail(id: number): Promise<VideoItem | null> {
  const source = getCurrentSource();
  if (!source) return null;
  
  const url = `${source.url}?ac=detail&ids=${id}`;
  
  const response = await fetchWithRetry(buildUrl(url));
  const data: ApiResponse = await response.json();
  
  if (data.list && data.list.length > 0) {
    return data.list[0];
  }
  return null;
}

// 搜索影视
export async function searchVideos(wd: string, page: number = 1, limit: number = 18): Promise<ApiResponse> {
  return getVideoList(page, limit, undefined, wd);
}

// 获取分类列表
export async function getCategories(): Promise<{ id: string; name: string }[]> {
  const source = getCurrentSource();
  if (!source) {
    return [{ id: 'all', name: '全部' }];
  }
  
  const url = `${source.url}?ac=list`;
  
  try {
    const response = await fetchWithRetry(buildUrl(url));
    const data = await response.json();
    
    if (data.class && Array.isArray(data.class)) {
      return [
        { id: 'all', name: '全部' },
        ...data.class.map((c: any) => ({ id: String(c.type_id), name: c.type_name }))
      ];
    }
  } catch (error) {
    console.error('获取分类失败:', error);
  }
  
  // 默认分类
  return [
    { id: 'all', name: '全部' },
    { id: '2', name: '电视剧' },
    { id: '1', name: '电影' },
    { id: '3', name: '综艺' },
    { id: '4', name: '动漫' }
  ];
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
    const testUrl = `${url}?ac=list&limit=1`;
    const response = await fetchWithRetry(buildUrl(testUrl));
    const data = await response.json();
    return data.code === 1 || data.code === 200;
  } catch {
    return false;
  }
}
