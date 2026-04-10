import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import { toast } from '@/hooks/use-toast';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Volume1,
  Maximize,
  Minimize,
  SkipForward,
  SkipBack,
  PictureInPicture2,
  Loader2,
  ChevronDown,
  Info,
  Camera,
  Keyboard,
  Trash2,
  X,
} from 'lucide-react';

interface SimPlayerProps {
  src: string;
  title?: string;
  poster?: string;
  /** 容器是否已控制好尺寸，播放器应 h-full 填充而非依赖 aspect-ratio */
  fillContainer?: boolean;
  onVideoInfo?: (info: { width: number; height: number; duration: number; format: string }) => void;
  onError?: (error: string) => void;
}

function formatTime(seconds: number): string {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function detectFormat(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes('.m3u8') || lower.includes('hls')) return 'HLS';
  if (lower.includes('.mp4')) return 'MP4';
  if (lower.includes('.webm')) return 'WebM';
  if (lower.includes('.ogg') || lower.includes('.ogv')) return 'OGG';
  return 'Unknown';
}

const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2];

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
}

interface VideoParams {
  width: number;
  height: number;
  duration: number;
  format: string;
  currentTime: number;
  playbackRate: number;
  volume: number;
  isMuted: boolean;
  buffered: number;
}

export default function SimPlayer({ src, title, poster, fillContainer, onVideoInfo, onError }: SimPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const controlsTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const contextMenuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [pipSupported] = useState(() => {
    if (typeof document === 'undefined') return false;
    return !!(document.pictureInPictureEnabled || (document as any).webkitPictureInPictureEnabled || (HTMLVideoElement.prototype as any).requestPictureInPicture);
  });

  const [isPlaying, setIsPlaying] = useState(false);
  const [hasEverPlayed, setHasEverPlayed] = useState(false);
  const [coverUrl] = useState<string | null>(poster || null);
  const [coverFading, setCoverFading] = useState(false);
  const [isPaused, setIsPaused] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [buffered, setBuffered] = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);
  const [hoverPosition, setHoverPosition] = useState(0);
  const [showScreenshotFlash, setShowScreenshotFlash] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });
  const [showParamsDialog, setShowParamsDialog] = useState(false);
  const [showShortcutsDialog, setShowShortcutsDialog] = useState(false);
  const [showResumePrompt, setShowResumePrompt] = useState(false);
  const [savedProgressTime, setSavedProgressTime] = useState(0);
  const resumePromptTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [videoResolution, setVideoResolution] = useState({ width: 0, height: 0 });
  const resumePromptShownRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);

  const format = useMemo(() => detectFormat(src), [src]);

  // Progress management
  const saveProgress = useCallback((time: number) => {
    if (!src || !duration) return;
    try {
      localStorage.setItem(`bismuth_progress_${src}`, JSON.stringify({ time, duration }));
    } catch {}
  }, [src, duration]);

  const loadProgress = useCallback((): number => {
    if (!src) return 0;
    try {
      const raw = localStorage.getItem(`bismuth_progress_${src}`);
      if (!raw) return 0;
      return JSON.parse(raw).time || 0;
    } catch { return 0; }
  }, [src]);

  const clearAllProgress = useCallback(() => {
    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('bismuth_progress_')) keysToRemove.push(key);
      }
      keysToRemove.forEach((k) => localStorage.removeItem(k));
    } catch {}
  }, []);

  const clearProgressForUrl = useCallback(() => {
    if (!src) return;
    try { localStorage.removeItem(`bismuth_progress_${src}`); } catch {}
  }, [src]);

  const handleResumeYes = useCallback(() => {
    setShowResumePrompt(false);
    if (resumePromptTimerRef.current) clearTimeout(resumePromptTimerRef.current);
    const video = videoRef.current;
    const saved = loadProgress();
    if (video && saved > 0 && video.duration > 0 && saved < video.duration - 2) {
      video.currentTime = saved;
    }
  }, [loadProgress]);

  const handleResumeNo = useCallback(() => {
    setShowResumePrompt(false);
    if (resumePromptTimerRef.current) clearTimeout(resumePromptTimerRef.current);
    clearProgressForUrl();
  }, [clearProgressForUrl]);

  const corsRetryRef = useRef(false);

  // Initialize video
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src) return;

    if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    corsRetryRef.current = false;
    video.crossOrigin = 'anonymous';

    const initHls = (withCORS: boolean) => {
      if (format === 'HLS' && Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          xhrSetup: withCORS ? (xhr) => { xhr.withCredentials = false; } : undefined,
        });
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_event, data) => {
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                onError?.('网络错误，请检查视频地址');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                onError?.('媒体错误，正在尝试恢复...');
                hls.recoverMediaError();
                break;
              default:
                onError?.('加载视频失败，请尝试其他地址');
                hls.destroy();
                break;
            }
          }
        });
        hlsRef.current = hls;
      } else if (format === 'HLS' && video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
      } else {
        video.src = src;
      }
    };

    initHls(true);

    const handleError = () => {
      if (!corsRetryRef.current && video.crossOrigin === 'anonymous') {
        corsRetryRef.current = true;
        video.removeAttribute('crossOrigin');
        if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
        initHls(false);
      }
    };

    video.addEventListener('error', handleError);
    return () => {
      video.removeEventListener('error', handleError);
      if (hlsRef.current) { hlsRef.current.destroy(); hlsRef.current = null; }
    };
  }, [src, format, onError]);

  // Video event listeners
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => { setIsPlaying(true); setIsPaused(false); if (!hasEverPlayed) { setHasEverPlayed(true); setCoverFading(true); setTimeout(() => setCoverFading(false), 500); } };
    const onPause = () => { setIsPlaying(false); setIsPaused(true); };
    const onTimeUpdate = () => { setCurrentTime(video.currentTime); if (video.buffered.length > 0) setBuffered(video.buffered.end(video.buffered.length - 1)); };
    const saveTimer = setInterval(() => { if (!video.paused && video.currentTime > 0) saveProgress(video.currentTime); }, 3000);
    const onDurationChange = () => setDuration(video.duration);
    const onWaiting = () => setIsBuffering(true);
    const onPlaying = () => setIsBuffering(false);
    const onCanPlay = () => {
      setIsBuffering(false);
      if (!resumePromptShownRef.current && src) {
        resumePromptShownRef.current = true;
        const saved = loadProgress();
        if (saved > 3 && video.duration > 0 && saved < video.duration - 2) {
          setSavedProgressTime(saved);
          setShowResumePrompt(true);
          if (resumePromptTimerRef.current) clearTimeout(resumePromptTimerRef.current);
          resumePromptTimerRef.current = setTimeout(() => { setShowResumePrompt(false); clearProgressForUrl(); }, 5000);
        }
      }
    };
    const onLoadedMetadata = () => {
      onVideoInfo?.({ width: video.videoWidth, height: video.videoHeight, duration: video.duration, format });
      setDuration(video.duration);
      setVideoResolution({ width: video.videoWidth, height: video.videoHeight });
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('durationchange', onDurationChange);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('playing', onPlaying);
    video.addEventListener('canplay', onCanPlay);
    video.addEventListener('loadedmetadata', onLoadedMetadata);

    return () => {
      clearInterval(saveTimer);
      if (video.currentTime > 0) saveProgress(video.currentTime);
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('durationchange', onDurationChange);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('playing', onPlaying);
      video.removeEventListener('canplay', onCanPlay);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
    };
  }, [onVideoInfo, format, saveProgress, loadProgress, src, clearProgressForUrl]);

  useEffect(() => { const v = videoRef.current; if (v) v.playbackRate = playbackRate; }, [playbackRate]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current; if (!v) return;
    v.paused ? v.play().catch(() => {}) : v.pause();
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current; if (!v) return;
    v.muted = !v.muted; setIsMuted(v.muted);
  }, []);

  const toggleFullscreen = useCallback(async () => {
    const c = containerRef.current; if (!c) return;
    try {
      if (!document.fullscreenElement) await c.requestFullscreen();
      else await document.exitFullscreen();
    } catch (err) { console.error('Fullscreen error:', err); }
  }, []);

  const handleMouseMove = useCallback(() => {
    if (isDraggingRef.current) return; // don't reset timer while dragging
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      setShowControls((prev) => {
        if (!isPlaying) return true;
        if (contextMenu.visible || showParamsDialog || showShortcutsDialog) return prev;
        return false;
      });
    }, 3000);
  }, [isPlaying, contextMenu.visible, showParamsDialog, showShortcutsDialog]);

  // 暂停时始终显示控制栏
  useEffect(() => {
    if (isPaused) {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    }
  }, [isPaused]);

  useEffect(() => { return () => { if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); }; }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const v = videoRef.current; if (!v) return;
      switch (e.key) {
        case ' ': case 'k': e.preventDefault(); v.paused ? v.play() : v.pause(); break;
        case 'ArrowLeft': e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 5); break;
        case 'ArrowRight': e.preventDefault(); v.currentTime = Math.min(v.duration, v.currentTime + 5); break;
        case 'ArrowUp': e.preventDefault(); v.volume = Math.min(1, v.volume + 0.1); setVolume(v.volume); setIsMuted(v.volume === 0); break;
        case 'ArrowDown': e.preventDefault(); v.volume = Math.max(0, v.volume - 0.1); setVolume(v.volume); setIsMuted(v.volume === 0); break;
        case 'f': e.preventDefault(); toggleFullscreen(); break;
        case 'm': if (showParamsDialog || showShortcutsDialog) { e.preventDefault(); setShowParamsDialog(false); setShowShortcutsDialog(false); } break;
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleFullscreen, showParamsDialog, showShortcutsDialog]);

  useEffect(() => {
    const h = () => {
      const isFs = !!document.fullscreenElement; setIsFullscreen(isFs);
      if (!isFs && (showParamsDialog || showShortcutsDialog)) { const c = containerRef.current; if (c) c.requestFullscreen().catch(() => {}); }
    };
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, [showParamsDialog, showShortcutsDialog]);

  const dismissContextMenu = useCallback(() => {
    setContextMenu((p) => ({ ...p, visible: false }));
    if (contextMenuTimerRef.current) { clearTimeout(contextMenuTimerRef.current); contextMenuTimerRef.current = null; }
  }, []);

  useEffect(() => {
    if (!contextMenu.visible) return;
    if (contextMenuTimerRef.current) clearTimeout(contextMenuTimerRef.current);
    contextMenuTimerRef.current = setTimeout(dismissContextMenu, 4000);
    const handleClickOutside = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest('[data-context-menu]')) dismissContextMenu(); };
    const handleCtxOutside = (e: MouseEvent) => { const t = (e.target as HTMLElement); const c = containerRef.current; if (c && !c.contains(t)) { dismissContextMenu(); return; } if (!t.closest('[data-context-menu]')) dismissContextMenu(); };
    const timer = setTimeout(() => { document.addEventListener('click', handleClickOutside, true); document.addEventListener('contextmenu', handleCtxOutside, true); }, 10);
    return () => { clearTimeout(timer); document.removeEventListener('click', handleClickOutside, true); document.removeEventListener('contextmenu', handleCtxOutside, true); if (contextMenuTimerRef.current) { clearTimeout(contextMenuTimerRef.current); contextMenuTimerRef.current = null; } };
  }, [contextMenu.visible, dismissContextMenu]);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value); const v = videoRef.current; if (v) { v.volume = vol; v.muted = vol === 0; } setVolume(vol); setIsMuted(vol === 0);
  }, []);

  // Seek to a position on the progress bar
  const seekToPosition = useCallback((clientX: number) => {
    const v = videoRef.current; const bar = progressRef.current; if (!v || !bar || !duration) return;
    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    v.currentTime = ratio * duration;
    setHoverTime(ratio * duration);
    setHoverPosition(clientX - rect.left);
  }, [duration]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) return; // avoid double-fire at end of drag
    seekToPosition(e.clientX);
  }, [seekToPosition]);

  const handleProgressHover = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (isDraggingRef.current) return; // hover preview is handled by drag during drag
    const bar = progressRef.current; if (!bar || !duration) return;
    const rect = bar.getBoundingClientRect(); setHoverTime(((e.clientX - rect.left) / rect.width) * duration); setHoverPosition(e.clientX - rect.left);
  }, [duration]);

  const handleProgressMouseDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    seekToPosition(e.clientX);
    // Keep controls visible while dragging
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
  }, [seekToPosition]);

  // Global mouse/touch move & up listeners for dragging
  useEffect(() => {
    if (!isDragging) return;

    const handleMove = (clientX: number) => {
      seekToPosition(clientX);
    };

    const handleMouseMove = (e: MouseEvent) => handleMove(e.clientX);
    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 0) handleMove(e.touches[0].clientX);
    };

    const handleUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      // Don't clear hoverTime immediately so the tooltip stays briefly
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchmove', handleTouchMove, { passive: true });
    document.addEventListener('touchend', handleUp);
    document.addEventListener('touchcancel', handleUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleUp);
      document.removeEventListener('touchcancel', handleUp);
    };
  }, [isDragging, seekToPosition]);

  const handlePiP = useCallback(async () => {
    const v = videoRef.current; if (!v || typeof v.requestPictureInPicture !== 'function') return;
    try { document.pictureInPictureElement ? await document.exitPictureInPicture() : await v.requestPictureInPicture(); } catch (err) { console.error('PiP error:', err); }
  }, []);

  const skipForward = useCallback(() => { const v = videoRef.current; if (v) v.currentTime = Math.min(v.duration, v.currentTime + 5); }, []);
  const skipBackward = useCallback(() => { const v = videoRef.current; if (v) v.currentTime = Math.max(0, v.currentTime - 5); }, []);

  const handleScreenshot = useCallback(() => {
    const v = videoRef.current; if (!v || v.videoWidth === 0) return;
    try {
      const canvas = document.createElement('canvas'); canvas.width = v.videoWidth; canvas.height = v.videoHeight;
      const ctx = canvas.getContext('2d'); if (!ctx) return;
      ctx.drawImage(v, 0, 0);
      try {
        canvas.toBlob((blob) => {
          if (!blob) { toast({ title: '截图失败', description: '无法生成截图数据' }); return; }
          const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url;
          a.download = `screenshot_${formatTime(currentTime).replace(/:/g, '-')}.png`;
          document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
        }, 'image/png');
      } catch { toast({ title: '截图失败', description: '跨域视频无法截取画面' }); return; }
      setShowScreenshotFlash(true); setTimeout(() => setShowScreenshotFlash(false), 300);
    } catch (err) { console.error('Screenshot error:', err); toast({ title: '截图失败', description: '发生未知错误' }); }
  }, [currentTime]);

  const lastClickRef = useRef<number>(0);
  const handleClick = useCallback((e: React.MouseEvent) => {
    const now = Date.now(); const gap = now - lastClickRef.current; lastClickRef.current = now;
    if (gap < 350) { e.preventDefault(); toggleFullscreen(); return; }
    setTimeout(() => { if (Date.now() - lastClickRef.current >= 340) togglePlay(); }, 360);
  }, [toggleFullscreen, togglePlay]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); setShowSpeedMenu(false);
    const vw = window.innerWidth; const vh = window.innerHeight; const mW = 180; const mH = 120;
    let mX = e.clientX; let mY = e.clientY;
    if (mX + mW > vw) mX = vw - mW - 4; if (mY + mH > vh) mY = vh - mH - 4;
    if (mX < 4) mX = 4; if (mY < 4) mY = 4;
    dismissContextMenu(); setContextMenu({ visible: true, x: mX, y: mY });
  }, [dismissContextMenu]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const bufferedProgress = duration > 0 ? (buffered / duration) * 100 : 0;
  const VolumeIcon = isMuted || volume === 0 ? VolumeX : volume < 0.5 ? Volume1 : Volume2;

  const videoParams: VideoParams = { width: videoResolution.width, height: videoResolution.height, duration, format, currentTime, playbackRate, volume: isMuted ? 0 : volume, isMuted, buffered };

  return (
    <div
      ref={containerRef}
      className="sim-player-container relative w-full h-full bg-black overflow-hidden group select-none"
      style={isFullscreen || fillContainer ? undefined : { aspectRatio: '16/9' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
        controlsTimeoutRef.current = setTimeout(() => {
          if (isPlaying && !contextMenu.visible && !showParamsDialog && !showShortcutsDialog) setShowControls(false);
        }, 800);
      }}
      onContextMenu={handleContextMenu}
    >
      <video ref={videoRef} className="w-full h-full object-contain" playsInline crossOrigin="anonymous" preload="metadata" onClick={handleClick} />

      {/* Video Cover */}
      {!hasEverPlayed && coverUrl && (
        <div className={`absolute inset-0 z-15 pointer-events-none ${coverFading ? 'animate-cover-fade-out' : ''}`}>
          <img src={coverUrl} alt="Video cover" className="w-full h-full object-cover" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-black/20" />
        </div>
      )}

      {/* Screenshot flash */}
      {showScreenshotFlash && <div className="absolute inset-0 bg-white/30 z-25 pointer-events-none animate-screenshot-flash" />}

      {/* Buffering */}
      {isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20 pointer-events-none">
          <Loader2 className="w-10 h-10 sm:w-12 sm:h-12 text-purple-400 animate-spin" />
        </div>
      )}

      {/* Center Play Button */}
      {isPaused && !isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center z-20 cursor-pointer" onClick={togglePlay}>
          <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 rounded-full bg-black/50 flex items-center justify-center backdrop-blur-sm transition-transform hover:scale-110">
            <Play className="w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10 text-white ml-1" fill="white" />
          </div>
        </div>
      )}

      {/* Top Bar */}
      <div className={`absolute top-0 left-0 right-0 z-30 transition-opacity duration-300 ${showControls || isDragging ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
        <div className="bg-gradient-to-b from-black/70 to-transparent px-4 py-3">
          <div className="flex items-center justify-between">
            <h3 className="text-white text-sm font-medium truncate max-w-[70%]">{title || 'Bismuth Player'}</h3>
            <span className="text-purple-300/70 text-xs">{format}</span>
          </div>
        </div>
      </div>

      {/* 进度条热区 — 控件隐藏时仍可通过 hover 触发显示；控件可见时禁用指针事件以免遮挡进度条 */}
      <div className={`absolute bottom-12 left-0 right-0 z-[31] h-6 ${showControls || isDragging ? 'pointer-events-none' : 'pointer-events-auto'}`}
        onMouseEnter={() => { setShowControls(true); if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); }}
      />

      {/* Progress Bar */}
      <div className={`absolute bottom-14 left-0 right-0 z-30 transition-opacity duration-300 ${showControls || isDragging ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onMouseLeave={() => setHoverTime(null)}
      >
        <div ref={progressRef} className={`relative h-1 group/progress cursor-pointer ${isDragging ? 'h-2 progress-bar-dragging' : 'hover:h-2'} transition-all`} style={{ touchAction: 'none' }} onClick={handleProgressClick} onMouseDown={handleProgressMouseDown} onMouseMove={handleProgressHover} onMouseLeave={() => { if (!isDraggingRef.current) setHoverTime(null); }} onTouchStart={(e) => { const t = e.touches[0]; if (t) { e.preventDefault(); isDraggingRef.current = true; setIsDragging(true); seekToPosition(t.clientX); if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); } }}>
          <div className="absolute inset-0 bg-white/15 rounded-full" />
          <div className="absolute inset-y-0 left-0 bg-white/25 rounded-full" style={{ width: `${bufferedProgress}%` }} />
          <div className="absolute inset-y-0 left-0 bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full" style={{ width: `${progress}%` }} />
          <div className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-lg border-2 border-purple-400 transition-opacity ${isDragging || hoverTime !== null ? 'opacity-100' : 'opacity-0 group-hover/progress:opacity-100'}`} style={{ left: `${progress}%`, marginLeft: '-6px' }} />
          {hoverTime !== null && (
            <div className="absolute -top-8 transform -translate-x-1/2 bg-black/80 text-white text-xs px-2 py-1 rounded pointer-events-none" style={{ left: `${hoverPosition}px` }}>
              {formatTime(hoverTime)}
            </div>
          )}
        </div>
      </div>

      {/* Resume Prompt */}
      {showResumePrompt && (
        <div className="absolute bottom-16 right-3 z-40 animate-fade-in">
          <div className="bg-black/70 backdrop-blur-md rounded-xl border border-white/10 px-3 py-2.5 shadow-xl">
            <p className="text-white/80 text-[11px] mb-2 whitespace-nowrap">跳转至上次播放位置 {formatTime(savedProgressTime)}？</p>
            <div className="flex gap-2">
              <button onClick={handleResumeYes} className="bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-[11px] px-3 py-1 rounded-lg hover:opacity-90 transition-opacity">是</button>
              <button onClick={handleResumeNo} className="bg-white/15 hover:bg-white/25 text-white text-[11px] px-3 py-1 rounded-lg transition-colors">否</button>
            </div>
          </div>
        </div>
      )}

      {/* Control Bar */}
      <div className={`absolute bottom-0 left-0 right-0 z-30 transition-opacity duration-300 ${showControls || isDragging ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onMouseEnter={() => { setShowControls(true); if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current); }}
      >
        <div className="bg-gradient-to-t from-black/80 to-transparent px-2 sm:px-3 py-1.5 sm:py-2">
          <div className="flex items-center justify-between gap-0.5 sm:gap-2">
            <div className="flex items-center gap-0.5 sm:gap-1 min-w-0">
              <button onClick={togglePlay} className="p-1 sm:p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white" aria-label={isPlaying ? 'Pause' : 'Play'}>
                {isPlaying ? <Pause className="w-4 h-4 sm:w-5 sm:h-5" fill="white" /> : <Play className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5" fill="white" />}
              </button>
              <button onClick={skipBackward} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white hidden sm:block" aria-label="Skip back"><SkipBack className="w-4 h-4" /></button>
              <button onClick={skipForward} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white hidden sm:block" aria-label="Skip forward"><SkipForward className="w-4 h-4" /></button>
              <span className="text-white text-[10px] sm:text-xs font-mono ml-0.5 sm:ml-1 whitespace-nowrap">{formatTime(currentTime)} / {formatTime(duration)}</span>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <div className="flex items-center group/vol">
                <button onClick={toggleMute} className="p-1 sm:p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white" aria-label="Toggle mute"><VolumeIcon className="w-4 h-4 sm:w-5 sm:h-5" /></button>
              </div>
              <div className="relative">
                <button onClick={() => setShowSpeedMenu(!showSpeedMenu)} className="p-1 sm:p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white flex items-center gap-0.5 sm:gap-1" aria-label="Playback speed">
                  <span className="text-[10px] sm:text-xs font-medium">{playbackRate}x</span><ChevronDown className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                </button>
                {showSpeedMenu && (
                  <div className="absolute bottom-full right-0 mb-2 bg-[#1a1a1a]/95 backdrop-blur-md rounded-xl py-1 min-w-[72px] sm:min-w-[80px] shadow-xl border border-white/10">
                    {PLAYBACK_SPEEDS.map((speed) => (
                      <button key={speed} onClick={() => { setPlaybackRate(speed); setShowSpeedMenu(false); }}
                        className={`w-full px-3 sm:px-4 py-1 sm:py-1.5 text-xs sm:text-sm text-left hover:bg-white/10 transition-colors ${playbackRate === speed ? 'text-purple-400 font-medium' : 'text-white'}`}>
                        {speed}x
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={handleScreenshot} className="p-1 sm:p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white" aria-label="Screenshot" title="截取当前画面"><Camera className="w-4 h-4 sm:w-5 sm:h-5" /></button>
              {pipSupported && <button onClick={handlePiP} className="p-1 sm:p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white" aria-label="PiP"><PictureInPicture2 className="w-4 h-4 sm:w-5 sm:h-5" /></button>}
              <button onClick={toggleFullscreen} className="p-1 sm:p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white" aria-label={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
                {isFullscreen ? <Minimize className="w-4 h-4 sm:w-5 sm:h-5" /> : <Maximize className="w-4 h-4 sm:w-5 sm:h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right-Click Context Menu */}
      {contextMenu.visible && (
        <div data-context-menu className="fixed z-[60] animate-context-menu-in" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(e) => e.stopPropagation()} onContextMenu={(e) => e.stopPropagation()}
          onMouseEnter={() => { if (contextMenuTimerRef.current) { clearTimeout(contextMenuTimerRef.current); contextMenuTimerRef.current = null; } }}
          onMouseLeave={() => { if (contextMenuTimerRef.current) clearTimeout(contextMenuTimerRef.current); contextMenuTimerRef.current = setTimeout(dismissContextMenu, 2000); }}>
          <div className="bg-black/50 backdrop-blur-xl rounded-xl border border-white/8 shadow-2xl py-1 min-w-[180px] overflow-hidden">
            <button onClick={() => { dismissContextMenu(); handleScreenshot(); }} className="w-full flex items-center gap-2.5 px-3 py-[7px] hover:bg-white/10 transition-colors text-left">
              <Camera className="w-3.5 h-3.5 text-purple-400 shrink-0" /><span className="text-white/90 text-[13px]">截取当前画面</span>
            </button>
            <div className="mx-2 border-t border-white/8" />
            <button onClick={() => { dismissContextMenu(); setShowParamsDialog(true); }} className="w-full flex items-center gap-2.5 px-3 py-[7px] hover:bg-white/10 transition-colors text-left">
              <Info className="w-3.5 h-3.5 text-purple-400 shrink-0" /><span className="text-white/90 text-[13px]">查看视频参数</span>
            </button>
            <div className="mx-2 border-t border-white/8" />
            <button onClick={() => { dismissContextMenu(); setShowShortcutsDialog(true); }} className="w-full flex items-center gap-2.5 px-3 py-[7px] hover:bg-white/10 transition-colors text-left">
              <Keyboard className="w-3.5 h-3.5 text-purple-400 shrink-0" /><span className="text-white/90 text-[13px]">快捷键帮助</span>
            </button>
            <div className="mx-2 border-t border-white/8" />
            <button onClick={() => { dismissContextMenu(); clearAllProgress(); toast({ title: '已清除', description: '所有播放缓存已删除' }); }} className="w-full flex items-center gap-2.5 px-3 py-[7px] hover:bg-white/10 transition-colors text-left">
              <Trash2 className="w-3.5 h-3.5 text-purple-400 shrink-0" /><span className="text-white/90 text-[13px]">删除播放缓存</span>
            </button>
          </div>
        </div>
      )}

      {/* Video Params Dialog */}
      {showParamsDialog && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowParamsDialog(false)}>
          <div className="bg-[#141414]/95 backdrop-blur-md border border-white/10 rounded-2xl p-5 max-w-xs w-full mx-4 animate-dialog-in shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium text-sm flex items-center gap-2"><Info className="w-4 h-4 text-purple-400" />视频参数</h3>
              <button onClick={() => setShowParamsDialog(false)} className="text-gray-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2.5 text-xs">
              {[
                { label: '分辨率', value: videoParams.width && videoParams.height ? `${videoParams.width} × ${videoParams.height}` : '未知' },
                { label: '时长', value: formatTime(videoParams.duration) },
                { label: '格式', value: videoParams.format },
                { label: '当前时间', value: formatTime(videoParams.currentTime) },
                { label: '播放速度', value: `${videoParams.playbackRate}x` },
                { label: '音量', value: `${Math.round((videoParams.isMuted ? 0 : videoParams.volume) * 100)}%` },
                { label: '缓冲', value: formatTime(videoParams.buffered) },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-gray-400">{item.label}</span><span className="text-white font-medium">{item.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Shortcuts Dialog */}
      {showShortcutsDialog && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowShortcutsDialog(false)}>
          <div className="bg-[#141414]/95 backdrop-blur-md border border-white/10 rounded-2xl p-5 max-w-xs w-full mx-4 animate-dialog-in shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-medium text-sm flex items-center gap-2"><Keyboard className="w-4 h-4 text-purple-400" />快捷键</h3>
              <button onClick={() => setShowShortcutsDialog(false)} className="text-gray-400 hover:text-white transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="space-y-2 text-xs">
              {[
                { key: 'Space / K', desc: '播放 / 暂停' },
                { key: '← →', desc: '快退 / 快进 5 秒' },
                { key: '↑ ↓', desc: '音量增减 10%' },
                { key: 'F', desc: '切换全屏' },
                { key: 'M', desc: '关闭弹窗' },
                { key: '双击画面', desc: '切换全屏' },
              ].map((item) => (
                <div key={item.key} className="flex justify-between items-center py-1.5 border-b border-white/5 last:border-0">
                  <span className="text-gray-400">{item.desc}</span><kbd className="text-purple-300 bg-white/5 px-2 py-0.5 rounded font-mono text-[11px]">{item.key}</kbd>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
