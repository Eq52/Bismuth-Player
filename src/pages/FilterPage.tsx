import { useState, useEffect, useCallback, useRef } from 'react';
import { ArrowLeft, Film, SlidersHorizontal } from 'lucide-react';
import { VideoCard } from '@/components/VideoCard';
import { getVideoList, getCategories } from '@/services/api';
import type { CategoryItem } from '@/services/api';
import type { VideoItem } from '@/types';

interface FilterPageProps {
  onVideoClick: (video: VideoItem) => void;
  onBack: () => void;
  /** 顶级分类 type_id，0=全部 */
  topCategory: number;
  /** 当前选中的分类 id（子分类 id / 顶级分类 id / 'all'） */
  category: string;
  onTopCategoryChange: (typeId: number) => void;
  onCategoryChange: (id: string) => void;
}

export function FilterPage({ onVideoClick, onBack, topCategory, category, onTopCategoryChange, onCategoryChange }: FilterPageProps) {
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // 使用 ref 来避免闭包问题
  const loadingRef = useRef(loading);
  loadingRef.current = loading;

  // 加载分类列表
  useEffect(() => {
    getCategories().then(setCategories);
  }, []);

  // 加载影视列表
  const loadVideos = useCallback(async (targetPage: number, reset: boolean = false) => {
    if (loadingRef.current) return;
    setLoading(true);

    try {
      const response = await getVideoList(targetPage, 18, category);

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
  }, [category]);

  // 切换分类时重置并加载
  useEffect(() => {
    setPage(1);
    loadVideos(1, true);
  }, [category, loadVideos]);

  // 滚动加载更多
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 100 && hasMore && !loadingRef.current) {
      loadVideos(page, false);
    }
  }, [hasMore, page, loadVideos]);

  // 切换顶级分类：自动选中第一个子分类（苹果CMS顶级分类下无直接内容）
  const handleTopCategoryClick = (cat: CategoryItem | null) => {
    if (cat === null) {
      // "全部"
      onTopCategoryChange(0);
      onCategoryChange('all');
    } else {
      onTopCategoryChange(cat.type_id);
      const firstSub = categories.find(c => c.type_pid === cat.type_id);
      onCategoryChange(firstSub ? firstSub.id : cat.id);
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* 头部 */}
      <header className="px-5 py-4 md:px-8 md:py-5 flex items-center gap-3 bg-[#0a0a0a] border-b border-white/5">
        <button
          onClick={onBack}
          className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all md:hidden"
        >
          <ArrowLeft size={20} />
        </button>
        <SlidersHorizontal className="w-5 h-5 text-gray-400" />
        <h1 className="text-white text-lg md:text-xl font-bold tracking-tight flex-1">筛选</h1>
        <button
          onClick={onBack}
          className="hidden md:block px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
        >
          返回首页
        </button>
      </header>

      {/* 分类标签 - 顶级分类 */}
      <div className="flex overflow-x-auto px-5 pt-4 pb-1 md:px-8 gap-2 scrollbar-hide">
        <button
          onClick={() => handleTopCategoryClick(null)}
          className={`px-4 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
            topCategory === 0
              ? 'bg-white text-black font-medium'
              : 'bg-[#141414] text-gray-400 hover:bg-[#1a1a1a]'
          }`}
        >
          全部
        </button>
        {categories.filter(c => c.type_pid === 0).map((cat) => (
          <button
            key={cat.id}
            onClick={() => handleTopCategoryClick(cat)}
            className={`px-4 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
              topCategory === cat.type_id
                ? 'bg-white text-black font-medium'
                : 'bg-[#141414] text-gray-400 hover:bg-[#1a1a1a]'
            }`}
          >
            {cat.name}
          </button>
        ))}
      </div>

      {/* 分类标签 - 子分类（仅当选中顶级分类且有子分类时显示） */}
      {topCategory > 0 && categories.some(c => c.type_pid === topCategory) && (
        <div className="flex overflow-x-auto px-5 py-2 md:px-8 gap-2 scrollbar-hide">
          {categories.filter(c => c.type_pid === topCategory).map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                if (cat.id !== category) {
                  onCategoryChange(cat.id);
                }
              }}
              className={`px-3 py-1 rounded-md text-xs whitespace-nowrap transition-all ${
                category === cat.id
                  ? 'bg-purple-500/20 text-purple-300 font-medium border border-purple-500/30'
                  : 'bg-white/5 text-gray-500 hover:bg-white/10'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      )}

      {/* 影视网格 */}
      <div
        className="flex-1 overflow-y-auto px-5 py-3 md:px-8 border-t border-white/5"
        onScroll={handleScroll}
      >
        {videos.length === 0 && !loading ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Film className="w-16 h-16 mb-4 opacity-20" />
            <p>暂无数据</p>
            <p className="text-sm mt-1">该分类下没有内容，换个分类试试</p>
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
