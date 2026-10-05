import { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft, Plus, Trash2, Monitor, Check, AlertCircle, TestTube, Shield,
  Upload, Download, Link2, FileText, Loader2, CheckCircle2, ListPlus, RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { getSources, addSource, removeSource, getCurrentSource, setCurrentSource, testSource } from '@/services/api';
import { getPlayerSettings, savePlayerSettings } from '@/services/storage';
import { toast } from '@/hooks/use-toast';
import {
  exportSourcesToFile, parseSourceFileText, fetchRemoteConfigText, applyImportedSources,
  MAX_IMPORT_FILE_SIZE, type ImportMode,
} from '@/services/sourceTransfer';
import { annotateDuplicates, type ParsedSource } from '@/services/sourceParse';
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
  const [blockEthics, setBlockEthics] = useState(false);

  // ========== 导入 / 导出状态 ==========
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [importChannel, setImportChannel] = useState<'file' | 'url'>('file');
  const [importUrl, setImportUrl] = useState('');
  const [fetchingUrl, setFetchingUrl] = useState(false);
  const [fileName, setFileName] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [parsed, setParsed] = useState<ParsedSource[] | null>(null);
  const [parseInfo, setParseInfo] = useState<{ format: string; invalidCount: number } | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setSources(getSources());
    const current = getCurrentSource();
    setCurrentSourceId(current?.id || '');
    setBlockEthics(getPlayerSettings().blockEthics);
  }, []);

  // 切换伦理片屏蔽
  const handleBlockEthicsChange = (checked: boolean) => {
    setBlockEthics(checked);
    const settings = getPlayerSettings();
    savePlayerSettings({ ...settings, blockEthics: checked });
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

  // ========== 导入 / 导出逻辑 ==========

  const resetImportState = () => {
    setImportChannel('file');
    setImportUrl('');
    setFileName('');
    setDragOver(false);
    setParsed(null);
    setParseInfo(null);
    setImportMode('merge');
    setFetchingUrl(false);
    setImporting(false);
  };

  const handleOpenImport = () => {
    resetImportState();
    setIsImportOpen(true);
  };

  const dupCount = parsed?.filter((p) => p.duplicate).length || 0;

  // 解析文本并进入预览（文件 / 远程链接共用）
  const handleParseText = (text: string, label: string) => {
    const result = parseSourceFileText(text);
    if (result.sources.length === 0) {
      toast({
        title: '导入失败',
        description: `${label}中未找到有效的影视源${result.invalidCount > 0 ? `（已忽略 ${result.invalidCount} 个无效条目）` : ''}`,
      });
      return;
    }
    setParsed(annotateDuplicates(result.sources, sources));
    setParseInfo({ format: result.format, invalidCount: result.invalidCount });
  };

  // 选择/拖入文件
  const handleFileSelect = async (file?: File | null) => {
    if (!file) return;
    if (file.size > MAX_IMPORT_FILE_SIZE) {
      toast({ title: '文件过大', description: '请选择小于 5MB 的影视源配置文件' });
      return;
    }
    try {
      const text = await file.text();
      setFileName(`${file.name}（${(file.size / 1024).toFixed(1)} KB）`);
      handleParseText(text, `文件 ${file.name}`);
    } catch {
      toast({ title: '读取失败', description: '无法读取文件内容，请确认文件编码为 UTF-8' });
    }
  };

  // 拉取远程配置
  const handleFetchRemote = async () => {
    const url = importUrl.trim();
    if (!url) return;
    setFetchingUrl(true);
    try {
      const text = await fetchRemoteConfigText(url);
      handleParseText(text, '远程配置');
    } catch (error) {
      toast({
        title: '获取失败',
        description: error instanceof Error ? error.message : '无法获取远程配置',
      });
    } finally {
      setFetchingUrl(false);
    }
  };

  // 确认导入
  const handleConfirmImport = () => {
    if (!parsed || parsed.length === 0 || importing) return;
    setImporting(true);
    try {
      const summary = applyImportedSources(parsed, importMode);
      setSources(getSources());
      setCurrentSourceId(getCurrentSource()?.id || '');
      toast({
        title: importMode === 'replace' ? `已替换为 ${summary.added} 个影视源` : `成功导入 ${summary.added} 个影视源`,
        description: summary.skippedDuplicate > 0 ? `已跳过 ${summary.skippedDuplicate} 个重复源` : undefined,
      });
      setIsImportOpen(false);
      resetImportState();
    } catch (error) {
      toast({
        title: '导入失败',
        description: error instanceof Error ? error.message : '请重试',
      });
    } finally {
      setImporting(false);
    }
  };

  // 导出
  const handleExport = () => {
    if (sources.length === 0) {
      toast({ title: '暂无影视源', description: '请先添加或导入影视源后再导出' });
      return;
    }
    try {
      const filename = exportSourcesToFile(sources);
      toast({ title: '导出成功', description: `${sources.length} 个影视源已保存至 ${filename}` });
    } catch (error) {
      toast({
        title: '导出失败',
        description: error instanceof Error ? error.message : '无法生成导出文件',
      });
    }
  };

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
          <Monitor size={18} className="mr-2 text-gray-400" />
          <h1 className="text-white text-lg md:text-xl font-bold">影视源</h1>
        </div>
      </header>

      {/* 内容 */}
      <div className="flex-1 overflow-y-auto px-5 py-4 md:px-8 pb-24">
        <div className="max-w-3xl mx-auto">
          {/* 操作栏 */}
          <div className="flex items-center justify-end gap-2 mb-4">
            {/* 导入 */}
            <button
              onClick={handleOpenImport}
              className="flex items-center px-3 py-1.5 bg-white/5 text-gray-300 text-sm rounded-lg hover:bg-white/10 hover:text-white transition-all"
            >
              <Upload size={15} className="mr-1.5" />
              导入
            </button>
            {/* 导出 */}
            <button
              onClick={handleExport}
              disabled={sources.length === 0}
              className="flex items-center px-3 py-1.5 bg-white/5 text-gray-300 text-sm rounded-lg hover:bg-white/10 hover:text-white transition-all disabled:opacity-40 disabled:pointer-events-none"
            >
              <Download size={15} className="mr-1.5" />
              导出
            </button>
            {/* 添加 */}
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <button className="flex items-center px-3 py-1.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white text-sm rounded-lg hover:opacity-90 transition-opacity">
                  <Plus size={16} className="mr-1" />
                  添加
                </button>
              </DialogTrigger>
              <DialogContent className="text-white max-w-sm max-h-[85dvh] overflow-y-auto">
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
                      className="bg-elevated border-white/10 text-white text-sm focus:border-purple-500"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 block mb-1.5">名称</label>
                    <Input
                      value={newSource.name}
                      onChange={(e) => setNewSource({ ...newSource, name: e.target.value })}
                      placeholder="如: 我的源"
                      className="bg-elevated border-white/10 text-white text-sm focus:border-purple-500"
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
                      className="bg-elevated border-white/10 text-white text-sm focus:border-purple-500"
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
            <div className="bg-surface border border-white/5 rounded-xl p-8 text-center">
              <Monitor className="w-12 h-12 mx-auto mb-3 text-gray-600" />
              <p className="text-gray-500 text-sm">暂无影视源</p>
              <p className="text-gray-600 text-xs mt-1">点击上方「添加」手动添加，或使用「导入」批量导入</p>
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
                      : 'bg-surface border border-white/5 hover:border-white/10'
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

          {/* 内容过滤设置 */}
          <div className="mt-6 bg-surface border border-white/5 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-white text-sm flex items-center gap-1.5">
                  <Shield size={14} className="text-red-400" /> 屏蔽伦理片
                </p>
                <p className="text-gray-500 text-xs mt-1">开启后首页不显示伦理片分类，列表过滤伦理片内容</p>
              </div>
              <Switch
                checked={blockEthics}
                onCheckedChange={handleBlockEthicsChange}
              />
            </div>
          </div>

          {/* 说明 */}
          <div className="mt-6 flex items-start gap-2 p-3 bg-white/[0.02] border border-white/5 rounded-xl">
            <Monitor className="w-4 h-4 text-gray-500 mt-0.5 flex-shrink-0" />
            <p className="text-gray-500 text-xs leading-relaxed">
              影视源决定了您观看的内容来源。您可以添加多个影视源并随时切换，点击影视源即可将其设为当前使用的源。
              支持「导出」将源列表备份为 JSON 文件；「导入」支持 Bismuth 导出文件、通用 JSON 以及含 https 影视源链接的第三方文件，也可直接粘贴远程配置链接拉取导入。
            </p>
          </div>
        </div>
      </div>

      {/* 导入对话框 */}
      <Dialog open={isImportOpen} onOpenChange={(open) => { if (!open) { setIsImportOpen(false); resetImportState(); } }}>
        <DialogContent className="text-white sm:max-w-md p-0 gap-0 grid-rows-[auto_minmax(0,1fr)] overflow-hidden max-h-[85dvh]">
          <DialogHeader className="px-6 pt-6 pb-4 pr-14">
            <DialogTitle className="text-white">导入影视源</DialogTitle>
            <DialogDescription className="text-gray-400 text-sm">
              支持含 https 影视源链接的第三方文件与远程配置
            </DialogDescription>
          </DialogHeader>

          <div className="overflow-y-auto px-6 pb-6 space-y-4 min-h-0">
            {/* 合法提示 */}
            <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
              <Shield className="w-4 h-4 text-yellow-500 mt-0.5 flex-shrink-0" />
              <p className="text-yellow-200/80 text-xs leading-relaxed">
                请确保所导入的影视来源<strong className="text-yellow-200">合法合规</strong>，用户需自行承担因使用非法来源产生的法律责任。
              </p>
            </div>

            {/* 渠道切换 */}
            <div className="flex gap-1 p-1 bg-white/5 rounded-xl">
              <button
                onClick={() => setImportChannel('file')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm rounded-lg transition-all ${
                  importChannel === 'file' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <FileText size={14} /> 本地文件
              </button>
              <button
                onClick={() => setImportChannel('url')}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 text-sm rounded-lg transition-all ${
                  importChannel === 'url' ? 'bg-white/10 text-white' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                <Link2 size={14} /> 远程链接
              </button>
            </div>

            {/* 文件导入 */}
            {importChannel === 'file' && (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  handleFileSelect(e.dataTransfer.files?.[0]);
                }}
                className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${
                  dragOver ? 'border-purple-500 bg-purple-500/10' : 'border-white/10 hover:border-white/25'
                }`}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json,.txt,application/json,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    handleFileSelect(e.target.files?.[0]);
                    e.target.value = '';
                  }}
                />
                <FileText className="w-7 h-7 mx-auto mb-2 text-gray-500" />
                <p className="text-gray-400 text-sm truncate px-2">{fileName || '点击选择或拖入文件'}</p>
                <p className="text-gray-600 text-xs mt-1">支持 .json / .txt（Bismuth 导出、通用 JSON、链接列表）</p>
              </div>
            )}

            {/* 远程链接导入 */}
            {importChannel === 'url' && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    value={importUrl}
                    onChange={(e) => setImportUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !fetchingUrl) handleFetchRemote(); }}
                    placeholder="https://example.com/sources.json"
                    className="bg-elevated border-white/10 text-white text-sm focus:border-purple-500 flex-1"
                    inputMode="url"
                  />
                  <button
                    onClick={handleFetchRemote}
                    disabled={fetchingUrl || !importUrl.trim()}
                    className="flex items-center px-3.5 py-2 bg-white/5 text-gray-300 text-sm rounded-lg hover:bg-white/10 transition-colors disabled:opacity-40 whitespace-nowrap flex-shrink-0"
                  >
                    {fetchingUrl ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <Download size={14} className="mr-1.5" />}
                    {fetchingUrl ? '获取中' : '获取'}
                  </button>
                </div>
                <p className="text-gray-600 text-xs leading-relaxed">
                  粘贴指向影视源配置的 https 链接，将自动拉取并解析（走应用统一的 CORS 代理通道）。
                </p>
              </div>
            )}

            {/* 解析预览 */}
            {parsed && parseInfo && parsed.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap p-2.5 bg-white/[0.03] border border-white/5 rounded-xl">
                  <div className="flex items-center gap-1.5 text-sm min-w-0">
                    <CheckCircle2 size={14} className="text-green-400 flex-shrink-0" />
                    <span className="text-white whitespace-nowrap">解析到 {parsed.length} 个源</span>
                    <span className="text-gray-500 text-xs truncate min-w-0">· {parseInfo.format}</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs flex-shrink-0">
                    {dupCount > 0 && <span className="text-yellow-500 whitespace-nowrap">重复 {dupCount}</span>}
                    {parseInfo.invalidCount > 0 && <span className="text-gray-500 whitespace-nowrap">忽略 {parseInfo.invalidCount}</span>}
                  </div>
                </div>

                {/* 源列表预览 */}
                <div className="max-h-44 overflow-y-auto space-y-1.5 pr-1">
                  {parsed.map((s, i) => (
                    <div
                      key={`${s.id}-${i}`}
                      className={`flex items-center gap-2 p-2.5 rounded-lg border ${
                        s.duplicate ? 'bg-white/[0.02] border-white/5' : 'bg-white/[0.04] border-white/10'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className={`text-sm truncate min-w-0 ${s.duplicate ? 'text-gray-400' : 'text-white'}`}>{s.name}</span>
                          {s.duplicate && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-500 flex-shrink-0">
                              重复
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 truncate">{s.url}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* 导入模式 */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setImportMode('merge')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      importMode === 'merge'
                        ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-purple-500/30'
                        : 'bg-surface border-white/5 hover:border-white/10'
                    }`}
                  >
                    <p className={`text-sm font-medium flex items-center gap-1.5 ${importMode === 'merge' ? 'text-white' : 'text-gray-400'}`}>
                      <ListPlus size={14} /> 合并导入
                    </p>
                    <p className="text-gray-500 text-xs mt-1">跳过重复源，保留现有</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setImportMode('replace')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      importMode === 'replace'
                        ? 'bg-gradient-to-r from-indigo-500/20 to-purple-500/20 border-purple-500/30'
                        : 'bg-surface border-white/5 hover:border-white/10'
                    }`}
                  >
                    <p className={`text-sm font-medium flex items-center gap-1.5 ${importMode === 'replace' ? 'text-white' : 'text-gray-400'}`}>
                      <RefreshCw size={14} /> 替换全部
                    </p>
                    <p className="text-gray-500 text-xs mt-1">清空现有源后导入</p>
                  </button>
                </div>

                <Button
                  onClick={handleConfirmImport}
                  disabled={importing}
                  className="w-full bg-gradient-to-r from-indigo-500 to-purple-500 hover:opacity-90 disabled:opacity-50"
                >
                  {importing ? (
                    <>
                      <Loader2 size={14} className="mr-1.5 animate-spin" /> 导入中...
                    </>
                  ) : importMode === 'replace' ? (
                    `替换为 ${parsed.length} 个源`
                  ) : (
                    `导入 ${parsed.length - dupCount} 个新源`
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
