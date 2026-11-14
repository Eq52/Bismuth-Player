// 苹果 CMS RSS XML 源解析（纯文本映射，无 DOM 依赖，便于在 node 测试环境单测）
//
// 支持两种输出格式的同构映射：
//   JSON 响应：{ code, list: [VideoItem], class: [...] }
//   XML 响应：<rss><list ...><video>...</video></list><class><ty id="1">名称</ty></class></rss>
//
// 播放列表沿用既有编码：多条线路用 $$$ 分隔，线路内剧集用 # 分隔，
// 每集为「集名$地址」，与 JSON 的 vod_play_url / vod_play_from 完全一致，
// 因此上层 parsePlaySources 无需改动。

import type { ApiResponse, Category, VideoItem } from '@/types';

/** 判断响应文本是否为 RSS XML 源 */
export function isXmlFeed(text: string): boolean {
  const head = text.trim().slice(0, 200).toLowerCase();
  return head.startsWith('<?xml') || head.startsWith('<rss') || head.startsWith('<rss ');
}

/** 解开 CDATA 并还原基础 XML 实体 */
function unwrapCdata(raw: string): string {
  let s = raw.trim();
  s = s.replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1');
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/** 提取块内指定标签的文本（取首个匹配） */
function field(block: string, tag: string): string {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? unwrapCdata(m[1]) : '';
}

/** 提取某标签的全部子块（非贪婪，按块切分） */
function blocks(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)</${tag}>`, 'gi');
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) out.push(m[1]);
  return out;
}

/** 提取标签属性值 */
function attr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`${name}="([^"]*)"`, 'i'));
  return m ? m[1] : '';
}

/** 解析 <dl> 内的 <dd> 线路：返回 play_from（线路名）与 play_url（编码后的剧集串） */
function parsePlayLines(block: string): { playFrom: string; playUrl: string } {
  const dls = block.match(/<dl\b[^>]*>([\s\S]*?)<\/dl>/gi);
  if (!dls || dls.length === 0) return { playFrom: '', playUrl: '' };

  const froms: string[] = [];
  const urls: string[] = [];
  for (const dl of dls) {
    const ddRe = /<dd\b([^>]*)>([\s\S]*?)<\/dd>/gi;
    let dm: RegExpExecArray | null;
    while ((dm = ddRe.exec(dl)) !== null) {
      const flag = attr(dm[1], 'flag') || '线路';
      const episodes = unwrapCdata(dm[2]);
      if (episodes) {
        froms.push(flag);
        urls.push(episodes);
      }
    }
  }
  return { playFrom: froms.join('$$$'), playUrl: urls.join('$$$') };
}

/** 将单个 <video> 块映射为 VideoItem */
function mapVideo(block: string): VideoItem {
  const id = Number(field(block, 'id')) || 0;
  const { playFrom, playUrl } = parsePlayLines(block);

  const item: VideoItem = {
    vod_id: id,
    vod_name: field(block, 'name'),
    vod_pic: field(block, 'pic'),
    vod_remarks: field(block, 'note') || undefined,
    type_name: field(block, 'type') || undefined,
    vod_year: field(block, 'year') || undefined,
    vod_area: field(block, 'area') || undefined,
    vod_actor: field(block, 'actor') || undefined,
    vod_director: field(block, 'director') || undefined,
    vod_content: field(block, 'des') || undefined,
  };
  if (playUrl) item.vod_play_url = playUrl;
  if (playFrom) item.vod_play_from = playFrom;
  return item;
}

/** 解析 RSS XML 文本为统一的 ApiResponse 结构 */
export function parseXmlApiResponse(text: string): ApiResponse {
  const listBlocks = blocks(text, 'video').map(mapVideo);

  let page: number | undefined;
  let pagecount: number | undefined;
  let total: number | undefined;
  const listTag = text.match(/<list\b([^>]*)>/i);
  if (listTag) {
    const pageAttr = attr(listTag[1], 'page');
    const pagecountAttr = attr(listTag[1], 'pagecount');
    const recordAttr = attr(listTag[1], 'recordcount') || attr(listTag[1], 'total');
    if (pageAttr) page = Number(pageAttr) || undefined;
    if (pagecountAttr) pagecount = Number(pagecountAttr) || undefined;
    if (recordAttr) total = Number(recordAttr) || undefined;
  }

  // 分类：<class><ty id="1">电视剧</ty>...</class>（扁平结构，无父子层级）
  const classBlock = text.match(/<class\b[^>]*>([\s\S]*?)<\/class>/i);
  let classList: Category[] | undefined;
  if (classBlock) {
    const tyRe = /<ty\b([^>]*)>([\s\S]*?)<\/ty>/gi;
    const categories: Category[] = [];
    let tm: RegExpExecArray | null;
    while ((tm = tyRe.exec(classBlock[1])) !== null) {
      const typeId = Number(attr(tm[1], 'id'));
      if (Number.isFinite(typeId)) {
        categories.push({ type_id: typeId, type_pid: 0, type_name: unwrapCdata(tm[2]) });
      }
    }
    if (categories.length > 0) classList = categories;
  }

  return {
    code: listBlocks.length > 0 ? 1 : 0,
    msg: listBlocks.length > 0 ? '数据列表' : 'Invalid API response',
    page,
    pagecount,
    total,
    list: listBlocks,
    ...(classList ? { class: classList } : {}),
  };
}
