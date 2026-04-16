import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Monitor, Check, AlertCircle, TestTube, Shield } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { getSources, addSource, removeSource, getCurrentSource, setCurrentSource, testSource } from '@/services/api';
import type { VideoSource } from '@/types';

interface VideoSourcePageProps {
  onBack: () => void;
}

export function VideoSourcePage({ onBack }: VideoSourcePageProps) {
  const [sources, setSources] = useState<VideoSource[]>([]);
  const [currentSourceId, setCurrentSourceId] = useState('');
  const [newSource, setNewSource] = useState({ id: '', name: '', url: '' });
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [testingSource, setTestingSource] = useState(false);
  const [testResult, setTestResult] = useState<boolean | null>(null);

  useEffect(() => {
    setSources(getSources());
    const current = getCurrentSource();
    setCurrentSourceId(current?.id || '');
  }, []);

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
          <Monitor size={18} className="mr-2 text-gray-400" />
          <h1 className="text-white text-lg md:text-xl font-bold">影视源</h1>
        </div>
      </header>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 md:px-8 pb-24">
        <div className="max-w-3xl mx-auto">
          {/* 操作栏 */}
          <div className="flex items-center justify-end mb-4">
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

          {/* 影视源列表 */}
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

          {/* 说明 */}
          <div className="mt-6 flex items-start gap-2 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <Monitor className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <p className="text-gray-500 text-xs leading-relaxed">
              影视源决定了您观看的内容来源。您可以添加多个影视源并随时切换。点击影视源即可将其设为当前使用的源，点击删除按钮可移除该源。
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
