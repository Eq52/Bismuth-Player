import { useState, useEffect } from 'react';
import { ArrowLeft, Star, Calendar, User, Film, Play, MapPin, Users } from 'lucide-react';
import { getVideoDetail, parsePlayUrls } from '@/services/api';
import { addPlayHistory } from '@/services/storage';
import type { VideoItem } from '@/types';

interface DetailPageProps {
  video: VideoItem;
  onBack: () => void;
  onPlay: (video: VideoItem, episodeIndex: number) => void;
}

export function DetailPage({ video, onBack, onPlay }: DetailPageProps) {
  const [detail, setDetail] = useState<VideoItem | null>(null);
  const [episodes, setEpisodes] = useState<{ name: string; url: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadDetail = async () => {
      setLoading(true);
      try {
        const data = await getVideoDetail(video.vod_id);
        if (data) {
          setDetail(data);
          const eps = parsePlayUrls(data.vod_play_url, data.vod_play_from);
          setEpisodes(eps);
        }
      } catch (error) {
        console.error('加载详情失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDetail();
  }, [video.vod_id]);

  // 处理播放
  const handlePlay = (episodeIndex: number) => {
    const ep = episodes[episodeIndex];
    if (ep && detail) {
      // 添加到历史记录
      addPlayHistory({
        vod_id: detail.vod_id,
        vod_name: detail.vod_name,
        vod_pic: detail.vod_pic,
        episode: episodeIndex,
        episodeName: ep.name,
        progress: 0,
        timestamp: Date.now(),
        sourceId: localStorage.getItem('current_source_id') || ''
      });
      
      onPlay(detail, episodeIndex);
    }
  };

  const displayData = detail || video;

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* 头部 */}
      <header className="px-5 py-4 flex items-center bg-[#0a0a0a] border-b border-white/5">
        <button 
          onClick={onBack}
          className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all mr-3"
        >
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-white text-base font-bold truncate flex-1">{displayData.vod_name}</h1>
      </header>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {/* 封面和信息 */}
            <div className="px-5 py-5">
              <div className="flex gap-4">
                {/* 封面 */}
                <div className="w-28 aspect-[3/4] rounded-xl overflow-hidden flex-shrink-0 shadow-xl shadow-purple-500/10">
                  <img
                    src={displayData.vod_pic}
                    alt={displayData.vod_name}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMTQxNDE0Ii8+PHBhdGggZD0iTTgwIDEyMGw0MCAzMC00MCAzMHoiIGZpbGw9IiMzMzMiLz48L3N2Zz4=';
                    }}
                  />
                </div>
                
                {/* 信息 */}
                <div className="flex-1 flex flex-col justify-between">
                  <div>
                    <h2 className="text-white text-lg font-bold mb-2 leading-tight">{displayData.vod_name}</h2>
                    
                    {displayData.vod_score && (
                      <div className="flex items-center mb-3">
                        <Star size={14} className="text-yellow-500 fill-yellow-500 mr-1" />
                        <span className="text-yellow-500 font-medium">{displayData.vod_score}</span>
                      </div>
                    )}
                    
                    <div className="space-y-1.5 text-xs">
                      {displayData.type_name && (
                        <div className="flex items-center text-gray-400">
                          <Film size={12} className="mr-2" />
                          <span>{displayData.type_name}</span>
                        </div>
                      )}
                      
                      {displayData.vod_year && (
                        <div className="flex items-center text-gray-400">
                          <Calendar size={12} className="mr-2" />
                          <span>{displayData.vod_year}</span>
                        </div>
                      )}
                      
                      {displayData.vod_area && (
                        <div className="flex items-center text-gray-400">
                          <MapPin size={12} className="mr-2" />
                          <span>{displayData.vod_area}</span>
                        </div>
                      )}
                      
                      {displayData.vod_director && (
                        <div className="flex items-center text-gray-400">
                          <User size={12} className="mr-2" />
                          <span className="truncate">{displayData.vod_director}</span>
                        </div>
                      )}
                      
                      {displayData.vod_actor && (
                        <div className="flex items-start text-gray-400">
                          <Users size={12} className="mr-2 mt-0.5" />
                          <span className="line-clamp-2">{displayData.vod_actor}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              
              {/* 简介 */}
              {displayData.vod_content && (
                <div className="mt-5">
                  <h3 className="text-white font-medium mb-2 text-sm">简介</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">
                    {displayData.vod_content.replace(/<[^>]+>/g, '')}
                  </p>
                </div>
              )}
            </div>
            
            {/* 选集 */}
            {episodes.length > 0 && (
              <div className="px-5 py-4 border-t border-white/5">
                <h3 className="text-white font-medium mb-3 text-sm">选集</h3>
                <div className="grid grid-cols-4 gap-2">
                  {episodes.map((ep, index) => (
                    <button
                      key={index}
                      onClick={() => handlePlay(index)}
                      className="bg-[#141414] border border-white/5 hover:border-purple-500/50 hover:bg-purple-500/10 text-white text-xs py-2.5 px-2 rounded-xl transition-all truncate"
                    >
                      {ep.name}
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* 播放按钮 */}
            {episodes.length > 0 && (
              <div className="px-5 py-4">
                <button
                  onClick={() => handlePlay(0)}
                  className="w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 text-white font-medium py-3.5 rounded-xl flex items-center justify-center transition-opacity hover:opacity-90 shadow-lg shadow-purple-500/25"
                >
                  <Play size={18} className="mr-2" fill="white" />
                  立即播放
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
