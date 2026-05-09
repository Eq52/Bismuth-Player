import { useState, useCallback } from 'react';
import { ArrowLeft, Info, Check, AlertCircle, RefreshCw, ExternalLink, Download, Github } from 'lucide-react';

interface AboutPageProps {
  onBack: () => void;
}

// 从 Vite define 注入的版本号（类型声明见 env.d.ts）
const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '8.0.0';
const APP_DISPLAY_VERSION = 'V' + APP_VERSION.split('.')[0];

// 比较语义版本号，返回 >0 表示 a 更新
function compareVersions(a: string, b: string): number {
  const pa = a.replace(/^v/i, '').split('.').map(Number);
  const pb = b.replace(/^v/i, '').split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const na = pa[i] || 0;
    const nb = pb[i] || 0;
    if (na > nb) return 1;
    if (na < nb) return -1;
  }
  return 0;
}

interface GithubRelease {
  tag_name: string;
  name: string;
  html_url: string;
  body: string;
  published_at: string;
}

type UpdateStatus = 'idle' | 'checking' | 'up-to-date' | 'update-available' | 'error';

export function AboutPage({ onBack }: AboutPageProps) {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [latestRelease, setLatestRelease] = useState<GithubRelease | null>(null);

  // 检测最新版本
  const handleCheckUpdate = useCallback(async () => {
    setUpdateStatus('checking');
    setLatestRelease(null);
    try {
      const resp = await fetch('https://api.github.com/repos/Eq52/Bismuth-Player/releases/latest');
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data: GithubRelease = await resp.json();
      setLatestRelease(data);
      const cmp = compareVersions(data.tag_name, APP_VERSION);
      setUpdateStatus(cmp > 0 ? 'update-available' : 'up-to-date');
    } catch (err) {
      console.error('检查更新失败:', err);
      setUpdateStatus('error');
    }
  }, []);

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
          <Info size={18} className="mr-2 text-gray-400" />
          <h1 className="text-white text-lg md:text-xl font-bold">关于</h1>
        </div>
      </header>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 md:px-8 pb-24">
        <div className="max-w-3xl mx-auto">
          {/* 应用信息 */}
          <div className="bg-[#141414] border border-white/5 rounded-xl p-4 space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-500 text-sm">版本</span>
              <span className="text-white text-sm">{APP_DISPLAY_VERSION} ({APP_VERSION})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 text-sm">类型</span>
              <span className="text-white text-sm">Web应用</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500 text-sm">功能</span>
              <span className="text-white text-sm">影视播放壳子</span>
            </div>
          </div>

          {/* 版本检测 */}
          <div className="mt-4">
            <button
              onClick={handleCheckUpdate}
              disabled={updateStatus === 'checking'}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-white/5 hover:bg-white/10 text-gray-300 text-sm rounded-xl transition-all disabled:opacity-50 border border-white/5"
            >
              <RefreshCw size={14} className={updateStatus === 'checking' ? 'animate-spin' : ''} />
              <span>{updateStatus === 'checking' ? '正在检查...' : '检查更新'}</span>
            </button>

            {/* 检查结果 */}
            {updateStatus === 'up-to-date' && (
              <div className="flex items-center gap-2 mt-2.5 p-3 bg-green-500/10 border border-green-500/15 rounded-xl">
                <Check size={14} className="text-green-400 shrink-0" />
                <span className="text-green-300/90 text-xs">当前已是最新版本</span>
              </div>
            )}

            {updateStatus === 'update-available' && latestRelease && (
              <div className="mt-2.5 p-3 bg-indigo-500/10 border border-indigo-500/15 rounded-xl space-y-2">
                <div className="flex items-center gap-2">
                  <Download size={14} className="text-indigo-400 shrink-0" />
                  <span className="text-indigo-300/90 text-xs font-medium">发现新版本 {latestRelease.tag_name}</span>
                </div>
                <p className="text-gray-500 text-[11px] leading-relaxed pl-5.5">
                  {latestRelease.name || latestRelease.tag_name}
                  {latestRelease.published_at && (
                    <> · 发布于 {new Date(latestRelease.published_at).toLocaleDateString('zh-CN')}</>
                  )}
                </p>
                <a
                  href={latestRelease.html_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 pl-5.5 text-indigo-400 hover:text-indigo-300 text-xs transition-colors"
                >
                  <ExternalLink size={12} />
                  查看发布详情
                </a>
              </div>
            )}

            {updateStatus === 'error' && (
              <div className="flex items-center gap-2 mt-2.5 p-3 bg-red-500/10 border border-red-500/15 rounded-xl">
                <AlertCircle size={14} className="text-red-400 shrink-0" />
                <span className="text-red-300/90 text-xs">检查更新失败，请检查网络连接</span>
              </div>
            )}
          </div>

          {/* 免责声明 */}
          <div className="mt-4 bg-[#141414] border border-white/5 rounded-xl p-4">
            <p className="text-gray-500 text-xs text-center leading-relaxed">
              Bismuth Player 仅为播放工具<br />
              内容来源于用户配置的第三方源
            </p>
          </div>

          {/* GitHub 链接 */}
          <a
            href="https://github.com/Eq52/Bismuth-Player"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 mt-4 text-gray-500 hover:text-white transition-colors"
          >
            <Github size={18} />
            <span className="text-sm">GitHub</span>
            <ExternalLink size={12} className="opacity-50" />
          </a>
        </div>
      </div>
    </div>
  );
}
