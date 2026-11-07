import { ArrowLeft, Clock, Film, PlayCircle, Trash2, BarChart3 } from 'lucide-react';
import { useWatchStats, resetWatchStats } from '@/services/storage';
import { toast } from '@/hooks/use-toast';

interface StatsPageProps {
  onBack: () => void;
}

// 把秒数格式化为可读时长
function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h} 小时 ${m} 分`;
  if (m > 0) return `${m} 分钟`;
  return `${Math.round(seconds)} 秒`;
}

// 今天的日期键（本地时区 YYYY-MM-DD）
function todayKey(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function StatsPage({ onBack }: StatsPageProps) {
  const stats = useWatchStats();
  const todaySeconds = stats.daily[todayKey()] || 0;

  const videos = Object.entries(stats.perVideo)
    .map(([id, v]) => ({ id, ...v }))
    .sort((a, b) => b.seconds - a.seconds);

  const handleReset = () => {
    if (confirm('确定要清空全部观看统计吗？此操作不可恢复。')) {
      resetWatchStats();
      toast({ title: '观看统计已清空' });
    }
  };

  return (
    <div className="h-full flex flex-col bg-base">
      {/* 头部 */}
      <header className="px-5 py-4 md:px-8 md:py-5 flex items-center justify-between bg-base border-b border-white/5">
        <div className="flex items-center">
          <button
            onClick={onBack}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all mr-3"
          >
            <ArrowLeft size={20} />
          </button>
          <BarChart3 size={18} className="mr-2 text-gray-400" />
          <h1 className="text-white text-lg md:text-xl font-bold">观看统计</h1>
        </div>
        {stats.totalSeconds > 0 && (
          <button
            onClick={handleReset}
            className="p-2 text-gray-500 hover:text-red-400 hover:bg-white/5 rounded-xl transition-all"
            aria-label="清空统计"
          >
            <Trash2 size={18} />
          </button>
        )}
      </header>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 md:px-8 pb-24">
        <div className="max-w-3xl mx-auto">
          {stats.totalSeconds === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 text-center">
              <Clock size={40} className="text-gray-700 mb-3" />
              <p className="text-gray-500 text-sm">还没有观看记录，去看一集吧</p>
            </div>
          ) : (
            <>
              {/* 概览数字 */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-surface border border-white/5 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-1.5">
                    <Clock size={14} />
                    <span className="text-xs">累计观看</span>
                  </div>
                  <p className="text-white text-lg font-bold">{formatDuration(stats.totalSeconds)}</p>
                </div>
                <div className="bg-surface border border-white/5 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-1.5">
                    <Clock size={14} />
                    <span className="text-xs">今日观看</span>
                  </div>
                  <p className="text-white text-lg font-bold">{formatDuration(todaySeconds)}</p>
                </div>
                <div className="bg-surface border border-white/5 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-1.5">
                    <Film size={14} />
                    <span className="text-xs">看过的影视</span>
                  </div>
                  <p className="text-white text-lg font-bold">{stats.videoCount} 部</p>
                </div>
                <div className="bg-surface border border-white/5 rounded-xl p-4">
                  <div className="flex items-center gap-2 text-gray-500 mb-1.5">
                    <PlayCircle size={14} />
                    <span className="text-xs">播放次数</span>
                  </div>
                  <p className="text-white text-lg font-bold">{stats.playCount} 次</p>
                </div>
              </div>

              {/* 按影视列表 */}
              <div className="mt-4 bg-surface border border-white/5 rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5">
                  <p className="text-gray-400 text-sm font-medium">各影视观看时长</p>
                </div>
                <div className="divide-y divide-white/5">
                  {videos.map((v) => (
                    <div key={v.id} className="flex items-center justify-between px-4 py-3 gap-3">
                      <p className="text-white text-sm truncate min-w-0 flex-1">{v.name}</p>
                      <span className="text-gray-400 text-xs flex-shrink-0">{formatDuration(v.seconds)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <p className="mt-4 text-gray-600 text-xs leading-relaxed">
                统计数据仅保存在本机浏览器中，不会上传。卸载或清除浏览器数据会一并删除。
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
