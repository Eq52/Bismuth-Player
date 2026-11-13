import { describe, it, expect, vi, afterEach } from 'vitest';
import { blockNextClick } from './usePlayerGestures';

// 极简事件目标桩：node 环境无 DOM，这里只关心监听的挂与摘
function createTarget() {
  const listeners: Array<{ type: string; fn: (ev: unknown) => void }> = [];
  const target = {
    addEventListener: (type: string, fn: (ev: unknown) => void) => {
      listeners.push({ type, fn });
    },
    removeEventListener: (type: string, fn: (ev: unknown) => void) => {
      const i = listeners.findIndex((l) => l.type === type && l.fn === fn);
      if (i >= 0) listeners.splice(i, 1);
    },
  };
  return { target, listeners };
}

function fakeEvent() {
  let prevented = false;
  let stopped = false;
  return {
    event: {
      preventDefault: () => { prevented = true; },
      stopPropagation: () => { stopped = true; },
    },
    get prevented() { return prevented; },
    get stopped() { return stopped; },
  };
}

describe('blockNextClick', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('挂载捕获阶段 click 监听', () => {
    const { target, listeners } = createTarget();
    const remove = blockNextClick(target);
    expect(listeners).toHaveLength(1);
    expect(listeners[0].type).toBe('click');
    remove();
    expect(listeners).toHaveLength(0);
  });

  it('被触发一次后自行摘除，并拦截事件', () => {
    const { target, listeners } = createTarget();
    blockNextClick(target);
    const ev = fakeEvent();
    listeners[0].fn(ev.event);
    expect(ev.prevented).toBe(true);
    expect(ev.stopped).toBe(true);
    expect(listeners).toHaveLength(0);
  });

  it('TTL 到点后即使没被触发也会摘除（防残留）', () => {
    vi.useFakeTimers();
    const { target, listeners } = createTarget();
    blockNextClick(target);
    expect(listeners).toHaveLength(1);
    vi.advanceTimersByTime(400);
    expect(listeners).toHaveLength(0);
  });

  it('主动摘除可重复调用且幂等', () => {
    const { target, listeners } = createTarget();
    const remove = blockNextClick(target);
    remove();
    remove();
    expect(listeners).toHaveLength(0);
  });

  it('并存的多个拦截器互不干扰（每轮手势各自摘除）', () => {
    const { target, listeners } = createTarget();
    const first = blockNextClick(target);
    const second = blockNextClick(target);
    expect(listeners).toHaveLength(2);
    first();
    expect(listeners).toHaveLength(1); // 只摘掉自己的那个
    second();
    expect(listeners).toHaveLength(0);
  });
});
