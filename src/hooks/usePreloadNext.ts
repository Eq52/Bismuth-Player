// 预加载下一集：提前建立连接并缓冲下一集的开头数据，让手动/自动切集时起播更快。
// 做法（尽力而为、流量友好）：
//   1) 向下一集源站注入 preconnect，提前完成 DNS/TLS；
//   2) 用一个隐藏 video 以 preload="metadata" 预取清单/头部（不下载整段，不自动播放）。
// 对 HLS 流隐藏 video 只会加载清单，真正的分片仍由切集后的 hls.js 拉取——属预期。

import { useEffect } from 'react';

export function usePreloadNext(nextUrl: string | undefined): void {
  useEffect(() => {
    if (!nextUrl) return;

    // 1) preconnect
    let link: HTMLLinkElement | null = null;
    try {
      link = document.createElement('link');
      link.rel = 'preconnect';
      link.href = new URL(nextUrl).origin;
      link.crossOrigin = '';
      document.head.appendChild(link);
    } catch {
      link = null;
    }

    // 2) 隐藏 video 预加载 metadata
    const pre = document.createElement('video');
    pre.preload = 'metadata';
    pre.muted = true;
    pre.setAttribute('muted', '');
    pre.style.cssText = 'position:absolute;width:1px;height:1px;opacity:0;pointer-events:none;';
    pre.src = nextUrl;
    document.body.appendChild(pre);

    return () => {
      if (link) link.remove();
      pre.removeAttribute('src');
      pre.load();
      pre.remove();
    };
  }, [nextUrl]);
}
