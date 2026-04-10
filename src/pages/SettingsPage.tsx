import { useState, useEffect, useCallback } from 'react';
import { ArrowLeft, Plus, Trash2, Save, Monitor, Database, Info, Check, AlertCircle, TestTube, Github, Shield, RefreshCw, ExternalLink, Download } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { getSources, addSource, removeSource, getCurrentSource, setCurrentSource, testSource } from '@/services/api';
import { getPlayerSettings, savePlayerSettings, getCacheSettings, saveCacheSettings, getCorsProxy, setCorsProxy, isCorsProxyEnabled, setCorsProxyEnabled } from '@/services/storage';
import { getCacheStats, clearApiCache } from '@/services/cache';
import type { VideoSource, PlayerSettings, CacheSettings } from '@/types';

interface SettingsPageProps {
  onBack?: () => void;
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

export function SettingsPage({ onBack }: SettingsPageProps) {
  const [sources, setSources] = useState<VideoSource[]>([]);
  const [currentSourceId, setCurrentSourceId] = useState('');
  const [playerSettings, setPlayerSettings] = useState<PlayerSettings>({ playerMode: 'builtin', playerUrl: '', autoResume: true });
  const [cacheSettings, setCacheSettings] = useState<CacheSettings>({ enabled: true });
  const [apiCacheStats, setApiCacheStats] = useState({ count: 0, size: '0 B' });
  const [corsProxy, setCorsProxyState] = useState('');
  const [corsProxyEnabled, setCorsProxyEnabledState] = useState(true);
  const [newSource, setNewSource] = useState({ id: '', name: '', url: '' });
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [testingSource, setTestingSource] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle');
  const [latestRelease, setLatestRelease] = useState<GithubRelease | null>(null);

  // 加载设置
  useEffect(() => {
    setSources(getSources());
    const current = getCurrentSource();
    setCurrentSourceId(current?.id || '');
    setPlayerSettings(getPlayerSettings());
    setCacheSettings(getCacheSettings());
    setCorsProxyState(getCorsProxy());
    setCorsProxyEnabledState(isCorsProxyEnabled());
    
    // 加载API缓存统计
    setApiCacheStats(getCacheStats());
  }, []);

  // 保存播放器设置（包含自动保存模式切换）
  const handleSavePlayerSettings = () => {
    savePlayerSettings(playerSettings);
    alert('播放器设置已保存');
  };

  // 自动保存播放器设置（模式切换时）
  const updatePlayerSettings = (newSettings: PlayerSettings) => {
    setPlayerSettings(newSettings);
    savePlayerSettings(newSettings);
  };

  // 切换缓存
  const handleToggleCache = (enabled: boolean) => {
    setCacheSettings({ enabled });
    saveCacheSettings({ enabled });
  };

  // 清除缓存
  const handleClearCache = () => {
    if (confirm('确定要清除所有缓存吗？')) {
      // 清除API缓存
      clearApiCache();
      // 更新统计
      setApiCacheStats(getCacheStats());
      alert('缓存已清除');
    }
  };

  // 测试影视源
  const handleTestSource = async () => {
    if (!newSource.url) return;
    setTestingSource(true);
    setTestResult(null);
    try {
      const result = await testSource(newSource.url);
      setTestResult(result);
    } catch {
      setTestResult(false);
    } finally {
      setTestingSource(false);
    }
  };

  // 添加影视源
  const handleAddSource = () => {
    if (!newSource.id || !newSource.name || !newSource.url) {
      alert('请填写完整信息');
      return;
    }
    try {
      addSource(newSource);
      setSources(getSources());
      setNewSource({ id: '', name: '', url: '' });
      setTestResult(null);
      setIsAddDialogOpen(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : '添加失败');
    }
  };

  // 删除影视源
  const handleRemoveSource = (sourceId: string) => {
    if (confirm('确定要删除这个影视源吗？')) {
      removeSource(sourceId);
      setSources(getSources());
      if (currentSourceId === sourceId) {
        const remaining = getSources();
        if (remaining.length > 0) {
          setCurrentSourceId(remaining[0].id);
          setCurrentSource(remaining[0].id);
        } else {
          setCurrentSourceId('');
        }
      }
    }
  };

  // 切换影视源
  const handleSourceChange = (sourceId: string) => {
    setCurrentSourceId(sourceId);
    setCurrentSource(sourceId);
  };

  // 保存CORS代理
  const handleSaveProxy = () => {
    setCorsProxy(corsProxy);
    alert('代理设置已保存');
  };

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
        {onBack && (
          <button 
            onClick={onBack}
            className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all mr-3 md:hidden"
          >
            <ArrowLeft size={20} />
          </button>
        )}
        <h1 className="text-white text-lg md:text-xl font-bold">设置</h1>
      </header>

      {/* 设置内容 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 md:px-8 pb-24">
        <div className="max-w-3xl mx-auto">
        {/* 影视源 */}
        <section className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center text-gray-400">
              <Monitor size={18} className="mr-2" />
              <span className="text-sm font-medium">影视源</span>
            </div>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <button className="flex items-center px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm rounded-lg hover:opacity-90 transition-opacity">
                  <Plus size={16} className="mr-1" />
                  添加
                </button>
              </DialogTrigger>
              <DialogContent className="bg-[#141414] border-white/10 text-white max-w-sm">
                <DialogHeader>
                  <DialogTitle className="text-white">添加影视源</DialogTitle>
                  <DialogDescription className="text-gray-400 text-sm">
                    输入影视源信息以添加新的内容源
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 pt-2">
                  {/* 合法提示 */}
                  <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <Shield className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <p className="text-yellow-200/80 text-xs leading-relaxed">
                      请确保所添加的影视来源<strong className="text-yellow-200">合法合规</strong>，用户需自行承担因使用非法来源产生的法律责任。
                    </p>
                  </div>
                  
                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5">ID（唯一标识）</label>
                    <Input
                      value={newSource.id}
                      onChange={(e) => setNewSource({ ...newSource, id: e.target.value })}
                      placeholder="如: mysource"
                      className="bg-[#1a1a1a] border-white/10 text-white text-sm focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5">名称</label>
                    <Input
                      value={newSource.name}
                      onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                      placeholder="如: 我的源"
                      className="bg-[#1a1a1a] border-white/10 text-white text-sm focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5">API地址</label>
                    <Input
                      value={newSource.url}
                      onChange={(e) => {
                        setNewSource({ ...newSource, url: e.target.value });
                        setTestResult(null);
                      }}
                      placeholder="https://..."
                      className="bg-[#1a1a1a] border-white/10 text-white text-sm focus:border-purple-500"
                    />
                  </div>
                  
                  {/* 测试按钮 */}
                  {newSource.url && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={handleTestSource}
                        disabled={testingSource}
                        className="flex items-center px-3 py-2 bg-white/5 text-gray-300 text-sm rounded-lg hover:bg-white/10 transition-colors disabled:opacity-50"
                      >
                        <TestTube size={14} className="mr-1.5" />
                        {testingSource ? '测试中...' : '测试连接'}
                      </button>
                      {testResult !== null && (
                        <span className={`flex items-center text-sm ${testResult ? 'text-green-400' : 'text-red-400'}`}>
                          {testResult ? <Check size={14} className="mr-1" /> : <AlertCircle size={14} className="mr-1" />}
                          {testResult ? '可用' : '不可用'}
                        </span>
                      )}
                    </div>
                  )}
                  
                  <Button 
                    onClick={handleAddSource} 
                    className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-90"
                  >
                    添加
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          
          {sources.length === 0 ? (
            <div className="bg-[#141414] border border-white/5 rounded-xl p-8 text-center">
              <Monitor className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p className="text-gray-500 text-sm">暂无影视源</p>
              <p className="text-gray-600 text-xs mt-1">点击上方添加按钮添加</p>
            </div>
          ) : (
            <div className="space-y-2">
              {sources.map((source) => (
                <div
                  key={source.id}
                  onClick={() => handleSourceChange(source.id)}
                  className={`flex items-center justify-between p-3.5 rounded-xl cursor-pointer transition-all ${
                    currentSourceId === source.id 
                      ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border border-purple-500/30' 
                      : 'bg-[#141414] border border-white/5 hover:border-white/10'
                  }`}
                >
                  <div className="flex items-center min-w-0">
                    <div className={`w-4 h-4 rounded-full border-2 mr-3 flex-shrink-0 flex items-center justify-center ${
                      currentSourceId === source.id ? 'border-purple-500' : 'border-gray-600'
                    }`}>
                      {currentSourceId === source.id && <div className="w-2 h-2 rounded-full bg-purple-500" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-white text-sm font-medium truncate">{source.name}</p>
                      <p className="text-gray-500 text-xs truncate">{source.url}</p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveSource(source.id);
                    }}
                    className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all flex-shrink-0 ml-2"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 播放器 */}
        <section className="mb-8">
          <div className="flex items-center text-gray-400 mb-4">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium">播放器</span>
          </div>
          
          <div className="bg-[#141414] border border-white/5 rounded-xl p-4 space-y-4">
            {/* 播放器模式选择 */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm">播放器模式</p>
                <p className="text-gray-500 text-xs">选择内置播放器或外部播放器</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => updatePlayerSettings({ ...playerSettings, playerMode: 'builtin' })}
                className={`flex-1 p-3 rounded-xl border text-left transition-all ${
                  playerSettings.playerMode === 'builtin'
                    ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-purple-500/30'
                    : 'bg-[#1a1a1a] border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-3 h-3 rounded-full border-2 ${playerSettings.playerMode === 'builtin' ? 'border-purple-500' : 'border-gray-600'} flex items-center justify-center`}>
                    {playerSettings.playerMode === 'builtin' && <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />}
                  </div>
                  <span className={`text-sm font-medium ${playerSettings.playerMode === 'builtin' ? 'text-purple-400' : 'text-gray-300'}`}>内置 SimPlayer</span>
                </div>
                <p className="text-gray-500 text-[10px] ml-5">支持 HLS/MP4，截图，画中画，倍速</p>
              </button>
              <button
                onClick={() => updatePlayerSettings({ ...playerSettings, playerMode: 'external' })}
                className={`flex-1 p-3 rounded-xl border text-left transition-all ${
                  playerSettings.playerMode === 'external'
                    ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-purple-500/30'
                    : 'bg-[#1a1a1a] border-white/5 hover:border-white/10'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className={`w-3 h-3 rounded-full border-2 ${playerSettings.playerMode === 'external' ? 'border-purple-500' : 'border-gray-600'} flex items-center justify-center`}>
                    {playerSettings.playerMode === 'external' && <div className="w-1.5 h-1.5 rounded-full bg-purple-500" />}
                  </div>
                  <span className={`text-sm font-medium ${playerSettings.playerMode === 'external' ? 'text-purple-400' : 'text-gray-300'}`}>外部播放器</span>
                </div>
                <p className="text-gray-500 text-[10px] ml-5">通过 iframe 嵌入自定义播放器</p>
              </button>
            </div>

            {/* 外部播放器地址（仅外部模式显示） */}
            {playerSettings.playerMode === 'external' && (
              <div className="pt-3 border-t border-white/5">
                <label className="text-xs text-gray-500 block mb-2">播放器地址</label>
                <div className="flex gap-2">
                  <Input
                    value={playerSettings.playerUrl}
                    onChange={(e) => setPlayerSettings({ ...playerSettings, playerUrl: e.target.value })}
                    placeholder="https://..."
                    className="flex-1 bg-[#1a1a1a] border-white/10 text-white text-sm focus:border-purple-500"
                  />
                  <Button 
                    onClick={handleSavePlayerSettings} 
                    size="sm"
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-90"
                  >
                    <Save size={16} />
                  </Button>
                </div>
                <p className="text-gray-600 text-xs mt-1.5">
                  当前: {playerSettings.playerUrl || '未设置'}
                </p>
              </div>
            )}

            {/* 内置播放器提示 */}
            {playerSettings.playerMode === 'builtin' && (
              <div className="pt-3 border-t border-white/5">
                <div className="flex items-center gap-2 p-3 bg-purple-500/5 border border-purple-500/10 rounded-lg">
                  <svg className="w-4 h-4 text-purple-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-purple-200/70 text-[11px] leading-relaxed">
                    内置 SimPlayer 支持 MP4/WebM/OGG/HLS(M3U8) 格式，提供截图、画中画、倍速播放等增强功能。
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <div>
                <p className="text-white text-sm">自动续播</p>
                <p className="text-gray-500 text-xs">从上次观看位置继续播放</p>
              </div>
              <Switch
                checked={playerSettings.autoResume}
                onCheckedChange={(checked) => setPlayerSettings({ ...playerSettings, autoResume: checked })}
              />
            </div>
          </div>
        </section>

        {/* CORS代理 */}
        <section className="mb-8">
          <div className="flex items-center text-gray-400 mb-4">
            <Database size={18} className="mr-2" />
            <span className="text-sm font-medium">CORS代理</span>
          </div>
          
          <div className="bg-[#141414] border border-white/5 rounded-xl p-4 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm">启用 CORS 代理</p>
                <p className="text-gray-500 text-xs">关闭后将直接请求影视源，适用于服务端已配置 CORS 的场景</p>
              </div>
              <Switch
                checked={corsProxyEnabled}
                onCheckedChange={(checked) => {
                  setCorsProxyEnabledState(checked);
                  setCorsProxyEnabled(checked);
                }}
              />
            </div>

            {corsProxyEnabled && (
              <>
                <div className="flex gap-2">
                  <Input
                    value={corsProxy}
                    onChange={(e) => setCorsProxyState(e.target.value)}
                    placeholder="https://api.codetabs.com/v1/proxy?quest="
                    className="flex-1 bg-[#1a1a1a] border-white/10 text-white text-sm focus:border-purple-500"
                  />
                  <Button
                    onClick={handleSaveProxy}
                    size="sm"
                    className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-90"
                  >
                    <Save size={16} />
                  </Button>
                </div>
                <p className="text-gray-600 text-xs">
                  用于解决跨域问题，支持自动轮换
                </p>
              </>
            )}

            {!corsProxyEnabled && (
              <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <Shield className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
                <p className="text-yellow-200/80 text-[11px] leading-relaxed">
                  已关闭 CORS 代理，将直接请求影视源 API。如果影视源服务器未配置允许跨域访问，请求将会失败。
                </p>
              </div>
            )}
          </div>
        </section>

        {/* 缓存 */}
        <section className="mb-8">
          <div className="flex items-center text-gray-400 mb-4">
            <Database size={18} className="mr-2" />
            <span className="text-sm font-medium">缓存</span>
          </div>
          
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
        </section>

        {/* 关于 */}
        <section className="mb-8">
          <div className="flex items-center text-gray-400 mb-4">
            <Info size={18} className="mr-2" />
            <span className="text-sm font-medium">关于</span>
          </div>
          
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
          <div className="mt-3">
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
          
          <p className="text-gray-600 text-xs text-center mt-6 leading-relaxed">
            Bismuth Player 仅为播放工具<br />
            内容来源于用户配置的第三方源
          </p>
          
          {/* GitHub 链接 */}
          <a 
            href="https://github.com/Eq52/Bismuth-Player" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 mt-4 text-gray-500 hover:text-white transition-colors"
          >
            <Github size={18} />
            <span className="text-sm">GitHub</span>
          </a>
        </section>
        </div>
      </div>
    </div>
  );
}
