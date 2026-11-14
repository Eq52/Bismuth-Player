import { describe, it, expect, beforeEach } from 'vitest';

// node 环境无 DOM：装最小 localStorage 桩（参考 watchStats.test.ts）
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

const SOURCES_KEY = 'bismuth_video_sources';
const CURRENT_SOURCE_KEY = 'bismuth_current_source_id';
const HISTORY_KEY = 'bismuth_history';
const FAVORITES_KEY = 'bismuth_favorites';
const WATCH_STATS_KEY = 'bismuth_watch_stats';
const SNAPSHOT_KEY = 'bismuth_backup_snapshot';

async function load() {
  return import('./backup');
}

function seed() {
  localStorage.setItem(SOURCES_KEY, JSON.stringify([
    { id: 's1', name: '源一', url: 'https://a.example/api.php' },
    { id: 's2', name: '源二', url: 'https://b.example/api.php' },
  ]));
  localStorage.setItem(CURRENT_SOURCE_KEY, 's1');
  localStorage.setItem(HISTORY_KEY, JSON.stringify([
    { vod_id: 100, vod_name: '影片 A', vod_pic: '', episode: 1, episodeName: '第1集', progress: 12, timestamp: 1, sourceId: 's1' },
  ]));
  localStorage.setItem(FAVORITES_KEY, JSON.stringify([
    { vod_id: 200, vod_name: '收藏 B', vod_pic: '', timestamp: 2, sourceId: 's2' },
  ]));  localStorage.setItem(WATCH_STATS_KEY, JSON.stringify({
    totalSeconds: 66, videoCount: 2, playCount: 3, daily: {},
    perVideo: { 's1:100': { name: '影片 A', seconds: 66 } }, seenVodIds: ['s1:100'], lastUpdated: 3,
  }));
}

describe('全量备份 / 恢复', () => {
  beforeEach(() => {
    installLocalStorage();
  });

  it('备份往返：域数据完整还原，且写入导入前快照', async () => {
    const backup = await load();
    seed();

    const payload = await backup.createBackup('9.8.3');
    const parsed = backup.parseBackupText(JSON.stringify(payload));
    expect(backup.summarize(parsed)).toMatchObject({
      sources: 2, history: 1, favorites: 1, watchVideos: 1, proxies: expect.any(Number),
    });
    expect(await backup.verifyPayload(parsed)).toBe(true);

    // 模拟本地数据被清空
    localStorage.removeItem(SOURCES_KEY);
    localStorage.removeItem(HISTORY_KEY);
    localStorage.removeItem(FAVORITES_KEY);

    const result = await backup.restoreBackup(parsed);
    expect(result.ok).toBe(true);
    expect(localStorage.getItem(SOURCES_KEY)).toContain('源一');
    expect(localStorage.getItem(HISTORY_KEY)).toContain('影片 A');
    expect(localStorage.getItem(FAVORITES_KEY)).toContain('收藏 B');
    expect(localStorage.getItem(SNAPSHOT_KEY)).not.toBeNull();
  });

  it('截断 / 非 JSON 文件被拒绝，原有数据不变', async () => {
    const backup = await load();
    seed();
    const historyBefore = localStorage.getItem(HISTORY_KEY);

    expect(() => backup.parseBackupText('{ "data": broken')).toThrow(/JSON|结构/);
    expect(() => backup.parseBackupText('not a backup at all')).toThrow();
    expect(localStorage.getItem(HISTORY_KEY)).toBe(historyBefore);
  });

  it('校验和不一致（损坏 / 篡改）拒绝恢复，原数据保留', async () => {
    const backup = await load();
    seed();
    const payload = await backup.createBackup('9.8.3');
    const tampered = backup.parseBackupText(JSON.stringify(payload));
    tampered.data.favorites = [{ vod_id: 999, vod_name: '改', vod_pic: '', timestamp: 1, sourceId: 's1' }];

    expect(await backup.verifyPayload(tampered)).toBe(false);
    await expect(backup.restoreBackup(tampered)).rejects.toThrow(/校验和/);
    expect(localStorage.getItem(FAVORITES_KEY)).toContain('收藏 B');
  });

  it('schema 版本高于当前应用时拒绝恢复', async () => {
    const backup = await load();
    const payload = await backup.createBackup('9.8.3');
    const future = { ...payload, schemaVersion: 999 };
    expect(() => backup.parseBackupText(JSON.stringify(future))).toThrow(/结构版本/);
  });
});
