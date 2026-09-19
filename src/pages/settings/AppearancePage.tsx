/**
 * AppearancePage — 外观设置（主题系统 UI）
 *
 * 分区：主题卡片墙 / 调色盘（实时预览+另存）/ 壁纸 / 品牌 / 自定义CSS /
 *       外链皮肤(override|replace) / 导入(文件·主题码·URL) / 导出 / 重置
 * 调色盘草稿实时预览，不落激活态；另存后自动激活。
 */

import { useEffect, useRef, useState } from 'react';
import {
  BUILT_IN_THEMES, THEME_FORMAT, validateThemePack, decodeThemeCode, encodeThemeCode,
  deriveVars, getActiveThemeId, loadTheme, type ThemePack, type ThemeVars, type DraftTheme,
} from '@/services/theme';
import {
  ArrowLeft, Palette, Check, Upload, Download, RotateCcw,
  Image as ImageIcon, Type, Code2, Link2, FileJson, ClipboardPaste,
  ShieldAlert, Wand2, X,
} from 'lucide-react';
import { useTheme } from '@/services/ThemeContext';
import { toast } from '@/hooks/use-toast';

interface AppearancePageProps {
  onBack: () => void;
}

const FONT_OPTIONS = [
  { label: '系统默认', value: '' },
  { label: '衬线（宋体风）', value: 'Georgia, "Times New Roman", "Songti SC", SimSun, serif' },
  { label: '圆体（柔和）', value: '"PingFang SC", "Hiragino Maru Gothic ProN", "Microsoft YaHei UI", sans-serif' },
  { label: '等宽（终端风）', value: 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace' },
];

const COLOR_FIELDS: { key: keyof ThemeVars; label: string }[] = [
  { key: 'bgBase', label: '页面底色' },
  { key: 'bgSurface', label: '卡片底色' },
  { key: 'bgElevated', label: '悬浮/输入框' },
  { key: 'white', label: '主文字' },
  { key: 'gray500', label: '次要文字' },
  { key: 'purple500', label: '强调色' },
];

/** 草稿 → 完整主题包（另存/导出用） */
function draftToPack(d: DraftTheme, id: string, name: string): ThemePack {
  return {
    format: THEME_FORMAT,
    id,
    name,
    author: 'me',
    dark: d.dark,
    vars: d.vars,
    wallpaper: d.wallpaper,
    brand: d.brand,
    css: d.css,
    cssUrl: (d as DraftTheme & { cssUrl?: string }).cssUrl,
    cssMode: (d as DraftTheme & { cssMode?: 'override' | 'replace' }).cssMode || 'override',
    trustRemote: (d as DraftTheme & { trustRemote?: boolean }).trustRemote === true,
  };
}

export function AppearancePage({ onBack }: AppearancePageProps) {
  const {
    activeId, switchTheme, importAndSave, deleteById,
    draft, updateDraft, clearDraft, previewDraft, resetAppearance,
    refreshUserThemes, userThemes, safeMode, activeName, wallpaper,
  } = useTheme();

  const [tab, setTab] = useState<'themes' | 'studio'>('themes');
  const [activePack, setActivePack] = useState<ThemePack | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [pasteCode, setPasteCode] = useState('');
  const [importUrl, setImportUrl] = useState('');
  const [pendingPack, setPendingPack] = useState<ThemePack | null>(null);

  const fileRef = useRef<HTMLInputElement>(null);
  const wallRef = useRef<HTMLInputElement>(null);
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    refreshUserThemes();
  }, [refreshUserThemes]);

  // 激活主题缓存：工坊调色盘基线 + 草稿创建快照用
  useEffect(() => {
    (async () => {
      const id = getActiveThemeId();
      setActivePack(id ? await loadTheme(id) : null);
    })();
  }, [activeId]);

  /* ── 调色盘草稿：patch + 实时预览 ──
   * 草稿创建时快照当前激活主题的 vars/dark，保证后续持久化恢复时
   * 不会退回暗夜默认色（比如在纯白主题下改壁纸，刷新后仍是纯白+壁纸） */
  const commitDraft = async (patch: Partial<DraftTheme>) => {
    let base = draft;
    if (!base) {
      base = {
        id: 'custom-draft',
        name: '我的主题',
        dark: activePack ? activePack.dark : true,
        vars: activePack?.vars ? { ...activePack.vars } : {},
        wallpaper: wallpaper ?? undefined, // 继承当前生效壁纸（用户壁纸/主题包壁纸），保持工坊显示与实际一致
      };
    }
    const next: DraftTheme = { ...base, ...patch };
    if (!draft) updateDraft(base);   // 先落基线，再落本次改动（updateDraft 内部函数式合并）
    updateDraft(patch);
    await previewDraft(next);
  };

  const stopPreview = async () => {
    clearDraft();
    await previewDraft(null);
    toast({ title: '已还原为当前主题' });
  };

  /* ── 另存为主题 ── */
  const saveAsTheme = async () => {
    if (!draft) return;
    const id = `custom-${Date.now().toString(36)}`;
    const pack = draftToPack(draft, id, draft.name || '我的主题');
    await importAndSave(pack);
    clearDraft();
    toast({ title: '主题已保存并激活', description: pack.name });
  };

  /* ── 导入 ── */
  const handleImportResult = (r: ReturnType<typeof validateThemePack>) => {
    if (r.error || !r.pack) {
      toast({ title: '导入失败', description: r.error });
      return;
    }
    if (r.hasRemote && !r.pack.trustRemote) {
      setPendingPack(r.pack); // 弹信任确认
      return;
    }
    finishImport(r.pack);
  };

  const finishImport = async (pack: ThemePack) => {
    await importAndSave(pack);
    setImportOpen(false);
    setPasteCode('');
    setImportUrl('');
    toast({ title: '主题已导入并激活', description: pack.name });
  };

  const onPickFile = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 512 * 1024) {
      toast({ title: '导入失败', description: '主题文件超过 512KB 上限' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      try {
        handleImportResult(validateThemePack(JSON.parse(String(reader.result))));
      } catch {
        toast({ title: '导入失败', description: 'JSON 解析失败' });
      }
    };
    reader.readAsText(f);
  };

  const onImportUrl = async () => {
    const url = importUrl.trim();
    if (!url) return;
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      handleImportResult(validateThemePack(await res.json()));
    } catch (e) {
      toast({ title: '拉取失败', description: `${(e as Error).message}；网页端受 CORS 限制时可下载后用文件导入` });
    }
  };

  /* ── 导出当前主题 ── */
  const exportActive = async () => {
    const pack = activeId ? BUILT_IN_THEMES.find((t) => t.id === activeId) || userThemes.find((t) => t.id === activeId) : null;
    if (!pack) {
      toast({ title: '当前使用默认主题，先选择或制作一个主题再导出' });
      return;
    }
    const json = JSON.stringify({ ...pack, builtin: undefined }, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bismuth-theme-${pack.id}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast({ title: '已导出主题文件' });
  };

  const copyActiveCode = async () => {
    const pack = activeId ? BUILT_IN_THEMES.find((t) => t.id === activeId) || userThemes.find((t) => t.id === activeId) : null;
    if (!pack) return;
    try {
      await navigator.clipboard.writeText(encodeThemeCode(pack));
      toast({ title: '主题码已复制，发给朋友粘贴即可导入' });
    } catch {
      toast({ title: '复制失败', description: '浏览器剪贴板不可用' });
    }
  };

  /* ── 壁纸/Logo 上传 ── */
  const pickImage = (f: File | undefined, apply: (dataUrl: string) => void) => {
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) {
      toast({ title: '图片超过 3MB，请压缩后再上传' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => apply(String(reader.result));
    reader.readAsDataURL(f);
  };

  /* ── 主题卡片 ── */
  const ThemeCard = ({ pack, onDelete }: { pack: ThemePack; onDelete?: () => void }) => {
    const v = deriveVars(pack.vars || {});
    const active = activeId === pack.id || (!activeId && pack.id === 'midnight');
    return (
      <div className="relative group">
        <button
          onClick={() => switchTheme(pack.id)}
          className={`w-full text-left rounded-xl border p-3 transition-all ${
            active ? 'border-purple-500/60 bg-purple-500/10' : 'border-white/5 bg-surface hover:bg-elevated'
          }`}
        >
          {/* 色板预览 */}
          <div
            className="h-16 rounded-lg mb-2.5 flex items-center justify-center gap-1.5 border border-white/5"
            style={{ background: `rgb(${(v.bgBase || '#0a0a0a').replace(/^#?/, '') && hexSwatch(v.bgBase || '#0a0a0a')})` }}
          >
            <span className="w-6 h-6 rounded-md border border-black/20" style={{ background: v.bgSurface || '#141414' }} />
            <span className="w-6 h-6 rounded-md border border-black/20" style={{ background: v.bgElevated || '#1a1a1a' }} />
            <span className="w-6 h-6 rounded-md" style={{ background: v.purple500 || '#a855f7' }} />
          </div>
          <div className="flex items-center gap-1.5">
            <p className="text-white text-sm font-medium truncate flex-1">{pack.name}</p>
            {active && <Check size={14} className="text-purple-400 flex-shrink-0" />}
          </div>
          <p className="text-gray-500 text-xs mt-0.5 truncate">{pack.author || '未知作者'}{pack.cssUrl ? ' · 外链皮肤' : ''}</p>
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            title="删除主题"
            className="absolute top-1.5 right-1.5 p-1.5 rounded-lg bg-black/50 text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={13} />
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-base">
      {/* 头部 */}
      <header className="px-5 py-4 md:px-8 md:py-5 flex items-center gap-3 bg-base border-b border-white/5">
        <button
          onClick={onBack}
          className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all md:hidden"
        >
          <ArrowLeft size={20} />
        </button>
        <Palette className="w-5 h-5 text-purple-400" />
        <h1 className="text-white text-lg md:text-xl font-bold tracking-tight flex-1">外观</h1>
        <button
          onClick={onBack}
          className="hidden md:block px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-white/5 rounded-xl transition-all"
        >
          返回设置
        </button>
      </header>

      {safeMode && (
        <div className="mx-5 md:mx-8 mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-yellow-500/10 border border-yellow-500/30 text-yellow-400 text-xs">
          <ShieldAlert size={14} /> 安全模式（?safe=1）：主题渲染已跳过，界面使用默认样式
        </div>
      )}

      {/* Tab */}
      <div className="flex gap-2 px-5 pt-4 md:px-8">
        <button
          onClick={() => setTab('themes')}
          className={`px-4 py-1.5 rounded-lg text-xs transition-all ${tab === 'themes' ? 'bg-white text-black font-medium' : 'bg-surface text-gray-400 hover:bg-elevated'}`}
        >
          主题
        </button>
        <button
          onClick={() => setTab('studio')}
          className={`px-4 py-1.5 rounded-lg text-xs transition-all ${tab === 'studio' ? 'bg-white text-black font-medium' : 'bg-surface text-gray-400 hover:bg-elevated'}`}
        >
          主题工坊
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 md:px-8 pb-24">
        <div className="max-w-3xl mx-auto">
          {tab === 'themes' ? (
            <>
              {/* 主题卡片墙 */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {BUILT_IN_THEMES.map((t) => <ThemeCard key={t.id} pack={t} />)}
                {userThemes.map((t) => (
                  <ThemeCard
                    key={t.id}
                    pack={t}
                    onDelete={() => { deleteById(t.id); toast({ title: '已删除主题', description: t.name }); }}
                  />
                ))}
              </div>

              {/* 导入/导出/重置 */}
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <button onClick={() => setImportOpen(!importOpen)} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-surface border border-white/5 text-gray-300 text-xs hover:bg-elevated transition-all">
                  <Upload size={14} /> 导入主题
                </button>
                <button onClick={exportActive} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-surface border border-white/5 text-gray-300 text-xs hover:bg-elevated transition-all">
                  <Download size={14} /> 导出文件
                </button>
                <button onClick={copyActiveCode} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-surface border border-white/5 text-gray-300 text-xs hover:bg-elevated transition-all">
                  <ClipboardPaste size={14} /> 复制主题码
                </button>
                <button onClick={resetAppearance} className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-surface border border-white/5 text-red-400/90 text-xs hover:bg-elevated transition-all">
                  <RotateCcw size={14} /> 重置外观
                </button>
              </div>

              {/* 导入面板 */}
              {importOpen && (
                <div className="mt-3 p-4 rounded-xl bg-surface border border-white/5 space-y-3">
                  <p className="text-gray-400 text-xs flex items-center gap-1.5"><FileJson size={13} /> 支持主题 JSON 文件、主题码（BI2.开头）、远程 URL</p>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <button onClick={() => fileRef.current?.click()} className="flex-1 py-2.5 rounded-lg bg-elevated text-gray-300 text-xs hover:bg-white/10 transition-all flex items-center justify-center gap-1.5">
                      <FileJson size={14} /> 选择文件
                    </button>
                    <input ref={fileRef} type="file" accept=".json,.bismuth-theme,application/json" className="hidden"
                      onChange={(e) => { onPickFile(e.target.files?.[0]); e.target.value = ''; }} />
                    <input
                      value={pasteCode}
                      onChange={(e) => setPasteCode(e.target.value)}
                      placeholder="粘贴主题码（BI2.…）"
                      className="flex-1 min-w-0 px-3 py-2.5 rounded-lg bg-elevated border border-white/5 text-white text-xs placeholder:text-gray-600 focus:outline-none focus:border-purple-500/40"
                    />
                    <button onClick={() => handleImportResult(decodeThemeCode(pasteCode))} className="px-4 py-2.5 rounded-lg bg-purple-500 text-white text-xs hover:bg-purple-400 transition-all">
                      导入
                    </button>
                  </div>
                  <div className="flex gap-2.5">
                    <input
                      value={importUrl}
                      onChange={(e) => setImportUrl(e.target.value)}
                      placeholder="https://example.com/theme.json"
                      className="flex-1 min-w-0 px-3 py-2.5 rounded-lg bg-elevated border border-white/5 text-white text-xs placeholder:text-gray-600 focus:outline-none focus:border-purple-500/40"
                    />
                    <button onClick={onImportUrl} className="px-4 py-2.5 rounded-lg bg-elevated text-gray-300 text-xs hover:bg-white/10 transition-all flex items-center gap-1.5">
                      <Link2 size={14} /> 拉取
                    </button>
                  </div>
                </div>
              )}

              <p className="mt-4 text-gray-600 text-xs leading-relaxed">
                当前主题：{activeName}。含外链资源（CSS/图片）的主题导入时会询问是否信任；未信任状态下外链会被剥离，防止第三方 CSS 携带外部请求。界面异常可在地址栏追加 <code className="text-gray-400">?safe=1</code> 进入安全模式，或点「重置外观」。
              </p>
            </>
          ) : (
            <>
              {/* ── 主题工坊：调色盘 ── */}
              <section className="rounded-xl bg-surface border border-white/5 p-4">
                <h2 className="text-white text-sm font-medium flex items-center gap-2 mb-3">
                  <Wand2 size={15} className="text-purple-400" /> 调色盘
                  <span className="text-gray-600 text-xs font-normal">改动即时预览并自动保存，刷新后保留；也可「另存为主题」固化</span>
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {COLOR_FIELDS.map(({ key, label }) => {
                    const val = draft?.vars?.[key] || activePack?.vars?.[key as keyof ThemeVars] || DEFAULT_VARS[key] || '#000000';
                    return (
                      <label key={key} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-elevated cursor-pointer">
                        <input
                          type="color"
                          value={val}
                          onChange={(e) => commitDraft({ vars: { ...(draft?.vars || {}), [key]: e.target.value } })}
                          className="w-7 h-7 rounded-md cursor-pointer bg-transparent border-0 p-0"
                        />
                        <span className="text-gray-400 text-xs flex-1">{label}</span>
                        <span className="text-gray-600 text-[10px] font-mono">{val}</span>
                      </label>
                    );
                  })}
                </div>
                <div className="mt-3 flex items-center gap-2.5 flex-wrap">
                  <Type size={14} className="text-gray-500" />
                  <select
                    value={draft?.vars?.font || ''}
                    onChange={(e) => commitDraft({ vars: { ...(draft?.vars || {}), font: e.target.value || undefined } })}
                    className="px-3 py-2 rounded-lg bg-elevated border border-white/5 text-gray-300 text-xs focus:outline-none"
                  >
                    {FONT_OPTIONS.map((f) => <option key={f.label} value={f.value}>{f.label}</option>)}
                  </select>
                  <input
                    value={draft?.name || ''}
                    onChange={(e) => updateDraft({ name: e.target.value })}
                    placeholder="主题名称"
                    className="px-3 py-2 rounded-lg bg-elevated border border-white/5 text-white text-xs w-36 placeholder:text-gray-600 focus:outline-none"
                  />
                  <div className="flex-1" />
                  {draft && (
                    <button onClick={stopPreview} className="px-3 py-2 rounded-lg bg-elevated text-gray-400 text-xs hover:bg-white/10 transition-all">
                      还原
                    </button>
                  )}
                  <button
                    onClick={saveAsTheme}
                    disabled={!draft}
                    className="px-4 py-2 rounded-lg bg-purple-500 text-white text-xs hover:bg-purple-400 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    另存为主题
                  </button>
                </div>
              </section>

              {/* ── 壁纸 ── */}
              <section className="mt-3 rounded-xl bg-surface border border-white/5 p-4">
                <h2 className="text-white text-sm font-medium flex items-center gap-2 mb-3">
                  <ImageIcon size={15} className="text-purple-400" /> 壁纸
                </h2>
                <div className="flex flex-wrap gap-2.5">
                  <button onClick={() => commitDraft({ wallpaper: { type: 'none' } })}
                    className={`px-3 py-2 rounded-lg text-xs transition-all ${(!draft?.wallpaper || draft?.wallpaper.type === 'none') ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' : 'bg-elevated text-gray-400 hover:bg-white/10'}`}>
                    无壁纸
                  </button>
                  <button onClick={() => wallRef.current?.click()}
                    className="px-3 py-2 rounded-lg bg-elevated text-gray-400 text-xs hover:bg-white/10 transition-all flex items-center gap-1.5">
                    <Upload size={13} /> 上传图片
                  </button>
                  <input ref={wallRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { pickImage(e.target.files?.[0], (d) => commitDraft({ wallpaper: { type: 'data', value: d, blur: draft?.wallpaper?.blur ?? 0, mask: draft?.wallpaper?.mask ?? 55 } })); e.target.value = ''; }} />
                </div>
                <input
                  value={draft?.wallpaper?.type === 'url' ? draft.wallpaper.value || '' : ''}
                  onChange={(e) => commitDraft({ wallpaper: { type: 'url', value: e.target.value, blur: draft?.wallpaper?.blur ?? 0, mask: draft?.wallpaper?.mask ?? 55 } })}
                  placeholder="或粘贴壁纸图片 URL…"
                  className="mt-2.5 w-full px-3 py-2 rounded-lg bg-elevated border border-white/5 text-white text-xs placeholder:text-gray-600 focus:outline-none focus:border-purple-500/40"
                />
                {draft?.wallpaper && draft.wallpaper.type !== 'none' && (
                  <div className="mt-3 space-y-2">
                    <SliderRow label="模糊" value={draft.wallpaper.blur ?? 0} max={24} onChange={(v) => commitDraft({ wallpaper: { ...draft.wallpaper!, blur: v } })} />
                    <SliderRow label="遮罩浓度" value={draft.wallpaper.mask ?? 55} max={95} onChange={(v) => commitDraft({ wallpaper: { ...draft.wallpaper!, mask: v } })} />
                  </div>
                )}
              </section>

              {/* ── 品牌 ── */}
              <section className="mt-3 rounded-xl bg-surface border border-white/5 p-4">
                <h2 className="text-white text-sm font-medium mb-3">品牌自定义</h2>
                <div className="flex gap-2.5 items-center">
                  <input
                    value={draft?.brand?.appName || ''}
                    onChange={(e) => commitDraft({ brand: { ...draft?.brand, appName: e.target.value } })}
                    placeholder="应用名（默认 Bismuth，标题栏同步修改）"
                    className="flex-1 px-3 py-2 rounded-lg bg-elevated border border-white/5 text-white text-xs placeholder:text-gray-600 focus:outline-none focus:border-purple-500/40"
                  />
                  <button onClick={() => logoRef.current?.click()} className="px-3 py-2 rounded-lg bg-elevated text-gray-400 text-xs hover:bg-white/10 transition-all flex items-center gap-1.5">
                    <Upload size={13} /> 上传 Logo
                  </button>
                  <input ref={logoRef} type="file" accept="image/*" className="hidden"
                    onChange={(e) => { pickImage(e.target.files?.[0], (d) => commitDraft({ brand: { ...draft?.brand, logo: d } })); e.target.value = ''; }} />
                </div>
              </section>

              {/* ── 自定义 CSS ── */}
              <section className="mt-3 rounded-xl bg-surface border border-white/5 p-4">
                <h2 className="text-white text-sm font-medium flex items-center gap-2 mb-3">
                  <Code2 size={15} className="text-purple-400" /> 自定义 CSS
                  <span className="text-gray-600 text-xs font-normal">可覆盖任意样式类；未信任主题时外链 url() 会被剥离</span>
                </h2>
                <textarea
                  value={draft?.css || ''}
                  onChange={(e) => commitDraft({ css: e.target.value })}
                  rows={6}
                  spellCheck={false}
                  placeholder={'/* 例：视频卡片悬浮放大 */\n.group:hover .aspect-\\[2\\/3\\] { transform: scale(1.03); }'}
                  className="w-full px-3 py-2.5 rounded-lg bg-elevated border border-white/5 text-gray-200 text-xs font-mono placeholder:text-gray-600 focus:outline-none focus:border-purple-500/40 resize-y"
                />
              </section>

              {/* ── 外链皮肤 ── */}
              <section className="mt-3 rounded-xl bg-surface border border-white/5 p-4">
                <h2 className="text-white text-sm font-medium flex items-center gap-2 mb-3">
                  <Link2 size={15} className="text-purple-400" /> 外链 CSS 皮肤
                </h2>
                <input
                  value={(draft as (DraftTheme & { cssUrl?: string }) | null)?.cssUrl || ''}
                  onChange={(e) => commitDraft({ ...(e.target.value ? { cssUrl: e.target.value } : {}) } as Partial<DraftTheme>)}
                  placeholder="https://example.com/my-skin.css（留空不使用）"
                  className="w-full px-3 py-2 rounded-lg bg-elevated border border-white/5 text-white text-xs placeholder:text-gray-600 focus:outline-none focus:border-purple-500/40"
                />
                <div className="mt-2.5 flex items-center gap-4 flex-wrap">
                  <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                    <input
                      type="radio" name="cssMode" checked={!draft || (draft as DraftTheme & { cssMode?: string }).cssMode !== 'replace'}
                      onChange={() => commitDraft({ ...( { cssMode: 'override' } ) } as Partial<DraftTheme>)}
                    />
                    叠加模式（推荐）
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer">
                    <input
                      type="radio" name="cssMode" checked={(draft as DraftTheme & { cssMode?: string } | null)?.cssMode === 'replace'}
                      onChange={() => commitDraft({ ...( { cssMode: 'replace' } ) } as Partial<DraftTheme>)}
                    />
                    整份替换（专家：主题需含完整样式表，失败自动回退）
                  </label>
                  <label className="flex items-center gap-2 text-xs text-gray-400 cursor-pointer ml-auto">
                    <input
                      type="checkbox"
                      checked={(draft as DraftTheme & { trustRemote?: boolean } | null)?.trustRemote === true}
                      onChange={(e) => commitDraft({ ...( { trustRemote: e.target.checked } ) } as Partial<DraftTheme>)}
                    />
                    信任此外链
                  </label>
                </div>
              </section>
            </>
          )}
        </div>
      </div>

      {/* 信任确认弹窗 */}
      {pendingPack && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bi-glass-overlay p-4" onClick={() => setPendingPack(null)}>
          <div className="bi-glass-panel rounded-2xl max-w-sm w-full p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-3">
              <ShieldAlert className="w-6 h-6 text-yellow-500" />
              <h3 className="text-white font-bold">信任此外部资源？</h3>
            </div>
            <p className="text-gray-400 text-sm leading-relaxed mb-1.5">
              主题「{pendingPack.name}」包含外部链接（CSS 皮肤或远程图片）。
            </p>
            <p className="text-gray-500 text-xs leading-relaxed mb-4">
              不信任 = 剥离外链后照常使用；信任 = 允许其加载外部资源。外部 CSS 理论上可将你的本地数据请求发往第三方，请仅信任可信来源。
            </p>
            <div className="flex gap-2.5">
              <button onClick={() => { const p = { ...pendingPack, trustRemote: false }; setPendingPack(null); finishImport(p); }}
                className="flex-1 py-2.5 rounded-xl bg-elevated text-gray-300 text-sm hover:bg-white/10 transition-all">
                不信任，剥离外链
              </button>
              <button onClick={() => { const p = { ...pendingPack, trustRemote: true }; setPendingPack(null); finishImport(p); }}
                className="flex-1 py-2.5 rounded-xl bg-purple-500 text-white text-sm hover:bg-purple-400 transition-all">
                信任并导入
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* 调色盘字段在无草稿时的展示兜底（默认暗夜值） */
const DEFAULT_VARS: Partial<Record<keyof ThemeVars, string>> = {
  bgBase: '#0a0a0a', bgSurface: '#141414', bgElevated: '#1a1a1a',
  white: '#ffffff', gray500: '#6b7280', purple500: '#a855f7',
};

function hexSwatch(hex: string): string {
  const t = hex.replace('#', '');
  const full = t.length === 3 ? t.split('').map((c) => c + c).join('') : t;
  const n = parseInt(full, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

function SliderRow({ label, value, max, onChange }: { label: string; value: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-gray-500 text-xs w-14 flex-shrink-0">{label}</span>
      <input
        type="range" min={0} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="flex-1 h-1.5 accent-purple-500"
      />
      <span className="text-gray-600 text-[10px] w-7 text-right font-mono">{value}</span>
    </div>
  );
}

