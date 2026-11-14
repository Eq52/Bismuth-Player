/**
 * backup — 全量备份 / 恢复（第一期：localStorage 域，不含 IDB 主题资产与壁纸位图）
 *
 * 备份域：影视源 / 当前源 / 播放器设置 / 缓存设置 / CORS 代理列表与开关 /
 *          历史条数上限 / 播放历史 / 收藏 / 观看统计。
 * 不纳入：缓存正文、免责声明同意态（恢复后重新确认一次即可）、IDB 内的主题包与壁纸。
 *
 * 恢复流程：头校验（应用标识 / 格式版本 / schema 版本）→ 校验和核对 →
 *          导入前快照（保留最近一份，可回滚）→ 分域写入，单域失败只回滚该域。
 */

import { getSources, saveSources, getCurrentSource, setCurrentSource } from './api';
import {
  HISTORY_KEY, FAVORITES_KEY, WATCH_STATS_KEY,
  getPlayerSettings, savePlayerSettings, getCacheSettings, saveCacheSettings,
  getCorsProxyList, setCorsProxyList, isCorsProxyEnabled, setCorsProxyEnabled,
  getHistoryLimit, setHistoryLimit, getPlayHistory, getFavorites, getWatchStats,
} from './storage';
import { CURRENT_SCHEMA_VERSION } from './migrate';
import { notifyStorageChange } from './store';
import type {
  PlayHistory, PlayerSettings, CacheSettings, FavoriteItem, WatchStats, VideoSource,
} from '@/types';

const BACKUP_APP = 'bismuth-player';
const BACKUP_TYPE = 'full-backup';
export const BACKUP_FORMAT_VERSION = 1;
const SNAPSHOT_KEY = 'bismuth_backup_snapshot';
export const MAX_BACKUP_BYTES = 10 * 1024 * 1024; // 10MB

/* ── 类型 ── */

export interface BackupData {
  sources: VideoSource[];
  currentSourceId: string | null;
  playerSettings: PlayerSettings;
  cacheSettings: CacheSettings;
  corsProxies: string[];
  corsProxyEnabled: boolean;
  historyLimit: number;
  history: PlayHistory[];
  favorites: FavoriteItem[];
  watchStats: WatchStats;
}

export interface BackupChecksum {
  algorithm: 'sha256' | 'fnv1a';
  value: string;
}

export interface BackupPayload {
  app: typeof BACKUP_APP;
  type: typeof BACKUP_TYPE;
  backupVersion: number;
  appVersion: string;
  schemaVersion: number;
  exportedAt: string;
  checksum: BackupChecksum;
  data: BackupData;
}

export interface BackupSummary {
  sources: number;
  history: number;
  favorites: number;
  watchVideos: number;
  proxies: number;
  exportedAt: string;
  appVersion: string;
  backupVersion: number;
  schemaVersion: number;
}

export interface RestoreResult {
  ok: boolean;
  restored: string[];
  rolledBack: string[];
  errors: string[];
  snapshotAt: string | null;
  summary: BackupSummary;
}

/* ── 校验和 ── */

// FNV-1a 32 位：WebView 无 crypto.subtle 时的降级算法（文件内标明算法，恢复时按对应算法核对）
function fnv1aHex(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

async function computeChecksum(text: string): Promise<BackupChecksum> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle?.digest) {
    const buf = await subtle.digest('SHA-256', new TextEncoder().encode(text));
    const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return { algorithm: 'sha256', value: hex };
  }
  return { algorithm: 'fnv1a', value: fnv1aHex(text) };
}

function verifyChecksum(payload: BackupPayload): boolean {
  const text = JSON.stringify(payload.data);
  const expected = payload.checksum.value;
  if (payload.checksum.algorithm === 'sha256') {
    // sha256 只能异步算；同步核对路径用占位，恢复前走 async verifyPayload
    return false;
  }
  return fnv1aHex(text) === expected;
}

async function verifyChecksumAsync(payload: BackupPayload): Promise<boolean> {
  if (payload.checksum.algorithm === 'sha256') {
    const subtle = globalThis.crypto?.subtle;
    if (!subtle?.digest) return false;
    const buf = await subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload.data)));
    const hex = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
    return hex === payload.checksum.value;
  }
  return verifyChecksum(payload);
}

/* ── 域读写 ── */

function readData(): BackupData {
  const current = getCurrentSource();
  return {
    sources: getSources(),
    currentSourceId: current?.id ?? null,
    playerSettings: getPlayerSettings(),
    cacheSettings: getCacheSettings(),
    corsProxies: getCorsProxyList(),
    corsProxyEnabled: isCorsProxyEnabled(),
    historyLimit: getHistoryLimit(),
    history: getPlayHistory(),
    favorites: getFavorites(),
    watchStats: getWatchStats(),
  };
}

function writeSources(data: BackupData): void {
  saveSources(data.sources);
  if (data.currentSourceId && data.sources.some((s) => s.id === data.currentSourceId)) {
    setCurrentSource(data.currentSourceId);
  }
}

function writePlayer(data: BackupData): void { savePlayerSettings(data.playerSettings); }
function writeCache(data: BackupData): void { saveCacheSettings(data.cacheSettings); }
function writeCors(data: BackupData): void {
  setCorsProxyList(data.corsProxies);
  setCorsProxyEnabled(data.corsProxyEnabled);
}
function writeLimit(data: BackupData): void { setHistoryLimit(data.historyLimit); }

function writeHistory(data: BackupData): void {
  if (data.history.length > 0) localStorage.setItem(HISTORY_KEY, JSON.stringify(data.history));
  else localStorage.removeItem(HISTORY_KEY);
}

function writeFavorites(data: BackupData): void {
  if (data.favorites.length > 0) localStorage.setItem(FAVORITES_KEY, JSON.stringify(data.favorites));
  else localStorage.removeItem(FAVORITES_KEY);
}

function writeWatchStats(data: BackupData): void {
  localStorage.setItem(WATCH_STATS_KEY, JSON.stringify(data.watchStats));
}

const DOMAIN_WRITERS: Record<string, (data: BackupData) => void> = {
  sources: writeSources,
  player: writePlayer,
  cache: writeCache,
  cors: writeCors,
  historyLimit: writeLimit,
  history: writeHistory,
  favorites: writeFavorites,
  watchStats: writeWatchStats,
};

/* ── 快照（导入前保留最近一份，失败可整包回滚） ── */

export function captureSnapshot(): BackupData | null {
  try {
    const data = readData();
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({ at: Date.now(), data }));
    return data;
  } catch (e) {
    console.warn('[backup] 导入前快照失败:', e);
    return null;
  }
}

export function getSnapshot(): { at: number; data: BackupData } | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { at: number; data: BackupData };
    return parsed && parsed.data ? parsed : null;
  } catch {
    return null;
  }
}

export function clearSnapshot(): void {
  localStorage.removeItem(SNAPSHOT_KEY);
}

/* ── 导出 ── */

export async function createBackup(appVersion = 'unknown'): Promise<BackupPayload> {
  const data = readData();
  const checksum = await computeChecksum(JSON.stringify(data));
  return {
    app: BACKUP_APP,
    type: BACKUP_TYPE,
    backupVersion: BACKUP_FORMAT_VERSION,
    appVersion,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    checksum,
    data,
  };
}

/** 生成导出文件名：bismuth-backup-YYYYMMDD-HHmmss.json */
function buildBackupFilename(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `bismuth-backup-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.json`;
}

/**
 * 将备份包写入 JSON 文件并触发浏览器下载（与影视源导出同一套锚点下载方式）。
 * @returns 生成的文件名
 */
export function writeBackupToFile(payload: BackupPayload): string {
  const filename = buildBackupFilename();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}

/* ── 解析与校验 ── */

function asArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}

export function parseBackupText(text: string): BackupPayload {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new Error('文件不是有效的 JSON');
  }
  if (!raw || typeof raw !== 'object') throw new Error('备份文件结构不正确');
  const o = raw as Record<string, unknown>;

  if (o['app'] !== BACKUP_APP) throw new Error('这不是 Bismuth 备份文件');
  if (o['type'] !== BACKUP_TYPE) throw new Error('备份类型不匹配');

  const backupVersion = Number(o['backupVersion']);
  if (!Number.isInteger(backupVersion) || backupVersion > BACKUP_FORMAT_VERSION) {
    throw new Error('备份来自更新的应用版本，请升级后再恢复');
  }
  if (backupVersion < BACKUP_FORMAT_VERSION) {
    throw new Error('备份格式版本过旧，已不再支持直接恢复');
  }

  const schemaVersion = Number(o['schemaVersion']);
  if (!Number.isInteger(schemaVersion) || schemaVersion > CURRENT_SCHEMA_VERSION) {
    throw new Error('备份的数据结构版本高于当前版本，请升级应用后再恢复');
  }

  const data = o['data'] as Record<string, unknown> | undefined;
  if (!data || typeof data !== 'object') throw new Error('备份缺少 data 段');

  const checksum = o['checksum'] as BackupChecksum | undefined;
  if (!checksum || (checksum.algorithm !== 'sha256' && checksum.algorithm !== 'fnv1a') || !checksum.value) {
    throw new Error('备份缺少校验和，可能已损坏');
  }

  const payload: BackupPayload = {
    app: BACKUP_APP,
    type: BACKUP_TYPE,
    backupVersion,
    appVersion: typeof o['appVersion'] === 'string' ? o['appVersion'] : 'unknown',
    schemaVersion,
    exportedAt: typeof o['exportedAt'] === 'string' ? o['exportedAt'] : new Date().toISOString(),
    checksum,
    data: {
      sources: asArray<VideoSource>(data['sources']),
      currentSourceId: typeof data['currentSourceId'] === 'string' ? data['currentSourceId'] : null,
      playerSettings: (data['playerSettings'] as PlayerSettings) ?? getPlayerSettings(),
      cacheSettings: (data['cacheSettings'] as CacheSettings) ?? getCacheSettings(),
      corsProxies: asArray<string>(data['corsProxies']),
      corsProxyEnabled: data['corsProxyEnabled'] !== false,
      historyLimit: Number.isInteger(data['historyLimit']) ? Number(data['historyLimit']) : getHistoryLimit(),
      history: asArray<PlayHistory>(data['history']),
      favorites: asArray<FavoriteItem>(data['favorites']),
      watchStats: (data['watchStats'] as WatchStats) ?? getWatchStats(),
    },
  };
  return payload;
}

/** 异步核对校验和（损坏 / 被篡改的包拒绝恢复） */
export async function verifyPayload(payload: BackupPayload): Promise<boolean> {
  return verifyChecksumAsync(payload);
}

export function summarize(payload: BackupPayload): BackupSummary {
  return {
    sources: payload.data.sources.length,
    history: payload.data.history.length,
    favorites: payload.data.favorites.length,
    watchVideos: Object.keys(payload.data.watchStats.perVideo || {}).length,
    proxies: payload.data.corsProxies.length,
    exportedAt: payload.exportedAt,
    appVersion: payload.appVersion,
    backupVersion: payload.backupVersion,
    schemaVersion: payload.schemaVersion,
  };
}

/* ── 恢复 ── */

export async function restoreBackup(payload: BackupPayload): Promise<RestoreResult> {
  const summary = summarize(payload);
  const restored: string[] = [];
  const rolledBack: string[] = [];
  const errors: string[] = [];

  const intact = await verifyPayload(payload);
  if (!intact) {
    throw new Error('校验和不一致，备份可能已损坏或被修改，已拒绝恢复');
  }

  const snapshot = captureSnapshot();
  const snapRecord = getSnapshot();
  const snapshotAt = snapRecord ? new Date(snapRecord.at).toISOString() : null;

  for (const [domain, write] of Object.entries(DOMAIN_WRITERS)) {
    try {
      write(payload.data);
      restored.push(domain);
    } catch (e) {
      errors.push(`${domain}: ${(e as Error).message}`);
      // 单域失败：用快照回滚该域，其余域保持已写入状态
      if (snapshot) {
        try {
          DOMAIN_WRITERS[domain](snapshot);
          rolledBack.push(domain);
        } catch (rb) {
          errors.push(`${domain} 回滚失败: ${(rb as Error).message}`);
        }
      }
    }
  }

  notifyStorageChange();
  return { ok: errors.length === 0, restored, rolledBack, errors, snapshotAt, summary };
}
