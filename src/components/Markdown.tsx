// 轻量 Markdown 渲染（零依赖）
// 仅覆盖 Release/CHANGELOG 实际使用的语法：标题、无序列表、加粗、行内代码、链接、段落。
// 不解析原始 HTML，链接只允许 http(s)，从根本上避免 XSS。

import type { ReactNode } from 'react';

/** 只放行 http(s) 链接，阻止 javascript: 等协议 */
function isSafeUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:';
  } catch {
    return false;
  }
}

// 行内 token：**加粗**、`代码`、[文本](链接)
const INLINE_RE = /(\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\))/g;

function parseInline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let key = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;

  while ((m = INLINE_RE.exec(text)) !== null) {
    if (m.index > lastIndex) nodes.push(text.slice(lastIndex, m.index));

    if (m[2] !== undefined) {
      nodes.push(
        <strong key={key++} className="text-white font-semibold">
          {m[2]}
        </strong>
      );
    } else if (m[3] !== undefined) {
      nodes.push(
        <code
          key={key++}
          className="px-1 py-0.5 text-[10px] text-purple-300 bg-white/10 rounded break-all"
        >
          {m[3]}
        </code>
      );
    } else if (m[4] !== undefined) {
      const url = m[5];
      nodes.push(
        isSafeUrl(url) ? (
          <a
            key={key++}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-purple-400 hover:underline break-all"
          >
            {m[4]}
          </a>
        ) : (
          <span key={key++}>{m[4]}</span>
        )
      );
    }
    lastIndex = INLINE_RE.lastIndex;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

// 标题元素（固定标签，避免动态标签名的类型问题）
function Heading({ level, text }: { level: number; text: string }) {
  const content = parseInline(text);
  if (level <= 2) {
    return <h3 className="text-white text-sm font-semibold mt-3 mb-1.5 first:mt-0">{content}</h3>;
  }
  return <h4 className="text-gray-200 text-xs font-semibold mt-2.5 mb-1">{content}</h4>;
}

export function Markdown({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const trimmed = lines[i].trim();
    if (!trimmed) {
      i++;
      continue;
    }

    // 标题
    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      blocks.push(<Heading key={key++} level={heading[1].length} text={heading[2]} />);
      i++;
      continue;
    }

    // 无序列表（连续的 -/* 行归组）
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      blocks.push(
        <ul key={key++} className="list-disc pl-5 my-1.5 space-y-1 text-[11px] text-gray-400">
          {items.map((it, j) => (
            <li key={j} className="leading-relaxed">{parseInline(it)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // 普通段落（合并连续非空、非块级行）
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^#{1,6}\s/.test(lines[i].trim()) &&
      !/^[-*]\s/.test(lines[i].trim())
    ) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push(
      <p key={key++} className="text-[11px] text-gray-400 leading-relaxed my-1">
        {parseInline(para.join(' '))}
      </p>
    );
  }

  // break-words 让长单词/长 URL 在词内换行，避免撑出横向滚动
  return <div className="flex flex-col break-words">{blocks}</div>;
}
