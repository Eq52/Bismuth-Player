import { describe, it, expect, beforeEach } from 'vitest';

// node 环境无 DOM：装一个最小 localStorage 桩，storage.ts 内部都是懒读取，所以静态 import 安全
function installLocalStorage() {
  const map = new Map<string, string>();
  const stub = {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => { map.clear(); },
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() { return map.size; },
  };
  (globalThis as unknown as { localStorage: typeof stub }).localStorage = stub;
  return map;
}

const STATS_KEY = 'bismuth_watch_stats';

async function load() {
  return import('./storage');
}

function seedStats(payload: Record<string, unknown>) {
  localStorage.setItem(STATS_KEY, JSON.stringify(payload));
}

describe('观看统计键（sourceId + vodId）', () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it('watchStatsKey 带上源，无源时退回裸 vodId', async () => {
    const { watchStatsKey } = await load();
    expect(watchStatsKey('srcA', 101)).toBe('srcA:101');
    expect(watchStatsKey('', 101)).toBe('101');
  });

  it('同一 vod_id 在两个源下分别累计，互不串数据', async () => {
    const { addWatchSeconds, getWatchStats } = await load();
    addWatchSeconds(30, 101, '同一部片', 'srcA');
    addWatchSeconds(12, 101, '同一部片', 'srcB');
    const s = getWatchStats();
    expect(s.perVideo['srcA:101'].seconds).toBe(30);
    expect(s.perVideo['srcB:101'].seconds).toBe(12);
    expect(s.totalSeconds).toBe(42);
  });

  it('把旧的裸 vodId 条目认领到新键：秒数保留且不产生重复行', async () => {
    seedStats({
      totalSeconds: 60, videoCount: 1, playCount: 1,
      daily: {}, perVideo: { '101': { name: '老数据片', seconds: 60 } },
      seenVodIds: ['101'], lastUpdated: 1,
    });
    const { addWatchSeconds, getWatchStats } = await load();
    addWatchSeconds(9, 101, '老数据片', 'srcA');
    const s = getWatchStats();
    expect(Object.keys(s.perVideo)).toEqual(['srcA:101']);
    expect(s.perVideo['srcA:101'].seconds).toBe(69);
    expect(s.perVideo['101']).toBeUndefined();
    expect(s.totalSeconds).toBe(69);
  });

  it('新键与旧裸键并存时保留两者，不做破坏性合并', async () => {
    seedStats({
      totalSeconds: 100, videoCount: 2, playCount: 2,
      daily: {}, perVideo: { '101': { name: '老', seconds: 40 }, 'srcA:101': { name: '新', seconds: 60 } },
      seenVodIds: ['101', 'srcA:101'], lastUpdated: 1,
    });
    const { addWatchSeconds, getWatchStats } = await load();
    addWatchSeconds(5, 101, '新', 'srcA');
    const s = getWatchStats();
    expect(s.perVideo['101'].seconds).toBe(40);
    expect(s.perVideo['srcA:101'].seconds).toBe(65);
  });

  it('recordPlay 认领旧数据时不再重复计入 videoCount', async () => {
    seedStats({
      totalSeconds: 60, videoCount: 1, playCount: 1,
      daily: {}, perVideo: { '101': { name: '老数据片', seconds: 60 } },
      seenVodIds: ['101'], lastUpdated: 1,
    });
    const { recordPlay, getWatchStats } = await load();
    recordPlay(101, 'srcA');
    let s = getWatchStats();
    expect(s.videoCount).toBe(1); // 旧条目认领为新键，不额外+1
    expect(s.seenVodIds).toEqual(['srcA:101']);
    expect(s.playCount).toBe(2);

    recordPlay(101, 'srcA'); // 同一个视频同一源再播一次
    s = getWatchStats();
    expect(s.videoCount).toBe(1);
    expect(s.playCount).toBe(3);
  });

  it('不同源的同名视频各自计入 videoCount', async () => {
    const { recordPlay, getWatchStats } = await load();
    recordPlay(101, 'srcA');
    recordPlay(101, 'srcB');
    const s = getWatchStats();
    expect(s.videoCount).toBe(2);
    expect(s.playCount).toBe(2);
  });

  it('无 sourceId 时仍写裸 vodId 键，兼容老调用', async () => {
    const { recordPlay, getWatchStats } = await load();
    recordPlay(101);
    const s = getWatchStats();
    expect(s.seenVodIds).toEqual(['101']);
    expect(s.videoCount).toBe(1);
  });
});
