import { useState, useEffect } from 'react';
import { Trash2, Play, Film } from 'lucide-react';
import { getPlayHistory, clearPlayHistory, removePlayHistory } from '@/services/storage';
import type { PlayHistory, VideoItem } from '@/types';

interface HistoryPageProps {
  onVideoClick: (video: VideoItem) => void;
}

export function HistoryPage({ onVideoClick }: HistoryPageProps) {
  const [history, setHistory] = useState<PlayHistory[]>([]);

  // 加载历史记录
  useEffect(() => {
    setHistory(getPlayHistory());
  }, []);

  // 清除所有历史
  const handleClearAll = () => {
    if (confirm('确定要清空所有播放历史吗？')) {
      clearPlayHistory();
      setHistory([]);
    }
  };

  // 删除单条历史
  const handleRemove = (vodId: number) => {
    removePlayHistory(vodId);
    setHistory(getPlayHistory());
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    if (days === 0) {
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours === 0) {
        const minutes = Math.floor(diff / (1000 * 60));
        return minutes === 0 ? '刚刚' : `${minutes}分钟前`;
      }
      return `${hours}小时前`;
    } else if (days === 1) {
      return '昨天';
    } else if (days < 7) {
      return `${days}天前`;
    } else {
      return date.toLocaleDateString('zh-CN');
    }
  };

  // 转换为VideoItem
  const toVideoItem = (h: PlayHistory): VideoItem => ({
    vod_id: h.vod_id,
    vod_name: h.vod_name,
    vod_pic: h.vod_pic,
  });

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* 头部 */}
      <header className="px-5 py-4 flex items-center justify-between bg-[#0a0a0a] border-b border-white/5">
        <h1 className="text-white text-lg font-bold">播放历史</h1>
        {history.length > 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center text-gray-400 hover:text-red-400 transition-colors"
          >
            <Trash2 size={18} className="mr-1" />
            <span className="text-sm">清空</span>
          </button>
        )}
      </header>

      {/* 历史列表 */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Film className="w-16 h-16 mb-4 opacity-20" />
            <p>暂无播放历史</p>
            <p className="text-sm mt-1">观看的影片会显示在这里</p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div
                key={item.vod_id}
                className="flex bg-[#141414] border border-white/5 rounded-xl overflow-hidden hover:border-white/10 transition-colors"
              >
                {/* 封面 */}
                <div 
                  onClick={() => onVideoClick(toVideoItem(item))}
                  className="w-24 aspect-[3/4] flex-shrink-0 cursor-pointer relative group"
                >
                  <img
                    src={item.vod_pic}
                    alt={item.vod_name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMTQxNDE0Ii8+PHBhdGggZD0iTTgwIDEyMGw0MCAzMC00MCAzMHoiIGZpbGw9IiMzMzMiLz48L3N2Zz4=';
                    }}
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Play className="w-6 h-6 text-white" fill="white" />
                  </div>
                </div>
                
                {/* 信息 */}
                <div className="flex-1 p-3 flex flex-col justify-between">
                  <div>
                    <h3 
                      onClick={() => onVideoClick(toVideoItem(item))}
                      className="text-white font-medium line-clamp-1 cursor-pointer hover:text-purple-400 transition-colors"
                    >
                      {item.vod_name}
                    </h3>
                    <p className="text-gray-500 text-sm mt-1">
                      看到: <span className="text-purple-400">{item.episodeName}</span>
                    </p>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-xs">
                      {formatTime(item.timestamp)}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onVideoClick(toVideoItem(item))}
                        className="flex items-center px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-medium rounded-lg hover:opacity-90 transition-opacity"
                      >
                        <Play size={12} className="mr-1" />
                        继续
                      </button>
                      <button
                        onClick={() => handleRemove(item.vod_id)}
                        className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
