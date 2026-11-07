import { useState, useCallback } from 'react';
import { ArrowLeft, Info, Check, AlertCircle, RefreshCw, ExternalLink, Download, Github, Copy } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Markdown } from '@/components/Markdown';

interface AboutPageProps {
  onBack: () => void;
}

// 从 Vite define 注入的版本号（类型声明见 env.d.ts），发版只需更新 package.json
const APP_VERSION = __APP_VERSION__;
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

interface GithubAsset {
  name: string;
  browser_download_url: string;
}

interface GithubRelease {
  tag_name: string;
  name: string;
  html_url: string;
  body: string;
  published_at: string;
  assets: GithubAsset[];
}

type UpdateStatus = 'idle' | 'checking' | 'up-to-date' | 'update-available' | 'error';

// 复制文本：优先剪贴板 API，失败回退到 execCommand
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* 落入下方兜底 */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

export function AboutPage({ onBack }: AboutPageProps) {
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [latestRelease, setLatestRelease] = useState<GithubRelease | null>(null);
  // 更新弹窗与“已复制”反馈
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [copiedName, setCopiedName] = useState<string | null>(null);

  // 复制某个下载链接，并短暂显示“已复制”
  const handleCopy = useCallback(async (name: string, url: string) => {
    const ok = await copyToClipboard(url);
    if (ok) {
      setCopiedName(name);
      setTimeout(() => setCopiedName(cur => (cur === name ? null : cur)), 1800);
    }
  }, []);

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
      const hasUpdate = cmp > 0;
      setUpdateStatus(hasUpdate ? 'update-available' : 'up-to-date');
      if (hasUpdate) setUpdateDialogOpen(true); // 发现新版本，弹窗展示
    } catch (err) {
      console.error('检查更新失败:', err);
      setUpdateStatus('error');
    }
  }, []);

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
        <div className="flex items-center">
          <Info size={18} className="mr-2 text-gray-400" />
          <h1 className="text-white text-lg md:text-xl font-bold">关于</h1>
        </div>
      </header>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 md:px-8 pb-24">
        <div className="max-w-3xl mx-auto">
          {/* 应用信息 */}
          <div className="bg-surface border border-white/5 rounded-xl p-4 space-y-3">
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
              <button
                onClick={() => setUpdateDialogOpen(true)}
                className="w-full mt-2.5 flex items-center justify-center gap-2 p-3 bg-purple-500/10 border border-purple-500/20 rounded-xl text-purple-300/90 text-xs font-medium hover:bg-purple-500/15 transition-colors"
              >
                <Download size={14} className="shrink-0" />
                发现新版本 {latestRelease.tag_name}，点击查看
              </button>
            )}

            {updateStatus === 'error' && (
              <div className="flex items-center gap-2 mt-2.5 p-3 bg-red-500/10 border border-red-500/15 rounded-xl">
                <AlertCircle size={14} className="text-red-400 shrink-0" />
                <span className="text-red-300/90 text-xs">检查更新失败，请检查网络连接</span>
              </div>
            )}
          </div>

          {/* 免责声明 */}
          <div className="mt-4 bg-surface border border-white/5 rounded-xl p-4">
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

      {/* 更新详情弹窗：版本号 + 更新内容 + 下载链接复制 */}
      <Dialog open={updateDialogOpen} onOpenChange={setUpdateDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Download size={17} className="text-purple-400" />
              发现新版本 {latestRelease?.tag_name}
            </DialogTitle>
            <DialogDescription>
              {latestRelease?.published_at &&
                `发布于 ${new Date(latestRelease.published_at).toLocaleDateString('zh-CN')}`}
            </DialogDescription>
          </DialogHeader>

          {/* 更新内容（轻量 Markdown 渲染），限高可滚动 */}
          <div className="max-h-[42vh] overflow-y-auto overscroll-contain pr-1">
            {latestRelease?.body
              ? <Markdown content={latestRelease.body} />
              : <p className="text-[11px] text-gray-500">暂无更新说明</p>}
          </div>

          {/* 下载链接：Release 资产逐个可复制；无资产时回退发布页链接 */}
          <div className="space-y-1.5 border-t border-white/5 pt-3">
            {latestRelease && latestRelease.assets.length > 0 ? (
              latestRelease.assets.map(asset => (
                <div key={asset.name} className="flex items-center gap-2">
                  <span className="flex-1 text-[11px] text-gray-300 truncate">{asset.name}</span>
                  <button
                    onClick={() => handleCopy(asset.name, asset.browser_download_url)}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-lg bg-white/5 hover:bg-white/10 text-gray-200 transition-colors shrink-0"
                  >
                    {copiedName === asset.name ? (
                      <><Check size={12} className="text-green-400" />已复制</>
                    ) : (
                      <><Copy size={12} />复制链接</>
                    )}
                  </button>
                </div>
              ))
            ) : (
              <div className="flex items-center gap-2">
                <span className="flex-1 text-[11px] text-gray-400">发布页链接</span>
                <button
                  onClick={() => handleCopy('release', latestRelease?.html_url ?? '')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] rounded-lg bg-white/5 hover:bg-white/10 text-gray-200 transition-colors shrink-0"
                >
                  {copiedName === 'release' ? (
                    <><Check size={12} className="text-green-400" />已复制</>
                  ) : (
                    <><Copy size={12} />复制链接</>
                  )}
                </button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
