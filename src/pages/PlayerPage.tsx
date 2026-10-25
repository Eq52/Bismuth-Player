import { useState, useEffect, useRef, useCallback } from 'react';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { getVideoDetail, parsePlayUrls, getCurrentSource, SourceDeletedError } from '@/services/api';
import { getPlayerSettings, addPlayHistory } from '@/services/storage';
import { isDesktopMode, desktopMediaUrl } from '@/services/desktop';
import { SourceDeletedNotice } from '@/components/SourceDeletedNotice';
import type { VideoItem, PlayerSettings } from '@/types';
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
  // 来源源被删除时的错误态（历史/收藏「继续播放」直接进播放器的兜底）
  const [deletedSource, setDeletedSource] = useState<{ id: string; name: string } | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const playerContainerRef = useRef<HTMLDivElement>(null);
  const [playerSettings] = useState<PlayerSettings>(getPlayerSettings);

  // 自动连播：一集播放完毕（内置 SimPlayer 的 video ended 冒泡捕获）后 3 秒自动切下一集。
  // 不改动 SimPlayer；外部 iframe 播放器无法跨域检测 ended，自动连播仅内置模式生效。
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoNextRef = useRef(playerSettings.autoNext === true);
  autoNextRef.current = playerSettings.autoNext === true;
  const episodeCountRef = useRef(episodes.length);
  episodeCountRef.current = episodes.length;
  const currentEpisodeRef = useRef(currentEpisode);
  currentEpisodeRef.current = currentEpisode;
  // changeEpisode 的稳定引用，供 ended 回调使用（赋值见 changeEpisode 定义后）
  const changeEpisodeRef = useRef<(index: number) => void>(() => {});

  // 清除连播倒计时（手动切换/取消/组件卸载时调用）
  const clearAutoNextTimer = useCallback(() => {
    if (countdownTimerRef.current) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setAutoNextCountdown(null);
  }, []);

  // 切换集数提示气泡（手动切换与自动连播共用，带入场/出场动效）
  const [episodeHint, setEpisodeHint] = useState<string | null>(null);
  const [episodeHintOut, setEpisodeHintOut] = useState(false);
  const episodeHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showEpisodeHint = useCallback((text: string) => {
    setEpisodeHintOut(false);
    setEpisodeHint(text);
    if (episodeHintTimerRef.current) clearTimeout(episodeHintTimerRef.current);
    episodeHintTimerRef.current = setTimeout(() => {
      setEpisodeHintOut(true); // 出场动画后再移除
      window.setTimeout(() => setEpisodeHint(null), 240);
    }, 1800);
  }, []);

  // 卸载时清理提示定时器
  useEffect(() => () => {
    if (episodeHintTimerRef.current) clearTimeout(episodeHintTimerRef.current);
  }, []);

  // 一集播放完毕：开启 3 秒倒计时自动连播（最后一集不连播）
  const handleVideoEnded = useCallback(() => {
    if (!autoNextRef.current) return;
    if (currentEpisodeRef.current >= episodeCountRef.current - 1) return;
    clearAutoNextTimer();
    let remain = 3;
    setAutoNextCountdown(3);
    countdownTimerRef.current = setInterval(() => {
      remain -= 1;
      if (remain <= 0) {
        clearAutoNextTimer();
        changeEpisodeRef.current(currentEpisodeRef.current + 1);
      } else {
        setAutoNextCountdown(remain);
      }
    }, 1000);
  }, [clearAutoNextTimer]);

  // 监听内置播放器视频播放完毕（ended 冒泡 + capture 捕获，不依赖 SimPlayer 改动）
  useEffect(() => {
    const el = playerContainerRef.current;
    if (!el) return;
    const onEnded = (e: Event) => {
      if (e.target instanceof HTMLVideoElement) handleVideoEnded();
    };
    el.addEventListener('ended', onEnded, true);
    return () => {
      el.removeEventListener('ended', onEnded, true);
      clearAutoNextTimer();
    };
  }, [handleVideoEnded, clearAutoNextTimer]);

  useEffect(() => {
    setCurrentEpisode(initialEpisode);
    const loadDetail = async () => {
      setLoading(true);
      setDeletedSource(null);
      try {
        // 跨源播放：优先用条目标注的源拉详情（老数据无 sourceId 则用当前源）
        const data = await getVideoDetail(video.vod_id, video.sourceId, video.sourceName);
        if (data) {
          setDetail(data);
          const eps = parsePlayUrls(data.vod_play_url, data.vod_play_from);
          setEpisodes(eps);
        }
      } catch (error) {
        if (error instanceof SourceDeletedError) {
          setDeletedSource({ id: error.sourceId, name: error.sourceName });
        } else {
          console.error('加载详情失败:', error);
        }
      } finally {
        setLoading(false);
      }
    };

    loadDetail();
  }, [video.vod_id, video.sourceId, video.sourceName, initialEpisode]);

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
      clearAutoNextTimer(); // 手动切换集数时取消连播倒计时
      showEpisodeHint(`正在播放：第${index + 1}集${episodes[index]?.name ? ' · ' + episodes[index].name : ''}`);
      setCurrentEpisode(index);
      
      if (detail) {
        // 历史标注沿用本次实际使用的源：优先条目标注源，兼容老数据用当前源
        const source = getCurrentSource();
        addPlayHistory({
          vod_id: detail.vod_id,
          vod_name: detail.vod_name,
          vod_pic: detail.vod_pic,
          episode: index,
          episodeName: episodes[index].name,
          progress: 0,
          timestamp: Date.now(),
          sourceId: video.sourceId || source?.id || '',
          sourceName: video.sourceName || source?.name || ''
        });
      }
    }
  };
  changeEpisodeRef.current = changeEpisode;

  const prevEpisode = () => changeEpisode(currentEpisode - 1);
  const nextEpisode = () => changeEpisode(currentEpisode + 1);

  const displayData = detail || video;
  const currentEp = episodes[currentEpisode];
  const useBuiltinPlayer = playerSettings.playerMode === 'builtin';
  const currentPlayUrl = getCurrentPlayUrl();
  // 桌面版：内置代理以路径式包装媒体地址（m3u8 相对分片自动跟随代理；mp4 Range 透传）
  const currentMediaUrl = isDesktopMode() ? desktopMediaUrl(currentPlayUrl) : currentPlayUrl;

  return (
    <div className="h-full flex flex-col bg-base">
      {/* 头部 */}
      <header className="px-5 py-4 md:px-8 md:py-5 flex items-center bg-base border-b border-white/5">
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
        <div ref={playerContainerRef} className="relative bg-black aspect-video shrink-0 lg:aspect-auto lg:shrink lg:flex-1 lg:max-h-[calc(100vh-12rem)] min-w-0 overflow-hidden">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : deletedSource ? (
            <div className="absolute inset-0 overflow-y-auto bg-base flex items-center justify-center">
              <SourceDeletedNotice sourceId={deletedSource.id} sourceName={deletedSource.name} />
            </div>
          ) : currentPlayUrl ? (
            useBuiltinPlayer ? (
              <SimPlayer
                key={currentPlayUrl}
                src={currentMediaUrl}
                title={`${displayData.vod_name} - ${currentEp?.name || ''}`}
                poster={displayData.vod_pic}
                fillContainer
                externalFullscreenRef={playerContainerRef}
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

          {/* 切换集数提示气泡（入场/出场动效） */}
          {episodeHint && (
            <div
              className={`absolute top-3 left-1/2 z-30 ${episodeHintOut ? 'bi-toast-out' : 'bi-toast-in'}`}
            >
              <div className="px-4 py-1.5 bg-black/70 backdrop-blur-sm rounded-full">
                <span className="text-white text-sm whitespace-nowrap max-w-[70vw] truncate block">{episodeHint}</span>
              </div>
            </div>
          )}

          {/* 自动连播倒计时提示 */}
          {autoNextCountdown !== null && (
            <div className="absolute bottom-4 left-1/2 z-30 bi-toast-in flex items-center gap-3 bg-black/75 backdrop-blur px-4 py-2 rounded-full whitespace-nowrap">
              <span className="text-white text-sm">{autoNextCountdown} 秒后自动播放下一集</span>
              <button
                onClick={clearAutoNextTimer}
                className="text-purple-400 text-sm font-medium hover:text-purple-300"
              >
                取消
              </button>
            </div>
          )}
        </div>

        {/* 右侧面板：控制栏 + 选集 */}
        {episodes.length > 0 && (
          <div className="lg:w-72 xl:w-80 shrink-0 lg:shrink-0 flex-1 lg:flex-none max-h-[45vh] lg:max-h-none border-l border-white/5 bg-base flex flex-col min-h-0">
            {/* 控制栏 */}
            <div className="bg-surface border-b border-white/5 px-5 py-3 flex items-center justify-between shrink-0">
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
                        ? 'bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium episode-current'
                        : 'bg-elevated text-gray-400 hover:bg-elevated border border-white/5'
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
