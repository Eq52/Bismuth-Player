// 移动端播放器手势：左半屏垂直滑调亮度、右半屏垂直滑调音量、横向滑拖动进度。
// 浏览器无法直接调系统亮度，用 CSS filter: brightness 模拟（常见做法）。
// 仅在单指触摸视频画面时生效，不拦截底部控件；手势实际发生后吞掉合成 click，避免误触播放/暂停。

import { useEffect, useRef, useState } from 'react';

export interface GestureState {
  type: 'seek' | 'volume' | 'brightness' | null;
  /** seek 时：起始时间与目标时间（秒） */
  baseTime: number;
  targetTime: number;
  /** volume / brightness 时：0~1 的当前值 */
  value: number;
}

const IDLE: GestureState = { type: null, baseTime: 0, targetTime: 0, value: 0 };
const MOVE_THRESHOLD = 10; // 超过该位移才判定为手势，避免轻点误触
const CLICK_BLOCK_TTL = 400; // 拦截合成 click 的监听器最长存活时间（兜底，防残留）

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function getBrightness(v: HTMLVideoElement): number {
  const m = v.style.filter.match(/brightness\(([\d.]+)\)/);
  return m ? parseFloat(m[1]) : 1;
}

// 只需这两个方法即可挂摘监听，便于在无 DOM 环境下测试
type ClickTarget = Pick<HTMLElement, 'addEventListener' | 'removeEventListener'>;

/**
 * 手势结束后在容器捕获阶段吞掉一次浏览器合成的 click，避免误触播放/暂停/全屏。
 * 三重兜底移除，避免监听器残留（残留会导致后续真实点击被吃掉）：
 *   ① 被触发一次即摘除；② 注册时同时起一个 TTL 定时器兜底摘除；③ 返回函数供调用方（组件卸载）主动摘除。
 * @returns 主动摘除函数，重复调用安全
 */
export function blockNextClick(container: ClickTarget): () => void {
  const state: { removed: boolean; timer?: ReturnType<typeof setTimeout> } = { removed: false };

  const handler = (ev: Event) => {
    ev.preventDefault();
    ev.stopPropagation();
    remove();
  };
  const remove = () => {
    if (state.removed) return;
    state.removed = true;
    container.removeEventListener('click', handler, true);
    if (state.timer !== undefined) clearTimeout(state.timer);
  };

  container.addEventListener('click', handler, true);
  state.timer = setTimeout(remove, CLICK_BLOCK_TTL);
  return remove;
}

export function usePlayerGestures(
  videoRef: React.RefObject<HTMLVideoElement | null>,
  containerRef: React.RefObject<HTMLDivElement | null>,
): GestureState {
  const [gesture, setGesture] = useState<GestureState>(IDLE);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const decidedRef = useRef<'h' | 'v' | null>(null);
  const baseRef = useRef({ volume: 1, brightness: 1, time: 0 });
  const sideRef = useRef<'left' | 'right'>('left');
  // 当前挂着的 click 拦截器（用于 touchstart / cleanup 主动摘除）
  const unblockRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const onTouchStart = (e: TouchEvent) => {
      // 新一轮触摸开始：先摘掉上一轮可能残留的 click 拦截器，避免吃掉用户真实点击
      unblockRef.current?.();
      unblockRef.current = null;
      if (e.touches.length !== 1) return;
      // 只在直接触摸视频画面时启用，让底部按钮/进度条走自己的触摸逻辑
      if (!(e.target instanceof HTMLVideoElement)) return;
      const t = e.touches[0];
      const rect = container.getBoundingClientRect();
      startRef.current = { x: t.clientX, y: t.clientY };
      decidedRef.current = null;
      const v = videoRef.current;
      if (v) {
        baseRef.current = { volume: v.volume, brightness: getBrightness(v), time: v.currentTime };
      }
      sideRef.current = t.clientX - rect.left < rect.width / 2 ? 'left' : 'right';
    };

    const onTouchMove = (e: TouchEvent) => {
      const start = startRef.current;
      const v = videoRef.current;
      if (!start || !v || e.touches.length !== 1) return;
      const t = e.touches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      const rect = container.getBoundingClientRect();

      if (!decidedRef.current) {
        if (Math.abs(dx) < MOVE_THRESHOLD && Math.abs(dy) < MOVE_THRESHOLD) return;
        decidedRef.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
      }
      e.preventDefault(); // 阻止页面滚动与系统手势

      if (decidedRef.current === 'h') {
        // 横向：整宽位移对应全部时长，起点为手势开始时的播放位置
        const target = clamp(
          baseRef.current.time + (dx / rect.width) * (v.duration || 0),
          0,
          v.duration || 0,
        );
        v.currentTime = target;
        setGesture({ type: 'seek', baseTime: baseRef.current.time, targetTime: target, value: 0 });
      } else {
        // 垂直：上滑增加、下滑减少
        const delta = -dy / rect.height;
        if (sideRef.current === 'right') {
          const vol = clamp(baseRef.current.volume + delta, 0, 1);
          v.volume = vol;
          v.muted = vol === 0;
          setGesture({ type: 'volume', baseTime: 0, targetTime: 0, value: vol });
        } else {
          const br = clamp(baseRef.current.brightness + delta, 0.2, 1.5);
          v.style.filter = `brightness(${br})`;
          setGesture({ type: 'brightness', baseTime: 0, targetTime: 0, value: br });
        }
      }
    };

    const onTouchEnd = () => {
      const did = decidedRef.current;
      startRef.current = null;
      decidedRef.current = null;
      setGesture(IDLE);
      // 手势真正发生过：在捕获阶段拦截浏览器随后合成的 click，避免误触播放/暂停/全屏。
      // 拦截器自带 TTL 兜底自动摘除；touchstart / cleanup 也会各主动摘一次。
      if (did) {
        unblockRef.current?.();
        unblockRef.current = blockNextClick(container);
      }
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: false });
    container.addEventListener('touchend', onTouchEnd);
    container.addEventListener('touchcancel', onTouchEnd);
    return () => {
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      container.removeEventListener('touchcancel', onTouchEnd);
      // 卸载时把残留的 click 拦截器也摘掉
      unblockRef.current?.();
      unblockRef.current = null;
    };
  }, [videoRef, containerRef]);

  return gesture;
}
