import { useState } from 'react';
import { Star, Play, Film } from 'lucide-react';
import type { VideoItem } from '@/types';

// 优雅的SVG占位图 - 电影胶片风格
const PLACEHOLDER_SVG = `data:image/svg+xml,${encodeURIComponent(`
<svg width="200" height="300" viewBox="0 0 200 300" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#1a1a2e"/>
      <stop offset="100%" style="stop-color:#16213e"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#6366f1"/>
      <stop offset="50%" style="stop-color:#a855f7"/>
      <stop offset="100%" style="stop-color:#ec4899"/>
    </linearGradient>
  </defs>
  <rect width="200" height="300" fill="url(#bg)"/>
  <!-- 左侧胶片孔 -->
  <rect x="8" y="15" width="12" height="18" rx="2" fill="#2a2a4a"/>
  <rect x="8" y="45" width="12" height="18" rx="2" fill="#2a2a4a"/>
  <rect x="8" y="75" width="12" height="18" rx="2" fill="#2a2a4a"/>
  <rect x="8" y="105" width="12" height="18" rx="2" fill="#2a2a4a"/>
  <rect x="8" y="135" width="12" height="18" rx="2" fill="#2a2a4a"/>
  <rect x="8" y="165" width="12" height="18" rx="2" fill="#2a2a4a"/>
  <rect x="8" y="195" width="12" height="18" rx="2" fill="#2a2a4a"/>
  <rect x="8" y="225" width="12" height="18" rx="2" fill="#2a2a4a"/>
  <rect x="8" y="255" width="12" height="18" rx="2" fill="#2a2a4a"/>
  <!-- 右侧胶片孔 -->
  <rect x="180" y="15" width="12" height="18" rx="2" fill="#2a2a4a"/>
  <rect x="180" y="45" width="12" height="18" rx="2" fill="#2a2a4a"/>
  <rect x="180" y="75" width="12" height="18" rx="2" fill="#2a2a4a"/>
  <rect x="180" y="105" width="12" height="18" rx="2" fill="#2a2a4a"/>
  <rect x="180" y="135" width="12" height="18" rx="2" fill="#2a2a4a"/>
  <rect x="180" y="165" width="12" height="18" rx="2" fill="#2a2a4a"/>
  <rect x="180" y="195" width="12" height="18" rx="2" fill="#2a2a4a"/>
  <rect x="180" y="225" width="12" height="18" rx="2" fill="#2a2a4a"/>
  <rect x="180" y="255" width="12" height="18" rx="2" fill="#2a2a4a"/>
  <!-- 中央播放图标 -->
  <circle cx="100" cy="130" r="35" fill="none" stroke="url(#accent)" stroke-width="2" opacity="0.3"/>
  <circle cx="100" cy="130" r="25" fill="none" stroke="url(#accent)" stroke-width="1.5" opacity="0.5"/>
  <polygon points="90,115 90,145 115,130" fill="url(#accent)" opacity="0.6"/>
  <!-- 底部装饰线 -->
  <rect x="30" y="270" width="140" height="2" rx="1" fill="url(#accent)" opacity="0.3"/>
</svg>
`)}`;

interface VideoCardProps {
  video: VideoItem;
  onClick: () => void;
}

export function VideoCard({ video, onClick }: VideoCardProps) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  return (
    <div 
      onClick={onClick}
      className="group relative bg-[#141414] rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/10"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-[#1a1a2e]">
        {/* 加载中的骨架屏动画 */}
        {!imageLoaded && !imageError && (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1a1a2e] via-[#252547] to-[#1a1a2e] animate-pulse">
            <div className="absolute inset-0 flex items-center justify-center">
              <Film className="w-10 h-10 text-gray-600 animate-pulse" />
            </div>
          </div>
        )}
        
        {/* 实际图片 */}
        <img
          src={imageError ? PLACEHOLDER_SVG : (video.vod_pic || PLACEHOLDER_SVG)}
          alt={video.vod_name}
          className={`w-full h-full object-cover transition-all duration-500 ${
            imageLoaded ? 'opacity-100 scale-100' : 'opacity-0 scale-105'
          } group-hover:scale-110`}
          loading="lazy"
          onLoad={() => setImageLoaded(true)}
          onError={(e) => {
            setImageError(true);
            setImageLoaded(true);
            (e.target as HTMLImageElement).src = PLACEHOLDER_SVG;
          }}
        />
        
        {/* 播放按钮遮罩 */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center transform scale-75 group-hover:scale-100 transition-transform duration-300">
            <Play className="w-5 h-5 text-white ml-1" fill="white" />
          </div>
        </div>
        
        {/* 标签 */}
        {video.vod_remarks && (
          <div className="absolute bottom-2 right-2 bg-black/70 backdrop-blur-sm px-2 py-1 rounded-lg text-xs text-white font-medium">
            {video.vod_remarks}
          </div>
        )}
      </div>
      <div className="p-2.5">
        <h3 className="text-white text-sm font-medium truncate group-hover:text-purple-400 transition-colors">{video.vod_name}</h3>
        {video.vod_score && (
          <div className="flex items-center mt-1.5">
            <Star size={12} className="text-yellow-500 fill-yellow-500" />
            <span className="text-yellow-500 text-xs ml-1 font-medium">{video.vod_score}</span>
          </div>
        )}
      </div>
    </div>
  );
}
