import { useState, useEffect, useCallback } from 'react';
import { Settings, Plus, Film, Search } from 'lucide-react';
import { VideoCard } from '@/components/VideoCard';
import { getVideoList, getCategories, getCurrentSource, getSources } from '@/services/api';
import type { VideoItem, VideoSource } from '@/types';

interface HomePageProps {
  onVideoClick: (video: VideoItem) => void;
  onSettingsClick: () => void;
  onAddSourceClick: () => void;
}

export function HomePage({ onVideoClick, onSettingsClick, onAddSourceClick }: HomePageProps) {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [currentCategory, setCurrentCategory] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [currentSource, setCurrentSourceState] = useState<VideoSource | null>(null);
  const [hasSources, setHasSources] = useState(false);

  // 加载分类和检查影视源
  useEffect(() => {
    const sources = getSources();
    setHasSources(sources.length > 0);
    setCurrentSourceState(getCurrentSource());
    
    if (sources.length > 0) {
      getCategories().then(setCategories);
    }
  }, []);

  // 加载影视列表
  const loadVideos = useCallback(async (reset = false) => {
    if (loading) return;
    setLoading(true);
    
    try {
      const currentPage = reset ? 1 : page;
      const response = await getVideoList(currentPage, 18, currentCategory);
      
      if (reset) {
        setVideos(response.list);
        setPage(2);
      } else {
        setVideos(prev => [...prev, ...response.list]);
        setPage(prev => prev + 1);
      }
      
      setHasMore(response.list.length === 18);
    } catch (error) {
      console.error('加载影视失败:', error);
    } finally {
      setLoading(false);
    }
  }, [currentCategory, page, loading]);

  // 初始加载和分类切换
  useEffect(() => {
    if (hasSources) {
      loadVideos(true);
    }
  }, [currentCategory, hasSources]);

  // 滚动加载更多
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 100 && hasMore && !loading) {
      loadVideos();
    }
  }, [hasMore, loading, loadVideos]);

  // 空状态 - 无影视源
  if (!hasSources) {
    return (
      <div className="h-full flex flex-col bg-[#0a0a0a]">
        {/* 头部 */}
        <header className="px-5 py-4 flex items-center justify-between bg-[#0a0a0a]">
          <div className="flex items-center">
            <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center mr-3 shadow-lg shadow-purple-500/20">
              <Film className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-white text-lg font-bold tracking-tight">Bismuth Player</h1>
              <p className="text-gray-500 text-xs">精美影视播放壳子</p>
            </div>
          </div>
          <button 
            onClick={onSettingsClick}
            className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
          >
            <Settings size={20} />
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
      <header className="px-5 py-4 flex items-center justify-between bg-[#0a0a0a]">
        <div className="flex items-center">
          <div className="w-9 h-9 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 rounded-xl flex items-center justify-center mr-3 shadow-lg shadow-purple-500/20">
            <Film className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white text-lg font-bold tracking-tight">Bismuth Player</h1>
            <p className="text-gray-500 text-xs">{currentSource?.name || '未选择源'}</p>
          </div>
        </div>
        <button 
          onClick={onSettingsClick}
          className="p-2.5 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
        >
          <Settings size={20} />
        </button>
      </header>

      {/* 搜索框 */}
      <div className="px-5 py-2">
        <div 
          onClick={onAddSourceClick}
          className="bg-[#141414] border border-white/5 rounded-xl px-4 py-3 flex items-center text-gray-500 cursor-pointer hover:bg-[#1a1a1a] hover:border-white/10 transition-all"
        >
          <Search className="w-5 h-5 mr-3" />
          <span className="text-sm">搜索影片...</span>
        </div>
      </div>

      {/* 分类标签 */}
      <div className="flex overflow-x-auto px-5 py-3 gap-2 scrollbar-hide">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCurrentCategory(cat.id)}
            className={`px-4 py-2 rounded-xl text-sm whitespace-nowrap transition-all ${
              currentCategory === cat.id
                ? 'bg-white text-black font-medium'
                : 'bg-[#141414] text-gray-400 hover:bg-[#1a1a1a]'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* 影视网格 */}
      <div 
        className="flex-1 overflow-y-auto px-5 py-2"
        onScroll={handleScroll}
      >
        {videos.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Film className="w-16 h-16 mb-4 opacity-20" />
            <p>暂无数据</p>
            <p className="text-sm mt-1">请检查影视源设置</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3">
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
