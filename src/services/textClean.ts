// 描述文本清洗：影视源常见「把 HTML 当排版工具」——简介里塞 <br>、成串的 &nbsp; 当缩进/分段，
// 以及 &amp; 之类的转义。直接展示会出现字面的 "&nbsp;" 和一大段空白把行撑爆，这里统一归一化。

/** 常见命名实体（只收影视源里真会出现的那些，未知实体原样保留） */
const NAMED_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ensp: ' ',
  emsp: ' ',
  thinsp: ' ',
  zwnbsp: '',
  zwsp: '',
  shy: '',
  mdash: '—',
  ndash: '–',
  hellip: '…',
  ldquo: '“',
  rdquo: '”',
  lsquo: '‘',
  rsquo: '’',
  middot: '·',
  bull: '•',
  times: '×',
  divide: '÷',
  plusmn: '±',
  deg: '°',
  copy: '©',
  reg: '®',
  trade: '™',
  laquo: '«',
  raquo: '»',
};

/**
 * 解码 HTML 实体（命名实体 + 十进制/十六进制数字实体）。
 * 未知实体保持原样，避免把源方的原文误吞掉。
 */
export function decodeHtmlEntities(raw: string): string {
  return raw.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z][a-zA-Z0-9]*);/g, (match, body: string) => {
    if (body.startsWith('#')) {
      const hex = body[1] === 'x' || body[1] === 'X';
      const code = hex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      // 非法码点（0、代理区、超出 Unicode 上限）保持原样
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff || (code >= 0xd800 && code <= 0xdfff)) {
        return match;
      }
      return String.fromCodePoint(code);
    }
    return NAMED_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/**
 * 清洗简介等展示文本：
 * 1. 解码 HTML 实体；
 * 2. `<br>` / `</p>` 视为换行，其余标签剥离；
 * 3. 成串空白还原为换行 —— 这类源正是拿 &nbsp;、全角空格充当缩进与分段；
 *    纯 ASCII 空格需连续 3 个以上才判定为分段，以免英文句间的双空格被误拆行；
 * 4. 合并连续空行、逐行去首尾空白。
 */
export function cleanDescription(raw: string | undefined | null): string {
  if (!raw) return '';

  let text = decodeHtmlEntities(raw);
  text = text.replace(/<br\s*\/?>/gi, '\n').replace(/<\/p\s*>/gi, '\n');
  text = text.replace(/<[^>]*>/g, '');
  // [^\S\n] = 除换行外的任意空白字符（覆盖 \u00a0、\u3000 等）
  text = text.replace(/[^\S\n]{2,}/g, (run) => {
    const hasWideSpace = /[\u00a0\u1680\u2000-\u200a\u202f\u205f\u3000]/.test(run);
    return hasWideSpace || run.length >= 3 ? '\n' : run;
  });
  text = text.replace(/\n{2,}/g, '\n');

  return text
    .split('\n')
    .map((line) => line.trim())
    .filter((line, i, arr) => !(line === '' && (i === 0 || i === arr.length - 1)))
    .join('\n')
    .trim();
}
