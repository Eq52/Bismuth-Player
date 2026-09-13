import { useState, useEffect } from 'react';
import { Trash2, Play, Film, ArrowLeft, CloudOff } from 'lucide-react';
import { getPlayHistory, clearPlayHistory, removePlayHistory } from '@/services/storage';
import { getSources } from '@/services/api';
import type { PlayHistory, VideoItem } from '@/types';

interface HistoryPageProps {
  onVideoClick: (video: VideoItem) => void;
  onContinuePlay: (video: VideoItem, episode: number) => void;
  onBack: () => void;
}

export function HistoryPage({ onVideoClick, onContinuePlay, onBack }: HistoryPageProps) {
  const [history, setHistory] = useState<PlayHistory[]>([]);
  const [sourceNames, setSourceNames] = useState<Map<string, string>>(new Map());

  // 加载历史记录
  useEffect(() => {
    setHistory(getPlayHistory());
    // 源名反查表（老数据无 sourceName 时 fallback 显示）
    const map = new Map<string, string>();
    getSources().forEach(s => map.set(s.id, s.name));
    setSourceNames(map);
  }, []);

  // 条目的来源源名称：优先条目自带的 sourceName，老数据反查源列表
  const resolveSourceName = (item: PlayHistory) =>
    item.sourceName || sourceNames.get(item.sourceId) || '未知源';

  // 清除所有历史
  const handleClearAll = () => {
    if (confirm('确定要清空所有播放历史吗？')) {
      clearPlayHistory();
      setHistory([]);
    }
  };

  // 删除单条历史（按 vod_id + sourceId，避免误删其他源的同 ID 条目）
  const handleRemove = (vodId: number, sourceId: string) => {
    removePlayHistory(vodId, sourceId);
    setHistory(getPlayHistory());
  };

  // 格式化时间
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = Math.max(0, now.getTime() - date.getTime());
    
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

  // 转换为VideoItem（携带来源信息，供详情/播放器跨源拉取）
  const toVideoItem = (h: PlayHistory): VideoItem => ({
    vod_id: h.vod_id,
    vod_name: h.vod_name,
    vod_pic: h.vod_pic,
    sourceId: h.sourceId,
    sourceName: h.sourceName || sourceNames.get(h.sourceId) || '',
  });

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* 头部 */}
      <header className="px-5 py-4 md:px-8 md:py-5 flex items-center gap-3 bg-[#0a0a0a] border-b border-white/5">
        <button
          onClick={onBack}
          className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all md:hidden"
          title="返回"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-white text-lg md:text-xl font-bold flex-1">播放历史</h1>
        {history.length > 0 && (
          <button
            onClick={handleClearAll}
            className="flex items-center text-gray-400 hover:text-red-400 transition-colors"
          >
            <Trash2 size={18} className="mr-1" />
            <span className="text-sm">清空</span>
          </button>
        )}
        <button
          onClick={onBack}
          className="hidden md:block px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
        >
          返回首页
        </button>
      </header>

      {/* 历史列表 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 md:px-8">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-gray-500">
            <Film className="w-16 h-16 mb-4 opacity-20" />
            <p>暂无播放历史</p>
            <p className="text-sm mt-1">观看的影片会显示在这里</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 md:gap-4">
            {history.map((item) => (
              <div
                key={`${item.sourceId || 'legacy'}-${item.vod_id}`}
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
                    {/* 来源标注 */}
                    <div className="flex items-center gap-1 mt-1.5 flex-wrap">
                      <span className="inline-flex items-center text-[10px] text-gray-400 bg-white/5 border border-white/5 px-1.5 py-0.5 rounded max-w-full">
                        <Film size={9} className="mr-1 flex-shrink-0" />
                        <span className="truncate">{resolveSourceName(item)}</span>
                      </span>
                      {item.pendingDeleteAt && (
                        <span className="inline-flex items-center text-[10px] text-red-400/80 bg-red-500/10 border border-red-500/20 px-1.5 py-0.5 rounded">
                          <CloudOff size={9} className="mr-1 flex-shrink-0" />
                          源已删除·即将清理
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="text-gray-600 text-xs">
                      {formatTime(item.timestamp)}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onContinuePlay(toVideoItem(item), item.episode)}
                        className="flex items-center px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-xs font-medium rounded-lg hover:opacity-90 transition-opacity"
                      >
                        <Play size={12} className="mr-1" />
                        继续
                      </button>
                      <button
                        onClick={() => handleRemove(item.vod_id, item.sourceId)}
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
