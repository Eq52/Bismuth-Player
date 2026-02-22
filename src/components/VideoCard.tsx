import { Star, Play } from 'lucide-react';
import type { VideoItem } from '@/types';

interface VideoCardProps {
  video: VideoItem;
  onClick: () => void;
}

export function VideoCard({ video, onClick }: VideoCardProps) {
  return (
    <div 
      onClick={onClick}
      className="group relative bg-[#141414] rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-purple-500/10"
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        <img
          src={video.vod_pic || '/placeholder.png'}
          alt={video.vod_name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjMwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSIjMTQxNDE0Ii8+PHBhdGggZD0iTTgwIDEyMGw0MCAzMC00MCAzMHoiIGZpbGw9IiMzMzMiLz48L3N2Zz4=';
          }}
        />
        {/* 播放按钮遮罩 */}
        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
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
