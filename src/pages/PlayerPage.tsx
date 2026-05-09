import { useState, useEffect, useRef } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { getVideoDetail, parsePlayUrls } from '@/services/api';
import { getPlayerSettings, addPlayHistory } from '@/services/storage';
import type { VideoItem } from '@/types';
import SimPlayer from '@/components/SimPlayer';

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

  // 获取当前播放地址（原始视频 URL）
  const getCurrentPlayUrl = () => {
    const ep = episodes[currentEpisode];
    return ep?.url || '';
  };

  // 获取外部播放器的 iframe URL
  const getExternalPlayerUrl = () => {
    const playerSettings = getPlayerSettings();
    const ep = episodes[currentEpisode];
    if (!ep) return '';
    
    if (playerSettings.playerUrl) {
      return `${playerSettings.playerUrl}${encodeURIComponent(ep.url)}`;
    }
    
    return ep.url;
  };

  // 切换集数
  const changeEpisode = (index: number) => {
    if (index >= 0 && index < episodes.length) {
      setCurrentEpisode(index);
      
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

  const prevEpisode = () => changeEpisode(currentEpisode - 1);
  const nextEpisode = () => changeEpisode(currentEpisode + 1);

  const displayData = detail || video;
  const currentEp = episodes[currentEpisode];
  const playerSettings = getPlayerSettings();
  const useBuiltinPlayer = playerSettings.playerMode === 'builtin';
  const currentPlayUrl = getCurrentPlayUrl();

  return (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* 头部 */}
      <header className="px-5 py-4 md:px-8 md:py-5 flex items-center bg-[#0a0a0a] border-b border-white/5">
        <button 
          onClick={onBack}
          className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all mr-3"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-white text-base md:text-lg font-bold truncate">{displayData.vod_name}</h1>
          {currentEp && (
            <div className="flex items-center gap-2">
              <p className="text-purple-400 text-sm truncate">{currentEp.name}</p>
              {useBuiltinPlayer && (
                <span className="text-[10px] text-purple-500/60 bg-purple-500/10 px-1.5 py-0.5 rounded">SimPlayer</span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* 播放器 + 选集 */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0 overflow-hidden">
        {/* 视频区域 */}
        <div className="relative bg-black aspect-video shrink-0 lg:aspect-auto lg:shrink lg:flex-1 lg:max-h-[calc(100vh-12rem)] min-w-0 overflow-hidden">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : currentPlayUrl ? (
            useBuiltinPlayer ? (
              <SimPlayer
                key={currentPlayUrl}
                src={currentPlayUrl}
                title={`${displayData.vod_name} - ${currentEp?.name || ''}`}
                poster={displayData.vod_pic}
                fillContainer
              />
            ) : (
              <iframe
                ref={iframeRef}
                src={getExternalPlayerUrl()}
                className="w-full h-full"
                allowFullScreen
                allow="autoplay; fullscreen"
              />
            )
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <p className="text-gray-500 text-sm">暂无播放地址</p>
            </div>
          )}
        </div>

        {/* 右侧面板：控制栏 + 选集 */}
        {episodes.length > 0 && (
          <div className="lg:w-72 xl:w-80 shrink-0 border-l border-white/5 bg-[#0a0a0a] flex flex-col min-h-0">
            {/* 控制栏 */}
            <div className="bg-[#141414] border-b border-white/5 px-5 py-3 flex items-center justify-between shrink-0">
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

            {/* 选集列表（可滚动） */}
            <div className="flex-1 overflow-y-auto px-5 py-4 min-h-0">
              <h3 className="text-white font-medium mb-3 text-sm">选集 <span className="text-gray-500 font-normal">({episodes.length})</span></h3>
              <div className="grid grid-cols-5 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-4 xl:grid-cols-5 gap-2">
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
          </div>
        )}
      </div>
    </div>
  );
}
