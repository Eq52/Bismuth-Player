/**
 * ThemeContext — 主题系统 React 接线层
 *
 * 挂载时恢复上次激活主题；提供切换/另存/删除/草稿实时预览；
 * WallpaperLayer 负责壁纸渲染；BrandLogo 统一处理 Logo 替换。
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  BUILT_IN_THEMES, applyThemePack, clearThemeStyles, getActiveThemeId,
  setActiveThemeId, getDraft, setDraft as persistDraft, saveTheme, loadTheme,
  listUserThemes, removeUserTheme, isSafeMode, draftToPreviewPack,
  type ThemePack, type DraftTheme, type Wallpaper,
} from './theme';

interface ThemeCtx {
  activeId: string | null;          // null = 默认暗夜
  activeName: string;
  appName: string;
  logo: string | null;
  wallpaper: Wallpaper | null;      // 已解析（dataURL 已还原）
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

  const apply = useCallback(async (pack: ThemePack | null) => {
    if (!pack) {
      clearThemeStyles();
      setAppName('Bismuth');
      setLogo(null);
      setWallpaper(null);
      return;
    }
    await applyThemePack(pack);
    setAppName(pack.brand?.appName?.trim() || 'Bismuth');
    setLogo(pack.brand?.logo || null);
    setWallpaper(pack.wallpaper && pack.wallpaper.type !== 'none' ? pack.wallpaper : null);
  }, []);

  const refreshUserThemes = useCallback(async () => {
    setUserThemes(await listUserThemes());
  }, []);

  // 初始化：工坊草稿优先（壁纸/品牌/CSS 等改动自动持久化），否则恢复激活主题
  useEffect(() => {
    (async () => {
      if (safeMode) return;
      const d = getDraft();
      if (d) {
        setDraftState(d);
        await apply(draftToPreviewPack(d));
      } else {
        const id = getActiveThemeId();
        if (id) {
          const pack = await loadTheme(id);
          if (pack) {
            setActiveIdState(id);
            await apply(pack);
          }
        }
      }
      await refreshUserThemes();
    })();
  }, [safeMode, apply, refreshUserThemes]);

  const switchTheme = useCallback(async (id: string | null) => {
    // 切换主题 = 明确放弃工坊未另存的草稿，避免下次刷新被鬼草稿覆盖
    persistDraft(null);
    setDraftState(null);
    setActiveThemeId(id);
    setActiveIdState(id);
    if (id === null) {
      await apply(null);
      return;
    }
    const pack = await loadTheme(id);
    if (pack) await apply(pack);
  }, [apply]);

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
      persistDraft(next);
      return next;
    });
  }, []);

  const clearDraft = useCallback(() => {
    setDraftState(null);
    persistDraft(null);
  }, []);

  // 调色盘实时预览：不落盘激活态，只渲染（草稿本身已在 updateDraft 时持久化）
  const previewDraft = useCallback(async (d: DraftTheme | null) => {
    if (!d) {
      const id = getActiveThemeId();
      const pack = id ? await loadTheme(id) : null;
      await apply(pack);
      return;
    }
    await apply(draftToPreviewPack(d));
  }, [apply]);

  const resetAppearance = useCallback(async () => {
    persistDraft(null);
    setDraftState(null);
    await switchTheme(null);
  }, [switchTheme]);

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
