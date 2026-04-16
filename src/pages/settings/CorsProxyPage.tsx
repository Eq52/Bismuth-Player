import { useState, useEffect } from 'react';
import { ArrowLeft, Plus, Trash2, Database, RefreshCw, Shield, GripVertical } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getCorsProxyList, setCorsProxyList, addCorsProxy, removeCorsProxy, isCorsProxyEnabled, setCorsProxyEnabled } from '@/services/storage';

interface CorsProxyPageProps {
  onBack: () => void;
}

export function CorsProxyPage({ onBack }: CorsProxyPageProps) {
  const [corsProxies, setCorsProxies] = useState<string[]>([]);
  const [corsProxyEnabled, setCorsProxyEnabledState] = useState(true);
  const [newProxyInput, setNewProxyInput] = useState('');

  useEffect(() => {
    setCorsProxies(getCorsProxyList());
    setCorsProxyEnabledState(isCorsProxyEnabled());
  }, []);

  // 添加代理
  const handleAddProxy = () => {
    const trimmed = newProxyInput.trim();
    if (!trimmed) return;
    if (corsProxies.includes(trimmed)) {
      alert('该代理已存在');
      return;
    }
    addCorsProxy(trimmed);
    setCorsProxies(getCorsProxyList());
    setNewProxyInput('');
  };

  // 删除代理
  const handleRemoveProxy = (index: number) => {
    removeCorsProxy(index);
    setCorsProxies(getCorsProxyList());
  };

  // 恢复默认代理
  const handleResetProxies = () => {
    setCorsProxyList([
      'https://api.codetabs.com/v1/proxy?quest=',
      'https://api.cors.lol/?url=',
    ]);
    setCorsProxies(getCorsProxyList());
  };

  // 上移代理（优先级调整）
  const handleMoveProxyUp = (index: number) => {
    if (index === 0) return;
    const list = [...corsProxies];
    [list[index - 1], list[index]] = [list[index], list[index - 1]];
    setCorsProxyList(list);
    setCorsProxies(list);
  };

  // 下移代理（优先级调整）
  const handleMoveProxyDown = (index: number) => {
    if (index >= corsProxies.length - 1) return;
    const list = [...corsProxies];
    [list[index], list[index + 1]] = [list[index + 1], list[index]];
    setCorsProxyList(list);
    setCorsProxies(list);
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
          <h1 className="text-white text-lg md:text-xl font-bold">CORS代理</h1>
        </div>
      </header>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 md:px-8 pb-24">
        <div className="max-w-3xl mx-auto">
          <div className="bg-[#141414] border border-white/5 rounded-xl p-4 space-y-4">
            {/* 开关 */}
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
                {/* 代理列表 */}
                <div className="space-y-2">
                  <label className="text-xs text-gray-500">代理列表（第一个为当前使用，请求失败时自动轮换）</label>
                  <div className="space-y-1.5">
                    {corsProxies.map((proxy, index) => (
                      <div key={index} className="flex items-center gap-2 group">
                        {/* 排序按钮 */}
                        <div className="flex flex-col gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-40 transition-opacity">
                          <button
                            onClick={() => handleMoveProxyUp(index)}
                            disabled={index === 0}
                            className="p-0.5 hover:text-white transition-colors disabled:opacity-30"
                            title="上移"
                          >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                              <path d="M5 1L9 6H1L5 1Z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => handleMoveProxyDown(index)}
                            disabled={index === corsProxies.length - 1}
                            className="p-0.5 hover:text-white transition-colors disabled:opacity-30"
                            title="下移"
                          >
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                              <path d="M5 9L1 4H9L5 9Z" />
                            </svg>
                          </button>
                        </div>
                        {/* 状态指示 */}
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${index === 0 ? 'bg-green-400' : 'bg-gray-600'}`} title={index === 0 ? '当前使用' : '备用'} />
                        {/* 代理地址 */}
                        <span className="flex-1 text-xs text-gray-300 truncate font-mono">{proxy}</span>
                        {/* 删除按钮 */}
                        <button
                          onClick={() => handleRemoveProxy(index)}
                          className="p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all rounded"
                          title="删除"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 添加代理输入 */}
                <div className="flex gap-2">
                  <Input
                    value={newProxyInput}
                    onChange={(e) => setNewProxyInput(e.target.value)}
                    placeholder="输入代理地址，如 https://..."
                    className="flex-1 bg-[#1a1a1a] border-white/10 text-white text-sm focus:border-purple-500"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddProxy(); }}
                  />
                  <Button onClick={handleAddProxy} size="sm" className="bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-90">
                    <Plus size={14} />
                  </Button>
                  <Button onClick={handleResetProxies} size="sm" variant="outline" className="border-white/10 text-gray-400 hover:text-white hover:bg-white/5" title="恢复默认">
                    <RefreshCw size={14} />
                  </Button>
                </div>
                <p className="text-gray-600 text-xs">
                  共 {corsProxies.length} 个代理，请求失败时自动轮换到下一个。可拖拽排序调整优先级。
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

          {/* 说明 */}
          <div className="mt-6 space-y-3">
            <div className="flex items-start gap-2 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
              <Database className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <p className="text-gray-500 text-xs leading-relaxed">
                CORS 代理用于解决浏览器跨域限制。当影视源 API 服务器未配置允许跨域访问时，请求会通过代理转发。代理列表中的第一个为当前使用的代理，当请求失败时会自动轮换到下一个。
              </p>
            </div>
            <div className="flex items-start gap-2 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
              <GripVertical className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
              <p className="text-gray-500 text-xs leading-relaxed">
                您可以添加多个自定义 CORS 代理地址，并通过上下箭头调整优先级顺序。代理地址需要支持以 URL 查询参数方式接收目标地址，例如 <code className="text-gray-400">https://proxy.example.com/?url=</code>。
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
