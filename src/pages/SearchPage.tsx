import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Search, X, Film } from 'lucide-react';
import { VideoCard } from '@/components/VideoCard';
import { searchVideos } from '@/services/api';
import type { VideoItem } from '@/types';

interface SearchPageProps {
  onVideoClick: (video: VideoItem) => void;
  onBack: () => void;
}

export function SearchPage({ onVideoClick, onBack }: SearchPageProps) {
  const [keyword, setKeyword] = useState('');
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // 加载搜索历史
  useEffect(() => {
    const stored = localStorage.getItem('bismuth_search_history');
    if (stored) {
      try {
        setSearchHistory(JSON.parse(stored));
      } catch {
        setSearchHistory([]);
      }
    }
  }, []);

  // 保存搜索历史
  const saveSearchHistory = useCallback((history: string[]) => {
    localStorage.setItem('bismuth_search_history', JSON.stringify(history.slice(0, 10)));
  }, []);

  // 执行搜索
  const handleSearch = useCallback(async (wd: string) => {
    if (!wd.trim()) return;
    
    setLoading(true);
    setHasSearched(true);
    
    try {
      const response = await searchVideos(wd);
      setVideos(response.list);
      
      // 更新搜索历史
      const newHistory = [wd, ...searchHistory.filter(h => h !== wd)].slice(0, 10);
      setSearchHistory(newHistory);
      saveSearchHistory(newHistory);
    } catch (error) {
      console.error('搜索失败:', error);
    } finally {
      setLoading(false);
    }
  }, [searchHistory, saveSearchHistory]);

  // 清除搜索历史
  const clearHistory = () => {
    setSearchHistory([]);
    localStorage.removeItem('bismuth_search_history');
  };

  // 删除单个历史记录
  const removeHistoryItem = (item: string) => {
    const newHistory = searchHistory.filter(h => h !== item);
    setSearchHistory(newHistory);
    saveSearchHistory(newHistory);
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* 头部搜索栏 */}
      <header className="px-5 py-4 flex items-center gap-3 bg-[#0a0a0a] border-b border-white/5">
        <button 
          onClick={onBack}
          className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 relative">
          <input
            type="text"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch(keyword)}
            placeholder="搜索影片..."
            className="w-full bg-[#141414] border border-white/5 text-white rounded-xl px-4 py-2.5 pl-11 pr-10 outline-none focus:border-purple-500/50 transition-colors text-sm"
            autoFocus
          />
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          {keyword && (
            <button
              onClick={() => setKeyword('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <button
          onClick={() => handleSearch(keyword)}
          className="px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-opacity"
        >
          搜索
        </button>
      </header>

      {/* 搜索结果或搜索历史 */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {!hasSearched ? (
          // 搜索历史
          <div>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium text-sm">搜索历史</h3>
              {searchHistory.length > 0 && (
                <button
                  onClick={clearHistory}
                  className="text-gray-500 text-xs hover:text-white transition-colors"
                >
                  清除全部
                </button>
              )}
            </div>
            {searchHistory.length === 0 ? (
              <p className="text-gray-600 text-sm">暂无搜索历史</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {searchHistory.map((item) => (
                  <div
                    key={item}
                    className="flex items-center bg-[#141414] border border-white/5 rounded-xl px-3 py-2"
                  >
                    <button
                      onClick={() => {
                        setKeyword(item);
                        handleSearch(item);
                      }}
                      className="text-gray-300 text-sm mr-2"
                    >
                      {item}
                    </button>
                    <button
                      onClick={() => removeHistoryItem(item)}
                      className="text-gray-500 hover:text-white transition-colors"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          // 搜索结果
          <div>
            {loading ? (
              <div className="flex justify-center py-12">
                <div className="w-6 h-6 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : videos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <Film className="w-16 h-16 mb-4 opacity-20" />
                <p>未找到相关影片</p>
                <p className="text-sm mt-1">换个关键词试试</p>
              </div>
            ) : (
              <div>
                <p className="text-gray-500 text-sm mb-4">
                  找到 <span className="text-white font-medium">{videos.length}</span> 个结果
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {videos.map((video) => (
                    <VideoCard
                      key={video.vod_id}
                      video={video}
                      onClick={() => onVideoClick(video)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
