import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Film, Search, History, SlidersHorizontal } from 'lucide-react';
import { VideoCard } from '@/components/VideoCard';
import { getVideoList, getCurrentSource, getSources } from '@/services/api';
import type { VideoItem, VideoSource } from '@/types';

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
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentSource, setCurrentSourceState] = useState<VideoSource | null>(null);
  const [hasSources, setHasSources] = useState(false);
  
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
  const loadVideos = useCallback(async (targetPage: number, reset: boolean = false) => {
    if (loadingRef.current) return;
    setLoading(true);
    
    try {
      const response = await getVideoList(targetPage, 18);
      
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

  // 空状态 - 无影视源
  if (!hasSources) {
    return (
      <div className="h-full flex flex-col bg-[#0a0a0a]">
        {/* 头部 */}
        <header className="px-5 py-4 md:px-8 md:py-5 flex items-center justify-between bg-[#0a0a0a]">
          <div className="flex items-center">
            <div className="w-9 h-9 md:w-10 md:h-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center mr-3 shadow-lg shadow-purple-500/20">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white text-lg md:text-xl font-bold tracking-tight">Bismuth Player</h1>
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
          <div className="w-24 h-24 bg-gradient-to-br from-indigo-500/20 via-purple-500/20 to-pink-500/20 rounded-3xl flex items-center justify-center mb-6">
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
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* 头部 */}
      <header className="px-5 py-4 md:px-8 md:py-5 flex items-center justify-between bg-[#0a0a0a]">
        <div className="flex items-center">
          <div className="w-9 h-9 md:w-10 md:h-10 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center mr-3 shadow-lg shadow-purple-500/20">
            <Film className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white text-lg md:text-xl font-bold tracking-tight">Bismuth Player</h1>
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
          className="flex-1 max-w-md bg-[#141414] border border-white/5 rounded-xl px-4 py-3 flex items-center text-gray-500 cursor-pointer hover:bg-[#1a1a1a] hover:border-white/10 transition-all"
        >
          <Search className="w-5 h-5 mr-3 flex-shrink-0" />
          <span className="text-sm">搜索影片...</span>
        </div>
        <button
          onClick={onFilterClick}
          className="flex items-center gap-1.5 bg-[#141414] border border-white/5 rounded-xl px-3.5 py-3 text-gray-400 hover:text-white hover:bg-[#1a1a1a] hover:border-white/10 transition-all flex-shrink-0"
          title="分类筛选"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span className="text-sm">筛选</span>
        </button>
      </div>

      {/* 影视网格 */}
      <div 
        className="flex-1 overflow-y-auto px-5 py-2 md:px-8"
        onScroll={handleScroll}
      >
        {videos.length === 0 && !loading ? (
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
        
        {loading && (
          <div className="flex justify-center py-6">
            <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
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
