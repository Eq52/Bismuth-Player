import { useState, useEffect } from 'react';
import { ArrowLeft, Monitor, Database, Info, ChevronRight, Settings, HardDrive } from 'lucide-react';
import { getCorsProxyList, isCorsProxyEnabled } from '@/services/storage';
import { getCacheStats } from '@/services/cache';

// 从 Vite define 注入的版本号（类型声明见 env.d.ts）
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '8.0.0';
const APP_DISPLAY_VERSION = 'V' + APP_VERSION.split('.')[0];

export type SettingsSubPage = 'none' | 'source' | 'player' | 'cors' | 'cache' | 'about';

interface SettingsPageProps {
  onBack?: () => void;
  subPage?: SettingsSubPage;
  onSubPageChange?: (page: SettingsSubPage) => void;
}

export function SettingsPage({ onBack, subPage = 'none', onSubPageChange }: SettingsPageProps) {
  const [proxyCount, setProxyCount] = useState(0);
  const [proxyEnabled, setProxyEnabled] = useState(true);
  const [cacheCount, setCacheCount] = useState(0);

  useEffect(() => {
    if (subPage === 'none') {
      setProxyCount(getCorsProxyList().length);
      setProxyEnabled(isCorsProxyEnabled());
      setCacheCount(getCacheStats().count);
    }
  }, [subPage]);

  const handleSubPage = (page: SettingsSubPage) => {
    onSubPageChange?.(page);
  };

  // 设置首页
  const renderSettingsHome = () => (
    <div className="h-full flex flex-col bg-[#0a0a0a]">
      {/* 头部 */}
      <header className="px-5 py-4 md:px-8 md:py-5 flex items-center bg-[#0a0a0a] border-b border-white/5">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all mr-3 md:hidden"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <div className="flex items-center">
          <Settings size={18} className="mr-2 text-gray-400" />
          <h1 className="text-white text-lg md:text-xl font-bold">设置</h1>
        </div>
      </header>

      {/* 菜单列表 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 md:px-8 pb-24">
        <div className="max-w-3xl mx-auto">
          <div className="bg-[#141414] border border-white/5 rounded-xl overflow-hidden divide-y divide-white/5">
            {/* 影视源 */}
            <button
              onClick={() => handleSubPage('source')}
              className="w-full flex items-center px-4 py-3.5 hover:bg-white/[0.02] transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0">
                  <Monitor size={16} className="text-indigo-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm">影视源</p>
                  <p className="text-gray-500 text-xs">管理影视内容来源</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-600 flex-shrink-0" />
            </button>

            {/* 播放器 */}
            <button
              onClick={() => handleSubPage('player')}
              className="w-full flex items-center px-4 py-3.5 hover:bg-white/[0.02] transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm">播放器</p>
                  <p className="text-gray-500 text-xs">播放模式与功能设置</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-600 flex-shrink-0" />
            </button>

            {/* CORS代理 */}
            <button
              onClick={() => handleSubPage('cors')}
              className="w-full flex items-center px-4 py-3.5 hover:bg-white/[0.02] transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                  <Database size={16} className="text-green-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm">CORS代理</p>
                  <p className="text-gray-500 text-xs">
                    {proxyEnabled
                      ? `${proxyCount} 个代理已启用`
                      : '代理已关闭'}
                  </p>
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-600 flex-shrink-0" />
            </button>

            {/* 缓存 */}
            <button
              onClick={() => handleSubPage('cache')}
              className="w-full flex items-center px-4 py-3.5 hover:bg-white/[0.02] transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center flex-shrink-0">
                  <HardDrive size={16} className="text-amber-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm">缓存</p>
                  <p className="text-gray-500 text-xs">{cacheCount} 项缓存数据</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-600 flex-shrink-0" />
            </button>

            {/* 关于 */}
            <button
              onClick={() => handleSubPage('about')}
              className="w-full flex items-center px-4 py-3.5 hover:bg-white/[0.02] transition-colors text-left"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-8 h-8 rounded-lg bg-gray-500/10 flex items-center justify-center flex-shrink-0">
                  <Info size={16} className="text-gray-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-white text-sm">关于</p>
                  <p className="text-gray-500 text-xs">版本 {APP_DISPLAY_VERSION} ({APP_VERSION})</p>
                </div>
              </div>
              <ChevronRight size={16} className="text-gray-600 flex-shrink-0" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return renderSettingsHome();
}
