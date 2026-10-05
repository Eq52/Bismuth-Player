// 影视源配置解析器（纯函数，无运行时依赖）
// 支持解析第三方影视源文件：
// 1. Bismuth 导出文件（{ app, sources: [...] }）
// 2. 第三方聚合配置（{ sites: [{ key, name, api, type }] }）
// 3. 通用 JSON（数组或 { sources / sites / data / list / items } 包裹，字段名别名自动映射）
// 4. 纯文本链接列表（每行一个 https:// 链接，支持「名称,链接」「名称|链接」等混排格式）

import type { VideoSource } from '@/types';

// ========== 类型 ==========

/** 解析出的单个影视源（预览态） */
export interface ParsedSource {
  id: string;
  name: string;
  url: string;
  /** 与现有源重复（相同 ID 或相同 URL），导入合并模式时将被跳过 */
  duplicate?: boolean;
}

export interface ParseResult {
  sources: ParsedSource[];
  /** 识别到的配置格式标识 */
  format: string;
  /** 解析过程中被忽略的无效/重复条目数 */
  invalidCount: number;
}

/** 应用自身管理的查询参数（导入时从第三方源 URL 上剥离，避免拼接冲突） */
const MANAGED_PARAMS = ['ac', 'pg', 'wd', 'ids', 'limit', 't'];

// ========== URL 工具 ==========

/** 是否为合法的 http(s) 链接（https 为主，兼容 http） */
export function isValidHttpUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

/** 剥离应用管理的查询参数，保留 token 等第三方自有参数 */
export function stripManagedParams(raw: string): string {
  try {
    const u = new URL(raw);
    MANAGED_PARAMS.forEach((p) => u.searchParams.delete(p));
    return u.toString();
  } catch {
    return raw;
  }
}

/** 规范化源 URL：去除首尾引号/空白，校验协议，剥离受管参数；非法返回 null */
export function normalizeSourceUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim().replace(/["'<[]+/, '').replace(/["'>\],]+$/, '');
  if (!trimmed || !isValidHttpUrl(trimmed)) return null;
  return stripManagedParams(trimmed);
}

/** 宽松比较两个源 URL 是否相同（去尾部斜杠 + 忽略大小写） */
export function isSameUrl(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().replace(/\/+$/, '').toLowerCase();
  return norm(a) === norm(b);
}

/** 从 URL 推导展示名称（去 www./api. 等常见前缀的主机名） */
export function deriveNameFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname;
    return host.replace(/^(www|api|caiji|cj|vip|v)\./i, '') || host;
  } catch {
    return '导入源';
  }
}

// ========== 字段映射 ==========

const URL_KEYS = ['url', 'api', 'site', 'siteUrl', 'site_url', 'apiUrl', 'api_url', 'link', 'href', 'source', 'src'];
const NAME_KEYS = ['name', 'title', 'label', 'siteName', 'site_name', 'remark', 'remarks', 'desc', 'nickname'];
const ID_KEYS = ['id', 'key', 'code', 'siteKey', 'site_key', 'slug', 'uuid'];

/** 依次取对象中第一个非空字段（string/number 均转字符串） */
function pickString(obj: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (typeof v === 'number' && Number.isFinite(v)) return String(v);
  }
  return '';
}

/** djb2 哈希（base36），用于从 URL 生成确定性短 ID */
function hash36(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) >>> 0;
  }
  return h.toString(36);
}

/** 基于 URL 生成唯一且确定性的源 ID：主机名-哈希，冲突时追加序号 */
export function generateSourceId(url: string, taken: Set<string>): string {
  let base = 'source';
  try {
    base = new URL(url).hostname.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'source';
  } catch {
    /* 保留默认前缀 */
  }
  if (base.length > 40) base = base.slice(0, 40);
  const digest = hash36(url);
  let candidate = `${base}-${digest}`;
  let n = 2;
  while (taken.has(candidate)) {
    candidate = `${base}-${digest}-${n++}`;
  }
  return candidate;
}

/**
 * 将任意第三方源对象规范化为 ParsedSource。
 * source 为 null 表示不可导入：incompatible=true 表示因类型不兼容被跳过（如 type 3/4 的 jar 爬虫源），
 * 否则为 URL 缺失/非法等原因。
 */
function normalizeSourceObject(obj: Record<string, unknown>, taken: Set<string>): { source: ParsedSource | null; incompatible?: boolean } {
  if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { source: null };
  // type 0=苹果CMS JSON、1=XML；其余（3/4 爬虫、jar 扩展）本应用不支持。
  // 类型检查先于 URL 校验——爬虫源的 api 是 csp_XXX 标识而非 http 链接，需先按类型判定不兼容
  const type = (obj as { type?: unknown }).type;
  if (typeof type === 'number' && type !== 0 && type !== 1) return { source: null, incompatible: true };
  const url = normalizeSourceUrl(pickString(obj, URL_KEYS));
  if (!url) return { source: null };

  const name = (pickString(obj, NAME_KEYS) || deriveNameFromUrl(url)).slice(0, 50);
  const pickedId = pickString(obj, ID_KEYS);
  const id =
    pickedId && /^\S{1,64}$/.test(pickedId) && !taken.has(pickedId)
      ? pickedId
      : generateSourceId(url, taken);
  taken.add(id);
  return { source: { id, name, url } };
}

/** 从 JSON 数据中收集候选源对象（支持数组与常见包裹键） */
function collectCandidateObjects(data: unknown): { items: Record<string, unknown>[]; format: string } {
  const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

  if (Array.isArray(data)) {
    // 字符串数组视作纯链接列表
    const items = data.map((x) => (typeof x === 'string' ? { url: x } : x)).filter(isObj);
    return { items, format: 'JSON 列表' };
  }

  if (isObj(data)) {
    if (typeof data.app === 'string' && data.app.toLowerCase().includes('bismuth')) {
      const arr = Array.isArray(data.sources) ? data.sources : [];
      return { items: arr.map((x) => (typeof x === 'string' ? { url: x } : x)).filter(isObj), format: 'Bismuth 导出' };
    }
    for (const key of ['sources', 'sites', 'data', 'list', 'items', 'configs']) {
      const v = data[key];
      if (Array.isArray(v)) {
        const format = key === 'sites' ? 'TVBox 配置' : 'JSON';
        return { items: v.map((x) => (typeof x === 'string' ? { url: x } : x)).filter(isObj), format };
      }
    }
    // 单个源对象
    if (pickString(data, URL_KEYS)) return { items: [data], format: 'JSON' };
  }

  return { items: [], format: 'JSON' };
}

// ========== 解析入口 ==========

/** 行内 URL 提取（排除空白、引号、竖线、逗号等分隔符） */
const URL_IN_LINE_RE = /https?:\/\/[^\s"'<>|，]+/g;

/** 批内去重 + ID 冲突消解 */
function dedupeBatch(sources: ParsedSource[]): { unique: ParsedSource[]; dropped: number } {
  const seen = new Set<string>();
  const unique: ParsedSource[] = [];
  let dropped = 0;
  for (const s of sources) {
    const key = s.url.trim().replace(/\/+$/, '').toLowerCase();
    if (seen.has(key)) {
      dropped++;
      continue;
    }
    seen.add(key);
    unique.push(s);
  }
  return { unique, dropped };
}

/**
 * 解析影视源配置文本（文件内容或远程响应）。
 * existingIds：现有源 ID 集合，用于生成不冲突的新 ID（只影响 ID 生成，不做重复标记）。
 */
export function parseSourceConfigText(text: string, existingIds: Set<string> = new Set()): ParseResult {
  const cleaned = text.replace(/^\uFEFF/, '').trim();
  if (!cleaned) return { sources: [], format: '未知', invalidCount: 0 };

  const taken = new Set(existingIds);
  const sources: ParsedSource[] = [];
  let format = '';
  let invalidCount = 0;
  // JSON 解析识别出的候选条目数与其中因类型不兼容（如爬虫源）被跳过的数量
  let jsonCandidateCount = 0;
  let incompatibleCount = 0;

  // ---- 尝试 JSON 解析 ----
  if (cleaned.startsWith('{') || cleaned.startsWith('[')) {
    try {
      const data = JSON.parse(cleaned);
      const { items, format: fmt } = collectCandidateObjects(data);
      format = fmt;
      jsonCandidateCount = items.length;
      for (const item of items) {
        const r = normalizeSourceObject(item, taken);
        if (r.source) {
          sources.push(r.source);
        } else {
          invalidCount++;
          if (r.incompatible) incompatibleCount++;
        }
      }
    } catch {
      // JSON 解析失败（如 JSON Lines / 混排文本），落入下方逐行文本解析
    }
  }

  // JSON 已识别出候选条目但全部因类型不兼容被过滤时（如全部为爬虫源的第三方配置），
  // 保留结构化格式结论并明确提示，不回退逐行文本解析——
  // 否则会把配置里的直播源 / EPG / 网盘等无关 URL 误报为影视源
  if (sources.length === 0 && jsonCandidateCount > 0 && incompatibleCount === jsonCandidateCount) {
    format += '（爬虫源不兼容）';
  }

  // ---- 逐行文本解析（仅当 JSON 未识别出任何候选条目时才回退） ----
  if (sources.length === 0 && jsonCandidateCount === 0) {
    format = '文本链接';
    for (const rawLine of cleaned.split(/\r?\n/)) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith('//')) continue;

      // 逐行 JSON（JSON Lines）
      if (line.startsWith('{') || line.startsWith('[')) {
        try {
          const { items } = collectCandidateObjects(JSON.parse(line));
          let added = 0;
          for (const item of items) {
            const r = normalizeSourceObject(item, taken);
            if (r.source) {
              sources.push(r.source);
              added++;
            }
          }
          if (added > 0) continue;
          invalidCount++;
          continue;
        } catch {
          /* 非法 JSON 行，按普通文本处理 */
        }
      }

      // 普通「名称 + 链接」混排行
      const match = line.match(URL_IN_LINE_RE);
      if (!match) {
        // 含协议样式的行但未识别出合法 http(s) 链接，计为无效（如拼写错误的协议 htttp://）
        if (/:\/\//.test(line)) invalidCount++;
        continue; // 其余无链接的说明性文字，忽略不计数
      }
      const url = normalizeSourceUrl(match[0]);
      if (!url) {
        invalidCount++;
        continue;
      }
      const prefix = line.slice(0, line.indexOf(match[0])).trim();
      const cleanedPrefix = prefix.replace(/[|,，:：、=\t\- ]+$/, '').trim();
      const name = (cleanedPrefix || deriveNameFromUrl(url)).slice(0, 50);
      const id = generateSourceId(url, taken);
      taken.add(id);
      sources.push({ id, name, url });
    }
  }

  const { unique, dropped } = dedupeBatch(sources);
  return { sources: unique, format, invalidCount: invalidCount + dropped };
}

/** 为解析结果标注与现有源的重复情况（按 ID 或规范化 URL 比对） */
export function annotateDuplicates(parsed: ParsedSource[], existing: VideoSource[]): ParsedSource[] {
  const norm = (s: string) => s.trim().replace(/\/+$/, '').toLowerCase();
  const existingUrls = new Set(existing.map((s) => norm(s.url)));
  const existingIds = new Set(existing.map((s) => s.id));
  return parsed.map((p) => ({
    ...p,
    duplicate: existingIds.has(p.id) || existingUrls.has(norm(p.url)),
  }));
}
