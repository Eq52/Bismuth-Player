import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { getVideoDetail, parsePlayUrls } from '@/services/api';
import { getPlayerSettings, addPlayHistory } from '@/services/storage';
import type { VideoItem } from '@/types';

interface PlayerPageProps {
  video: VideoItem;
  initialEpisode?: number;
  onBack: () => void;
}

export function PlayerPage({ video, initialEpisode = 0, onBack }: PlayerPageProps) {
  const [detail, setDetail] = useState<VideoItem | null>(null);
  const [episodes, setEpisodes] = useState<{ name: string; url: string }[]>([]);
  const [currentEpisode, setCurrentEpisode] = useState(initialEpisode);
  const [loading, setLoading] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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

  // 获取当前播放地址
  const getPlayUrl = () => {
    const playerSettings = getPlayerSettings();
    const ep = episodes[currentEpisode];
    if (!ep) return '';
    
    // 使用配置的播放器
    if (playerSettings.playerUrl) {
      return `${playerSettings.playerUrl}${encodeURIComponent(ep.url)}`;
    }
    
    // 默认使用原生播放
    return ep.url;
  };

  // 切换集数
  const changeEpisode = (index: number) => {
    if (index >= 0 && index < episodes.length) {
      setCurrentEpisode(index);
      
      // 更新历史记录
      if (detail) {
        addPlayHistory({
          vod_id: detail.vod_id,
          vod_name: detail.vod_name,
          vod_pic: detail.vod_pic,
          episode: index,
          episodeName: episodes[index].name,
          progress: 0,
          timestamp: Date.now(),
          sourceId: localStorage.getItem('current_source_id') || ''
        });
      }
    }
  };

  // 上一集
  const prevEpisode = () => {
    changeEpisode(currentEpisode - 1);
  };

  // 下一集
  const nextEpisode = () => {
    changeEpisode(currentEpisode + 1);
  };

  const displayData = detail || video;
  const currentEp = episodes[currentEpisode];

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
        <div className="flex-1 min-w-0">
          <h1 className="text-white text-base font-bold truncate">{displayData.vod_name}</h1>
          {currentEp && (
            <p className="text-purple-400 text-sm truncate">{currentEp.name}</p>
          )}
        </div>
      </header>

      {/* 播放器 */}
      <div className="flex-1 flex flex-col">
        {/* 视频区域 */}
        <div className="relative bg-black aspect-video">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <iframe
              ref={iframeRef}
              src={getPlayUrl()}
              className="w-full h-full"
              allowFullScreen
              allow="autoplay; fullscreen"
            />
          )}
        </div>

        {/* 控制栏 */}
        {episodes.length > 0 && (
          <div className="bg-[#141414] border-b border-white/5 px-5 py-3 flex items-center justify-between">
            <button
              onClick={prevEpisode}
              disabled={currentEpisode === 0}
              className="flex items-center text-white disabled:text-gray-600 transition-colors"
            >
              <ChevronLeft size={18} />
              <span className="text-sm ml-1">上一集</span>
            </button>
            
            <span className="text-gray-400 text-sm">
              <span className="text-white font-medium">{currentEpisode + 1}</span>
              <span className="mx-1">/</span>
              <span>{episodes.length}</span>
            </span>
            
            <button
              onClick={nextEpisode}
              disabled={currentEpisode === episodes.length - 1}
              className="flex items-center text-white disabled:text-gray-600 transition-colors"
            >
              <span className="text-sm mr-1">下一集</span>
              <ChevronRight size={18} />
            </button>
          </div>
        )}

        {/* 选集 */}
        {episodes.length > 0 && (
          <div className="flex-1 overflow-y-auto px-5 py-4">
            <h3 className="text-white font-medium mb-3 text-sm">选集</h3>
            <div className="grid grid-cols-5 gap-2">
              {episodes.map((ep, index) => (
                <button
                  key={index}
                  onClick={() => changeEpisode(index)}
                  className={`text-xs py-2.5 px-1 rounded-xl transition-all truncate ${
                    index === currentEpisode
                      ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium'
                      : 'bg-[#1a1a1a] text-gray-400 hover:bg-[#222] border border-white/5'
                  }`}
                >
                  {ep.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
