import { useState, useEffect } from 'react';
import { ArrowLeft, Save } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getPlayerSettings, savePlayerSettings } from '@/services/storage';
import type { PlayerSettings } from '@/types';

interface PlayerSettingsPageProps {
  onBack: () => void;
}

export function PlayerSettingsPage({ onBack }: PlayerSettingsPageProps) {
  const [playerSettings, setPlayerSettings] = useState<PlayerSettings>({
    playerMode: 'builtin',
    playerUrl: '',
    autoResume: true,
  });

  useEffect(() => {
    setPlayerSettings(getPlayerSettings());
  }, []);

  // 保存播放器设置
  const handleSavePlayerSettings = () => {
    savePlayerSettings(playerSettings);
    alert('播放器设置已保存');
  };

  // 自动保存播放器设置（模式切换时）
  const updatePlayerSettings = (newSettings: PlayerSettings) => {
    setPlayerSettings(newSettings);
    savePlayerSettings(newSettings);
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
          <svg className="w-5 h-5 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h1 className="text-white text-lg md:text-xl font-bold">播放器</h1>
        </div>
      </header>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 md:px-8 pb-24">
        <div className="max-w-3xl mx-auto">
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

            {/* 自动续播 */}
            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <div>
                <p className="text-white text-sm">自动续播</p>
                <p className="text-gray-500 text-xs">从上次观看位置继续播放</p>
              </div>
              <Switch
                checked={playerSettings.autoResume}
                onCheckedChange={(checked) => updatePlayerSettings({ ...playerSettings, autoResume: checked })}
              />
            </div>
          </div>

          {/* 说明 */}
          <div className="mt-6 flex items-start gap-2 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <svg className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-gray-500 text-xs leading-relaxed">
              内置 SimPlayer 是应用自带的播放器，支持主流视频格式并内置多种增强功能。外部播放器模式允许您通过 iframe 嵌入任何自定义播放器，适用于需要特殊播放能力的场景。切换模式后将立即生效。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
