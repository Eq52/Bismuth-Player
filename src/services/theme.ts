/**
 * theme — Bismuth 主题引擎
 *
 * 主题包 schema（bismuth-theme: "2.1"）：
 *   vars      颜色/字体令牌（hex），引擎换算成 RGB 三元组写 :root
 *   brand     应用名 / Logo（dataURL 或 URL）
 *   wallpaper 壁纸（url | data | gradient）+ 模糊/遮罩
 *   css       内联自定义 CSS
 *   cssUrl    外链 CSS 皮肤（fetch → IDB 缓存 → 注入）
 *   cssMode   override（默认，叠加在内置 CSS 之上）| replace（专家模式，禁用内置样式表）
 *   trustRemote  信任外链资源（不剥离 @import/url()）
 *
 * 执行顺序：vars → 内联 css → 外链 cssUrl，后者覆盖前者。
 * 安全阀：?safe=1 完全跳过；未信任主题的 CSS 剥离外链；replace 失败自动回退。
 */

import { isDesktopMode, desktopApiUrl } from './desktop';
import { putTheme, getTheme, listThemes, deleteTheme as idbDeleteTheme, putAsset, getAsset, deleteAsset } from './themeStore';

/* ── 常量 ── */

export const THEME_FORMAT = '2.1';
const LS_ACTIVE = 'bismuth_active_theme';
const LS_DRAFT = 'bismuth_theme_draft';
const MAX_CSS_LEN = 256 * 1024;         // 内联 CSS 上限
const STYLE_INLINE_ID = 'bi-theme-css';
const STYLE_URL_ID = 'bi-theme-url-css';
const WALLPAPER_ID = 'bi-theme-wallpaper';        // React 壁纸 div 的 id
const WALLPAPER_STYLE_ID = 'bi-theme-wallpaper-css'; // 注入壁纸规则的 <style> id

/* ── 类型 ── */

export interface ThemeVars {
  bgBase?: string; bgSurface?: string; bgElevated?: string;
  white?: string; black?: string;
  gray300?: string; gray400?: string; gray500?: string; gray600?: string;
  purple200?: string; purple300?: string; purple400?: string; purple500?: string;
  logoFrom?: string; logoVia?: string; logoTo?: string;   // LOGO 渐变三色（默认紫粉）
  logoIcon?: string;                                       // LOGO 块内图标色（默认白；浅色渐变底可设黑）
  font?: string;
}

export interface Wallpaper {
  type: 'url' | 'data' | 'gradient' | 'none';
  value?: string;      // url / dataURL / CSS gradient 表达式
  blur?: number;       // px 0-20
  mask?: number;       // 0-100 遮罩浓度（底色遮罩透明度百分比）
}

export interface ThemePack {
  format: string;
  id: string;
  name: string;
  author?: string;
  dark: boolean;
  vars?: ThemeVars;
  brand?: { appName?: string; logo?: string };
  wallpaper?: Wallpaper;
  css?: string;
  cssUrl?: string;
  cssMode?: 'override' | 'replace';
  trustRemote?: boolean;
  builtin?: boolean;   // 内置主题标记，不参与存储
}

/* ── 颜色工具 ── */

export function hexToRgbTriplet(hex: string): string | null {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h, 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

// 线性混色 t=0 → a，t=1 → b
export function mixHex(a: string, b: string, t: number): string {
  const p = (h: string): [number, number, number] => {
    let s = h.replace('#', '');
    if (s.length === 3) s = s.split('').map((c) => c + c).join('');
    const n = parseInt(s, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const [r1, g1, b1] = p(a);
  const [r2, g2, b2] = p(b);
  const c = (x: number, y: number) => Math.round(x + (y - x) * t);
  const to2 = (v: number) => v.toString(16).padStart(2, '0');
  return `#${to2(c(r1, r2))}${to2(c(g1, g2))}${to2(c(b1, b2))}`;
}

/** 补全未显式给定的色阶：purple 从 accent 派生，gray 从 gray500/底色派生 */
export function deriveVars(v: ThemeVars): Required<Pick<ThemeVars, 'bgBase' | 'bgSurface' | 'bgElevated' | 'white' | 'black'>> & ThemeVars {
  const out: ThemeVars = { ...v };
  const accent = v.purple500 || '#a855f7';
  const bg = v.bgBase || '#0a0a0a';
  const fg = v.white || '#ffffff';
  const g5 = v.gray500 || '#6b7280';
  if (!out.purple500) out.purple500 = accent;
  if (!out.purple400) out.purple400 = mixHex(accent, fg, 0.25);
  if (!out.purple300) out.purple300 = mixHex(accent, fg, 0.5);
  if (!out.purple200) out.purple200 = mixHex(accent, fg, 0.75);
  if (!out.gray500) out.gray500 = g5;
  if (!out.gray400) out.gray400 = mixHex(g5, fg, 0.35);
  if (!out.gray300) out.gray300 = mixHex(g5, fg, 0.7);
  if (!out.gray600) out.gray600 = mixHex(g5, bg, 0.4);
  return out as typeof out & Required<Pick<ThemeVars, 'bgBase' | 'bgSurface' | 'bgElevated' | 'white' | 'black'>>;
}

/* ── 内置主题 ── */

export const BUILT_IN_THEMES: ThemePack[] = [
  {
    format: THEME_FORMAT, id: 'midnight', name: '暗夜', author: 'Bismuth', dark: true, builtin: true,
    vars: {
      bgBase: '#0a0a0a', bgSurface: '#141414', bgElevated: '#1a1a1a',
      white: '#ffffff', black: '#000000',
      gray300: '#d1d5db', gray400: '#9ca3af', gray500: '#6b7280', gray600: '#4b5563',
      purple200: '#e9d5ff', purple300: '#d8b4fe', purple400: '#c084fc', purple500: '#a855f7',
    },
  },
  {
    format: THEME_FORMAT, id: 'daylight', name: '纯白', author: 'Bismuth', dark: false, builtin: true,
    vars: {
      bgBase: '#f4f4f6', bgSurface: '#ffffff', bgElevated: '#e9e9ee',
      white: '#17171c', black: '#ffffff',
      gray300: '#5c5c66', gray400: '#71717c', gray500: '#8a8a95', gray600: '#a5a5ae',
      purple200: '#6d28d9', purple300: '#7c3aed', purple400: '#8b5cf6', purple500: '#7c3aed',
      logoFrom: '#17171c', logoVia: '#3d3d46', logoTo: '#71717c',   // 亮色下 LOGO 黑白灰
    },
    wallpaper: { type: 'none' },
  },
  {
    format: THEME_FORMAT, id: 'soy-green', name: '护眼豆沙', author: 'Bismuth', dark: false, builtin: true,
    vars: {
      bgBase: '#c9e8ce', bgSurface: '#d8f0dc', bgElevated: '#bfe2c5',
      white: '#25402c', black: '#eef7ef',
      gray300: '#4d6b54', gray400: '#5d7a64', gray500: '#6f8a76', gray600: '#88998c',
      purple200: '#3a7d4d', purple300: '#418f58', purple400: '#4a9c62', purple500: '#3f8a54',
      logoFrom: '#2f6b40', logoVia: '#3f8a54', logoTo: '#62ab77',
    },
  },
  {
    format: THEME_FORMAT, id: 'amber-retro', name: '琥珀复古', author: 'Bismuth', dark: true, builtin: true,
    vars: {
      bgBase: '#171310', bgSurface: '#211b16', bgElevated: '#2b2219',
      white: '#f5e9d8', black: '#120e0a',
      gray300: '#c9b394', gray400: '#a8906f', gray500: '#87704f', gray600: '#6b5a42',
      purple200: '#fbbf24', purple300: '#f59e0b', purple400: '#d97706', purple500: '#b45309',
      logoFrom: '#92400e', logoVia: '#b45309', logoTo: '#d97706',
    },
  },
  {
    format: THEME_FORMAT, id: 'neon-city', name: '霓虹都市', author: 'Bismuth', dark: true, builtin: true,
    vars: {
      bgBase: '#0a0a12', bgSurface: '#12121e', bgElevated: '#1a1a2e',
      white: '#eef2ff', black: '#050509',
      gray300: '#b6b9d4', gray400: '#8e92b3', gray500: '#6b6f93', gray600: '#545876',
      purple200: '#fda4af', purple300: '#fb7185', purple400: '#f43f5e', purple500: '#e11d48',
      logoFrom: '#be123c', logoVia: '#e11d48', logoTo: '#fb7185',
    },
  },
];

/* ── 校验与导入导出 ── */

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export interface ValidationResult {
  pack?: ThemePack;
  error?: string;
  hasRemote?: boolean; // CSS 含外链（@import / url()），导入时需询问信任
}

export function validateThemePack(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== 'object') return { error: '不是有效的主题对象' };
  const o = raw as Record<string, unknown>;
  if (o['bismuth-theme'] !== THEME_FORMAT) {
    return { error: `不支持的主题格式（需要 bismuth-theme: ${THEME_FORMAT}）` };
  }
  if (typeof o['id'] !== 'string' || !/^[a-zA-Z0-9_-]{1,64}$/.test(o['id'])) {
    return { error: 'id 缺失或含非法字符' };
  }
  if (typeof o['name'] !== 'string' || o['name'].length > 64) {
    return { error: 'name 缺失或过长' };
  }
  const vars = o['vars'] as Record<string, unknown> | undefined;
  if (vars !== undefined) {
    if (typeof vars !== 'object' || vars === null) return { error: 'vars 格式错误' };
    for (const [k, val] of Object.entries(vars)) {
      if (k === 'font') {
        if (typeof val !== 'string' || val.length > 512) return { error: 'font 字段非法' };
        continue;
      }
      if (typeof val !== 'string' || !HEX_RE.test(val)) {
        return { error: `颜色字段 ${k} 不是合法的 hex 颜色` };
      }
    }
  }
  const wp = o['wallpaper'] as Record<string, unknown> | undefined;
  if (wp !== undefined && wp !== null) {
    if (typeof wp !== 'object') return { error: 'wallpaper 格式错误' };
    const t = wp['type'];
    if (t !== 'url' && t !== 'data' && t !== 'gradient' && t !== 'none') {
      return { error: 'wallpaper.type 非法' };
    }
    if (t === 'url' && (typeof wp['value'] !== 'string' || (wp['value'] as string).length > 2048)) {
      return { error: 'wallpaper.value 非法' };
    }
    if (t === 'data' && (typeof wp['value'] !== 'string' || (wp['value'] as string).length > 3 * 1024 * 1024)) {
      return { error: '壁纸图片超过 3MB，请压缩后再导入' };
    }
  }
  if (o['css'] !== undefined && (typeof o['css'] !== 'string' || (o['css'] as string).length > MAX_CSS_LEN)) {
    return { error: `css 过长（上限 ${MAX_CSS_LEN / 1024}KB）` };
  }
  if (o['cssUrl'] !== undefined && (typeof o['cssUrl'] !== 'string' || (o['cssUrl'] as string).length > 2048)) {
    return { error: 'cssUrl 非法' };
  }
  if (o['cssMode'] !== undefined && o['cssMode'] !== 'override' && o['cssMode'] !== 'replace') {
    return { error: 'cssMode 只能是 override 或 replace' };
  }

  const pack: ThemePack = {
    format: THEME_FORMAT,
    id: o['id'] as string,
    name: o['name'] as string,
    author: typeof o['author'] === 'string' ? o['author'].slice(0, 64) : undefined,
    dark: o['dark'] !== false,
    vars: vars as ThemeVars | undefined,
    brand: o['brand'] as ThemePack['brand'],
    wallpaper: wp as unknown as Wallpaper | undefined,
    css: o['css'] as string | undefined,
    cssUrl: o['cssUrl'] as string | undefined,
    cssMode: o['cssMode'] as ThemePack['cssMode'],
    trustRemote: o['trustRemote'] === true,
  };

  const cssText = pack.css || '';
  const hasRemote = /@import|url\s*\(/i.test(cssText) || !!pack.cssUrl ||
    (pack.brand?.logo ? /^(https?:)?\/\//i.test(pack.brand.logo) : false);

  return { pack, hasRemote };
}

/** 主题码：BI2.<base64(json)> */
export function encodeThemeCode(pack: ThemePack): string {
  return 'BI2.' + btoa(unescape(encodeURIComponent(JSON.stringify(pack))));
}

export function decodeThemeCode(code: string): ValidationResult {
  const trimmed = code.trim();
  try {
    const json = trimmed.startsWith('BI2.')
      ? decodeURIComponent(escape(atob(trimmed.slice(4))))
      : trimmed;
    const obj = JSON.parse(json);
    return validateThemePack(obj);
  } catch {
    return { error: '主题码或 JSON 解析失败' };
  }
}

/* ── CSS 注入与安全 ── */

/** 剥离外链资源：@import 与 url() 全部移除 */
export function sanitizeCss(css: string): string {
  return css
    .replace(/@import[^;]+;?/gi, '/* @import removed */')
    .replace(/url\s*\(\s*['"]?[^)'"]*['"]?\s*\)/gi, 'none');
}

function injectStyle(id: string, css: string): void {
  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = css;
}

function removeStyle(id: string): void {
  document.getElementById(id)?.remove();
}

/** 内置样式表（Vite 构建产物 link）禁用/恢复 —— replace 模式与回退用 */
function setBuiltCssDisabled(disabled: boolean): void {
  document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]').forEach((link) => {
    const href = link.getAttribute('href') || '';
    if (/\/assets\/index-[\w-]+\.css/.test(href)) {
      link.disabled = disabled;
    }
  });
}

/* ── 应用引擎 ── */

export function isSafeMode(): boolean {
  try {
    return new URLSearchParams(window.location.search).get('safe') === '1';
  } catch {
    return false;
  }
}

function setVars(vars: ThemeVars): void {
  const root = document.documentElement.style;
  const full = deriveVars(vars);
  const map: Record<string, string | undefined> = {
    '--bi-bg-base': full.bgBase,
    '--bi-bg-surface': full.bgSurface,
    '--bi-bg-elevated': full.bgElevated,
    '--bi-white': full.white,
    '--bi-black': full.black,
    '--bi-gray-300': full.gray300,
    '--bi-gray-400': full.gray400,
    '--bi-gray-500': full.gray500,
    '--bi-gray-600': full.gray600,
    '--bi-purple-200': full.purple200,
    '--bi-purple-300': full.purple300,
    '--bi-purple-400': full.purple400,
    '--bi-purple-500': full.purple500,
    '--bi-logo-from': full.logoFrom,
    '--bi-logo-via': full.logoVia,
    '--bi-logo-to': full.logoTo,
    '--bi-logo-icon': full.logoIcon,
  };
  for (const [k, hex] of Object.entries(map)) {
    const triplet = hex ? hexToRgbTriplet(hex) : null;
    if (triplet) root.setProperty(k, triplet);
    else root.removeProperty(k); // 切到无此变量的主题（如暗夜无 logo*）时清除残留，恢复 CSS 默认（紫粉）
  }
  if (full.font) root.setProperty('--bi-font', full.font);
  else root.removeProperty('--bi-font');
}

/** 清除全部主题变量（恢复默认暗夜外观） */
export function clearThemeStyles(): void {
  const root = document.documentElement.style;
  ['--bi-bg-base', '--bi-bg-surface', '--bi-bg-elevated', '--bi-white', '--bi-black',
    '--bi-gray-300', '--bi-gray-400', '--bi-gray-500', '--bi-gray-600',
    '--bi-purple-200', '--bi-purple-300', '--bi-purple-400', '--bi-purple-500',
    '--bi-logo-from', '--bi-logo-via', '--bi-logo-to', '--bi-logo-icon',
    '--bi-font', '--bi-page-alpha',
  ].forEach((k) => root.removeProperty(k));
  removeStyle(STYLE_INLINE_ID);
  removeStyle(STYLE_URL_ID);
  removeStyle(WALLPAPER_STYLE_ID);
  setBuiltCssDisabled(false);
  document.title = 'Bismuth';
}

function applyWallpaperStyle(wp: Wallpaper): void {
  if (wp.type === 'none' || !wp.value) {
    document.documentElement.style.removeProperty('--bi-page-alpha');
    removeStyle(WALLPAPER_STYLE_ID);
    return;
  }
  const triplet = getComputedStyle(document.documentElement).getPropertyValue('--bi-bg-base').trim() || '10 10 10';
  const mask = Math.min(Math.max(wp.mask ?? 55, 0), 95) / 100;
  const blur = Math.min(Math.max(wp.blur ?? 0, 0), 24);
  let bg = '';
  if (wp.type === 'gradient') bg = wp.value;
  else bg = `url("${wp.value.replace(/"/g, '\\"')}")`;
  const css = `
#${WALLPAPER_ID} {
  position: fixed; inset: 0; z-index: -10; pointer-events: none;
  background-image: ${bg};
  background-size: cover; background-position: center;
  filter: blur(${blur}px);
  transform: scale(${blur > 0 ? 1 + blur / 50 : 1}); /* 模糊边缘外扩 */
}
#${WALLPAPER_ID}::after {
  content: ''; position: absolute; inset: 0;
  background: rgb(${triplet} / ${mask});
}`;
  injectStyle(WALLPAPER_STYLE_ID, css);
  document.documentElement.style.setProperty('--bi-page-alpha', '0');
}

/** 壁纸样式统一入口：ThemeContext 按用户壁纸/主题包壁纸优先级归一后调用 */
export { applyWallpaperStyle };

async function fetchRemoteCss(url: string): Promise<string> {
  // 桌面壳内走内置代理免 CORS；网页端直连（外链皮肤通常开 CORS，失败则提示用文件导入）
  const target = isDesktopMode() ? desktopApiUrl(url) : url;
  const res = await fetch(target, { headers: { Accept: 'text/css' } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (text.length > MAX_CSS_LEN) throw new Error('外链 CSS 超过 256KB 上限');
  return text;
}

export interface ApplyResult {
  ok: boolean;
  warning?: string;
}

/** 应用完整主题包（异步：可能拉取外链 CSS） */
export async function applyThemePack(pack: ThemePack): Promise<ApplyResult> {
  if (isSafeMode()) {
    clearThemeStyles();
    return { ok: false, warning: '安全模式：已跳过主题渲染' };
  }

  // 1. 颜色与字体
  setVars(pack.vars || {});

  // 2. 品牌
  const appName = pack.brand?.appName?.trim();
  document.title = appName || 'Bismuth';

  // 3. 壁纸
  applyWallpaperStyle(pack.wallpaper || { type: 'none' });

  // 4. 内联 CSS（未信任则剥离外链）
  const inline = pack.css
    ? (pack.trustRemote ? pack.css : sanitizeCss(pack.css))
    : '';
  if (inline.trim()) injectStyle(STYLE_INLINE_ID, inline);
  else removeStyle(STYLE_INLINE_ID);

  // 5. 外链皮肤
  setBuiltCssDisabled(false);
  removeStyle(STYLE_URL_ID);
  if (pack.cssUrl) {
    try {
      // 先查 IDB 缓存，失败/未命中再拉取
      const cacheKey = `css:${pack.id}`;
      let cssText = await getAsset<string>(cacheKey);
      if (!cssText) {
        cssText = await fetchRemoteCss(pack.cssUrl);
        await putAsset(cacheKey, cssText);
      }
      const finalCss = pack.trustRemote ? cssText : sanitizeCss(cssText);
      if (pack.cssMode === 'replace') {
        // 专家模式：禁用内置样式表，主题文件必须是完整样式表；失败自动回退
        setBuiltCssDisabled(true);
        injectStyle(STYLE_URL_ID, finalCss);
        // 完整性探针：注入一个 .hidden 探针元素 —— 内置 CSS 在时它必然 display:none；
        // 若它可见说明皮肤没有覆盖工具类，页面会退化 → 自动回退叠加模式
        await new Promise((r) => setTimeout(r, 300));
        const probe = document.createElement('div');
        probe.className = 'hidden';
        probe.style.position = 'absolute';
        document.body.appendChild(probe);
        const broken = getComputedStyle(probe).display !== 'none';
        probe.remove();
        if (broken) {
          setBuiltCssDisabled(false);
          removeStyle(STYLE_URL_ID);
          injectStyle(STYLE_URL_ID, finalCss);
          return { ok: true, warning: 'replace 皮肤不完整，已自动回退叠加模式' };
        }
      } else {
        injectStyle(STYLE_URL_ID, finalCss);
      }
    } catch (e) {
      setBuiltCssDisabled(false);
      return { ok: true, warning: `外链皮肤加载失败：${(e as Error).message}（已回退内置样式）` };
    }
  }

  return { ok: true };
}

/* ── 用户壁纸：独立于主题的全局装饰（切主题不丢）──
 * 元数据存 localStorage，data dataURL 拆 IDB（同草稿策略防配额爆）。
 * 优先级：用户壁纸 > 主题包自带壁纸。 */
const LS_USER_WP = 'bismuth_user_wallpaper';
const IDB_USER_WP = 'user:wallpaper';

/** 读取用户壁纸；data 类型从 IDB 还原 dataURL */
export async function getUserWallpaper(): Promise<Wallpaper | null> {
  try {
    const raw = localStorage.getItem(LS_USER_WP);
    if (!raw) return null;
    const wp = JSON.parse(raw) as Wallpaper;
    if (wp.type === 'data' && wp.value?.startsWith('idb:')) {
      const data = await getAsset<string>(wp.value.slice(4));
      if (!data) return null; // IDB 资产丢失：视为无壁纸，而非渲染坏引用
      wp.value = data;
    }
    return wp.type === 'none' || !wp.value ? null : wp;
  } catch {
    return null;
  }
}

/** 保存用户壁纸；传 null / type:none 清除 */
export async function setUserWallpaper(wp: Wallpaper | null): Promise<void> {
  try {
    if (!wp || wp.type === 'none' || !wp.value) {
      localStorage.removeItem(LS_USER_WP);
      await deleteAsset(IDB_USER_WP);
      return;
    }
    const slim: Wallpaper = { ...wp };
    if (slim.type === 'data' && slim.value) {
      await putAsset(IDB_USER_WP, slim.value);
      slim.value = `idb:${IDB_USER_WP}`;
    }
    localStorage.setItem(LS_USER_WP, JSON.stringify(slim));
  } catch (e) {
    console.warn('[theme] 用户壁纸保存失败:', e);
  }
}

/* ── 存储：激活主题 / 草稿 ── */

// 工坊草稿大资产的 IDB key：壁纸/Logo dataURL 动辄 1-3MB，localStorage 只有 ~5MB
// 全站配额，直塞会 QuotaExceeded 且被 try-catch 静默吞掉（刷新丢设置）——拆进 IDB。
const DRAFT_WP_KEY = 'draft:wallpaper';
const DRAFT_LOGO_KEY = 'draft:logo';

export function getActiveThemeId(): string | null {
  return localStorage.getItem(LS_ACTIVE);
}

export function setActiveThemeId(id: string | null): void {
  if (id === null) localStorage.removeItem(LS_ACTIVE);
  else localStorage.setItem(LS_ACTIVE, id);
}

export interface DraftTheme {
  id: string;
  name: string;
  author?: string;
  dark: boolean;
  vars: ThemeVars;
  wallpaper?: Wallpaper;
  brand?: { appName?: string; logo?: string };
  css?: string;
  cssUrl?: string;
  cssMode?: 'override' | 'replace';
  trustRemote?: boolean;
}

/** 草稿 → 可应用的主题包（启动恢复与实时预览共用） */
export function draftToPreviewPack(d: DraftTheme): ThemePack {
  return {
    format: THEME_FORMAT,
    id: 'custom-draft',
    name: d.name,
    dark: d.dark,
    vars: d.vars,
    wallpaper: d.wallpaper,
    brand: d.brand,
    css: d.css,
    cssUrl: d.cssUrl,
    cssMode: d.cssMode,
    trustRemote: d.trustRemote,
  };
}

/** 读取草稿；把 idb: 引用还原成 dataURL（异步：大资产在 IndexedDB） */
export async function getDraft(): Promise<DraftTheme | null> {
  try {
    const raw = localStorage.getItem(LS_DRAFT);
    if (!raw) return null;
    const d = JSON.parse(raw) as DraftTheme;
    if (d.wallpaper?.value?.startsWith('idb:')) {
      const data = await getAsset<string>(d.wallpaper.value.slice(4));
      d.wallpaper = data ? { ...d.wallpaper, type: 'data', value: data } : { type: 'none' };
    }
    if (d.brand?.logo?.startsWith('idb:')) {
      const data = await getAsset<string>(d.brand.logo.slice(4));
      d.brand = { ...d.brand, logo: data || undefined };
    }
    return d;
  } catch {
    return null;
  }
}

/** 保存草稿；壁纸/大 Logo 拆进 IDB，localStorage 只存瘦身引用（防 5MB 配额静默丢设置） */
export async function setDraft(d: DraftTheme | null): Promise<void> {
  try {
    if (d === null) {
      localStorage.removeItem(LS_DRAFT);
      await deleteAsset(DRAFT_WP_KEY);
      await deleteAsset(DRAFT_LOGO_KEY);
      return;
    }
    const slim: DraftTheme = { ...d };
    if (slim.wallpaper?.type === 'data' && slim.wallpaper.value) {
      await putAsset(DRAFT_WP_KEY, slim.wallpaper.value);
      slim.wallpaper = { ...slim.wallpaper, value: `idb:${DRAFT_WP_KEY}` };
    }
    if (slim.brand?.logo && slim.brand.logo.length > 2048) {
      await putAsset(DRAFT_LOGO_KEY, slim.brand.logo);
      slim.brand = { ...slim.brand, logo: `idb:${DRAFT_LOGO_KEY}` };
    }
    localStorage.setItem(LS_DRAFT, JSON.stringify(slim));
  } catch (e) {
    // IDB 降级内存 Map 时会话内仍可还原；仅 localStorage 本身异常才真丢
    console.warn('[theme] 草稿保存失败:', e);
  }
}

/** 保存主题包（导入或另存），大字段落 IDB */
export async function saveTheme(pack: ThemePack): Promise<void> {
  // 壁纸 dataURL 太大，拆进 IDB 资产库
  const stored: ThemePack = { ...pack };
  if (stored.wallpaper?.type === 'data' && stored.wallpaper.value) {
    await putAsset(`wallpaper:${stored.id}`, stored.wallpaper.value);
    stored.wallpaper = { ...stored.wallpaper, value: `idb:wallpaper:${stored.id}` };
  }
  if (stored.brand?.logo && stored.brand.logo.length > 2048) {
    await putAsset(`logo:${stored.id}`, stored.brand.logo);
    stored.brand = { ...stored.brand, logo: `idb:logo:${stored.id}` };
  }
  await putTheme(stored);
}

/** 读取主题（内置直取；导入的从 IDB，并把 idb: 引用还原成 dataURL） */
export async function loadTheme(id: string): Promise<ThemePack | null> {
  const builtin = BUILT_IN_THEMES.find((t) => t.id === id);
  if (builtin) return builtin;
  const stored = await getTheme<ThemePack>(id);
  if (!stored) return null;
  const pack: ThemePack = JSON.parse(JSON.stringify(stored));
  if (pack.wallpaper?.value?.startsWith('idb:wallpaper:')) {
    const data = await getAsset<string>(pack.wallpaper.value);
    pack.wallpaper = { ...pack.wallpaper, type: 'data', value: data || undefined };
  }
  if (pack.brand?.logo?.startsWith('idb:logo:')) {
    const data = await getAsset<string>(pack.brand.logo);
    pack.brand = { ...pack.brand, logo: data || undefined };
  }
  return pack;
}

export async function listUserThemes(): Promise<ThemePack[]> {
  const all = await listThemes<ThemePack>();
  return all.filter((t) => !t.builtin);
}

export async function removeUserTheme(id: string): Promise<void> {
  await idbDeleteTheme(id);
  await deleteAsset(`wallpaper:${id}`);
  await deleteAsset(`logo:${id}`);
  await deleteAsset(`css:${id}`);
}
