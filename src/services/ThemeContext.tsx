/**
 * ThemeContext — 主题系统 React 接线层
 *
 * 挂载时恢复上次激活主题；提供切换/另存/删除/草稿实时预览；
 * WallpaperLayer 负责壁纸渲染；BrandLogo 统一处理 Logo 替换。
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  BUILT_IN_THEMES, applyThemePack, applyWallpaperStyle, clearThemeStyles, getActiveThemeId,
  setActiveThemeId, getDraft, setDraft as persistDraft, saveTheme, loadTheme,
  listUserThemes, removeUserTheme, isSafeMode, draftToPreviewPack,
  getUserWallpaper, setUserWallpaper,
  type ThemePack, type DraftTheme, type Wallpaper,
} from './theme';

interface ThemeCtx {
  activeId: string | null;          // null = 默认暗夜
  activeName: string;
  appName: string;
  logo: string | null;
  wallpaper: Wallpaper | null;      // 最终生效壁纸（用户壁纸 > 主题包壁纸）
  safeMode: boolean;
  switchTheme: (id: string | null) => Promise<void>;
  importAndSave: (pack: ThemePack) => Promise<void>;
  deleteById: (id: string) => Promise<void>;
  draft: DraftTheme | null;
  updateDraft: (patch: Partial<DraftTheme>) => void;
  clearDraft: () => void;
  previewDraft: (d: DraftTheme | null) => Promise<void>;
  resetAppearance: () => Promise<void>;
  refreshUserThemes: () => Promise<void>;
  userThemes: ThemePack[];
}

const Ctx = createContext<ThemeCtx | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [activeId, setActiveIdState] = useState<string | null>(null);
  const [appName, setAppName] = useState('Bismuth');
  const [logo, setLogo] = useState<string | null>(null);
  const [wallpaper, setWallpaper] = useState<Wallpaper | null>(null);
  const [draft, setDraftState] = useState<DraftTheme | null>(null);
  const [userThemes, setUserThemes] = useState<ThemePack[]>([]);
  const safeMode = useMemo(() => isSafeMode(), []);

  /**
   * 应用主题 + 壁纸（统一入口）。
   * 壁纸优先级：用户壁纸（独立全局设置，切主题不丢）> 主题包自带壁纸 > 无。
   * pack=null = 重置为默认暗夜（用户壁纸仍生效）。
   */
  const apply = useCallback(async (pack: ThemePack | null, userWp: Wallpaper | null) => {
    if (!pack) {
      clearThemeStyles();
      setAppName('Bismuth');
      setLogo(null);
    } else {
      await applyThemePack(pack);
      setAppName(pack.brand?.appName?.trim() || 'Bismuth');
      setLogo(pack.brand?.logo || null);
    }
    const wp = userWp || (pack?.wallpaper && pack.wallpaper.type !== 'none' ? pack.wallpaper : null) || null;
    setWallpaper(wp);
    applyWallpaperStyle(wp || { type: 'none' }); // 统一渲染（覆盖 applyThemePack 内对包壁纸的渲染）
  }, []);

  const refreshUserThemes = useCallback(async () => {
    setUserThemes(await listUserThemes());
  }, []);

  // 初始化：工坊草稿优先，否则恢复激活主题；用户壁纸始终叠加参与
  useEffect(() => {
    (async () => {
      if (safeMode) return;
      const uw = await getUserWallpaper();
      const d = await getDraft(); // 异步：草稿大资产（壁纸 dataURL）需从 IDB 还原
      if (d) {
        setDraftState(d);
        await apply(draftToPreviewPack(d), uw);
      } else {
        const id = getActiveThemeId();
        if (id) {
          const pack = await loadTheme(id);
          if (pack) {
            setActiveIdState(id);
            await apply(pack, uw);
          }
        }
      }
      await refreshUserThemes();
    })();
  }, [safeMode, apply, refreshUserThemes]);

  const switchTheme = useCallback(async (id: string | null) => {
    // 切换主题 = 明确放弃工坊未另存的草稿（配色基线重置），但用户壁纸独立存储不受影响
    void persistDraft(null);
    setDraftState(null);
    setActiveThemeId(id);
    setActiveIdState(id);
    if (id === null) {
      await apply(null, wallpaper);
      return;
    }
    const pack = await loadTheme(id);
    if (pack) await apply(pack, wallpaper);
  }, [apply, wallpaper]);

  const importAndSave = useCallback(async (pack: ThemePack) => {
    await saveTheme(pack);
    await refreshUserThemes();
    await switchTheme(pack.id);
  }, [refreshUserThemes, switchTheme]);

  const deleteById = useCallback(async (id: string) => {
    await removeUserTheme(id);
    await refreshUserThemes();
    if (getActiveThemeId() === id) await switchTheme(null);
  }, [refreshUserThemes, switchTheme]);

  // 草稿落盘延迟到 effect：updater 必须保持纯函数，且 IDB 写入异步；
  // 连续快速改动（拖滑块）合并提交时只持久化最终值
  const pendingDraftRef = useRef<DraftTheme | null>(null);

  const updateDraft = useCallback((patch: Partial<DraftTheme>) => {
    setDraftState((prev) => {
      const next: DraftTheme = {
        id: 'custom-draft',
        name: '我的主题',
        dark: true,
        vars: {},
        ...(prev || {}),
        ...patch,
      };
      pendingDraftRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    const d = pendingDraftRef.current;
    if (!d) return;
    pendingDraftRef.current = null;
    void persistDraft(d);
    // 壁纸 = 用户全局设置：工坊改动时同步独立存储（none → 清除），切主题/刷新后仍在
    if (d.wallpaper !== undefined) void setUserWallpaper(d.wallpaper.type === 'none' ? null : d.wallpaper);
  }, [draft]);

  const clearDraft = useCallback(async () => {
    setDraftState(null);
    void persistDraft(null);
    // 清稿后回到激活主题 + 当前壁纸（否则页面残留草稿预览样式）
    const id = getActiveThemeId();
    const pack = id ? await loadTheme(id) : null;
    await apply(pack, wallpaper);
  }, [apply, wallpaper]);

  // 调色盘实时预览：不落盘激活态，只渲染（壁纸仍以用户壁纸优先保持连续性）
  const previewDraft = useCallback(async (d: DraftTheme | null) => {
    if (!d) {
      const id = getActiveThemeId();
      const pack = id ? await loadTheme(id) : null;
      await apply(pack, wallpaper);
      return;
    }
    await apply(draftToPreviewPack(d), wallpaper);
  }, [apply, wallpaper]);

  const resetAppearance = useCallback(async () => {
    void persistDraft(null);
    void setUserWallpaper(null); // 重置外观 = 全清：草稿 + 用户壁纸
    setDraftState(null);
    setActiveThemeId(null);
    setActiveIdState(null);
    await apply(null, null);
  }, [apply]);

  const value: ThemeCtx = {
    activeId, activeName: activeId ? (BUILT_IN_THEMES.find(t => t.id === activeId)?.name || userThemes.find(t => t.id === activeId)?.name || '自定义') : '暗夜',
    appName, logo, wallpaper, safeMode,
    switchTheme, importAndSave, deleteById,
    draft, updateDraft, clearDraft, previewDraft, resetAppearance,
    refreshUserThemes, userThemes,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme(): ThemeCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useTheme 必须在 ThemeProvider 内使用');
  return ctx;
}

/** 壁纸层：挂在 App 根节点内，配合 --bi-page-alpha:0 透出底图 */
export function WallpaperLayer() {
  const { wallpaper } = useTheme();
  if (!wallpaper || wallpaper.type === 'none' || !wallpaper.value) return null;
  // 引擎把样式写进 #bi-theme-wallpaper，这里只负责挂节点
  return <div id="bi-theme-wallpaper" aria-hidden />;
}

/** 品牌 Logo：有自定义 Logo 用图，否则渲染 fallback（如 Film 图标） */
export function BrandLogo({ iconClassName, fallback }: { iconClassName?: string; fallback?: React.ReactNode }) {
  const { logo, appName } = useTheme();
  if (logo) {
    return <img src={logo} alt={appName} className={iconClassName || 'w-full h-full object-cover'} draggable={false} />;
  }
  return <>{fallback ?? null}</>;
}
