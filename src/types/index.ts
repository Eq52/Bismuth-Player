// 影视源类型
export interface VideoSource {
  id: string;
  name: string;
  url: string;
}

// 影视项目类型
export interface VideoItem {
  vod_id: number;
  vod_name: string;
  vod_pic: string;
  vod_remarks?: string;
  vod_score?: string;
  type_name?: string;
  vod_year?: string;
  vod_area?: string;
  vod_actor?: string;
  vod_director?: string;
  vod_content?: string;
  vod_play_url?: string;
  vod_play_from?: string;
}

// API响应类型
export interface ApiResponse {
  code: number;
  msg: string;
  page?: number;
  pagecount?: number;
  limit?: number;
  total?: number;
  list: VideoItem[];
}

// 播放历史类型
export interface PlayHistory {
  vod_id: number;
  vod_name: string;
  vod_pic: string;
  episode: number;
  episodeName: string;
  progress: number;
  timestamp: number;
  sourceId: string;
}

// 播放器模式
export type PlayerMode = 'builtin' | 'external';

// 播放器设置
export interface PlayerSettings {
  playerMode: PlayerMode;
  playerUrl: string;
  autoResume: boolean;
}

// 缓存设置
export interface CacheSettings {
  enabled: boolean;
}

// 应用设置
export interface AppSettings {
  sources: VideoSource[];
  currentSourceId: string;
  player: PlayerSettings;
  cache: CacheSettings;
}

// 分类类型
export interface Category {
  id: string;
  name: string;
}
