import { useState, useEffect } from 'react';
import { ArrowLeft, Database, Trash2, HardDrive } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { getCacheSettings, saveCacheSettings } from '@/services/storage';
import { getCacheStats, clearApiCache } from '@/services/cache';
import type { CacheSettings } from '@/types';

interface CacheSettingsPageProps {
  onBack: () => void;
}

export function CacheSettingsPage({ onBack }: CacheSettingsPageProps) {
  const [cacheSettings, setCacheSettings] = useState<CacheSettings>({ enabled: true });
  const [apiCacheStats, setApiCacheStats] = useState({ count: 0, size: '0 B' });

  useEffect(() => {
    setCacheSettings(getCacheSettings());
    setApiCacheStats(getCacheStats());
  }, []);

  // 切换缓存
  const handleToggleCache = (enabled: boolean) => {
    const newSettings = { enabled };
    setCacheSettings(newSettings);
    saveCacheSettings(newSettings);
  };

  // 清除缓存
  const handleClearCache = () => {
    if (confirm('确定要清除所有缓存吗？')) {
      clearApiCache();
      setApiCacheStats(getCacheStats());
      alert('缓存已清除');
    }
  };

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
        <div className="flex items-center">
          <Database size={18} className="mr-2 text-gray-400" />
          <h1 className="text-white text-lg md:text-xl font-bold">缓存</h1>
        </div>
      </header>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 md:px-8 pb-24">
        <div className="max-w-3xl mx-auto">
          {/* 缓存开关 */}
          <div className="bg-[#141414] border border-white/5 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm">启用缓存</p>
                <p className="text-gray-500 text-xs">减少网络请求，加快加载速度</p>
              </div>
              <Switch
                checked={cacheSettings.enabled}
                onCheckedChange={handleToggleCache}
              />
            </div>

            {/* 缓存统计 */}
            <div className="flex items-center justify-between pt-3 border-t border-white/5">
              <div>
                <p className="text-white text-sm">API缓存</p>
                <p className="text-gray-500 text-xs">{apiCacheStats.count} 项 · {apiCacheStats.size}</p>
              </div>
              <Button
                onClick={handleClearCache}
                variant="outline"
                size="sm"
                className="border-white/10 text-gray-400 hover:text-white hover:bg-white/5"
              >
                <Trash2 size={14} className="mr-1.5" />
                清除
              </Button>
            </div>
          </div>

          {/* 缓存策略详情 */}
          <div className="mt-4 bg-[#141414] border border-white/5 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <HardDrive size={16} className="text-gray-500" />
              <p className="text-gray-400 text-sm font-medium">缓存策略</p>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <div>
                  <p className="text-white text-sm">影视列表</p>
                  <p className="text-gray-600 text-xs">首页和分类浏览的影视数据</p>
                </div>
                <span className="text-gray-400 text-xs bg-white/5 px-2 py-1 rounded">10 分钟</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <div>
                  <p className="text-white text-sm">分类数据</p>
                  <p className="text-gray-600 text-xs">影视分类和标签信息</p>
                </div>
                <span className="text-gray-400 text-xs bg-white/5 px-2 py-1 rounded">30 分钟</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-white/5">
                <div>
                  <p className="text-white text-sm">影视详情</p>
                  <p className="text-gray-600 text-xs">单个影视的详细信息</p>
                </div>
                <span className="text-gray-400 text-xs bg-white/5 px-2 py-1 rounded">60 分钟</span>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-white text-sm">搜索结果</p>
                  <p className="text-gray-600 text-xs">搜索请求不缓存，确保实时性</p>
                </div>
                <span className="text-gray-400 text-xs bg-white/5 px-2 py-1 rounded">不缓存</span>
              </div>
            </div>
          </div>

          {/* 说明 */}
          <div className="mt-6 flex items-start gap-2 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <Database className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <p className="text-gray-500 text-xs leading-relaxed">
              缓存可以显著减少网络请求次数，提升浏览体验。缓存数据存储在浏览器本地，不同类型的请求有不同的缓存有效期。当存储空间不足时，系统会自动清理最旧的 30% 缓存数据。关闭缓存后，所有请求将实时获取最新数据。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
