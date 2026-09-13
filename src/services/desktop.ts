// 桌面模式（Bismuth Desktop）支持
// =====================================
// 桌面壳 = JadeUI WebView 窗口 + 内置本地 CORS 代理（改自 PyCorsLocalProxy），
// 在本机 127.0.0.1 起服务并托管本前端。前端通过 /__desktop_info 探测桌面壳；
// Web 部署下该请求 404/失败 → 判定非桌面，行为与旧版完全一致。

export interface DesktopInfo {
  desktop: true;
  app: string;
  version: string;
  player: string;
}

// undefined = 尚未检测；null = 已检测且非桌面；其余 = 桌面壳信息
let desktopInfo: DesktopInfo | null | undefined;

// 探测桌面壳。App 启动时会先 await 本函数再放行页面，
// 保证后续所有 API 请求都能正确判断是否走内置代理。
export async function detectDesktopMode(): Promise<boolean> {
  if (desktopInfo !== undefined) return !!desktopInfo;
  try {
    const res = await fetch('/__desktop_info', {
      headers: { Accept: 'application/json' },
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.desktop === true) {
        desktopInfo = data as DesktopInfo;
        return true;
      }
    }
  } catch {
    // Web 部署：没有桌面壳
  }
  desktopInfo = null;
  return false;
}

// 是否运行在 Bismuth Desktop 桌面壳内（同步读取，需先完成 detectDesktopMode）
export function isDesktopMode(): boolean {
  return desktopInfo != null;
}

export function getDesktopInfo(): DesktopInfo | null {
  return desktopInfo ?? null;
}

// API 请求代理：同源编码式 /?url=<encodeURIComponent(目标)>
// 与「CORS代理设置」里配置的外部代理格式一致，桌面壳用 query 参数兼容解析。
export function desktopApiUrl(apiUrl: string): string {
  return `/?url=${encodeURIComponent(apiUrl)}`;
}

// 媒体地址代理：路径式 /<目标URL>
// m3u8 播放清单内的相对分片地址会以代理 URL 为基解析（/目标同路径/seg0.ts），
// 因此分片请求自动继续走内置代理；mp4 的 Range 请求也原样透传。
export function desktopMediaUrl(url: string): string {
  if (!url) return url;
  // 协议相对地址（//host/path）补全 https 后再走路径式代理
  if (url.startsWith('//')) return `/https:${url}`;
  if (/^https?:\/\//i.test(url)) return `/${url}`;
  // 已是相对/本地地址，保持不变
  return url;
}
