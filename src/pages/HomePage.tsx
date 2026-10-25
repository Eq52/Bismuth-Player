import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Film, Search, History, SlidersHorizontal, RefreshCw } from 'lucide-react';
import { VideoCard } from '@/components/VideoCard';
import { getVideoList, getCurrentSource, getSources } from '@/services/api';
import { useTheme, BrandLogo } from '@/services/ThemeContext';
import type { VideoItem, VideoSource } from '@/types';

// 骨架卡片：模拟 VideoCard 布局的加载占位（首屏与加载更多共用）
function VideoSkeleton() {
  return (
    <div className="bg-surface rounded-xl overflow-hidden">
      <div className="aspect-[3/4] bg-gradient-to-br from-[#1a1a2e] via-[#252547] to-[#1a1a2e] animate-pulse" />
      <div className="p-2.5 space-y-2">
        <div className="h-3 bg-white/10 rounded animate-pulse" />
        <div className="h-3 w-1/2 bg-white/10 rounded animate-pulse" />
      </div>
    </div>
  );
}

interface HomePageProps {
  onVideoClick: (video: VideoItem) => void;
  onHistoryClick: () => void;
  onAddSourceClick: () => void;
  onSearchClick: () => void;
  /** 打开筛选页 */
  onFilterClick: () => void;
  /** 递增计数器，每次从设置页返回首页时更新，触发影视源列表刷新 */
  refreshKey: number;
}

export function HomePage({ onVideoClick, onHistoryClick, onAddSourceClick, onSearchClick, onFilterClick, refreshKey }: HomePageProps) {
  const { appName } = useTheme();
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentSource, setCurrentSourceState] = useState<VideoSource | null>(null);
  const [hasSources, setHasSources] = useState(false);

  // 下拉刷新状态与手势相关 ref（触屏在列表顶部继续下拉触发刷新）
  const [pullDistance, setPullDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const pullDistanceRef = useRef(0);
  const refreshingRef = useRef(false);
  const pullStartYRef = useRef(0);
  const pullActiveRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  // 使用 ref 来避免闭包问题
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  // 检查影视源（refreshKey 变化时重新加载，例如从设置页返回）
  useEffect(() => {
    const sources = getSources();
    setHasSources(sources.length > 0);
    setCurrentSourceState(getCurrentSource());
  }, [refreshKey]);

  // 加载影视列表
  const loadVideos = useCallback(async (targetPage: number, reset: boolean = false, forceRefresh: boolean = false) => {
    if (loadingRef.current) return;
    setLoading(true);
    
    try {
      const response = await getVideoList(targetPage, 18, undefined, undefined, forceRefresh);
      
      if (reset) {
        setVideos(response.list);
        setPage(2);
      } else {
        setVideos(prev => [...prev, ...response.list]);
        setPage(targetPage + 1);
      }
      
      setHasMore(response.page != null && response.pagecount != null
        ? response.page < response.pagecount
        : response.list.length >= 18);
    } catch (error) {
      console.error('加载影视失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 首页默认展示全部内容
  useEffect(() => {
    if (hasSources) {
      setPage(1);
      loadVideos(1, true);
    }
  }, [hasSources, loadVideos]);

  // 滚动加载更多
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 100 && hasMore && !loadingRef.current) {
      loadVideos(page, false);
    }
  }, [hasMore, page, loadVideos]);

  // 下拉刷新：重新加载第一页
  const doRefresh = useCallback(async () => {
    if (refreshingRef.current) return;
    refreshingRef.current = true;
    setRefreshing(true);
    pullDistanceRef.current = 0;
    setPullDistance(0);
    try {
      await loadVideos(1, true, true); // 下拉刷新：绕过缓存强制拉最新
    } finally {
      refreshingRef.current = false;
      setRefreshing(false);
    }
  }, [loadVideos]);

  // 触屏下拉手势（原生监听以便 preventDefault，桌面鼠标不触发）
  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    const THRESHOLD = 64;

    const onTouchStart = (e: TouchEvent) => {
      if (el.scrollTop <= 0 && !refreshingRef.current) {
        pullStartYRef.current = e.touches[0].clientY;
        pullActiveRef.current = true;
      } else {
        pullActiveRef.current = false;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!pullActiveRef.current || refreshingRef.current) return;
      const delta = e.touches[0].clientY - pullStartYRef.current;
      if (delta > 0 && el.scrollTop <= 0) {
        e.preventDefault();
        const d = Math.min(Math.round(delta * 0.5), 88); // 阻尼，限制最大下拉高度
        pullDistanceRef.current = d;
        setPullDistance(d);
      }
    };

    const onTouchEnd = () => {
      if (!pullActiveRef.current) return;
      pullActiveRef.current = false;
      if (pullDistanceRef.current >= THRESHOLD && !refreshingRef.current) {
        doRefresh();
      } else {
        pullDistanceRef.current = 0;
        setPullDistance(0);
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: true });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
    };
    // 依赖 hasSources：无源分支不渲染滚动容器（ref 为空），添加源后需重新绑定手势
  }, [doRefresh, hasSources]);

  // 空状态 - 无影视源
  if (!hasSources) {
    return (
      <div className="h-full flex flex-col bg-base">
        {/* 头部 */}
        <header className="px-5 py-4 md:px-8 md:py-5 flex items-center justify-between bg-base">
          <div className="flex items-center">
            <div className="w-9 h-9 md:w-10 md:h-10 bi-logo-mark rounded-xl flex items-center justify-center mr-3 overflow-hidden">
              <BrandLogo fallback={<Film className="w-5 h-5 text-white" />} />
            </div>
            <div>
              <h1 className="text-white text-lg md:text-xl font-bold tracking-tight">{appName === 'Bismuth' ? 'Bismuth Player' : appName}</h1>
              <p className="text-gray-500 text-xs">如"秘"般美丽</p>
            </div>
          </div>
          <button 
            onClick={onHistoryClick}
            className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
            title="播放历史"
          >
            <History size={20} />
          </button>
        </header>

        {/* 空状态 */}
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <div className="w-24 h-24 bi-logo-mark-soft rounded-3xl flex items-center justify-center mb-6">
            <Film className="w-12 h-12 text-gray-400" />
          </div>
          <h2 className="text-white text-xl font-semibold mb-2">欢迎使用 Bismuth Player</h2>
          <p className="text-gray-500 text-center mb-8 max-w-xs">
            这是一个精美的影视播放壳子，请先添加影视源开始使用
          </p>
          <button
            onClick={onAddSourceClick}
            className="flex items-center px-6 py-3 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-medium rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-purple-500/25"
          >
            <Plus size={20} className="mr-2" />
            添加影视源
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-base">
      {/* 头部 */}
      <header className="px-5 py-4 md:px-8 md:py-5 flex items-center justify-between bg-base">
        <div className="flex items-center">
          <div className="w-9 h-9 md:w-10 md:h-10 bi-logo-mark rounded-xl flex items-center justify-center mr-3 overflow-hidden">
            <BrandLogo fallback={<Film className="w-5 h-5 text-white" />} />
          </div>
          <div>
            <h1 className="text-white text-lg md:text-xl font-bold tracking-tight">{appName === 'Bismuth' ? 'Bismuth Player' : appName}</h1>
            <p className="text-gray-500 text-xs">{currentSource?.name || '未选择源'}</p>
          </div>
        </div>
        <button 
          onClick={onHistoryClick}
          className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          title="播放历史"
        >
          <History size={20} />
        </button>
      </header>

      {/* 搜索框 + 筛选入口 */}
      <div className="px-5 py-2 md:px-8 flex items-center gap-2">
        <div 
          onClick={onSearchClick}
          className="flex-1 max-w-md bg-surface border border-white/5 rounded-xl px-4 py-3 flex items-center text-gray-500 cursor-pointer hover:bg-elevated hover:border-white/10 transition-all"
        >
          <Search className="w-5 h-5 mr-3 flex-shrink-0" />
          <span className="text-sm">搜索影片...</span>
        </div>
        <button
          onClick={onFilterClick}
          className="flex items-center gap-1.5 bg-surface border border-white/5 rounded-xl px-3.5 py-3 text-gray-400 hover:text-white hover:bg-elevated hover:border-white/10 transition-all flex-shrink-0"
          title="分类筛选"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="text-sm">筛选</span>
        </button>
      </div>

      {/* 影视网格 */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto px-5 py-2 md:px-8 overscroll-contain"
        onScroll={handleScroll}
      >
        {/* 下拉刷新提示条（高度随下拉距离展开，图标随状态变化） */}
        <div
          className="flex items-center justify-center overflow-hidden transition-[height] duration-150"
          style={{ height: refreshing ? 44 : pullDistance }}
        >
          {refreshing ? (
            <div className="w-5 h-5 border-2 border-purple-500/40 border-t-purple-500 rounded-full animate-spin" />
          ) : pullDistance >= 64 ? (
            <RefreshCw className="w-5 h-5 text-purple-300 animate-spin" />
          ) : pullDistance > 0 ? (
            <RefreshCw
              className="w-5 h-5 text-gray-300"
              style={{ transform: `rotate(${Math.min(pullDistance * 4, 180)}deg)` }}
            />
          ) : null}
        </div>

        {videos.length === 0 && loading ? (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-3 md:gap-4 lg:gap-5">
            {Array.from({ length: 12 }).map((_, i) => <VideoSkeleton key={i} />)}
          </div>
        ) : videos.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Film className="w-16 h-16 mb-4 opacity-20" />
            <p>暂无数据</p>
            <p className="text-sm mt-1">请检查影视源设置</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-3 md:gap-4 lg:gap-5">
            {videos.map((video) => (
              <VideoCard 
                key={video.vod_id} 
                video={video} 
                onClick={() => onVideoClick(video)}
              />
            ))}
          </div>
        )}

        {/* 加载更多：底部骨架卡片流 */}
        {loading && videos.length > 0 && (
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-3 md:gap-4 lg:gap-5 mt-3">
            {Array.from({ length: 4 }).map((_, i) => <VideoSkeleton key={i} />)}
          </div>
        )}

        {!hasMore && videos.length > 0 && (
          <div className="text-center py-6 text-gray-600 text-sm">
            没有更多了
          </div>
        )}
      </div>
    </div>
  );
}
