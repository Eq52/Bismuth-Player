// 影视源导入 / 导出服务
// 导出：将当前全部影视源打包为 Bismuth JSON 文件下载
// 导入：本地文件 / 远程 https 链接 → 解析预览 → 合并（去重）或替换写入 localStorage

import type { VideoSource } from '@/types';
import { getSources, saveSources, setCurrentSource, fetchTextViaProxy } from './api';
import {
  generateSourceId,
  isSameUrl,
  parseSourceConfigText,
  type ParsedSource,
  type ParseResult,
} from './sourceParse';

// ========== 导出 ==========

export const EXPORT_FORMAT_VERSION = 1;

export interface ExportPayload {
  app: 'bismuth-player';
  type: 'video-sources';
  formatVersion: number;
  exportedAt: string;
  sources: VideoSource[];
}

/** 构建导出数据结构 */
export function buildExportPayload(sources: VideoSource[]): ExportPayload {
  return {
    app: 'bismuth-player',
    type: 'video-sources',
    formatVersion: EXPORT_FORMAT_VERSION,
    exportedAt: new Date().toISOString(),
    sources: sources.map((s) => ({ id: s.id, name: s.name, url: s.url })),
  };
}

/** 生成导出文件名：bismuth-sources-YYYYMMDD-HHmmss.json */
function buildExportFilename(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `bismuth-sources-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.json`;
}

/**
 * 将影视源列表导出为 JSON 文件并触发浏览器下载。
 * @returns 生成的文件名
 * @throws 列表为空时抛出错误
 */
export function exportSourcesToFile(sources: VideoSource[]): string {
  if (sources.length === 0) {
    throw new Error('暂无影视源可导出');
  }
  const payload = buildExportPayload(sources);
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const filename = buildExportFilename();
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return filename;
}

// ========== 导入 ==========

export type ImportMode = 'merge' | 'replace';

export interface ImportSummary {
  mode: ImportMode;
  /** 解析到的总条数 */
  total: number;
  /** 实际写入的条数（替换模式 = total；合并模式 = 去重后新增数） */
  added: number;
  /** 合并模式下因重复被跳过的条数 */
  skippedDuplicate: number;
}

/** 导入文件大小上限（5MB） */
export const MAX_IMPORT_FILE_SIZE = 5 * 1024 * 1024;

/**
 * 解析本地文件文本内容（自动比对现有源 ID 生成不冲突的新 ID）。
 */
export function parseSourceFileText(text: string): ParseResult {
  const existingIds = new Set(getSources().map((s) => s.id));
  return parseSourceConfigText(text, existingIds);
}

/**
 * 拉取远程影视源配置文本（https / http 链接）。
 * 走应用统一的 CORS 代理请求通道（自动重试 / 代理轮换）。
 */
export async function fetchRemoteConfigText(url: string): Promise<string> {
  const trimmed = url.trim();
  if (!/^https?:\/\//i.test(trimmed)) {
    throw new Error('请输入以 https:// 或 http:// 开头的影视源链接');
  }
  try {
    return await fetchTextViaProxy(trimmed);
  } catch {
    throw new Error('获取远程配置失败，请检查链接有效性或网络环境');
  }
}

/**
 * 将解析出的影视源写入本地存储。
 * - merge：按 URL 去重后追加，ID 冲突自动改名，保留现有配置
 * - replace：清空现有源后全量写入，并将当前源指向第一个
 */
export function applyImportedSources(parsed: ParsedSource[], mode: ImportMode): ImportSummary {
  if (parsed.length === 0) {
    throw new Error('没有可导入的影视源');
  }
  const existing = getSources();
  const takenIds = new Set(existing.map((s) => s.id));

  if (mode === 'replace') {
    const replaced: VideoSource[] = parsed.map((p) => {
      // 替换模式下 ID 仍需批内唯一
      const id = takenIds.has(p.id) ? generateSourceId(p.url, takenIds) : p.id;
      takenIds.add(id);
      return { id, name: p.name || '导入源', url: p.url };
    });
    saveSources(replaced);
    setCurrentSource(replaced[0]?.id || '');
    return { mode, total: parsed.length, added: replaced.length, skippedDuplicate: 0 };
  }

  // 合并模式：URL 归一化去重 + ID 冲突消解
  const norm = (s: string) => s.trim().replace(/\/+$/, '').toLowerCase();
  const existingUrls = new Set(existing.map((s) => norm(s.url)));
  const addedList: VideoSource[] = [];
  let skipped = 0;

  for (const p of parsed) {
    const key = norm(p.url);
    if (existingUrls.has(key) || addedList.some((a) => isSameUrl(a.url, p.url))) {
      skipped++;
      continue;
    }
    let id = p.id;
    if (takenIds.has(id)) {
      id = generateSourceId(p.url, takenIds);
    }
    takenIds.add(id);
    existingUrls.add(key);
    addedList.push({ id, name: p.name || '导入源', url: p.url });
  }

  if (addedList.length > 0) {
    saveSources([...existing, ...addedList]);
    // 原本没有任何源时，将首个导入源设为当前源
    if (existing.length === 0) {
      setCurrentSource(addedList[0].id);
    }
  }

  return { mode, total: parsed.length, added: addedList.length, skippedDuplicate: skipped };
}
